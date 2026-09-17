#!/usr/bin/env python3
"""
End-to-end demo run from the command line: ingest -> detect -> correlate ->
impact -> resolution, for every anomaly cluster found. Useful for a live
hackathon demo without needing the frontend running yet, and for sanity
checking after any change to the detection rules or agent prompts.

Usage:
    python scripts/run_pipeline.py /path/to/workbook.xlsx
"""
import sys

from app.agents.orchestrator import run_all_pipelines
from app.detection.engine import run_detection
from app.ingestion.load_workbook import load_workbook


def main(workbook_path: str) -> None:
    print(f"Ingesting {workbook_path} ...")
    counts = load_workbook(workbook_path)
    for sheet, n in counts.items():
        print(f"  {sheet}: {n} rows")

    print("\nRunning deterministic detection ...")
    summary = run_detection()
    print(f"  {sum(summary.values())} anomalies across {len(summary)} type(s)")
    for code, count in sorted(summary.items()):
        print(f"    {code}: {count}")

    print("\nRunning agent pipelines (root cause -> impact -> resolution) ...")
    print("This calls the LLM and will pause each run at human_approval -- ")
    print("that's expected; approve/reject via the API or frontend to resume.")
    results = run_all_pipelines()
    print(f"\nStarted {len(results)} incident pipeline run(s).")
    for r in results:
        state = r["state"]
        title = state.get("title", "(untitled)")
        print(f"  - {title}  [material={r.get('material')} vendor={r.get('vendor')}]  run_id={r['run_id']}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python scripts/run_pipeline.py /path/to/workbook.xlsx")
        sys.exit(1)
    main(sys.argv[1])
