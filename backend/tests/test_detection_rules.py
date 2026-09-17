"""
Unit tests for app/detection/rules.py and cross_system.py, against small
hand-built DataFrames rather than the real workbook -- keeps these fast and
independent of any database or LLM call, and pins down exactly what each
rule is supposed to catch.
"""
from datetime import date

import pandas as pd

from app.detection import cross_system, rules

SNAPSHOT = date(2026, 9, 5)


def test_a1_missing_uom_flags_blank_only():
    df = pd.DataFrame([
        {"material": "MAT-1", "plant": 1010, "base_uom": "EA"},
        {"material": "MAT-2", "plant": 1010, "base_uom": None},
    ])
    result = rules.detect_a1_missing_uom(df)
    assert len(result) == 1
    assert result[0]["material"] == "MAT-2"
    assert result[0]["type_code"] == "A1"


def test_a2_flags_negative_and_blank_reorder_point():
    df = pd.DataFrame([
        {"material": "MAT-1", "plant": 1010, "reorder_point": 100},
        {"material": "MAT-2", "plant": 1010, "reorder_point": -5},
        {"material": "MAT-3", "plant": 1010, "reorder_point": None},
    ])
    result = rules.detect_a2_bad_reorder_point(df)
    assert {r["material"] for r in result} == {"MAT-2", "MAT-3"}


def test_a4_safety_greater_than_reorder():
    df = pd.DataFrame([
        {"material": "MAT-1", "plant": 1010, "safety_stock": 50, "reorder_point": 100},
        {"material": "MAT-2", "plant": 1010, "safety_stock": 150, "reorder_point": 100},
    ])
    result = rules.detect_a4_safety_gt_reorder(df)
    assert len(result) == 1
    assert result[0]["material"] == "MAT-2"


def test_b1_negative_on_hand():
    df = pd.DataFrame([
        {"material": "MAT-1", "plant": 1010, "storage_location": "0001", "qty_on_hand": 10, "blocked_qty": 0},
        {"material": "MAT-2", "plant": 1010, "storage_location": "0001", "qty_on_hand": -5, "blocked_qty": 0},
    ])
    result = rules.detect_b1_negative_on_hand(df)
    assert len(result) == 1
    assert result[0]["material"] == "MAT-2"


def test_b2_expired_batch_with_stock():
    df = pd.DataFrame([
        {"material": "MAT-1", "plant": 1010, "batch": "B1", "batch_expiry": date(2026, 1, 1), "qty_on_hand": 10},
        {"material": "MAT-2", "plant": 1010, "batch": "B2", "batch_expiry": date(2026, 12, 1), "qty_on_hand": 10},
        {"material": "MAT-3", "plant": 1010, "batch": "B3", "batch_expiry": date(2026, 1, 1), "qty_on_hand": 0},
    ])
    result = rules.detect_b2_expired_with_stock(df, SNAPSHOT)
    assert len(result) == 1
    assert result[0]["material"] == "MAT-1"


def test_c1_bin_over_allocation():
    df = pd.DataFrame([
        {"bin": "B1", "assigned_material": "MAT-1", "plant": 1010, "capacity": 100, "occupied": 150, "bin_status": "OCC", "storage_type": "BULK"},
        {"bin": "B2", "assigned_material": "MAT-2", "plant": 1010, "capacity": 100, "occupied": 50, "bin_status": "OCC", "storage_type": "BULK"},
    ])
    result = rules.detect_c1_bin_over_allocation(df)
    assert len(result) == 1
    assert result[0]["record_ref"]["bin"] == "B1"


def test_x2_dispatch_exceeds_available_stock():
    inventory = pd.DataFrame([
        {"material": "MAT-1", "plant": 1010, "qty_on_hand": 50},
    ])
    deliveries = pd.DataFrame([
        {"material": "MAT-1", "plant": 1010, "order_qty": 80, "status": "OPEN"},
        {"material": "MAT-1", "plant": 1010, "order_qty": 10, "status": "DELIVERED"},  # shouldn't count
    ])
    result = cross_system.detect_x2_dispatch_exceeds_available_stock(inventory, deliveries)
    assert len(result) == 1
    assert result[0]["record_ref"]["shortfall"] == 30


def test_x1_orphan_material_across_sheets():
    material_master = pd.DataFrame([{"material": "MAT-1", "plant": 1010}])
    inventory = pd.DataFrame([
        {"material": "MAT-1", "plant": 1010},
        {"material": "MAT-999", "plant": 1010},
    ])
    empty = pd.DataFrame(columns=["assigned_material", "plant", "material"])
    result = cross_system.detect_x1_orphan_material(material_master, inventory, empty, empty, empty)
    assert len(result) == 1
    assert result[0]["material"] == "MAT-999"
