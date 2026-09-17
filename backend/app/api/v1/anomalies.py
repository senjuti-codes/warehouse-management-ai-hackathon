from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.workflow import Anomaly
from app.schemas.incidents import AnomalyOut

router = APIRouter(prefix="/anomalies", tags=["anomalies"])


@router.get("", response_model=list[AnomalyOut])
def list_anomalies(
    status: str | None = None,
    category: str | None = None,
    type_code: str | None = None,
    db: Session = Depends(get_db),
) -> list[Anomaly]:
    """Raw anomaly list -- this is what backs the "list of anomalies
    detected" deliverable the guide asks teams to submit for judges to
    verify coverage against the catalog."""
    query = db.query(Anomaly)
    if status:
        query = query.filter(Anomaly.status == status.upper())
    if category:
        query = query.filter(Anomaly.category == category)
    if type_code:
        query = query.filter(Anomaly.type_code == type_code.upper())
    return query.order_by(Anomaly.detected_at.desc()).all()
