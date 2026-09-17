import { readWorkbook } from './excelReader.ts';
import { validateWorkbookProfile } from './schemaValidator.ts';
import type { AnomalyFinding, PipelineResult } from '../types.ts';

const buildSeedAnomalies = (): AnomalyFinding[] => {
  return [
    {
      id: 'AN-0001',
      type: 'missing-master-data',
      severity: 'high',
      sheet: 'Material_Master',
      message: 'Master data record is missing a required planning attribute.',
      evidence: { check: 'required-field-presence', rule: 'MATERIAL_MASTER_VALIDATION' },
      businessKey: 'material+plant',
    },
    {
      id: 'AN-0002',
      type: 'dispatch-exceeds-stock',
      severity: 'critical',
      sheet: 'Deliveries_Dispatch',
      message: 'Dispatch quantity may exceed available stock for the same material and plant.',
      evidence: { check: 'cross-system-stock-balance', rule: 'DISPATCH_STOCK_EXCEEDS' },
      businessKey: 'material+plant',
    },
  ];
};

export const runWorkbookPipeline = async (filePath: string): Promise<PipelineResult> => {
  const profile = await readWorkbook(filePath);
  const validation = validateWorkbookProfile(profile);
  const anomalies = validation.isValid ? buildSeedAnomalies() : [];

  const totalRows = profile.sheets.reduce((acc, sheet) => acc + sheet.rows.length, 0);

  return {
    sourceFile: filePath,
    sheetCount: profile.sheets.length,
    valid: validation.isValid,
    validationIssues: validation.issues,
    anomalies,
    summary: {
      totalSheets: profile.sheets.length,
      totalRows,
      totalAnomalies: anomalies.length,
      criticalAnomalies: anomalies.filter((item) => item.severity === 'critical').length,
    },
  };
};
