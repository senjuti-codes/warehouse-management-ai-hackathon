"""
One table per source sheet, columns kept close to the workbook so mapping
stays obvious. Every table gets a surrogate `id` PK (several sheets, like
Inventory_Stock, don't have a clean natural key once Batch can be blank) plus
indexes on whatever natural keys the Data_Dictionary says to join on:
Material, Plant, Vendor.

These are re-populated on every ingestion run (see app/ingestion/load_workbook.py)
-- they are a mirror of the workbook, not a system of record.
"""
from datetime import date

from sqlalchemy import Date, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class MaterialMaster(Base):
    __tablename__ = "material_master"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    material: Mapped[str] = mapped_column(String, index=True)
    description: Mapped[str] = mapped_column(String, nullable=True)
    material_type: Mapped[str] = mapped_column(String, nullable=True)
    material_group: Mapped[str] = mapped_column(String, nullable=True)
    base_uom: Mapped[str | None] = mapped_column(String, nullable=True)
    plant: Mapped[int] = mapped_column(Integer, index=True)
    reorder_point: Mapped[float | None] = mapped_column(Float, nullable=True)
    safety_stock: Mapped[float | None] = mapped_column(Float, nullable=True)
    lead_time_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    abc_class: Mapped[str] = mapped_column(String, nullable=True)
    hazmat_flag: Mapped[str] = mapped_column(String, nullable=True)
    lifecycle_status: Mapped[str] = mapped_column(String, nullable=True)


class InventoryStock(Base):
    __tablename__ = "inventory_stock"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    material: Mapped[str] = mapped_column(String, index=True)
    plant: Mapped[int] = mapped_column(Integer, index=True)
    storage_location: Mapped[str] = mapped_column(String, nullable=True)
    batch: Mapped[str | None] = mapped_column(String, nullable=True)
    uom: Mapped[str | None] = mapped_column(String, nullable=True)
    qty_on_hand: Mapped[int] = mapped_column(Integer, nullable=True)
    blocked_qty: Mapped[int] = mapped_column(Integer, nullable=True)
    in_transit_qty: Mapped[int] = mapped_column(Integer, nullable=True)
    batch_expiry: Mapped[date | None] = mapped_column(Date, nullable=True)
    last_movement_date: Mapped[date | None] = mapped_column(Date, nullable=True)


class WarehouseBin(Base):
    __tablename__ = "warehouse_bin"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    bin: Mapped[str] = mapped_column(String, index=True)
    storage_type: Mapped[str] = mapped_column(String, nullable=True)
    assigned_material: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    capacity: Mapped[int] = mapped_column(Integer, nullable=True)
    occupied: Mapped[int] = mapped_column(Integer, nullable=True)
    bin_status: Mapped[str] = mapped_column(String, nullable=True)
    plant: Mapped[int] = mapped_column(Integer, index=True)


class DeliveriesDispatch(Base):
    __tablename__ = "deliveries_dispatch"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    delivery: Mapped[str] = mapped_column(String, index=True)
    material: Mapped[str] = mapped_column(String, index=True)
    plant: Mapped[int] = mapped_column(Integer, index=True)
    order_qty: Mapped[int] = mapped_column(Integer, nullable=True)
    ship_to: Mapped[str] = mapped_column(String, nullable=True)
    route: Mapped[str | None] = mapped_column(String, nullable=True)
    created_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    planned_gi_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=True)


class PurchaseReplenish(Base):
    __tablename__ = "purchase_replenish"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    purchase_order: Mapped[str] = mapped_column(String, index=True)
    material: Mapped[str] = mapped_column(String, index=True)
    vendor: Mapped[str] = mapped_column(String, index=True)
    plant: Mapped[int] = mapped_column(Integer, index=True)
    po_qty: Mapped[int] = mapped_column(Integer, nullable=True)
    unit_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    currency: Mapped[str] = mapped_column(String, nullable=True)
    order_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    expected_delivery: Mapped[date | None] = mapped_column(Date, nullable=True)
    po_status: Mapped[str] = mapped_column(String, nullable=True)


class VendorMaster(Base):
    __tablename__ = "vendor_master"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    vendor: Mapped[str] = mapped_column(String, index=True)
    vendor_name: Mapped[str] = mapped_column(String, nullable=True)
    country: Mapped[str | None] = mapped_column(String, nullable=True)
    quality_rating: Mapped[str] = mapped_column(String, nullable=True)
    on_time_delivery_pct: Mapped[int | None] = mapped_column(Integer, nullable=True)
    procurement_block: Mapped[str] = mapped_column(String, nullable=True)
