"""Pydantic schemas for API requests and responses."""

from datetime import datetime

from pydantic import BaseModel


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    username: str
    password: str


class MetricOut(BaseModel):
    id: int
    device_id: str
    cpu: float
    memory: float
    network_in: int
    network_out: int
    timestamp: int
    observation: dict | None = None

    model_config = {"from_attributes": True}


class MinuteBucketOut(BaseModel):
    id: int
    device_id: str
    bucket_start: datetime
    sample_count: int
    avg_cpu: float
    avg_memory: float
    avg_latency_ms: float | None = None
    avg_connection_count: float | None = None
    avg_disk_max_percent: float | None = None


class AlertOut(BaseModel):
    id: int
    device_id: str
    alert_type: str
    severity: str
    message: str
    metric_value: float
    threshold: float
    created_at: datetime

    model_config = {"from_attributes": True}


class AnalyzeRequest(BaseModel):
    """Snapshot or aggregate metric fields for AI diagnosis."""

    device_id: str | None = None
    cpu: float | None = None
    memory: float | None = None
    network_in: int | None = None
    network_out: int | None = None
    timestamp: int | None = None
    notes: str | None = None


class AnalyzeResponse(BaseModel):
    issue: str
    explanation: str
    solution: str
