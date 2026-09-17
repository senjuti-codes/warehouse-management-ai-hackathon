"""
Deterministic, single-sheet checks -- the A/B/C/D/E/F series from the
dataset report's anomaly catalog. These are plain pandas/vectorised checks
on purpose: they're cheap, 100% reproducible, and don't need an LLM to get
right. The agent layer (app/agents/) spends its reasoning budget on the
harder cross-system X-series instead (see app/detection/cross_system.py).

Every function takes the raw DataFrame(s) it needs and a `snapshot_date`
(never datetime.now() -- see app.config.dataset_snapshot_date) and returns a
list of plain dicts shaped like the Anomaly model's constructor kwargs
(minus id/detected_at/status, which the engine fills in). Nothing here talks
to the database directly -- that keeps these functions trivially unit
testable against a plain DataFrame fixture.
"""
from datetime import date, timedelta

import pandas as pd

STALE_STOCK_DAYS = 365

Anomaly = dict  # readability alias; see docstring for shape


def _rec(material=None, plant=None, vendor=None, **ref) -> dict:
    """Small helper: builds the record_ref payload consistently."""
    return {"material": material, "plant": plant, "vendor": vendor, **ref}


def _fmt(value) -> str:
    """Renders a possibly-NaN/None numeric value for a human-readable
    description string (the JSON persistence layer handles NaN separately --
    see app/detection/engine.py's _sanitize_json)."""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return "missing"
    return str(value)


# --------------------------------------------------------------------------
# A-series: Material_Master (master-data quality)
# --------------------------------------------------------------------------

def detect_a1_missing_uom(material_master: pd.DataFrame) -> list[Anomaly]:
    mask = material_master["base_uom"].isna() | (material_master["base_uom"] == "")
    return [
        {
            "type_code": "A1",
            "category": "master_data",
            "source_sheet": "Material_Master",
            "material": r.material,
            "plant": int(r.plant),
            "vendor": None,
            "record_ref": _rec(r.material, int(r.plant)),
            "severity": "HIGH",
            "description": f"{r.material} at plant {r.plant} has no Base UoM set, blocking unit conversion and valuation.",
        }
        for r in material_master.loc[mask].itertuples()
    ]


def detect_a2_bad_reorder_point(material_master: pd.DataFrame) -> list[Anomaly]:
    mask = material_master["reorder_point"].isna() | (material_master["reorder_point"] < 0)
    out = []
    for r in material_master.loc[mask].itertuples():
        out.append({
            "type_code": "A2",
            "category": "master_data",
            "source_sheet": "Material_Master",
            "material": r.material,
            "plant": int(r.plant),
            "vendor": None,
            "record_ref": _rec(r.material, int(r.plant), reorder_point=r.reorder_point),
            "severity": "HIGH",
            "description": f"{r.material} at plant {r.plant} has a missing or negative reorder point "
                           f"({_fmt(r.reorder_point)}), which will mis-fire replenishment.",
        })
    return out


def detect_a3_duplicate_materials(material_master: pd.DataFrame) -> list[Anomaly]:
    """Exact-match on normalised description within the same plant. The
    agent layer's `find_similar_material_descriptions` tool extends this to
    near-duplicates (typos, reordered words) using embeddings -- see
    app/agents/tools.py."""
    df = material_master.copy()
    df["_norm_desc"] = df["description"].fillna("").str.strip().str.lower()
    out = []
    for (_, plant), group in df[df["_norm_desc"] != ""].groupby(["_norm_desc", "plant"]):
        if group["material"].nunique() < 2:
            continue
        materials = sorted(group["material"].unique().tolist())
        for material in materials:
            out.append({
                "type_code": "A3",
                "category": "master_data",
                "source_sheet": "Material_Master",
                "material": material,
                "plant": int(plant),
                "vendor": None,
                "record_ref": _rec(material, int(plant), duplicate_group=materials,
                                    description=group["description"].iloc[0]),
                "severity": "MEDIUM",
                "description": f"{material} at plant {plant} shares its description "
                               f"(\"{group['description'].iloc[0]}\") with {[m for m in materials if m != material]}, "
                               "suggesting split/double-counted stock under two material numbers.",
            })
    return out


