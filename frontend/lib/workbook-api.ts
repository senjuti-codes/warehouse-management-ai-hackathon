const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

export type WorkbookRow = Record<string, string | number | null>

export async function fetchWorkbookTable(table: string) {
  const response = await fetch(`${apiBaseUrl}/api/workbook/${table}`)
  if (!response.ok) throw new Error(`Unable to load workbook table: ${table}`)
  return (await response.json()) as { rows: WorkbookRow[]; total: number }
}

export { apiBaseUrl }
