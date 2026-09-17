export type SheetRow = Record<string, string | number | null>;

export interface WorkbookSheet {
  name: string;
  headers: string[];
  rows: SheetRow[];
}

export interface WorkbookProfile {
  sheets: WorkbookSheet[];
  sheetNames: string[];
  sourceFile: string;
}

export interface ValidationIssue {
  code: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  sheet: string;
  message: string;
  rowNumber?: number;
  field?: string;
}

export interface ValidationSummary {
  isValid: boolean;
  issues: ValidationIssue[];
  sheetStatus: Record<string, { exists: boolean; rowCount: number }>; 
}

export interface AnomalyFinding {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  sheet: string;
  message: string;
  evidence: Record<string, string | number | null>;
  businessKey?: string;
}

export interface PipelineResult {
  sourceFile: string;
  sheetCount: number;
  valid: boolean;
  validationIssues: ValidationIssue[];
  anomalies: AnomalyFinding[];
  summary: {
    totalSheets: number;
    totalRows: number;
    totalAnomalies: number;
    criticalAnomalies: number;
  };
}
