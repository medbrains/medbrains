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
  /** A final claim's documents: what went and what was left out. */
  attachments?: NhcxClaimAttachments;
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

// ── Final claim, Tasks and payments ──────────────────────────

/** A line the final claim sent, by the sequence the payer answers it under. */
export interface NhcxClaimItem {
  sequence: number;
  code: string | null;
  description: string;
  quantity: number | null;
  net: string | null;
}

/** One line of the payer's adjudication. */
export interface NhcxAdjudicationLine {
  sequence: number;
  submitted: string | null;
  approved: string | null;
  deducted: string | null;
  /** The payer's reasons, in its words; a fully covered line has none. */
  reasons: string[];
}

/** The payer's adjudication of a final claim. */
export interface NhcxAdjudication {
  use_: string | null;
  outcome: string | null;
  disposition: string | null;
  pre_auth_ref: string | null;
  submitted: string | null;
  approved: string | null;
  deducted: string | null;
  lines: NhcxAdjudicationLine[];
}

/** A claim a payer's search or status answer names. */
export interface NhcxFoundClaim {
  claim_ref: string | null;
  outcome: string | null;
  disposition: string | null;
  submitted: string | null;
  approved: string | null;
  matched_claim_id: string | null;
}

export interface NhcxTaskResult {
  task_status: string | null;
  outcome: string | null;
  description: string | null;
  claims: NhcxFoundClaim[];
  error: string | null;
}

export type NhcxTaskKind = "status" | "search" | "cancel" | "reprocess";

/** A status, search, cancel or reprocess request and the payer's answer. */
export interface NhcxTask {
  id: string;
  kind: NhcxTaskKind;
  insurance_claim_id: string | null;
  prior_auth_id: string | null;
  recipient_code: string;
  request: {
    reason?: string;
    from_date?: string;
    to_date?: string;
    claim_number?: string | null;
  };
  nhcx_status: string | null;
  nhcx_disposition: string | null;
  nhcx_submitted_at: string | null;
  nhcx_response_at: string | null;
  result: NhcxTaskResult | null;
  created_at: string;
}

export interface ClaimNhcxView {
  claim_id: string;
  nhcx_use: "claim" | "preauthorization" | null;
  pre_auth_ref: string | null;
  claim_items: NhcxClaimItem[];
  adjudication: NhcxAdjudication | null;
  adjudicated_at: string | null;
  /** What the last final claim carried, and what was left out and why. */
  attachments: NhcxClaimAttachments | null;
  tasks: NhcxTask[];
}

// ── Final-claim documents ────────────────────────────────────

export type NhcxClaimDocKind =
  | "discharge_summary"
  | "final_bill"
  | "lab_report"
  | "radiology_report"
  | "patient_document";

/** `rendered` = a `document_outputs` PDF; `stored` = a patient upload. */
export type NhcxClaimDocSource = "rendered" | "stored";

/** A document that goes with a final claim. */
export interface NhcxClaimDocument {
  kind: NhcxClaimDocKind;
  source: NhcxClaimDocSource;
  id: string;
  title: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  preview_url: string | null;
}

/** A document that does not go, and why. */
export interface NhcxLeftOutDocument {
  kind: NhcxClaimDocKind;
  title: string;
  reason: string;
}

export interface NhcxClaimAttachments {
  attached: NhcxClaimDocument[];
  left_out: NhcxLeftOutDocument[];
}

/** The documents rendered for a final claim, before the desk chooses. */
export interface NhcxPreparedClaimDocuments {
  patient_id: string;
  documents: NhcxClaimDocument[];
  left_out: NhcxLeftOutDocument[];
  max_file_bytes: number;
  max_total_bytes: number;
}

export interface NhcxDocumentPick {
  source: NhcxClaimDocSource;
  id: string;
}

export interface NhcxClaimTaskRequest {
  reason: string;
}

export interface NhcxSearchRequest {
  recipient_code: string;
  from_date: string;
  to_date: string;
  claim_number?: string;
}

/** One claim's share of a payer's payment notice. */
export interface NhcxPayment {
  id: string;
  notice_id: string;
  sender_code: string;
  payer_name: string | null;
  payment_reference: string | null;
  payment_date: string | null;
  received_at: string;
  claim_reference: string | null;
  insurance_claim_id: string | null;
  claim_number: string | null;
  /** Approved amount paid, before TDS. */
  gross_amount: string;
  tds_amount: string;
  /** What reached the bank. */
  net_amount: string;
  approved_amount: string | null;
  is_mismatch: boolean;
  status: "posted" | "unmatched";
  posted_at: string | null;
  bank_matched: boolean;
  ack_status: string | null;
}

export interface PostNhcxPaymentRequest {
  insurance_claim_id: string;
}
