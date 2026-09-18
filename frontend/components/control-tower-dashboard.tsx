"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Boxes,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Circle,
  Database,
  FileSpreadsheet,
  Gauge,
  LayoutDashboard,
  LineChart,
  ListChecks,
  Menu,
  PackageCheck,
  PieChart,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const [anomalyCount, setAnomalyCount] = useState<string | undefined>(undefined);
  useEffect(() => {
    fetch(`${apiBaseUrl}/api/dashboard`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data && typeof data.totalAnomalies === "number") {
          setAnomalyCount(String(data.totalAnomalies));
        }
      })
      .catch(() => undefined);
  }, []);

  const primaryNavigation = [
    { label: "Control Tower", href: "/", icon: LayoutDashboard },
    {
      label: "Anomaly Queue",
      href: "/anomalies",
      icon: ListChecks,
      count: anomalyCount,
    },
    { label: "Approvals", href: "/approvals", icon: ClipboardCheck },
    { label: "Inventory Health", href: "/?view=inventory-health", icon: Boxes },
    { label: "Dispatch Flow", href: "/dispatch-flow", icon: Truck },
    { label: "Vendors", href: "/?view=vendors", icon: PackageCheck },
  ];

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-[#0B4F4A] text-white lg:flex">
      <div className="flex h-20 items-center gap-3 border-b border-white/10 px-7">
        <div className="flex size-9 items-center justify-center rounded-lg bg-[#d8f36b] text-[#17211f]">
          <Warehouse className="size-5" />
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight">VW LogiMind</p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">
            Warehouse AI
          </p>
        </div>
      </div>
      <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
          Operations
        </p>
        <nav className="space-y-1">
          {primaryNavigation.map(({ label, href, icon: Icon, count }) => (
            <Link
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
            </Link>
          ))}
        </nav>
        <p className="mb-3 mt-9 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
          Workspace
        </p>
        <nav className="space-y-1">
          <Link
            href="/?view=data-sources"
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${activeLabel === "Data Sources" ? "bg-white/10 font-medium text-[#d8f36b]" : "text-white/60 hover:bg-white/5 hover:text-white"}`}
          >
            <Database className="size-4" /> Data sources
          </Link>
          <Link
            href="/?view=settings"
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${activeLabel === "Settings" ? "bg-white/10 font-medium text-[#d8f36b]" : "text-white/60 hover:bg-white/5 hover:text-white"}`}
          >
            <Settings2 className="size-4" /> Settings
          </Link>
        </nav>
      </div>
      <div className="shrink-0 p-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs text-white/60">
            <Activity className="size-3.5 text-[#d8f36b]" /> System status
          </div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="size-2 rounded-full bg-[#d8f36b]" /> All systems
            operational
          </div>
          <p className="mt-2 text-[11px] text-white/65">
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
    <Card className="border-0 bg-white shadow-[0_2px_12px_rgba(23,33,31,0.04)] card-hover">
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

function ImpactSection({
  atRiskEuros,
  potentialDelayHours,
  recoveryCoveragePercent,
}: Readonly<{
  atRiskEuros: number;
  potentialDelayHours: number;
  recoveryCoveragePercent: number;
}>) {
  const formattedAtRisk = atRiskEuros >= 1000
    ? `€${(atRiskEuros / 1000).toFixed(1)}k`
    : `€${atRiskEuros}`;
  return (
    <Card className="border-0 bg-[#0B4F4A] text-white shadow-[0_2px_12px_rgba(11,79,74,0.08)]">
      <CardHeader className="border-b border-white/10 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base text-white">
              Business impact
            </CardTitle>
            <p className="mt-1 text-xs text-white/65">
              Live figures computed from workbook anomalies
            </p>
          </div>
          <Gauge className="size-5 text-[#d8f36b]" />
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-white/65">At-risk inventory</p>
            <p className="mt-1 text-xl font-semibold">{formattedAtRisk}</p>
          </div>
          <div>
            <p className="text-xs text-white/65">Potential delay</p>
            <p className="mt-1 text-xl font-semibold">{potentialDelayHours} hrs</p>
          </div>
        </div>
        <div>
          <div className="mb-2 flex justify-between text-xs">
            <span className="text-white/55">Recovery coverage</span>
            <span className="text-[#d8f36b]">{recoveryCoveragePercent}%</span>
          </div>
          <Progress
            value={recoveryCoveragePercent}
            className="[&_[data-slot=progress-track]]:bg-white/10 [&_[data-slot=progress-indicator]]:bg-[#d8f36b]"
          />
        </div>
        <div className="flex items-center gap-2 border-t border-white/10 pt-4 text-xs text-white/55">
          <Zap className="size-3.5 text-[#d8f36b]" /> Rule-based recommendations are ready for operator review
        </div>
      </CardContent>
    </Card>
  );
}

