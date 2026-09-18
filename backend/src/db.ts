import { DatabaseSync } from 'node:sqlite';

export const db = new DatabaseSync('warehouse_ai.sqlite');

const ensureColumn = (table: string, column: string, definition: string) => {
  const columns = db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>;
  if (!columns.some((entry) => entry.name === column)) {
    db.exec(`ALTER TABLE "${table}" ADD COLUMN ${column} ${definition};`);
  }
};

export const initializeDatabase = () => {
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS workbook_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_file TEXT NOT NULL,
      total_sheets INTEGER NOT NULL,
      total_rows INTEGER NOT NULL,
      valid INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS anomalies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      severity TEXT NOT NULL,
      sheet TEXT NOT NULL,
      message TEXT NOT NULL,
      evidence TEXT,
      business_key TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS anomaly_decisions (
      anomaly_id INTEGER PRIMARY KEY,
      status TEXT NOT NULL CHECK (status IN ('approved', 'rejected')),
      comment TEXT,
      decided_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (anomaly_id) REFERENCES anomalies(id) ON DELETE CASCADE
    );
  `);

  // decided_by distinguishes a human operator decision from an autonomous AI auto-fix
  ensureColumn('anomaly_decisions', 'decided_by', "TEXT NOT NULL DEFAULT 'operator'");

  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      actor TEXT,
      summary TEXT NOT NULL,
      payload TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Stage 3 (LLMaaS Triage): per-anomaly auto-fix eligibility + risk assessment
  db.exec(`
    CREATE TABLE IF NOT EXISTS anomaly_triage (
      anomaly_id INTEGER PRIMARY KEY,
      auto_fixable INTEGER NOT NULL DEFAULT 0,
      auto_fix_confidence REAL,
      risk_level TEXT,
      reasoning TEXT,
      recommended_action TEXT,
      approval_urgency TEXT,
      model TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (anomaly_id) REFERENCES anomalies(id) ON DELETE CASCADE
    );
  `);

  // Stage 4 (LLMaaS Solution Generator): rich recommendation for anomalies needing manual review
  db.exec(`
    CREATE TABLE IF NOT EXISTS anomaly_solutions (
      anomaly_id INTEGER PRIMARY KEY,
      executive_summary TEXT,
      root_cause_analysis TEXT,
      business_impact TEXT,
      solutions TEXT,
      recommended_option INTEGER,
      approval_checklist TEXT,
      model TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (anomaly_id) REFERENCES anomalies(id) ON DELETE CASCADE
    );
  `);
};

export type AuditEntry = {
  eventType: string;
  entityType?: string | null;
  entityId?: string | number | null;
  actor?: string | null;
  summary: string;
  payload?: Record<string, unknown> | null;
};

export const logAudit = (entry: AuditEntry) => {
  db.prepare(
    `INSERT INTO audit_log (event_type, entity_type, entity_id, actor, summary, payload)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    entry.eventType,
    entry.entityType ?? null,
    entry.entityId === null || entry.entityId === undefined ? null : String(entry.entityId),
    entry.actor ?? null,
    entry.summary,
    entry.payload ? JSON.stringify(entry.payload) : null,
  );
};

export const resetAnomalies = () => {
  db.exec('DELETE FROM anomalies;');
};

export const closeDatabase = () => {
  db.close();
};
