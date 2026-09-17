import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.models.workflow import Incident
from app.schemas.incidents import IncidentDetail, IncidentSummary

router = APIRouter(prefix="/incidents", tags=["incidents"])

_SEVERITY_ORDER = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}


@router.get("", response_model=list[IncidentSummary])
def list_incidents(status: str | None = None, db: Session = Depends(get_db)) -> list[IncidentSummary]:
    """Backs the priority-incident queue. Sorted by severity then impact
    score, matching the wireframe's CRITICAL-first ordering."""
    query = db.query(Incident).options(joinedload(Incident.anomaly_links))
    if status:
        query = query.filter(Incident.status == status.upper())
    incidents = query.all()
    incidents.sort(key=lambda i: (_SEVERITY_ORDER.get(i.severity, 9), -i.impact_score))

    return [
        IncidentSummary(
            id=i.id, title=i.title, severity=i.severity, impact_score=i.impact_score,
            impact_label=i.impact_label, status=i.status, confidence=i.confidence,
            created_at=i.created_at, anomaly_count=len(i.anomaly_links),
        )
        for i in incidents
    ]


@router.get("/{incident_id}", response_model=IncidentDetail)
def get_incident(incident_id: uuid.UUID, db: Session = Depends(get_db)) -> Incident:
    incident = (
        db.query(Incident)
        .options(joinedload(Incident.anomaly_links), joinedload(Incident.actions))
        .filter(Incident.id == incident_id)
        .first()
    )
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    # Flatten the join-table rows into the anomaly list the schema expects.
    incident.anomalies = [link.anomaly for link in incident.anomaly_links]
    return incident