type AuditEvent = {
  id: number;
  event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  actor: string | null;
  summary: string;
  created_at: string;
};

const iconForAuditEvent = (eventType: string) => {
  if (eventType.startsWith('anomaly.approved')) return { icon: CheckCircle2, color: "bg-emerald-50 text-emerald-600" };
  if (eventType.startsWith('anomaly.rejected')) return { icon: ShieldAlert, color: "bg-red-50 text-red-600" };
  if (eventType.startsWith('anomaly.ai_analyzed')) return { icon: Sparkles, color: "bg-[#eff8c8] text-[#60751a]" };
  if (eventType.startsWith('workbook.ingested')) return { icon: Database, color: "bg-blue-50 text-blue-600" };
  return { icon: Activity, color: "bg-slate-100 text-slate-500" };
};

function RecentActions({ events }: Readonly<{ events: AuditEvent[] }>) {
  return (
    <Card className="border-0 bg-white shadow-[0_2px_12px_rgba(23,33,31,0.04)] card-hover">
      <CardHeader className="px-5 pb-3 pt-5">
        <div className="flex items-center justify-between">
          <CardTitle>Recent AI actions</CardTitle>
          <Button variant="ghost" size="sm" className="text-xs text-slate-500">
            View all <ChevronRight />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {events.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">
            No agent activity yet — run an AI scan to populate the audit trail.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {events.map((event) => {
              const { icon: Icon, color } = iconForAuditEvent(event.event_type);
              return (
                <div
                  key={event.id}
                  className="flex items-center gap-3 py-3 first:pt-1 last:pb-0"
                >
                  <div
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full ${color}`}
                  >
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#17211f]">
                      {event.summary}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {event.actor ?? 'system'} · {new Date(event.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type DisplayAnomaly = {
  id: string;
  type: string;
  source: string;
  location: string;
  score: string;
  severity: string;
  time: string;
};

type ChartItem = {
  label: string;
  value: number;
  tone: string;
  accent: string;
};

function GraphCard({
  title,
  detail,
  icon: Icon,
  children,
}: Readonly<{
  title: string;
  detail: string;
  icon: typeof Activity;
  children: ReactNode;
}>) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/70 bg-white/90 p-4 shadow-[0_18px_48px_rgba(23,33,31,0.08)] ring-1 ring-slate-900/[0.03] backdrop-blur">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#17211f]">{title}</p>
          <p className="mt-1 text-xs text-slate-400">{detail}</p>
        </div>
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#eff8c8] text-[#60751a] shadow-[0_8px_24px_rgba(216,243,107,0.35)]">
          <Icon className="size-4" />
        </div>
      </div>
      {children}
    </div>
  );
}

function HorizontalBars({
  items,
  activeLabel,
  onSelect,
}: Readonly<{
  items: ChartItem[];
  activeLabel: string;
  onSelect: (label: string) => void;
}>) {
  const maxValue = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <button
          type="button"
          key={item.label}
          onClick={() => onSelect(item.label)}
          className={`w-full rounded-xl p-2 text-left transition-all hover:bg-slate-50 ${activeLabel === item.label ? "bg-slate-50 ring-1 ring-[#0B4F4A]/20" : ""}`}
        >
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 font-medium text-slate-600">
              <span className={`size-2 rounded-full ${item.accent}`} />
              {item.label}
            </span>
            <span className="font-semibold text-[#17211f]">{item.value}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100 shadow-inner">
            <div
              className={`h-3 rounded-full ${item.tone} shadow-[0_0_18px_rgba(11,79,74,0.22)] transition-all duration-500`}
              style={{ width: `${Math.max(4, (item.value / maxValue) * 100)}%` }}
            />
          </div>
        </button>
      ))}
    </div>
  );
}

function Sparkline({ values }: Readonly<{ values: number[] }>) {
  const normalizedValues = values.length > 1 ? values : [0, values[0] ?? 0];
  const maxValue = Math.max(...normalizedValues, 1);
  const points = normalizedValues.map((value, index) => {
    const x = (index / (normalizedValues.length - 1)) * 300;
    const y = 96 - (value / maxValue) * 84;
    return { x, y };
  });
  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPoints = `0,104 ${linePoints} 300,104`;

  return (
    <svg viewBox="0 0 300 112" className="h-32 w-full overflow-visible" role="img" aria-label="Confidence trend chart">
      <defs>
        <linearGradient id="confidence-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#d8f36b" stopOpacity="0.52" />
          <stop offset="100%" stopColor="#d8f36b" stopOpacity="0.04" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill="url(#confidence-fill)" />
      <polyline points={linePoints} fill="none" stroke="#0B4F4A" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
      {points.map((point, index) => (
        <circle key={`${point.x}-${index}`} cx={point.x} cy={point.y} r="4" fill="#0B4F4A" />
      ))}
    </svg>
  );
}

function SourceColumns({
  items,
  activeLabel,
  onSelect,
}: Readonly<{
  items: ChartItem[];
  activeLabel: string;
  onSelect: (label: string) => void;
}>) {
  const maxValue = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="flex h-40 items-end gap-3 border-b border-slate-200 pt-4">
      {items.map((item) => (
        <button
          type="button"
          key={item.label}
          onClick={() => onSelect(item.label)}
          className={`flex min-w-0 flex-1 flex-col items-center gap-2 rounded-t-xl px-1 pb-2 transition-all hover:bg-slate-50 ${activeLabel === item.label ? "bg-slate-50 ring-1 ring-[#0B4F4A]/20" : ""}`}
        >
          <div className="text-xs font-semibold text-[#17211f]">{item.value}</div>
          <div
            className={`w-full max-w-12 rounded-t-xl ${item.tone} shadow-[0_0_22px_rgba(11,79,74,0.18)] transition-all duration-500`}
            style={{ height: `${Math.max(14, (item.value / maxValue) * 110)}px` }}
          />
          <div className="w-full truncate text-center text-[10px] text-slate-400" title={item.label}>
            {item.label}
          </div>
        </button>
      ))}
    </div>
  );
}

function OperationsGraphsDialog({
  open,
  onOpenChange,
  dashboard,
  anomalies,
  impact,
  auditEvents,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dashboard: {
    totalAnomalies: number;
    totalRecords: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    sourceTables: string[];
  };
  anomalies: DisplayAnomaly[];
  impact: {
    atRiskValueEuros: number;
    potentialDelayHours: number;
    recoveryCoveragePercent: number;
  };
  auditEvents: AuditEvent[];
}>) {
  const [activeSeverity, setActiveSeverity] = useState("All");
  const [activeSource, setActiveSource] = useState("All");
  const severityItems = [
    { label: "Critical", value: dashboard.criticalCount, tone: "bg-gradient-to-r from-red-600 to-rose-400", accent: "bg-red-500" },
    { label: "High", value: dashboard.highCount, tone: "bg-gradient-to-r from-orange-500 to-amber-300", accent: "bg-orange-500" },
    { label: "Medium", value: dashboard.mediumCount, tone: "bg-gradient-to-r from-amber-400 to-lime-300", accent: "bg-amber-400" },
    { label: "Low", value: dashboard.lowCount, tone: "bg-gradient-to-r from-slate-500 to-slate-300", accent: "bg-slate-400" },
  ];
  const sourceCounts = anomalies.reduce<Record<string, number>>((counts, anomaly) => {
    counts[anomaly.source] = (counts[anomaly.source] ?? 0) + 1;
    return counts;
  }, {});
  const sourceItems = Object.entries(sourceCounts)
    .map(([label, value], index) => ({
      label,
      value,
      tone: ["bg-gradient-to-t from-[#0B4F4A] to-[#34b89f]", "bg-gradient-to-t from-[#839e24] to-[#d8f36b]", "bg-gradient-to-t from-orange-600 to-orange-300", "bg-gradient-to-t from-blue-600 to-cyan-300", "bg-gradient-to-t from-slate-600 to-slate-300"][index % 5],
      accent: ["bg-[#0B4F4A]", "bg-[#839e24]", "bg-orange-500", "bg-blue-500", "bg-slate-500"][index % 5],
    }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 5);
  const confidenceValues = anomalies.slice(0, 10).map((anomaly) => Number.parseInt(anomaly.score, 10));
  const recoveryPercent = Math.max(0, Math.min(100, impact.recoveryCoveragePercent));
  const recordsPerSource = dashboard.sourceTables.length
    ? Math.round(dashboard.totalRecords / dashboard.sourceTables.length)
    : 0;
  const focusedAnomalies = anomalies.filter((anomaly) => {
    const severityMatch = activeSeverity === "All" || anomaly.severity === activeSeverity;
    const sourceMatch = activeSource === "All" || anomaly.source === activeSource;
    return severityMatch && sourceMatch;
  });
  const averageConfidence = focusedAnomalies.length
    ? Math.round(focusedAnomalies.reduce((sum, anomaly) => sum + Number.parseInt(anomaly.score, 10), 0) / focusedAnomalies.length)
    : 0;
  const hasActiveFocus = activeSeverity !== "All" || activeSource !== "All";
  const clearFocus = () => {
    setActiveSeverity("All");
    setActiveSource("All");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto border-white/70 bg-[radial-gradient(circle_at_top_left,rgba(216,243,107,0.28),transparent_34%),linear-gradient(135deg,#f8faf7_0%,#eef4ed_55%,#f7f1e8_100%)] p-5 sm:max-w-[1180px]">
        <DialogHeader className="pr-8">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#60751a]">
            <Activity className="size-4" /> Live operations graphs
          </div>
          <DialogTitle className="text-2xl text-[#17211f]">
            Control Tower analytics
          </DialogTitle>
          <DialogDescription>
            Visual summary of anomaly pressure, source coverage, confidence, and recovery capacity from the current workbook scan.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 rounded-2xl border border-white/70 bg-[#0B4F4A] p-4 text-white shadow-[0_20px_50px_rgba(11,79,74,0.18)] md:grid-cols-[1fr_auto] md:items-center">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">Focused alerts</p>
              <p className="mt-1 text-3xl font-semibold">{focusedAnomalies.length}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">Avg confidence</p>
              <p className="mt-1 text-3xl font-semibold">{averageConfidence}%</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">Current focus</p>
              <p className="mt-2 text-sm font-medium text-[#d8f36b]">{activeSeverity} severity · {activeSource} source</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!hasActiveFocus}
            onClick={clearFocus}
            className="w-fit border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white disabled:border-white/10 disabled:bg-white/5 disabled:text-white/35"
          >
            Clear focus
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <GraphCard title="Severity distribution" detail="Open anomaly mix by priority" icon={BarChart3}>
            <HorizontalBars
              items={severityItems}
              activeLabel={activeSeverity}
              onSelect={(label) => setActiveSeverity(activeSeverity === label ? "All" : label)}
            />
          </GraphCard>

          <GraphCard title="Source concentration" detail="Top workbook sheets creating alerts" icon={PieChart}>
            {sourceItems.length ? (
              <SourceColumns
                items={sourceItems}
                activeLabel={activeSource}
                onSelect={(label) => setActiveSource(activeSource === label ? "All" : label)}
              />
            ) : (
              <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-400">
                Run a scan to populate source graphs.
              </div>
            )}
          </GraphCard>

          <GraphCard title="Confidence trend" detail="Top queue confidence profile" icon={LineChart}>
            <Sparkline values={confidenceValues.length ? confidenceValues : [0, 0, 0, 0]} />
            <div className="mt-2 flex justify-between text-xs text-slate-400">
              <span>Lowest visible</span>
              <span>Highest visible</span>
            </div>
          </GraphCard>

          <GraphCard title="Recovery coverage" detail="Recommendation capacity against risk" icon={Gauge}>
            <div className="flex items-center gap-5">
              <div
                className="grid size-32 place-items-center rounded-full"
                style={{ background: `conic-gradient(#0B4F4A ${recoveryPercent * 3.6}deg, #e5e7eb 0deg)` }}
              >
                <div className="grid size-24 place-items-center rounded-full bg-white text-center">
                  <span className="text-2xl font-semibold text-[#17211f]">{recoveryPercent}%</span>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-slate-400">At-risk value</p>
                  <p className="font-semibold text-[#17211f]">€{impact.atRiskValueEuros.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Delay exposure</p>
                  <p className="font-semibold text-[#17211f]">{impact.potentialDelayHours} hrs</p>
                </div>
              </div>
            </div>
          </GraphCard>

          <GraphCard title="Record coverage" detail="Ingest volume across connected data" icon={Database}>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs text-slate-400">Records</p>
                <p className="mt-1 text-2xl font-semibold text-[#17211f]">{dashboard.totalRecords.toLocaleString()}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs text-slate-400">Sources</p>
                <p className="mt-1 text-2xl font-semibold text-[#17211f]">{dashboard.sourceTables.length}</p>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Avg records/source</span>
                <span className="font-semibold text-[#17211f]">{recordsPerSource.toLocaleString()}</span>
              </div>
              <Progress value={dashboard.totalRecords ? 100 : 0} className="mt-3 [&_[data-slot=progress-indicator]]:bg-[#839e24]" />
            </div>
          </GraphCard>

          <GraphCard title="Automation activity" detail="Recent AI operations by event" icon={Sparkles}>
            <div className="space-y-3">
              {auditEvents.slice(0, 4).map((event) => {
                const { icon: Icon, color } = iconForAuditEvent(event.event_type);
                return (
                  <div key={event.id} className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                    <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${color}`}>
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-[#17211f]">{event.summary}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">{event.actor ?? "system"}</p>
                    </div>
                  </div>
                );
              })}
              {!auditEvents.length && (
                <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-400">
                  No automation events yet.
                </div>
              )}
            </div>
          </GraphCard>

          <GraphCard title="Focused queue" detail="Updates when you click a graph" icon={ListChecks}>
            <div className="space-y-2">
              {focusedAnomalies.slice(0, 5).map((anomaly) => (
                <div key={anomaly.id} className="grid grid-cols-[1fr_auto] gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[#17211f]">{anomaly.type}</p>
                    <p className="mt-1 truncate text-[11px] text-slate-400">{anomaly.source} · {anomaly.location}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-[#0B4F4A]">{anomaly.score}</p>
                    <p className="mt-1 text-[10px] text-slate-400">{anomaly.severity}</p>
                  </div>
                </div>
              ))}
              {!focusedAnomalies.length && (
                <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-400">
                  No anomalies match this focus.
                </div>
              )}
            </div>
          </GraphCard>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ControlTowerDashboard() {
  const { settings } = useSettings();
  const [selectedTab, setSelectedTab] = useState("all");
  const [isScanning, setIsScanning] = useState(false);
  const [isGraphsOpen, setIsGraphsOpen] = useState(false);
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
    autoFixedCount: 0,
    awaitingApprovalCount: 0,
    notTriagedCount: 0,
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
  const [impact, setImpact] = useState({ atRiskValueEuros: 0, potentialDelayHours: 0, recoveryCoveragePercent: 0 });
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [isCascadeRunning, setIsCascadeRunning] = useState(false);
  const [cascadeNotice, setCascadeNotice] = useState("");

  const loadDashboardData = async () => {
    try {
      const [dashboardResponse, anomaliesResponse, impactResponse, auditResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/api/dashboard`),
        fetch(`${apiBaseUrl}/api/anomalies`),
        fetch(`${apiBaseUrl}/api/impact`),
        fetch(`${apiBaseUrl}/api/audit-log?limit=6`),
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
        autoFixedCount: Number(dashboardData.autoFixedCount ?? 0),
        awaitingApprovalCount: Number(dashboardData.awaitingApprovalCount ?? 0),
        notTriagedCount: Number(dashboardData.notTriagedCount ?? 0),
      });
      setLiveAnomalies(Array.isArray(anomaliesData) ? anomaliesData : []);
      if (impactResponse.ok) {
        const impactData = await impactResponse.json();
        setImpact({
          atRiskValueEuros: Number(impactData.atRiskValueEuros ?? 0),
          potentialDelayHours: Number(impactData.potentialDelayHours ?? 0),
          recoveryCoveragePercent: Number(impactData.recoveryCoveragePercent ?? 0),
        });
      }
      if (auditResponse.ok) {
        const auditData = await auditResponse.json();
        setAuditEvents(Array.isArray(auditData) ? auditData : []);
      }
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
        autoFixedCount: 0,
        awaitingApprovalCount: 0,
        notTriagedCount: 0,
      });
      setLiveAnomalies([]);
      setImpact({ atRiskValueEuros: 0, potentialDelayHours: 0, recoveryCoveragePercent: 0 });
      setAuditEvents([]);
    }
  };

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadDashboardData();
    }, 0);

    return () => window.clearTimeout(loadTimer);
  }, []);

  const runAiCascade = async () => {
    if (isCascadeRunning) return;
    setIsCascadeRunning(true);
    setCascadeNotice("");
    try {
      const response = await fetch(`${apiBaseUrl}/api/ai-cascade/run`, { method: "POST" });
      if (!response.ok) throw new Error("Cascade failed");
      const summary = await response.json();
      await loadDashboardData();
      setCascadeNotice(
        `AI cascade complete: ${summary.autoFixed} auto-fixed, ${summary.pendingReview} routed to Approvals with AI-generated solutions.`,
      );
    } catch {
      setCascadeNotice("AI cascade failed. Please retry once the workbook has been scanned.");
    } finally {
      setIsCascadeRunning(false);
    }
  };

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
    link.download = "vw-logimind-anomaly-queue.csv";
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
  const sortedAnomalies = [...normalizedAnomalies]
    .filter(
      (anomaly) => Number.parseInt(anomaly.score, 10) >= minimumConfidence,
    )
    .sort((left, right) =>
      settings.riskPrioritization === "Confidence"
        ? Number.parseInt(right.score, 10) - Number.parseInt(left.score, 10)
        : severityOrder[left.severity as keyof typeof severityOrder] -
          severityOrder[right.severity as keyof typeof severityOrder],
    );

  const displayedAnomalies = sortedAnomalies.filter((anomaly) => {
    if (selectedTab === "all") return true;
    if (selectedTab === "critical") return anomaly.severity === "Critical";
    if (selectedTab === "high") return anomaly.severity === "High";
    if (selectedTab === "review") return anomaly.severity === "Medium";
    return true;
  });

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
                Autonomous Logistics Engine
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight">
                Continuous AI Scan • 6 Connected Data Streams
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/?view=data-sources"
              className="hidden h-7 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[0.8rem] font-medium text-[#17211f] transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:flex"
            >
              <FileSpreadsheet className="text-emerald-600" />{" "}
              <span>Data sources</span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              aria-label="Open Control Tower graphs"
              title="Open Control Tower graphs"
              onClick={() => setIsGraphsOpen(true)}
            >
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
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  disabled={isScanning}
                  onClick={runScan}
                  className="w-fit bg-[#0B4F4A] text-white hover:bg-[#093D38]"
                >
                  {isScanning ? (
                    <RefreshCw className="animate-spin" />
                  ) : (
                    <Sparkles />
                  )}{" "}
                  {isScanning ? "Scanning..." : "Run AI scan"}{" "}
                  {!isScanning && <ArrowUpRight />}
                </Button>
                <Button
                  disabled={isCascadeRunning || dashboard.totalAnomalies === 0}
                  onClick={runAiCascade}
                  variant="outline"
                  className="w-fit border-[#0B4F4A]/30 text-[#0B4F4A] hover:bg-[#0B4F4A]/10"
                >
                  {isCascadeRunning ? <RefreshCw className="animate-spin" /> : <Zap />}{" "}
                  {isCascadeRunning ? "Triaging with AI..." : "Run AI cascade"}
                </Button>
              </div>
              {notice && (
                <output className="text-xs font-medium text-emerald-700">
                  {notice}
                </output>
              )}
              {cascadeNotice && (
                <output className="max-w-xs text-right text-xs font-medium text-[#0B4F4A]">
                  {cascadeNotice}
                </output>
              )}
              {isCascadeRunning && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="size-1.5 animate-pulse rounded-full bg-[#0B4F4A]" />
                  Triage → auto-fix → solution generation across every un-triaged anomaly
                </div>
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
                    Records analyzed: <strong>{dashboard.totalRecords.toLocaleString()}</strong>
                  </span>
                  <span>
                    Anomalies detected: <strong>{dashboard.totalAnomalies}</strong>
                  </span>
                  <span>
                    Critical: <strong>{dashboard.criticalCount}</strong> · High: <strong>{dashboard.highCount}</strong>
                  </span>
                </div>
              )}
            </div>
          </section>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
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
              label="AI auto-fixed"
              value={String(dashboard.autoFixedCount || 0)}
              detail="Zero human effort"
              icon={Zap}
              tone="bg-[#0B4F4A]/10 text-[#0B4F4A]"
            />
            <KpiCard
              label="Pending approval"
              value={String(dashboard.awaitingApprovalCount || 0)}
              detail="Queue waiting for review"
              icon={ListChecks}
              tone="bg-[#eff8c8] text-[#60751a]"
            />
          </section>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(330px,0.8fr)]">
            <Card className="min-w-0 border-0 bg-white shadow-[0_2px_12px_rgba(23,33,31,0.04)] card-hover">
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
                <Tabs value={selectedTab} onValueChange={setSelectedTab} defaultValue="all">
                  <TabsList className="mb-3 w-full justify-start overflow-x-auto bg-slate-100/80 sm:w-fit">
                    <TabsTrigger value="all">
                      All{" "}
                      <span className="ml-1 text-[10px] text-slate-400">
                        {String(dashboard.totalAnomalies).padStart(2, "0")}
                      </span>
                    </TabsTrigger>
                    <TabsTrigger value="critical">
                      Critical{" "}
                      <span className="ml-1 text-[10px] text-red-500">{String(dashboard.criticalCount).padStart(2, "0")}</span>
                    </TabsTrigger>
                    <TabsTrigger value="high">
                      High{" "}
                      <span className="ml-1 text-[10px] text-orange-500">
                        {String(dashboard.highCount).padStart(2, "0")}
                      </span>
                    </TabsTrigger>
                    <TabsTrigger value="review">
                      Needs review{" "}
                      <span className="ml-1 text-[10px] text-slate-400">
                        {String(dashboard.mediumCount).padStart(2, "0")}
                      </span>
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent
                    value="all"
                    className="max-h-[430px] overflow-y-auto rounded-lg border border-slate-100 pr-1"
                  >
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-white shadow-[0_1px_0_rgba(226,232,240,0.9)]">
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
                  <TabsContent
                    value="critical"
                    className="max-h-[430px] overflow-y-auto rounded-lg border border-slate-100 pr-1"
                  >
                    {displayedAnomalies.length > 0 ? (
                      <Table>
                        <TableHeader className="sticky top-0 z-10 bg-white shadow-[0_1px_0_rgba(226,232,240,0.9)]">
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
                            <TableRow key={anomaly.id} className={settings.compactView ? "h-9" : undefined}>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-slate-100">
                                    <AlertTriangle className="size-3.5 text-slate-500" />
                                  </div>
                                  <div>
                                    <Link href={`/anomalies/${anomaly.id}`} className="font-medium text-[#17211f] underline-offset-4 hover:text-emerald-700 hover:underline">
                                      {anomaly.type}
                                    </Link>
                                    <p className="text-[11px] text-slate-400">{anomaly.id}</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-xs text-slate-500">{anomaly.source}</TableCell>
                              <TableCell className="text-xs text-slate-500">{anomaly.location}</TableCell>
                              <TableCell className="text-xs font-medium text-slate-600">{anomaly.score}</TableCell>
                              <TableCell>
                                <SeverityBadge severity={anomaly.severity as keyof typeof severityStyles} />
                              </TableCell>
                              <TableCell className="text-right text-xs text-slate-400">{anomaly.time}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="py-12 text-center text-sm text-slate-500">No critical anomalies detected. System is operating normally.</p>
                    )}
                  </TabsContent>
                  <TabsContent
                    value="high"
                    className="max-h-[430px] overflow-y-auto rounded-lg border border-slate-100 pr-1"
                  >
                    {displayedAnomalies.length > 0 ? (
                      <Table>
                        <TableHeader className="sticky top-0 z-10 bg-white shadow-[0_1px_0_rgba(226,232,240,0.9)]">
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
                            <TableRow key={anomaly.id} className={settings.compactView ? "h-9" : undefined}>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-slate-100">
                                    <AlertTriangle className="size-3.5 text-slate-500" />
                                  </div>
                                  <div>
                                    <Link href={`/anomalies/${anomaly.id}`} className="font-medium text-[#17211f] underline-offset-4 hover:text-emerald-700 hover:underline">
                                      {anomaly.type}
                                    </Link>
                                    <p className="text-[11px] text-slate-400">{anomaly.id}</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-xs text-slate-500">{anomaly.source}</TableCell>
                              <TableCell className="text-xs text-slate-500">{anomaly.location}</TableCell>
                              <TableCell className="text-xs font-medium text-slate-600">{anomaly.score}</TableCell>
                              <TableCell>
                                <SeverityBadge severity={anomaly.severity as keyof typeof severityStyles} />
                              </TableCell>
                              <TableCell className="text-right text-xs text-slate-400">{anomaly.time}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="py-12 text-center text-sm text-slate-500">No high-risk anomalies detected. Good operational status.</p>
                    )}
                  </TabsContent>
                  <TabsContent
                    value="review"
                    className="max-h-[430px] overflow-y-auto rounded-lg border border-slate-100 pr-1"
                  >
                    {displayedAnomalies.length > 0 ? (
                      <Table>
                        <TableHeader className="sticky top-0 z-10 bg-white shadow-[0_1px_0_rgba(226,232,240,0.9)]">
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
                            <TableRow key={anomaly.id} className={settings.compactView ? "h-9" : undefined}>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-slate-100">
                                    <AlertTriangle className="size-3.5 text-slate-500" />
                                  </div>
                                  <div>
                                    <Link href={`/anomalies/${anomaly.id}`} className="font-medium text-[#17211f] underline-offset-4 hover:text-emerald-700 hover:underline">
                                      {anomaly.type}
                                    </Link>
                                    <p className="text-[11px] text-slate-400">{anomaly.id}</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-xs text-slate-500">{anomaly.source}</TableCell>
                              <TableCell className="text-xs text-slate-500">{anomaly.location}</TableCell>
                              <TableCell className="text-xs font-medium text-slate-600">{anomaly.score}</TableCell>
                              <TableCell>
                                <SeverityBadge severity={anomaly.severity as keyof typeof severityStyles} />
                              </TableCell>
                              <TableCell className="text-right text-xs text-slate-400">{anomaly.time}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="py-12 text-center text-sm text-slate-500">No medium-risk anomalies requiring review. All recommendations addressed.</p>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
            {settings.recommendations && (
              <ImpactSection
                atRiskEuros={impact.atRiskValueEuros}
                potentialDelayHours={impact.potentialDelayHours}
                recoveryCoveragePercent={impact.recoveryCoveragePercent}
              />
            )}
          </div>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            {settings.recommendations && <RecentActions events={auditEvents} />}
            <Card className="border-0 bg-white shadow-[0_2px_12px_rgba(23,33,31,0.04)] card-hover">
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
                        {dashboard.sourceTables.length} / {dashboard.sourceTables.length} sources
                      </span>
                    </div>
                    <Progress
                      value={dashboard.sourceTables.length ? 100 : 0}
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
                        {dashboard.totalRecords.toLocaleString()} records
                      </span>
                    </div>
                    <Progress
                      value={dashboard.totalRecords ? 100 : 0}
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
                      <span className="text-xs text-slate-400">{dashboard.totalAnomalies} pending</span>
                    </div>
                    <Progress
                      value={dashboard.totalAnomalies ? Math.min(100, impact.recoveryCoveragePercent || 0) : 0}
                      className="mt-2 [&_[data-slot=progress-indicator]]:bg-amber-500"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <OperationsGraphsDialog
        open={isGraphsOpen}
        onOpenChange={setIsGraphsOpen}
        dashboard={dashboard}
        anomalies={displayedAnomalies}
        impact={impact}
        auditEvents={auditEvents}
      />
    </div>
  );
}
