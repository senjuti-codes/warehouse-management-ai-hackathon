export type ApprovalStatus = "Pending approval" | "Approved" | "Rejected"
export type ApprovalSeverity = "Critical" | "High" | "Medium"
export type TriageStatus = "not_triaged" | "pending_review" | "auto_fixed"

export type SolutionOption = {
  option: number
  title: string
  steps: string[]
  confidence: number
  effort: string
  approvalAuthority: string
}

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
  recommendationSource?: "deterministic-rule" | "llm"
  triageStatus?: TriageStatus
  autoFixConfidence?: number
  riskLevel?: "low" | "medium" | "high"
  executiveSummary?: string
  businessImpactDetail?: string
  solutionOptions?: SolutionOption[]
  recommendedOption?: number
  approvalChecklist?: string[]
}
