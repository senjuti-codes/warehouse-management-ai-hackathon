"""Structured shapes each agent must fill in once its tool-calling
investigation is done. Kept separate from app/schemas (the API layer) since
these are internal to the agent graph, not exposed directly over HTTP."""
from pydantic import BaseModel, Field


class RootCauseFinding(BaseModel):
    title: str = Field(description="Short incident title, under 12 words")
    root_cause_summary: str = Field(description="2-4 sentence plain-language explanation citing specific records")
    confidence: float = Field(ge=0.0, le=1.0)
    related_materials: list[str] = Field(
        default_factory=list,
        description="Any additional material numbers found to be related during investigation, beyond the seed anomalies",
    )


class ImpactFinding(BaseModel):
    impact_score: float = Field(ge=0.0, le=100.0)
    impact_label: str = Field(description="Short operator-facing label, e.g. 'Misrouting risk'")
    rationale: str = Field(description="One sentence explaining the score")


class ResolutionFinding(BaseModel):
    action_type: str = Field(description="Machine-readable action type, e.g. 'update_master_field', 'hold_shipment'")
    proposed_change: dict = Field(description="What would change: table/key/field/new_value, or an operational step")
    justification: str = Field(description="1-2 sentences a supervisor would read before approving")
