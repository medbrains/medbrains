// NHCX — Settings → NHCX, the setup status and the payer directory.

export type NhcxEnvironment = "sandbox" | "production";

/** What is saved for NHCX. Secrets are never returned — only whether one is saved. */
export interface NhcxSettingsView {
  environment: NhcxEnvironment;
  participant_code: string | null;
  client_id: string | null;
  has_client_secret: boolean;
  has_private_key: boolean;
  public_cert_pem: string | null;
  gateway_jwt_public_key_pem: string | null;
  /** `settings` when saved here, `env` when the server's ABDM keys are used, `none` otherwise. */
  credentials_source: "settings" | "env" | "none";
}

/** Blank `client_secret` / `private_key_pem` keep the saved ones. */
export interface SaveNhcxSettings {
  environment: NhcxEnvironment;
  participant_code: string;
  client_id?: string;
  client_secret?: string;
  private_key_pem?: string;
  public_cert_pem?: string;
  gateway_jwt_public_key_pem?: string;
}

export interface NhcxConnectionTest {
  ok: boolean;
  message: string;
}

export interface NhcxStatus {
  ready: boolean;
  environment: NhcxEnvironment;
  /** What is still to be set up, in words. */
  missing: string[];
}

export interface NhcxParticipant {
  id: string;
  participant_code: string;
  participant_name: string;
  role: string;
  is_active: boolean;
  has_encryption_cert: boolean;
}

export interface UpsertNhcxParticipantRequest {
  participant_code: string;
  participant_name: string;
  role?: string;
  /** PEM. Blank keeps the saved certificate. */
  encryption_cert?: string;
}

export interface NhcxQueuedResponse {
  /** The claim, pre-authorisation, eligibility check or payer query sent. */
  record_id: string;
  queued: boolean;
  correlation_id: string;
  outbox_event_id: string;
}

// ── Eligibility ──────────────────────────────────────────────

/** One benefit line of a payer's eligibility answer. */
export interface NhcxBenefitLine {
  category: string | null;
  name: string | null;
  benefit_type: string | null;
  /** A number for money or units, else the payer's words. */
  allowed: number | string | null;
  used: number | string | null;
  currency: string | null;
}

/** The payer's eligibility answer, parsed. */
export interface NhcxEligibilityResult {
  outcome: string | null;
  /** `null` when the payer did not say. */
  in_force: boolean | null;
  coverage_start: string | null;
  coverage_end: string | null;
  disposition: string | null;
  benefits: NhcxBenefitLine[];
  errors: string[];
}

/** An NHCX eligibility check. `status` stays `pending` until the payer answers. */
export interface NhcxEligibilityCheck {
  id: string;
  patient_id: string;
  trigger_point: string;
  status: "pending" | "active" | "inactive" | "unknown" | "error";
  payer_name: string | null;
  nhcx_recipient_code: string | null;
  nhcx_status: string | null;
  nhcx_disposition: string | null;
  nhcx_result: NhcxEligibilityResult | null;
  coverage_start: string | null;
  coverage_end: string | null;
  error_message: string | null;
  created_at: string;
  nhcx_submitted_at: string | null;
  nhcx_response_at: string | null;
}

export interface CheckNhcxEligibilityRequest {
  patient_id: string;
  patient_insurance_id?: string;
  recipient_code: string;
  trigger_point?: string;
  trigger_entity_id?: string;
  /** HL7 benefit category codes; plan coverage ("30") when absent. */
  service_categories?: string[];
}

// ── Pre-authorisation ────────────────────────────────────────

export type NhcxRequestStage = "initial" | "enhancement" | "discharge";

export interface SubmitPreauthToNhcxRequest {
  recipient_code: string;
  request_stage?: NhcxRequestStage;
}

export type SlaState = "not_started" | "running" | "met" | "breached";

/** The IRDAI clock on a pre-authorisation, computed by the server. */
export interface PreauthSla {
  limit_minutes: number;
  elapsed_minutes: number | null;
  state: SlaState;
}

export interface NhcxTimelineEvent {
  at: string;
  kind:
    | "sent"
    | "acknowledged"
    | "query_raised"
    | "responded"
    | "approved"
    | "partially_approved"
    | "rejected"
    | "cancelled";
  label: string;
  amount: string | null;
}

/** A payer's question and the hospital's answer. */
export interface NhcxPayerQuery {
  id: string;
  prior_auth_id: string | null;
  insurance_claim_id: string | null;
  sender_code: string;
  question: string;
  requested_items: string[];
  received_at: string;
  due_at: string | null;
  status: "open" | "answered";
  answer_text: string | null;
  answer_document_ids: string[];
  answered_at: string | null;
  nhcx_status: string | null;
  nhcx_disposition: string | null;
  nhcx_submitted_at: string | null;
}

export interface AnswerPayerQueryRequest {
  text: string;
  document_ids?: string[];
}

export interface NhcxAttachableDocument {
  id: string;
  document_type: string;
  file_name: string | null;
}

export interface PreauthNhcxView {
  prior_auth_id: string;
  request_stage: NhcxRequestStage;
  status: string;
  nhcx_status: string | null;
  nhcx_recipient_code: string | null;
  nhcx_correlation_id: string | null;
  nhcx_disposition: string | null;
  estimated_cost: string | null;
  approved_amount: string | null;
  auth_number: string | null;
  sla: PreauthSla;
  timeline: NhcxTimelineEvent[];
  queries: NhcxPayerQuery[];
  documents: NhcxAttachableDocument[];
}

export interface NhcxPreauthSlaRow {
  prior_auth_id: string;
  pa_number: string;
  patient_id: string;
  request_stage: NhcxRequestStage;
  status: string;
  nhcx_status: string | null;
  payer_code: string | null;
  payer_name: string | null;
  received_at: string | null;
  decided_at: string | null;
  open_queries: number;
  sla: PreauthSla;
}

export interface NhcxPayerSla {
  payer_code: string | null;
  payer_name: string | null;
  total: number;
  breached: number;
  running: number;
}

export interface NhcxSlaReport {
  rows: NhcxPreauthSlaRow[];
  by_payer: NhcxPayerSla[];
}
