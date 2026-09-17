"use client"

import { useState } from "react"
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
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
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const severityStyles = {
  Critical: "border-red-200 bg-red-50 text-red-700",
  High: "border-orange-200 bg-orange-50 text-orange-700",
  Medium: "border-amber-200 bg-amber-50 text-amber-700",
  Low: "border-slate-200 bg-slate-50 text-slate-600",
} as const

const statusStyles = {
  Open: "border-red-200 bg-red-50 text-red-700",
  Investigating: "border-blue-200 bg-blue-50 text-blue-700",
  "Pending approval": "border-amber-200 bg-amber-50 text-amber-700",
  Resolved: "border-emerald-200 bg-emerald-50 text-emerald-700",
} as const

const anomalyData = [
  { id: "AN-2048", name: "Missing Base UoM", category: "Master data", source: "Material_Master", location: "Material M-4421", confidence: 98, severity: "Critical", status: "Open", detected: "12 min ago", description: "Material M-4421 has no base unit of measure, which blocks reliable stock and replenishment calculations.", recommendation: "Assign the approved base UoM and revalidate dependent inventory records." },
  { id: "AN-2045", name: "Negative On-Hand", category: "Inventory", source: "Inventory_Stock", location: "WH-03 / A-14", confidence: 97, severity: "Critical", status: "Investigating", detected: "28 min ago", description: "The recorded quantity for material M-8821 is below zero after the latest goods issue.", recommendation: "Review the last goods movement and reconcile the bin balance before the next dispatch." },
  { id: "AN-2041", name: "Expired Batch with Stock", category: "Inventory", source: "Inventory_Stock", location: "WH-01 / C-22", confidence: 96, severity: "Critical", status: "Open", detected: "41 min ago", description: "Batch B-774 has passed its expiry date while 180 units remain available for allocation.", recommendation: "Quarantine the batch and prevent it from being included in open delivery allocations." },
  { id: "AN-2039", name: "Bin Over-Allocation", category: "Warehouse capacity", source: "Warehouse_Bin", location: "WH-02 / B-09", confidence: 93, severity: "Critical", status: "Pending approval", detected: "52 min ago", description: "Planned stock exceeds the configured capacity of bin B-09 by 24%.", recommendation: "Move the suggested quantity to the adjacent available bin before replenishment." },
  { id: "AN-2037", name: "Missing Route", category: "Dispatch", source: "Deliveries_Dispatch", location: "Delivery D-10882", confidence: 91, severity: "High", status: "Open", detected: "1 hr ago", description: "An open delivery has no route assignment despite a requested ship date today.", recommendation: "Assign a validated route and confirm dock capacity with the dispatch team." },
  { id: "AN-2034", name: "Overdue Goods Issue", category: "Dispatch", source: "Deliveries_Dispatch", location: "WH-01 / Dock 07", confidence: 89, severity: "High", status: "Investigating", detected: "1 hr ago", description: "The goods issue is 18 hours past its planned posting time and has not been confirmed.", recommendation: "Escalate to the warehouse supervisor and refresh the delivery commitment." },
  { id: "AN-2031", name: "Orphan Vendor on PO", category: "Procurement", source: "Purchase_Replenish", location: "PO-78321", confidence: 87, severity: "High", status: "Open", detected: "2 hrs ago", description: "Purchase order PO-78321 references vendor V-018, which is missing from the current vendor master.", recommendation: "Validate the vendor record before releasing the order for fulfillment." },
  { id: "AN-2028", name: "Zero/Missing Price", category: "Master data", source: "Material_Master", location: "Material M-1180", confidence: 84, severity: "Medium", status: "Pending approval", detected: "3 hrs ago", description: "The material has a missing or zero valuation price in the active master record.", recommendation: "Request the current price from procurement and update the material record." },
  { id: "AN-2024", name: "Blocked Vendor on Open PO", category: "Procurement", source: "Vendor_Master", location: "PO-78109 / V-044", confidence: 82, severity: "Medium", status: "Investigating", detected: "4 hrs ago", description: "An open purchase order is assigned to a vendor marked as blocked for purchasing.", recommendation: "Hold the order and confirm whether an approved vendor substitution is required." },
  { id: "AN-2020", name: "Orphan Material Across Sheets", category: "Data integrity", source: "Material_Master", location: "Material M-9024", confidence: 76, severity: "Medium", status: "Open", detected: "5 hrs ago", description: "Material M-9024 appears in inventory data but cannot be found in the material master.", recommendation: "Create or restore the master record before relying on its stock position." },
  { id: "AN-2016", name: "Dispatch Quantity > Available Stock", category: "Inventory", source: "Deliveries_Dispatch", location: "Delivery D-10744", confidence: 68, severity: "Low", status: "Resolved", detected: "Yesterday", description: "The requested dispatch quantity exceeded the last available stock snapshot.", recommendation: "Confirm the latest inventory movement and update the delivery quantity if needed." },
] as const

