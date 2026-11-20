"""REST API for stored metrics and aggregates."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.deps import get_current_user
from app.models import Metric
from app.schemas import MetricOut, MinuteBucketOut
from app.services.aggregate_service import list_recent_buckets

router = APIRouter(prefix="/metrics", tags=["metrics"])


def _minute_bucket_out(row) -> MinuteBucketOut:
    sc = row.sample_count or 1
    return MinuteBucketOut(
        id=row.id,
        device_id=row.device_id,
        bucket_start=row.bucket_start,
        sample_count=row.sample_count,
        avg_cpu=(row.sum_cpu / sc) if row.sample_count else 0.0,
        avg_memory=(row.sum_memory / sc) if row.sample_count else 0.0,
        avg_latency_ms=(
            row.sum_latency_ms / row.latency_samples
            if row.latency_samples
            else None
        ),
        avg_connection_count=(
            row.sum_connection_count / row.connection_samples
            if row.connection_samples
            else None
        ),
        avg_disk_max_percent=(
            row.sum_disk_max_percent / row.disk_samples if row.disk_samples else None
        ),
    )


@router.get("", response_model=list[MetricOut])
async def list_metrics(
    _: Annotated[str, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    device_id: str | None = None,
    limit: int = Query(default=500, le=5000),
) -> list[Metric]:
    """Return recent metrics, optionally filtered by device."""
    stmt = select(Metric).order_by(Metric.created_at.desc()).limit(limit)
    if device_id:
        stmt = stmt.where(Metric.device_id == device_id)
    result = await session.execute(stmt)
    return list(result.scalars().all())


@router.get("/aggregates/minutes", response_model=list[MinuteBucketOut])
async def minute_aggregates(
    _: Annotated[str, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    device_id: str | None = None,
    limit: int = Query(default=180, le=2000),
) -> list[MinuteBucketOut]:
    """Return per-minute aggregated averages (newest first)."""
    rows = await list_recent_buckets(session, device_id=device_id, limit=limit)
    return [_minute_bucket_out(r) for r in rows]
