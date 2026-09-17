import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, UploadFile

router = APIRouter(prefix="/ingest", tags=["ingest"])


def _run_full_pipeline(workbook_path: str) -> None:
    """Runs end-to-end: ingest -> detect -> correlate/impact/resolve for
    every anomaly cluster. Called as a background task so the HTTP request
    returns immediately -- a full pass involves several LLM calls per
    cluster and would otherwise time out the request."""
    from app.agents.orchestrator import run_all_pipelines
    from app.detection.engine import run_detection
    from app.ingestion.load_workbook import load_workbook

    load_workbook(workbook_path)
    run_detection()
    run_all_pipelines()


@router.post("/run")
def trigger_ingest(background_tasks: BackgroundTasks, file: UploadFile | None = None) -> dict:
    """
    If a file is uploaded, it's saved and used for this run. Otherwise this
    re-runs the pipeline against whatever workbook is already at
    DATA_DIR/workbook.xlsx (see docker-compose.yml's volume mount) -- useful
    for judges who just want to re-trigger detection without re-uploading.
    """
    data_dir = Path("data")
    data_dir.mkdir(exist_ok=True)
    target_path = data_dir / "workbook.xlsx"

    if file is not None:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name
        shutil.move(tmp_path, target_path)

    if not target_path.exists():
        return {"status": "error", "detail": "No workbook uploaded yet and none found at data/workbook.xlsx"}

    background_tasks.add_task(_run_full_pipeline, str(target_path))
    return {"status": "accepted", "detail": "Ingestion, detection, and agent correlation started in the background."}
