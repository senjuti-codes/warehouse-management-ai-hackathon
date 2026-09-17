from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.raw import DeliveriesDispatch, InventoryStock, MaterialMaster, PurchaseReplenish, WarehouseBin
from app.models.workflow import Anomaly

router = APIRouter(prefix="/materials", tags=["materials"])


def _serialize(rows) -> list[dict]:
    return [{c.name: getattr(r, c.name) for c in r.__table__.columns} for r in rows]


@router.get("/{material}/360")
def material_360(material: str, db: Session = Depends(get_db)) -> dict:
    """Everything known about one material across all six sheets plus every
    anomaly touching it, in one call -- backs the frontend's drill-down view
    when an operator clicks into a specific material from an incident."""
    return {
        "material": material,
        "master": _serialize(db.query(MaterialMaster).filter(MaterialMaster.material == material).all()),
        "inventory": _serialize(db.query(InventoryStock).filter(InventoryStock.material == material).all()),
        "bins": _serialize(db.query(WarehouseBin).filter(WarehouseBin.assigned_material == material).all()),
        "deliveries": _serialize(db.query(DeliveriesDispatch).filter(DeliveriesDispatch.material == material).all()),
        "purchase_orders": _serialize(db.query(PurchaseReplenish).filter(PurchaseReplenish.material == material).all()),
        "anomalies": [
            {"id": str(a.id), "type_code": a.type_code, "severity": a.severity, "description": a.description, "status": a.status}
            for a in db.query(Anomaly).filter(Anomaly.material == material).all()
        ],
    }
