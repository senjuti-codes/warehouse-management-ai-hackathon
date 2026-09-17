import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.workflow import Action, ActionStatus
from app.schemas.actions import ActionDecisionRequest, ActionOut

router = APIRouter(prefix="/actions", tags=["actions"])


@router.get("", response_model=list[ActionOut])
def list_actions(status: str | None = None, db: Session = Depends(get_db)) -> list[Action]:
    query = db.query(Action)
    if status:
        query = query.filter(Action.status == status.upper())
    return query.order_by(Action.created_at.desc()).all()


def _resume(action_id: uuid.UUID, decision: str, body: ActionDecisionRequest, db: Session) -> Action:
    action = db.query(Action).filter(Action.id == action_id).first()
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    if action.status != ActionStatus.PENDING_APPROVAL:
        raise HTTPException(status_code=409, detail=f"Action is already {action.status.value}, not pending")

    from app.agents.graph import resume_pipeline  # local import: avoids circular import at module load

    resume_pipeline(run_id=action.run_id, decision=decision, decided_by=body.decided_by, reason=body.reason)

    db.refresh(action)
    return action


@router.post("/{action_id}/approve", response_model=ActionOut)
def approve_action(action_id: uuid.UUID, body: ActionDecisionRequest, db: Session = Depends(get_db)) -> Action:
    """The one-click approval the whole human-in-the-loop requirement hinges
    on. Resumes the graph that paused at human_approval_node; the
    apply_action node then marks this row EXECUTED and writes the audit
    trail synchronously, so the response already reflects the final state."""
    return _resume(action_id, "approved", body, db)


@router.post("/{action_id}/reject", response_model=ActionOut)
def reject_action(action_id: uuid.UUID, body: ActionDecisionRequest, db: Session = Depends(get_db)) -> Action:
    return _resume(action_id, "rejected", body, db)
