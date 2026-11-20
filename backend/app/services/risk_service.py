"""Early failure-risk signals from historical minute buckets.

These are *indicative* signals for operators — not validated downtime
predictions. Do not present scores as guaranteed outage forecasts.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Alert, MetricMinuteBucket


def _avg(sum_v: float, n: int) -> float | None:
    if n <= 0:
        return None
    return sum_v / n


def _linear_slope(xs: list[float], ys: list[float]) -> float | None:
    """Ordinary least-squares slope; None if underdetermined."""
    n = len(xs)
    if n < 4 or n != len(ys):
        return None
    mean_x = sum(xs) / n
    mean_y = sum(ys) / n
    num = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
    den = sum((x - mean_x) ** 2 for x in xs)
    if den <= 0:
        return None
    return num / den


async def assess_device_risk(
    session: AsyncSession,
    *,
    device_id: str,
    lookback_hours: int = 6,
) -> dict[str, Any]:
    """Compute early-warning signals and a composite risk score (0–100)."""
    now = datetime.now(timezone.utc)
    since = now - timedelta(hours=lookback_hours)

    stmt = (
        select(MetricMinuteBucket)
        .where(
            MetricMinuteBucket.device_id == device_id,
            MetricMinuteBucket.bucket_start >= since,
        )
        .order_by(MetricMinuteBucket.bucket_start.asc())
    )
    buckets = list((await session.execute(stmt)).scalars().all())

    signals: list[dict[str, Any]] = []
    score = 0.0

    # --- Disk exhaustion ETA (percent/hour → hours to 95%) ---
    disk_pts = [
        (
            b.bucket_start.timestamp(),
            _avg(b.sum_disk_max_percent, b.disk_samples),
        )
        for b in buckets
        if b.disk_samples > 0
    ]
    disk_pts = [(t, v) for t, v in disk_pts if v is not None]
    if len(disk_pts) >= 4:
        t0 = disk_pts[0][0]
        xs = [(t - t0) / 3600.0 for t, _ in disk_pts]
        ys = [v for _, v in disk_pts]
        slope = _linear_slope(xs, ys)  # percent per hour
        current = ys[-1]
        if slope is not None and slope > 0.15 and current is not None:
            hours_left = max(0.0, (95.0 - current) / slope) if current < 95 else 0.0
            severity = (
                "high" if hours_left < 12 else "medium" if hours_left < 48 else "low"
            )
            signals.append(
                {
                    "kind": "disk_exhaustion",
                    "severity": severity,
                    "title": "Disk fill trajectory",
                    "detail": (
                        f"Disk usage ~{current:.1f}% and rising "
                        f"~{slope:.2f}%/h → ~{hours_left:.1f}h to 95% "
                        "(linear estimate, not a forecast)."
                    ),
                    "metrics": {
                        "current_percent": round(current, 2),
                        "slope_percent_per_hour": round(slope, 3),
                        "eta_hours_to_95": round(hours_left, 2),
                    },
                }
            )
            score += 35 if severity == "high" else 20 if severity == "medium" else 8

    # --- Unusual memory growth ---
    mem_pts = [
        (b.bucket_start.timestamp(), _avg(b.sum_memory, b.sample_count))
        for b in buckets
        if b.sample_count > 0
    ]
    mem_pts = [(t, v) for t, v in mem_pts if v is not None]
    if len(mem_pts) >= 6:
        t0 = mem_pts[0][0]
        xs = [(t - t0) / 3600.0 for t, _ in mem_pts]
        ys = [v for _, v in mem_pts]
        slope = _linear_slope(xs, ys)
        current = ys[-1]
        if slope is not None and slope > 1.5 and current is not None:
            severity = "high" if slope > 5 or current > 85 else "medium"
            signals.append(
                {
                    "kind": "memory_growth",
                    "severity": severity,
                    "title": "Unusual memory growth",
                    "detail": (
                        f"Memory ~{current:.1f}% with slope ~{slope:.2f}%/h "
                        "over the lookback window."
                    ),
                    "metrics": {
                        "current_percent": round(current, 2),
                        "slope_percent_per_hour": round(slope, 3),
                    },
                }
            )
            score += 30 if severity == "high" else 15

    # --- Deteriorating network (latency) ---
    lat_pts = [
        (b.bucket_start.timestamp(), _avg(b.sum_latency_ms, b.latency_samples))
        for b in buckets
        if b.latency_samples > 0
    ]
    lat_pts = [(t, v) for t, v in lat_pts if v is not None]
    if len(lat_pts) >= 8:
        mid = len(lat_pts) // 2
        early = sum(v for _, v in lat_pts[:mid]) / mid
        late = sum(v for _, v in lat_pts[mid:]) / (len(lat_pts) - mid)
        if early > 0 and late > early * 1.35 and late - early >= 15:
            severity = "high" if late > 120 or late > early * 2 else "medium"
            signals.append(
                {
                    "kind": "network_deterioration",
                    "severity": severity,
                    "title": "Network latency deteriorating",
                    "detail": (
                        f"Avg latency rose from ~{early:.0f}ms to ~{late:.0f}ms "
                        "across the window."
                    ),
                    "metrics": {
                        "early_avg_ms": round(early, 1),
                        "late_avg_ms": round(late, 1),
                    },
                }
            )
            score += 25 if severity == "high" else 12

    # --- Recurring alert patterns ---
    alert_since = now - timedelta(hours=24)
    alert_rows = list(
        (
            await session.execute(
                select(Alert)
                .where(
                    Alert.device_id == device_id,
                    Alert.created_at >= alert_since,
                )
                .order_by(Alert.created_at.desc())
            )
        )
        .scalars()
        .all()
    )
    counts: dict[str, int] = {}
    for a in alert_rows:
        counts[a.alert_type] = counts.get(a.alert_type, 0) + 1
    recurring = [(k, v) for k, v in counts.items() if v >= 3]
    recurring.sort(key=lambda x: -x[1])
    if recurring:
        top_type, top_n = recurring[0]
        severity = "high" if top_n >= 8 else "medium"
        signals.append(
            {
                "kind": "recurring_failures",
                "severity": severity,
                "title": "Recurring alert pattern",
                "detail": (
                    f"Alert `{top_type}` fired {top_n} times in 24h — "
                    "possible precursor pattern, not a confirmed outage."
                ),
                "metrics": {"alert_type": top_type, "count_24h": top_n},
            }
        )
        score += 20 if severity == "high" else 10

        # Suggest remediation when service-like alerts recur (heuristic)
        if "cpu" in top_type or "memory" in top_type:
            signals[-1]["suggested_action"] = None  # UI may propose separately

    score = min(100.0, round(score, 1))
    level = (
        "critical"
        if score >= 70
        else "elevated"
        if score >= 40
        else "watch"
        if score >= 15
        else "calm"
    )

    return {
        "device_id": device_id,
        "risk_score": score,
        "risk_level": level,
        "lookback_hours": lookback_hours,
        "bucket_count": len(buckets),
        "signals": signals,
        "disclaimer": (
            "Early-warning signals only. Not validated downtime prediction. "
            "Treat as operator hints pending incident-backed evaluation."
        ),
        "assessed_at": int(now.timestamp()),
    }
