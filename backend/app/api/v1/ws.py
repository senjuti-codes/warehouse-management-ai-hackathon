"""
Live "agent is thinking" trace stream. Implemented as simple short-interval
polling of the agent_traces table rather than a real pub/sub broker -- for a
single-process hackathon demo this is more than fast enough (traces appear
within ~500ms) and needs zero extra infrastructure. If this grows past a
demo, swap the polling loop for a Postgres LISTEN/NOTIFY trigger on
agent_traces or an in-memory asyncio broadcast queue.
"""
import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.db.session import SessionLocal
from app.models.workflow import AgentTrace

router = APIRouter()

POLL_INTERVAL_SECONDS = 0.5


@router.websocket("/ws/agent-trace")
async def agent_trace_stream(websocket: WebSocket) -> None:
    """Optional query param `run_id` filters to one pipeline run; omit it to
    stream every agent step across all runs (handy for a demo "war room"
    view)."""
    await websocket.accept()
    run_id_filter = websocket.query_params.get("run_id")
    last_seen_timestamp = None

    try:
        while True:
            db = SessionLocal()
            try:
                query = db.query(AgentTrace).order_by(AgentTrace.timestamp.asc())
                if run_id_filter:
                    query = query.filter(AgentTrace.run_id == run_id_filter)
                if last_seen_timestamp:
                    query = query.filter(AgentTrace.timestamp > last_seen_timestamp)
                new_rows = query.limit(200).all()
            finally:
                db.close()

            for row in new_rows:
                await websocket.send_text(json.dumps({
                    "run_id": row.run_id,
                    "incident_id": str(row.incident_id) if row.incident_id else None,
                    "agent_name": row.agent_name,
                    "step_type": row.step_type,
                    "content": row.content,
                    "timestamp": row.timestamp.isoformat(),
                }))
                last_seen_timestamp = row.timestamp

            await asyncio.sleep(POLL_INTERVAL_SECONDS)
    except WebSocketDisconnect:
        pass
