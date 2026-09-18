"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Filter,
  Menu,
  RefreshCw,
  Search,
  Sparkles,
  Table2,
} from "lucide-react";
import { type DataSourceRecord, type DataSourceStatus } from "@/data/data-sources";
import { apiBaseUrl, fetchWorkbookTable, type WorkbookRow } from "@/lib/workbook-api";
import { Sidebar } from "@/components/control-tower-dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

const statusClasses: Record<DataSourceStatus, string> = {
  Healthy: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Warning: "border-amber-200 bg-amber-50 text-amber-700",
};

const dataSourceTables = [
  ["inventory_stock", "Warehouse inventory"],
  ["deliveries_dispatch", "Outbound logistics"],
  ["material_master", "Master data"],
  ["vendor_master", "Procurement master"],
  ["warehouse_bin", "Storage capacity"],
  ["purchase_replenish", "Purchase orders"],
] as const;

const calculateCoverage = (rows: WorkbookRow[]) => {
  let totalCells = 0;
  let populatedCells = 0;

  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      if (["id", "row_number", "created_at"].includes(key)) continue;
      totalCells += 1;
      if (value !== null && String(value).trim() !== "") {
        populatedCells += 1;
      }
    }
  }

  return totalCells ? Math.round((populatedCells / totalCells) * 100) : 100;
};

const loadDataSources = async () => Promise.all(dataSourceTables.map(async ([name, type]) => {
  const result = await fetchWorkbookTable(name);
  const coveragePercent = calculateCoverage(result.rows);

  return {
    name,
    type,
    records: result.total.toLocaleString(),
    lastSync: "Current workbook run",
    status: coveragePercent >= 98 ? "Healthy" : "Warning" as DataSourceStatus,
    coverage: `${coveragePercent}%`,
  };
}));

