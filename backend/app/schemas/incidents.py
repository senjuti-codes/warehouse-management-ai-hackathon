import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AnomalyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    type_code: str
    category: str
    source_sheet: str
    material: str | None
    plant: int | None
    vendor: str | None
    record_ref: dict
    severity: str
    description: str
    detected_by: str
    status: str
    detected_at: datetime


class IncidentSummary(BaseModel):
    """Lightweight shape for the incident list / priority queue view."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    severity: str
    impact_score: float
    impact_label: str | None
    status: str
    confidence: float
    created_at: datetime
    anomaly_count: int = 0


class IncidentDetail(BaseModel):
    """Full incident view: root cause narrative, linked evidence, actions."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    root_cause_summary: str
    confidence: float
    severity: str
    impact_score: float
    impact_label: str | None
    status: str
    created_at: datetime
    updated_at: datetime
    anomalies: list[AnomalyOut]
    actions: list["ActionOut"]


from app.schemas.actions import ActionOut  # noqa: E402  (avoid circular import at module load)

IncidentDetail.model_rebuild()
