"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock3,
  Filter,
  Menu,
  MessageSquare,
  Search,
  ShieldCheck,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import { type ApprovalItem, type ApprovalStatus } from "@/data/approval-items";
import { useApprovalItems, useUpdateApproval } from "@/lib/approval-store";
import { Sidebar } from "@/components/control-tower-dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const severityClasses = {
  Critical: "border-red-200 bg-red-50 text-red-700",
  High: "border-orange-200 bg-orange-50 text-orange-700",
  Medium: "border-amber-200 bg-amber-50 text-amber-700",
} as const;

const statusClasses = {
  "Pending approval": "border-amber-200 bg-amber-50 text-amber-700",
  Approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Rejected: "border-red-200 bg-red-50 text-red-700",
} as const;

function SeverityBadge({
  severity,
}: Readonly<{ severity: ApprovalItem["severity"] }>) {
  return (
    <Badge variant="outline" className={severityClasses[severity]}>
      <span className="size-1.5 rounded-full bg-current" />
      {severity}
    </Badge>
  );
}

function StatusBadge({ status }: Readonly<{ status: ApprovalStatus }>) {
  const statusIcons = {
    Approved: CheckCircle2,
    Rejected: XCircle,
    "Pending approval": Clock3,
  } as const;
  const Icon = statusIcons[status];
  return (
    <Badge variant="outline" className={statusClasses[status]}>
      <Icon className="size-3" />
      {status}
    </Badge>
  );
}

