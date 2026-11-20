"""WebSocket hub for agent ingest, heartbeats, remediation, and live dashboards."""

from __future__ import annotations

import json
import time
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt

from app.config import settings
from app.database import async_session_factory
from app.models import DeviceHeartbeat, Metric
from app.services.aggregate_service import upsert_minute_aggregate
from app.services.alert_service import evaluate_metrics
from app.services import remediation_service as rem

router = APIRouter()


class ConnectionManager:
    """Tracks dashboard viewers and per-device agent sockets."""

    def __init__(self) -> None:
        self.viewers: list[WebSocket] = []
        self.agents: dict[str, WebSocket] = {}

    async def connect_viewer(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.viewers.append(websocket)

    async def connect_agent(self, websocket: WebSocket) -> None:
        await websocket.accept()

    def bind_agent(self, device_id: str, websocket: WebSocket) -> None:
        self.agents[device_id] = websocket

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.viewers:
            self.viewers.remove(websocket)
        dead = [did for did, ws in self.agents.items() if ws is websocket]
        for did in dead:
            self.agents.pop(did, None)

    async def broadcast_json(self, payload: dict[str, Any]) -> None:
        dead: list[WebSocket] = []
        text = json.dumps(payload)
        for ws in self.viewers:
            try:
                await ws.send_text(text)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    async def send_to_agent(self, device_id: str, payload: dict[str, Any]) -> bool:
        ws = self.agents.get(device_id)
        if ws is None:
            return False
        try:
            await ws.send_text(json.dumps(payload))
            return True
        except Exception:
            self.agents.pop(device_id, None)
            return False

    def agent_online(self, device_id: str) -> bool:
        return device_id in self.agents


manager = ConnectionManager()


def _token_is_valid(token: str) -> bool:
    try:
        jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return True
    except JWTError:
        return False


def _extract_observation(payload: dict[str, Any]) -> dict[str, Any] | None:
    raw = payload.get("observation")
    if raw is None:
        raw = payload.get("obs")
    if raw is None:
        return None
    if isinstance(raw, dict):
        return raw
    return None


async def _persist_heartbeat(device_id: str, ts: int, version: str | None) -> None:
    from sqlalchemy import select

    async with async_session_factory() as session:
        existing = (
            await session.execute(
                select(DeviceHeartbeat).where(DeviceHeartbeat.device_id == device_id)
            )
        ).scalar_one_or_none()
        if existing is None:
            session.add(
                DeviceHeartbeat(
                    device_id=device_id,
                    last_seen_at=ts,
                    agent_version=version,
                )
            )
        else:
            existing.last_seen_at = ts
            if version:
                existing.agent_version = version
        await session.commit()


async def _persist_and_alert(
    payload: dict[str, Any],
) -> tuple[Metric | None, list[dict[str, Any]]]:
    required = ("device_id", "cpu", "memory", "network_in", "network_out", "timestamp")
    if not all(k in payload for k in required):
        return None, []

    observation = _extract_observation(payload)

    async with async_session_factory() as session:
        metric = Metric(
            device_id=str(payload["device_id"]),
            cpu=float(payload["cpu"]),
            memory=float(payload["memory"]),
            network_in=int(payload["network_in"]),
            network_out=int(payload["network_out"]),
            timestamp=int(payload["timestamp"]),
            observation=observation,
        )
        session.add(metric)
        await session.flush()

        await upsert_minute_aggregate(
            session,
            device_id=metric.device_id,
            timestamp_unix=metric.timestamp,
            cpu=metric.cpu,
            memory=metric.memory,
            observation=observation,
        )

        alerts = await evaluate_metrics(
            session,
            device_id=metric.device_id,
            cpu=metric.cpu,
            memory=metric.memory,
            observation=observation,
        )
        await session.commit()

        alert_payloads: list[dict[str, Any]] = []
        for a in alerts:
            ts = (
                int(a.created_at.timestamp())
                if getattr(a, "created_at", None) is not None
                else int(time.time())
            )
            alert_payloads.append(
                {
                    "type": "alert",
                    "id": a.id,
                    "device_id": a.device_id,
                    "alert_type": a.alert_type,
                    "severity": getattr(a, "severity", None) or "medium",
                    "message": a.message,
                    "metric_value": a.metric_value,
                    "threshold": a.threshold,
                    "timestamp": ts,
                }
            )
        return metric, alert_payloads


async def _handle_remediation_result(payload: dict[str, Any]) -> dict[str, Any] | None:
    action_id = payload.get("action_id")
    if action_id is None:
        return None
    ok = bool(payload.get("ok"))
    message = str(payload.get("message") or ("ok" if ok else "failed"))
    async with async_session_factory() as session:
        try:
            row = await rem.record_result(
                session, action_id=int(action_id), ok=ok, message=message
            )
            if ok:
                row = await rem.verify_action(session, action_id=int(action_id))
            await session.commit()
            return {"type": "remediation_update", **rem.action_to_dict(row)}
        except rem.RemediationError:
            await session.rollback()
            return None


@router.websocket("/ws/metrics")
async def metrics_socket(websocket: WebSocket) -> None:
    """
    - Dashboard viewers: ?token=<JWT> (receive-only broadcasts).
    - Agents: no token; send metrics / heartbeats / remediation_result.
    """
    token = websocket.query_params.get("token")
    is_viewer = token is not None
    if is_viewer and not _token_is_valid(token):
        await websocket.close(code=4401)
        return

    if is_viewer:
        await manager.connect_viewer(websocket)
    else:
        await manager.connect_agent(websocket)

    try:
        while True:
            raw = await websocket.receive_text()
            if is_viewer:
                # Viewers should not push telemetry
                continue

            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"error": "invalid_json"})
                continue

            msg_type = payload.get("type") or "metric"

            if msg_type == "heartbeat":
                device_id = str(payload.get("device_id") or "")
                if not device_id:
                    await websocket.send_json({"error": "missing_device_id"})
                    continue
                manager.bind_agent(device_id, websocket)
                ts = int(payload.get("timestamp") or time.time())
                version = payload.get("agent_version")
                await _persist_heartbeat(
                    device_id, ts, str(version) if version else None
                )
                await manager.broadcast_json(
                    {
                        "type": "heartbeat",
                        "device_id": device_id,
                        "timestamp": ts,
                        "agent_version": version,
                    }
                )
                continue

            if msg_type == "remediation_result":
                update = await _handle_remediation_result(payload)
                if update:
                    await manager.broadcast_json(update)
                continue

            # Default: metric sample (legacy agents omit type)
            metric, alert_broadcasts = await _persist_and_alert(payload)
            if metric is None:
                await websocket.send_json({"error": "invalid_metric_payload"})
                continue

            manager.bind_agent(metric.device_id, websocket)

            obs = metric.observation if isinstance(metric.observation, dict) else None
            broadcast: dict[str, Any] = {
                "type": "metric",
                "device_id": metric.device_id,
                "cpu": metric.cpu,
                "memory": metric.memory,
                "network_in": metric.network_in,
                "network_out": metric.network_out,
                "timestamp": metric.timestamp,
            }
            if obs is not None:
                broadcast["observation"] = obs

            await manager.broadcast_json(broadcast)
            for ap in alert_broadcasts:
                await manager.broadcast_json(ap)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
