import type { ValidationIssue, ValidationSummary, WorkbookProfile } from '../types.ts';

const REQUIRED_SHEETS = [
  'Material_Master',
  'Inventory_Stock',
  'Warehouse_Bin',
  'Deliveries_Dispatch',
  'Purchase_Replenish',
  'Vendor_Master',
  'Data_Dictionary',
];

const REQUIRED_COLUMNS: Record<string, string[]> = {
  Material_Master: ['Material', 'Plant', 'Base UoM'],
  Inventory_Stock: ['Material', 'Plant', 'Qty On Hand'],
  Warehouse_Bin: ['Bin', 'Assigned Material', 'Plant'],
  Deliveries_Dispatch: ['Delivery', 'Material', 'Plant', 'Order Qty'],
  Purchase_Replenish: ['Purchase Order', 'Material', 'Vendor', 'Plant'],
  Vendor_Master: ['Vendor', 'Vendor Name'],
  Data_Dictionary: ['Sheet', 'Field'],
};

export const validateWorkbookProfile = (profile: WorkbookProfile): ValidationSummary => {
  const issues: ValidationIssue[] = [];
  const sheetStatus: Record<string, { exists: boolean; rowCount: number }> = {};

  for (const requiredSheet of REQUIRED_SHEETS) {
    const sheet = profile.sheets.find((entry) => entry.name === requiredSheet);
    const rowCount = sheet?.rows.length ?? 0;
    sheetStatus[requiredSheet] = { exists: Boolean(sheet), rowCount };

    if (!sheet) {
      issues.push({
        code: 'MISSING_SHEET',
        severity: 'critical',
        sheet: requiredSheet,
        message: `Required sheet ${requiredSheet} is missing from the workbook.`,
      });
      continue;
    }

    const missingColumns = (REQUIRED_COLUMNS[requiredSheet] ?? []).filter(
      (column) => !sheet.headers.includes(column),
    );

    for (const column of missingColumns) {
      issues.push({
        code: 'MISSING_COLUMN',
        severity: 'high',
        sheet: requiredSheet,
        field: column,
        message: `Required column "${column}" is missing from ${requiredSheet}.`,
      });
    }
  }

  const duplicateSheetNames = profile.sheets
    .map((sheet) => sheet.name)
    .filter((name, index, array) => array.indexOf(name) !== index);

  for (const duplicate of duplicateSheetNames) {
    issues.push({
      code: 'DUPLICATE_SHEET',
      severity: 'high',
      sheet: duplicate,
      message: `Duplicate sheet name detected: ${duplicate}.`,
    });
  }

  return {
    isValid: issues.length === 0,
    issues,
    sheetStatus,
  };
};
