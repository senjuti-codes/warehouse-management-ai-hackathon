"""
X-series: anomalies that only exist once you join sheets together. The
dataset report calls these out explicitly as "where agents shine" -- the
detection itself is still a deterministic join (cheap, reliable), but
producing the *correlated incident* (grouping related X-series + single-sheet
anomalies into one root-cause explanation) is the Root-Cause agent's job in
app/agents/graph.py, not this module's.
"""
from datetime import date

import pandas as pd


def detect_x1_orphan_material(
    material_master: pd.DataFrame,
    inventory_stock: pd.DataFrame,
    warehouse_bin: pd.DataFrame,
    deliveries_dispatch: pd.DataFrame,
    purchase_replenish: pd.DataFrame,
) -> list[dict]:
    """A Material referenced in a transactional sheet but absent from
    Material_Master -- the master record was never created (or was deleted
    out from under live transactions)."""
    known = set(material_master["material"])
    out: list[dict] = []

    checks = [
        ("Inventory_Stock", inventory_stock, "material"),
        ("Warehouse_Bin", warehouse_bin, "assigned_material"),
        ("Deliveries_Dispatch", deliveries_dispatch, "material"),
        ("Purchase_Replenish", purchase_replenish, "material"),
    ]
    for sheet_name, df, col in checks:
        orphans = df[df[col].notna() & ~df[col].isin(known)]
        for material, group in orphans.groupby(col):
            plant = int(group["plant"].iloc[0]) if "plant" in group.columns and pd.notna(group["plant"].iloc[0]) else None
            out.append({
                "type_code": "X1",
                "category": "cross_system",
                "source_sheet": sheet_name,
                "material": material,
                "plant": plant,
                "vendor": None,
                "record_ref": {"material": material, "plant": plant, "sheet": sheet_name, "row_count": len(group)},
                "severity": "HIGH",
                "description": f"{material} appears in {sheet_name} ({len(group)} row(s)) but has no "
                               "Material_Master record at all -- the master record was never created, "
                               "so every downstream transaction referencing it is unvalidated.",
            })
    return out


def detect_x2_dispatch_exceeds_available_stock(
    inventory_stock: pd.DataFrame, deliveries_dispatch: pd.DataFrame
) -> list[dict]:
    """D1/X2: sum of committed (not-yet-issued) delivery quantity for a
    Material+Plant exceeds total on-hand stock for that Material+Plant --
    i.e. no ATP (available-to-promise) check happened before dispatch was
    created."""
    open_dd = deliveries_dispatch[~deliveries_dispatch["status"].isin(["DELIVERED", "GI-DONE"])]
    committed = open_dd.groupby(["material", "plant"])["order_qty"].sum().reset_index(name="committed_qty")
    onhand = inventory_stock.groupby(["material", "plant"])["qty_on_hand"].sum().reset_index(name="onhand_qty")

    merged = committed.merge(onhand, on=["material", "plant"], how="left")
    merged["onhand_qty"] = merged["onhand_qty"].fillna(0)
    at_risk = merged[merged["committed_qty"] > merged["onhand_qty"]]

    out = []
    for r in at_risk.itertuples():
        shortfall = r.committed_qty - r.onhand_qty
        out.append({
            "type_code": "X2",
            "category": "cross_system",
            "source_sheet": "Deliveries_Dispatch+Inventory_Stock",
            "material": r.material,
            "plant": int(r.plant),
            "vendor": None,
            "record_ref": {
                "material": r.material, "plant": int(r.plant),
                "committed_qty": int(r.committed_qty), "onhand_qty": int(r.onhand_qty), "shortfall": int(shortfall),
            },
            "severity": "HIGH",
            "description": f"{r.material} at plant {r.plant} has {int(r.committed_qty)} units committed across "
                           f"open deliveries but only {int(r.onhand_qty)} on hand (shortfall of {int(shortfall)}) -- "
                           "dispatch was created without an available-to-promise check.",
        })
    return out


def run_all(tables: dict[str, pd.DataFrame], snapshot_date: date) -> list[dict]:
    mm, inv, bins, dd, pr = (
        tables["material_master"], tables["inventory_stock"], tables["warehouse_bin"],
        tables["deliveries_dispatch"], tables["purchase_replenish"],
    )
    out: list[dict] = []
    out += detect_x1_orphan_material(mm, inv, bins, dd, pr)
    out += detect_x2_dispatch_exceeds_available_stock(inv, dd)
    return out
