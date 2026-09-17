"""
The core agentic pipeline. One graph run = one incident candidate (a cluster
of anomalies sharing a Material or Vendor -- see app/agents/orchestrator.py
for how clusters are formed).

Flow: root_cause -> impact -> resolution -> human_approval (PAUSES here via
LangGraph's interrupt()) -> apply_action -> END.

IMPORTANT -- checkpointer: this uses LangGraph's in-memory MemorySaver, which
only survives for the lifetime of one Python process. That's fine for a
single-process hackathon demo (`uvicorn ... --workers 1`), but it means a
paused (interrupted) run is lost if the process restarts, and it will NOT
work if you scale to multiple uvicorn workers, since the worker that resumes
a run may not be the one that paused it. Before deploying beyond a single
demo process, swap MemorySaver for a persistent checkpointer, e.g.
`langgraph-checkpoint-postgres`, pointed at the same Postgres instance.
"""
import json
import uuid
from datetime import datetime

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt

from app.agents.outputs import ImpactFinding, ResolutionFinding, RootCauseFinding
from app.agents.prompts import IMPACT_SYSTEM_PROMPT, RESOLUTION_SYSTEM_PROMPT, ROOT_CAUSE_SYSTEM_PROMPT
from app.agents.state import PipelineState
from app.agents.tools import ALL_TOOLS
from app.agents.trace import log_trace
from app.db.session import SessionLocal
from app.llm.client import get_chat_model
from app.models.workflow import (
    Action,
    ActionStatus,
    Anomaly,
    AnomalyStatus,
    AuditLog,
    Incident,
    IncidentAnomaly,
    IncidentStatus,
)

MAX_TOOL_ITERATIONS = 6
TOOLS_BY_NAME = {t.name: t for t in ALL_TOOLS}


def _run_react_loop(run_id: str, agent_name: str, system_prompt: str, seed_context: str) -> list:
    """Shared ReAct loop: model decides which tools to call, we execute them
    and feed results back, until it stops calling tools or we hit the
    iteration cap. Returns the full message transcript so the caller can do
    a final structured-output extraction over it."""
    llm = get_chat_model().bind_tools(ALL_TOOLS)
    messages: list = [SystemMessage(content=system_prompt), HumanMessage(content=seed_context)]

    db = SessionLocal()
    try:
        log_trace(db, run_id, agent_name, "thought", f"Starting investigation.\n\n{seed_context}")

        for _ in range(MAX_TOOL_ITERATIONS):
            response: AIMessage = llm.invoke(messages)
            messages.append(response)

            if not response.tool_calls:
                log_trace(db, run_id, agent_name, "thought", response.content or "(no further tool calls)")
                break

            for call in response.tool_calls:
                log_trace(db, run_id, agent_name, "tool_call", f"{call['name']}({call['args']})")
                tool_fn = TOOLS_BY_NAME.get(call["name"])
                try:
                    result = tool_fn.invoke(call["args"]) if tool_fn else {"error": f"unknown tool {call['name']}"}
                except Exception as exc:  # tool failures shouldn't crash the run
                    result = {"error": str(exc)}
                result_str = json.dumps(result, default=str)
                log_trace(db, run_id, agent_name, "tool_result", result_str[:2000])
                messages.append(ToolMessage(content=result_str, tool_call_id=call["id"]))
        return messages
    finally:
        db.close()


