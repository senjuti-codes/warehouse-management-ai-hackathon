"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  Database,
  Menu,
  PackageCheck,
  Sparkles,
  Warehouse,
} from "lucide-react";
import { type InventoryRisk, type MaterialRisk, type WarehouseHealth } from "@/data/inventory-health";
import { fetchWorkbookTable } from "@/lib/workbook-api";
import { Sidebar } from "@/components/control-tower-dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const riskClasses: Record<InventoryRisk, string> = {
  Critical: "border-red-200 bg-red-50 text-red-700",
  High: "border-orange-200 bg-orange-50 text-orange-700",
  Low: "border-slate-200 bg-slate-50 text-slate-600",
};

function RiskBadge({ risk }: Readonly<{ risk: InventoryRisk }>) {
  return (
    <Badge variant="outline" className={riskClasses[risk]}>
      {risk === "Critical" || risk === "High" ? (
        <AlertTriangle className="size-3" />
      ) : (
        <CheckCircle2 className="size-3" />
      )}
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
  icon: typeof Boxes;
  tone: string;
}>) {
  return (
    <Card className="border-0 bg-white shadow-[0_2px_12px_rgba(23,33,31,0.04)]">
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

function WarehouseHealthCard({
  warehouse,
}: Readonly<{ warehouse: WarehouseHealth }>) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#17211f]">
            {warehouse.id}{" "}
            <span className="font-normal text-slate-400">{warehouse.city}</span>
          </p>
          <div className="mt-2 flex items-center gap-2">
            {warehouse.status === "At risk" ? (
              <AlertTriangle className="size-3.5 text-orange-500" />
            ) : (
              <CheckCircle2 className="size-3.5 text-emerald-500" />
            )}
            <span
              className={`text-xs font-medium ${warehouse.status === "At risk" ? "text-orange-700" : "text-emerald-700"}`}
            >
              {warehouse.status}
            </span>
          </div>
        </div>
        <span className="text-lg font-semibold text-[#17211f]">
          {warehouse.stockHealth}%
        </span>
      </div>
      <div className="mt-4 space-y-2">
        <div className="flex justify-between text-[11px] text-slate-400">
          <span>Stock health</span>
          <span>{warehouse.stockHealth}%</span>
        </div>
        <Progress
          value={warehouse.stockHealth}
          className="[&_[data-slot=progress-indicator]]:bg-emerald-500"
        />
        <div className="flex justify-between text-[11px] text-slate-400">
          <span>Capacity used</span>
          <span>{warehouse.capacity}%</span>
        </div>
        <Progress
          value={warehouse.capacity}
          className={
            warehouse.capacity > 90
              ? "[&_[data-slot=progress-indicator]]:bg-orange-500"
              : "[&_[data-slot=progress-indicator]]:bg-[#9bb63f]"
          }
        />
      </div>
    </div>
  );
}

