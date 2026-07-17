// Insurance, TPA, prior-auth and IPD-admission-adjacent types — split from index.ts, barrel-re-exported.

// ── Insurance & TPA ─────────────────────────────────────

export type VerificationStatus = "pending" | "active" | "inactive" | "unknown" | "error";
export type PriorAuthStatus =
  | "draft"
  | "pending_info"
  | "submitted"
  | "in_review"
  | "approved"
  | "partially_approved"
  | "denied"
  | "expired"
  | "cancelled";
export type PaUrgency = "standard" | "urgent" | "retrospective";
export type AppealStatus =
  | "draft"
  | "submitted"
  | "in_review"
  | "upheld"
  | "overturned"
  | "withdrawn";

export interface InsuranceVerification {
  id: string;
  tenant_id: string;
  patient_id: string;
  patient_insurance_id: string;
  trigger_point: string;
  trigger_entity_id: string | null;
  status: VerificationStatus;
  verified_at: string | null;
  payer_name: string | null;
  payer_id: string | null;
  member_id: string | null;
  group_number: string | null;
  subscriber_name: string | null;
  relationship_to_subscriber: string | null;
  coverage_start: string | null;
  coverage_end: string | null;
  benefits: Record<string, unknown> | null;
  individual_deductible: number | null;
  individual_deductible_met: number | null;
  family_deductible: number | null;
  family_deductible_met: number | null;
  co_pay_percent: number | null;
  co_insurance_percent: number | null;
  out_of_pocket_max: number | null;
  out_of_pocket_met: number | null;
  scheme_type: string | null;
  scheme_balance: number | null;
  error_code: string | null;
  error_message: string | null;
  raw_response: unknown | null;
  notes: string | null;
  verified_by: string | null;
  created_at: string;
}

