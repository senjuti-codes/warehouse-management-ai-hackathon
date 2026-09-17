"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  Database,
  FileCheck2,
  GitBranch,
  Menu,
  MessageSquarePlus,
  Package,
  Route,
  ShieldAlert,
  Sparkles,
  Truck,
  UserCheck,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { Sidebar } from "@/components/control-tower-dashboard";
import { useApprovalDecision, useUpdateApproval } from "@/lib/approval-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const severityClass = "border-red-200 bg-red-50 text-red-700";
const approvalBadgeClasses = {
  "Pending approval": "h-6 border-amber-200 bg-amber-50 text-amber-700",
  Approved: "h-6 border-emerald-200 bg-emerald-50 text-emerald-700",
  Rejected: "h-6 border-red-200 bg-red-50 text-red-700",
} as const;

function SectionHeading({
  eyebrow,
  title,
  icon: Icon,
}: Readonly<{ eyebrow: string; title: string; icon: typeof Database }>) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
        <Icon className="size-4" />
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-base font-semibold text-[#17211f]">{title}</h2>
      </div>
    </div>
  );
}

function EvidenceField({
  label,
  value,
  emphasis = false,
}: Readonly<{ label: string; value: string; emphasis?: boolean }>) {
  return (
    <div className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p
        className={`mt-1 text-sm ${emphasis ? "font-semibold text-red-700" : "font-medium text-[#17211f]"}`}
      >
        {value}
      </p>
    </div>
  );
}

function AgentStep({
  name,
  detail,
  time,
  state,
  last = false,
}: Readonly<{
  name: string;
  detail: string;
  time: string;
  state: "complete" | "pending";
  last?: boolean;
}>) {
  return (
    <div className="relative flex gap-3">
      {!last && (
        <span className="absolute left-3.5 top-8 h-8 w-px bg-slate-200" />
      )}
      <div
        className={`z-10 flex size-7 shrink-0 items-center justify-center rounded-full ${state === "complete" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}
      >
        {state === "complete" ? (
          <Check className="size-3.5" />
        ) : (
          <CircleDot className="size-3.5" />
        )}
      </div>
      <div className="min-w-0 flex-1 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-x-3">
          <p className="text-sm font-medium text-[#17211f]">{name}</p>
          <span className="text-[11px] text-slate-400">{time}</span>
        </div>
        <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
      </div>
    </div>
  );
}

function CorrelationNode({
  icon: Icon,
  label,
  record,
  tone,
}: Readonly<{
  icon: typeof Truck;
  label: string;
  record: string;
  tone: string;
}>) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(23,33,31,0.03)]">
      <div
        className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tone}`}
      >
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {label}
        </p>
        <p className="mt-1 truncate text-sm font-semibold text-[#17211f]">
          {record}
        </p>
      </div>
    </div>
  );
}

