"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import { approvalItems, type ApprovalItem, type ApprovalStatus } from "@/data/approval-items"

type ApprovalState = Record<string, ApprovalItem>

type ApprovalContextValue = {
  items: ApprovalState
  updateApproval: (id: string, status: ApprovalStatus, comment?: string) => void
}

const initialState = approvalItems.reduce<ApprovalState>((state, item) => {
  state[item.id] = item
  return state
}, {})

const ApprovalContext = createContext<ApprovalContextValue | null>(null)

export function ApprovalProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [items, setItems] = useState<ApprovalState>(initialState)
  const updateApproval = useCallback((id: string, status: ApprovalStatus, comment?: string) => {
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
