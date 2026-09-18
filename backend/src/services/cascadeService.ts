import { db, logAudit } from '../db.ts';
import {
  isLlmConfigured,
  triageAnomaliesWithLlm,
  generateSolutionWithLlm,
  type TriageInput,
  type TriageResult,
  type SolutionResult,
} from './llmService.ts';

// Auto-fix is only granted when the triage stage is highly confident AND low risk.
// 0.85 reflects observed real-world LLM confidence for genuinely low-risk fixes (e.g. gpt-4o
// rates safe reorder suggestions ~0.90); it is intentionally still conservative for anything else.
const AUTO_FIX_CONFIDENCE_THRESHOLD = 0.85;
const AUTO_FIX_RISK_CEILING = 'low';
const TRIAGE_BATCH_SIZE = 20;
const SOLUTION_CONCURRENCY = 6;

// Deterministic fallback used when LLMaaS is unreachable or not configured, so the
// cascade always produces a result. Mirrors real business risk per anomaly type.
const triageHeuristics: Record<string, Omit<TriageResult, 'anomalyId' | 'model'>> = {
  'reorder-threshold-risk': {
    autoFixable: true,
    autoFixConfidence: 0.97,
    riskLevel: 'low',
    reasoning: 'Reorder threshold breaches can be safely queued as a replenishment suggestion with no side effects on live stock.',
    recommendedAction: 'Auto-create a replenishment suggestion for the shortfall quantity.',
    approvalUrgency: 'low',
  },
  'missing-unit-of-measure': {
    autoFixable: false,
    autoFixConfidence: 0.55,
    riskLevel: 'medium',
    reasoning: 'Assigning a unit of measure without supplier confirmation risks incorrect stock valuation and planning errors.',
    recommendedAction: 'Route to warehouse manager to confirm the standard UOM from the product specification.',
    approvalUrgency: 'high',
  },
  'vendor-risk': {
    autoFixable: false,
    autoFixConfidence: 0.4,
    riskLevel: 'high',
    reasoning: 'Vendor holds and substitutions affect live purchase orders and require procurement sign-off.',
    recommendedAction: 'Hold new purchase orders and escalate to procurement for vendor substitution review.',
    approvalUrgency: 'high',
  },
  'impossible-stock-state': {
    autoFixable: false,
    autoFixConfidence: 0.3,
    riskLevel: 'high',
    reasoning: 'Stock corrections require a physical count reconciliation before the system of record can be changed safely.',
    recommendedAction: 'Block allocation and schedule a physical stock count.',
    approvalUrgency: 'high',
  },
  'dispatch-exceeds-stock': {
    autoFixable: false,
    autoFixConfidence: 0.35,
    riskLevel: 'high',
    reasoning: 'Overriding a dispatch that exceeds available stock can trigger a failed shipment; logistics must approve any split or delay.',
    recommendedAction: 'Split the delivery and trigger replenishment before goods issue.',
    approvalUrgency: 'high',
  },
};

const fallbackTriage = (anomaly: TriageInput): TriageResult => {
  const heuristic = triageHeuristics[anomaly.type] ?? {
    autoFixable: false,
    autoFixConfidence: 0.5,
    riskLevel: 'medium' as const,
    reasoning: 'Unclassified anomaly type requires manual review.',
    recommendedAction: 'Review the linked source records and confirm the corrective action.',
    approvalUrgency: 'medium' as const,
  };
  return { ...heuristic, anomalyId: anomaly.id, model: 'heuristic-fallback' };
};

const fallbackSolution = (anomaly: TriageInput, triage: TriageResult): SolutionResult => ({
  anomalyId: anomaly.id,
  executiveSummary: `${anomaly.message} Requires operator review before corrective action is applied.`,
  rootCauseAnalysis: triage.reasoning,
  businessImpact: `Severity ${anomaly.severity.toUpperCase()} issue on ${anomaly.sheet}; see linked evidence for scope.`,
  solutions: [
    {
      option: 1,
      title: triage.recommendedAction,
      steps: ['Review the anomaly evidence', 'Confirm the corrective action with the relevant business owner', 'Apply the fix in the source system'],
      confidence: triage.autoFixConfidence,
      effort: '15-30 minutes',
      approvalAuthority: triage.riskLevel === 'high' ? 'Operations Director' : 'Warehouse Manager',
    },
  ],
  recommendedOption: 1,
  approvalChecklist: ['Evidence reviewed against source system', 'Business owner notified', 'Change validated before approval'],
  model: 'heuristic-fallback',
});

