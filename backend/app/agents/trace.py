from sqlalchemy.orm import Session

from app.models.workflow import AgentTrace


def log_trace(
    db: Session, run_id: str, agent_name: str, step_type: str, content: str, incident_id: str | None = None
) -> None:
    """Persists one reasoning step. step_type is one of:
    thought | tool_call | tool_result | final
    This is what the frontend's live trace panel reads (via GET /incidents/{id}
    or the WS trace stream) to show judges the agent is genuinely reasoning
    step by step, not returning a single canned response."""
    db.add(AgentTrace(
        run_id=run_id,
        incident_id=incident_id,
        agent_name=agent_name,
        step_type=step_type,
        content=content,
    ))
    db.commit()
