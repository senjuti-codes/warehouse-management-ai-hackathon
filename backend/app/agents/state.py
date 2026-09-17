from typing import TypedDict


class PipelineState(TypedDict, total=False):
    """State threaded through the incident graph (app/agents/graph.py).
    `total=False` because most fields are only populated partway through --
    e.g. impact_score doesn't exist until the impact node has run."""

    run_id: str
    seed_anomaly_ids: list[str]         # anomaly IDs that triggered this run
    material: str | None
    vendor: str | None

    incident_id: str | None
    title: str | None
    root_cause_summary: str | None
    confidence: float | None
    linked_anomaly_ids: list[str]

    impact_score: float | None
    impact_label: str | None

    action_id: str | None
    action_type: str | None
    proposed_change: dict | None
    justification: str | None

    approval_decision: str | None       # "approved" | "rejected"
    decided_by: str | None
    decision_reason: str | None