def root_cause_node(state: PipelineState) -> dict:
    run_id = state["run_id"]
    seed_context = (
        f"Seed anomaly IDs: {state['seed_anomaly_ids']}\n"
        f"Material: {state.get('material')}\nVendor: {state.get('vendor')}\n\n"
        "Investigate these using your tools and determine the root cause."
    )
    transcript = _run_react_loop(run_id, "root_cause_agent", ROOT_CAUSE_SYSTEM_PROMPT, seed_context)

    structured_llm = get_chat_model().with_structured_output(RootCauseFinding)
    finding: RootCauseFinding = structured_llm.invoke(
        transcript + [HumanMessage(content="Based on the investigation above, give your final structured finding.")]
    )

    db = SessionLocal()
    try:
        log_trace(db, run_id, "root_cause_agent", "final", finding.model_dump_json())

        incident = Incident(
            title=finding.title,
            root_cause_summary=finding.root_cause_summary,
            confidence=finding.confidence,
            severity="MEDIUM",  # placeholder, refined by the impact node
            status=IncidentStatus.OPEN,
        )
        db.add(incident)
        db.flush()

        anomalies = db.query(Anomaly).filter(Anomaly.id.in_(state["seed_anomaly_ids"])).all()
        for a in anomalies:
            db.add(IncidentAnomaly(incident_id=incident.id, anomaly_id=a.id))
            a.status = AnomalyStatus.CORRELATED
        db.add(AuditLog(
            entity_type="incident", entity_id=incident.id, actor="agent:root_cause_agent",
            action="correlated", after={"linked_anomalies": [str(a.id) for a in anomalies]},
            notes=finding.root_cause_summary,
        ))
        db.commit()
        incident_id = str(incident.id)
    finally:
        db.close()

    return {
        "incident_id": incident_id,
        "title": finding.title,
        "root_cause_summary": finding.root_cause_summary,
        "confidence": finding.confidence,
        "linked_anomaly_ids": state["seed_anomaly_ids"],
    }


def impact_node(state: PipelineState) -> dict:
    run_id = state["run_id"]
    context = (
        f"Incident: {state['title']}\nRoot cause: {state['root_cause_summary']}\n"
        f"Confidence: {state['confidence']}\nLinked anomaly count: {len(state['linked_anomaly_ids'])}"
    )
    db = SessionLocal()
    try:
        log_trace(db, run_id, "impact_agent", "thought", context, incident_id=state["incident_id"])
        anomalies = db.query(Anomaly).filter(Anomaly.id.in_(state["seed_anomaly_ids"])).all()
        severities = [a.severity for a in anomalies]
    finally:
        db.close()

    structured_llm = get_chat_model().with_structured_output(ImpactFinding)
    finding: ImpactFinding = structured_llm.invoke([
        SystemMessage(content=IMPACT_SYSTEM_PROMPT),
        HumanMessage(content=context + f"\nLinked anomaly severities: {severities}"),
    ])

    db = SessionLocal()
    try:
        log_trace(db, run_id, "impact_agent", "final", finding.model_dump_json(), incident_id=state["incident_id"])
        incident = db.query(Incident).filter(Incident.id == state["incident_id"]).first()
        incident.impact_score = finding.impact_score
        incident.impact_label = finding.impact_label
        # Roof the incident's own severity to the worst linked anomaly severity.
        order = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
        worst = max((s for s in severities), key=lambda s: order.index(s), default="MEDIUM")
        incident.severity = worst
        db.commit()
    finally:
        db.close()

    return {"impact_score": finding.impact_score, "impact_label": finding.impact_label}


def resolution_node(state: PipelineState) -> dict:
    run_id = state["run_id"]
    context = (
        f"Incident: {state['title']}\nRoot cause: {state['root_cause_summary']}\n"
        f"Impact: {state['impact_score']}/100 ({state['impact_label']})"
    )
    db = SessionLocal()
    try:
        log_trace(db, run_id, "resolution_agent", "thought", context, incident_id=state["incident_id"])
    finally:
        db.close()

    structured_llm = get_chat_model().with_structured_output(ResolutionFinding)
    finding: ResolutionFinding = structured_llm.invoke([
        SystemMessage(content=RESOLUTION_SYSTEM_PROMPT),
        HumanMessage(content=context),
    ])

    db = SessionLocal()
    try:
        log_trace(db, run_id, "resolution_agent", "final", finding.model_dump_json(), incident_id=state["incident_id"])
        action = Action(
            incident_id=state["incident_id"],
            run_id=run_id,
            action_type=finding.action_type,
            proposed_change=finding.proposed_change,
            justification=finding.justification,
            proposed_by_agent="resolution_agent",
            status=ActionStatus.PENDING_APPROVAL,
        )
        db.add(action)
        db.flush()
        incident = db.query(Incident).filter(Incident.id == state["incident_id"]).first()
        incident.status = IncidentStatus.PENDING_APPROVAL
        db.add(AuditLog(
            entity_type="action", entity_id=action.id, actor="agent:resolution_agent",
            action="proposed", after=finding.proposed_change, notes=finding.justification,
        ))
        db.commit()
        action_id = str(action.id)
    finally:
        db.close()

    return {
        "action_id": action_id,
        "action_type": finding.action_type,
        "proposed_change": finding.proposed_change,
        "justification": finding.justification,
    }


