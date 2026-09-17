"""
Orchestrates the deterministic detection layer: pulls the six raw tables
into pandas, runs every rule in app/detection/rules.py and
app/detection/cross_system.py, and persists the results as `Anomaly` rows.

Re-running this (e.g. after a fresh ingestion) is idempotent: it clears out
anomalies the rule engine previously found that are still OPEN (i.e. not yet
picked up into an incident) and replaces them with a fresh detection pass,
so running detection twice on the same data never duplicates rows.
"""
import math
from datetime import datetime

import pandas as pd
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.session import SessionLocal
from app.detection import cross_system, rules
from app.models.raw import (
    DeliveriesDispatch,
    InventoryStock,
    MaterialMaster,
    PurchaseReplenish,
    VendorMaster,
    WarehouseBin,
)
from app.models.workflow import Anomaly, AnomalyStatus, AuditLog

settings = get_settings()

_TABLE_MODELS = {
    "material_master": MaterialMaster,
    "inventory_stock": InventoryStock,
    "warehouse_bin": WarehouseBin,
    "deliveries_dispatch": DeliveriesDispatch,
    "purchase_replenish": PurchaseReplenish,
    "vendor_master": VendorMaster,
}


def _sanitize_json(obj):
    """Postgres's JSON/JSONB type rejects the literal NaN token, but pandas
    silently turns SQL NULLs in a float column into NaN when building a
    DataFrame (there's no nullable-float representation in numpy). Every
    record_ref that passes through a numeric pandas column can carry one,
    so we recursively swap NaN -> None right before persisting rather than
    trying to catch it at each of the twenty-plus call sites in rules.py."""
    if isinstance(obj, dict):
        return {k: _sanitize_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize_json(v) for v in obj]
    if isinstance(obj, float) and math.isnan(obj):
        return None
    return obj


def _load_tables(db: Session) -> dict[str, pd.DataFrame]:
    tables: dict[str, pd.DataFrame] = {}
    for name, model in _TABLE_MODELS.items():
        rows = db.query(model).all()
        records = [
            {c.name: getattr(row, c.name) for c in model.__table__.columns}
            for row in rows
        ]
        tables[name] = pd.DataFrame.from_records(records) if records else pd.DataFrame(
            columns=[c.name for c in model.__table__.columns]
        )
    return tables


def run_detection() -> dict[str, int]:
    """Runs the full deterministic detection pass and persists results.
    Returns a summary count per type_code for a quick sanity check."""
    snapshot_date = datetime.strptime(settings.dataset_snapshot_date, "%Y-%m-%d").date()

    db = SessionLocal()
    try:
        tables = _load_tables(db)

        found = rules.run_all(tables, snapshot_date) + cross_system.run_all(tables, snapshot_date)

        # Idempotent re-run: drop previously rule-detected anomalies that
        # were never correlated/resolved, then insert the fresh pass.
        db.query(Anomaly).filter(
            Anomaly.detected_by == "rule_engine",
            Anomaly.status == AnomalyStatus.OPEN,
        ).delete(synchronize_session=False)

        summary: dict[str, int] = {}
        for item in found:
            record_ref = _sanitize_json(item["record_ref"])
            anomaly = Anomaly(
                type_code=item["type_code"],
                category=item["category"],
                source_sheet=item["source_sheet"],
                material=item.get("material"),
                plant=item.get("plant"),
                vendor=item.get("vendor"),
                record_ref=record_ref,
                severity=item["severity"],
                description=item["description"],
                detected_by="rule_engine",
                status=AnomalyStatus.OPEN,
            )
            db.add(anomaly)
            db.flush()  # populate anomaly.id for the audit log entry
            db.add(AuditLog(
                entity_type="anomaly",
                entity_id=anomaly.id,
                actor="agent:rule_engine",
                action="detected",
                after=record_ref,
                notes=item["description"],
            ))
            summary[item["type_code"]] = summary.get(item["type_code"], 0) + 1

        db.commit()
        return summary
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    result = run_detection()
    total = sum(result.values())
    print(f"Detected {total} anomalies across {len(result)} type(s):")
    for code, count in sorted(result.items()):
        print(f"  {code}: {count}")