def detect_a4_safety_gt_reorder(material_master: pd.DataFrame) -> list[Anomaly]:
    mask = (
        material_master["safety_stock"].notna()
        & material_master["reorder_point"].notna()
        & (material_master["safety_stock"] > material_master["reorder_point"])
    )
    out = []
    for r in material_master.loc[mask].itertuples():
        out.append({
            "type_code": "A4",
            "category": "master_data",
            "source_sheet": "Material_Master",
            "material": r.material,
            "plant": int(r.plant),
            "vendor": None,
            "record_ref": _rec(r.material, int(r.plant), safety_stock=r.safety_stock, reorder_point=r.reorder_point),
            "severity": "MEDIUM",
            "description": f"{r.material} at plant {r.plant} has safety stock ({r.safety_stock}) above its "
                           f"reorder point ({r.reorder_point}), which triggers constant false replenishment alerts.",
        })
    return out


def detect_a5_obsolete_or_blocked_in_use(
    material_master: pd.DataFrame, inventory_stock: pd.DataFrame, deliveries_dispatch: pd.DataFrame
) -> list[Anomaly]:
    inactive = material_master[material_master["lifecycle_status"] != "ACTIVE"]
    out = []
    for r in inactive.itertuples():
        in_stock = inventory_stock[(inventory_stock["material"] == r.material) & (inventory_stock["qty_on_hand"] > 0)]
        in_dispatch = deliveries_dispatch[
            (deliveries_dispatch["material"] == r.material) & (~deliveries_dispatch["status"].isin(["DELIVERED", "GI-DONE"]))
        ]
        if in_stock.empty and in_dispatch.empty:
            continue
        out.append({
            "type_code": "A5",
            "category": "master_data",
            "source_sheet": "Material_Master",
            "material": r.material,
            "plant": int(r.plant),
            "vendor": None,
            "record_ref": _rec(r.material, int(r.plant), lifecycle_status=r.lifecycle_status,
                                stock_rows=len(in_stock), open_dispatch_rows=len(in_dispatch)),
            "severity": "HIGH",
            "description": f"{r.material} is {r.lifecycle_status} in the master but still has "
                           f"{len(in_stock)} stock row(s) and/or {len(in_dispatch)} open dispatch line(s) -- "
                           "a dead material may still ship.",
        })
    return out


def detect_a6_hazmat_master_mismatch(material_master: pd.DataFrame, warehouse_bin: pd.DataFrame) -> list[Anomaly]:
    """Master-data anchored view of the hazmat/handling mismatch: a material
    flagged Hazmat=Y whose assigned bin is not a HAZ storage type. (The same
    underlying join is reported from the warehouse's perspective as C4.)"""
    hazmat = material_master[material_master["hazmat_flag"] == "Y"]
    out = []
    for r in hazmat.itertuples():
        bins = warehouse_bin[warehouse_bin["assigned_material"] == r.material]
        bad_bins = bins[bins["storage_type"] != "HAZ"]
        if bad_bins.empty:
            continue
        out.append({
            "type_code": "A6",
            "category": "master_data",
            "source_sheet": "Material_Master",
            "material": r.material,
            "plant": int(r.plant),
            "vendor": None,
            "record_ref": _rec(r.material, int(r.plant), bins=bad_bins["bin"].tolist()),
            "severity": "HIGH",
            "description": f"{r.material} is flagged Hazmat=Y but is stored in non-HAZ bin(s) "
                           f"{bad_bins['bin'].tolist()} -- a compliance breach.",
        })
    return out


# --------------------------------------------------------------------------
# B-series: Inventory_Stock
# --------------------------------------------------------------------------

def detect_b1_negative_on_hand(inventory_stock: pd.DataFrame) -> list[Anomaly]:
    mask = inventory_stock["qty_on_hand"] < 0
    out = []
    for r in inventory_stock.loc[mask].itertuples():
        out.append({
            "type_code": "B1",
            "category": "inventory",
            "source_sheet": "Inventory_Stock",
            "material": r.material,
            "plant": int(r.plant),
            "vendor": None,
            "record_ref": _rec(r.material, int(r.plant), storage_location=r.storage_location, qty_on_hand=r.qty_on_hand),
            "severity": "HIGH",
            "description": f"{r.material} at plant {r.plant} shows negative on-hand stock ({r.qty_on_hand}), "
                           "an impossible physical quantity that corrupts downstream planning.",
        })
    return out


