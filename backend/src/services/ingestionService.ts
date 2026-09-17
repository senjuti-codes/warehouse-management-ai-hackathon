import { db, initializeDatabase, resetAnomalies } from '../db.ts';
import { readWorkbook } from '../workbook/excelReader.ts';
import { validateWorkbookProfile } from '../workbook/schemaValidator.ts';

const toTableName = (sheetName: string) =>
  sheetName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'sheet';

const sanitizeColumnName = (name: string, index: number) => {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || `column_${index + 1}`;

  return base.length > 63 ? `${base.slice(0, 60)}_${index + 1}` : base;
};

const createSheetTable = (sheetName: string, headers: string[]) => {
  const tableName = toTableName(sheetName);

  const columnDefinitions = headers.map((header, index) => {
    const clean = sanitizeColumnName(header, index);
    return `"${clean}" TEXT`;
  });

  db.exec(`DROP TABLE IF EXISTS "${tableName}";`);
  db.exec(`
    CREATE TABLE "${tableName}" (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      row_number INTEGER,
      ${columnDefinitions.join(', ')},
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return tableName;
};

const insertRows = (tableName: string, headers: string[], rows: Record<string, unknown>[]) => {
  if (!rows.length) {
    return;
  }

  const sanitizedHeaders = headers.map((header, index) => sanitizeColumnName(header, index));
  const placeholders = sanitizedHeaders.map(() => '?').join(', ');
  const statement = db.prepare(`INSERT INTO "${tableName}" (row_number, ${sanitizedHeaders.map((header) => `"${header}"`).join(', ')}) VALUES (?, ${placeholders})`);

  for (const [index, row] of rows.entries()) {
    const values = sanitizedHeaders.map((header) => {
      const match = row[header] ?? row[headers[ sanitizedHeaders.indexOf(header) ]] ?? null;
      return match === undefined || match === null || String(match).trim() === '' ? null : String(match).trim();
    });

    statement.run(index + 2, ...values);
  }
};

export const ingestWorkbook = async (filePath: string) => {
  initializeDatabase();
  resetAnomalies();

  const profile = await readWorkbook(filePath);
  const validation = validateWorkbookProfile(profile);

  const runsStmt = db.prepare(
    'INSERT INTO workbook_runs (source_file, total_sheets, total_rows, valid) VALUES (?, ?, ?, ?)',
  );

  const totalRows = profile.sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0);
  runsStmt.run(filePath, profile.sheets.length, totalRows, validation.isValid ? 1 : 0);

  for (const sheet of profile.sheets) {
    const tableName = createSheetTable(sheet.name, sheet.headers);
    insertRows(tableName, sheet.headers, sheet.rows as Record<string, unknown>[]);
  }

  return {
    sourceFile: filePath,
    valid: validation.isValid,
    validationIssues: validation.issues,
    sheetCount: profile.sheets.length,
    rowCounts: Object.fromEntries(
      profile.sheets.map((sheet) => [sheet.name, sheet.rows.length]),
    ),
    totalRows,
  };
};
