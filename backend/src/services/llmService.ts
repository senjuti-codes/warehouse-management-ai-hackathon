import { appConfig } from '../config.ts';

type AnomalyContext = {
  id: number;
  type: string;
  severity: string;
  sheet: string;
  message: string;
  evidence: string | null;
  business_key: string | null;
  deterministic_recommendation: string;
};

export type LlmAnalysis = {
  summary: string;
  rootCause: string;
  businessImpact: string;
  recommendedAction: string;
  confidence: number | null;
  model: string;
};

export type TriageInput = {
  id: number;
  type: string;
  severity: string;
  sheet: string;
  message: string;
  evidence: string | null;
};

export type TriageResult = {
  anomalyId: number;
  autoFixable: boolean;
  autoFixConfidence: number;
  riskLevel: 'low' | 'medium' | 'high';
  reasoning: string;
  recommendedAction: string;
  approvalUrgency: 'low' | 'medium' | 'high';
  model: string;
};

export type SolutionOption = {
  option: number;
  title: string;
  steps: string[];
  confidence: number;
  effort: string;
  approvalAuthority: string;
};

export type SolutionResult = {
  anomalyId: number;
  executiveSummary: string;
  rootCauseAnalysis: string;
  businessImpact: string;
  solutions: SolutionOption[];
  recommendedOption: number;
  approvalChecklist: string[];
  model: string;
};

const extractJson = (content: string) => {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1] ?? content;
  return JSON.parse(fenced);
};

const chatCompletionsUrl = () => {
  const baseUrl = appConfig.llmBaseUrl.replace(/\/$/, '');
  return baseUrl.endsWith('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;
};

let cachedToken: { value: string; expiresAt: number } | null = null;

const getAccessToken = async () => {
  if (!appConfig.idpClientId || !appConfig.idpClientSecret) {
    throw new Error('LLM IDP is not configured. Set LLMAAS_IDP_CLIENT_ID and LLMAAS_IDP_CLIENT_SECRET.');
  }

  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }

  const form = new URLSearchParams({
    client_id: appConfig.idpClientId,
    client_secret: appConfig.idpClientSecret,
    grant_type: 'client_credentials',
  });
  const response = await fetch(appConfig.idpTokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  if (!response.ok) throw new Error(`LLM identity token request failed with HTTP ${response.status}.`);
  const payload = await response.json() as { access_token?: string; expires_in?: number };
  if (!payload.access_token) throw new Error('LLM identity provider returned no access token.');
  // Refresh 60s before actual expiry (default 5 min) to avoid using a stale token mid-request.
  const ttlMs = Math.max((Number(payload.expires_in) || 300) - 60, 30) * 1000;
  cachedToken = { value: payload.access_token, expiresAt: Date.now() + ttlMs };
  return payload.access_token;
};

export const isLlmConfigured = () =>
  Boolean(appConfig.llmBaseUrl && appConfig.llmApiKey && appConfig.llmModel && appConfig.idpClientId && appConfig.idpClientSecret);

const callChatCompletion = async (
  systemPrompt: string,
  userPayload: unknown,
  temperature: number,
) => {
  if (!appConfig.llmBaseUrl || !appConfig.llmApiKey || !appConfig.llmModel) {
    throw new Error('LLM is not configured. Set LLMAAS_BASE_URL, LLMAAS_API_KEY, and LLMAAS_MODEL.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), appConfig.llmTimeoutMs);
  try {
    const accessToken = await getAccessToken();
    const response = await fetch(chatCompletionsUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-LLM-API-CLIENT-ID': `Bearer ${appConfig.llmApiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: appConfig.llmModel,
        temperature,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(userPayload) },
        ],
      }),
    });
    if (!response.ok) throw new Error(`LLM request failed with HTTP ${response.status}.`);
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error('LLM returned an empty response.');
    return extractJson(content);
  } finally {
    clearTimeout(timeout);
  }
};

/**
 * LLMaaS 1 (on-demand deep dive) — used by the Anomaly Investigation page.
 */
export const analyzeAnomalyWithLlm = async (anomaly: AnomalyContext): Promise<LlmAnalysis> => {
  const parsed = await callChatCompletion(
    'You are a warehouse operations analyst. Return only valid JSON with keys summary, rootCause, businessImpact, recommendedAction, confidence. Use only the supplied evidence. Do not invent quantities, dates, vendors, or materials.',
    { task: 'Analyze this deterministic warehouse anomaly for an operator.', anomaly },
    0.1,
  ) as Partial<LlmAnalysis>;
  const parsedConfidence = Number(parsed.confidence);
  return {
    summary: String(parsed.summary ?? ''),
    rootCause: String(parsed.rootCause ?? ''),
    businessImpact: String(parsed.businessImpact ?? ''),
    recommendedAction: String(parsed.recommendedAction ?? ''),
    confidence: Number.isFinite(parsedConfidence) ? Math.max(0, Math.min(1, parsedConfidence)) : null,
    model: appConfig.llmModel,
  };
};

