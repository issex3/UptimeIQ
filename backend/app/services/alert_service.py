"""Threshold, behavioral, and security alerting."""

from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Alert, Metric, SeenRemoteIp
from app.services.ip_util import is_external_ip, parse_remote_ip

CPU_THRESHOLD = 85.0
MEMORY_THRESHOLD = 80.0
DISK_THRESHOLD = 90.0
LATENCY_THRESHOLD_MS = 150.0
SPIKE_WINDOW_SAMPLES = 45  # ~2 minutes at 3s intervals
COOLDOWN_SECONDS = 120


async def _cooldown_active(
    session: AsyncSession, device_id: str, alert_type: str
) -> bool:
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=COOLDOWN_SECONDS)
    stmt = (
        select(Alert.id)
        .where(
            Alert.device_id == device_id,
            Alert.alert_type == alert_type,
            Alert.created_at >= cutoff,
        )
        .limit(1)
    )
    return (await session.execute(stmt)).scalar_one_or_none() is not None


def _disk_max_percent(observation: dict[str, Any] | None) -> float | None:
    parts = ((observation or {}).get("disk") or {}).get("partitions") or []
    if not parts:
        return None
    try:
        return max(float(p.get("percent") or 0.0) for p in parts)
    except (TypeError, ValueError):
        return None


def _append_alert(
    session: AsyncSession,
    *,
    device_id: str,
    alert_type: str,
    severity: str,
    message: str,
    metric_value: float,
    threshold: float,
    alerts: list[Alert],
) -> None:
    row = Alert(
        device_id=device_id,
        alert_type=alert_type,
        severity=severity,
        message=message,
        metric_value=metric_value,
        threshold=threshold,
    )
    session.add(row)
    alerts.append(row)


async def _threshold_alerts(
    session: AsyncSession,
    *,
    device_id: str,
    cpu: float,
    memory: float,
    observation: dict[str, Any] | None,
) -> list[Alert]:
    out: list[Alert] = []

    if cpu > CPU_THRESHOLD and not await _cooldown_active(
        session, device_id, "cpu_high"
    ):
        _append_alert(
            session,
            device_id=device_id,
            alert_type="cpu_high",
            severity="high",
            message=f"CPU usage {cpu:.1f}% exceeds threshold {CPU_THRESHOLD}%",
            metric_value=cpu,
            threshold=CPU_THRESHOLD,
            alerts=out,
        )

    if memory > MEMORY_THRESHOLD and not await _cooldown_active(
        session, device_id, "memory_high"
    ):
        _append_alert(
            session,
            device_id=device_id,
            alert_type="memory_high",
            severity="high",
            message=(
                f"Memory usage {memory:.1f}% exceeds threshold {MEMORY_THRESHOLD}%"
            ),
            metric_value=memory,
            threshold=MEMORY_THRESHOLD,
            alerts=out,
        )

    disk_max = _disk_max_percent(observation)
    if (
        disk_max is not None
        and disk_max > DISK_THRESHOLD
        and not await _cooldown_active(session, device_id, "disk_high")
    ):
        _append_alert(
            session,
            device_id=device_id,
            alert_type="disk_high",
            severity="high",
            message=(
                f"Disk usage {disk_max:.1f}% exceeds threshold {DISK_THRESHOLD}% "
                "on at least one partition"
            ),
            metric_value=disk_max,
            threshold=DISK_THRESHOLD,
            alerts=out,
        )

    latency = ((observation or {}).get("network") or {}).get("latency_ms")
    try:
        latency_f = float(latency) if latency is not None else None
    except (TypeError, ValueError):
        latency_f = None
    if (
        latency_f is not None
        and latency_f > LATENCY_THRESHOLD_MS
        and not await _cooldown_active(session, device_id, "latency_high")
    ):
        _append_alert(
            session,
            device_id=device_id,
            alert_type="latency_high",
            severity="medium",
            message=(
                f"Ping latency {latency_f:.1f}ms exceeds "
                f"{LATENCY_THRESHOLD_MS:.0f}ms toward 8.8.8.8"
            ),
            metric_value=latency_f,
            threshold=LATENCY_THRESHOLD_MS,
            alerts=out,
        )

    if out:
        await session.flush()
    return out