function SourceStatus({ status }: Readonly<{ status: DataSourceStatus }>) {
  return (
    <Badge variant="outline" className={statusClasses[status]}>
      {status === "Healthy" ? (
        <CheckCircle2 className="size-3" />
      ) : (
        <AlertTriangle className="size-3" />
      )}
      {status}
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
  icon: typeof Database;
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

function SourceTable({
  records,
  onSelect,
}: Readonly<{
  records: DataSourceRecord[];
  onSelect: (source: DataSourceRecord) => void;
}>) {
  return (
    <Card className="border-0 bg-white shadow-[0_2px_12px_rgba(23,33,31,0.04)] card-hover">
      <CardHeader className="px-5 pb-3 pt-5">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Connected data sources</CardTitle>
            <p className="mt-1 text-xs text-slate-400">
              Monitored warehouse and procurement feeds
            </p>
          </div>
          <Table2 className="size-5 text-slate-300" />
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Source name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Records</TableHead>
              <TableHead>Last sync</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((source) => (
              <TableRow key={source.name}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                      <Database className="size-4" />
                    </div>
                    <div>
                      <p className="font-mono text-xs font-medium text-[#17211f]">
                        {source.name}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {source.coverage} quality coverage
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-slate-500">
                  {source.type}
                </TableCell>
                <TableCell className="text-sm text-slate-600">
                  {source.records}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-slate-500">
                  {source.lastSync}
                </TableCell>
                <TableCell>
                  <SourceStatus status={source.status} />
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => onSelect(source)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 underline-offset-4 hover:text-[#17211f] hover:underline"
                  >
                    <RefreshCw className="size-3.5" /> Sync details
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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

export function DataSourcesPage() {
  const [dataSources, setDataSources] = useState<DataSourceRecord[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [isScanning, setIsScanning] = useState(false);
  const [scanNotice, setScanNotice] = useState("");
  const [selectedSource, setSelectedSource] = useState<DataSourceRecord | null>(
    null,
  );
  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      loadDataSources().then(setDataSources).catch(() => setDataSources([]));
    }, 0);

    return () => window.clearTimeout(loadTimer);
  }, []);
  const filteredSources = useMemo(
    () =>
      dataSources.filter((source) => {
        const query = search.toLowerCase();
        return (
          (!query ||
            [source.name, source.type].some((value) =>
              value.toLowerCase().includes(query),
            )) &&
          (status === "all" || source.status === status)
        );
      }),
    [dataSources, search, status],
  );

  const runQualityScan = async () => {
    if (isScanning) return;
    setIsScanning(true);
    setScanNotice("Running quality scan...");

    try {
      const response = await fetch(`${apiBaseUrl}/api/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error("Quality scan failed");
      }

      const refreshedSources = await loadDataSources();
      setDataSources(refreshedSources);
      const warningCount = refreshedSources.filter((source) => source.status === "Warning").length;
      setScanNotice(warningCount ? `Quality scan complete: ${warningCount} sources need attention.` : "Quality scan complete: all sources are healthy.");
    } catch {
      setScanNotice("Quality scan failed. Check that the backend is running and retry.");
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <>
      <div className="flex min-h-screen bg-[#f4f6f3] font-sans text-[#17211f]">
        <Sidebar activeLabel="Data Sources" />
        <main className="min-w-0 flex-1">
          <header className="flex h-20 items-center justify-between border-b border-slate-200/80 bg-[#f8faf7] px-5 sm:px-8">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu />
              </Button>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                  Data operations
                </p>
                <h1 className="mt-1 text-xl font-semibold tracking-tight">
                  Data Sources
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
                <span className="size-2 rounded-full bg-emerald-500" />{" "}
                Monitoring active
              </div>
              <div className="flex size-8 items-center justify-center rounded-full bg-[#d8f36b] text-xs font-bold text-[#17211f]">
                AS
              </div>
            </div>
          </header>
          <div className="mx-auto max-w-[1500px] space-y-6 p-5 sm:p-8">
            <section>
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[#667d16]">
                <span className="size-1.5 rounded-full bg-[#9bb63f]" /> DATA
                OPERATIONS
              </div>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Data Sources
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Connected warehouse and procurement data sources are monitored
                here for freshness, coverage, and quality.
              </p>
            </section>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                label="Connected sources"
                value={dataSources.length.toString().padStart(2, "0")}
                detail="Warehouse and procurement feeds"
                icon={Database}
                tone="bg-blue-50 text-blue-600"
              />
              <SummaryCard
                label="Healthy sources"
                value={dataSources.filter((source) => source.status === "Healthy").length.toString().padStart(2, "0")}
                detail="Ready for AI analysis"
                icon={CheckCircle2}
                tone="bg-emerald-50 text-emerald-600"
              />
              <SummaryCard
                label="Sources with warnings"
                value={dataSources.filter((source) => source.status === "Warning").length.toString().padStart(2, "0")}
                detail="Quality review recommended"
                icon={AlertTriangle}
                tone="bg-amber-50 text-amber-600"
              />
              <SummaryCard
                label="Records processed"
                value={dataSources.reduce((total, source) => total + Number(source.records.replaceAll(",", "")), 0).toLocaleString()}
                detail="Across all connected sources"
                icon={Table2}
                tone="bg-[#eff8c8] text-[#60751a]"
              />
            </section>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.7fr)]">
              <div className="space-y-3">
                <div className="flex items-end justify-between">
                  <div>
                    <h2 className="text-base font-semibold">Source registry</h2>
                    <p className="mt-1 text-xs text-slate-400">
                      {filteredSources.length} of {dataSources.length} sources
                      shown
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="hidden border-slate-200 bg-white text-slate-500 sm:flex"
                  >
                    <Filter className="size-3" /> Live registry
                  </Badge>
                </div>
                <div className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-[0_2px_12px_rgba(23,33,31,0.04)] sm:flex-row">
                  <div className="relative min-w-0 flex-1">
                    <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      aria-label="Search data sources"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search data sources"
                      className="h-8 border-slate-200 pl-9"
                    />
                  </div>
                  <FilterSelect
                    label="Status"
                    value={status}
                    onChange={setStatus}
                    options={["Healthy", "Warning"]}
                  />
                </div>
                <SourceTable
                  records={filteredSources}
                  onSelect={setSelectedSource}
                />
              </div>
              <Card className="h-fit border-0 bg-[#17211f] text-white shadow-[0_2px_12px_rgba(23,33,31,0.08)]">
                <CardHeader className="border-b border-white/10 px-5 pb-3 pt-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#d8f36b]">
                        AI data quality insights
                      </p>
                      <CardTitle className="mt-1 text-white">
                        Feed health
                      </CardTitle>
                    </div>
                    <Sparkles className="size-5 text-[#d8f36b]" />
                  </div>
                </CardHeader>
                <CardContent className="p-5">
                  <p className="text-lg font-semibold">
                    2 sources need attention.
                  </p>
                  <div className="mt-5 space-y-4 text-sm leading-6 text-white/65">
                    <p className="border-l-2 border-amber-300 pl-3">
                      Material_Master has 3.8% incomplete records, including
                      missing units of measure.
                    </p>
                    <p className="border-l-2 border-orange-300 pl-3">
                      Vendor_Master freshness is below the preferred 10-minute
                      sync window.
                    </p>
                    <p className="border-l-2 border-[#d8f36b] pl-3">
                      All six feeds are available for the current control tower
                      snapshot.
                    </p>
                  </div>
                  <Button
                    disabled={isScanning}
                    onClick={runQualityScan}
                    className="mt-6 w-full bg-[#d8f36b] text-[#17211f] hover:bg-[#e5fa9d]"
                  >
                    {isScanning ? <RefreshCw className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                    {isScanning ? "Scanning data quality..." : "Run quality scan"}
                  </Button>
                  {scanNotice && (
                    <output className="mt-3 block text-center text-xs font-medium text-white/70">
                      {scanNotice}
                    </output>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
      <Dialog
        open={Boolean(selectedSource)}
        onOpenChange={(open) => !open && setSelectedSource(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mb-2 flex items-center gap-2">
              <Database className="size-4 text-[#839e24]" />
              <span className="font-mono text-xs text-slate-400">
                Source details
              </span>
            </div>
            <DialogTitle>{selectedSource?.name}</DialogTitle>
            <DialogDescription>
              Workbook-backed monitoring details for this connected data source.
            </DialogDescription>
          </DialogHeader>
          {selectedSource && (
            <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-400">
                  Type
                </p>
                <p className="mt-1 text-sm font-medium text-[#17211f]">
                  {selectedSource.type}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-400">
                  Records
                </p>
                <p className="mt-1 text-sm font-medium text-[#17211f]">
                  {selectedSource.records}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-400">
                  Last sync
                </p>
                <p className="mt-1 text-sm font-medium text-[#17211f]">
                  {selectedSource.lastSync}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-400">
                  Quality coverage
                </p>
                <p className="mt-1 text-sm font-medium text-[#17211f]">
                  {selectedSource.coverage}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-[10px] uppercase tracking-wide text-slate-400">
                  Current status
                </p>
                <div className="mt-1">
                  <SourceStatus status={selectedSource.status} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Close
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
