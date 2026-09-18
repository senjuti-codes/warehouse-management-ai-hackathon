"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Filter,
  Menu,
  PackageCheck,
  Search,
  ShieldAlert,
  Sparkles,
  Truck,
  Users,
} from "lucide-react";
import { type VendorRecord, type VendorRisk, type VendorStatus } from "@/data/vendors";
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

const statusClasses: Record<VendorStatus, string> = {
  Healthy: "border-emerald-200 bg-emerald-50 text-emerald-700",
  "At risk": "border-amber-200 bg-amber-50 text-amber-700",
  Blocked: "border-red-200 bg-red-50 text-red-700",
};

const riskClasses: Record<VendorRisk, string> = {
  Low: "border-slate-200 bg-slate-50 text-slate-600",
  Medium: "border-amber-200 bg-amber-50 text-amber-700",
  High: "border-orange-200 bg-orange-50 text-orange-700",
  Critical: "border-red-200 bg-red-50 text-red-700",
};

function VendorStatusBadge({ status }: Readonly<{ status: VendorStatus }>) {
  const icons = {
    Healthy: CheckCircle2,
    "At risk": AlertTriangle,
    Blocked: ShieldAlert,
  } as const;
  const Icon = icons[status];
  return (
    <Badge variant="outline" className={statusClasses[status]}>
      <Icon className="size-3" />
      {status}
    </Badge>
  );
}

