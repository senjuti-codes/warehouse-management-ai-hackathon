"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, Sparkles } from "lucide-react";
import { useParams } from "next/navigation";
import { MobileNavigation, Sidebar } from "@/components/control-tower-dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type LiveAnomaly = {
  id: number;
  type: string;
  severity: string;
  sheet: string;
  message: string;
  recommendation: string;
  category: string;
  confidence: number;
  evidence?: string | null;
  business_key?: string | null;
  decision_status?: string;
  decision_comment?: string | null;
};

const parseEvidence = (
  raw: string | null | undefined,
): Array<[string, string]> => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.entries(parsed).map(([key, value]) => [
      key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()),
      value === null || value === undefined ? "—" : String(value),
    ]);
  } catch {
    return [["Evidence", String(raw)]];
  }
};

type LlmAnalysis = {
  summary: string;
  rootCause: string;
  businessImpact: string;
  recommendedAction: string;
  confidence: number | null;
  model: string;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function AnomalyInvestigation() {
  const params = useParams<{ id: string }>();
  const [anomaly, setAnomaly] = useState<LiveAnomaly | null>(null);
  const [analysis, setAnalysis] = useState<LlmAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${apiBaseUrl}/api/anomalies`)
      .then((response) =>
        response.ok
          ? response.json()
          : Promise.reject(new Error("Unable to load anomaly")),
      )
      .then((rows: LiveAnomaly[]) =>
        setAnomaly(
          rows.find(
            (row) =>
              `AN-${row.id}` === params.id || String(row.id) === params.id,
          ) ?? null,
        ),
      )
      .catch(() => setAnomaly(null));
  }, [params.id]);

  const generateAnalysis = async () => {
    if (!anomaly) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/anomalies/${anomaly.id}/ai-analysis`,
        { method: "POST" },
      );
      const payload = (await response.json()) as {
        success?: boolean;
        analysis?: LlmAnalysis;
        message?: string;
      };
      if (!response.ok || !payload.analysis)
        throw new Error(payload.message ?? "AI analysis failed");
      setAnalysis(payload.analysis);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "AI analysis failed",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f4f6f3] text-[#17211f]">
      <Sidebar activeLabel="Anomaly Queue" />
      <main className="min-w-0 flex-1">
        <header className="flex h-20 items-center gap-3 border-b border-slate-200/80 bg-[#f8faf7] px-5 sm:px-8">
          <MobileNavigation activeLabel="Anomaly Queue" />
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
              Operations workspace
            </p>
            <h1 className="mt-1 text-xl font-semibold">
              Anomaly investigation
            </h1>
          </div>
        </header>
        <div className="mx-auto max-w-4xl space-y-6 p-5 sm:p-8">
          <Link
            href="/anomalies"
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-[#17211f]"
          >
            <ArrowLeft className="size-4" /> Back to anomaly center
          </Link>
          {anomaly ? (
            <>
              <section>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{anomaly.severity}</Badge>
                  <Badge variant="outline">{anomaly.sheet}</Badge>
                  {anomaly.decision_status === "approved" && (
                    <Badge>
                      <Check className="size-3" /> Approved
                    </Badge>
                  )}
                </div>
                <h2 className="mt-3 text-2xl font-semibold">
                  {anomaly.message}
                </h2>
                <p className="mt-1 font-mono text-xs text-slate-400">
                  AN-{anomaly.id} · {anomaly.type}
                </p>
              </section>
              <Card className="card-hover">
                <CardHeader>
                  <CardTitle>Detection evidence</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-slate-400">Category</p>
                    <p className="mt-1 font-medium">{anomaly.category}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Rule confidence</p>
                    <p className="mt-1 font-medium">
                      {Math.round(anomaly.confidence * 100)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Source</p>
                    <p className="mt-1 font-medium">{anomaly.sheet}</p>
                  </div>
                </CardContent>
              </Card>
              {parseEvidence(anomaly.evidence).length > 0 && (
                <Card className="card-hover">
                  <CardHeader>
                    <CardTitle>Workbook evidence</CardTitle>
                    <p className="mt-1 text-xs text-slate-500">
                      Raw fields captured from the source sheet at detection
                      time.
                    </p>
                  </CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2">
                    {parseEvidence(anomaly.evidence).map(([key, value]) => (
                      <div
                        key={key}
                        className="rounded-md bg-slate-50 px-3 py-2"
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          {key}
                        </p>
                        <p className="mt-1 font-mono text-sm text-[#17211f]">
                          {value}
                        </p>
                      </div>
                    ))}
                    {anomaly.business_key && (
                      <div className="rounded-md bg-slate-50 px-3 py-2 sm:col-span-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          Business key
                        </p>
                        <p className="mt-1 font-mono text-sm text-[#17211f]">
                          {anomaly.business_key}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
              <Card className="border-[#d8f36b] bg-[#f5fbdc]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="size-4" /> Deterministic recommendation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-6 text-[#56651d]">
                    {anomaly.recommendation}
                  </p>
                  {anomaly.decision_comment && (
                    <p className="mt-4 border-t border-[#d8f36b] pt-3 text-xs text-[#56651d]">
                      Decision comment: {anomaly.decision_comment}
                    </p>
                  )}
                </CardContent>
              </Card>
              <Card className="card-hover">
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle>Live LLM analysis</CardTitle>
                      <p className="mt-1 text-xs text-slate-500">
                        Generated from this anomaly&apos;s workbook evidence.
                      </p>
                    </div>
                    <Button onClick={generateAnalysis} disabled={loading}>
                      {loading ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Sparkles />
                      )}{" "}
                      {loading ? "Analyzing" : "Generate AI analysis"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {error && (
                    <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                      {error}
                    </p>
                  )}
                  {analysis && (
                    <div className="space-y-4 text-sm leading-6">
                      <div>
                        <p className="font-semibold">Summary</p>
                        <p className="text-slate-600">{analysis.summary}</p>
                      </div>
                      <div>
                        <p className="font-semibold">Likely root cause</p>
                        <p className="text-slate-600">{analysis.rootCause}</p>
                      </div>
                      <div>
                        <p className="font-semibold">Business impact</p>
                        <p className="text-slate-600">
                          {analysis.businessImpact}
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold">Recommended action</p>
                        <p className="text-slate-600">
                          {analysis.recommendedAction}
                        </p>
                      </div>
                      <p className="text-xs text-slate-400">
                        Model: {analysis.model} · AI confidence:{" "}
                        {analysis.confidence === null
                          ? "Not provided"
                          : `${Math.round(analysis.confidence * 100)}%`}
                      </p>
                    </div>
                  )}
                  {!analysis && !error && (
                    <p className="text-sm text-slate-500">
                      Run the analysis when you want an LLM-generated
                      explanation.
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="p-10 text-center text-sm text-slate-500">
                This anomaly is not present in the current workbook run.
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
