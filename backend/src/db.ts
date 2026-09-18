import { DatabaseSync } from 'node:sqlite';

export const db = new DatabaseSync('warehouse_ai.sqlite');

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
