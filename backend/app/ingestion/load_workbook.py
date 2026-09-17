"""
Loads the six SAP-style sheets from the hackathon workbook into Postgres.

Usage:
    python -m app.ingestion.load_workbook /path/to/workbook.xlsx

This truncates and reloads the six raw tables every run, so re-running
ingestion against a modified copy of the workbook (as judges will do) always
reflects the current file -- it never mixes rows from two different runs.

Column renames below are deliberate: we normalise the workbook's
Title Case / spaced headers (e.g. "Base UoM", "Reorder Point") to the
snake_case attribute names on the ORM models. If a judge's copy renames or
reorders columns but keeps the same header text, this still works; if header
text itself changes, update the rename map, not the detection rules.
"""
import sys
from pathlib import Path

import pandas as pd
from sqlalchemy.orm import Session

from app.db.session import SessionLocal, init_db
from app.models.raw import (
    DeliveriesDispatch,
    InventoryStock,
    MaterialMaster,
    PurchaseReplenish,
    VendorMaster,
    WarehouseBin,
)

_MATERIAL_MASTER_COLS = {
    "Material": "material",
    "Description": "description",
    "Material Type": "material_type",
    "Material Group": "material_group",
    "Base UoM": "base_uom",
    "Plant": "plant",
    "Reorder Point": "reorder_point",
    "Safety Stock": "safety_stock",
    "Lead Time (days)": "lead_time_days",
    "ABC Class": "abc_class",
    "Hazmat Flag": "hazmat_flag",
    "Lifecycle Status": "lifecycle_status",
}

_INVENTORY_STOCK_COLS = {
    "Material": "material",
    "Plant": "plant",
    "Storage Location": "storage_location",
    "Batch": "batch",
    "UoM": "uom",
    "Qty On Hand": "qty_on_hand",
    "Blocked Qty": "blocked_qty",
    "In-Transit Qty": "in_transit_qty",
    "Batch Expiry": "batch_expiry",
    "Last Movement Date": "last_movement_date",
}

_WAREHOUSE_BIN_COLS = {
    "Bin": "bin",
    "Storage Type": "storage_type",
    "Assigned Material": "assigned_material",
    "Capacity": "capacity",
    "Occupied": "occupied",
    "Bin Status": "bin_status",
    "Plant": "plant",
}

_DELIVERIES_DISPATCH_COLS = {
    "Delivery": "delivery",
    "Material": "material",
    "Plant": "plant",
    "Order Qty": "order_qty",
    "Ship-To": "ship_to",
    "Route": "route",
    "Created Date": "created_date",
    "Planned GI Date": "planned_gi_date",
    "Status": "status",
}

_PURCHASE_REPLENISH_COLS = {
    "Purchase Order": "purchase_order",
    "Material": "material",
    "Vendor": "vendor",
    "Plant": "plant",
    "PO Qty": "po_qty",
    "Unit Price": "unit_price",
    "Currency": "currency",
    "Order Date": "order_date",
    "Expected Delivery": "expected_delivery",
    "PO Status": "po_status",
}

_VENDOR_MASTER_COLS = {
    "Vendor": "vendor",
    "Vendor Name": "vendor_name",
    "Country": "country",
    "Quality Rating": "quality_rating",
    "On-Time Delivery %": "on_time_delivery_pct",
    "Procurement Block": "procurement_block",
}

_DATE_COLS = {"batch_expiry", "last_movement_date", "created_date", "planned_gi_date", "order_date", "expected_delivery"}

_SHEET_MAP = [
    ("Material_Master", _MATERIAL_MASTER_COLS, MaterialMaster),
    ("Inventory_Stock", _INVENTORY_STOCK_COLS, InventoryStock),
    ("Warehouse_Bin", _WAREHOUSE_BIN_COLS, WarehouseBin),
    ("Deliveries_Dispatch", _DELIVERIES_DISPATCH_COLS, DeliveriesDispatch),
    ("Purchase_Replenish", _PURCHASE_REPLENISH_COLS, PurchaseReplenish),
    ("Vendor_Master", _VENDOR_MASTER_COLS, VendorMaster),
]


def _load_sheet(xls: pd.ExcelFile, sheet_name: str, col_map: dict[str, str]) -> tuple[int, list[dict]]:
    df = pd.read_excel(xls, sheet_name=sheet_name)
    missing = set(col_map) - set(df.columns)
    if missing:
        raise ValueError(
            f"Sheet '{sheet_name}' is missing expected column(s): {sorted(missing)}. "
            "If the workbook's headers changed, update the column map in "
            "app/ingestion/load_workbook.py -- do not change detection rules to compensate."
        )
    df = df[list(col_map)].rename(columns=col_map)

    for col in _DATE_COLS & set(df.columns):
        df[col] = pd.to_datetime(df[col], errors="coerce").dt.date

    # NaN -> None so SQLAlchemy writes SQL NULL instead of the float 'nan'
    df = df.where(pd.notnull(df), None)

    records = df.to_dict(orient="records")
    return len(records), records


def load_workbook(path: str | Path) -> dict[str, int]:
    """Truncates the six raw tables and reloads them from `path`. Returns a
    dict of sheet name -> row count for a quick sanity check / API response."""
    xls = pd.ExcelFile(path)
    init_db()

    counts: dict[str, int] = {}
    db: Session = SessionLocal()
    try:
        for sheet_name, col_map, model in _SHEET_MAP:
            n, records = _load_sheet(xls, sheet_name, col_map)
            db.query(model).delete()
            if records:
                db.bulk_insert_mappings(model, records)
            counts[sheet_name] = n
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    return counts


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python -m app.ingestion.load_workbook /path/to/workbook.xlsx")
        sys.exit(1)
    result = load_workbook(sys.argv[1])
    print("Ingested:")
    for sheet, n in result.items():
        print(f"  {sheet}: {n} rows")
