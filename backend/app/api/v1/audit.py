import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.workflow import AuditLog
from app.schemas.audit import AuditLogOut

router = APIRouter(prefix="/audit-log", tags=["audit"])


@router.get("", response_model=list[AuditLogOut])
def list_audit_log(
    entity_type: str | None = None,
    entity_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
) -> list[AuditLog]:
    """Full audit trail: what was detected, why, what was proposed/done, by
    which agent, and who approved it -- the human-in-the-loop requirement's
    other half. Filterable by entity so the frontend can show "history for
    this incident" inline on the detail page."""
    query = db.query(AuditLog)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if entity_id:
        query = query.filter(AuditLog.entity_id == entity_id)
    return query.order_by(AuditLog.timestamp.desc()).all()
