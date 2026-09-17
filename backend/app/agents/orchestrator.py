"""
Turns the flat list of OPEN anomalies from the rule engine into incident
pipeline runs. Clustering is deliberately mechanical (group by shared
Material, or Vendor when there's no Material) -- that's what guarantees at
least one incident spans multiple source sheets, satisfying the "correlate
across systems" requirement structurally. The agent's reasoning work is
explaining *why* they're related and what to do about it, not the grouping
itself.
"""
from app.db.session import SessionLocal
from app.models.workflow import Anomaly, AnomalyStatus


def find_candidate_clusters() -> list[dict]:
    """Returns a list of {"material": ..., "vendor": ..., "anomaly_ids": [...]}
    clusters, one per distinct Material (or Vendor, for vendor-only
    anomalies like F1) with at least one OPEN anomaly."""
    db = SessionLocal()
    try:
        open_anomalies = db.query(Anomaly).filter(Anomaly.status == AnomalyStatus.OPEN).all()
        clusters: dict[tuple[str, str | None, str | None], list[str]] = {}
        for a in open_anomalies:
            key = ("material", a.material, None) if a.material else ("vendor", None, a.vendor)
            clusters.setdefault(key, []).append(str(a.id))

        return [
            {"material": material, "vendor": vendor, "anomaly_ids": ids}
            for (_, material, vendor), ids in clusters.items()
        ]
    finally:
        db.close()


def run_all_pipelines() -> list[dict]:
    """Runs the incident pipeline once per cluster. Intended to be called as
    a FastAPI BackgroundTask after ingestion + detection, or from
    scripts/run_pipeline.py for a CLI demo run."""
    from app.agents.graph import start_pipeline  # local import: avoids circular import at module load

    results = []
    for cluster in find_candidate_clusters():
        result = start_pipeline(
            seed_anomaly_ids=cluster["anomaly_ids"],
            material=cluster["material"],
            vendor=cluster["vendor"],
        )
        results.append({**cluster, **result})
    return results
