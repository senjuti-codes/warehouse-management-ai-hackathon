export type ApprovalStatus = "Pending approval" | "Approved" | "Rejected"
export type ApprovalSeverity = "Critical" | "High" | "Medium"

export type ApprovalItem = {
  id: string
  name: string
  severity: ApprovalSeverity
  category: string
  recommendation: string
  confidence: number
  impact: string
  detected: string
  status: ApprovalStatus
  comment?: string
}
