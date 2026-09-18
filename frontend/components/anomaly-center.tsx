"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  Filter,
  Menu,
  Search,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react"
import { Sidebar } from "@/components/control-tower-dashboard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type LiveAnomaly = {
  id: number
  type: string
  severity: string
  sheet: string
  message: string
  recommendation: string
  category: string
  confidence: number
  decision_status?: string
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

const severityStyles = {
  critical: {
    label: "Critical",
    marker: "🔥",
    className: "border-red-200 bg-red-50 text-red-700",
  },
  high: {
    label: "High",
    marker: "⚠️",
    className: "border-orange-200 bg-orange-50 text-orange-700",
  },
  medium: {
    label: "Medium",
    marker: "🟡",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  low: {
    label: "Low",
    marker: "✅",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
} as const

const decisionStyles = {
  approved: {
    label: "Approved",
    marker: "✅",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  rejected: {
    label: "Rejected",
    marker: "✕",
    className: "border-red-200 bg-red-50 text-red-700",
  },
  pending: {
    label: "Pending review",
    marker: "⏳",
    className: "border-slate-200 bg-slate-50 text-slate-600",
  },
} as const

function SummaryCard({
  label,
  value,
  detail,
  icon: Icon,
}: Readonly<{
  label: string
  value: string
  detail: string
  icon: typeof AlertCircle
}>) {
  return (
    <Card className="border-0 bg-white shadow-sm card-hover">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-[#17211f]">
              {value}
            </p>
            <p className="mt-2 text-xs text-slate-400">{detail}</p>
          </div>
          <Icon className="size-5 text-slate-400" />
        </div>
      </CardContent>
    </Card>
  )
}

function SeverityBadge({ severity }: Readonly<{ severity: string }>) {
  const key = severity.toLowerCase() as keyof typeof severityStyles
  const style = severityStyles[key] ?? severityStyles.medium

  return (
    <Badge variant="outline" className={style.className}>
      <span aria-hidden="true">{style.marker}</span>
      {style.label}
    </Badge>
  )
}

function DecisionBadge({ status }: Readonly<{ status?: string }>) {
  const key = (status ?? "pending").toLowerCase() as keyof typeof decisionStyles
  const style = decisionStyles[key] ?? decisionStyles.pending

  return (
    <Badge variant="outline" className={style.className}>
      <span aria-hidden="true">{style.marker}</span>
      {style.label}
    </Badge>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: Readonly<{
  label: string
  value: string
  onChange: (value: string) => void
  options: readonly { value: string; label: string }[]
}>) {
  const selectedLabel = options.find((option) => option.value === value)?.label ?? label

  return (
    <Select value={value} onValueChange={(nextValue) => onChange(nextValue ?? "all")}>
      <SelectTrigger
        aria-label={label}
        className="w-full border-slate-200 bg-white sm:w-[180px]"
      >
        <span data-slot="select-value" className="flex flex-1 text-left">
          {selectedLabel}
        </span>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem value={option.value} key={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function AnomalyCenter() {
  const [anomalies, setAnomalies] = useState<LiveAnomaly[]>([])
  const [search, setSearch] = useState("")
  const [severity, setSeverity] = useState("all")
  const [category, setCategory] = useState("all")
  const [decisionStatus, setDecisionStatus] = useState("all")
  const [minimumConfidence, setMinimumConfidence] = useState("all")
  const [showFilters, setShowFilters] = useState(false)
  const [selected, setSelected] = useState<LiveAnomaly | null>(null)

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      fetch(`${apiBaseUrl}/api/anomalies`)
        .then((response) =>
          response.ok
            ? response.json()
            : Promise.reject(new Error("Unable to load anomalies")),
        )
        .then((rows: LiveAnomaly[]) =>
          setAnomalies(Array.isArray(rows) ? rows : []),
        )
        .catch(() => setAnomalies([]))
    }, 0)

    return () => window.clearTimeout(loadTimer)
  }, [])

  const categories = useMemo(
    () =>
      Array.from(
        new Set(anomalies.map((anomaly) => anomaly.category).filter(Boolean)),
      ).sort(),
    [anomalies],
  )

  const filtered = useMemo(
    () =>
      anomalies.filter((anomaly) => {
        const query = search.toLowerCase()
        const confidenceLimit = minimumConfidence === "all" ? 0 : Number(minimumConfidence)
        const status = anomaly.decision_status ?? "pending"

        return (
          (!query ||
            [anomaly.message, anomaly.type, anomaly.sheet, String(anomaly.id)].some((value) =>
              value.toLowerCase().includes(query),
            )) &&
          (severity === "all" || anomaly.severity === severity) &&
          (category === "all" || anomaly.category === category) &&
          (decisionStatus === "all" || status === decisionStatus) &&
          Number(anomaly.confidence ?? 0) >= confidenceLimit
        )
      }),
    [anomalies, category, decisionStatus, minimumConfidence, search, severity],
  )

  const critical = anomalies.filter((item) => item.severity === "critical").length
  const high = anomalies.filter((item) => item.severity === "high").length
  const activeFilterCount = [
    severity !== "all",
    category !== "all",
    decisionStatus !== "all",
    minimumConfidence !== "all",
  ].filter(Boolean).length

  const clearFilters = () => {
    setSeverity("all")
    setCategory("all")
    setDecisionStatus("all")
    setMinimumConfidence("all")
  }

  return (
    <div className="flex min-h-screen bg-[#f4f6f3] font-sans text-[#17211f]">
      <Sidebar activeLabel="Anomaly Queue" />
      <main className="min-w-0 flex-1">
        <header className="flex h-20 items-center justify-between border-b border-slate-200/80 bg-[#f8faf7] px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden">
              <Menu />
            </Button>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                Operations workspace
              </p>
              <h1 className="mt-1 text-xl font-semibold">Anomaly Center</h1>
            </div>
          </div>
          <span className="text-xs text-slate-500">Workbook-backed feed</span>
        </header>

        <div className="mx-auto max-w-[1500px] space-y-6 p-5 sm:p-8">
          <section>
            <h2 className="text-2xl font-semibold sm:text-3xl">Anomaly Center</h2>
            <p className="mt-1 text-sm text-slate-500">
              Detected directly from the latest workbook ingestion.
            </p>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Total anomalies"
              value={String(anomalies.length)}
              detail="Current workbook run"
              icon={AlertCircle}
            />
            <SummaryCard
              label="Critical"
              value={String(critical)}
              detail="Immediate attention"
              icon={ShieldAlert}
            />
            <SummaryCard
              label="High"
              value={String(high)}
              detail="Review required"
              icon={AlertCircle}
            />
            <SummaryCard
              label="Recommendations"
              value={String(anomalies.filter((item) => Boolean(item.recommendation)).length)}
              detail="Deterministic actions"
              icon={Sparkles}
            />
          </section>

          <section className="space-y-3">
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  aria-label="Search anomalies"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search workbook anomalies"
                  className="h-8 border-slate-200 pl-9"
                />
              </div>
            </div>

            <Card className="border-0 bg-white shadow-sm card-hover">
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle>Live anomaly queue</CardTitle>
                    <p className="mt-1 text-xs text-slate-400">
                      {filtered.length} of {anomalies.length} records shown
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Toggle anomaly filters"
                    aria-expanded={showFilters}
                    onClick={() => setShowFilters((current) => !current)}
                    className="relative text-slate-500"
                  >
                    <Filter />
                    {activeFilterCount > 0 && (
                      <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-orange-500 text-[10px] font-semibold text-white">
                        {activeFilterCount}
                      </span>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {showFilters && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <FilterSelect
                          label="Severity"
                          value={severity}
                          onChange={setSeverity}
                          options={[
                            { value: "all", label: "Severity: All" },
                            { value: "critical", label: "Critical" },
                            { value: "high", label: "High" },
                            { value: "medium", label: "Medium" },
                            { value: "low", label: "Low" },
                          ]}
                        />
                        <FilterSelect
                          label="Category"
                          value={category}
                          onChange={setCategory}
                          options={[
                            { value: "all", label: "Category: All" },
                            ...categories.map((item) => ({ value: item, label: item })),
                          ]}
                        />
                        <FilterSelect
                          label="Decision status"
                          value={decisionStatus}
                          onChange={setDecisionStatus}
                          options={[
                            { value: "all", label: "Decision: All" },
                            { value: "pending", label: "Pending review" },
                            { value: "approved", label: "Approved" },
                            { value: "rejected", label: "Rejected" },
                          ]}
                        />
                        <FilterSelect
                          label="Minimum confidence"
                          value={minimumConfidence}
                          onChange={setMinimumConfidence}
                          options={[
                            { value: "all", label: "Confidence: All" },
                            { value: "70", label: "70% and above" },
                            { value: "80", label: "80% and above" },
                            { value: "90", label: "90% and above" },
                          ]}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={activeFilterCount === 0}
                        onClick={clearFilters}
                        className="w-fit border-slate-200 bg-white text-xs"
                      >
                        <X className="size-3.5" /> Clear filters
                      </Button>
                    </div>
                  </div>
                )}

                <div className="max-h-[520px] overflow-auto rounded-lg border border-slate-100">
                  <Table className="min-w-[980px] table-fixed">
                    <TableHeader className="sticky top-0 z-10 bg-white shadow-[0_1px_0_rgba(226,232,240,0.9)]">
                      <TableRow>
                        <TableHead className="w-[42%]">Issue</TableHead>
                        <TableHead className="w-[18%]">Source</TableHead>
                        <TableHead className="w-[14%]">Severity</TableHead>
                        <TableHead className="w-[16%]">Recommendation</TableHead>
                        <TableHead className="w-[10%]">Decision</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((anomaly) => (
                        <TableRow
                          key={anomaly.id}
                          className="cursor-pointer"
                          onClick={() => setSelected(anomaly)}
                        >
                          <TableCell className="whitespace-normal">
                            <p className="font-medium">{anomaly.message}</p>
                            <p className="font-mono text-xs text-slate-400">
                              AN-{anomaly.id} - {anomaly.type}
                            </p>
                          </TableCell>
                          <TableCell className="truncate text-sm text-slate-500" title={anomaly.sheet}>
                            {anomaly.sheet}
                          </TableCell>
                          <TableCell>
                            <SeverityBadge severity={anomaly.severity} />
                          </TableCell>
                          <TableCell className="truncate text-sm text-slate-600" title={anomaly.recommendation}>
                            {anomaly.recommendation}
                          </TableCell>
                          <TableCell>
                            <DecisionBadge status={anomaly.decision_status} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {filtered.length === 0 && (
                    <p className="py-10 text-center text-sm text-slate-400">
                      No workbook anomalies match the current filters.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>

      {selected && (
        <Card className="fixed inset-x-4 bottom-4 z-20 border-slate-200 bg-white shadow-xl card-hover sm:left-auto sm:right-6 sm:w-[420px]">
          <CardHeader>
            <CardTitle>{selected.message}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">{selected.recommendation}</p>
            <Button className="mt-4" onClick={() => setSelected(null)}>
              Close
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}