"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  Bell,
  BrainCircuit,
  Check,
  Gauge,
  Menu,
  RotateCcw,
  Save,
  Settings2,
  SlidersHorizontal,
} from "lucide-react";
import { Sidebar } from "@/components/control-tower-dashboard";
import {
  useSettings,
  type SettingsState,
} from "@/components/settings-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: Readonly<{
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}>) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-slate-200 px-4 py-3 transition-colors hover:bg-slate-50">
      <span>
        <span className="block text-sm font-medium text-[#17211f]">
          {label}
        </span>
        <span className="mt-1 block text-xs leading-5 text-slate-400">
          {description}
        </span>
      </span>
      <span className="relative shrink-0">
        <input
          type="checkbox"
          aria-label={label}
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span className="block h-6 w-11 rounded-full bg-slate-200 transition-colors peer-checked:bg-[#9bb63f] peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50" />
        <span className="absolute left-1 top-1 size-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

function SettingSelect({
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
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <label className="text-sm font-medium text-[#17211f]">{label}</label>
      <Select value={value} onValueChange={(next) => onChange(next ?? value)}>
        <SelectTrigger
          aria-label={label}
          className="w-full border-slate-200 bg-white sm:w-52"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SettingsSection({
  title,
  description,
  icon: Icon,
  children,
}: Readonly<{
  title: string;
  description: string;
  icon: typeof Settings2;
  children: ReactNode;
}>) {
  return (
    <Card className="border-0 bg-white shadow-[0_2px_12px_rgba(23,33,31,0.04)]">
      <CardHeader className="px-5 pb-3 pt-5">
        <div className="flex items-start gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <Icon className="size-4" />
          </div>
          <div>
            <CardTitle>{title}</CardTitle>
            <p className="mt-1 text-xs text-slate-400">{description}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-5 pb-5">{children}</CardContent>
    </Card>
  );
}

export function SettingsPage() {
  const {
    settings: savedSettings,
    hydrated,
    saveSettings,
    resetSettings,
  } = useSettings();
  const [settings, setSettings] = useState(savedSettings);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (hydrated) setSettings(savedSettings);
  }, [hydrated, savedSettings]);
  const update = <K extends keyof SettingsState>(
    key: K,
    value: SettingsState[K],
  ) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };
  const save = () => {
    saveSettings(settings);
    setSaved(true);
  };
  const reset = () => {
    resetSettings();
    setSaved(false);
  };

  return (
    <div className="flex min-h-screen bg-[#f4f6f3] font-sans text-[#17211f]">
      <Sidebar activeLabel="Settings" />
      <main className="min-w-0 flex-1">
        <header className="flex h-20 items-center justify-between border-b border-slate-200/80 bg-[#f8faf7] px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden">
              <Menu />
            </Button>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                Workspace configuration
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight">
                Settings
              </h1>
            </div>
          </div>
          <div className="flex size-8 items-center justify-center rounded-full bg-[#d8f36b] text-xs font-bold text-[#17211f]">
            AS
          </div>
        </header>
        <div className="mx-auto max-w-[1200px] space-y-6 p-5 sm:p-8">
          <section>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[#667d16]">
              <span className="size-1.5 rounded-full bg-[#9bb63f]" /> WORKSPACE
              CONFIGURATION
            </div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Settings
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Configure monitoring, AI recommendations, notifications, and
              workspace preferences.
            </p>
          </section>
          <div className="grid gap-6 lg:grid-cols-2">
            <SettingsSection
              title="Monitoring"
              description="Control how the warehouse signal is collected and evaluated."
              icon={Gauge}
            >
              <ToggleRow
                label="Live monitoring"
                description="Keep operational feeds refreshed while the workspace is open."
                checked={settings.liveMonitoring}
                onChange={(value) => update("liveMonitoring", value)}
              />
              <ToggleRow
                label="Automatic anomaly detection"
                description="Scan incoming records for material and logistics risks."
                checked={settings.automaticDetection}
                onChange={(value) => update("automaticDetection", value)}
              />
              <SettingSelect
                label="Refresh interval"
                value={settings.refreshInterval}
                onChange={(value) => update("refreshInterval", value)}
                options={["1 minute", "5 minutes", "15 minutes", "30 minutes"]}
              />
            </SettingsSection>
            <SettingsSection
              title="AI recommendations"
              description="Tune how recommendations are surfaced to operators."
              icon={BrainCircuit}
            >
              <ToggleRow
                label="AI recommendations"
                description="Generate suggested corrective actions for detected risks."
                checked={settings.recommendations}
                onChange={(value) => update("recommendations", value)}
              />
              <SettingSelect
                label="Confidence threshold"
                value={settings.confidenceThreshold}
                onChange={(value) => update("confidenceThreshold", value)}
                options={["70% and above", "80% and above", "90% and above"]}
              />
              <SettingSelect
                label="Risk prioritization"
                value={settings.riskPrioritization}
                onChange={(value) => update("riskPrioritization", value)}
                options={["Business impact", "Severity", "Confidence"]}
              />
            </SettingsSection>
            <SettingsSection
              title="Notifications"
              description="Choose which operational events reach your team."
              icon={Bell}
            >
              <ToggleRow
                label="Critical anomaly notifications"
                description="Notify the operations team when critical risks are detected."
                checked={settings.criticalNotifications}
                onChange={(value) => update("criticalNotifications", value)}
              />
              <ToggleRow
                label="Approval notifications"
                description="Notify reviewers when recommendations need a decision."
                checked={settings.approvalNotifications}
                onChange={(value) => update("approvalNotifications", value)}
              />
              <ToggleRow
                label="Daily summary"
                description="Receive a daily digest of warehouse health and actions."
                checked={settings.dailySummary}
                onChange={(value) => update("dailySummary", value)}
              />
            </SettingsSection>
            <SettingsSection
              title="Workspace"
              description="Set the default experience for this browser session."
              icon={SlidersHorizontal}
            >
              <SettingSelect
                label="Default landing page"
                value={settings.landingPage}
                onChange={(value) => update("landingPage", value)}
                options={[
                  "Control Tower",
                  "Inventory Health",
                  "Dispatch Flow",
                  "Vendors",
                ]}
              />
              <ToggleRow
                label="Compact view"
                description="Use denser spacing for tables and operational lists."
                checked={settings.compactView}
                onChange={(value) => update("compactView", value)}
              />
            </SettingsSection>
          </div>
          <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center">
            <div className="flex gap-2">
              <Button
                onClick={save}
                className="bg-[#17211f] text-white hover:bg-[#263632]"
              >
                <Save /> Save changes
              </Button>
              <Button variant="outline" onClick={reset}>
                <RotateCcw /> Reset
              </Button>
            </div>
            {saved && (
              <p
                aria-live="polite"
                className="flex items-center gap-2 text-sm text-emerald-700"
              >
                <Check className="size-4" /> Settings saved for this session.
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
