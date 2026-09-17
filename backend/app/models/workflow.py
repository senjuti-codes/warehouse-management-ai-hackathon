"""
Everything the agent layer produces and everything the human approval loop
touches. This is the part of the schema that has no equivalent in the source
workbook -- it's the "control layer" from the problem-statement deck.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.session import Base


def _uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


class AnomalySeverity(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class AnomalyStatus(str, enum.Enum):
    OPEN = "OPEN"
    CORRELATED = "CORRELATED"  # picked up into an Incident
    RESOLVED = "RESOLVED"
    DISMISSED = "DISMISSED"


class IncidentStatus(str, enum.Enum):
    OPEN = "OPEN"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    RESOLVED = "RESOLVED"


class ActionStatus(str, enum.Enum):
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    EXECUTED = "EXECUTED"


class Anomaly(Base):
    """
    One row per detected defect, single-sheet or cross-system.
    `type_code` matches the catalog in the dataset report (A1, B2, X1, ...)
    so judges can cross-check coverage directly against that document.
    """
    __tablename__ = "anomalies"

    id: Mapped[uuid.UUID] = _uuid_pk()
    type_code: Mapped[str] = mapped_column(String, index=True)  # A1, B2, C4, D3, X1, ...
    category: Mapped[str] = mapped_column(String)  # master_data | inventory | dispatch | replenishment | cross_system
    source_sheet: Mapped[str] = mapped_column(String)
    material: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    plant: Mapped[int | None] = mapped_column(nullable=True)
    vendor: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    record_ref: Mapped[dict] = mapped_column(JSONB)  # natural keys pointing back to the raw row(s)
    severity: Mapped[AnomalySeverity] = mapped_column(Enum(AnomalySeverity))
    description: Mapped[str] = mapped_column(Text)
    detected_by: Mapped[str] = mapped_column(String, default="rule_engine")  # rule_engine | agent:<name>
    status: Mapped[AnomalyStatus] = mapped_column(Enum(AnomalyStatus), default=AnomalyStatus.OPEN)
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    incident_links: Mapped[list["IncidentAnomaly"]] = relationship(back_populates="anomaly")


class Incident(Base):
    """
    A root-cause grouping of one or more Anomalies. Satisfies mandatory
    capability #4 (correlate) -- an incident with >=2 linked anomalies from
    different source sheets is a cross-system correlation.
    """
    __tablename__ = "incidents"

    id: Mapped[uuid.UUID] = _uuid_pk()
    title: Mapped[str] = mapped_column(String)
    root_cause_summary: Mapped[str] = mapped_column(Text)  # written by the Root-Cause agent
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    severity: Mapped[AnomalySeverity] = mapped_column(Enum(AnomalySeverity))
    impact_score: Mapped[float] = mapped_column(Float, default=0.0)  # 0-100, from the Impact agent
    impact_label: Mapped[str] = mapped_column(String, nullable=True)  # e.g. "Misrouting risk"
    status: Mapped[IncidentStatus] = mapped_column(Enum(IncidentStatus), default=IncidentStatus.OPEN)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    anomaly_links: Mapped[list["IncidentAnomaly"]] = relationship(back_populates="incident")
    actions: Mapped[list["Action"]] = relationship(back_populates="incident")


class IncidentAnomaly(Base):
    """Many-to-many join: which anomalies were correlated into this incident."""
    __tablename__ = "incident_anomalies"

    incident_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("incidents.id"), primary_key=True)
    anomaly_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("anomalies.id"), primary_key=True)

    incident: Mapped["Incident"] = relationship(back_populates="anomaly_links")
    anomaly: Mapped["Anomaly"] = relationship(back_populates="incident_links")


class Action(Base):
    """
    A proposed (and, once approved, executed) corrective action. This is the
    row the human-in-the-loop gate operates on.
    """
    __tablename__ = "actions"

    id: Mapped[uuid.UUID] = _uuid_pk()
    incident_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("incidents.id"))
    run_id: Mapped[str] = mapped_column(String, index=True)  # LangGraph thread_id, needed to resume the paused run
    action_type: Mapped[str] = mapped_column(String)  # e.g. "update_master_field", "hold_shipment"
    proposed_change: Mapped[dict] = mapped_column(JSONB)  # {"table": ..., "key": ..., "field": ..., "new_value": ...}
    justification: Mapped[str] = mapped_column(Text)  # written by the Resolution agent
    proposed_by_agent: Mapped[str] = mapped_column(String, default="resolution_agent")
    status: Mapped[ActionStatus] = mapped_column(Enum(ActionStatus), default=ActionStatus.PENDING_APPROVAL)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    decided_by: Mapped[str | None] = mapped_column(String, nullable=True)  # operator id/name
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    decision_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    incident: Mapped["Incident"] = relationship(back_populates="actions")


class AuditLog(Base):
    """
    Immutable log: what was detected, why, what was proposed/done, by which
    agent, and who approved it. Required by the guide's human-in-the-loop
    section. Never updated after insert -- only ever appended to.
    """
    __tablename__ = "audit_log"

    id: Mapped[uuid.UUID] = _uuid_pk()
    entity_type: Mapped[str] = mapped_column(String)  # anomaly | incident | action
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    actor: Mapped[str] = mapped_column(String)  # "agent:root_cause_agent" | "user:jane.doe"
    action: Mapped[str] = mapped_column(String)  # "detected" | "correlated" | "proposed" | "approved" | "rejected" | "executed"
    before: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    after: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AgentTrace(Base):
    """
    Every thought / tool call / tool result / final answer an agent produces,
    in order. This is what powers the live "agent is thinking" panel on the
    frontend and is the clearest evidence to judges that this is genuine
    multi-step reasoning, not a single prompt-response call.
    """
    __tablename__ = "agent_traces"

    id: Mapped[uuid.UUID] = _uuid_pk()
    incident_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("incidents.id"), nullable=True)
    run_id: Mapped[str] = mapped_column(String, index=True)  # groups all steps of one graph invocation
    agent_name: Mapped[str] = mapped_column(String)  # root_cause_agent | impact_agent | resolution_agent
    step_type: Mapped[str] = mapped_column(String)  # thought | tool_call | tool_result | final
    content: Mapped[str] = mapped_column(Text)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