def detect_b2_expired_with_stock(inventory_stock: pd.DataFrame, snapshot_date: date) -> list[Anomaly]:
    df = inventory_stock.dropna(subset=["batch_expiry"])
    mask = (df["batch_expiry"] < snapshot_date) & (df["qty_on_hand"] > 0)
    out = []
    for r in df.loc[mask].itertuples():
        out.append({
            "type_code": "B2",
            "category": "inventory",
            "source_sheet": "Inventory_Stock",
            "material": r.material,
            "plant": int(r.plant),
            "vendor": None,
            "record_ref": _rec(r.material, int(r.plant), batch=r.batch, batch_expiry=str(r.batch_expiry), qty_on_hand=r.qty_on_hand),
            "severity": "HIGH",
            "description": f"{r.material} batch {r.batch} at plant {r.plant} expired on {r.batch_expiry} "
                           f"but still shows {r.qty_on_hand} units on hand -- risk of shipping expired goods.",
        })
    return out


def detect_b4_stale_dead_stock(inventory_stock: pd.DataFrame, snapshot_date: date) -> list[Anomaly]:
    cutoff = snapshot_date - timedelta(days=STALE_STOCK_DAYS)
    df = inventory_stock.dropna(subset=["last_movement_date"])
    mask = (df["last_movement_date"] < cutoff) & (df["qty_on_hand"] > 0)
    out = []
    for r in df.loc[mask].itertuples():
        age_days = (snapshot_date - r.last_movement_date).days
        out.append({
            "type_code": "B4",
            "category": "inventory",
            "source_sheet": "Inventory_Stock",
            "material": r.material,
            "plant": int(r.plant),
            "vendor": None,
            "record_ref": _rec(r.material, int(r.plant), last_movement_date=str(r.last_movement_date), age_days=age_days),
            "severity": "MEDIUM",
            "description": f"{r.material} at plant {r.plant} has not moved in {age_days} days "
                           f"({r.qty_on_hand} units on hand) -- capital and space tied up in dead stock.",
        })
    return out


def detect_b5_blocked_gt_on_hand(inventory_stock: pd.DataFrame) -> list[Anomaly]:
    mask = inventory_stock["blocked_qty"] > inventory_stock["qty_on_hand"]
    out = []
    for r in inventory_stock.loc[mask].itertuples():
        out.append({
            "type_code": "B5",
            "category": "inventory",
            "source_sheet": "Inventory_Stock",
            "material": r.material,
            "plant": int(r.plant),
            "vendor": None,
            "record_ref": _rec(r.material, int(r.plant), blocked_qty=r.blocked_qty, qty_on_hand=r.qty_on_hand),
            "severity": "MEDIUM",
            "description": f"{r.material} at plant {r.plant} has blocked quantity ({r.blocked_qty}) exceeding "
                           f"on-hand stock ({r.qty_on_hand}) -- available stock is mis-stated.",
        })
    return out


# --------------------------------------------------------------------------
# C-series: Warehouse_Bin
# --------------------------------------------------------------------------

def detect_c1_bin_over_allocation(warehouse_bin: pd.DataFrame) -> list[Anomaly]:
    mask = warehouse_bin["occupied"] > warehouse_bin["capacity"]
    out = []
    for r in warehouse_bin.loc[mask].itertuples():
        out.append({
            "type_code": "C1",
            "category": "warehouse",
            "source_sheet": "Warehouse_Bin",
            "material": r.assigned_material,
            "plant": int(r.plant),
            "vendor": None,
            "record_ref": _rec(r.assigned_material, int(r.plant), bin=r.bin, occupied=r.occupied, capacity=r.capacity),
            "severity": "MEDIUM",
            "description": f"Bin {r.bin} at plant {r.plant} is over capacity ({r.occupied}/{r.capacity}) -- "
                           "physical overflow / safety risk.",
        })
    return out


