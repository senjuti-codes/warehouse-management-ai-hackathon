"""
Tools the agent layer can call. This is what makes the Root-Cause agent
*agentic* rather than a single prompt: given an anomaly, it decides which of
these to call, in what order, based on what it finds -- not a fixed script.

Every tool opens and closes its own short-lived DB session so these can be
handed straight to LangChain's `bind_tools()` / LangGraph's `ToolNode`
without needing request-scoped session plumbing.
"""
import difflib

from langchain_core.tools import tool

from app.db.session import SessionLocal
from app.models.raw import (
    DeliveriesDispatch,
    InventoryStock,
    MaterialMaster,
    PurchaseReplenish,
    VendorMaster,
    WarehouseBin,
)
from app.models.workflow import Anomaly, AnomalyStatus


def _row_to_dict(row) -> dict:
    return {c.name: getattr(row, c.name) for c in row.__table__.columns}


@tool
def get_material_master(material: str) -> dict | list:
    """Look up the Material_Master record(s) for a given material number.
    Returns lifecycle status, hazmat flag, reorder/safety stock, UoM, etc.
    Use this first when investigating any anomaly tied to a Material."""
    db = SessionLocal()
    try:
        rows = db.query(MaterialMaster).filter(MaterialMaster.material == material).all()
        if not rows:
            return {"found": False, "material": material}
        return [_row_to_dict(r) for r in rows]
    finally:
        db.close()


@tool
def get_inventory_for_material(material: str) -> list[dict]:
    """Get every Inventory_Stock row (by plant, storage location, batch) for
    a material. Use this to check on-hand/blocked quantity, expiry, and last
    movement date when investigating a stock-related anomaly."""
    db = SessionLocal()
    try:
        rows = db.query(InventoryStock).filter(InventoryStock.material == material).all()
        return [_row_to_dict(r) for r in rows]
    finally:
        db.close()


@tool
def get_bin_for_material(material: str) -> list[dict]:
    """Get every Warehouse_Bin row a material is assigned to, including
    storage type, capacity, and occupancy. Use this to check for
    hazmat/storage-type mismatches or over-allocation."""
    db = SessionLocal()
    try:
        rows = db.query(WarehouseBin).filter(WarehouseBin.assigned_material == material).all()
        return [_row_to_dict(r) for r in rows]
    finally:
        db.close()


@tool
def get_deliveries_for_material(material: str) -> list[dict]:
    """Get every outbound Deliveries_Dispatch line for a material: route,
    quantity, status, planned goods-issue date. Use this to check dispatch
    delays, missing routes, or dispatch quantity vs. available stock."""
    db = SessionLocal()
    try:
        rows = db.query(DeliveriesDispatch).filter(DeliveriesDispatch.material == material).all()
        return [_row_to_dict(r) for r in rows]
    finally:
        db.close()


@tool
def get_purchase_orders_for_material(material: str) -> list[dict]:
    """Get every Purchase_Replenish (PO) line for a material: vendor,
    quantity, price, expected delivery, PO status. Use this to check
    replenishment failures or vendor-related risk."""
    db = SessionLocal()
    try:
        rows = db.query(PurchaseReplenish).filter(PurchaseReplenish.material == material).all()
        return [_row_to_dict(r) for r in rows]
    finally:
        db.close()


@tool
def get_vendor(vendor: str) -> dict:
    """Look up a Vendor_Master record: country, quality rating, on-time
    delivery %, and procurement block status. Use this when a PO-related
    anomaly might trace back to the supplier rather than the material."""
    db = SessionLocal()
    try:
        row = db.query(VendorMaster).filter(VendorMaster.vendor == vendor).first()
        return _row_to_dict(row) if row else {"found": False, "vendor": vendor}
    finally:
        db.close()


@tool
def get_open_anomalies_for_material(material: str) -> list[dict]:
    """Get every other OPEN anomaly already detected for this material
    across any sheet. This is the primary correlation tool: call it to find
    out whether a master-data issue, a stock issue, and a dispatch issue are
    all pointing at the same material before writing a root-cause narrative."""
    db = SessionLocal()
    try:
        rows = (
            db.query(Anomaly)
            .filter(Anomaly.material == material, Anomaly.status == AnomalyStatus.OPEN)
            .all()
        )
        return [
            {
                "id": str(r.id), "type_code": r.type_code, "category": r.category,
                "source_sheet": r.source_sheet, "severity": r.severity, "description": r.description,
            }
            for r in rows
        ]
    finally:
        db.close()


@tool
def find_similar_material_descriptions(description: str, exclude_material: str | None = None, top_k: int = 5) -> list[dict]:
    """Find materials whose description is textually similar to the given
    one, even if not an exact match (catches near-duplicate materials that
    exact-match detection misses -- e.g. typos or reordered words).

    NOTE: this currently uses fuzzy string matching (difflib) as a
    dependency-free placeholder. Once the LLMaaS embeddings endpoint spec is
    confirmed, swap the body of this function to embed `description` via
    app.llm.client.get_embeddings_model() and rank Material_Master rows by
    cosine similarity against their pre-computed embeddings (store those in
    a pgvector column on MaterialMaster) -- the tool's name, signature, and
    return shape can stay identical, so no agent prompt needs to change.
    """
    db = SessionLocal()
    try:
        rows = db.query(MaterialMaster).all()
        scored = []
        for r in rows:
            if exclude_material and r.material == exclude_material:
                continue
            if not r.description:
                continue
            ratio = difflib.SequenceMatcher(None, description.lower(), r.description.lower()).ratio()
            scored.append((ratio, r))
        scored.sort(key=lambda t: t[0], reverse=True)
        return [
            {"material": r.material, "description": r.description, "plant": r.plant, "similarity": round(ratio, 3)}
            for ratio, r in scored[:top_k]
            if ratio > 0.5
        ]
    finally:
        db.close()


ALL_TOOLS = [
    get_material_master,
    get_inventory_for_material,
    get_bin_for_material,
    get_deliveries_for_material,
    get_purchase_orders_for_material,
    get_vendor,
    get_open_anomalies_for_material,
    find_similar_material_descriptions,
]