export function AnomalyInvestigation() {
  const approval = useApprovalDecision("AN-2016");
  const updateApproval = useUpdateApproval();
  const [comment, setComment] = useState("");
  const [commentSaved, setCommentSaved] = useState(false);

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
                Investigation workspace
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight">
                Anomaly Investigation
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
              <span className="size-2 rounded-full bg-emerald-500" /> AI agents
              online
            </div>
            <div className="flex size-8 items-center justify-center rounded-full bg-[#d8f36b] text-xs font-bold text-[#17211f]">
              AS
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-[1500px] space-y-6 p-5 sm:p-8">
          <Link
            href="/anomalies"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-[#17211f]"
          >
            <ArrowLeft className="size-4" /> Back to Anomaly Center
          </Link>
          <section className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200/80 bg-[#f8faf7] p-5 sm:flex-row sm:items-start sm:p-6">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={`${severityClass} h-6`}>
                  <span className="size-1.5 rounded-full bg-current" />{" "}
                  Critical
                </Badge>
                <Badge
                  variant="outline"
                  className={approvalBadgeClasses[approval]}
                >
                  <Clock3 className="size-3" />
                  {approval}
                </Badge>
                <span className="font-mono text-xs text-slate-400">
                  AN-2016
                </span>
              </div>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Dispatch Quantity &gt; Available Stock
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                A delivery request exceeds the latest available inventory
                snapshot for the requested material.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-xs text-slate-400">
              <span className="size-2 rounded-full bg-orange-500" />{" "}
              Detected yesterday at 16:42
            </div>
          </section>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(330px,0.75fr)]">
            <Card className="border-0 bg-white shadow-[0_2px_12px_rgba(23,33,31,0.04)]">
              <CardHeader className="px-5 pb-3 pt-5">
                <SectionHeading
                  eyebrow="Detection evidence"
                  title="What the system observed"
                  icon={FileCheck2}
                />
              </CardHeader>
              <CardContent className="grid gap-x-8 gap-y-4 px-5 pb-5 sm:grid-cols-2">
                <EvidenceField label="Delivery" value="D-10744 · Due today" />
                <EvidenceField
                  label="Material"
                  value="M-8821 · Brake carrier"
                />
                <EvidenceField label="Plant" value="WH-03 · Wolfsburg" />
                <EvidenceField label="Order quantity" value="240 EA" emphasis />
                <EvidenceField
                  label="Available stock"
                  value="180 EA"
                  emphasis
                />
                <EvidenceField
                  label="Source sheets"
                  value="Deliveries_Dispatch · Inventory_Stock"
                />
              </CardContent>
            </Card>
            <Card className="border-0 bg-[#17211f] text-white shadow-[0_2px_12px_rgba(23,33,31,0.08)]">
              <CardHeader className="border-b border-white/10 px-5 pb-3 pt-5">
                <SectionHeading
                  eyebrow="Business impact"
                  title="Why this matters"
                  icon={ShieldAlert}
                />
              </CardHeader>
              <CardContent className="space-y-5 p-5">
                <div>
                  <p className="text-xs text-white/45">Impact severity</p>
                  <p className="mt-1 flex items-center gap-2 text-lg font-semibold text-red-300">
                    <span className="size-2 rounded-full bg-red-400" /> Critical
                  </p>
                </div>
                <div>
                  <p className="text-xs text-white/45">Potential delay</p>
                  <p className="mt-1 text-2xl font-semibold">
                    1 delivery · 18 hrs
                  </p>
                </div>
                <div className="border-t border-white/10 pt-4">
                  <p className="text-xs leading-6 text-white/60">
                    The shortfall may cause a partial dispatch, line-side
                    shortage, and missed customer commitment unless stock or
                    quantity is reconciled before release.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
          <Card className="border-0 bg-white shadow-[0_2px_12px_rgba(23,33,31,0.04)]">
            <CardHeader className="px-5 pb-3 pt-5">
              <SectionHeading
                eyebrow="AI root cause"
                title="Why the anomaly occurred"
                icon={Sparkles}
              />
            </CardHeader>
            <CardContent className="grid gap-6 px-5 pb-5 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div>
                <p className="text-sm leading-7 text-slate-600">
                  The dispatch quantity of{" "}
                  <strong className="font-semibold text-[#17211f]">
                    240 EA
                  </strong>{" "}
                  was released from the delivery schedule, while the latest
                  inventory snapshot contains only{" "}
                  <strong className="font-semibold text-[#17211f]">
                    180 EA
                  </strong>{" "}
                  for material M-8821 at WH-03. The correlation agent found no
                  replenishment receipt or alternate stock location that closes
                  the 60 EA gap.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Badge
                    variant="outline"
                    className="border-slate-200 bg-slate-50 text-slate-600"
                  >
                    <Database className="size-3" /> Inventory_Stock
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-slate-200 bg-slate-50 text-slate-600"
                  >
                    <Truck className="size-3" /> Deliveries_Dispatch
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-slate-200 bg-slate-50 text-slate-600"
                  >
                    <GitBranch className="size-3" /> No open replenishment
                  </Badge>
                </div>
              </div>
              <div className="rounded-xl border border-[#d8f36b]/70 bg-[#f5fbdc] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#667d16]">
                  Confidence score
                </p>
                <p className="mt-2 text-3xl font-semibold text-[#35420d]">
                  94%
                </p>
                <p className="mt-2 text-xs leading-5 text-[#667d16]">
                  High confidence based on two reconciled source records.
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 bg-white shadow-[0_2px_12px_rgba(23,33,31,0.04)]">
            <CardHeader className="px-5 pb-3 pt-5">
              <SectionHeading
                eyebrow="Cross-system correlation"
                title="Connected evidence chain"
                icon={GitBranch}
              />
            </CardHeader>
            <CardContent className="px-5 pb-6">
              <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
                <CorrelationNode
                  icon={Truck}
                  label="Delivery"
                  record="D-10744 · 240 EA"
                  tone="bg-blue-50 text-blue-600"
                />
                <ArrowRight className="mx-auto hidden size-5 shrink-0 text-slate-300 md:block" />
                <ChevronRight className="mx-auto size-5 rotate-90 text-slate-300 md:hidden" />
                <CorrelationNode
                  icon={Package}
                  label="Inventory"
                  record="M-8821 · 180 EA"
                  tone="bg-orange-50 text-orange-600"
                />
                <ArrowRight className="mx-auto hidden size-5 shrink-0 text-slate-300 md:block" />
                <ChevronRight className="mx-auto size-5 rotate-90 text-slate-300 md:hidden" />
                <CorrelationNode
                  icon={Route}
                  label="Material"
                  record="M-8821 · Brake carrier"
                  tone="bg-emerald-50 text-emerald-600"
                />
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(330px,0.75fr)]">
            <Card className="min-w-0 border-0 bg-white shadow-[0_2px_12px_rgba(23,33,31,0.04)]">
              <CardHeader className="px-5 pb-3 pt-5">
                <SectionHeading
                  eyebrow="Related records"
                  title="Source records used in investigation"
                  icon={Database}
                />
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Source</TableHead>
                      <TableHead>Record</TableHead>
                      <TableHead>Key value</TableHead>
                      <TableHead>Match</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="border-blue-200 bg-blue-50 text-blue-700"
                        >
                          Deliveries_Dispatch
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        D-10744
                      </TableCell>
                      <TableCell className="text-sm">
                        Requested 240 EA
                      </TableCell>
                      <TableCell>
                        <CheckCircle2 className="size-4 text-emerald-500" />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="border-orange-200 bg-orange-50 text-orange-700"
                        >
                          Inventory_Stock
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        M-8821 / WH-03
                      </TableCell>
                      <TableCell className="text-sm">
                        Available 180 EA
                      </TableCell>
                      <TableCell>
                        <CheckCircle2 className="size-4 text-emerald-500" />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="border-emerald-200 bg-emerald-50 text-emerald-700"
                        >
                          Material_Master
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        M-8821
                      </TableCell>
                      <TableCell className="text-sm">Base UoM: EA</TableCell>
                      <TableCell>
                        <CheckCircle2 className="size-4 text-emerald-500" />
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card className="border-0 bg-white shadow-[0_2px_12px_rgba(23,33,31,0.04)]">
              <CardHeader className="px-5 pb-3 pt-5">
                <SectionHeading
                  eyebrow="AI recommendation"
                  title="Suggested corrective action"
                  icon={Zap}
                />
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="rounded-lg border border-[#d8f36b]/70 bg-[#f5fbdc] p-4">
                  <p className="text-sm font-semibold text-[#35420d]">
                    Split delivery and trigger replenishment
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#56651d]">
                    Dispatch the available 180 EA now, create a replenishment
                    request for 60 EA, and update the delivery commitment for
                    the remaining quantity.
                  </p>
                </div>
                <div className="mt-4 space-y-3 text-xs text-slate-500">
                  <div className="flex gap-2">
                    <Check className="size-3.5 text-emerald-600" /> Preserve
                    current stock allocation
                  </div>
                  <div className="flex gap-2">
                    <Check className="size-3.5 text-emerald-600" /> Avoid an
                    unfulfillable dispatch
                  </div>
                  <div className="flex gap-2">
                    <Check className="size-3.5 text-emerald-600" /> Notify
                    planning of the 60 EA gap
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <Card className="border-0 bg-white shadow-[0_2px_12px_rgba(23,33,31,0.04)]">
            <CardHeader className="px-5 pb-3 pt-5">
              <SectionHeading
                eyebrow="Human approval"
                title="Review recommended action"
                icon={UserCheck}
              />
            </CardHeader>
            <CardContent className="grid gap-5 px-5 pb-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]">
              <div>
                <div className="flex flex-wrap gap-2">
                  {approval === "Pending approval" ? (
                    <>
                      <Button
                        onClick={() => updateApproval("AN-2016", "Approved")}
                        className="bg-[#17211f] text-white hover:bg-[#263632]"
                      >
                        <Check /> Approve action
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => updateApproval("AN-2016", "Rejected")}
                        className="border-red-200 text-red-700 hover:bg-red-50"
                      >
                        <X /> Reject
                      </Button>
                    </>
                  ) : (
                    <div
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${approval === "Approved" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
                    >
                      {approval === "Approved" ? (
                        <CheckCircle2 className="size-4" />
                      ) : (
                        <XCircle className="size-4" />
                      )}
                      Action {approval === "Approved" ? "approved" : "rejected"}
                    </div>
                  )}
                </div>
                <p className="mt-3 text-xs text-slate-400">
                  Approval is a mock interaction for this frontend demo.
                </p>
              </div>
              <div>
                <div className="flex gap-2">
                  <Input
                    value={comment}
                    onChange={(event) => {
                      setComment(event.target.value);
                      setCommentSaved(false);
                    }}
                    placeholder="Add comment"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      if (comment.trim()) {
                        updateApproval("AN-2016", approval, comment);
                      }
                      setCommentSaved(Boolean(comment.trim()));
                    }}
                    aria-label="Save comment"
                  >
                    <MessageSquarePlus />
                  </Button>
                </div>
                {commentSaved && (
                  <p className="mt-2 text-xs text-emerald-600">
                    Comment added to this review.
                  </p>
                )}
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                  Current decision:{" "}
                  <Badge
                    variant="outline"
                    className={approvalBadgeClasses[approval]}
                  >
                    {approval}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 bg-white shadow-[0_2px_12px_rgba(23,33,31,0.04)]">
            <CardHeader className="px-5 pb-3 pt-5">
              <SectionHeading
                eyebrow="Audit timeline"
                title="Investigation activity"
                icon={Clock3}
              />
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="grid gap-x-8 md:grid-cols-2">
                <div>
                  <AgentStep
                    name="Detection Agent"
                    detail="Flagged a dispatch quantity mismatch against the latest stock snapshot."
                    time="Yesterday · 16:42"
                    state="complete"
                  />
                  <AgentStep
                    name="Correlation Agent"
                    detail="Linked delivery D-10744, material M-8821, and WH-03 inventory."
                    time="Yesterday · 16:43"
                    state="complete"
                  />
                  <AgentStep
                    name="Impact Agent"
                    detail="Estimated 18-hour delivery risk and a 60 EA shortfall."
                    time="Yesterday · 16:44"
                    state="complete"
                  />
                </div>
                <div>
                  <AgentStep
                    name="Action Agent"
                    detail="Prepared split-delivery and replenishment recommendation."
                    time="Yesterday · 16:45"
                    state="complete"
                  />
                  <AgentStep
                    name="Human Approval"
                    detail={
                      approval === "Pending approval"
                        ? "Waiting for an operations owner to review."
                        : `Decision recorded: ${approval}.`
                    }
                    time="Now"
                    state={
                      approval === "Pending approval" ? "pending" : "complete"
                    }
                    last
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
