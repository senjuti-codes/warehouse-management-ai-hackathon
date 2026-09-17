import { spawn } from 'node:child_process';
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

const normalizeSheet = (sheetName: string, rows: unknown[][]): WorkbookSheet => {
  const headers = Array.isArray(rows[0]) ? rows[0].map((value) => String(value ?? '').trim()) : [];
  const dataRows = rows.slice(1).map((row: unknown[], rowIndex: number) => {
    const record: Record<string, string | number | null> = {};
    headers.forEach((header, headerIndex) => {
      const value = row[headerIndex];
      record[header] = value === undefined || value === null ? null : String(value).trim();
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
  const script = `
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $workbook = $excel.Workbooks.Open('${filePath.replace(/'/g, "''")}')
  $result = @()
  foreach ($ws in $workbook.Worksheets) {
    $used = $ws.UsedRange
    $maxR = $used.Rows.Count
    $maxC = $used.Columns.Count
    $rows = @()
    for ($r = 1; $r -le $maxR; $r++) {
      $row = @()
      for ($c = 1; $c -le $maxC; $c++) {
        $value = $used.Cells.Item($r, $c).Text
        $row += $value
      }
      $rows += , $row
    }
    $result += [PSCustomObject]@{
      name = $ws.Name
      rows = $rows
    }
  }
  $workbook.Close($false)
  $excel.Quit()
  [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
  $result | ConvertTo-Json -Depth 10 -Compress
  `;

  const powershell = process.env.POWERSHELL_EXE ?? 'powershell';

  return await new Promise((resolve, reject) => {
    const child = spawn(powershell, ['-NoProfile', '-Command', script], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Workbook read failed with exit code ${code}: ${stderr || 'No stderr output'}`));
        return;
      }

      try {
        const parsed = JSON.parse(stdout) as Array<{ name: string; rows: unknown[][] }>;
        const sheets = parsed
          .filter((sheet) => sheet && typeof sheet.name === 'string')
          .map((sheet) => normalizeSheet(sheet.name, sheet.rows ?? []));

        const missing = REQUIRED_SHEETS.filter((name) => !sheets.some((sheet) => sheet.name === name));

        if (missing.length > 0) {
          throw new Error(`Missing required workbook sheets: ${missing.join(', ')}`);
        }

        resolve({
          sheets,
          sheetNames: sheets.map((sheet) => sheet.name),
          sourceFile: filePath,
        });
      } catch (error) {
        reject(error);
      }
    });
  });
};
