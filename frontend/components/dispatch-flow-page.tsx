"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Filter,
  Menu,
  PackageCheck,
  Search,
  Sparkles,
  Truck,
  Warehouse,
  Boxes,
} from "lucide-react";
import { type DispatchRecord, type DispatchRisk, type DispatchStatus } from "@/data/dispatch-flow";
import { fetchWorkbookTable } from "@/lib/workbook-api";
import { Sidebar } from "@/components/control-tower-dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const statusClasses: Record<DispatchStatus, string> = {
  "At risk": "border-red-200 bg-red-50 text-red-700",
  "In transit": "border-blue-200 bg-blue-50 text-blue-700",
  "On schedule": "border-emerald-200 bg-emerald-50 text-emerald-700",
  Delayed: "border-orange-200 bg-orange-50 text-orange-700",
  Ready: "border-slate-200 bg-slate-50 text-slate-600",
};
const riskClasses: Record<DispatchRisk, string> = {
  Critical: "border-red-200 bg-red-50 text-red-700",
  High: "border-orange-200 bg-orange-50 text-orange-700",
  Medium: "border-amber-200 bg-amber-50 text-amber-700",
  Low: "border-slate-200 bg-slate-50 text-slate-600",
};

function StatusBadge({ status }: Readonly<{ status: DispatchStatus }>) {
  const icons = {
    "At risk": AlertTriangle,
    Delayed: AlertTriangle,
    "On schedule": CheckCircle2,
    "In transit": Truck,
    Ready: Truck,
  } as const;
  const Icon = icons[status];
  return (
    <Badge variant="outline" className={statusClasses[status]}>
      <Icon className="size-3" />
      {status}
    </Badge>
  );
}
function RiskBadge({ risk }: Readonly<{ risk: DispatchRisk }>) {
  return (
    <Badge variant="outline" className={riskClasses[risk]}>
      <span className="size-1.5 rounded-full bg-current" />
      {risk}
    </Badge>
  );
}
function SummaryCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: Readonly<{
  label: string;
  value: string;
  detail: string;
  icon: typeof Truck;
  tone: string;
}>) {
  return (
    <Card className="border-0 bg-white shadow-[0_2px_12px_rgba(23,33,31,0.04)] card-hover">
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-[#17211f]">
            {value}
          </p>
          <p className="mt-2 text-xs text-slate-400">{detail}</p>
        </div>
        <div
          className={`flex size-9 items-center justify-center rounded-lg ${tone}`}
        >
          <Icon className="size-4" />
        </div>
      </CardContent>
    </Card>
  );
}

function DispatchTimeline({
  dispatch,
}: Readonly<{ dispatch: DispatchRecord }>) {
  const labels = ["Order confirmed", "Picking", "Packed", "Loaded", "In transit", "Delivered"];
  const currentStage = dispatch.status === "Ready" ? "Loaded" : dispatch.status === "On schedule" ? "Delivered" : dispatch.status === "Delayed" || dispatch.status === "At risk" ? "In transit" : "In transit";
  const currentIndex = labels.indexOf(currentStage);
  const steps = labels.map((label) => {
    let icon: typeof Check | typeof AlertTriangle | null = Check;
    if (label === "Delivered") {
      icon = null;
    } else if (label === currentStage) {
      icon = AlertTriangle;
    }
    return { label, icon };
  });
  const isSelectedRisk = dispatch.risk === "Critical" || dispatch.risk === "High";
  return (
    <Card className="border-0 bg-white shadow-[0_2px_12px_rgba(23,33,31,0.04)] card-hover">
      <CardHeader className="px-5 pb-3 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Selected delivery
            </p>
            <CardTitle className="mt-1">Dispatch timeline</CardTitle>
            <p className="mt-1 text-xs text-slate-400">
              {dispatch.delivery} · {dispatch.material} ·{" "}
              {dispatch.materialName}
            </p>
          </div>
          <StatusBadge status={dispatch.status} />
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="mb-6 grid gap-3 text-xs sm:grid-cols-3">
          <div className="flex items-center gap-2 text-slate-500">
            <Warehouse className="size-3.5 text-slate-400" />
            {dispatch.warehouse} · Wolfsburg
          </div>
          <div className="flex items-center gap-2 text-slate-500">
            <PackageCheck className="size-3.5 text-slate-400" />
            {dispatch.quantity} requested
          </div>
          <div
            className={`flex items-center gap-2 font-medium ${isSelectedRisk ? "text-red-700" : "text-slate-500"}`}
          >
            <Clock3 className="size-3.5" />
            Expected delay: {isSelectedRisk ? "18 hrs" : "On schedule"}
          </div>
        </div>
        <div className="mb-6 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs sm:grid-cols-3">
          <div className="flex items-center gap-2 text-slate-600">
            <Boxes className="size-3.5 text-slate-400" />
            Available stock:{" "}
            <strong>
              {isSelectedRisk ? "180 EA" : "See inventory snapshot"}
            </strong>
          </div>
          <div
            className={`flex items-center gap-2 font-medium ${isSelectedRisk ? "text-red-700" : "text-slate-600"}`}
          >
            <AlertTriangle className="size-3.5" />
            Shortage:{" "}
            <strong>{isSelectedRisk ? "60 EA" : "None recorded"}</strong>
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <Truck className="size-3.5 text-slate-400" />
            Risk: <strong>{dispatch.risk}</strong>
          </div>
        </div>
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-0">
          {steps.map(({ label, icon: Icon }, index) => {
            const isCurrent = index === currentIndex;
            const isNext = index > currentIndex;
            let nodeClass = "border-emerald-500 bg-emerald-50 text-emerald-600";
            let labelClass = "font-medium text-slate-600";
            if (isNext) {
              nodeClass = "border-slate-200 bg-white text-slate-300";
              labelClass = "text-slate-400";
            } else if (isCurrent && label !== "Delivered") {
              nodeClass = "border-red-400 bg-red-50 text-red-600";
              labelClass = "font-semibold text-red-700";
            }
            return (
              <div
                key={label}
                className="relative flex items-center gap-3 sm:flex-1 sm:flex-col sm:gap-2 sm:text-center"
              >
                <div
                  className={`z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 ${nodeClass}`}
                >
                  {Icon ? (
                    <Icon className="size-4" />
                  ) : (
                    <span className="size-2 rounded-full bg-current" />
                  )}
                </div>
                <p className={`text-xs ${labelClass}`}>{label}</p>
                {index < steps.length - 1 && (
                  <span
                    className={`absolute left-8 top-4 h-px w-full sm:left-1/2 sm:top-4 sm:h-0.5 sm:w-full ${index < currentIndex ? "bg-emerald-300" : "bg-slate-200"}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
}>) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next ?? "all")}>
      <SelectTrigger
        aria-label={label}
        className="w-full border-slate-200 bg-white sm:w-[145px]"
      >
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{label}: All</SelectItem>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function DispatchTable({
  records,
  selectedDelivery,
  onSelect,
}: Readonly<{
  records: DispatchRecord[];
  selectedDelivery: string;
  onSelect: (record: DispatchRecord) => void;
}>) {
  return (
    <Card className="border-0 bg-white shadow-[0_2px_12px_rgba(23,33,31,0.04)] card-hover">
      <CardHeader className="px-5 pb-3 pt-5">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Active dispatches</CardTitle>
            <p className="mt-1 text-xs text-slate-400">
              Live operational queue · {records.length} shown
            </p>
          </div>
          <Truck className="size-5 text-[#839e24]" />
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Delivery</TableHead>
              <TableHead>Material</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>ETA</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Risk</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((record) => (
              <TableRow
                key={record.delivery}
                tabIndex={0}
                aria-selected={record.delivery === selectedDelivery}
                onClick={() => onSelect(record)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(record);
                  }
                }}
                className={`cursor-pointer focus-visible:bg-slate-50 ${record.delivery === selectedDelivery ? "bg-[#f5fbdc] hover:bg-[#f5fbdc]" : ""}`}
              >
                <TableCell className="font-mono text-xs font-medium text-[#17211f]">
                  {record.delivery}
                </TableCell>
                <TableCell>
                  <p className="text-sm font-medium">{record.material}</p>
                  <p className="text-[11px] text-slate-400">
                    {record.materialName}
                  </p>
                </TableCell>
                <TableCell className="text-sm text-slate-500">
                  {record.warehouse}
                </TableCell>
                <TableCell className="text-sm text-slate-500">
                  {record.quantity}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-slate-500">
                  {record.eta}
                </TableCell>
                <TableCell>
                  <StatusBadge status={record.status} />
                </TableCell>
                <TableCell>
                  <RiskBadge risk={record.risk} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function DispatchFlowPage() {
  const [dispatchRecords, setDispatchRecords] = useState<DispatchRecord[]>([]);
  const [search, setSearch] = useState("");
  const [warehouse, setWarehouse] = useState("all");
  const [status, setStatus] = useState("all");
  const [risk, setRisk] = useState("all");
  const [selectedDelivery, setSelectedDelivery] = useState<DispatchRecord | null>(null);
  useEffect(() => {
    Promise.all([fetchWorkbookTable("deliveries_dispatch"), fetchWorkbookTable("material_master"), fetchWorkbookTable("inventory_stock")]).then(([deliveries, materials, inventory]) => {
      const names = new Map(materials.rows.map((row) => [String(row.material ?? ""), String(row.description ?? "Unknown material")]));
      const stock = new Map(inventory.rows.map((row) => [`${row.material}|${row.plant}`, Number(row.qty_on_hand ?? 0)]));
      const records = deliveries.rows.map((row) => {
        const orderQty = Number(row.order_qty ?? 0);
        const available = stock.get(`${row.material}|${row.plant}`) ?? 0;
        const rawStatus = String(row.status ?? "").toUpperCase();
        const status: DispatchStatus = rawStatus.includes("DELAY") ? "Delayed" : rawStatus.includes("TRANSIT") ? "In transit" : rawStatus.includes("READY") ? "Ready" : "On schedule";
        const risk: DispatchRisk = orderQty > available && available > 0 ? "Critical" : status === "Delayed" ? "High" : "Low";
        return { delivery: String(row.delivery ?? ""), material: String(row.material ?? ""), materialName: names.get(String(row.material ?? "")) ?? "Unknown material", warehouse: String(row.plant ?? "Unknown plant"), quantity: `${orderQty} EA`, eta: String(row.planned_gi_date ?? "Not provided"), status, risk };
      });
      setDispatchRecords(records);
      setSelectedDelivery(records[0] ?? null);
    }).catch(() => { setDispatchRecords([]); setSelectedDelivery(null); });
  }, []);
  const filteredRecords = useMemo(
    () =>
      dispatchRecords.filter((record) => {
        const query = search.toLowerCase();
        return (
          (!query ||
            [record.delivery, record.material, record.materialName].some(
              (value) => value.toLowerCase().includes(query),
            )) &&
          (warehouse === "all" || record.warehouse === warehouse) &&
          (status === "all" || record.status === status) &&
          (risk === "all" || record.risk === risk)
        );
      }),
    [risk, search, status, warehouse],
  );

  return (
    <div className="flex min-h-screen bg-[#f4f6f3] font-sans text-[#17211f]">
      <Sidebar activeLabel="Dispatch Flow" />
      <main className="min-w-0 flex-1">
        <header className="flex h-20 items-center justify-between border-b border-slate-200/80 bg-[#f8faf7] px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden">
              <Menu />
            </Button>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                Operations control
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight">
                Dispatch Flow
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
              <span className="size-2 rounded-full bg-emerald-500" /> Dispatch
              feed live
            </div>
            <div className="flex size-8 items-center justify-center rounded-full bg-[#d8f36b] text-xs font-bold text-[#17211f]">
              AS
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-[1500px] space-y-6 p-5 sm:p-8">
          <section>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[#667d16]">
              <span className="size-1.5 rounded-full bg-[#9bb63f]" /> OPERATIONS
              CONTROL
            </div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Dispatch Flow
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Monitor deliveries, identify delays, and prioritize operational
              actions.
            </p>
          </section>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Today's deliveries"
              value={String(dispatchRecords.length)}
              detail="From Deliveries_Dispatch"
              icon={Truck}
              tone="bg-blue-50 text-blue-600"
            />
            <SummaryCard
              label="On schedule"
              value={String(dispatchRecords.filter((record) => record.status === "On schedule").length)}
              detail="Current workbook status"
              icon={CheckCircle2}
              tone="bg-emerald-50 text-emerald-600"
            />
            <SummaryCard
              label="At risk"
              value={String(dispatchRecords.filter((record) => record.status === "At risk" || record.risk === "Critical" || record.risk === "High").length)}
              detail="Requires attention"
              icon={AlertTriangle}
              tone="bg-amber-50 text-amber-600"
            />
            <SummaryCard
              label="Delayed"
              value={String(dispatchRecords.filter((record) => record.status === "Delayed").length)}
              detail="Needs intervention"
              icon={Clock3}
              tone="bg-red-50 text-red-600"
            />
          </section>
          {selectedDelivery ? <DispatchTimeline dispatch={selectedDelivery} /> : <Card className="border-0 bg-white shadow-sm card-hover"><CardContent className="p-8 text-center text-sm text-slate-400">No dispatch records are available from the workbook.</CardContent></Card>}
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.7fr)]">
            <div className="space-y-3">
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="text-base font-semibold">Dispatch queue</h2>
                  <p className="mt-1 text-xs text-slate-400">
                    Filter active deliveries by operational signal.
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="hidden border-slate-200 bg-white text-slate-500 sm:flex"
                >
                  <Filter className="size-3" /> {filteredRecords.length} records
                </Badge>
              </div>
              <div className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-[0_2px_12px_rgba(23,33,31,0.04)] sm:flex-row">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    aria-label="Search delivery"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search delivery"
                    className="h-8 border-slate-200 pl-9"
                  />
                </div>
                <FilterSelect
                  label="Warehouse"
                  value={warehouse}
                  onChange={setWarehouse}
                  options={[...new Set(dispatchRecords.map((record) => record.warehouse))]}
                />
                <FilterSelect
                  label="Status"
                  value={status}
                  onChange={setStatus}
                  options={[
                    "At risk",
                    "In transit",
                    "On schedule",
                    "Delayed",
                    "Ready",
                  ]}
                />
                <FilterSelect
                  label="Risk"
                  value={risk}
                  onChange={setRisk}
                  options={["Critical", "High", "Medium", "Low"]}
                />
              </div>
              <DispatchTable
                records={filteredRecords}
                selectedDelivery={selectedDelivery?.delivery ?? ""}
                onSelect={setSelectedDelivery}
              />
            </div>
            <div className="space-y-6">
              <Card className="border-0 bg-[#0B4F4A] text-white shadow-[0_2px_12px_rgba(11,79,74,0.08)]">
                <CardHeader className="border-b border-white/10 px-5 pb-3 pt-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#d8f36b]">
                        AI dispatch insights
                      </p>
                      <CardTitle className="mt-1 text-white">
                        Operational signals
                      </CardTitle>
                    </div>
                    <Sparkles className="size-5 text-[#d8f36b]" />
                  </div>
                </CardHeader>
                <CardContent className="p-5">
                  <p className="text-lg font-semibold">
                    {dispatchRecords.filter((record) => record.risk === "Critical" || record.risk === "High").length} deliveries are currently at risk.
                  </p>
                  <div className="mt-5 space-y-4 text-sm leading-6 text-white/65">
                    <p className="border-l-2 border-red-400 pl-3">
                      {dispatchRecords.filter((record) => record.risk === "Critical").length} deliveries exceed available stock in the current inventory snapshot.
                    </p>
                    <p className="border-l-2 border-amber-300 pl-3">
                      Dispatch risk is calculated from Deliveries_Dispatch and Inventory_Stock joins.
                    </p>
                    <p className="border-l-2 border-orange-300 pl-3">
                      {dispatchRecords.filter((record) => record.status === "Delayed").length} delayed deliveries require operator review.
                    </p>
                  </div>
                  <Link
                    href="/anomalies"
                    className="mt-6 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-transparent bg-[#d8f36b] px-2.5 text-sm font-medium text-[#17211f] transition-colors hover:bg-[#e5fa9d] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <Sparkles /> Review at-risk deliveries
                  </Link>
                </CardContent>
              </Card>
              <Card className="border-0 bg-white shadow-[0_2px_12px_rgba(23,33,31,0.04)] card-hover">
                <CardHeader className="px-5 pb-3 pt-5">
                  <CardTitle>Priority actions</CardTitle>
                  <p className="text-xs text-slate-400">
                    Recommended next moves
                  </p>
                </CardHeader>
                <CardContent className="space-y-3 px-5 pb-5">
                  <div className="rounded-lg border border-red-100 bg-red-50/60 p-3">
                    <div className="flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className="border-red-200 bg-red-50 text-red-700"
                      >
                        Critical
                      </Badge>
                      <span className="font-mono text-xs text-red-700">
                        {dispatchRecords.find((record) => record.risk === "Critical")?.delivery ?? "No critical delivery"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-[#17211f]">
                      Split delivery and trigger replenishment
                    </p>
                    <Link
                      href="/anomalies/AN-2016"
                      className="mt-1 inline-flex h-auto items-center gap-1 text-xs text-red-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      View investigation <ArrowUpRight />
                    </Link>
                  </div>
                  <div className="rounded-lg border border-orange-100 bg-orange-50/50 p-3">
                    <div className="flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className="border-orange-200 bg-orange-50 text-orange-700"
                      >
                        High
                      </Badge>
                      <span className="font-mono text-xs text-orange-700">
                        D-10842
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-[#17211f]">
                      Review carrier delay and update ETA
                    </p>
                    <Button
                      variant="link"
                      size="sm"
                      className="mt-1 h-auto p-0 text-xs text-orange-700"
                    >
                      Review <ChevronRight />
                    </Button>
                  </div>
                  <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-3">
                    <div className="flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className="border-amber-200 bg-amber-50 text-amber-700"
                      >
                        Medium
                      </Badge>
                      <span className="font-mono text-xs text-amber-700">
                        D-10821
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-[#17211f]">
                      Confirm transit milestone
                    </p>
                    <Button
                      variant="link"
                      size="sm"
                      className="mt-1 h-auto p-0 text-xs text-amber-700"
                    >
                      Review <ChevronRight />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
