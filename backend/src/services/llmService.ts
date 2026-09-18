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

type AssistantQuestionContext = {
  question: string;
  deterministicReply: string;
  cards: Array<{ label: string; value: string | number }>;
  rows: Array<Record<string, unknown>>;
  tables: string[];
};

export type AssistantLlmAnswer = {
  reply: string;
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

const getAccessToken = async () => {
  if (!appConfig.idpClientId || !appConfig.idpClientSecret) {
    throw new Error('LLM IDP is not configured. Set LLMAAS_IDP_CLIENT_ID and LLMAAS_IDP_CLIENT_SECRET.');
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
  const payload = await response.json() as { access_token?: string };
  if (!payload.access_token) throw new Error('LLM identity provider returned no access token.');
  return payload.access_token;
};

export const analyzeAnomalyWithLlm = async (anomaly: AnomalyContext): Promise<LlmAnalysis> => {
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
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You are a warehouse operations analyst. Return only valid JSON with keys summary, rootCause, businessImpact, recommendedAction, confidence. Use only the supplied evidence. Do not invent quantities, dates, vendors, or materials.' },
          { role: 'user', content: JSON.stringify({ task: 'Analyze this deterministic warehouse anomaly for an operator.', anomaly }) },
        ],
      }),
    });
    if (!response.ok) throw new Error(`LLM request failed with HTTP ${response.status}.`);
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error('LLM returned an empty response.');
    const parsed = extractJson(content) as Partial<LlmAnalysis>;
    const parsedConfidence = Number(parsed.confidence);
    return {
      summary: String(parsed.summary ?? ''),
      rootCause: String(parsed.rootCause ?? ''),
      businessImpact: String(parsed.businessImpact ?? ''),
      recommendedAction: String(parsed.recommendedAction ?? ''),
      confidence: Number.isFinite(parsedConfidence) ? Math.max(0, Math.min(1, parsedConfidence)) : null,
      model: appConfig.llmModel,
    };
  } finally {
    clearTimeout(timeout);
  }
};

export const answerAssistantQuestionWithLlm = async (context: AssistantQuestionContext): Promise<AssistantLlmAnswer> => {
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
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You are LogiMind Assistant for warehouse operators. Use only the supplied data. Return only valid JSON with key reply. Be concise, practical, and mention when the evidence is limited. Do not invent materials, quantities, vendors, dates, or actions.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              task: 'Answer the operator question using the deterministic system answer and row evidence.',
              context,
            }),
          },
        ],
      }),
    });
    if (!response.ok) throw new Error(`LLM request failed with HTTP ${response.status}.`);
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error('LLM returned an empty response.');
    const parsed = extractJson(content) as { reply?: unknown };
    return { reply: String(parsed.reply ?? context.deterministicReply), model: appConfig.llmModel };
  } finally {
    clearTimeout(timeout);
  }
};