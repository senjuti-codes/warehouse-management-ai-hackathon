"use client"

import { useState } from "react"
import {
  Bot,
  Database,
  Maximize2,
  Minimize2,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  Send,
  Sparkles,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { apiBaseUrl } from "@/lib/workbook-api"

type AssistantMode = "ask" | "view" | "edit" | "add"

type AssistantCard = {
  label: string
  value: string | number
}

type AssistantResponse = {
  success: boolean
  reply?: string
  message?: string
  aiMode?: "llm" | "deterministic"
  model?: string | null
  table?: string
  total?: number
  rows?: Array<Record<string, unknown>>
  row?: Record<string, unknown>
  cards?: AssistantCard[]
  tables?: string[]
  columns?: string[]
}

type ChatMessage = {
  role: "assistant" | "user"
  content: string
  aiMode?: "llm" | "deterministic"
  model?: string | null
  table?: string
  rows?: Array<Record<string, unknown>>
  cards?: AssistantCard[]
}

const starterPrompts = [
  "Show critical anomalies",
  "Inventory for MAT-100000",
  "Delivery DLV-800000",
  "Dispatch status",
] as const

const modeConfig = {
  ask: { label: "Ask", icon: MessageSquare },
  view: { label: "View", icon: Database },
  edit: { label: "Edit", icon: Pencil },
  add: { label: "Add", icon: Plus },
} as const

const fallbackTables = [
  "inventory_stock",
  "deliveries_dispatch",
  "material_master",
  "vendor_master",
  "warehouse_bin",
  "purchase_replenish",
]

const editableValuesFor = (row: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(row).filter(([key]) => !["id", "row_number", "created_at"].includes(key)),
  )

function RowPreview({
  rows,
  table,
  onUseRow,
}: Readonly<{
  rows: Array<Record<string, unknown>>
  table?: string
  onUseRow?: (row: Record<string, unknown>, table?: string) => void
}>) {
  if (!rows.length) return null

  return (
    <div className="mt-3 max-h-72 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
      {rows.slice(0, 6).map((row, index) => (
        <div key={`${String(row.id ?? index)}-${index}`} className="rounded-md bg-slate-50 p-2 text-[11px] text-slate-600">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="rounded-full bg-white px-2 py-0.5 font-medium text-[#0B4F4A] ring-1 ring-slate-200">
              {table ? `${table} · ` : ""}Row ID {String(row.id ?? index + 1)}
            </span>
            {onUseRow && table && row.id !== undefined && (
              <button
                type="button"
                onClick={() => onUseRow(row, table)}
                className="rounded-full bg-[#d8f36b] px-2 py-0.5 font-medium text-[#17211f] hover:bg-[#e5fa9d]"
              >
                Use row
              </button>
            )}
          </div>
          <div className="grid gap-x-4 gap-y-1 md:grid-cols-2">
          {Object.entries(row).slice(0, 10).map(([key, value]) => (
            <div key={key} className="grid min-w-0 grid-cols-[92px_1fr] gap-2">
              <span className="truncate font-medium text-slate-400">{key}</span>
              <span className="truncate" title={String(value ?? "")}>{String(value ?? "-")}</span>
            </div>
          ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function CardStrip({ cards }: Readonly<{ cards?: AssistantCard[] }>) {
  if (!cards?.length) return null

  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      {cards.map((card) => (
        <div key={card.label} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">{card.label}</p>
          <p className="mt-1 text-lg font-semibold text-[#17211f]">{card.value}</p>
        </div>
      ))}
    </div>
  )
}

const parseJsonObject = (value: string) => {
  const parsed = JSON.parse(value) as unknown
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Enter a JSON object like {\"status\":\"READY\"}.")
  }
  return parsed as Record<string, unknown>
}

export function WarehouseAssistant() {
  const [isOpen, setIsOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [mode, setMode] = useState<AssistantMode>("ask")
  const [message, setMessage] = useState("")
  const [table, setTable] = useState("inventory_stock")
  const [rowId, setRowId] = useState("")
  const [search, setSearch] = useState("")
  const [jsonValue, setJsonValue] = useState("{}")
  const [tables, setTables] = useState<string[]>(fallbackTables)
  const [columns, setColumns] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Ask about anomalies, inventory, deliveries, or use View/Edit/Add to work with workbook records.",
    },
  ])

  const callAssistant = async (payload: Record<string, unknown>) => {
    setIsLoading(true)
    try {
      const response = await fetch(`${apiBaseUrl}/api/assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await response.json() as AssistantResponse
      if (!response.ok || !data.success) throw new Error(data.message ?? "Assistant request failed.")
      if (data.tables?.length) setTables(data.tables)
      if (data.columns?.length) setColumns(data.columns)
      return data
    } finally {
      setIsLoading(false)
    }
  }

  const submitQuestion = async (nextMessage = message) => {
    const trimmed = nextMessage.trim()
    if (!trimmed || isLoading) return
    setMessages((current) => [...current, { role: "user", content: trimmed }])
    setMessage("")

    try {
      const data = await callAssistant({ action: "ask", message: trimmed })
      setMessages((current) => [
        ...current,
        { role: "assistant", content: data.reply ?? "Done.", aiMode: data.aiMode, model: data.model, table: data.table, rows: data.rows ?? [], cards: data.cards },
      ])
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", content: error instanceof Error ? error.message : "Assistant failed." }])
    }
  }

  const submitDataAction = async () => {
    if (isLoading) return

    try {
      const payload: Record<string, unknown> = { action: mode, table }
      if (mode === "view") {
        payload.search = search
        payload.limit = 20
      }
      if (mode === "edit") {
        payload.id = rowId
        payload.updates = parseJsonObject(jsonValue)
      }
      if (mode === "add") {
        payload.values = parseJsonObject(jsonValue)
      }

      const data = await callAssistant(payload)
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.reply ?? "Done.",
          table: data.table ?? table,
          rows: data.rows ?? (data.row ? [data.row] : []),
        },
      ])
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", content: error instanceof Error ? error.message : "Assistant failed." }])
    }
  }

  const findRowsForEditing = async () => {
    if (isLoading) return

    try {
      const data = await callAssistant({ action: "view", table, search, limit: 12 })
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `${data.reply ?? "Rows loaded."} Use a row below to fill the edit form automatically.`,
          table: data.table ?? table,
          rows: data.rows ?? [],
        },
      ])
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", content: error instanceof Error ? error.message : "Could not load rows." }])
    }
  }

  const useRowForEdit = (row: Record<string, unknown>, sourceTable = table) => {
    setMode("edit")
    setTable(sourceTable)
    setRowId(String(row.id ?? ""))
    setJsonValue(JSON.stringify(editableValuesFor(row), null, 2))
    setMessages((current) => [
      ...current,
      {
        role: "assistant",
        content: `Selected ${sourceTable} row ${String(row.id ?? "")}. Edit the values below, then click Edit data.`,
      },
    ])
  }

  const ActiveIcon = modeConfig[mode].icon
  const panelClassName = isExpanded
    ? "fixed inset-3 z-40 flex flex-col overflow-hidden rounded-2xl border border-white/70 bg-[#f8faf7] shadow-[0_28px_80px_rgba(23,33,31,0.22)] ring-1 ring-slate-900/5 xl:inset-y-5 xl:left-auto xl:right-5 xl:w-[min(1040px,calc(100vw-2.5rem))]"
    : "fixed bottom-20 right-5 z-40 flex max-h-[min(720px,calc(100vh-7rem))] w-[min(440px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-white/70 bg-[#f8faf7] shadow-[0_28px_80px_rgba(23,33,31,0.22)] ring-1 ring-slate-900/5"
  const bodyClassName = isExpanded && mode !== "ask"
    ? "grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_430px]"
    : "min-h-0 flex flex-1 flex-col"
  const chatClassName = isExpanded && mode !== "ask"
    ? "min-h-0 flex-1 space-y-3 overflow-y-auto p-5"
    : "min-h-[220px] flex-1 space-y-3 overflow-y-auto p-4"
  const formClassName = isExpanded && mode !== "ask"
    ? "shrink-0 overflow-y-auto border-t border-slate-200 bg-white p-5 lg:border-l lg:border-t-0"
    : "shrink-0 border-t border-slate-200 bg-white p-4"

  return (
    <>
      {!isOpen && (
        <Button
          type="button"
          size="lg"
          aria-label="Open LogiMind assistant"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-40 h-14 rounded-full bg-[#0B4F4A] px-4 text-white shadow-[0_18px_42px_rgba(11,79,74,0.38)] ring-4 ring-[#d8f36b]/25 hover:bg-[#093D38]"
        >
          <span className="relative grid size-8 place-items-center rounded-full bg-[#d8f36b] text-[#17211f]">
            <Bot className="size-5" />
            <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-orange-500 ring-2 ring-[#0B4F4A]" />
          </span>
          <span className="hidden text-sm font-semibold sm:inline">Ask LogiMind</span>
        </Button>
      )}

      {isOpen && (
        <section className={panelClassName}>
          <div className="bg-[#0B4F4A] p-5 text-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="size-4 text-[#d8f36b]" /> LogiMind Assistant
                </p>
                <p className="mt-1 text-xs text-white/60">Ask, inspect, edit, or add workbook data.</p>
              </div>
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setIsExpanded((current) => !current)} className="text-white hover:bg-white/10 hover:text-white">
                  {isExpanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
                  <span className="sr-only">{isExpanded ? "Collapse assistant" : "Expand assistant"}</span>
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setIsOpen(false)} className="text-white hover:bg-white/10 hover:text-white">
                  <X className="size-4" />
                </Button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {(Object.keys(modeConfig) as AssistantMode[]).map((item) => {
                const Icon = modeConfig[item].icon
                return (
                  <button
                    type="button"
                    key={item}
                    onClick={() => setMode(item)}
                    className={`flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${mode === item ? "bg-[#d8f36b] text-[#17211f]" : "bg-white/10 text-white/70 hover:bg-white/15 hover:text-white"}`}
                  >
                    <Icon className="size-3.5" /> {modeConfig[item].label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className={bodyClassName}>
          <div className={chatClassName}>
            {messages.map((item, index) => (
              <div key={`${item.role}-${index}`} className={item.role === "user" ? "ml-10" : "mr-6"}>
                <div className={`rounded-2xl px-3 py-2 text-sm ${item.role === "user" ? "bg-[#0B4F4A] text-white" : "bg-white text-slate-700 shadow-sm"}`}>
                  {item.content}
                  {item.role === "assistant" && item.aiMode && (
                    <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-slate-400">
                      {item.aiMode === "llm" ? `AI answer${item.model ? ` · ${item.model}` : ""}` : "Rules answer"}
                    </p>
                  )}
                  <CardStrip cards={item.cards} />
                  <RowPreview rows={item.rows ?? []} table={item.table} onUseRow={useRowForEdit} />
                </div>
              </div>
            ))}
          </div>

          <div className={formClassName}>
            {mode === "ask" ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {starterPrompts.map((prompt) => (
                    <button
                      type="button"
                      key={prompt}
                      onClick={() => void submitQuestion(prompt)}
                      className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-500 hover:border-[#d8f36b] hover:text-[#17211f]"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
                <form
                  className="flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void submitQuestion()
                  }}
                >
                  <Input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask about stock, anomalies, dispatch..." className="border-slate-200" />
                  <Button type="submit" disabled={isLoading || !message.trim()} className="bg-[#0B4F4A] text-white hover:bg-[#093D38]">
                    {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  </Button>
                </form>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid gap-2 md:grid-cols-2">
                  <Select value={table} onValueChange={(nextValue) => { setTable(nextValue ?? "inventory_stock"); setColumns([]); setRowId(""); setJsonValue("{}") }}>
                    <SelectTrigger aria-label="Assistant table" className="w-full border-slate-200 bg-white">
                      <span data-slot="select-value" className="flex flex-1 text-left">{table}</span>
                    </SelectTrigger>
                    <SelectContent>
                      {tables.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {mode === "edit" && <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search row first" className="border-slate-200" />}
                  {mode === "view" && <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Optional search" className="border-slate-200" />}
                </div>
                {mode === "edit" && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    First search rows in <strong>{table}</strong>, then click <strong>Use row</strong>. The row id and editable values will fill in automatically.
                  </div>
                )}
                {mode === "add" && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                    New data will be added to <strong>{table}</strong>. After saving, the exact inserted row and row id will appear in the chat.
                  </div>
                )}
                {(mode === "edit" || mode === "add") && (
                  <Button type="button" variant="outline" size="sm" onClick={findRowsForEditing} disabled={isLoading} className="w-fit border-slate-200 bg-white text-xs">
                    <Database className="size-3.5" /> {mode === "edit" ? "Find rows to edit" : "Show columns / recent rows"}
                  </Button>
                )}
                {mode === "edit" && rowId && (
                  <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    Editing <strong>{table}</strong> row <strong>{rowId}</strong>
                  </div>
                )}
                {(mode === "edit" || mode === "add") && (
                  <div>
                    <Textarea value={jsonValue} onChange={(event) => setJsonValue(event.target.value)} className="min-h-28 max-h-48 border-slate-200 font-mono text-xs" placeholder='{"status":"READY"}' />
                    <p className="mt-1 text-[11px] text-slate-400">
                      {mode === "add" ? `Adds a new row to the selected backend table: ${table}. The inserted row appears in chat after saving.` : "Updates the selected backend table row by id."}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {columns.length ? `Editable columns: ${columns.slice(0, 6).join(", ")}${columns.length > 6 ? "..." : ""}` : "Use a JSON object with workbook column names."}
                    </p>
                  </div>
                )}
                <Button onClick={submitDataAction} disabled={isLoading || (mode === "edit" && !rowId.trim())} className="w-full bg-[#0B4F4A] text-white hover:bg-[#093D38]">
                  {isLoading ? <Loader2 className="size-4 animate-spin" /> : <ActiveIcon className="size-4" />}
                  {modeConfig[mode].label} data
                </Button>
              </div>
            )}
          </div>
          </div>
        </section>
      )}
    </>
  )
}