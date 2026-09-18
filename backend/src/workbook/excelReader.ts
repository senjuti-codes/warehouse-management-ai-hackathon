import ExcelJS from 'exceljs';
import type { WorkbookProfile, WorkbookSheet } from '../types.ts';

const REQUIRED_SHEETS = [
  'Material_Master',
  'Inventory_Stock',
  'Warehouse_Bin',
  'Deliveries_Dispatch',
  'Purchase_Replenish',
  'Vendor_Master',
  'Data_Dictionary',
];

// Renders a cell's value as display text, mirroring Excel's `.Text` behaviour.
const cellToText = (cell: ExcelJS.Cell): string => {
  const value = cell.value;

  if (value === null || value === undefined) {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'object') {
    if ('richText' in value && Array.isArray((value as ExcelJS.CellRichTextValue).richText)) {
      return (value as ExcelJS.CellRichTextValue).richText.map((part) => part.text).join('');
    }
    if ('result' in value) {
      const result = (value as ExcelJS.CellFormulaValue).result;
      return result === null || result === undefined ? '' : String(result);
    }
    if ('text' in value) {
      return String((value as ExcelJS.CellHyperlinkValue).text);
    }
    return String(value);
  }

  return String(value);
};

const normalizeSheet = (sheetName: string, rows: string[][]): WorkbookSheet => {
  const headers = Array.isArray(rows[0]) ? rows[0].map((value) => String(value ?? '').trim()) : [];
  const dataRows = rows.slice(1).map((row, rowIndex) => {
    const record: Record<string, string | number | null> = {};
    headers.forEach((header, headerIndex) => {
      const value = row[headerIndex];
      record[header] = value === undefined || value === null || value === '' ? null : String(value).trim();
    });
    return { __rowNumber: rowIndex + 2, ...record };
  });

  return {
    name: sheetName,
    headers,
    rows: dataRows,
  };
};

export const readWorkbook = async (filePath: string): Promise<WorkbookProfile> => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const sheets: WorkbookSheet[] = [];

  workbook.eachSheet((worksheet) => {
    let maxColumn = 0;
    worksheet.eachRow({ includeEmpty: true }, (row) => {
      maxColumn = Math.max(maxColumn, row.cellCount);
    });

    const rows: string[][] = [];
    worksheet.eachRow({ includeEmpty: true }, (row) => {
      const values: string[] = [];
      for (let column = 1; column <= maxColumn; column += 1) {
        values.push(cellToText(row.getCell(column)));
      }
      rows.push(values);
    });

    sheets.push(normalizeSheet(worksheet.name, rows));
  });

  const missing = REQUIRED_SHEETS.filter((name) => !sheets.some((sheet) => sheet.name === name));

  if (missing.length > 0) {
    throw new Error(`Missing required workbook sheets: ${missing.join(', ')}`);
  }

  return {
    sheets,
    sheetNames: sheets.map((sheet) => sheet.name),
    sourceFile: filePath,
  };
};