type Anomaly = (typeof anomalyData)[number]
type Severity = keyof typeof severityStyles

function SeverityBadge({ severity }: Readonly<{ severity: Severity }>) {
  return <Badge variant="outline" className={severityStyles[severity]}><span className="size-1.5 rounded-full bg-current" />{severity}</Badge>
}

function StatusBadge({ status }: Readonly<{ status: keyof typeof statusStyles }>) {
  return <Badge variant="outline" className={statusStyles[status]}>{status === "Resolved" && <Check className="size-3" />}{status}</Badge>
}

function SummaryCard({ label, value, detail, icon: Icon, tone }: Readonly<{ label: string; value: string; detail: string; icon: typeof CircleAlert; tone: string }>) {
  return <Card className="border-0 bg-white shadow-[0_2px_12px_rgba(23,33,31,0.04)]"><CardContent className="p-5"><div className="flex items-start justify-between"><div><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight text-[#17211f]">{value}</p><p className="mt-2 text-xs text-slate-400">{detail}</p></div><div className={`flex size-9 items-center justify-center rounded-lg ${tone}`}><Icon className="size-4" /></div></div></CardContent></Card>
}

function AnomalyDetails({ anomaly, onClose }: Readonly<{ anomaly: Anomaly | null; onClose: () => void }>) {
  return <Dialog open={Boolean(anomaly)} onOpenChange={(open) => !open && onClose()}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader className="border-b border-slate-100 pb-4"><div className="mb-3 flex items-center gap-2"><SeverityBadge severity={(anomaly?.severity ?? "Low") as Severity} /><StatusBadge status={(anomaly?.status ?? "Open") as keyof typeof statusStyles} /></div><DialogTitle className="text-xl text-[#17211f]">{anomaly?.name}</DialogTitle><DialogDescription>{anomaly?.id} · Detected {anomaly?.detected}</DialogDescription></DialogHeader>{anomaly && <div className="space-y-5 py-1"><div className="grid grid-cols-2 gap-4 sm:grid-cols-4"><div><p className="text-[11px] uppercase tracking-wide text-slate-400">Confidence</p><p className="mt-1 font-semibold text-[#17211f]">{anomaly.confidence}%</p></div><div><p className="text-[11px] uppercase tracking-wide text-slate-400">Category</p><p className="mt-1 text-sm font-medium">{anomaly.category}</p></div><div><p className="text-[11px] uppercase tracking-wide text-slate-400">Source</p><p className="mt-1 truncate text-sm font-medium">{anomaly.source}</p></div><div><p className="text-[11px] uppercase tracking-wide text-slate-400">Location</p><p className="mt-1 text-sm font-medium">{anomaly.location}</p></div></div><div className="rounded-lg border border-slate-200 bg-slate-50 p-4"><div className="flex gap-3"><AlertCircle className="mt-0.5 size-4 shrink-0 text-orange-600" /><div><p className="text-sm font-medium text-[#17211f]">Why this was flagged</p><p className="mt-1 text-sm leading-6 text-slate-600">{anomaly.description}</p></div></div></div><div className="rounded-lg border border-[#d8f36b]/70 bg-[#f5fbdc] p-4"><div className="flex gap-3"><Sparkles className="mt-0.5 size-4 shrink-0 text-[#667d16]" /><div><p className="text-sm font-medium text-[#35420d]">Recommended next step</p><p className="mt-1 text-sm leading-6 text-[#56651d]">{anomaly.recommendation}</p></div></div></div></div>}<DialogFooter><DialogClose render={<Button variant="outline" />}>Close</DialogClose><Button className="bg-[#17211f] text-white hover:bg-[#263632]"><ArrowUpRight /> Open workflow</Button></DialogFooter></DialogContent></Dialog>
}

function FilterSelect({ label, value, onValueChange, options }: Readonly<{ label: string; value: string; onValueChange: (value: string) => void; options: readonly string[] }>) {
  return <Select value={value} onValueChange={(nextValue) => onValueChange(nextValue ?? "all")}><SelectTrigger aria-label={label} className="w-full border-slate-200 bg-white sm:w-[150px]"><SelectValue placeholder={label} /></SelectTrigger><SelectContent><SelectItem value="all">{label}: All</SelectItem>{options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select>
}

export function AnomalyCenter() {
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null)
  const [search, setSearch] = useState("")
  const [severity, setSeverity] = useState("all")
  const [category, setCategory] = useState("all")
  const [source, setSource] = useState("all")
  const [status, setStatus] = useState("all")
  const categories = ["Master data", "Inventory", "Warehouse capacity", "Dispatch", "Procurement", "Data integrity"]
  const sources = ["Material_Master", "Inventory_Stock", "Warehouse_Bin", "Deliveries_Dispatch", "Purchase_Replenish", "Vendor_Master"]
  const statuses = ["Open", "Investigating", "Pending approval", "Resolved"]
  const filteredAnomalies = anomalyData.filter((anomaly) => {
    const query = search.toLowerCase()
    return (!query || [anomaly.name, anomaly.id, anomaly.location, anomaly.source].some((value) => value.toLowerCase().includes(query))) && (severity === "all" || anomaly.severity === severity) && (category === "all" || anomaly.category === category) && (source === "all" || anomaly.source === source) && (status === "all" || anomaly.status === status)
  })

  return <div className="flex min-h-screen bg-[#f4f6f3] font-sans text-[#17211f]"><Sidebar activeLabel="Anomaly Queue" /><main className="min-w-0 flex-1"><header className="flex h-20 items-center justify-between border-b border-slate-200/80 bg-[#f8faf7] px-5 sm:px-8"><div className="flex items-center gap-3"><Button variant="ghost" size="icon" className="lg:hidden"><Menu /></Button><div><p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Operations workspace</p><h1 className="mt-1 text-xl font-semibold tracking-tight">Anomaly Center</h1></div></div><div className="flex items-center gap-3"><div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex"><span className="size-2 rounded-full bg-emerald-500" /> Live data feed</div><div className="flex size-8 items-center justify-center rounded-full bg-[#d8f36b] text-xs font-bold text-[#17211f]">AS</div></div></header><div className="mx-auto max-w-[1500px] space-y-6 p-5 sm:p-8"><section><div className="mb-2 flex items-center gap-2 text-xs font-medium text-emerald-700"><span className="size-1.5 rounded-full bg-emerald-500" /> DETECTION & INVESTIGATION</div><h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Anomaly Center</h2><p className="mt-1 text-sm text-slate-500">Detect, investigate, and prioritize warehouse and logistics risks.</p></section><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><SummaryCard label="Total anomalies" value={String(anomalyData.length)} detail="Across all connected sources" icon={CircleAlert} tone="bg-slate-100 text-slate-600" /><SummaryCard label="Critical" value={String(anomalyData.filter((item) => item.severity === "Critical").length).padStart(2, "0")} detail="Immediate attention required" icon={ShieldAlert} tone="bg-red-50 text-red-600" /><SummaryCard label="High" value={String(anomalyData.filter((item) => item.severity === "High").length).padStart(2, "0")} detail="Review within today" icon={AlertCircle} tone="bg-orange-50 text-orange-600" /><SummaryCard label="Medium" value={String(anomalyData.filter((item) => item.severity === "Medium").length).padStart(2, "0")} detail="Monitor and investigate" icon={Clock3} tone="bg-amber-50 text-amber-600" /></section><Card className="border-0 bg-white shadow-[0_2px_12px_rgba(23,33,31,0.04)]"><CardContent className="p-4"><div className="mb-4 flex items-center gap-2 text-sm font-medium text-[#17211f]"><Filter className="size-4 text-slate-400" /> Filter anomalies</div><div className="grid gap-3 sm:grid-cols-2 xl:flex xl:items-center"><div className="relative min-w-0 flex-1 xl:max-w-xs"><Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search anomaly" className="h-8 border-slate-200 pl-9" />{search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"><X className="size-3.5" /></button>}</div><FilterSelect label="Severity" value={severity} onValueChange={setSeverity} options={["Critical", "High", "Medium", "Low"]} /><FilterSelect label="Category" value={category} onValueChange={setCategory} options={categories} /><FilterSelect label="Source" value={source} onValueChange={setSource} options={sources} /><FilterSelect label="Status" value={status} onValueChange={setStatus} options={statuses} /></div></CardContent></Card><Card className="border-0 bg-white shadow-[0_2px_12px_rgba(23,33,31,0.04)]"><CardContent className="p-0"><div className="flex flex-col justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center"><div><h3 className="text-base font-semibold">Priority anomaly queue</h3><p className="mt-1 text-xs text-slate-400">{filteredAnomalies.length} of {anomalyData.length} anomalies shown</p></div><Button variant="outline" size="sm" className="w-fit border-slate-200 text-xs"><ArrowUpRight /> Export view</Button></div><Table><TableHeader><TableRow className="hover:bg-transparent"><TableHead>Anomaly</TableHead><TableHead>Anomaly ID</TableHead><TableHead>Category</TableHead><TableHead>Source</TableHead><TableHead>Location</TableHead><TableHead>Confidence</TableHead><TableHead>Severity</TableHead><TableHead>Status</TableHead><TableHead>Detected</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>{filteredAnomalies.map((anomaly) => <TableRow key={anomaly.id} className="group"><TableCell><button type="button" onClick={() => setSelectedAnomaly(anomaly)} className="text-left"><span className="font-medium text-[#17211f] group-hover:text-emerald-700">{anomaly.name}</span><span className="mt-1 block max-w-[170px] truncate text-[11px] text-slate-400 sm:hidden">{anomaly.location}</span></button></TableCell><TableCell className="font-mono text-xs text-slate-500">{anomaly.id}</TableCell><TableCell className="text-xs text-slate-500">{anomaly.category}</TableCell><TableCell className="text-xs text-slate-500">{anomaly.source}</TableCell><TableCell className="text-xs text-slate-500">{anomaly.location}</TableCell><TableCell className="text-xs font-medium text-slate-600">{anomaly.confidence}%</TableCell><TableCell><SeverityBadge severity={anomaly.severity} /></TableCell><TableCell><StatusBadge status={anomaly.status} /></TableCell><TableCell className="whitespace-nowrap text-xs text-slate-400">{anomaly.detected}</TableCell><TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => setSelectedAnomaly(anomaly)} className="text-xs text-slate-500">Review <ChevronRight /></Button></TableCell></TableRow>)}</TableBody></Table>{filteredAnomalies.length === 0 && <div className="px-5 py-14 text-center"><CircleAlert className="mx-auto size-7 text-slate-300" /><p className="mt-3 text-sm font-medium text-slate-600">No anomalies match these filters</p><p className="mt-1 text-xs text-slate-400">Try clearing a filter or broadening your search.</p></div>}</CardContent></Card></div></main><AnomalyDetails anomaly={selectedAnomaly} onClose={() => setSelectedAnomaly(null)} /></div>
}
