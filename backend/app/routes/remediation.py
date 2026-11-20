"""Controlled allowlisted remediation API."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.deps import get_current_user
from app.models import RemediationAction
from app.services import remediation_service as rem
from app.websocket import manager

router = APIRouter(prefix="/remediation", tags=["remediation"])


class ProposeBody(BaseModel):
    device_id: str
    action_type: str
    target: str
    reason: str = ""
    evidence: dict[str, Any] | None = None


class ApproveBody(BaseModel):
    execute_now: bool = Field(
        default=True,
        description="If true, dispatch to the agent immediately after approve.",
    )


def _http(err: rem.RemediationError) -> HTTPException:
    return HTTPException(status_code=err.status_code, detail=str(err))


@router.get("/allowlist")
async def get_allowlist(
    _user: Annotated[str, Depends(get_current_user)],
) -> dict:
    return {
        "actions": sorted(rem.ALLOWED_ACTIONS),
        "note": "AI and operators may only propose these actions. No arbitrary shell.",
    }


@router.get("")
async def list_actions(
    _user: Annotated[str, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    device_id: str | None = None,
    limit: int = 40,
) -> list[dict]:
    stmt = select(RemediationAction).order_by(RemediationAction.id.desc()).limit(limit)
    if device_id:
        stmt = stmt.where(RemediationAction.device_id == device_id)
    rows = list((await session.execute(stmt)).scalars().all())
    return [rem.action_to_dict(r) for r in rows]


@router.post("/propose")
async def propose(
    body: ProposeBody,
    user: Annotated[str, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict:
    try:
        row = await rem.propose_action(
            session,
            device_id=body.device_id,
            action_type=body.action_type,
            target=body.target,
            reason=body.reason,
            evidence=body.evidence,
            proposed_by=user,
        )
        await session.commit()
        return rem.action_to_dict(row)
    except rem.RemediationError as e:
        raise _http(e) from e


@router.post("/{action_id}/approve")
async def approve(
    action_id: int,
    body: ApproveBody,
    _user: Annotated[str, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict:
    try:
        row = await rem.approve_action(session, action_id=action_id)
        dispatched = False
        dispatch_error = None
        if body.execute_now:
            row = await rem.mark_executing(session, action_id=action_id)
            cmd = rem.command_payload(row)
            ok = await manager.send_to_agent(row.device_id, cmd)
            dispatched = ok
            if not ok:
                row.status = "failed"
                row.result_message = "Agent offline — could not dispatch command"
                dispatch_error = row.result_message
        await session.commit()
        out = rem.action_to_dict(row)
        out["dispatched"] = dispatched
        if dispatch_error:
            out["dispatch_error"] = dispatch_error
        return out
    except rem.RemediationError as e:
        raise _http(e) from e


@router.post("/{action_id}/verify")
async def verify(
    action_id: int,
    _user: Annotated[str, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict:
    try:
        row = await rem.verify_action(session, action_id=action_id)
        await session.commit()
        return rem.action_to_dict(row)
    except rem.RemediationError as e:
        raise _http(e) from e
