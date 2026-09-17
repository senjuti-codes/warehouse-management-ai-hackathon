import { createServer } from 'node:http';
import { db, initializeDatabase } from './db.ts';
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
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('workbook_runs','anomalies') ORDER BY name",
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

    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: false, message: 'Not found' }));
  });

  server.listen(port, () => {
    console.log(`Warehouse AI API listening on http://localhost:${port}`);
  });

  return server;
};