def detect_c2_status_occupancy_mismatch(warehouse_bin: pd.DataFrame) -> list[Anomaly]:
    mask = (warehouse_bin["bin_status"] == "FREE") & (warehouse_bin["occupied"] > 0)
    out = []
    for r in warehouse_bin.loc[mask].itertuples():
        out.append({
            "type_code": "C2",
            "category": "warehouse",
            "source_sheet": "Warehouse_Bin",
            "material": r.assigned_material,
            "plant": int(r.plant),
            "vendor": None,
            "record_ref": _rec(r.assigned_material, int(r.plant), bin=r.bin, occupied=r.occupied),
            "severity": "MEDIUM",
            "description": f"Bin {r.bin} at plant {r.plant} is marked FREE but shows {r.occupied} units occupied -- "
                           "a putaway conflict waiting to happen.",
        })
    return out


def detect_c4_hazmat_in_non_haz_bin(material_master: pd.DataFrame, warehouse_bin: pd.DataFrame) -> list[Anomaly]:
    """Warehouse-anchored view of the same join as A6 -- see that
    function's docstring."""
    hazmat_materials = set(material_master.loc[material_master["hazmat_flag"] == "Y", "material"])
    df = warehouse_bin[warehouse_bin["assigned_material"].isin(hazmat_materials) & (warehouse_bin["storage_type"] != "HAZ")]
    out = []
    for r in df.itertuples():
        out.append({
            "type_code": "C4",
            "category": "warehouse",
            "source_sheet": "Warehouse_Bin",
            "material": r.assigned_material,
            "plant": int(r.plant),
            "vendor": None,
            "record_ref": _rec(r.assigned_material, int(r.plant), bin=r.bin, storage_type=r.storage_type),
            "severity": "HIGH",
            "description": f"Hazmat material {r.assigned_material} is stored in bin {r.bin} "
                           f"({r.storage_type}, not HAZ) at plant {r.plant} -- safety/compliance breach.",
        })
    return out


# --------------------------------------------------------------------------
# D-series: Deliveries_Dispatch
# --------------------------------------------------------------------------

def detect_d2_missing_route(deliveries_dispatch: pd.DataFrame) -> list[Anomaly]:
    mask = deliveries_dispatch["route"].isna() | (deliveries_dispatch["route"] == "")
    out = []
    for r in deliveries_dispatch.loc[mask].itertuples():
        out.append({
            "type_code": "D2",
            "category": "dispatch",
            "source_sheet": "Deliveries_Dispatch",
            "material": r.material,
            "plant": int(r.plant),
            "vendor": None,
            "record_ref": _rec(r.material, int(r.plant), delivery=r.delivery),
            "severity": "HIGH",
            "description": f"Delivery {r.delivery} ({r.material}, plant {r.plant}) has no route assigned -- "
                           "misrouting / dispatch delay risk.",
        })
    return out


def detect_d3_overdue_gi(deliveries_dispatch: pd.DataFrame, snapshot_date: date) -> list[Anomaly]:
    df = deliveries_dispatch.dropna(subset=["planned_gi_date"])
    mask = (df["planned_gi_date"] < snapshot_date) & (df["status"] == "OPEN")
    out = []
    for r in df.loc[mask].itertuples():
        days_overdue = (snapshot_date - r.planned_gi_date).days
        out.append({
            "type_code": "D3",
            "category": "dispatch",
            "source_sheet": "Deliveries_Dispatch",
            "material": r.material,
            "plant": int(r.plant),
            "vendor": None,
            "record_ref": _rec(r.material, int(r.plant), delivery=r.delivery, days_overdue=days_overdue),
            "severity": "HIGH",
            "description": f"Delivery {r.delivery} ({r.material}) is still OPEN, {days_overdue} day(s) past its "
                           f"planned goods-issue date of {r.planned_gi_date} -- SLA breach.",
        })
    return out


_EXPORT_ROUTES = {"R-EXPORT"}
_DOMESTIC_CUSTOMER_PREFIX = "CUST-"


