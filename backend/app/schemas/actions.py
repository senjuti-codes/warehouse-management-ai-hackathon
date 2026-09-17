import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ActionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    incident_id: uuid.UUID
    action_type: str
    proposed_change: dict
    justification: str
    proposed_by_agent: str
    status: str
    created_at: datetime
    decided_by: str | None
    decided_at: datetime | None
    decision_reason: str | None


class ActionDecisionRequest(BaseModel):
    """Body for POST /actions/{id}/approve and /actions/{id}/reject."""
    decided_by: str
    reason: str | None = None
