"""SQLAlchemy ORM models for metrics, aggregates, and alerts."""

from datetime import datetime

from sqlalchemy import (
    BigInteger,
    DateTime,
    Float,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Metric(Base):
    """Time-series metric sample from a monitored device."""

    __tablename__ = "metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    device_id: Mapped[str] = mapped_column(String(128), index=True)
    cpu: Mapped[float] = mapped_column(Float)
    memory: Mapped[float] = mapped_column(Float)
    network_in: Mapped[int] = mapped_column(Integer)
    network_out: Mapped[int] = mapped_column(Integer)
    timestamp: Mapped[int] = mapped_column(Integer, index=True)
    observation: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class MetricMinuteBucket(Base):
    """Rolling per-minute aggregates for efficient dashboards."""

    __tablename__ = "metric_minute_buckets"
    __table_args__ = (
        UniqueConstraint("device_id", "bucket_start", name="uq_metric_minute_device"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    device_id: Mapped[str] = mapped_column(String(128), index=True)
    bucket_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    sample_count: Mapped[int] = mapped_column(Integer, default=0)
    sum_cpu: Mapped[float] = mapped_column(Float, default=0.0)
    sum_memory: Mapped[float] = mapped_column(Float, default=0.0)
    sum_latency_ms: Mapped[float] = mapped_column(Float, default=0.0)
    latency_samples: Mapped[int] = mapped_column(Integer, default=0)
    sum_connection_count: Mapped[float] = mapped_column(Float, default=0.0)
    connection_samples: Mapped[int] = mapped_column(Integer, default=0)
    sum_disk_max_percent: Mapped[float] = mapped_column(Float, default=0.0)
    disk_samples: Mapped[int] = mapped_column(Integer, default=0)


class SeenRemoteIp(Base):
    """Tracks external remote IPs observed per device (security baselining)."""

    __tablename__ = "seen_remote_ips"
    __table_args__ = (
        UniqueConstraint("device_id", "remote_ip", name="uq_seen_remote_ip_device"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    device_id: Mapped[str] = mapped_column(String(128), index=True)
    remote_ip: Mapped[str] = mapped_column(String(64), index=True)
    first_seen_at: Mapped[int] = mapped_column(BigInteger)


class Alert(Base):
    """Threshold or behavioral alert for a device."""

    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    device_id: Mapped[str] = mapped_column(String(128), index=True)
    alert_type: Mapped[str] = mapped_column(String(64))
    severity: Mapped[str] = mapped_column(
        String(16), server_default="medium", default="medium"
    )
    message: Mapped[str] = mapped_column(Text)
    metric_value: Mapped[float] = mapped_column(Float)
    threshold: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class RemediationAction(Base):
    """Allowlisted remediation workflow with full audit trail."""

    __tablename__ = "remediation_actions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    device_id: Mapped[str] = mapped_column(String(128), index=True)
    action_type: Mapped[str] = mapped_column(String(64))
    target: Mapped[str] = mapped_column(String(256))
    status: Mapped[str] = mapped_column(String(32), default="proposed", index=True)
    reason: Mapped[str] = mapped_column(Text)
    evidence: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    proposed_by: Mapped[str] = mapped_column(String(128), default="system")
    result_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    verification_ok: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    executed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class DeviceHeartbeat(Base):
    """Latest agent heartbeat per device."""

    __tablename__ = "device_heartbeats"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    device_id: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    last_seen_at: Mapped[int] = mapped_column(BigInteger)
    agent_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