def detect_d5_route_vs_shipto_mismatch(deliveries_dispatch: pd.DataFrame) -> list[Anomaly]:
    """
    NOT wired into run_all() -- kept here as documentation of why, and in
    case a future copy of the workbook adds a usable signal.

    The catalog defines D5 as "export route on a domestic customer." This
    dataset's only customer identifier is Ship-To, and every single Ship-To
    value in the workbook (real copy, verified) follows the same generic
    CUST-#### pattern with no country/region encoded anywhere -- there is
    no actual domestic-vs-international distinction available to check
    against. A rule of the shape below would flag every R-EXPORT delivery
    unconditionally (100% "hit rate" on one route, 0% elsewhere), which is
    noise dressed up as a finding, not a real anomaly detector. If a future
    dataset revision adds a customer country/region field, wire this back
    into rules.run_all() using that field instead of the Ship-To prefix.
    """
    df = deliveries_dispatch[
        deliveries_dispatch["route"].isin(_EXPORT_ROUTES)
        & deliveries_dispatch["ship_to"].astype(str).str.startswith(_DOMESTIC_CUSTOMER_PREFIX)
    ]
    out = []
    for r in df.itertuples():
        out.append({
            "type_code": "D5",
            "category": "dispatch",
            "source_sheet": "Deliveries_Dispatch",
            "material": r.material,
            "plant": int(r.plant),
            "vendor": None,
            "record_ref": _rec(r.material, int(r.plant), delivery=r.delivery, route=r.route, ship_to=r.ship_to),
            "severity": "MEDIUM",
            "description": f"Delivery {r.delivery} uses export route {r.route} for domestic-looking customer "
                           f"{r.ship_to} -- possible cost leakage from a routing error.",
        })
    return out


# --------------------------------------------------------------------------
# E-series: Purchase_Replenish
# --------------------------------------------------------------------------

def detect_e2_zero_or_missing_price(purchase_replenish: pd.DataFrame) -> list[Anomaly]:
    mask = purchase_replenish["unit_price"].isna() | (purchase_replenish["unit_price"] == 0)
    out = []
    for r in purchase_replenish.loc[mask].itertuples():
        out.append({
            "type_code": "E2",
            "category": "replenishment",
            "source_sheet": "Purchase_Replenish",
            "material": r.material,
            "plant": int(r.plant),
            "vendor": r.vendor,
            "record_ref": _rec(r.material, int(r.plant), r.vendor, purchase_order=r.purchase_order, unit_price=r.unit_price),
            "severity": "MEDIUM",
            "description": f"PO {r.purchase_order} ({r.material}) has a zero or missing unit price -- "
                           "valuation error, will block goods receipt.",
        })
    return out


def detect_e3_delivery_before_order(purchase_replenish: pd.DataFrame) -> list[Anomaly]:
    df = purchase_replenish.dropna(subset=["expected_delivery", "order_date"])
    mask = df["expected_delivery"] < df["order_date"]
    out = []
    for r in df.loc[mask].itertuples():
        out.append({
            "type_code": "E3",
            "category": "replenishment",
            "source_sheet": "Purchase_Replenish",
            "material": r.material,
            "plant": int(r.plant),
            "vendor": r.vendor,
            "record_ref": _rec(r.material, int(r.plant), r.vendor, purchase_order=r.purchase_order,
                                order_date=str(r.order_date), expected_delivery=str(r.expected_delivery)),
            "severity": "MEDIUM",
            "description": f"PO {r.purchase_order} ({r.material}) has an expected delivery date "
                           f"({r.expected_delivery}) before its order date ({r.order_date}) -- planning corruption.",
        })
    return out


def detect_e4_overdue_po_open(purchase_replenish: pd.DataFrame, snapshot_date: date) -> list[Anomaly]:
    df = purchase_replenish.dropna(subset=["expected_delivery"])
    mask = (df["expected_delivery"] < snapshot_date) & (df["po_status"] == "OPEN")
    out = []
    for r in df.loc[mask].itertuples():
        days_overdue = (snapshot_date - r.expected_delivery).days
        out.append({
            "type_code": "E4",
            "category": "replenishment",
            "source_sheet": "Purchase_Replenish",
            "material": r.material,
            "plant": int(r.plant),
            "vendor": r.vendor,
            "record_ref": _rec(r.material, int(r.plant), r.vendor, purchase_order=r.purchase_order, days_overdue=days_overdue),
            "severity": "HIGH",
            "description": f"PO {r.purchase_order} ({r.material}) is still OPEN, {days_overdue} day(s) past its "
                           f"expected delivery of {r.expected_delivery} -- replenishment failure.",
        })
    return out


