"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { type ApprovalItem, type ApprovalStatus } from "@/data/approval-items"

type ApprovalState = Record<string, ApprovalItem>

type ApprovalContextValue = {
  items: ApprovalState
  updateApproval: (id: string, status: ApprovalStatus, comment?: string) => void
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
})

const ApprovalContext = createContext<ApprovalContextValue | null>(null)

export function ApprovalProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [items, setItems] = useState<ApprovalState>({})
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
  }, [])

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

  const contextValue = useMemo(() => ({ items, updateApproval }), [items, updateApproval])

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
