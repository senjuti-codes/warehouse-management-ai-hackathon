"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { type ApprovalItem, type ApprovalStatus, type SolutionOption, type TriageStatus } from "@/data/approval-items"

type ApprovalState = Record<string, ApprovalItem>

type ApprovalContextValue = {
  items: ApprovalState
  updateApproval: (id: string, status: ApprovalStatus, comment?: string) => void
  refresh: () => void
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

type BackendAnomaly = {
  id: number
  type: string
  severity: string
  message: string
  recommendation: string
  category: string
  confidence: number
  recommendation_source?: "deterministic-rule" | "llm"
  decision_status?: "approved" | "rejected"
  decision_comment?: string | null
  created_at?: string
  triage_status?: TriageStatus
  auto_fix_confidence?: number | null
  risk_level?: "low" | "medium" | "high" | null
  executive_summary?: string | null
  ai_business_impact?: string | null
  solution_options?: SolutionOption[] | null
  recommended_option?: number | null
  approval_checklist?: string[] | null
}

const toApprovalItem = (anomaly: BackendAnomaly): ApprovalItem => ({
  id: `AN-${anomaly.id}`,
  name: anomaly.message,
  severity: anomaly.severity.toLowerCase() === "critical" ? "Critical" : anomaly.severity.toLowerCase() === "high" ? "High" : "Medium",
  category: anomaly.category,
  recommendation: anomaly.recommendation,
  confidence: Math.round(anomaly.confidence * 100),
  impact: `Source: ${anomaly.type}`,
  detected: anomaly.created_at ? new Date(anomaly.created_at).toLocaleString() : "Recently",
  status: anomaly.decision_status === "approved" ? "Approved" : anomaly.decision_status === "rejected" ? "Rejected" : "Pending approval",
  comment: anomaly.decision_comment ?? undefined,
  recommendationSource: anomaly.recommendation_source ?? "deterministic-rule",
  triageStatus: anomaly.triage_status ?? "not_triaged",
  autoFixConfidence: anomaly.auto_fix_confidence ?? undefined,
  riskLevel: anomaly.risk_level ?? undefined,
  executiveSummary: anomaly.executive_summary ?? undefined,
  businessImpactDetail: anomaly.ai_business_impact ?? undefined,
  solutionOptions: anomaly.solution_options ?? undefined,
  recommendedOption: anomaly.recommended_option ?? undefined,
  approvalChecklist: anomaly.approval_checklist ?? undefined,
})

const ApprovalContext = createContext<ApprovalContextValue | null>(null)

export function ApprovalProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [items, setItems] = useState<ApprovalState>({})
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    let active = true
    fetch(`${apiBaseUrl}/api/anomalies`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Unable to load approvals")))
      .then((anomalies: BackendAnomaly[]) => {
        if (!active || !Array.isArray(anomalies)) return
        const liveItems = anomalies.reduce<ApprovalState>((state, anomaly) => {
          state[`AN-${anomaly.id}`] = toApprovalItem(anomaly)
          return state
        }, {})
        setItems(liveItems)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [refreshToken])

  const refresh = useCallback(() => setRefreshToken((token) => token + 1), [])

  const updateApproval = useCallback((id: string, status: ApprovalStatus, comment?: string) => {
    const anomalyId = Number(id.replace("AN-", ""))
    const decision = status === "Approved" ? "approved" : status === "Rejected" ? "rejected" : null
    if (Number.isInteger(anomalyId) && decision) {
      void fetch(`${apiBaseUrl}/api/anomalies/${anomalyId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: decision, comment }),
      }).catch(() => undefined)
    }
    setItems((current) => {
      const item = current[id]
      if (item?.status !== "Pending approval") return current
      return {
        ...current,
        [id]: {
          ...item,
          status,
          comment: comment?.trim() || item.comment,
        },
      }
    })
  }, [])

  const contextValue = useMemo(() => ({ items, updateApproval, refresh }), [items, updateApproval, refresh])

  return <ApprovalContext.Provider value={contextValue}>{children}</ApprovalContext.Provider>
}

function useApprovalContext() {
  const context = useContext(ApprovalContext)
  if (!context) throw new Error("Approval hooks must be used inside ApprovalProvider")
  return context
}

export function useApprovalItems() {
  return Object.values(useApprovalContext().items)
}

export function useApprovalDecision(id: string) {
  return useApprovalContext().items[id]?.status ?? "Pending approval"
}

export function useUpdateApproval() {
  return useApprovalContext().updateApproval
}

export function useRefreshApprovals() {
  return useApprovalContext().refresh
}