function RiskBadge({ risk }: Readonly<{ risk: VendorRisk }>) {
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
  icon: typeof Users;
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
        className="w-full border-slate-200 bg-white sm:w-[150px]"
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

function VendorTable({ records }: Readonly<{ records: VendorRecord[] }>) {
  return (
    <Card className="border-0 bg-white shadow-[0_2px_12px_rgba(23,33,31,0.04)] card-hover">
      <CardHeader className="px-5 pb-3 pt-5">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Vendor performance</CardTitle>
            <p className="mt-1 text-xs text-slate-400">
              Supplier reliability across active purchase relationships
            </p>
          </div>
          <PackageCheck className="size-5 text-slate-300" />
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Vendor</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Open orders</TableHead>
              <TableHead>On-time rate</TableHead>
              <TableHead>Lead time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Risk</TableHead>
              <TableHead className="text-right">Next delivery</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((vendor) => (
              <TableRow key={vendor.id}>
                <TableCell>
                  <div>
                    <p className="text-sm font-medium text-[#17211f]">
                      {vendor.name}
                    </p>
                    <p className="font-mono text-[11px] text-slate-400">
                      {vendor.id} · {vendor.region}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="text-xs text-slate-500">
                  {vendor.category}
                </TableCell>
                <TableCell className="text-sm text-slate-600">
                  {vendor.openOrders}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-semibold ${vendor.onTimeRate < 80 ? "text-orange-700" : "text-[#17211f]"}`}
                    >
                      {vendor.onTimeRate}%
                    </span>
                    <div className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-slate-100 sm:block">
                      <div
                        className={`h-full rounded-full ${vendor.onTimeRate < 80 ? "bg-orange-500" : "bg-emerald-500"}`}
                        style={{ width: `${vendor.onTimeRate}%` }}
                      />
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-slate-500">
                  {vendor.leadTime}
                </TableCell>
                <TableCell>
                  <VendorStatusBadge status={vendor.status} />
                </TableCell>
                <TableCell>
                  <RiskBadge risk={vendor.risk} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-right text-xs text-slate-500">
                  {vendor.nextDelivery}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function VendorsPage() {
  const [vendors, setVendors] = useState<VendorRecord[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [risk, setRisk] = useState("all");
  useEffect(() => {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    fetch(`${apiBaseUrl}/api/vendors/enriched`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Vendors unavailable"))))
      .then((rows: Array<Record<string, string | number | null>>) => {
        setVendors(rows.map((row) => {
          const onTimeRate = Number(row.on_time_delivery ?? 0);
          const blocked = String(row.procurement_block ?? "").toUpperCase() === "Y";
          const openOrders = Number(row.open_orders ?? 0);
          const leadTimeDays = row.average_lead_time_days;
          const derivedStatus: VendorStatus = blocked ? "Blocked" : onTimeRate < 90 ? "At risk" : "Healthy";
          const derivedRisk: VendorRisk = blocked ? "Critical" : onTimeRate < 80 ? "High" : onTimeRate < 90 ? "Medium" : "Low";
          const linkedMaterials = Number(row.linked_material_count ?? 0);
          const category = linkedMaterials > 0
            ? `${linkedMaterials} linked material${linkedMaterials === 1 ? "" : "s"}`
            : "No purchase orders";
          return {
            id: String(row.vendor ?? ""),
            name: String(row.vendor_name ?? "Unknown vendor"),
            region: String(row.country ?? "Unknown"),
            category,
            openOrders,
            onTimeRate,
            leadTime: leadTimeDays === null || leadTimeDays === undefined ? "n/a" : `${leadTimeDays} days`,
            status: derivedStatus,
            risk: derivedRisk,
            spend: "Not tracked",
            nextDelivery: row.next_delivery ? String(row.next_delivery) : "No open PO",
          };
        }));
      })
      .catch(async () => {
        try {
          const { rows } = await fetchWorkbookTable("vendor_master");
          setVendors(rows.map((row) => {
            const onTimeRate = Number(row.on_time_delivery ?? 0);
            const blocked = String(row.procurement_block ?? "").toUpperCase() === "Y";
            const derivedStatus: VendorStatus = blocked ? "Blocked" : onTimeRate < 90 ? "At risk" : "Healthy";
            const derivedRisk: VendorRisk = blocked ? "Critical" : onTimeRate < 80 ? "High" : onTimeRate < 90 ? "Medium" : "Low";
            return {
              id: String(row.vendor ?? ""),
              name: String(row.vendor_name ?? "Unknown vendor"),
              region: String(row.country ?? "Unknown"),
              category: "Vendor master only",
              openOrders: 0,
              onTimeRate,
              leadTime: "n/a",
              status: derivedStatus,
              risk: derivedRisk,
              spend: "Not tracked",
              nextDelivery: "n/a",
            };
          }));
        } catch {
          setVendors([]);
        }
      });
  }, []);
  const filteredVendors = useMemo(
    () =>
      vendors.filter((vendor) => {
        const query = search.toLowerCase();
        return (
          (!query ||
            [vendor.id, vendor.name, vendor.region, vendor.category].some(
              (value) => value.toLowerCase().includes(query),
            )) &&
          (status === "all" || vendor.status === status) &&
          (risk === "all" || vendor.risk === risk)
        );
      }),
    [vendors, risk, search, status],
  );

  return (
    <div className="flex min-h-screen bg-[#f4f6f3] font-sans text-[#17211f]">
      <Sidebar activeLabel="Vendors" />
      <main className="min-w-0 flex-1">
        <header className="flex h-20 items-center justify-between border-b border-slate-200/80 bg-[#f8faf7] px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden">
              <Menu />
            </Button>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                Supplier intelligence
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight">
                Vendors
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
              <span className="size-2 rounded-full bg-emerald-500" /> Vendor
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
              <span className="size-1.5 rounded-full bg-[#9bb63f]" /> SUPPLIER
              INTELLIGENCE
            </div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Vendors
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Monitor supplier reliability, open commitments, and procurement
              risk across the network.
            </p>
          </section>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Active vendors"
              value={String(vendors.length)}
              detail="From Vendor_Master"
              icon={Users}
              tone="bg-blue-50 text-blue-600"
            />
            <SummaryCard
              label="Healthy vendors"
              value={String(vendors.filter((vendor) => vendor.status === "Healthy").length)}
              detail="Within workbook thresholds"
              icon={CheckCircle2}
              tone="bg-emerald-50 text-emerald-600"
            />
            <SummaryCard
              label="At risk"
              value={String(vendors.filter((vendor) => vendor.status === "At risk").length).padStart(2, "0")}
              detail="Reliability needs attention"
              icon={AlertTriangle}
              tone="bg-amber-50 text-amber-600"
            />
            <SummaryCard
              label="Blocked"
              value={String(vendors.filter((vendor) => vendor.status === "Blocked").length).padStart(2, "0")}
              detail="Open commitments exposed"
              icon={ShieldAlert}
              tone="bg-red-50 text-red-600"
            />
          </section>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.7fr)]">
            <div className="space-y-3">
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="text-base font-semibold">Vendor queue</h2>
                  <p className="mt-1 text-xs text-slate-400">
                    {filteredVendors.length} of {vendors.length} suppliers shown
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="hidden border-slate-200 bg-white text-slate-500 sm:flex"
                >
                  <Filter className="size-3" /> Operational view
                </Badge>
              </div>
              <div className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-[0_2px_12px_rgba(23,33,31,0.04)] sm:flex-row">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    aria-label="Search vendors"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search vendors"
                    className="h-8 border-slate-200 pl-9"
                  />
                </div>
                <FilterSelect
                  label="Status"
                  value={status}
                  onChange={setStatus}
                  options={["Healthy", "At risk", "Blocked"]}
                />
                <FilterSelect
                  label="Risk"
                  value={risk}
                  onChange={setRisk}
                  options={["Low", "Medium", "High", "Critical"]}
                />
              </div>
              <VendorTable records={filteredVendors} />
            </div>
            <div className="space-y-6">
              <Card className="h-fit border-0 bg-[#0B4F4A] text-white shadow-[0_2px_12px_rgba(11,79,74,0.08)]">
                <CardHeader className="border-b border-white/10 px-5 pb-3 pt-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#d8f36b]">
                        AI vendor insights
                      </p>
                      <CardTitle className="mt-1 text-white">
                        Procurement signals
                      </CardTitle>
                    </div>
                    <Sparkles className="size-5 text-[#d8f36b]" />
                  </div>
                </CardHeader>
                <CardContent className="p-5">
                  <p className="text-lg font-semibold">
                    {vendors.filter((vendor) => vendor.status !== "Healthy").length} suppliers require review.
                  </p>
                  <div className="mt-5 space-y-4 text-sm leading-6 text-white/65">
                    <p className="border-l-2 border-red-400 pl-3">
                      {vendors.filter((vendor) => vendor.status === "Blocked").length} suppliers are procurement-blocked in Vendor_Master.
                    </p>
                    <p className="border-l-2 border-amber-300 pl-3">
                      {vendors.filter((vendor) => vendor.onTimeRate < 90).length} suppliers are below the 90% on-time threshold.
                    </p>
                    <p className="border-l-2 border-orange-300 pl-3">
                      Lead-time data is not provided by the current workbook schema.
                    </p>
                  </div>
                  <Link
                    href="/anomalies"
                    className="mt-6 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-[#d8f36b] px-2.5 text-sm font-medium text-[#17211f] transition-colors hover:bg-[#e5fa9d] focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <Sparkles className="size-4" /> Review vendor anomalies
                  </Link>
                </CardContent>
              </Card>
              <Card className="border-0 bg-white shadow-[0_2px_12px_rgba(23,33,31,0.04)] card-hover">
                <CardHeader className="px-5 pb-3 pt-5">
                  <CardTitle>Supplier activity</CardTitle>
                  <p className="text-xs text-slate-400">
                    Latest network movements
                  </p>
                </CardHeader>
                <CardContent className="space-y-4 px-5 pb-5">
                  <div className="flex gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                      <Truck className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        18 shipments in transit
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Across 9 vendors
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                      <Clock3 className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        6 lead times shifted
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Compared with last week
                      </p>
                    </div>
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
