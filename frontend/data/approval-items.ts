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

export const approvalItems: ApprovalItem[] = [
  {
    id: "AN-2016",
    name: "Dispatch Quantity > Available Stock",
    severity: "Critical",
    category: "Inventory",
    recommendation: "Split delivery and trigger replenishment for the 60 EA shortfall.",
    confidence: 94,
    impact: "1 delivery at risk · 18 hr delay",
    detected: "Yesterday · 16:42",
    status: "Pending approval",
  },
  {
    id: "AN-2031",
    name: "Blocked Vendor on Open PO",
    severity: "High",
    category: "Procurement",
    recommendation: "Hold PO-78109 and request an approved vendor substitution.",
    confidence: 88,
    impact: "€18.4k order value exposed",
    detected: "2 hrs ago",
    status: "Pending approval",
  },
  {
    id: "AN-2041",
    name: "Expired Batch with Stock",
    severity: "Critical",
    category: "Inventory",
    recommendation: "Quarantine batch B-774 and remove it from delivery allocation.",
    confidence: 96,
    impact: "180 EA quality and compliance risk",
    detected: "41 min ago",
    status: "Pending approval",
  },
  {
    id: "AN-2039",
    name: "Bin Over-Allocation",
    severity: "High",
    category: "Warehouse capacity",
    recommendation: "Move 24% of planned stock to the adjacent available bin.",
    confidence: 93,
    impact: "Replenishment blocked in WH-02",
    detected: "52 min ago",
    status: "Pending approval",
  },
  {
    id: "AN-2034",
    name: "Overdue Goods Issue",
    severity: "Medium",
    category: "Dispatch",
    recommendation: "Escalate the unposted goods issue and refresh the delivery commitment.",
    confidence: 89,
    impact: "18 hr dispatch commitment risk",
    detected: "1 hr ago",
    status: "Approved",
  },
]