function MaterialRiskTable({ records }: Readonly<{ records: MaterialRisk[] }>) {
  return (
    <Card className="border-0 bg-white shadow-[0_2px_12px_rgba(23,33,31,0.04)]">
      <CardHeader className="px-5 pb-3 pt-5">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Material risk queue</CardTitle>
            <p className="mt-1 text-xs text-slate-400">
              Availability against current operational requirements
            </p>
          </div>
          <Database className="size-5 text-slate-300" />
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Material</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead>Available</TableHead>
              <TableHead>Required</TableHead>
              <TableHead>Shortfall</TableHead>
              <TableHead>Risk</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((record) => (
              <TableRow key={record.material}>
                <TableCell>
                  <p className="font-mono text-xs font-medium text-[#17211f]">
                    {record.material}
                  </p>
                  <p className="text-[11px] text-slate-400">{record.name}</p>
                </TableCell>
                <TableCell className="text-sm text-slate-500">
                  {record.warehouse}
                </TableCell>
                <TableCell className="text-sm text-slate-600">
                  {record.available} EA
                </TableCell>
                <TableCell className="text-sm text-slate-600">
                  {record.required} EA
                </TableCell>
                <TableCell
                  className={`text-sm font-semibold ${record.shortfall < 0 ? "text-red-700" : "text-emerald-700"}`}
                >
                  {record.shortfall > 0 ? "+" : ""}
                  {record.shortfall} EA
                </TableCell>
                <TableCell>
                  <RiskBadge risk={record.risk} />
                </TableCell>
                <TableCell className="text-right">
                  {record.risk !== "Low" ? (
                    <Link
                      href="/anomalies"
                      className="inline-flex items-center gap-1 text-xs font-medium text-red-700 underline-offset-4 hover:underline"
                    >
                      Review <ArrowUpRight className="size-3.5" />
                    </Link>
                  ) : (
                    <span className="text-xs text-slate-300">Monitor</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function InventoryHealthPage() {
  const [materialRisks, setMaterialRisks] = useState<MaterialRisk[]>([]);
  const [warehouseHealth, setWarehouseHealth] = useState<WarehouseHealth[]>([]);
  const [search, setSearch] = useState("");
  useEffect(() => {
    Promise.all([fetchWorkbookTable("material_master"), fetchWorkbookTable("inventory_stock"), fetchWorkbookTable("warehouse_bin")]).then(([materials, inventory, bins]) => {
      const materialMap = new Map(materials.rows.map((row) => [String(row.material ?? ""), row]));
      setMaterialRisks(inventory.rows.map((row) => {
        const material = String(row.material ?? "");
        const master = materialMap.get(material);
        const available = Number(row.qty_on_hand ?? 0);
        const required = Number(master?.reorder_point ?? 0);
        const shortfall = available - required;
        const risk: InventoryRisk = shortfall < 0 && available === 0 ? "Critical" : shortfall < 0 ? "High" : "Low";
        return { material, name: String(master?.description ?? "Unknown material"), warehouse: String(row.plant ?? "Unknown plant"), available, required, shortfall, risk };
      }));
      const plantRows = new Map<string, { occupied: number; capacity: number; stock: number; reorder: number }>();
      for (const row of bins.rows) { const plant = String(row.plant ?? "Unknown"); const current = plantRows.get(plant) ?? { occupied: 0, capacity: 0, stock: 0, reorder: 0 }; current.occupied += Number(row.occupied ?? 0); current.capacity += Number(row.capacity ?? 0); plantRows.set(plant, current); }
      for (const row of inventory.rows) { const plant = String(row.plant ?? "Unknown"); const current = plantRows.get(plant) ?? { occupied: 0, capacity: 0, stock: 0, reorder: 0 }; current.stock += Number(row.qty_on_hand ?? 0); const master = materialMap.get(String(row.material ?? "")); current.reorder += Number(master?.reorder_point ?? 0); plantRows.set(plant, current); }
      setWarehouseHealth([...plantRows.entries()].map(([id, value]) => { const capacity = value.capacity ? Math.round(value.occupied / value.capacity * 100) : 0; const stockHealth = value.reorder ? Math.min(100, Math.round(value.stock / value.reorder * 100)) : 0; return { id, city: "Workbook plant", stockHealth, capacity, status: capacity > 90 || stockHealth < 80 ? "At risk" : "Healthy" }; }));
    }).catch(() => { setMaterialRisks([]); setWarehouseHealth([]); });
  }, []);
  const filteredMaterials = useMemo(
    () =>
      materialRisks.filter((record) =>
        [record.material, record.name, record.warehouse].some((value) =>
          value.toLowerCase().includes(search.toLowerCase()),
        ),
      ),
    [search],
  );

  return (
    <div className="flex min-h-screen bg-[#f4f6f3] font-sans text-[#17211f]">
      <Sidebar activeLabel="Inventory Health" />
      <main className="min-w-0 flex-1">
        <header className="flex h-20 items-center justify-between border-b border-slate-200/80 bg-[#f8faf7] px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden">
              <Menu />
            </Button>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                Inventory intelligence
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight">
                Inventory Health
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
              <span className="size-2 rounded-full bg-emerald-500" /> Inventory
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
              <span className="size-1.5 rounded-full bg-[#9bb63f]" /> INVENTORY
              INTELLIGENCE
            </div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Inventory Health
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Monitor stock availability, warehouse capacity, and material risks
              across the network.
            </p>
          </section>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Total inventory"
              value={`${materialRisks.reduce((total, record) => total + record.available, 0).toLocaleString()} EA`}
              detail={`Across ${warehouseHealth.length} workbook plants`}
              icon={Boxes}
              tone="bg-blue-50 text-blue-600"
            />
            <SummaryCard
              label="Healthy stock"
              value={`${materialRisks.filter((record) => record.risk === "Low").length}`}
              detail="Materials above reorder point"
              icon={CheckCircle2}
              tone="bg-emerald-50 text-emerald-600"
            />
            <SummaryCard
              label="At-risk stock"
              value={`${materialRisks.filter((record) => record.risk !== "Low").length}`}
              detail="Requires attention"
              icon={AlertTriangle}
              tone="bg-amber-50 text-amber-600"
            />
            <SummaryCard
              label="Stockout risks"
              value={String(materialRisks.filter((record) => record.risk === "Critical").length).padStart(2, "0")}
              detail="Critical materials"
              icon={PackageCheck}
              tone="bg-red-50 text-red-600"
            />
          </section>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <Card className="border-0 bg-white shadow-[0_2px_12px_rgba(23,33,31,0.04)]">
              <CardHeader className="px-5 pb-3 pt-5">
                <CardTitle>Inventory overview</CardTitle>
                <p className="text-xs text-slate-400">
                  Network stock condition
                </p>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="flex items-center gap-6">
                  <div
                    className="relative flex size-32 shrink-0 items-center justify-center rounded-full"
                    style={{
                      background:
                        "conic-gradient(#7fa45b 0 87%, #d5b869 87% 96%, #c96b62 96% 100%)",
                    }}
                  >
                    <div className="flex size-24 flex-col items-center justify-center rounded-full bg-white">
                      <span className="text-2xl font-semibold text-[#17211f]">
                        87%
                      </span>
                      <span className="text-[10px] text-slate-400">
                        healthy
                      </span>
                    </div>
                  </div>
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-[#7fa45b]" />{" "}
                      Healthy <span className="font-semibold">87%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-[#d5b869]" /> At
                      risk <span className="font-semibold">9%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-[#c96b62]" />{" "}
                      Critical <span className="font-semibold">4%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 bg-white shadow-[0_2px_12px_rgba(23,33,31,0.04)]">
              <CardHeader className="px-5 pb-3 pt-5">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Warehouse health</CardTitle>
                    <p className="mt-1 text-xs text-slate-400">
                      Stock health and capacity pressure
                    </p>
                  </div>
                  <Warehouse className="size-5 text-slate-300" />
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 px-5 pb-5 sm:grid-cols-2">
                {warehouseHealth.map((warehouse) => (
                  <WarehouseHealthCard
                    key={warehouse.id}
                    warehouse={warehouse}
                  />
                ))}
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.65fr)]">
            <div className="space-y-3">
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="text-base font-semibold">
                    Material risk queue
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    {filteredMaterials.length} materials shown
                  </p>
                </div>
                <div className="relative w-56">
                  <Database className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    aria-label="Search material risks"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search material"
                    className="h-8 border-slate-200 bg-white pl-9"
                  />
                </div>
              </div>
              <MaterialRiskTable records={filteredMaterials} />
            </div>
            <div className="space-y-6">
              <Card className="border-0 bg-[#17211f] text-white shadow-[0_2px_12px_rgba(23,33,31,0.08)]">
                <CardHeader className="border-b border-white/10 px-5 pb-3 pt-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#d8f36b]">
                        AI inventory insights
                      </p>
                      <CardTitle className="mt-1 text-white">
                        Network pressure
                      </CardTitle>
                    </div>
                    <Sparkles className="size-5 text-[#d8f36b]" />
                  </div>
                </CardHeader>
                <CardContent className="p-5">
                  <p className="text-lg font-semibold">
                    {materialRisks.filter((record) => record.risk !== "Low").length} materials require attention.
                  </p>
                  <div className="mt-5 space-y-4 text-sm leading-6 text-white/65">
                    <p className="border-l-2 border-red-400 pl-3">
                      {materialRisks.filter((record) => record.shortfall < 0).length} materials are below their workbook reorder point.
                    </p>
                    <p className="border-l-2 border-amber-300 pl-3">
                      {warehouseHealth.filter((warehouse) => warehouse.status === "At risk").length} workbook plants are above the configured capacity or stock threshold.
                    </p>
                    <p className="border-l-2 border-orange-300 pl-3">
                      Shortfalls are calculated from quantity on hand versus reorder point.
                    </p>
                  </div>
                  <Link
                    href="/anomalies"
                    className="mt-6 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-[#d8f36b] px-2.5 text-sm font-medium text-[#17211f] transition-colors hover:bg-[#e5fa9d] focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <Sparkles className="size-4" /> Review anomalies
                  </Link>
                </CardContent>
              </Card>
              <Card className="border-0 bg-white shadow-[0_2px_12px_rgba(23,33,31,0.04)]">
                <CardHeader className="px-5 pb-3 pt-5">
                  <CardTitle>Replenishment recommendations</CardTitle>
                  <p className="text-xs text-slate-400">
                    Suggested next actions
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
                        {materialRisks[0]?.material ?? "No critical material"} · {materialRisks[0]?.warehouse ?? "Awaiting data"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium">Review the current shortfall</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Workbook quantity on hand is below the configured reorder point.
                    </p>
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
                        M-2291 · WH-03
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium">Replenish 60 EA</p>
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
                        M-7812 · WH-02
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium">Replenish 15 EA</p>
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
