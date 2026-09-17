import type {
  ActionDecisionRequest,
  ActionOut,
  AgentTraceMessage,
  AnomalyOut,
  AuditLogEntry,
  IncidentDetail,
  IncidentSummary,
  IngestRunResponse,
  KPISummary,
  Material360,
} from "./types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: init?.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    ...init,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API request failed: ${res.status} ${res.statusText} - ${path}\n${body}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

function withQuery(path: string, params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

export function getKpis(): Promise<KPISummary> {
  return request<KPISummary>("/kpis");
}

export function listIncidents(status?: string): Promise<IncidentSummary[]> {
  return request<IncidentSummary[]>(withQuery("/incidents", { status }));
}

export function getIncident(id: string): Promise<IncidentDetail> {
  return request<IncidentDetail>(`/incidents/${id}`);
}

export function listAnomalies(params?: {
  status?: string;
  category?: string;
  type_code?: string;
}): Promise<AnomalyOut[]> {
  return request<AnomalyOut[]>(withQuery("/anomalies", params ?? {}));
}

export function listActions(status?: string): Promise<ActionOut[]> {
  return request<ActionOut[]>(withQuery("/actions", { status }));
}

export function approveAction(id: string, body: ActionDecisionRequest): Promise<ActionOut> {
  return request<ActionOut>(`/actions/${id}/approve`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function rejectAction(id: string, body: ActionDecisionRequest): Promise<ActionOut> {
  return request<ActionOut>(`/actions/${id}/reject`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listAuditLog(params?: {
  entity_type?: string;
  entity_id?: string;
}): Promise<AuditLogEntry[]> {
  return request<AuditLogEntry[]>(withQuery("/audit-log", params ?? {}));
}

export function getMaterial360(material: string): Promise<Material360> {
  return request<Material360>(`/materials/${encodeURIComponent(material)}/360`);
}

export function triggerIngest(file?: File): Promise<IngestRunResponse> {
  const form = new FormData();
  if (file) form.append("file", file);
  return request<IngestRunResponse>("/ingest/run", { method: "POST", body: form });
}

/**
 * Opens a WebSocket to the agent-trace stream, calling onMessage for each
 * parsed JSON line. Reconnects once automatically if the socket drops.
 */
export function connectAgentTrace(
  runId: string | undefined,
  onMessage: (msg: AgentTraceMessage) => void
): () => void {
  const wsBase = API_BASE_URL.replace(/^http/, "ws");
  const url = withQuery(`${wsBase}/ws/agent-trace`, { run_id: runId });

  let socket: WebSocket | null = null;
  let hasReconnected = false;
  let closedByCaller = false;

  const open = () => {
    socket = new WebSocket(url);

    socket.onmessage = (event) => {
      try {
        onMessage(JSON.parse(event.data) as AgentTraceMessage);
      } catch {
        // ignore malformed lines
      }
    };

    socket.onclose = () => {
      if (!closedByCaller && !hasReconnected) {
        hasReconnected = true;
        open();
      }
    };
  };

  open();

  return () => {
    closedByCaller = true;
    socket?.close();
  };
}
