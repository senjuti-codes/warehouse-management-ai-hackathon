"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Circle,
  Clock3,
  Database,
  FileSpreadsheet,
  Gauge,
  LayoutDashboard,
  ListChecks,
  Menu,
  PackageCheck,
  RefreshCw,
  Settings2,
  ShieldAlert,
  Sparkles,
  Truck,
  Warehouse,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSettings } from "@/components/settings-provider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const severityStyles = {
  Critical: "border-red-200 bg-red-50 text-red-700",
  High: "border-orange-200 bg-orange-50 text-orange-700",
  Medium: "border-amber-200 bg-amber-50 text-amber-700",
  Low: "border-slate-200 bg-slate-50 text-slate-600",
};

const scanStages = [
  "Analyzing warehouse data...",
  "Detecting anomalies...",
  "Correlating records...",
  "Prioritizing business impact...",
] as const;

function SeverityBadge({
  severity,
}: Readonly<{ severity: keyof typeof severityStyles }>) {
  return (
    <Badge variant="outline" className={severityStyles[severity]}>
      <span className="size-1.5 rounded-full bg-current" />
      {severity}
    </Badge>
  );
}

export function Sidebar({
  activeLabel = "Control Tower",
}: Readonly<{ activeLabel?: string }>) {
  const primaryNavigation = [
    { label: "Control Tower", href: "/", icon: LayoutDashboard },
    {
      label: "Anomaly Queue",
      href: "/anomalies",
      icon: ListChecks,
      count: "12",
    },
    { label: "Approvals", href: "/approvals", icon: ClipboardCheck },
    { label: "Inventory Health", href: "/?view=inventory-health", icon: Boxes },
    { label: "Dispatch Flow", href: "/dispatch-flow", icon: Truck },
    { label: "Vendors", href: "/?view=vendors", icon: PackageCheck },
  ];

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-[#17211f] text-white lg:flex">
      <div className="flex h-20 items-center gap-3 border-b border-white/10 px-7">
        <div className="flex size-9 items-center justify-center rounded-lg bg-[#d8f36b] text-[#17211f]">
          <Warehouse className="size-5" />
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight">NEXUS</p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">
            Warehouse AI
          </p>
        </div>
      </div>
      <div className="px-4 py-7">
        <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
          Operations
        </p>
        <nav className="space-y-1">
          {primaryNavigation.map(({ label, href, icon: Icon, count }) => (
            <a
              key={label}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${label === activeLabel || (activeLabel === "" && label === "Approvals") ? "bg-white/10 font-medium text-[#d8f36b]" : "text-white/60 hover:bg-white/5 hover:text-white"}`}
            >
              <Icon className="size-4" />
              <span className="flex-1">{label}</span>
              {count && (
                <span className="rounded bg-[#d8f36b]/15 px-1.5 py-0.5 text-[10px] text-[#d8f36b]">
                  {count}
                </span>
              )}
            </a>
          ))}
        </nav>
        <p className="mb-3 mt-9 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
          Workspace
        </p>
        <nav className="space-y-1">
          <a
            href="/?view=data-sources"
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${activeLabel === "Data Sources" ? "bg-white/10 font-medium text-[#d8f36b]" : "text-white/60 hover:bg-white/5 hover:text-white"}`}
          >
            <Database className="size-4" /> Data sources
          </a>
          <a
            href="/?view=settings"
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${activeLabel === "Settings" ? "bg-white/10 font-medium text-[#d8f36b]" : "text-white/60 hover:bg-white/5 hover:text-white"}`}
          >
            <Settings2 className="size-4" /> Settings
          </a>
        </nav>
      </div>
      <div className="mt-auto p-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs text-white/60">
            <Activity className="size-3.5 text-[#d8f36b]" /> System status
          </div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="size-2 rounded-full bg-[#d8f36b]" /> All systems
            operational
          </div>
          <p className="mt-2 text-[11px] text-white/40">
            Last sync 2 minutes ago
          </p>
        </div>
      </div>
    </aside>
  );
}

function KpiCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: Readonly<{
  label: string;
  value: string;
  detail: string;
  icon: typeof Activity;
  tone: string;
}>) {
  return (
    <Card className="border-0 bg-white shadow-[0_2px_12px_rgba(23,33,31,0.04)]">
      <CardContent className="p-5">
        <div className="mb-5 flex items-start justify-between">
          <div
            className={`flex size-9 items-center justify-center rounded-lg ${tone}`}
          >
            <Icon className="size-4" />
          </div>
          <ArrowUpRight className="size-4 text-slate-300" />
        </div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-[#17211f]">
          {value}
        </p>
        <p className="mt-2 text-xs text-slate-400">{detail}</p>
      </CardContent>
    </Card>
  );
}

function ImpactSection() {
  return (
    <Card className="border-0 bg-[#17211f] text-white shadow-[0_2px_12px_rgba(23,33,31,0.08)]">
      <CardHeader className="border-b border-white/10 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base text-white">
              Business impact
            </CardTitle>
            <p className="mt-1 text-xs text-white/45">
              Estimated value protected by AI interventions
            </p>
          </div>
          <Gauge className="size-5 text-[#d8f36b]" />
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-white/45">At-risk inventory</p>
            <p className="mt-1 text-xl font-semibold">€184.2k</p>
          </div>
          <div>
            <p className="text-xs text-white/45">Potential delay</p>
            <p className="mt-1 text-xl font-semibold">36 hrs</p>
          </div>
        </div>
        <div>
          <div className="mb-2 flex justify-between text-xs">
            <span className="text-white/55">Recovery coverage</span>
            <span className="text-[#d8f36b]">78%</span>
          </div>
          <Progress
            value={78}
            className="[&_[data-slot=progress-track]]:bg-white/10 [&_[data-slot=progress-indicator]]:bg-[#d8f36b]"
          />
        </div>
        <div className="flex items-center gap-2 border-t border-white/10 pt-4 text-xs text-white/55">
          <Zap className="size-3.5 text-[#d8f36b]" /> 14 recommendations ready
          to prevent €42k in avoidable cost
        </div>
      </CardContent>
    </Card>
  );
}

function RecentActions() {
  const actions: Array<{ icon: typeof CheckCircle2; label: string; meta: string; color: string }> = [];
  return (
    <Card className="border-0 bg-white shadow-[0_2px_12px_rgba(23,33,31,0.04)]">
      <CardHeader className="px-5 pb-3 pt-5">
        <div className="flex items-center justify-between">
          <CardTitle>Recent AI actions</CardTitle>
          <Button variant="ghost" size="sm" className="text-xs text-slate-500">
            View all <ChevronRight />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="divide-y divide-slate-100">
          {actions.map(({ icon: Icon, label, meta, color }) => (
            <div
              key={label}
              className="flex items-center gap-3 py-3 first:pt-1 last:pb-0"
            >
              <div
                className={`flex size-8 shrink-0 items-center justify-center rounded-full ${color}`}
              >
                <Icon className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[#17211f]">
                  {label}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">{meta}</p>
              </div>
              <CheckCircle2 className="ml-auto size-4 shrink-0 text-emerald-500" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function ControlTowerDashboard() {
  const { settings } = useSettings();
  const [isScanning, setIsScanning] = useState(false);
  const [notice, setNotice] = useState("");
  const [scanStatus, setScanStatus] = useState("");
  const [hasScanResult, setHasScanResult] = useState(false);
  const [dashboard, setDashboard] = useState({
    totalAnomalies: 0,
    totalRecords: 0,
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    lastUpdated: "",
    sourceTables: [] as string[],
  });
  const [liveAnomalies, setLiveAnomalies] = useState<Array<{
    id: number;
    type: string;
    severity: string;
    sheet: string;
    message: string;
    evidence?: string;
    business_key?: string;
    created_at?: string;
  }>>([]);

  const loadDashboardData = async () => {
    try {
      const [dashboardResponse, anomaliesResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/api/dashboard`),
        fetch(`${apiBaseUrl}/api/anomalies`),
      ]);

      if (!dashboardResponse.ok || !anomaliesResponse.ok) {
        throw new Error("Unable to load dashboard data");
      }

      const dashboardData = await dashboardResponse.json();
      const anomaliesData = await anomaliesResponse.json();
      setDashboard({
        totalAnomalies: Number(dashboardData.totalAnomalies ?? 0),
        totalRecords: Number(dashboardData.totalRecords ?? 0),
        criticalCount: Number(dashboardData.criticalCount ?? 0),
        highCount: Number(dashboardData.highCount ?? 0),
        mediumCount: Number(dashboardData.mediumCount ?? 0),
        lowCount: Number(dashboardData.lowCount ?? 0),
        lastUpdated: dashboardData.lastUpdated ?? new Date().toISOString(),
        sourceTables: Array.isArray(dashboardData.sourceTables) ? dashboardData.sourceTables : [],
      });
      setLiveAnomalies(Array.isArray(anomaliesData) ? anomaliesData : []);
    } catch {
      setDashboard({
        totalAnomalies: 0,
        totalRecords: 0,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        lastUpdated: "",
        sourceTables: [],
      });
      setLiveAnomalies([]);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const runScan = async () => {
    if (isScanning) return;
    setIsScanning(true);
    setNotice("");
    setScanStatus(scanStages[0]);
    setHasScanResult(false);

    try {
      const response = await fetch(`${apiBaseUrl}/api/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error("Ingest failed");
      }

      for (let stageIndex = 1; stageIndex < scanStages.length; stageIndex += 1) {
        setScanStatus(scanStages[stageIndex]);
        await new Promise((resolve) => window.setTimeout(resolve, 450));
      }

      await loadDashboardData();
      setIsScanning(false);
      setScanStatus("");
      setNotice("AI scan completed ✓");
      setHasScanResult(true);
    } catch {
      setIsScanning(false);
      setScanStatus("");
      setNotice("AI scan failed. Please retry.");
    }
  };

  const exportQueue = () => {
    const headers = [
      "Anomaly ID",
      "Anomaly",
      "Source",
      "Location",
      "Confidence",
      "Severity",
      "Status",
    ];
    const escapeCsv = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const rows = displayedAnomalies.map((anomaly) => [
      anomaly.id,
      anomaly.type,
      anomaly.source,
      anomaly.location,
      anomaly.score,
      anomaly.severity,
      "Open",
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "nexus-anomaly-queue.csv";
    link.click();
    URL.revokeObjectURL(url);
    setNotice("Anomaly queue exported successfully.");
  };

  const formatSeverity = (value?: string) => {
    const normalized = (value ?? "Medium").toLowerCase();
    if (normalized === "critical") return "Critical";
    if (normalized === "high") return "High";
    if (normalized === "medium") return "Medium";
    if (normalized === "low") return "Low";
    return "Medium";
  };

  const normalizedAnomalies = liveAnomalies.length
    ? liveAnomalies.map((anomaly) => ({
        id: `AN-${String(anomaly.id).padStart(4, "0")}`,
        type: anomaly.message,
        source: anomaly.sheet,
        location: anomaly.business_key ?? anomaly.sheet,
        score: `${Math.max(65, Math.min(99, 65 + anomaly.id))}%`,
        severity: formatSeverity(anomaly.severity),
        time: anomaly.created_at ? new Date(anomaly.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "just now",
      }))
    : [];

  const minimumConfidence = Number.parseInt(settings.confidenceThreshold, 10);
  const severityOrder = { Critical: 1, High: 2, Medium: 3, Low: 4 };
  const displayedAnomalies = [...normalizedAnomalies]
    .filter(
      (anomaly) => Number.parseInt(anomaly.score, 10) >= minimumConfidence,
    )
    .sort((left, right) =>
      settings.riskPrioritization === "Confidence"
        ? Number.parseInt(right.score, 10) - Number.parseInt(left.score, 10)
        : severityOrder[left.severity as keyof typeof severityOrder] -
          severityOrder[right.severity as keyof typeof severityOrder],
    );

  return (
    <div className="flex min-h-screen bg-[#f4f6f3] font-sans text-[#17211f]">
      <Sidebar />
      <main className="min-w-0 flex-1">
        <header className="flex h-20 items-center justify-between border-b border-slate-200/80 bg-[#f8faf7] px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden">
              <Menu />
            </Button>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                Tuesday, September 15, 2026
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight">
                Good morning, Alex
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Button
              variant="outline"
              size="sm"
              className="hidden border-slate-200 bg-white sm:flex"
            >
              <FileSpreadsheet className="text-emerald-600" />{" "}
              <span>Data sources</span>
            </Button>
            <Button variant="ghost" size="icon" className="relative">
              <Activity />
              {settings.criticalNotifications && (
                <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-orange-500 ring-2 ring-[#f8faf7]" />
              )}
            </Button>
            <div className="flex size-8 items-center justify-center rounded-full bg-[#d8f36b] text-xs font-bold text-[#17211f]">
              AS
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-[1500px] space-y-6 p-5 sm:p-8">
          <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-emerald-700">
                <span
                  className={`size-1.5 rounded-full ${settings.liveMonitoring ? "bg-emerald-500" : "bg-slate-400"}`}
                />
                {settings.liveMonitoring
                  ? "LIVE MONITORING"
                  : "MONITORING PAUSED"}
              </div>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Control Tower
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                One view of warehouse health, risks, and next best actions.
              </p>
              {!settings.automaticDetection && (
                <p className="mt-2 text-xs font-medium text-amber-700">
                  Automatic anomaly detection is disabled.
                </p>
              )}
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <Button
                disabled={isScanning}
                onClick={runScan}
                className="w-fit bg-[#17211f] text-white hover:bg-[#263632]"
              >
                {isScanning ? (
                  <RefreshCw className="animate-spin" />
                ) : (
                  <Sparkles />
                )}{" "}
                {isScanning ? "Scanning..." : "Run AI scan"}{" "}
                {!isScanning && <ArrowUpRight />}
              </Button>
              {notice && (
                <output className="text-xs font-medium text-emerald-700">
                  {notice}
                </output>
              )}
              {isScanning && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="size-1.5 animate-pulse rounded-full bg-[#9bb63f]" />
                  {scanStatus}
                </div>
              )}
              {hasScanResult && !isScanning && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-[11px] text-emerald-800 sm:grid-cols-4">
                  <span>
                    Last scan: <strong>Just now</strong>
                  </span>
                  <span>
                    Records analyzed: <strong>48,291</strong>
                  </span>
                  <span>
                    New anomalies: <strong>3</strong>
                  </span>
                  <span>
                    Critical: <strong>1</strong> · High: <strong>2</strong>
                  </span>
                </div>
              )}
            </div>
          </section>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Total records"
              value={dashboard.totalRecords ? dashboard.totalRecords.toLocaleString() : "0"}
              detail={`Across ${dashboard.sourceTables.length || 0} connected sources`}
              icon={Database}
              tone="bg-blue-50 text-blue-600"
            />
            <KpiCard
              label="Critical anomalies"
              value={String(dashboard.criticalCount || 0)}
              detail={dashboard.lastUpdated ? `Updated ${new Date(dashboard.lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Awaiting scan"}
              icon={ShieldAlert}
              tone="bg-red-50 text-red-600"
            />
            <KpiCard
              label="High risk"
              value={String(dashboard.highCount || 0)}
              detail={dashboard.totalAnomalies ? `${dashboard.totalAnomalies} total alerts` : "No alerts"}
              icon={AlertTriangle}
              tone="bg-orange-50 text-orange-600"
            />
            <KpiCard
              label="Pending approval"
              value={String(Math.max(dashboard.totalAnomalies - dashboard.criticalCount, 0))}
              detail="Queue waiting for review"
              icon={ListChecks}
              tone="bg-[#eff8c8] text-[#60751a]"
            />
          </section>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(330px,0.8fr)]">
            <Card className="min-w-0 border-0 bg-white shadow-[0_2px_12px_rgba(23,33,31,0.04)]">
              <CardHeader className="px-5 pb-3 pt-5">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <CardTitle>AI priority anomaly queue</CardTitle>
                    <p className="mt-1 text-xs text-slate-400">
                      Ranked by urgency, confidence, and business impact
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportQueue}
                    className="w-fit border-slate-200 text-xs"
                  >
                    Export queue <ArrowUpRight />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <Tabs defaultValue="all">
                  <TabsList className="mb-3 w-full justify-start overflow-x-auto bg-slate-100/80 sm:w-fit">
                    <TabsTrigger value="all">
                      All{" "}
                      <span className="ml-1 text-[10px] text-slate-400">
                        12
                      </span>
                    </TabsTrigger>
                    <TabsTrigger value="critical">
                      Critical{" "}
                      <span className="ml-1 text-[10px] text-red-500">07</span>
                    </TabsTrigger>
                    <TabsTrigger value="high">
                      High{" "}
                      <span className="ml-1 text-[10px] text-orange-500">
                        23
                      </span>
                    </TabsTrigger>
                    <TabsTrigger value="review">
                      Needs review{" "}
                      <span className="ml-1 text-[10px] text-slate-400">
                        14
                      </span>
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="all">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Anomaly</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Confidence</TableHead>
                          <TableHead>Severity</TableHead>
                          <TableHead className="text-right">Detected</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {displayedAnomalies.map((anomaly) => (
                          <TableRow
                            key={anomaly.id}
                            className={settings.compactView ? "h-9" : undefined}
                          >
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-slate-100">
                                  <AlertTriangle className="size-3.5 text-slate-500" />
                                </div>
                                <div>
                                  <Link
                                    href={`/anomalies/${anomaly.id}`}
                                    className="font-medium text-[#17211f] underline-offset-4 hover:text-emerald-700 hover:underline"
                                  >
                                    {anomaly.type}
                                  </Link>
                                  <p className="text-[11px] text-slate-400">
                                    {anomaly.id}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-slate-500">
                              {anomaly.source}
                            </TableCell>
                            <TableCell className="text-xs text-slate-500">
                              {anomaly.location}
                            </TableCell>
                            <TableCell className="text-xs font-medium text-slate-600">
                              {anomaly.score}
                            </TableCell>
                            <TableCell>
                              <SeverityBadge
                                severity={
                                  anomaly.severity as keyof typeof severityStyles
                                }
                              />
                            </TableCell>
                            <TableCell className="text-right text-xs text-slate-400">
                              {anomaly.time}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TabsContent>
                  <TabsContent value="critical">
                    <p className="py-12 text-center text-sm text-slate-500">
                      7 critical anomalies require immediate attention.
                    </p>
                  </TabsContent>
                  <TabsContent value="high">
                    <p className="py-12 text-center text-sm text-slate-500">
                      23 high-risk anomalies are being monitored.
                    </p>
                  </TabsContent>
                  <TabsContent value="review">
                    <p className="py-12 text-center text-sm text-slate-500">
                      14 recommendations are waiting for approval.
                    </p>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
            {settings.recommendations && <ImpactSection />}
          </div>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            {settings.recommendations && <RecentActions />}
            <Card className="border-0 bg-white shadow-[0_2px_12px_rgba(23,33,31,0.04)]">
              <CardHeader className="px-5 pb-3 pt-5">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Pipeline health</CardTitle>
                    <p className="mt-1 text-xs text-slate-400">
                      Ingest → Detect → Correlate → Act
                    </p>
                  </div>
                  <Button variant="ghost" size="icon-sm">
                    <Settings2 />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 px-5 pb-5">
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    <CheckCircle2 className="size-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm">
                      <span>Data ingest</span>
                      <span className="text-xs text-slate-400">
                        6 / 6 sources
                      </span>
                    </div>
                    <Progress
                      value={100}
                      className="mt-2 [&_[data-slot=progress-indicator]]:bg-emerald-500"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    <CheckCircle2 className="size-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm">
                      <span>AI detection</span>
                      <span className="text-xs text-slate-400">
                        48,291 records
                      </span>
                    </div>
                    <Progress
                      value={94}
                      className="mt-2 [&_[data-slot=progress-indicator]]:bg-emerald-500"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                    <Circle className="size-3.5 fill-current" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm">
                      <span>Recommendations</span>
                      <span className="text-xs text-slate-400">14 pending</span>
                    </div>
                    <Progress
                      value={78}
                      className="mt-2 [&_[data-slot=progress-indicator]]:bg-amber-500"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
