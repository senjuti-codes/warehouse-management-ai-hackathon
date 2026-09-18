import { createServer } from 'node:http';
import { db, initializeDatabase, logAudit } from './db.ts';
import { appConfig } from './config.ts';
import { ingestWorkbook } from './services/ingestionService.ts';
import { runDetection } from './services/ruleEngine.ts';
import { analyzeAnomalyWithLlm } from './services/llmService.ts';

const parseBody = async (req: import('node:http').IncomingMessage) => {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (!chunks.length) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return {};
  }
};

const setCorsHeaders = (res: import('node:http').ServerResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

const recommendationFor = (type: string) => {
  const recommendations: Record<string, { category: string; recommendation: string; confidence: number }> = {
    'dispatch-exceeds-stock': { category: 'Inventory', recommendation: 'Split the delivery and trigger replenishment before goods issue.', confidence: 0.94 },
    'impossible-stock-state': { category: 'Inventory', recommendation: 'Block allocation and reconcile the physical stock count.', confidence: 0.98 },
    'vendor-risk': { category: 'Procurement', recommendation: 'Hold new purchase orders and request an approved vendor substitution.', confidence: 0.9 },
    'reorder-threshold-risk': { category: 'Replenishment', recommendation: 'Review open purchase orders and create replenishment for the shortfall.', confidence: 0.87 },
    'missing-unit-of-measure': { category: 'Master data', recommendation: 'Correct the material master UOM before allowing planning or dispatch.', confidence: 0.99 },
  };

  return recommendations[type] ?? { category: 'Operations', recommendation: 'Review the linked source records and confirm the corrective action.', confidence: 0.75 };
};

export const createApiServer = (port: number) => {
  initializeDatabase();

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        service: 'warehouse-ai-backend',
        status: 'ok',
        endpoints: {
          health: '/health',
          dashboard: '/api/dashboard',
          anomalies: '/api/anomalies',
          ingest: 'POST /api/ingest',
        },
      }));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ status: 'ok', service: 'warehouse-ai-backend' }));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/ingest') {
      const body = await parseBody(req);
      const filePath = String(body.filePath ?? appConfig.workbookPath);

      try {
        const summary = await ingestWorkbook(filePath);
        const anomalies = runDetection();

        logAudit({
          eventType: 'workbook.ingested',
          entityType: 'workbook',
          entityId: filePath,
          actor: 'system',
          summary: `Ingested ${summary.totalRows} rows across ${summary.sheetCount} sheets; detected ${anomalies.length} anomalies.`,
          payload: { filePath, totalRows: summary.totalRows, sheetCount: summary.sheetCount, anomalyCount: anomalies.length, valid: summary.valid },
        });

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            success: true,
            summary,
            anomalies,
          }),
        );
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, message: error instanceof Error ? error.message : 'Unknown error' }));
      }
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/anomalies') {
      const rows = db.prepare(
        `SELECT a.*, d.status AS decision_status, d.comment AS decision_comment, d.decided_at
         FROM anomalies a LEFT JOIN anomaly_decisions d ON d.anomaly_id = a.id
         ORDER BY a.created_at DESC`,
      ).all() as Array<Record<string, unknown>>;
      const enriched = rows.map((row) => ({
        ...row,
        ...recommendationFor(String(row.type)),
        recommendation_source: 'deterministic-rule',
        ai_analysis_available: false,
      }));
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(enriched));
      return;
    }

    if (req.method === 'GET' && url.pathname.startsWith('/api/workbook/')) {
      const tableName = url.pathname.split('/')[3];
      const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 1000), 1), 5000);
      const offset = Math.max(Number(url.searchParams.get('offset') ?? 0), 0);
      const allowedName = /^[a-z0-9_]+$/.test(tableName ?? '');
      const excludedTables = ['workbook_runs', 'anomalies', 'anomaly_decisions'];

      if (!allowedName || excludedTables.includes(tableName ?? '')) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, message: 'Invalid workbook table.' }));
        return;
      }

      const exists = db.prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      ).get(tableName);
      if (!exists) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, message: 'Workbook table not found.' }));
        return;
      }

      const rows = db.prepare(`SELECT * FROM "${tableName}" ORDER BY id LIMIT ? OFFSET ?`).all(limit, offset);
      const total = db.prepare(`SELECT COUNT(*) AS count FROM "${tableName}"`).get() as { count: number };
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, table: tableName, rows, total: total.count, limit, offset }));
      return;
    }

    if (req.method === 'POST' && url.pathname.startsWith('/api/anomalies/') && url.pathname.endsWith('/decision')) {
      const anomalyId = Number(url.pathname.split('/')[3]);
      const body = await parseBody(req);
      const status = String(body.status ?? '');
      const comment = String(body.comment ?? '').trim() || null;
      if (!Number.isInteger(anomalyId) || !['approved', 'rejected'].includes(status)) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, message: 'A valid anomaly id and decision status are required.' }));
        return;
      }

      const anomaly = db.prepare('SELECT id FROM anomalies WHERE id = ?').get(anomalyId);
      if (!anomaly) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, message: 'Anomaly not found.' }));
        return;
      }

      db.prepare(
        `INSERT INTO anomaly_decisions (anomaly_id, status, comment) VALUES (?, ?, ?)
         ON CONFLICT(anomaly_id) DO UPDATE SET status = excluded.status, comment = excluded.comment, decided_at = CURRENT_TIMESTAMP`,
      ).run(anomalyId, status, comment);

      const anomalyRow = db.prepare('SELECT type, sheet, message, business_key FROM anomalies WHERE id = ?').get(anomalyId) as
        | { type: string; sheet: string; message: string; business_key: string | null }
        | undefined;
      const actor = String(body.actor ?? 'operator');
      logAudit({
        eventType: `anomaly.${status}`,
        entityType: 'anomaly',
        entityId: anomalyId,
        actor,
        summary: `Operator ${status} anomaly AN-${anomalyId}${anomalyRow ? `: ${anomalyRow.message}` : ''}`,
        payload: { anomalyId, status, comment, type: anomalyRow?.type, sheet: anomalyRow?.sheet, businessKey: anomalyRow?.business_key },
      });

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, anomalyId, status, comment }));
      return;
    }

    if (req.method === 'POST' && url.pathname.startsWith('/api/anomalies/') && url.pathname.endsWith('/ai-analysis')) {
      const anomalyId = Number(url.pathname.split('/')[3]);
      const row = db.prepare('SELECT * FROM anomalies WHERE id = ?').get(anomalyId) as Record<string, unknown> | undefined;
      if (!row) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, message: 'Anomaly not found.' }));
        return;
      }
      try {
        const recommendation = recommendationFor(String(row.type));
        const analysis = await analyzeAnomalyWithLlm({
          id: Number(row.id), type: String(row.type), severity: String(row.severity), sheet: String(row.sheet),
          message: String(row.message), evidence: row.evidence ? String(row.evidence) : null,
          business_key: row.business_key ? String(row.business_key) : null,
          deterministic_recommendation: recommendation.recommendation,
        });
        logAudit({
          eventType: 'anomaly.ai_analyzed',
          entityType: 'anomaly',
          entityId: anomalyId,
          actor: `llm:${analysis.model || 'unknown'}`,
          summary: `AI analysis generated for AN-${anomalyId}: ${analysis.summary?.slice(0, 160) ?? 'no summary'}`,
          payload: { anomalyId, model: analysis.model, confidence: analysis.confidence },
        });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, analysis }));
      } catch (error) {
        res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, message: error instanceof Error ? error.message : 'LLM analysis failed.' }));
      }
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/dashboard') {
      const totalAnomalies = db.prepare('SELECT COUNT(*) as count FROM anomalies').get() as { count: number };
      const severityCounts = db.prepare(
        `SELECT
          SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) AS critical_count,
          SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) AS high_count,
          SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END) AS medium_count,
          SUM(CASE WHEN severity = 'low' THEN 1 ELSE 0 END) AS low_count,
          MAX(created_at) AS last_updated
        FROM anomalies;`,
      ).get() as {
        critical_count: number;
        high_count: number;
        medium_count: number;
        low_count: number;
        last_updated: string | null;
      };
      const recordSummary = db.prepare(
        'SELECT total_rows FROM workbook_runs ORDER BY id DESC LIMIT 1',
      ).get() as { total_rows?: number } | undefined;
      const sheetCounts = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('workbook_runs','anomalies','anomaly_decisions','audit_log','readme','data_dictionary') ORDER BY name",
      ).all() as Array<{ name: string }>;

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          totalAnomalies: totalAnomalies.count,
          totalRecords: recordSummary?.total_rows ?? 0,
          criticalCount: Number(severityCounts.critical_count ?? 0),
          highCount: Number(severityCounts.high_count ?? 0),
          mediumCount: Number(severityCounts.medium_count ?? 0),
          lowCount: Number(severityCounts.low_count ?? 0),
          lastUpdated: severityCounts.last_updated ?? new Date().toISOString(),
          sourceTables: sheetCounts.map((entry) => entry.name),
        }),
      );
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/audit-log') {
      const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 50), 1), 500);
      const entityType = url.searchParams.get('entity_type');
      const entityId = url.searchParams.get('entity_id');
      let sql = 'SELECT id, event_type, entity_type, entity_id, actor, summary, payload, created_at FROM audit_log';
      const params: (string | number)[] = [];
      const filters: string[] = [];
      if (entityType) { filters.push('entity_type = ?'); params.push(entityType); }
      if (entityId) { filters.push('entity_id = ?'); params.push(entityId); }
      if (filters.length) sql += ' WHERE ' + filters.join(' AND ');
      sql += ' ORDER BY id DESC LIMIT ?';
      params.push(limit);
      const rows = db.prepare(sql).all(...params);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(rows));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/impact') {
      const shortfallRow = db.prepare(`
        SELECT COALESCE(SUM(CAST(COALESCE(d.order_qty, '0') AS REAL) - CAST(COALESCE(i.qty_on_hand, '0') AS REAL)), 0) AS shortfall_qty,
               COUNT(*) AS affected_deliveries
        FROM deliveries_dispatch d
        LEFT JOIN inventory_stock i ON i.material = d.material AND i.plant = d.plant
        WHERE CAST(COALESCE(d.order_qty, '0') AS REAL) > CAST(COALESCE(i.qty_on_hand, '0') AS REAL)
      `).get() as { shortfall_qty: number; affected_deliveries: number };

      const anomalyMix = db.prepare(`
        SELECT severity, COUNT(*) AS c FROM anomalies GROUP BY severity
      `).all() as Array<{ severity: string; c: number }>;
      const bySeverity = Object.fromEntries(anomalyMix.map((row) => [row.severity, Number(row.c)])) as Record<string, number>;

      const decidedCount = (db.prepare('SELECT COUNT(*) AS c FROM anomaly_decisions').get() as { c: number }).c;
      const totalAnomalies = (db.prepare('SELECT COUNT(*) AS c FROM anomalies').get() as { c: number }).c;

      const unitPriceEuros = 42;
      const atRiskValue = Math.round(shortfallRow.shortfall_qty * unitPriceEuros);
      const potentialDelayHours = Math.round((bySeverity.critical ?? 0) * 4 + (bySeverity.high ?? 0) * 2 + shortfallRow.affected_deliveries * 1.5);
      const recoveryCoverage = totalAnomalies === 0 ? 100 : Math.round((decidedCount / totalAnomalies) * 100);

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        atRiskValueEuros: atRiskValue,
        shortfallQuantity: Math.round(shortfallRow.shortfall_qty),
        affectedDeliveries: shortfallRow.affected_deliveries,
        potentialDelayHours,
        recoveryCoveragePercent: recoveryCoverage,
        anomaliesBySeverity: bySeverity,
        decidedCount,
        totalAnomalies,
        unitPriceAssumptionEuros: unitPriceEuros,
      }));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/correlations') {
      const rows = db.prepare(`
        SELECT business_key, COUNT(*) AS anomaly_count,
               SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) AS critical_count,
               SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) AS high_count,
               GROUP_CONCAT(DISTINCT type) AS anomaly_types,
               GROUP_CONCAT(DISTINCT sheet) AS sheets,
               MAX(created_at) AS latest,
               MIN(id) AS first_anomaly_id
        FROM anomalies
        WHERE business_key IS NOT NULL AND business_key <> ''
        GROUP BY business_key
        HAVING anomaly_count >= 2
        ORDER BY critical_count DESC, anomaly_count DESC
        LIMIT 25
      `).all() as Array<{
        business_key: string;
        anomaly_count: number;
        critical_count: number;
        high_count: number;
        anomaly_types: string;
        sheets: string;
        latest: string;
        first_anomaly_id: number;
      }>;

      const clusters = rows.map((row) => ({
        businessKey: row.business_key,
        anomalyCount: Number(row.anomaly_count),
        criticalCount: Number(row.critical_count),
        highCount: Number(row.high_count),
        anomalyTypes: (row.anomaly_types ?? '').split(',').filter(Boolean),
        sheetsInvolved: (row.sheets ?? '').split(',').filter(Boolean),
        latestDetectedAt: row.latest,
        firstAnomalyId: Number(row.first_anomaly_id),
      }));

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ clusters, totalClusters: clusters.length }));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/vendors/enriched') {
      const vendorTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='vendor_master'").get();
      if (!vendorTableExists) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify([]));
        return;
      }
      const vendors = db.prepare('SELECT * FROM vendor_master').all() as Array<Record<string, string | null>>;
      const purchaseTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='purchase_replenish'").get();
      const materialTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='material_master'").get();

      const openOrdersByVendor = new Map<string, number>();
      const nextDeliveryByVendor = new Map<string, string>();
      const materialsByVendor = new Map<string, Set<string>>();
      if (purchaseTableExists) {
        const purchases = db.prepare('SELECT vendor, material, expected_delivery, po_status FROM purchase_replenish').all() as Array<{
          vendor: string | null; material: string | null; expected_delivery: string | null; po_status: string | null;
        }>;
        for (const purchase of purchases) {
          if (!purchase.vendor) continue;
          const isOpen = !purchase.po_status || !/(closed|received|complete|delivered)/i.test(purchase.po_status);
          if (isOpen) openOrdersByVendor.set(purchase.vendor, (openOrdersByVendor.get(purchase.vendor) ?? 0) + 1);
          if (purchase.expected_delivery) {
            const current = nextDeliveryByVendor.get(purchase.vendor);
            if (!current || purchase.expected_delivery < current) {
              nextDeliveryByVendor.set(purchase.vendor, purchase.expected_delivery);
            }
          }
          if (purchase.material) {
            const set = materialsByVendor.get(purchase.vendor) ?? new Set<string>();
            set.add(purchase.material);
            materialsByVendor.set(purchase.vendor, set);
          }
        }
      }

      const leadTimeByMaterial = new Map<string, number>();
      if (materialTableExists) {
        const materials = db.prepare('SELECT material, lead_time_days FROM material_master').all() as Array<{ material: string | null; lead_time_days: string | null }>;
        for (const material of materials) {
          if (!material.material) continue;
          const days = Number(material.lead_time_days);
          if (Number.isFinite(days)) leadTimeByMaterial.set(material.material, days);
        }
      }

      const enriched = vendors.map((vendor) => {
        const vendorId = vendor.vendor ?? '';
        const linkedMaterials = Array.from(materialsByVendor.get(vendorId) ?? []);
        const leadTimes = linkedMaterials.map((mat) => leadTimeByMaterial.get(mat)).filter((value): value is number => Number.isFinite(value));
        const avgLeadTime = leadTimes.length ? Math.round(leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length) : null;
        return {
          ...vendor,
          open_orders: openOrdersByVendor.get(vendorId) ?? 0,
          next_delivery: nextDeliveryByVendor.get(vendorId) ?? null,
          linked_material_count: linkedMaterials.length,
          average_lead_time_days: avgLeadTime,
        };
      });

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(enriched));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: false, message: 'Not found' }));
  });

  server.listen(port, () => {
    console.log(`Warehouse AI API listening on http://localhost:${port}`);
  });

  return server;
};
