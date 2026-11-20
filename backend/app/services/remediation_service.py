"""Allowlisted remediation: propose → approve → execute → verify → audit.

Only restart_service and restart_container are permitted. Arbitrary shell
commands are never accepted.
"""

from __future__ import annotations

import re
import time
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Alert, RemediationAction

ALLOWED_ACTIONS = frozenset({"restart_service", "restart_container"})
TARGET_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")


class RemediationError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


def validate_action(action_type: str, target: str) -> None:
    if action_type not in ALLOWED_ACTIONS:
        raise RemediationError(
            f"Action `{action_type}` is not allowlisted. "
            f"Permitted: {', '.join(sorted(ALLOWED_ACTIONS))}"
        )
    if not TARGET_RE.match(target or ""):
        raise RemediationError(
            "Target must be a safe service/container name "
            "(letters, digits, ._- only)."
        )


async def propose_action(
    session: AsyncSession,
    *,
    device_id: str,
    action_type: str,
    target: str,
    reason: str,
    evidence: dict[str, Any] | None,
    proposed_by: str,
) -> RemediationAction:
    validate_action(action_type, target)
    row = RemediationAction(
        device_id=device_id,
        action_type=action_type,
        target=target,
        status="proposed",
        reason=reason.strip() or "Operator-proposed remediation",
        evidence=evidence or {},
        proposed_by=proposed_by,
    )
    session.add(row)
    await session.flush()
    return row


async def approve_action(
    session: AsyncSession,
    *,
    action_id: int,
) -> RemediationAction:
    row = await session.get(RemediationAction, action_id)
    if row is None:
        raise RemediationError("Remediation action not found", 404)
    if row.status not in ("proposed", "failed"):
        raise RemediationError(f"Cannot approve from status `{row.status}`")
    validate_action(row.action_type, row.target)
    row.status = "approved"
    row.approved_at = datetime.now(timezone.utc)
    await session.flush()
    return row


async def mark_executing(session: AsyncSession, action_id: int) -> RemediationAction:
    row = await session.get(RemediationAction, action_id)
    if row is None:
        raise RemediationError("Remediation action not found", 404)
    if row.status != "approved":
        raise RemediationError("Action must be approved before execution")
    row.status = "executing"
    row.executed_at = datetime.now(timezone.utc)
    await session.flush()
    return row


async def record_result(
    session: AsyncSession,
    *,
    action_id: int,
    ok: bool,
    message: str,
) -> RemediationAction:
    row = await session.get(RemediationAction, action_id)
    if row is None:
        raise RemediationError("Remediation action not found", 404)
    row.result_message = message[:2000]
    if not ok:
        row.status = "failed"
    else:
        row.status = "executed"
    await session.flush()
    return row


async def verify_action(
    session: AsyncSession,
    *,
    action_id: int,
) -> RemediationAction:
    """Lightweight verification: no matching high alerts in last 2 minutes."""
    row = await session.get(RemediationAction, action_id)
    if row is None:
        raise RemediationError("Remediation action not found", 404)
    if row.status not in ("executed", "verified", "failed"):
        raise RemediationError("Action must be executed before verification")

    cutoff = datetime.now(timezone.utc).timestamp() - 120
    # created_at compare via recent alerts count
    recent = list(
        (
            await session.execute(
                select(Alert)
                .where(Alert.device_id == row.device_id)
                .order_by(Alert.created_at.desc())
                .limit(8)
            )
        )
        .scalars()
        .all()
    )
    fresh_high = [
        a
        for a in recent
        if a.created_at
        and a.created_at.replace(tzinfo=timezone.utc).timestamp() >= cutoff
        and (a.severity or "").lower() == "high"
    ]
    ok = len(fresh_high) == 0 and row.status != "failed"
    row.verification_ok = 1 if ok else 0
    row.verified_at = datetime.now(timezone.utc)
    row.status = "verified" if ok else "failed"
    if not row.result_message:
        row.result_message = (
            "Verified: no fresh high-severity alerts"
            if ok
            else "Verification failed: high-severity alerts still present"
        )
    await session.flush()
    return row


def action_to_dict(row: RemediationAction) -> dict[str, Any]:
    return {
        "id": row.id,
        "device_id": row.device_id,
        "action_type": row.action_type,
        "target": row.target,
        "status": row.status,
        "reason": row.reason,
        "evidence": row.evidence,
        "proposed_by": row.proposed_by,
        "result_message": row.result_message,
        "verification_ok": row.verification_ok,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "approved_at": row.approved_at.isoformat() if row.approved_at else None,
        "executed_at": row.executed_at.isoformat() if row.executed_at else None,
        "verified_at": row.verified_at.isoformat() if row.verified_at else None,
        "allowlist": sorted(ALLOWED_ACTIONS),
    }


def command_payload(row: RemediationAction) -> dict[str, Any]:
    return {
        "type": "remediation_command",
        "action_id": row.id,
        "action": row.action_type,
        "target": row.target,
        "issued_at": int(time.time()),
    }