/**
 * LLMaaS 2 (batch triage) — judges auto-fix eligibility & risk for a batch of anomalies in one call.
 */
export const triageAnomaliesWithLlm = async (anomalies: TriageInput[]): Promise<TriageResult[]> => {
  const parsed = await callChatCompletion(
    [
      'You are the triage stage of a multi-agent warehouse anomaly resolution pipeline.',
      'For every anomaly in the input array, decide whether it is safe to auto-fix with zero human review.',
      'Be conservative: only mark auto_fixable=true when the fix is reversible, low-risk, and does not touch vendor, financial, or compliance-sensitive fields.',
      'Return only valid JSON: { "triage": [ { "anomalyId": number, "autoFixable": boolean, "autoFixConfidence": number (0-1), "riskLevel": "low"|"medium"|"high", "reasoning": string, "recommendedAction": string, "approvalUrgency": "low"|"medium"|"high" } ] }',
    ].join(' '),
    { task: 'Triage these warehouse anomalies for auto-fix eligibility.', anomalies },
    0.1,
  ) as { triage?: Array<Record<string, unknown>> };

  const rows = Array.isArray(parsed.triage) ? parsed.triage : [];
  return rows.map((row) => {
    const confidence = Number(row.autoFixConfidence);
    return {
      anomalyId: Number(row.anomalyId),
      autoFixable: Boolean(row.autoFixable),
      autoFixConfidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.5,
      riskLevel: (['low', 'medium', 'high'].includes(String(row.riskLevel)) ? row.riskLevel : 'medium') as TriageResult['riskLevel'],
      reasoning: String(row.reasoning ?? ''),
      recommendedAction: String(row.recommendedAction ?? ''),
      approvalUrgency: (['low', 'medium', 'high'].includes(String(row.approvalUrgency)) ? row.approvalUrgency : 'medium') as TriageResult['approvalUrgency'],
      model: appConfig.llmModel,
    };
  }).filter((row) => Number.isInteger(row.anomalyId));
};

/**
 * LLMaaS 3 (solution generator) — produces a rich, multi-option recommendation for one anomaly.
 */
export const generateSolutionWithLlm = async (
  anomaly: TriageInput,
  triage: Pick<TriageResult, 'riskLevel' | 'reasoning' | 'approvalUrgency'>,
): Promise<SolutionResult> => {
  const parsed = await callChatCompletion(
    [
      'You are the solution-generation stage of a multi-agent warehouse anomaly resolution pipeline.',
      'Produce 2-3 concrete remediation options for the engineer, ranked by confidence.',
      'Return only valid JSON: { "executiveSummary": string, "rootCauseAnalysis": string, "businessImpact": string,',
      '"solutions": [ { "option": number, "title": string, "steps": string[], "confidence": number (0-1), "effort": string, "approvalAuthority": string } ],',
      '"recommendedOption": number, "approvalChecklist": string[] }. Use only the supplied evidence; do not invent data.',
    ].join(' '),
    { task: 'Generate remediation solutions for this warehouse anomaly.', anomaly, triage },
    0.4,
  ) as Partial<SolutionResult> & { solutions?: Array<Record<string, unknown>> };

  const solutions = Array.isArray(parsed.solutions)
    ? parsed.solutions.map((option, index) => ({
        option: Number(option.option ?? index + 1),
        title: String(option.title ?? `Option ${index + 1}`),
        steps: Array.isArray(option.steps) ? option.steps.map(String) : [],
        confidence: Number.isFinite(Number(option.confidence)) ? Math.max(0, Math.min(1, Number(option.confidence))) : 0.5,
        effort: String(option.effort ?? 'Unknown'),
        approvalAuthority: String(option.approvalAuthority ?? 'Warehouse Manager'),
      }))
    : [];

  return {
    anomalyId: anomaly.id,
    executiveSummary: String(parsed.executiveSummary ?? ''),
    rootCauseAnalysis: String(parsed.rootCauseAnalysis ?? ''),
    businessImpact: String(parsed.businessImpact ?? ''),
    solutions,
    recommendedOption: Number.isInteger(Number(parsed.recommendedOption)) ? Number(parsed.recommendedOption) : (solutions[0]?.option ?? 1),
    approvalChecklist: Array.isArray(parsed.approvalChecklist) ? parsed.approvalChecklist.map(String) : [],
    model: appConfig.llmModel,
  };
};