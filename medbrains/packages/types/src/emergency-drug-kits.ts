// Emergency drug kit types — split from index.ts, barrel-re-exported.

// ── Emergency Drug Kits ────────────────────────────────────

export interface PharmacyEmergencyKit {
  id: string;
  tenant_id: string;
  kit_code: string;
  kit_type: "crash_cart" | "emergency_tray" | "anaphylaxis_kit" | "ot_emergency" | "icu_tray";
  location_id: string | null;
  location_description: string | null;
  department_id: string | null;
  items: Array<{
    drug_id?: string;
    drug_name: string;
    required_qty: number;
    current_qty: number;
    expiry_date?: string;
  }>;
  last_checked_at: string | null;
  last_checked_by: string | null;
  next_check_due: string | null;
  check_interval_days: number;
  status: "active" | "needs_restock" | "expired_items" | "inactive";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────
//  Order Basket — atomic cross-module order signing
//  See RFCs/sprints/SPRINT-order-basket.md
// ─────────────────────────────────────────────────────────

export interface BasketDrugItem {
  kind: "drug";
  drug_id: string;
  drug_name: string;
  dose: string;
  frequency: string;
  route: string;
  duration_days?: number | null;
  indication?: string | null;
  is_prn?: boolean | null;
  instructions?: string | null;
  quantity: number;
  unit_price: string;
  schedule_x_serial?: string | null;
}

export interface BasketLabItem {
  kind: "lab";
  test_id: string;
  priority?: string | null;
  indication?: string | null;
  notes?: string | null;
}

export interface BasketRadiologyItem {
  kind: "radiology";
  modality_id: string;
  body_part?: string | null;
  clinical_indication?: string | null;
  priority?: string | null;
  scheduled_at?: string | null;
  contrast_required?: boolean | null;
  pregnancy_checked?: boolean | null;
  allergy_flagged?: boolean | null;
  notes?: string | null;
}

export interface BasketProcedureItem {
  kind: "procedure";
  procedure_id: string;
  indication?: string | null;
  scheduled_at?: string | null;
  notes?: string | null;
}

export interface BasketDietItem {
  kind: "diet";
  template_id?: string | null;
  diet_type?: string | null;
  special_instructions?: string | null;
  is_npo?: boolean | null;
  start_date?: string | null;
  end_date?: string | null;
}

export interface BasketReferralItem {
  kind: "referral";
  to_specialty_id?: string | null;
  to_external_provider?: string | null;
  reason: string;
  priority?: string | null;
}

export type BasketItem =
  | BasketDrugItem
  | BasketLabItem
  | BasketRadiologyItem
  | BasketProcedureItem
  | BasketDietItem
  | BasketReferralItem;

export type BasketWarningSeverity = "WARN" | "BLOCK";

export interface BasketWarning {
  code: string;
  severity: BasketWarningSeverity;
  message: string;
  refs: number[];
  detail?: Record<string, unknown> | null;
}

export interface BasketWarningAck {
  code: string;
  override_reason: string;
}

export interface CheckBasketRequest {
  encounter_id: string;
  patient_id: string;
  items: BasketItem[];
}

export interface CheckBasketResponse {
  warnings: BasketWarning[];
}

export interface SignBasketRequest {
  encounter_id: string;
  patient_id: string;
  items: BasketItem[];
  warnings_acknowledged?: BasketWarningAck[];
  client_session_id?: string | null;
  device_id?: string | null;
}

export interface CreatedOrderRef {
  item_index: number;
  order_type: string;
  order_id: string;
}

export interface SignBasketResponse {
  signature_id: string;
  created: CreatedOrderRef[];
  warnings: BasketWarning[];
}

export interface OrderBasketDraft {
  id: string;
  tenant_id: string;
  encounter_id: string;
  owner_user_id: string;
  items: BasketItem[];
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaveBasketDraftRequest {
  items: BasketItem[];
  notes?: string | null;
}

// ─────────────────────────────────────────────────────────
//  Doctor Activities (SPRINT-doctor-activities.md sub-A)
// ─────────────────────────────────────────────────────────

export interface DoctorProfile {
  id: string;
  tenant_id: string;
  user_id: string;
  prefix: string | null;
  display_name: string;
  qualification_string: string | null;
  mci_number: string | null;
  state_council_number: string | null;
  state_council_name: string | null;
  registration_valid_until: string | null;
  specialty_ids: string[];
  subspecialty: string | null;
  years_experience: number | null;
  is_full_time: boolean;
  is_visiting: boolean;
  parent_employee_id: string | null;
  can_prescribe_schedule_x: boolean;
  can_perform_surgery: boolean;
  can_sign_mlc: boolean;
  can_sign_death_certificate: boolean;
  can_sign_fitness_certificate: boolean;
  bio_short: string | null;
  bio_long: string | null;
  photo_url: string | null;
  languages_spoken: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateDoctorRequest {
  user_id: string;
  display_name: string;
  prefix?: string | null;
  qualification_string?: string | null;
  mci_number?: string | null;
  state_council_number?: string | null;
  state_council_name?: string | null;
  registration_valid_until?: string | null;
  specialty_ids?: string[];
  subspecialty?: string | null;
  years_experience?: number | null;
  is_full_time?: boolean;
  is_visiting?: boolean;
  can_prescribe_schedule_x?: boolean;
  can_perform_surgery?: boolean;
  can_sign_mlc?: boolean;
  can_sign_death_certificate?: boolean;
  can_sign_fitness_certificate?: boolean;
  bio_short?: string | null;
  photo_url?: string | null;
  languages_spoken?: string[];
}

export type UpdateDoctorRequest = Partial<CreateDoctorRequest> & {
  bio_long?: string | null;
  is_active?: boolean | null;
};

export interface UpdateMyDoctorProfileRequest {
  bio_short?: string | null;
  bio_long?: string | null;
  photo_url?: string | null;
  languages_spoken?: string[];
}

export interface SignatureCredential {
  id: string;
  tenant_id: string;
  doctor_user_id: string;
  credential_type: "stored_key" | "aadhaar_esign" | "dsc_usb" | "external_pkcs11";
  algorithm: string;
  public_key: number[]; // bytea → number[]
  display_image_url: string | null;
  display_font: string | null;
  valid_from: string;
  valid_until: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
  is_default: boolean;
  created_at: string;
}

export interface IssueCredentialRequest {
  doctor_user_id: string;
  display_image_url?: string | null;
  display_font?: string | null;
  valid_until?: string | null;
  make_default?: boolean;
}

export interface RevokeCredentialRequest {
  reason: string;
}

export interface SignedRecord {
  id: string;
  tenant_id: string;
  record_type: string;
  record_id: string;
  signer_user_id: string;
  signer_role: "primary" | "co_signer" | "attestor" | "witness";
  signer_credential_id: string | null;
  signed_at: string;
  payload_snapshot: Record<string, unknown> | null;
  payload_hash: number[];
  signature_bytes: number[];
  display_image_snapshot: string | null;
  display_block: string | null;
  legal_class: "administrative" | "clinical" | "medico_legal" | "statutory_export";
  created_at: string;
}

export interface SignRequest {
  record_type: string;
  record_id: string;
  payload?: Record<string, unknown>;
  signer_role?: string;
  legal_class?: string;
  credential_id?: string;
  notes?: string;
}

export interface SignPreviewRequest {
  record_type: string;
  record_id: string;
  signer_role?: string;
  legal_class?: string;
}

export interface SignPreviewResponse {
  record_type: string;
  record_id: string;
  signer_role: "primary" | "co_signer" | "attestor" | "witness";
  legal_class: "administrative" | "clinical" | "medico_legal" | "statutory_export";
  payload_snapshot: Record<string, unknown>;
  payload_hash_hex: string;
  generated_at: string;
}

export interface SignResponse {
  signed_record: SignedRecord;
  payload_hash_hex: string;
  signature_hex: string;
}

export interface VerifyRequest {
  signed_record_id: string;
  payload?: Record<string, unknown>;
}

export interface VerifyResponse {
  verified: boolean;
  recomputed_hash_hex: string;
  stored_hash_hex: string;
  signer_user_id: string;
  signed_at: string;
  credential_revoked: boolean;
}

export interface MyDayResponse {
  doctor_user_id: string;
  today: {
    appointments_total: number;
    appointments_remaining: number;
    ot_cases: number;
    ipd_patients_under_care: number;
    critical_alerts: number;
  };
  pending_signoffs: {
    clinical: number;
    medico_legal: number;
    overdue: number;
    total: number;
  };
  on_call: {
    is_on_call_now: boolean;
    next_on_call_at: string | null;
  };
  coverage: Array<{
    absent_doctor_id: string;
    start_at: string;
    end_at: string;
    reason: string | null;
  }>;
}

export interface PendingSignoffEntry {
  record_type: string;
  record_id: string;
  created_at: string;
  legal_class: string;
  patient_id?: string | null;
  patient_name?: string | null;
  uhid?: string | null;
  summary?: string | null;
  context?: string | null;
  risk_label?: string | null;
  /** "written" | "verbal" | "telephone" (prescriptions only). */
  order_mode?: string | null;
  /** 24h countersign deadline for a verbal/telephone order. */
  countersign_due_at?: string | null;
  /** True when a nurse transcribed the order on the doctor's behalf. */
  transcribed?: boolean | null;
}

/** Compliance state of a verbal/telephone order's countersignature. */
export type VerbalOrderComplianceStatus =
  | "awaiting"
  | "overdue"
  | "countersigned_on_time"
  | "countersigned_late";

/**
 * One row of the ward/compliance verbal & telephone order register.
 * Mirrors `medbrains_server::routes::opd::VerbalOrderEntry`.
 */
export interface VerbalOrderEntry {
  id: string;
  /** "verbal" | "telephone". */
  order_mode: string;
  patient_id?: string | null;
  patient_name?: string | null;
  uhid?: string | null;
  ordering_doctor_id?: string | null;
  ordering_doctor_name?: string | null;
  transcribed_by?: string | null;
  transcribed_by_name?: string | null;
  read_back_confirmed: boolean;
  summary?: string | null;
  created_at: string;
  countersign_due_at?: string | null;
  is_signed: boolean;
  countersigned_at?: string | null;
  countersigned_by?: string | null;
  countersigned_by_name?: string | null;
  compliance_status: VerbalOrderComplianceStatus;
}

/**
 * Visual signature block data for printed PDFs.
 * Mirrors `medbrains_core::print_data::PrintSignatureData`.
 */
export interface PrintSignatureData {
  signed_at: string;
  signer_name: string | null;
  display_image_url: string | null;
  display_block: string | null;
  verify_ref: string;
  legal_class: string;
}

// ─────────────────────────────────────────────────────────
//  Doctor Activities Sub-Sprint B (packages + coverage)
// ─────────────────────────────────────────────────────────

export interface DoctorPackage {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  description: string | null;
  total_price: string;
  validity_days: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DoctorPackageInclusion {
  id: string;
  tenant_id: string;
  package_id: string;
  inclusion_type: "consultation" | "lab" | "procedure" | "service";
  consultation_specialty_id: string | null;
  consultation_doctor_id: string | null;
  service_id: string | null;
  test_id: string | null;
  procedure_id: string | null;
  included_quantity: number;
  notes: string | null;
  sort_order: number;
}

export interface PackageWithInclusions extends DoctorPackage {
  inclusions: DoctorPackageInclusion[];
}

export interface CreateDoctorPackageRequest {
  code: string;
  name: string;
  description?: string | null;
  total_price: string;
  validity_days?: number;
  inclusions?: CreateInclusionRequest[];
}

export interface CreateInclusionRequest {
  inclusion_type: "consultation" | "lab" | "procedure" | "service";
  consultation_specialty_id?: string | null;
  consultation_doctor_id?: string | null;
  service_id?: string | null;
  test_id?: string | null;
  procedure_id?: string | null;
  included_quantity: number;
  notes?: string | null;
  sort_order?: number;
}

export interface UpdateDoctorPackageRequest {
  name?: string;
  description?: string | null;
  total_price?: string;
  validity_days?: number;
  is_active?: boolean;
}

export interface PatientPackageSubscription {
  id: string;
  tenant_id: string;
  package_id: string;
  patient_id: string;
  purchased_at: string;
  purchased_via_invoice_id: string | null;
  valid_until: string;
  total_paid: string;
  status: "active" | "exhausted" | "expired" | "refunded" | "suspended";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InclusionBalance {
  inclusion_id: string;
  inclusion_type: string;
  included_quantity: number;
  consumed_quantity: number;
  remaining: number;
}

export interface SubscriptionWithBalance extends PatientPackageSubscription {
  package_name: string | null;
  balances: InclusionBalance[];
}

export interface SubscribeRequest {
  package_id: string;
  patient_id: string;
  purchased_via_invoice_id?: string | null;
  total_paid: string;
  notes?: string | null;
}

export interface ConsumeRequest {
  inclusion_type: string;
  consumed_visit_id?: string | null;
  consumed_service_id?: string | null;
  consumed_test_id?: string | null;
  consumed_procedure_id?: string | null;
  consumed_quantity?: number;
  notes?: string | null;
}

export interface CoverageAssignment {
  id: string;
  tenant_id: string;
  absent_doctor_id: string;
  covering_doctor_id: string;
  start_at: string;
  end_at: string;
  reason: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CreateCoverageRequest {
  absent_doctor_id: string;
  covering_doctor_id: string;
  start_at: string;
  end_at: string;
  reason?: string | null;
}

// ─── Internal data simulator control plane ───────────────────────────

export interface SimulatorProfileBranches {
  lab_pct: number;
  rad_pct: number;
  ipd_escalation_pct: number;
  rx_pct: number;
  dispense_pct: number;
}

export interface SimulatorProfileTriageMix {
  red: number;
  yellow: number;
  green: number;
}

export interface SimulatorProfileEr {
  mlc_pct: number;
  admit_pct: number;
  triage_mix: SimulatorProfileTriageMix;
}

export interface SimulatorProfileHours {
  opd_open_hour: number;
  opd_close_hour: number;
  ipd_admission_start_hour: number;
  er_24h: boolean;
}

export interface SimulatorProfileHolidays {
  respect_holidays: boolean;
  opd_scale_on_holiday: number;
  er_scale_on_holiday: number;
  festival_weight_boost: number;
}

export interface SimulatorProfileSeasonality {
  enabled: boolean;
  region: string;
}

export interface SimulatorProfileVolumes {
  opd_count?: number | null;
  ipd_count?: number | null;
  er_count?: number | null;
  lab_count?: number | null;
  radiology_count?: number | null;
  pharmacy_count?: number | null;
}

export interface SimulatorProfileNaturalFlow {
  enabled: boolean;
  lookback_days: number;
  blend: number;
}

// ─── News / health advisories ────────────────────────────────────────

export type NewsCategory =
  | "outbreak_alert"
  | "weather_advisory"
  | "festival_advisory"
  | "internal_notice";

export type NewsSeverity = "info" | "warning" | "critical";

export interface NewsArticle {
  id: string;
  tenant_id: string;
  category: NewsCategory;
  title: string;
  body: string;
  severity: NewsSeverity;
  source?: string | null;
  icd_boost: string[];
  is_active: boolean;
  published_at: string;
  expires_at?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface CreateNewsArticleRequest {
  category: NewsCategory;
  title: string;
  body?: string;
  severity?: NewsSeverity;
  source?: string;
  icd_boost?: string[];
  published_at?: string;
  expires_at?: string;
  is_active?: boolean;
}

export interface UpdateNewsArticleRequest {
  category?: NewsCategory;
  title?: string;
  body?: string;
  severity?: NewsSeverity;
  source?: string;
  icd_boost?: string[];
  published_at?: string;
  expires_at?: string;
  is_active?: boolean;
}

export interface SimulatorProfile {
  patients: number;
  date?: string | null;
  opd_pct: number;
  er_pct: number;
  branches: SimulatorProfileBranches;
  er: SimulatorProfileEr;
  case_mix?: Record<string, number> | null;
  // Day-4 realism — optional so older schedules load unchanged.
  hours?: SimulatorProfileHours;
  holidays?: SimulatorProfileHolidays;
  seasonality?: SimulatorProfileSeasonality;
  volumes?: SimulatorProfileVolumes;
  natural_flow?: SimulatorProfileNaturalFlow;
  approval_mode?: "auto" | "manual";
}

export interface SimulatorSchedule {
  id: string;
  tenant_id: string;
  name: string;
  description?: string | null;
  cron_expr?: string | null;
  profile: SimulatorProfile;
  enabled: boolean;
  created_by?: string | null;
  last_run_at?: string | null;
  next_run_at?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface SimulatorPreviewResponse {
  date: string;
  season_label: string;
  season_icds: string[];
  holiday_name?: string | null;
  holiday_kind?: string | null;
  holiday_icds: string[];
  news_icds: string[];
  natural_top_icds: Array<[string, number]>;
  effective_opd_count: number;
  effective_er_count: number;
}

export type SimulatorRunApprovalStatus =
  | "auto_committed"
  | "pending_approval"
  | "approved"
  | "rejected";

export interface SimulatorRun {
  id: string;
  tenant_id: string;
  schedule_id?: string | null;
  triggered_by?: string | null;
  trigger_kind: "manual" | "cron";
  started_at: string;
  finished_at?: string | null;
  status: "running" | "succeeded" | "failed" | "cancelled";
  summary: SimulatorRunSummary;
  error?: string | null;
  created_at: string;
  approval_status: SimulatorRunApprovalStatus;
}

export interface SimulatorRunSummary {
  opd_count?: number;
  er_count?: number;
  vitals_count?: number;
  diagnoses_count?: number;
  prescription_count?: number;
  lab_count?: number;
  radiology_count?: number;
  pharmacy_count?: number;
  ipd_admission_count?: number;
  triage_count?: number;
  er_admit_count?: number;
  errors?: number;
}

export interface SimulatorRunStep {
  id: string;
  tenant_id: string;
  run_id: string;
  step_type: string;
  target_id?: string | null;
  success: boolean;
  error?: string | null;
  created_at: string;
}

export interface SimulatorRunDetail {
  run: SimulatorRun;
  steps: SimulatorRunStep[];
}

export interface CreateSimulatorScheduleRequest {
  name: string;
  description?: string;
  cron_expr?: string;
  profile: SimulatorProfile;
  enabled?: boolean;
}

export interface UpdateSimulatorScheduleRequest {
  name?: string;
  description?: string;
  cron_expr?: string | null;
  profile?: SimulatorProfile;
  enabled?: boolean;
}

export interface SimulatorRunNowResponse {
  run_id: string;
}
