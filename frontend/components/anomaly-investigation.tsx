"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Check, Menu, Sparkles } from "lucide-react"
import { useParams } from "next/navigation"
import { Sidebar } from "@/components/control-tower-dashboard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type LiveAnomaly = { id: number; type: string; severity: string; sheet: string; message: string; recommendation: string; category: string; confidence: number; decision_status?: string; decision_comment?: string | null }
const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

export function AnomalyInvestigation() {
  const params = useParams<{ id: string }>()
  const [anomaly, setAnomaly] = useState<LiveAnomaly | null>(null)
  useEffect(() => { fetch(`${apiBaseUrl}/api/anomalies`).then((response) => response.json()).then((rows: LiveAnomaly[]) => setAnomaly(rows.find((row) => `AN-${row.id}` === params.id || String(row.id) === params.id) ?? null)).catch(() => setAnomaly(null)) }, [params.id])
  return <div className="flex min-h-screen bg-[#f4f6f3] text-[#17211f]"><Sidebar activeLabel="Anomaly Queue" /><main className="min-w-0 flex-1"><header className="flex h-20 items-center gap-3 border-b border-slate-200/80 bg-[#f8faf7] px-5 sm:px-8"><Button variant="ghost" size="icon" className="lg:hidden"><Menu /></Button><div><p className="text-xs uppercase tracking-[0.16em] text-slate-400">Operations workspace</p><h1 className="mt-1 text-xl font-semibold">Anomaly investigation</h1></div></header><div className="mx-auto max-w-4xl space-y-6 p-5 sm:p-8"><Link href="/anomalies" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-[#17211f]"><ArrowLeft className="size-4" /> Back to anomaly center</Link>{anomaly ? <><section><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{anomaly.severity}</Badge><Badge variant="outline">{anomaly.sheet}</Badge>{anomaly.decision_status === "approved" && <Badge><Check className="size-3" /> Approved</Badge>}</div><h2 className="mt-3 text-2xl font-semibold">{anomaly.message}</h2><p className="mt-1 font-mono text-xs text-slate-400">AN-{anomaly.id} · {anomaly.type}</p></section><Card><CardHeader><CardTitle>Detection evidence</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-3"><div><p className="text-xs text-slate-400">Category</p><p className="mt-1 font-medium">{anomaly.category}</p></div><div><p className="text-xs text-slate-400">Confidence</p><p className="mt-1 font-medium">{Math.round(anomaly.confidence * 100)}%</p></div><div><p className="text-xs text-slate-400">Source</p><p className="mt-1 font-medium">{anomaly.sheet}</p></div></CardContent></Card><Card className="border-[#d8f36b] bg-[#f5fbdc]"><CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="size-4" /> Recommended action</CardTitle></CardHeader><CardContent><p className="text-sm leading-6 text-[#56651d]">{anomaly.recommendation}</p>{anomaly.decision_comment && <p className="mt-4 border-t border-[#d8f36b] pt-3 text-xs text-[#56651d]">Decision comment: {anomaly.decision_comment}</p>}</CardContent></Card></> : <Card><CardContent className="p-10 text-center text-sm text-slate-500">This anomaly is not present in the current workbook run.</CardContent></Card>}</div></main></div>
}
