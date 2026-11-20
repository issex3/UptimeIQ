"""Predictive early-warning risk assessment endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.deps import get_current_user
from app.services.risk_service import assess_device_risk

router = APIRouter(prefix="/risk", tags=["risk"])


@router.get("/{device_id}")
async def get_device_risk(
    device_id: str,
    _user: Annotated[str, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    lookback_hours: int = Query(default=6, ge=1, le=72),
) -> dict:
    return await assess_device_risk(
        session, device_id=device_id, lookback_hours=lookback_hours
    )