# --------------------------------------------------------------------------
# F-series: Vendor_Master (+ its effect on open POs)
# --------------------------------------------------------------------------

def detect_f1_missing_vendor_country(vendor_master: pd.DataFrame) -> list[Anomaly]:
    mask = vendor_master["country"].isna() | (vendor_master["country"] == "")
    out = []
    for r in vendor_master.loc[mask].itertuples():
        out.append({
            "type_code": "F1",
            "category": "vendor",
            "source_sheet": "Vendor_Master",
            "material": None,
            "plant": None,
            "vendor": r.vendor,
            "record_ref": _rec(vendor=r.vendor, vendor_name=r.vendor_name),
            "severity": "MEDIUM",
            "description": f"Vendor {r.vendor} ({r.vendor_name}) has no country set -- tax/route determination will fail.",
        })
    return out


def detect_f2_blocked_vendor_open_po(vendor_master: pd.DataFrame, purchase_replenish: pd.DataFrame) -> list[Anomaly]:
    blocked_vendors = set(vendor_master.loc[vendor_master["procurement_block"] == "Y", "vendor"])
    df = purchase_replenish[purchase_replenish["vendor"].isin(blocked_vendors) & (purchase_replenish["po_status"] == "OPEN")]
    out = []
    for r in df.itertuples():
        out.append({
            "type_code": "F2",
            "category": "vendor",
            "source_sheet": "Purchase_Replenish",
            "material": r.material,
            "plant": int(r.plant),
            "vendor": r.vendor,
            "record_ref": _rec(r.material, int(r.plant), r.vendor, purchase_order=r.purchase_order),
            "severity": "HIGH",
            "description": f"PO {r.purchase_order} ({r.material}) is OPEN against vendor {r.vendor}, "
                           "who is currently procurement-blocked -- non-compliant procurement in progress.",
        })
    return out


# --------------------------------------------------------------------------
# Registry: every single-sheet check, run by app/detection/engine.py
# --------------------------------------------------------------------------

def run_all(tables: dict[str, pd.DataFrame], snapshot_date: date) -> list[Anomaly]:
    mm, inv, bins, dd, pr, vm = (
        tables["material_master"], tables["inventory_stock"], tables["warehouse_bin"],
        tables["deliveries_dispatch"], tables["purchase_replenish"], tables["vendor_master"],
    )
    out: list[Anomaly] = []
    out += detect_a1_missing_uom(mm)
    out += detect_a2_bad_reorder_point(mm)
    out += detect_a3_duplicate_materials(mm)
    out += detect_a4_safety_gt_reorder(mm)
    out += detect_a5_obsolete_or_blocked_in_use(mm, inv, dd)
    out += detect_a6_hazmat_master_mismatch(mm, bins)
    out += detect_b1_negative_on_hand(inv)
    out += detect_b2_expired_with_stock(inv, snapshot_date)
    out += detect_b4_stale_dead_stock(inv, snapshot_date)
    out += detect_b5_blocked_gt_on_hand(inv)
    out += detect_c1_bin_over_allocation(bins)
    out += detect_c2_status_occupancy_mismatch(bins)
    out += detect_c4_hazmat_in_non_haz_bin(mm, bins)
    out += detect_d2_missing_route(dd)
    out += detect_d3_overdue_gi(dd, snapshot_date)
    out += detect_d5_route_vs_shipto_mismatch(dd)
    out += detect_e2_zero_or_missing_price(pr)
    out += detect_e3_delivery_before_order(pr)
    out += detect_e4_overdue_po_open(pr, snapshot_date)
    out += detect_f1_missing_vendor_country(vm)
    out += detect_f2_blocked_vendor_open_po(vm, pr)
    return out
