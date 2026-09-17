// Response shapes for the backend API (backend/app/schemas/*.py). Keep in sync with those files.

export interface KPISummary {
  open_incidents: number;
  critical_incidents: number;
  data_health_pct: number;
  actions_awaiting_approval: number;
  total_anomalies_detected: number;
  total_records_ingested: number;
}

export interface AnomalyOut {
  id: string;
  type_code: string;
  category: string;
  source_sheet: string;
  material: string | null;
  plant: number | null;
  vendor: string | null;
  record_ref: Record<string, unknown>;
  severity: string;
  description: string;
  detected_by: string;
  status: string;
  detected_at: string;
}

export interface ActionOut {
  id: string;
  incident_id: string;
  action_type: string;
  proposed_change: Record<string, unknown>;
  justification: string;
  proposed_by_agent: string;
  status: string;
  created_at: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_reason: string | null;
}

export interface IncidentSummary {
  id: string;
  title: string;
  severity: string;
  impact_score: number;
  impact_label: string | null;
  status: string;
  confidence: number;
  created_at: string;
  anomaly_count: number;
}

export interface IncidentDetail extends IncidentSummary {
  root_cause_summary: string;
  updated_at: string;
  anomalies: AnomalyOut[];
  actions: ActionOut[];
}

export interface AuditLogEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  actor: string;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  notes: string | null;
  timestamp: string;
}

export interface Material360 {
  material: string;
  master: Record<string, unknown>[];
  inventory: Record<string, unknown>[];
  bins: Record<string, unknown>[];
  deliveries: Record<string, unknown>[];
  purchase_orders: Record<string, unknown>[];
  anomalies: {
    id: string;
    type_code: string;
    severity: string;
    description: string;
    status: string;
  }[];
}

export interface ActionDecisionRequest {
  decided_by: string;
  reason?: string;
}

export interface IngestRunResponse {
  status: string;
  detail: string;
}

export interface AgentTraceMessage {
  run_id: string;
  incident_id: string | null;
  agent_name: string;
  step_type: string;
  content: unknown;
  timestamp: string;
}
