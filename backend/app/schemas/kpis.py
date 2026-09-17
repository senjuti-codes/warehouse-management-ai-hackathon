from pydantic import BaseModel


class KPISummary(BaseModel):
    """Backs the four cards on the dashboard: open incidents, critical count,
    data health %, actions awaiting approval -- matching the wireframe slide
    in the problem-statement deck."""

    open_incidents: int
    critical_incidents: int
    data_health_pct: float
    actions_awaiting_approval: int
    total_anomalies_detected: int
    total_records_ingested: int
