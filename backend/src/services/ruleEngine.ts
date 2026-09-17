import { db } from '../db.ts';

const insertAnomaly = (payload: {
  type: string;
  severity: string;
  sheet: string;
  message: string;
  evidence?: Record<string, unknown>;
  businessKey?: string;
}) => {
  const existing = db.prepare(
    'SELECT COUNT(*) as count FROM anomalies WHERE type = ? AND business_key = ? AND sheet = ?',
  ).get(payload.type, payload.businessKey ?? null, payload.sheet) as { count: number };

  if (existing.count > 0) {
    return;
  }

  const statement = db.prepare(
    'INSERT INTO anomalies (type, severity, sheet, message, evidence, business_key) VALUES (?, ?, ?, ?, ?, ?)',
  );
  statement.run(
    payload.type,
    payload.severity,
    payload.sheet,
    payload.message,
    payload.evidence ? JSON.stringify(payload.evidence) : null,
    payload.businessKey ?? null,
  );
};

export const runDetection = () => {
  const existing = db.prepare('SELECT COUNT(*) as count FROM anomalies').get() as { count: number };
  if (existing.count > 0) {
    db.exec('DELETE FROM anomalies;');
  }

  const missingUom = db.prepare(
    `SELECT material, plant, description FROM material_master WHERE TRIM(COALESCE(base_uom, '')) = '' OR base_uom IS NULL;`,
  ).all() as Array<Record<string, string>>;

  for (const row of missingUom) {
    insertAnomaly({
      type: 'missing-unit-of-measure',
      severity: 'high',
      sheet: 'Material_Master',
      message: `Material ${row.material} is missing a usable base UOM.`,
      evidence: { material: row.material, plant: row.plant, description: row.description },
      businessKey: `${row.material}|${row.plant}`,
    });
  }

  const impossibleStock = db.prepare(
    `SELECT material, plant, qty_on_hand, blocked_qty FROM inventory_stock WHERE CAST(COALESCE(qty_on_hand, '0') AS INTEGER) < 0 OR CAST(COALESCE(blocked_qty, '0') AS INTEGER) > CAST(COALESCE(qty_on_hand, '0') AS INTEGER);`,
  ).all() as Array<Record<string, string>>;

  for (const row of impossibleStock) {
    insertAnomaly({
      type: 'impossible-stock-state',
      severity: 'critical',
      sheet: 'Inventory_Stock',
      message: `Stock or blocked quantity is inconsistent for material ${row.material} at plant ${row.plant}.`,
      evidence: { material: row.material, plant: row.plant, qty_on_hand: row.qty_on_hand, blocked_qty: row.blocked_qty },
      businessKey: `${row.material}|${row.plant}`,
    });
  }

  const dispatchRows = db.prepare(
    `SELECT d.material, d.plant, d.order_qty, i.qty_on_hand FROM deliveries_dispatch d LEFT JOIN inventory_stock i ON d.material = i.material AND d.plant = i.plant ORDER BY d.material;`,
  ).all() as Array<Record<string, string>>;

  for (const row of dispatchRows) {
    const orderQty = Number(row.order_qty ?? 0);
    const available = Number(row.qty_on_hand ?? 0);
    if (Number.isFinite(orderQty) && Number.isFinite(available) && orderQty > available && available > 0) {
      insertAnomaly({
        type: 'dispatch-exceeds-stock',
        severity: 'critical',
        sheet: 'Deliveries_Dispatch',
        message: `Dispatch quantity exceeds available stock for ${row.material} at plant ${row.plant}.`,
        evidence: { material: row.material, plant: row.plant, order_qty: row.order_qty, qty_on_hand: row.qty_on_hand },
        businessKey: `${row.material}|${row.plant}`,
      });
    }
  }

  const lowQualityVendors = db.prepare(
    `SELECT vendor, vendor_name, quality_rating, procurement_block, on_time_delivery FROM vendor_master WHERE TRIM(COALESCE(procurement_block, '')) = 'Y' OR UPPER(COALESCE(quality_rating, '')) IN ('D', 'E') OR CAST(COALESCE(on_time_delivery, '0') AS INTEGER) < 90;`,
  ).all() as Array<Record<string, string>>;

  for (const row of lowQualityVendors) {
    insertAnomaly({
      type: 'vendor-risk',
      severity: 'high',
      sheet: 'Vendor_Master',
      message: `Vendor ${row.vendor} is flagged for procurement or delivery risk.`,
      evidence: {
        vendor: row.vendor,
        vendor_name: row.vendor_name,
        quality_rating: row.quality_rating,
        procurement_block: row.procurement_block,
        on_time_delivery: row.on_time_delivery,
      },
      businessKey: row.vendor,
    });
  }

  const reorderRisk = db.prepare(
    `SELECT m.material, m.plant, m.reorder_point, COALESCE(i.qty_on_hand, '0') AS qty_on_hand
     FROM material_master m
     LEFT JOIN inventory_stock i ON m.material = i.material AND m.plant = i.plant
     WHERE CAST(COALESCE(m.reorder_point, '0') AS INTEGER) > 0 AND CAST(COALESCE(i.qty_on_hand, '0') AS INTEGER) <= CAST(COALESCE(m.reorder_point, '0') AS INTEGER);`,
  ).all() as Array<Record<string, string>>;

  for (const row of reorderRisk) {
    insertAnomaly({
      type: 'reorder-threshold-risk',
      severity: 'medium',
      sheet: 'Material_Master',
      message: `Material ${row.material} at plant ${row.plant} is at or below reorder threshold.`,
      evidence: { material: row.material, plant: row.plant, reorder_point: row.reorder_point, qty_on_hand: row.qty_on_hand },
      businessKey: `${row.material}|${row.plant}`,
    });
  }

  const all = db.prepare('SELECT * FROM anomalies ORDER BY id').all() as Array<Record<string, unknown>>;
  return all;
};
