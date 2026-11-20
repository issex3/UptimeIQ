"""REST API for alerts."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.deps import get_current_user
from app.schemas import AlertOut
from app.services.alert_service import list_alerts

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertOut])
async def get_alerts(
    _: Annotated[str, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list:
    """Return recent threshold alerts."""
    return await list_alerts(session, limit=200)