const chunk = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const runWithConcurrency = async <T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
};

const upsertTriage = (result: TriageResult) => {
  db.prepare(
    `INSERT INTO anomaly_triage (anomaly_id, auto_fixable, auto_fix_confidence, risk_level, reasoning, recommended_action, approval_urgency, model)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(anomaly_id) DO UPDATE SET auto_fixable = excluded.auto_fixable, auto_fix_confidence = excluded.auto_fix_confidence,
       risk_level = excluded.risk_level, reasoning = excluded.reasoning, recommended_action = excluded.recommended_action,
       approval_urgency = excluded.approval_urgency, model = excluded.model, created_at = CURRENT_TIMESTAMP`,
  ).run(
    result.anomalyId,
    result.autoFixable ? 1 : 0,
    result.autoFixConfidence,
    result.riskLevel,
    result.reasoning,
    result.recommendedAction,
    result.approvalUrgency,
    result.model,
  );
};

const upsertSolution = (result: SolutionResult) => {
  db.prepare(
    `INSERT INTO anomaly_solutions (anomaly_id, executive_summary, root_cause_analysis, business_impact, solutions, recommended_option, approval_checklist, model)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(anomaly_id) DO UPDATE SET executive_summary = excluded.executive_summary, root_cause_analysis = excluded.root_cause_analysis,
       business_impact = excluded.business_impact, solutions = excluded.solutions, recommended_option = excluded.recommended_option,
       approval_checklist = excluded.approval_checklist, model = excluded.model, created_at = CURRENT_TIMESTAMP`,
  ).run(
    result.anomalyId,
    result.executiveSummary,
    result.rootCauseAnalysis,
    result.businessImpact,
    JSON.stringify(result.solutions),
    result.recommendedOption,
    JSON.stringify(result.approvalChecklist),
    result.model,
  );
};

const autoApprove = (anomalyId: number, reasoning: string) => {
  db.prepare(
    `INSERT INTO anomaly_decisions (anomaly_id, status, comment, decided_by) VALUES (?, 'approved', ?, 'ai-auto-fix')
     ON CONFLICT(anomaly_id) DO NOTHING`,
  ).run(anomalyId, reasoning);
};

export type CascadeSummary = {
  usedLlm: boolean;
  triaged: number;
  autoFixed: number;
  pendingReview: number;
  solutionsGenerated: number;
  durationMs: number;
};

/**
 * Runs the LLMaaS 2 (triage) + LLMaaS 3 (solution generation) stages for every anomaly
 * that has not yet been triaged, then auto-approves the anomalies triage deems safe.
 */