export interface PriorAuthRequestRow {
  id: string;
  tenant_id: string;
  pa_number: string;
  patient_id: string;
  patient_insurance_id: string;
  service_type: string;
  service_code: string | null;
  service_description: string | null;
  diagnosis_codes: string[] | null;
  ordering_doctor_id: string | null;
  department_id: string | null;
  encounter_id: string | null;
  invoice_id: string | null;
  insurance_claim_id: string | null;
  status: PriorAuthStatus;
  urgency: PaUrgency;
  requested_start: string | null;
  requested_end: string | null;
  requested_units: number | null;
  estimated_cost: number | null;
  auth_number: string | null;
  approved_start: string | null;
  approved_end: string | null;
  approved_units: number | null;
  approved_amount: number | null;
  denial_reason: string | null;
  denial_code: string | null;
  submitted_at: string | null;
  responded_at: string | null;
  expires_at: string | null;
  expected_tat_hours: number | null;
  escalated: boolean;
  escalated_at: string | null;
  created_by: string | null;
  submitted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PriorAuthDocument {
  id: string;
  tenant_id: string;
  prior_auth_id: string;
  document_type: string;
  file_name: string | null;
  file_path: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  content_text: string | null;
  content_json: unknown | null;
  source_entity: string | null;
  source_id: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface PriorAuthStatusLog {
  id: string;
  tenant_id: string;
  prior_auth_id: string;
  from_status: PriorAuthStatus | null;
  to_status: PriorAuthStatus;
  notes: string | null;
  changed_by: string | null;
  created_at: string;
}

export interface PriorAuthAppeal {
  id: string;
  tenant_id: string;
  prior_auth_id: string;
  appeal_number: string;
  level: number;
  status: AppealStatus;
  reason: string | null;
  clinical_rationale: string | null;
  supporting_evidence: string | null;
  letter_content: string | null;
  payer_decision: string | null;
  payer_response_date: string | null;
  payer_notes: string | null;
  submitted_at: string | null;
  resolved_at: string | null;
  deadline: string | null;
  created_by: string | null;
  submitted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaRequirementRule {
  id: string;
  tenant_id: string;
  rule_name: string;
  description: string | null;
  insurance_provider: string | null;
  scheme_type: string | null;
  tpa_name: string | null;
  service_type: string | null;
  charge_code: string | null;
  charge_code_pattern: string | null;
  cost_threshold: number | null;
  los_threshold: number | null;
  priority: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InsuranceDashboard {
  total_verifications: number;
  active_verifications: number;
  total_prior_auths: number;
  pending_prior_auths: number;
  approved_prior_auths: number;
  denied_prior_auths: number;
  denial_rate_percent: number;
  pending_appeals: number;
  avg_tat_hours: number | null;
  expiring_soon: PriorAuthRequestRow[];
  top_denial_reasons: { reason: string; count: number }[];
}

export interface PaCheckResult {
  required: boolean;
  matching_rule_id: string | null;
  rule_name: string | null;
}

export interface PriorAuthDetail {
  prior_auth: PriorAuthRequestRow;
  documents: PriorAuthDocument[];
  status_log: PriorAuthStatusLog[];
  appeals: PriorAuthAppeal[];
}

// Request types

export interface RunVerificationRequest {
  patient_id: string;
  patient_insurance_id: string;
  trigger_point: string;
  trigger_entity_id?: string;
}

export interface CreatePriorAuthRequestBody {
  patient_id: string;
  patient_insurance_id: string;
  service_type: string;
  service_code?: string;
  service_description?: string;
  diagnosis_codes?: string[];
  ordering_doctor_id?: string;
  department_id?: string;
  encounter_id?: string;
  invoice_id?: string;
  insurance_claim_id?: string;
  urgency?: PaUrgency;
  requested_start?: string;
  requested_end?: string;
  requested_units?: number;
  estimated_cost?: number;
}

export interface UpdatePriorAuthRequestBody {
  service_type?: string;
  service_code?: string;
  service_description?: string;
  diagnosis_codes?: string[];
  urgency?: PaUrgency;
  requested_start?: string;
  requested_end?: string;
  requested_units?: number;
  estimated_cost?: number;
}

export interface RespondPriorAuthRequest {
  status: PriorAuthStatus;
  auth_number?: string;
  approved_start?: string;
  approved_end?: string;
  approved_units?: number;
  approved_amount?: number;
  denial_reason?: string;
  denial_code?: string;
  notes?: string;
}

export interface CheckPaRequiredRequest {
  patient_id: string;
  service_type: string;
  charge_code?: string;
  estimated_cost?: number;
  expected_los?: number;
}

export interface AttachDocumentRequest {
  document_type: string;
  file_name?: string;
  file_path?: string;
  file_size_bytes?: number;
  mime_type?: string;
  content_text?: string;
  content_json?: unknown;
  source_entity?: string;
  source_id?: string;
}

export interface CreateAppealRequest {
  prior_auth_id: string;
  reason?: string;
  clinical_rationale?: string;
  supporting_evidence?: string;
  letter_content?: string;
}

export interface UpdateAppealRequest {
  status?: AppealStatus;
  reason?: string;
  clinical_rationale?: string;
  supporting_evidence?: string;
  letter_content?: string;
  payer_decision?: string;
  payer_response_date?: string;
  payer_notes?: string;
}

export interface CreatePaRuleRequest {
  rule_name: string;
  description?: string;
  insurance_provider?: string;
  scheme_type?: string;
  tpa_name?: string;
  service_type?: string;
  charge_code?: string;
  charge_code_pattern?: string;
  cost_threshold?: number;
  los_threshold?: number;
  priority?: number;
  is_active?: boolean;
}

export interface UpdatePaRuleRequest {
  rule_name?: string;
  description?: string;
  insurance_provider?: string;
  scheme_type?: string;
  tpa_name?: string;
  service_type?: string;
  charge_code?: string;
  charge_code_pattern?: string;
  cost_threshold?: number;
  los_threshold?: number;
  priority?: number;
  is_active?: boolean;
}

// ──────────────────────────────────────────────────────────
//  IPD Phase 2b — Types & Enums
// ──────────────────────────────────────────────────────────

export type IpType =
  | "general"
  | "semi_private"
  | "private"
  | "deluxe"
  | "suite"
  | "icu"
  | "nicu"
  | "picu"
  | "hdu"
  | "isolation"
  | "nursery";
export type BedReservationStatus = "active" | "confirmed" | "cancelled" | "expired" | "fulfilled";
export type IpdClinicalDocType =
  | "wound_care"
  | "central_line"
  | "catheter"
  | "drain"
  | "restraint"
  | "transfusion"
  | "clinical_pathway"
  | "other"
  | "elopement_risk"
  | "dialysis"
  | "endoscopy"
  | "chemotherapy"
  | "blood_transfusion_checklist";
export type RestraintCheckStatus =
  | "circulation_ok"
  | "skin_intact"
  | "repositioned"
  | "released"
  | "escalated";
export type TransferType = "inter_ward" | "inter_department" | "inter_hospital";
export type DeathCertFormType = "form_4" | "form_4a";
export interface IpTypeConfiguration {
  id: string;
  tenant_id: string;
  ip_type: IpType;
  label: string;
  daily_rate: number | null;
  nursing_charge: number | null;
  deposit_required: number | null;
  description: string | null;
  is_active: boolean;
  billing_alert_threshold: number | null;
  auto_billing_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdmissionChecklist {
  id: string;
  tenant_id: string;
  admission_id: string;
  item_label: string;
  category: string | null;
  is_completed: boolean;
  completed_by: string | null;
  completed_at: string | null;
  sort_order: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BedReservation {
  id: string;
  tenant_id: string;
  bed_id: string;
  patient_id: string | null;
  reserved_by: string;
  status: BedReservationStatus;
  reserved_from: string;
  reserved_until: string;
  purpose: string | null;
  notes: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BedTurnaroundLog {
  id: string;
  tenant_id: string;
  bed_id: string;
  admission_id: string | null;
  vacated_at: string | null;
  cleaning_started_at: string | null;
  cleaning_completed_at: string | null;
  ready_at: string | null;
  turnaround_minutes: number | null;
  cleaned_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface IpdClinicalDocumentation {
  id: string;
  tenant_id: string;
  admission_id: string;
  patient_id: string;
  doc_type: IpdClinicalDocType;
  title: string;
  body: unknown;
  recorded_by: string;
  recorded_at: string;
  next_review_at: string | null;
  is_resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RestraintMonitoringLog {
  id: string;
  tenant_id: string;
  admission_id: string;
  clinical_doc_id: string;
  check_time: string;
  status: RestraintCheckStatus;
  circulation_status: string | null;
  skin_status: string | null;
  patient_response: string | null;
  checked_by: string;
  notes: string | null;
  created_at: string;
}

export interface IpdTransferLog {
  id: string;
  tenant_id: string;
  admission_id: string;
  transfer_type: TransferType;
  from_ward_id: string | null;
  to_ward_id: string | null;
  from_bed_id: string | null;
  to_bed_id: string | null;
  reason: string | null;
  clinical_summary: string | null;
  transferred_by: string;
  transferred_at: string;
  notes: string | null;
  created_at: string;
}

export interface IpdDeathSummary {
  id: string;
  tenant_id: string;
  admission_id: string;
  patient_id: string;
  date_of_death: string;
  time_of_death: string;
  cause_of_death_primary: string | null;
  cause_of_death_secondary: string | null;
  cause_of_death_tertiary: string | null;
  cause_of_death_underlying: string | null;
  manner_of_death: string | null;
  duration_of_illness: string | null;
  autopsy_requested: boolean;
  is_medico_legal: boolean;
  form_type: DeathCertFormType;
  certifying_doctor_id: string | null;
  witness_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface IpdBirthRecord {
  id: string;
  tenant_id: string;
  admission_id: string;
  mother_patient_id: string;
  baby_patient_id: string | null;
  date_of_birth: string;
  time_of_birth: string;
  gender: string | null;
  weight_grams: number | null;
  length_cm: number | null;
  head_circumference_cm: number | null;
  apgar_1min: number | null;
  apgar_5min: number | null;
  delivery_type: string | null;
  is_live_birth: boolean;
  birth_certificate_number: string | null;
  complications: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface IpdDischargeTatLog {
  id: string;
  tenant_id: string;
  admission_id: string;
  discharge_initiated_at: string | null;
  billing_cleared_at: string | null;
  pharmacy_cleared_at: string | null;
  nursing_cleared_at: string | null;
  doctor_cleared_at: string | null;
  discharge_completed_at: string | null;
  total_tat_minutes: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoomUtilization {
  room_id: string;
  room_name: string;
  total_bookings: number;
  total_surgery_minutes: number | null;
  avg_turnaround_minutes: number | null;
}

// Request types — IPD Phase 2b

export interface CreateIpTypeRequest {
  ip_type: IpType;
  label: string;
  daily_rate?: number;
  nursing_charge?: number;
  deposit_required?: number;
  description?: string;
  billing_alert_threshold?: number;
  auto_billing_enabled?: boolean;
}

export interface UpdateIpTypeRequest {
  label?: string;
  daily_rate?: number;
  nursing_charge?: number;
  deposit_required?: number;
  description?: string;
  is_active?: boolean;
  billing_alert_threshold?: number;
  auto_billing_enabled?: boolean;
}

export interface CreateChecklistItemsRequest {
  items: { item_label: string; category?: string; sort_order?: number; notes?: string }[];
}

export interface ToggleChecklistItemRequest {
  is_completed: boolean;
  notes?: string;
}

export interface CreateBedReservationRequest {
  bed_id: string;
  patient_id?: string;
  reserved_from: string;
  reserved_until: string;
  purpose?: string;
  notes?: string;
}

export interface UpdateBedReservationStatusRequest {
  status: BedReservationStatus;
}

export interface CreateBedTurnaroundRequest {
  bed_id: string;
  admission_id?: string;
  vacated_at?: string;
  notes?: string;
}

export interface CreateClinicalDocRequest {
  doc_type: IpdClinicalDocType;
  title: string;
  body?: unknown;
  next_review_at?: string;
  notes?: string;
}

export interface UpdateClinicalDocRequest {
  title?: string;
  body?: unknown;
  next_review_at?: string;
  notes?: string;
}

export interface CreateRestraintCheckRequest {
  clinical_doc_id: string;
  status: RestraintCheckStatus;
  circulation_status?: string;
  skin_status?: string;
  patient_response?: string;
  notes?: string;
}

export interface CreateTransferRequest {
  transfer_type: TransferType;
  from_ward_id?: string;
  to_ward_id?: string;
  from_bed_id?: string;
  to_bed_id?: string;
  reason: string;
  clinical_summary?: string;
  notes?: string;
}

export interface CreateDeathSummaryRequest {
  patient_id: string;
  date_of_death: string;
  time_of_death: string;
  cause_of_death_primary?: string;
  cause_of_death_secondary?: string;
  cause_of_death_tertiary?: string;
  cause_of_death_underlying?: string;
  manner_of_death?: string;
  duration_of_illness?: string;
  autopsy_requested?: boolean;
  is_medico_legal?: boolean;
  form_type?: DeathCertFormType;
  certifying_doctor_id?: string;
  witness_name?: string;
  notes?: string;
}

export interface UpdateDeathSummaryRequest {
  date_of_death?: string;
  time_of_death?: string;
  cause_of_death_primary?: string;
  cause_of_death_secondary?: string;
  cause_of_death_tertiary?: string;
  cause_of_death_underlying?: string;
  manner_of_death?: string;
  duration_of_illness?: string;
  autopsy_requested?: boolean;
  is_medico_legal?: boolean;
  form_type?: DeathCertFormType;
  certifying_doctor_id?: string;
  witness_name?: string;
  notes?: string;
}

export interface CreateBirthRecordRequest {
  mother_patient_id: string;
  baby_patient_id?: string;
  date_of_birth: string;
  time_of_birth: string;
  gender?: string;
  weight_grams?: number;
  length_cm?: number;
  head_circumference_cm?: number;
  apgar_1min?: number;
  apgar_5min?: number;
  delivery_type?: string;
  is_live_birth?: boolean;
  birth_certificate_number?: string;
  complications?: string;
  notes?: string;
}

export interface UpdateBirthRecordRequest {
  baby_patient_id?: string;
  date_of_birth?: string;
  time_of_birth?: string;
  gender?: string;
  weight_grams?: number;
  length_cm?: number;
  head_circumference_cm?: number;
  apgar_1min?: number;
  apgar_5min?: number;
  delivery_type?: string;
  is_live_birth?: boolean;
  birth_certificate_number?: string;
  complications?: string;
  notes?: string;
}

export interface InitDischargeTatRequest {
  notes?: string;
}

export interface UpdateDischargeTatRequest {
  billing_cleared_at?: string;
  pharmacy_cleared_at?: string;
  nursing_cleared_at?: string;
  doctor_cleared_at?: string;
  discharge_completed_at?: string;
  notes?: string;
}