function QueueSummary({
  label,
  value,
  detail,
  tone,
  icon: Icon,
}: Readonly<{
  label: string;
  value: number;
  detail: string;
  tone: string;
  icon: typeof Clock3;
}>) {
  return (
    <Card className="border-0 bg-white shadow-[0_2px_12px_rgba(23,33,31,0.04)] card-hover">
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-[#17211f]">
            {value.toString().padStart(2, "0")}
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
  const selectedLabel = value === "all" ? `${label}: All` : `${label}: ${value}`;

  return (
    <Select
      value={value}
      onValueChange={(nextValue) => onChange(nextValue ?? "all")}
    >
      <SelectTrigger
        aria-label={label}
        className="w-full border-slate-200 bg-white sm:w-[150px]"
      >
        <span data-slot="select-value" className="flex flex-1 text-left">
          {selectedLabel}
        </span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{label}: All</SelectItem>
        {options.map((option) => (
          <SelectItem value={option} key={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ActionDialog({
  item,
  mode,
  onClose,
  onConfirm,
}: Readonly<{
  item: ApprovalItem | null;
  mode: "approve" | "reject" | null;
  onClose: () => void;
  onConfirm: (comment: string) => void;
}>) {
  const [comment, setComment] = useState("");
  const isApproval = mode === "approve";

  const confirmAction = () => {
    onConfirm(comment);
    setComment("");
  };

  return (
    <Dialog
      open={Boolean(item && mode)}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div
            className={`mb-2 flex size-9 items-center justify-center rounded-lg ${isApproval ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}
          >
            {isApproval ? (
              <ShieldCheck className="size-5" />
            ) : (
              <XCircle className="size-5" />
            )}
          </div>
          <DialogTitle>
            {isApproval
              ? "Approve corrective action?"
              : "Reject recommendation?"}
          </DialogTitle>
          <DialogDescription>
            {isApproval
              ? "This will mark the AI recommendation as approved for execution."
              : "Record why this recommendation should not proceed."}
          </DialogDescription>
        </DialogHeader>
        {item && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#17211f]">
                  {item.name}
                </p>
                <p className="mt-1 font-mono text-xs text-slate-400">
                  {item.id}
                </p>
              </div>
              <SeverityBadge severity={item.severity} />
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {item.recommendation}
            </p>
          </div>
        )}
        <div>
          <label
            htmlFor="approval-comment"
            className="mb-2 block text-xs font-medium text-slate-600"
          >
            {isApproval ? "Optional comment" : "Rejection reason"}
            {!isApproval && <span className="text-red-600"> *</span>}
          </label>
          <Textarea
            id="approval-comment"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder={
              isApproval
                ? "Add context for the operations team..."
                : "Explain why this recommendation is being rejected..."
            }
          />
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            disabled={!isApproval && !comment.trim()}
            onClick={confirmAction}
            className={
              isApproval
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                : "bg-red-600 text-white hover:bg-red-700"
            }
          >
            {isApproval ? <Check /> : <X />}
            {isApproval ? "Approve action" : "Reject recommendation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ApprovalsPage() {
  const items = useApprovalItems();
  const updateApproval = useUpdateApproval();
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("all");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [activeItem, setActiveItem] = useState<ApprovalItem | null>(null);
  const [dialogMode, setDialogMode] = useState<"approve" | "reject" | null>(
    null,
  );
  const categories = [...new Set(items.map((item) => item.category))];
  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        const query = search.toLowerCase();
        const matchesSearch =
          !query ||
          [item.name, item.id, item.recommendation, item.impact].some((value) =>
            value.toLowerCase().includes(query),
          );
        return (
          matchesSearch &&
          (severity === "all" || item.severity === severity) &&
          (category === "all" || item.category === category) &&
          (status === "all" || item.status === status)
        );
      }),
    [category, items, search, severity, status],
  );
  const hasActiveFilters = Boolean(search.trim()) || severity !== "all" || category !== "all" || status !== "all";
  const clearFilters = () => {
    setSearch("");
    setSeverity("all");
    setCategory("all");
    setStatus("all");
  };
  const updateStatus = (comment: string) => {
    if (!activeItem || !dialogMode) return;
    const nextStatus: ApprovalStatus =
      dialogMode === "approve" ? "Approved" : "Rejected";
    updateApproval(activeItem.id, nextStatus, comment);
    setActiveItem(null);
    setDialogMode(null);
  };
  const openAction = (item: ApprovalItem, mode: "approve" | "reject") => {
    setActiveItem(item);
    setDialogMode(mode);
  };

  return (
    <div className="flex min-h-screen bg-[#f4f6f3] font-sans text-[#17211f]">
      <Sidebar activeLabel="" />
      <main className="min-w-0 flex-1">
        <header className="flex h-20 items-center justify-between border-b border-slate-200/80 bg-[#f8faf7] px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden">
              <Menu />
            </Button>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                Governance workspace
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight">
                Approvals
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
              <span className="size-2 rounded-full bg-emerald-500" /> Review
              queue synced
            </div>
            <div className="flex size-8 items-center justify-center rounded-full bg-[#d8f36b] text-xs font-bold text-[#17211f]">
              VW
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-[1500px] space-y-6 p-5 sm:p-8">
          <section>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[#667d16]">
              <span className="size-1.5 rounded-full bg-[#9bb63f]" />{" "}
              HUMAN-IN-THE-LOOP CONTROL
            </div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Approvals
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Review rule-based recommendations before corrective action. Generate LLM analysis from an individual investigation when configured.
            </p>
          </section>
          <section className="grid gap-4 md:grid-cols-3">
            <QueueSummary
              label="Pending approval"
              value={
                items.filter((item) => item.status === "Pending approval")
                  .length
              }
              detail="Requires operator decision"
              icon={Clock3}
              tone="bg-amber-50 text-amber-600"
            />
            <QueueSummary
              label="Approved"
              value={items.filter((item) => item.status === "Approved").length}
              detail="Ready for execution"
              icon={CheckCircle2}
              tone="bg-emerald-50 text-emerald-600"
            />
            <QueueSummary
              label="Rejected"
              value={items.filter((item) => item.status === "Rejected").length}
              detail="Returned for review"
              icon={XCircle}
              tone="bg-red-50 text-red-600"
            />
          </section>
          <Card className="border-0 bg-white shadow-[0_2px_12px_rgba(23,33,31,0.04)] card-hover">
            <CardContent className="p-4">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Filter className="size-4 text-slate-400" /> Filter approval
                  queue
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!hasActiveFilters}
                  onClick={clearFilters}
                  className="w-fit border-slate-200 bg-white text-xs"
                >
                  <X className="size-3.5" /> Clear filters
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search recommendations"
                    className="h-8 border-slate-200 pl-9"
                  />
                  {search && (
                    <button
                      type="button"
                      aria-label="Clear search"
                      onClick={() => setSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
                <FilterSelect
                  label="Severity"
                  value={severity}
                  onChange={setSeverity}
                  options={["Critical", "High", "Medium"]}
                />
                <FilterSelect
                  label="Category"
                  value={category}
                  onChange={setCategory}
                  options={categories}
                />
                <FilterSelect
                  label="Status"
                  value={status}
                  onChange={setStatus}
                  options={["Pending approval", "Approved", "Rejected"]}
                />
              </div>
            </CardContent>
          </Card>
          <section>
            <div className="mb-3 flex items-end justify-between">
              <div>
                <h3 className="text-base font-semibold">
                  Recommendation queue
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  {filteredItems.length} of {items.length} recommendations shown
                </p>
              </div>
              <Badge
                variant="outline"
                className="hidden border-[#d8f36b] bg-[#f5fbdc] text-[#667d16] sm:flex"
              >
                <Sparkles className="size-3" /> Rule-ranked by impact
              </Badge>
            </div>
            <div className="space-y-3">
              {filteredItems.map((item) => (
                <Card
                  key={item.id}
                  className="border-0 bg-white shadow-[0_2px_12px_rgba(23,33,31,0.04)]"
                >
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-semibold text-[#17211f]">
                            {item.name}
                          </h4>
                          <span className="font-mono text-[11px] text-slate-400">
                            {item.id}
                          </span>
                          <SeverityBadge severity={item.severity} />
                          <StatusBadge status={item.status} />
                        </div>
                        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                          <div className="sm:col-span-2 lg:col-span-2">
                            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                              <Sparkles className="size-3 text-[#839e24]" /> {item.recommendationSource === "llm" ? "AI recommendation" : "Rule recommendation"}
                            </div>
                            <p className="mt-1 text-sm leading-6 text-slate-600">
                              {item.recommendation}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                              Business impact
                            </p>
                            <p className="mt-1 text-sm font-medium text-[#17211f]">
                              {item.impact}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                              Confidence
                            </p>
                            <p className="mt-1 text-sm font-semibold text-[#17211f]">
                              {item.confidence}%
                            </p>
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-[#9bb63f]"
                                style={{ width: `${item.confidence}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                          <span className="flex items-center gap-1.5">
                            <Clock3 className="size-3.5" /> Detected{" "}
                            {item.detected}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Filter className="size-3.5" /> {item.category}
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-slate-100 pt-4 xl:w-[330px] xl:justify-end xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
                        <Link
                          href={`/anomalies/${item.id}`}
                          className="inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-background px-2.5 text-xs font-medium whitespace-nowrap text-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          <ArrowUpRight className="size-3.5" /> View
                          investigation
                        </Link>
                        {item.status === "Pending approval" && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => openAction(item, "approve")}
                              className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            >
                              <Check /> Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openAction(item, "reject")}
                              className="border-red-200 text-red-700 hover:bg-red-50"
                            >
                              <X /> Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {filteredItems.length === 0 && (
              <Card className="border-0 bg-white card-hover">
                <CardContent className="py-14 text-center">
                  <MessageSquare className="mx-auto size-7 text-slate-300" />
                  <p className="mt-3 text-sm font-medium text-slate-600">
                    No approvals match these filters
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Try clearing a filter or changing the search.
                  </p>
                </CardContent>
              </Card>
            )}
          </section>
        </div>
      </main>
      <ActionDialog
        key={`${activeItem?.id ?? "none"}-${dialogMode ?? "none"}`}
        item={activeItem}
        mode={dialogMode}
        onClose={() => {
          setActiveItem(null);
          setDialogMode(null);
        }}
        onConfirm={updateStatus}
      />
    </div>
  );
}