async def _behavioral_alerts(
    session: AsyncSession,
    *,
    device_id: str,
    cpu: float,
    memory: float,
    observation: dict[str, Any] | None,
) -> list[Alert]:
    out: list[Alert] = []
    stmt = (
        select(Metric.cpu, Metric.memory, Metric.observation)
        .where(Metric.device_id == device_id)
        .order_by(Metric.id.desc())
        .limit(SPIKE_WINDOW_SAMPLES)
    )
    rows = list((await session.execute(stmt)).all())
    rows_chrono = list(reversed(rows))
    cpus = [float(r.cpu) for r in rows_chrono]
    mems = [float(r.memory) for r in rows_chrono]

    # CPU spike: current vs minimum in window (excluding current sample row might duplicate — acceptable)
    if len(cpus) >= 8:
        past_min = min(cpus[:-1]) if len(cpus) > 1 else cpus[-1]
        if cpu - past_min >= 30 and not await _cooldown_active(
            session, device_id, "cpu_spike"
        ):
            _append_alert(
                session,
                device_id=device_id,
                alert_type="cpu_spike",
                severity="medium",
                message=(
                    f"CPU jumped by {cpu - past_min:.1f} points within ~2 minutes "
                    f"(now {cpu:.1f}%, prior floor {past_min:.1f}%)"
                ),
                metric_value=cpu - past_min,
                threshold=30.0,
                alerts=out,
            )

    # Memory drift / leak heuristic
    if len(mems) >= 16:
        mid = len(mems) // 2
        early = sum(mems[:mid]) / max(mid, 1)
        late = sum(mems[mid:]) / max(len(mems) - mid, 1)
        if late - early >= 8 and not await _cooldown_active(
            session, device_id, "memory_trend"
        ):
            _append_alert(
                session,
                device_id=device_id,
                alert_type="memory_trend",
                severity="medium",
                message=(
                    f"Memory trending upward (~{late - early:.1f}% higher in recent window); "
                    "possible leak or workload shift"
                ),
                metric_value=late - early,
                threshold=8.0,
                alerts=out,
            )

    conn_series: list[float] = []
    for r in rows_chrono:
        obs = r.observation or {}
        c = (obs.get("network") or {}).get("connection_count")
        if c is not None:
            try:
                conn_series.append(float(c))
            except (TypeError, ValueError):
                pass
    cur_conn = ((observation or {}).get("network") or {}).get("connection_count")
    try:
        cur_conn_f = float(cur_conn) if cur_conn is not None else None
    except (TypeError, ValueError):
        cur_conn_f = None

    if cur_conn_f is not None and len(conn_series) >= 10:
        baseline = sum(conn_series[:-1]) / max(len(conn_series) - 1, 1)
        if cur_conn_f > baseline * 2 + 10 and not await _cooldown_active(
            session, device_id, "connection_spike"
        ):
            _append_alert(
                session,
                device_id=device_id,
                alert_type="connection_spike",
                severity="medium",
                message=(
                    f"Connections surged to {cur_conn_f:.0f} vs recent baseline "
                    f"~{baseline:.1f}"
                ),
                metric_value=cur_conn_f,
                threshold=baseline * 2 + 10,
                alerts=out,
            )

    if out:
        await session.flush()
    return out


async def _register_novel_external_ips(
    session: AsyncSession,
    *,
    device_id: str,
    observation: dict[str, Any] | None,
) -> list[str]:
    newly_seen: list[str] = []
    sample = ((observation or {}).get("network") or {}).get(
        "connections_sample"
    ) or []
    now_ts = int(time.time())
    for row in sample:
        remote = row.get("remote")
        ip = parse_remote_ip(remote)
        if not ip or not is_external_ip(ip):
            continue
        exists = (
            await session.execute(
                select(SeenRemoteIp.id).where(
                    SeenRemoteIp.device_id == device_id,
                    SeenRemoteIp.remote_ip == ip,
                )
            )
        ).scalar_one_or_none()
        if exists:
            continue
        session.add(
            SeenRemoteIp(
                device_id=device_id,
                remote_ip=ip,
                first_seen_at=now_ts,
            )
        )
        newly_seen.append(ip)
    if newly_seen:
        await session.flush()
    return newly_seen


async def _security_alerts(
    session: AsyncSession,
    *,
    device_id: str,
    observation: dict[str, Any] | None,
) -> list[Alert]:
    out: list[Alert] = []
    proc_block = ((observation or {}).get("processes") or {})
    newcomers = proc_block.get("new_processes") or []
    if newcomers and not await _cooldown_active(session, device_id, "new_process"):
        names = ", ".join(
            f"{p.get('name')} ({p.get('pid')})" for p in newcomers[:8]
        )
        _append_alert(
            session,
            device_id=device_id,
            alert_type="new_process",
            severity="medium",
            message=f"New processes detected: {names}",
            metric_value=float(len(newcomers)),
            threshold=0.0,
            alerts=out,
        )

    novel_ips = await _register_novel_external_ips(
        session, device_id=device_id, observation=observation
    )
    if novel_ips and not await _cooldown_active(
        session, device_id, "novel_external_ip"
    ):
        _append_alert(
            session,
            device_id=device_id,
            alert_type="novel_external_ip",
            severity="high",
            message="New external IP endpoints observed: " + ", ".join(novel_ips[:12]),
            metric_value=float(len(novel_ips)),
            threshold=0.0,
            alerts=out,
        )

    if out:
        await session.flush()
    return out


async def evaluate_metrics(
    session: AsyncSession,
    *,
    device_id: str,
    cpu: float,
    memory: float,
    observation: dict[str, Any] | None = None,
) -> list[Alert]:
    """
    Run threshold, behavioral, and security evaluations for one ingest tick.
    """
    alerts: list[Alert] = []
    alerts.extend(
        await _threshold_alerts(
            session,
            device_id=device_id,
            cpu=cpu,
            memory=memory,
            observation=observation,
        )
    )
    alerts.extend(
        await _behavioral_alerts(
            session,
            device_id=device_id,
            cpu=cpu,
            memory=memory,
            observation=observation,
        )
    )
    alerts.extend(
        await _security_alerts(
            session,
            device_id=device_id,
            observation=observation,
        )
    )
    return alerts


async def list_alerts(session: AsyncSession, *, limit: int = 100) -> list[Alert]:
    """Return recent alerts, newest first."""
    result = await session.execute(
        select(Alert).order_by(Alert.created_at.desc()).limit(limit)
    )
    return list(result.scalars().all())
