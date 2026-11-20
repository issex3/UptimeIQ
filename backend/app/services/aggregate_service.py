"""Per-minute metric aggregation for compact historical queries."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import MetricMinuteBucket


def _disk_max_percent(observation: dict[str, Any] | None) -> float | None:
    parts = ((observation or {}).get("disk") or {}).get("partitions") or []
    if not parts:
        return None
    try:
        return max(float(p.get("percent") or 0.0) for p in parts)
    except (TypeError, ValueError):
        return None


async def upsert_minute_aggregate(
    session: AsyncSession,
    *,
    device_id: str,
    timestamp_unix: int,
    cpu: float,
    memory: float,
    observation: dict[str, Any] | None,
) -> None:
    """Increment running sums for the UTC minute bucket."""
    bucket_start = datetime.fromtimestamp(timestamp_unix, tz=timezone.utc).replace(
        microsecond=0, second=0
    )
    net = (observation or {}).get("network") or {}
    latency = net.get("latency_ms")
    conn = net.get("connection_count")
    disk_max = _disk_max_percent(observation)

    stmt = select(MetricMinuteBucket).where(
        MetricMinuteBucket.device_id == device_id,
        MetricMinuteBucket.bucket_start == bucket_start,
    )
    row = (await session.execute(stmt)).scalar_one_or_none()
    if row is None:
        row = MetricMinuteBucket(
            device_id=device_id,
            bucket_start=bucket_start,
            sample_count=0,
            sum_cpu=0.0,
            sum_memory=0.0,
            sum_latency_ms=0.0,
            latency_samples=0,
            sum_connection_count=0.0,
            connection_samples=0,
            sum_disk_max_percent=0.0,
            disk_samples=0,
        )
        session.add(row)
        await session.flush()

    row.sample_count += 1
    row.sum_cpu += float(cpu)
    row.sum_memory += float(memory)

    if latency is not None:
        try:
            row.sum_latency_ms += float(latency)
            row.latency_samples += 1
        except (TypeError, ValueError):
            pass

    if conn is not None:
        try:
            row.sum_connection_count += float(conn)
            row.connection_samples += 1
        except (TypeError, ValueError):
            pass

    if disk_max is not None:
        row.sum_disk_max_percent += float(disk_max)
        row.disk_samples += 1


async def list_recent_buckets(
    session: AsyncSession,
    *,
    device_id: str | None,
    limit: int = 120,
) -> list[MetricMinuteBucket]:
    """Return newest minute buckets first."""
    stmt = select(MetricMinuteBucket).order_by(
        MetricMinuteBucket.bucket_start.desc()
    ).limit(limit)
    if device_id:
        stmt = stmt.where(MetricMinuteBucket.device_id == device_id)
    rows = (await session.execute(stmt)).scalars().all()
    return list(rows)