def human_approval_node(state: PipelineState) -> dict:
    """Pauses the graph here. Resumed by app/api/v1/actions.py when the
    operator clicks Approve/Reject, via Command(resume={...})."""
    decision = interrupt({
        "incident_id": state["incident_id"],
        "action_id": state["action_id"],
        "action_type": state["action_type"],
        "proposed_change": state["proposed_change"],
        "justification": state["justification"],
    })
    return {
        "approval_decision": decision["decision"],
        "decided_by": decision["decided_by"],
        "decision_reason": decision.get("reason"),
    }


def apply_action_node(state: PipelineState) -> dict:
    run_id = state["run_id"]
    approved = state["approval_decision"] == "approved"

    db = SessionLocal()
    try:
        action = db.query(Action).filter(Action.id == state["action_id"]).first()
        incident = db.query(Incident).filter(Incident.id == state["incident_id"]).first()

        action.status = ActionStatus.EXECUTED if approved else ActionStatus.REJECTED
        action.decided_by = state["decided_by"]
        action.decided_at = datetime.utcnow()
        action.decision_reason = state.get("decision_reason")
        incident.status = IncidentStatus.RESOLVED if approved else IncidentStatus.REJECTED

        db.add(AuditLog(
            entity_type="action", entity_id=action.id, actor=f"user:{state['decided_by']}",
            action="approved" if approved else "rejected",
            before={"status": "PENDING_APPROVAL"},
            after={"status": action.status.value, "reason": state.get("decision_reason")},
        ))
        if approved:
            db.add(AuditLog(
                entity_type="action", entity_id=action.id, actor="agent:resolution_agent",
                action="executed", after=action.proposed_change,
                notes="Simulated write-back -- no live SAP/WMS connection in this environment.",
            ))
        db.commit()
        log_trace(
            db, run_id, "orchestrator", "final",
            f"Action {'executed' if approved else 'rejected'} by {state['decided_by']}.",
            incident_id=state["incident_id"],
        )
    finally:
        db.close()

    return {}


def build_graph():
    builder = StateGraph(PipelineState)
    builder.add_node("root_cause", root_cause_node)
    builder.add_node("impact", impact_node)
    builder.add_node("resolution", resolution_node)
    builder.add_node("human_approval", human_approval_node)
    builder.add_node("apply_action", apply_action_node)

    builder.add_edge(START, "root_cause")
    builder.add_edge("root_cause", "impact")
    builder.add_edge("impact", "resolution")
    builder.add_edge("resolution", "human_approval")
    builder.add_edge("human_approval", "apply_action")
    builder.add_edge("apply_action", END)

    return builder.compile(checkpointer=MemorySaver())


# One compiled graph, reused across runs; MemorySaver keeps per-thread state
# keyed by the `thread_id` passed in each call's config.
_GRAPH = build_graph()


def start_pipeline(seed_anomaly_ids: list[str], material: str | None, vendor: str | None) -> dict:
    """Kicks off a new incident pipeline run. Returns immediately once the
    graph pauses at human_approval (or completes, if something upstream
    fails before reaching it)."""
    run_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": run_id}}
    initial_state: PipelineState = {
        "run_id": run_id,
        "seed_anomaly_ids": seed_anomaly_ids,
        "material": material,
        "vendor": vendor,
    }
    result = _GRAPH.invoke(initial_state, config=config)
    return {"run_id": run_id, "state": result}


def resume_pipeline(run_id: str, decision: str, decided_by: str, reason: str | None = None) -> dict:
    """Resumes a paused run after an operator approves/rejects. `run_id`
    must be the thread_id returned by start_pipeline (stored alongside the
    Action row -- see app/api/v1/actions.py)."""
    config = {"configurable": {"thread_id": run_id}}
    result = _GRAPH.invoke(
        Command(resume={"decision": decision, "decided_by": decided_by, "reason": reason}),
        config=config,
    )
    return {"run_id": run_id, "state": result}
