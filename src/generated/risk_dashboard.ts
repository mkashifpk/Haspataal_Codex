// Generated from Haspataal MCP server contract definitions for Screen 142: risk_dashboard.
import { api } from "./api";

const withQuery = (path: string, q?: Record<string, unknown>) => {
  const s = new URLSearchParams(Object.entries(q ?? {}).filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => [k, String(v)])).toString();
  return s ? `${path}?${s}` : path;
};

export type RiskSeverity = "Low" | "Medium" | "High" | "Critical";

export type RiskReviewStatus = "Open" | "UnderReview" | "Resolved" | "FalsePositive" | "Escalated";

export type RiskDetection = "Transactional" | "Sweep";

export interface RiskSummaryOut {
  rule_code: string;
  name: string;
  description: string;
  severity: RiskSeverity;
  open_count: number;
  max_score: number;
  latest: string;
}

export interface RiskFindingListItemOut {
  risk_event_id: number;
  rule_code: string;
  severity: RiskSeverity;
  risk_score: number;
  entity_type: string;
  entity_id: string;
  subject_user_id: number | null;
  summary: string;
  evidence_jsonb: Record<string, any>;
  detection: RiskDetection;
  review_status: RiskReviewStatus;
  reviewed_by: number | null;
  reviewed_at: string | null;
  review_note: string | null;
  detected_at: string;
  row_version: number;
  rule_name: string;
  subject_user_name: string | null;
  reviewed_by_name: string | null;
}

/** A finding flagged for human review (a heuristic score, not an accusation). */
export interface RiskFindingOut {
  risk_event_id: number;
  rule_code: string;
  severity: RiskSeverity;
  risk_score: number;
  entity_type: string;
  entity_id: string;
  subject_user_id: number | null;
  summary: string;
  evidence_jsonb: Record<string, any>;
  detection: RiskDetection;
  review_status: RiskReviewStatus;
  reviewed_by: number | null;
  reviewed_at: string | null;
  review_note: string | null;
  detected_at: string;
  row_version: number;
}

export interface ReviewIn {
  status: "UnderReview" | "Resolved" | "FalsePositive" | "Escalated";
  /** Required for Resolved / FalsePositive / Escalated */
  note?: string | null;
}

export interface RiskRuleOut {
  rule_id: number;
  code: string;
  name: string;
  description: string;
  severity: RiskSeverity;
  base_score: number;
  is_active: boolean;
  /** Thresholds (edited through the risk_* settings) */
  config_jsonb: Record<string, any>;
  row_version: number;
}

export interface AuditEntryOut {
  audit_id: number;
  user_id: number | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before_jsonb: any;
  after_jsonb: any;
  reason: string | null;
  ip: string | null;
  request_id: string | null;
  workspace: string | null;
  at: string;
  user_name: string | null;
}

/** Open findings by rule and severity (heuristic scores, for human review) — GET /api/v1/risk/summary */
export function riskSummary(): Promise<RiskSummaryOut[]> {
  return api<RiskSummaryOut[]>("GET", `/risk/summary`, undefined);
}

/** Flagged-for-review list (not accusations) — GET /api/v1/risk/findings */
export function riskFindings(query?: {
  status?: string | null;
  rule_code?: string | null;
  severity?: string | null;
  limit?: number;
}): Promise<RiskFindingListItemOut[]> {
  return api<RiskFindingListItemOut[]>("GET", withQuery(`/risk/findings`, query), undefined);
}

/** Record the human review outcome — POST /api/v1/risk/findings/{risk_event_id}/review */
export function reviewFinding(risk_event_id: number, body: ReviewIn): Promise<RiskFindingOut> {
  return api<RiskFindingOut>("POST", `/risk/findings/${risk_event_id}/review`, body);
}

/** Risk rules (thresholds live in /admin/settings risk_* keys) — GET /api/v1/risk/rules */
export function riskRules(): Promise<RiskRuleOut[]> {
  return api<RiskRuleOut[]>("GET", `/risk/rules`, undefined);
}

/** Audit trail (filterable) — GET /api/v1/admin/audit-log */
export function adminAuditLog(query?: {
  user_id?: number | null;
  entity_type?: string | null;
  entity_id?: string | null;
  action?: string | null;
  since?: string | null;
  before_id?: string | null;
  limit?: number;
}): Promise<AuditEntryOut[]> {
  return api<AuditEntryOut[]>("GET", withQuery(`/admin/audit-log`, query), undefined);
}