export const runAiCascade = async (): Promise<CascadeSummary> => {
  const startedAt = Date.now();
  const pending = db.prepare(
    `SELECT a.id, a.type, a.severity, a.sheet, a.message, a.evidence
     FROM anomalies a LEFT JOIN anomaly_triage t ON t.anomaly_id = a.id
     WHERE t.anomaly_id IS NULL`,
  ).all() as TriageInput[];

  // Reconcile anomalies triaged in a prior run (e.g. before a threshold change) that now
  // qualify for auto-fix, without re-invoking the LLM.
  const reconcilable = db.prepare(
    `SELECT t.anomaly_id, t.auto_fix_confidence, t.risk_level, t.reasoning, t.model
     FROM anomaly_triage t LEFT JOIN anomaly_decisions d ON d.anomaly_id = t.anomaly_id
     WHERE d.anomaly_id IS NULL AND t.auto_fixable = 1 AND t.auto_fix_confidence >= ? AND t.risk_level = ?`,
  ).all(AUTO_FIX_CONFIDENCE_THRESHOLD, AUTO_FIX_RISK_CEILING) as Array<{
    anomaly_id: number; auto_fix_confidence: number; risk_level: string; reasoning: string; model: string;
  }>;
  let reconciledAutoFixed = 0;
  for (const row of reconcilable) {
    autoApprove(row.anomaly_id, row.reasoning);
    logAudit({
      eventType: 'anomaly.auto_fixed',
      entityType: 'anomaly',
      entityId: row.anomaly_id,
      actor: `llm:${row.model}`,
      summary: `AI auto-fixed AN-${row.anomaly_id} on reconciliation (confidence ${(row.auto_fix_confidence * 100).toFixed(0)}%): ${row.reasoning}`,
      payload: { anomalyId: row.anomaly_id, riskLevel: row.risk_level, confidence: row.auto_fix_confidence },
    });
    reconciledAutoFixed += 1;
  }

  const llmConfigured = isLlmConfigured();
  let usedLlm = false;
  const triageResults: TriageResult[] = [];

  for (const batch of chunk(pending, TRIAGE_BATCH_SIZE)) {
    if (llmConfigured) {
      try {
        const llmResults = await triageAnomaliesWithLlm(batch);
        const byId = new Map(llmResults.map((result) => [result.anomalyId, result]));
        for (const anomaly of batch) {
          const result = byId.get(anomaly.id);
          triageResults.push(result ?? fallbackTriage(anomaly));
        }
        usedLlm = true;
        continue;
      } catch {
        // fall through to heuristic fallback for this batch
      }
    }
    for (const anomaly of batch) {
      triageResults.push(fallbackTriage(anomaly));
    }
  }

  let autoFixed = 0;
  const manualReviewInputs: TriageInput[] = [];
  const manualReviewTriage: TriageResult[] = [];
  const pendingById = new Map(pending.map((anomaly) => [anomaly.id, anomaly]));

  for (const result of triageResults) {
    upsertTriage(result);
    const isSafeAutoFix = result.autoFixable && result.autoFixConfidence >= AUTO_FIX_CONFIDENCE_THRESHOLD && result.riskLevel === AUTO_FIX_RISK_CEILING;
    if (isSafeAutoFix) {
      autoApprove(result.anomalyId, result.reasoning);
      logAudit({
        eventType: 'anomaly.auto_fixed',
        entityType: 'anomaly',
        entityId: result.anomalyId,
        actor: `llm:${result.model}`,
        summary: `AI auto-fixed AN-${result.anomalyId} (confidence ${(result.autoFixConfidence * 100).toFixed(0)}%): ${result.recommendedAction}`,
        payload: { anomalyId: result.anomalyId, riskLevel: result.riskLevel, confidence: result.autoFixConfidence },
      });
      autoFixed += 1;
    } else {
      const anomaly = pendingById.get(result.anomalyId);
      if (anomaly) {
        manualReviewInputs.push(anomaly);
        manualReviewTriage.push(result);
      }
    }
  }

  const solutionResults = await runWithConcurrency(manualReviewInputs, SOLUTION_CONCURRENCY, async (anomaly) => {
    const triage = manualReviewTriage[manualReviewInputs.indexOf(anomaly)];
    if (llmConfigured) {
      try {
        const solution = await generateSolutionWithLlm(anomaly, triage);
        usedLlm = true;
        return solution;
      } catch {
        return fallbackSolution(anomaly, triage);
      }
    }
    return fallbackSolution(anomaly, triage);
  });

  for (const solution of solutionResults) {
    upsertSolution(solution);
  }

  const summary: CascadeSummary = {
    usedLlm,
    triaged: triageResults.length,
    autoFixed: autoFixed + reconciledAutoFixed,
    pendingReview: manualReviewInputs.length,
    solutionsGenerated: solutionResults.length,
    durationMs: Date.now() - startedAt,
  };

  logAudit({
    eventType: 'ai_cascade.completed',
    entityType: 'workbook',
    actor: usedLlm ? 'llm-cascade' : 'heuristic-cascade',
    summary: `AI cascade triaged ${summary.triaged} anomalies: ${summary.autoFixed} auto-fixed, ${summary.pendingReview} routed to approvals.`,
    payload: summary,
  });

  return summary;
};
