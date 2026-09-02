// Pharmacy phase-2 types (NDPS, returns, transfers, store assignments) — split from index.ts, barrel-re-exported.

import type { Encounter } from "./dashboard-widget-builder";
import type { AdmissionAttender, IpType } from "./index";
import type {
  NdpsRegisterAction,
  PharmacyOrderItemInput,
  PharmacyReturnStatusType,
} from "./medication-timing";

// ── Pharmacy Phase 2 ──────────────────────────────────────

export interface PharmacyBatch {
  id: string;
  tenant_id: string;
  catalog_item_id: string;
  batch_number: string;
  expiry_date: string;
  manufacture_date: string | null;
  quantity_received: number;
  quantity_dispensed: number;
  quantity_on_hand: number;
  store_location_id: string | null;
  supplier_info: string | null;
  grn_item_id: string | null;
  grn_id: string | null;
  invoice_number: string | null;
  supplier_batch_number: string | null;
  purchase_rate: string | null;
  selling_rate: string | null;
  vendor_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface NdpsRegisterEntry {
  id: string;
  tenant_id: string;
  catalog_item_id: string;
  action: NdpsRegisterAction;
  quantity: number;
  balance_after: number;
  patient_id: string | null;
  prescription_id: string | null;
  dispensed_by: string | null;
  witnessed_by: string | null;
  register_number: string | null;
  page_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PharmacyReturn {
  id: string;
  tenant_id: string;
  order_item_id: string;
  patient_id: string;
  quantity_returned: number;
  reason: string | null;
  status: PharmacyReturnStatusType;
  approved_by: string | null;
  return_batch_id: string | null;
  restocked: boolean;
  created_at: string;
  updated_at: string;
}

export interface PharmacyStoreAssignment {
  id: string;
  tenant_id: string;
  store_location_id: string;
  is_central: boolean;
  serves_departments: string[] | null;
  operating_hours: unknown | null;
  created_at: string;
  updated_at: string;
}

export interface PharmacyTransferRequest {
  id: string;
  tenant_id: string;
  from_location_id: string;
  to_location_id: string;
  status: string;
  items: unknown;
  requested_by: string;
  approved_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PharmacyValidationResult {
  valid: boolean;
  warnings: string[];
  blocks: string[];
  interactions: unknown[];
}

export interface NdpsBalanceRow {
  catalog_item_id: string;
  drug_name: string;
  balance: number;
}

export interface NdpsReportResponse {
  entries: NdpsBalanceRow[];
}

export interface NdpsListResponse {
  entries: NdpsRegisterEntry[];
  total: number;
  page: number;
  per_page: number;
}

export interface PharmacyConsumptionRow {
  drug_name: string;
  category: string | null;
  total_dispensed: number;
  total_value: string;
}

export interface PharmacyAbcVedRow {
  drug_name: string;
  annual_value: string;
  abc_class: string;
  ved_class: string | null;
}

export interface NearExpiryRow {
  drug_name: string;
  batch_number: string;
  expiry_date: string;
  quantity_on_hand: number;
  days_until_expiry: number;
}

/** Ward PAR/imprest stock — par vs on-hand per ward × drug. */
export interface WardStockRow {
  catalog_item_id: string;
  drug_name: string;
  par_qty: number;
  min_qty: number;
  on_hand: number;
  gap: number;
}

export type CaseSheetScanStatus =
  | "uploaded"
  | "parsing"
  | "parsed"
  | "reviewing"
  | "committed"
  | "failed"
  | "image_only";

/** A scanned handwritten case sheet in the digitization pipeline (RFC-CASE-SHEET-DIGITIZATION). */
export interface CaseSheetScan {
  id: string;
  tenant_id: string;
  patient_id: string;
  encounter_id: string | null;
  scan_image_url: string;
  status: CaseSheetScanStatus;
  extracted_json: unknown;
  overall_confidence: string | null;
  parse_error: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Per-page SEO metadata for the micro-site (#2955). */
export interface SeoSetting {
  id: string;
  page_slug: string;
  meta_title: string | null;
  meta_description: string | null;
  keywords: string | null;
  og_image_url: string | null;
  schema_markup: unknown;
  created_at: string;
}

/** A mapped custom domain for the micro-site (#2956). */
export interface SiteDomain {
  id: string;
  domain: string;
  is_primary: boolean;
  is_verified: boolean;
  verification_token: string | null;
  created_at: string;
}

/** Micro-site chat / WhatsApp widget config (#2959). */
export interface MicrositeConfig {
  whatsapp_number: string | null;
  whatsapp_enabled: boolean;
  chat_widget_enabled: boolean;
  chat_greeting: string | null;
}

/** A patient testimonial / review for the micro-site (#2954). */
export interface Testimonial {
  id: string;
  patient_name: string;
  rating: number;
  service: string | null;
  body: string;
  is_approved: boolean;
  is_published: boolean;
  created_at: string;
}

/** A marketed health package / promotion (#2953). */
export interface HealthPackage {
  id: string;
  name: string;
  description: string | null;
  price: string;
  includes: string | null;
  category: string | null;
  is_active: boolean;
  is_promoted: boolean;
  valid_until: string | null;
  created_at: string;
}

/** Availability of one telemedicine video provider. */
export interface TeleProviderInfo {
  name: string;
  available: boolean;
  requires_credentials: boolean;
}

/** In-app telemedicine video provider configuration. */
export interface TeleConfig {
  video_base: string;
  video_base_configured: boolean;
  default_provider: string;
  providers: TeleProviderInfo[];
}

/** A telemedicine chat message (video fallback) (#2948). */
export interface TeleChatMessage {
  id: string;
  consultation_id: string;
  sender_role: string;
  sender_id: string | null;
  body: string;
  sent_at: string;
}

/** A patient in the telemedicine waiting room with queue position (#2945) + triage acuity. */
export interface WaitingRoomItem {
  id: string;
  patient_id: string;
  patient_name: string | null;
  doctor_id: string | null;
  scheduled_at: string | null;
  position: number;
  acuity: string | null;
  red_flags: string[] | null;
}

/** Aggregate, de-identified tele-triage research performance. */
export interface TriageResearchSummary {
  total: number;
  by_acuity: Array<{ acuity: string; count: number }>;
  red_flag_frequency: Array<{ flag: string; count: number }>;
  acuity_disposition: Array<{ acuity: string; disposition: string; count: number }>;
  emergent_escalation_rate: number;
}

/** A de-identified tele-triage research dataset row (no PHI). */
export interface TriageResearchRow {
  acuity: string;
  symptoms: string[];
  severity: number | null;
  red_flags: string[];
  has_encounter: boolean;
  disposition: string;
  age_band: string | null;
  biological_sex: string | null;
  triaged_week: string;
}

/** A pre-consult triage result from the deterministic red-flag / acuity engine. */
export interface TeleTriage {
  id: string;
  consultation_id: string;
  patient_id: string;
  chief_complaint: string | null;
  symptoms: string[];
  duration_hours: number | null;
  severity: number | null;
  vitals: Record<string, unknown>;
  acuity: string;
  red_flags: string[];
  recommended_timeframe: string | null;
  reasoning: Array<{ flag: string; rule: string }>;
  created_at: string;
}

/** A skilled-nursing-facility admission (#2960). */
export interface SnfAdmission {
  id: string;
  patient_id: string;
  admission_date: string;
  source: string;
  level_of_care: string;
  primary_diagnosis: string | null;
  care_plan: string | null;
  expected_los_days: number | null;
  status: string;
  discharge_date: string | null;
  notes: string | null;
  created_at: string;
}

/** A home-care referral from discharge (#2966). */
export interface HomeCareReferral {
  id: string;
  patient_id: string;
  referral_type: string;
  reason: string | null;
  status: string;
  provider: string | null;
  referred_date: string;
  notes: string | null;
  created_at: string;
}

/** A readmission-risk (LACE-style) assessment (#2965). */
export interface ReadmissionRisk {
  id: string;
  patient_id: string;
  length_of_stay: number;
  acuity_score: number;
  comorbidity_score: number;
  ed_visits: number;
  total_score: number;
  risk_level: string;
  notes: string | null;
  assessed_at: string;
  created_at: string;
}

/** A family communication message — care update or family message (#2964). */
export interface FamilyMessage {
  id: string;
  patient_id: string;
  direction: string;
  message_type: string;
  subject: string | null;
  body: string;
  family_contact: string | null;
  status: string;
  created_at: string;
}

/** A rehabilitation therapy session progress record (#2963). */
export interface RehabProgress {
  id: string;
  patient_id: string;
  therapy_type: string;
  session_date: string;
  goal: string | null;
  progress_note: string | null;
  functional_score: number | null;
  created_at: string;
}

/** A long-term (chronic) medication on an extended supply cycle (#2962). */
export interface LtcMedication {
  id: string;
  patient_id: string;
  drug_name: string;
  dosage: string | null;
  frequency: string | null;
  supply_days: number;
  auto_refill: boolean;
  start_date: string;
  next_refill_date: string | null;
  last_refilled_at: string | null;
  refill_count: number;
  status: string;
  notes: string | null;
  created_at: string;
}

/** A Long-Term Care MDS (Minimum Data Set) assessment (#2961). */
export interface MdsAssessment {
  id: string;
  patient_id: string;
  assessment_type: string;
  assessment_date: string;
  cognitive_status: string | null;
  mood_score: number | null;
  adl_dependency_score: number | null;
  continence_status: string | null;
  nutrition_notes: string | null;
  sections: Record<string, unknown>;
  status: string;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
}

/** A bereavement support follow-up contact for a family (#2974). */
export interface BereavementFollowup {
  id: string;
  patient_id: string;
  family_contact_name: string;
  relationship: string | null;
  contact_type: string;
  scheduled_date: string;
  status: string;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
}

/** An advance directive / DNR with family-consent tracking (#2973). */
export interface AdvanceDirective {
  id: string;
  patient_id: string;
  directive_type: string;
  content: string | null;
  effective_date: string;
  status: string;
  family_consent_obtained: boolean;
  family_member_name: string | null;
  family_relationship: string | null;
  witnessed_by: string | null;
  document_url: string | null;
  revoked_at: string | null;
  revoke_reason: string | null;
  notes: string | null;
  created_at: string;
}

/** A hospice / palliative program enrollment (#2972). */
export interface HospiceEnrollment {
  id: string;
  patient_id: string;
  enrolled_date: string;
  terminal_diagnosis: string | null;
  prognosis: string | null;
  comfort_care_plan: string | null;
  dnr_confirmed: boolean;
  primary_caregiver: string | null;
  status: string;
  discharge_date: string | null;
  notes: string | null;
  created_at: string;
}

/** A caregiver education session record (#2971). */
export interface CaregiverEducation {
  id: string;
  patient_id: string;
  caregiver_name: string;
  relationship: string | null;
  topic: string;
  materials_provided: string | null;
  understanding_confirmed: boolean;
  session_date: string;
  notes: string | null;
  created_at: string;
}

/** A prepaid home-care visit package (#2970). */
export interface HomeCarePackage {
  id: string;
  patient_id: string;
  name: string;
  total_visits: number;
  used_visits: number;
  price: string;
  status: string;
  invoice_id: string | null;
  purchased_at: string;
  created_at: string;
}

/** A remote vital reading from a home patient's connected device (#2969). */
export interface RemoteVitalReading {
  id: string;
  patient_id: string;
  device_type: string;
  reading: Record<string, unknown>;
  is_flagged: boolean;
  measured_at: string;
  source: string;
  created_at: string;
}

/** A scheduled home visit assigned to a nurse (#2967). */
export interface HomeVisit {
  id: string;
  patient_id: string;
  first_name: string | null;
  last_name: string | null;
  nurse_id: string | null;
  nurse_name: string | null;
  scheduled_date: string;
  scheduled_time: string | null;
  address: string | null;
  purpose: string | null;
  status: string;
  visit_order: number | null;
  notes: string | null;
  vitals: unknown;
  wound_photo_url: string | null;
  medication_compliance: string | null;
  documented_at: string | null;
  completed_at: string | null;
  created_at: string;
}

/** A home medication administration (Hospital-at-Home eMAR — IV antibiotics / infusions). */
export interface HomeMedAdministration {
  id: string;
  tenant_id: string;
  patient_id: string;
  drug_name: string;
  dose: string;
  route: string | null;
  is_infusion: boolean;
  infusion_rate: string | null;
  scheduled_at: string;
  administered_at: string | null;
  administered_by: string | null;
  administration_site: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** A clinical trial in the hospital research registry (#2983). */
export interface ClinicalTrial {
  id: string;
  tenant_id: string;
  protocol_number: string;
  title: string;
  sponsor: string | null;
  phase: string | null;
  status: string;
  indication: string | null;
  principal_investigator: string | null;
  target_enrollment: number | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  is_active: boolean;
  min_age: number | null;
  max_age: number | null;
  eligibility_sex: string | null;
  diagnosis_codes: string[] | null;
  created_at: string;
  updated_at: string;
}

/** An IRB / ethics-committee submission for a trial (#2989). */
export interface TrialIrbSubmission {
  id: string;
  submission_type: string;
  committee_name: string | null;
  reference_number: string | null;
  submitted_date: string;
  status: string;
  decision_date: string | null;
  notes: string | null;
  created_at: string;
}

/** A blinded/unblinded randomization assignment (#2988) — arm is null while blinded. */
export interface TrialRandomization {
  id: string;
  patient_id: string;
  first_name: string | null;
  last_name: string | null;
  arm: string | null;
  randomization_code: string | null;
  is_unblinded: boolean;
  unblind_reason: string | null;
  unblinded_at: string | null;
  randomized_at: string;
}

/** An adverse event / SAE reported during a trial (#2987). */
export interface TrialAdverseEvent {
  id: string;
  patient_id: string;
  first_name: string | null;
  last_name: string | null;
  event_term: string;
  onset_date: string | null;
  severity: string;
  is_serious: boolean;
  relatedness: string;
  outcome: string;
  reported_date: string;
  description: string | null;
  created_at: string;
}

/** A protocol visit in a trial's schedule (#2986). */
export interface TrialVisit {
  id: string;
  patient_id: string;
  first_name: string | null;
  last_name: string | null;
  visit_name: string;
  scheduled_date: string;
  status: string;
  procedures: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
}

/** An informed-consent record for trial participation (#2985), reusing the e-consent module. */
export interface TrialConsent {
  id: string;
  patient_id: string;
  first_name: string | null;
  last_name: string | null;
  template_id: string | null;
  template_name: string | null;
  template_version: number | null;
  signed_by_patient: boolean | null;
  patient_signed_at: string | null;
  is_revoked: boolean | null;
  created_at: string;
}

/** A patient who matches a clinical trial's structured eligibility (#2984). */
export interface TrialCandidate {
  id: string;
  first_name: string | null;
  last_name: string | null;
  age: number | null;
  biological_sex: string | null;
}

/** A Home Healthcare discharge-program item (training material or discharge criterion). */
export interface HomeDischargeItem {
  id: string;
  tenant_id: string;
  patient_id: string;
  item_type: string;
  title: string;
  description: string | null;
  is_complete: boolean;
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** A Home Healthcare daily clinical progress note (visiting nurse / remote physician). */
export interface HomeProgressNote {
  id: string;
  tenant_id: string;
  patient_id: string;
  note_date: string;
  author_id: string | null;
  author_role: string;
  note_text: string;
  vitals: unknown;
  created_at: string;
  updated_at: string;
}

/** A Home Healthcare emergency escalation (vitals breach → ambulance). */
export interface HomeEscalation {
  id: string;
  tenant_id: string;
  patient_id: string;
  reason: string;
  vital_details: unknown;
  severity: string;
  status: string;
  raised_by: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** A nurse on duty in a ward today (care-view "who's caring for this ward now"). */
export interface WardOnDutyRow {
  nurse_user_id: string;
  nurse_name: string;
  shift_type: string;
  primary_assigned: boolean;
  is_charge: boolean;
  patient_count: number;
}

/** A location with its full breadcrumb path (wayfinding directory / direction board). */
export interface LocationDirectoryRow {
  id: string;
  name: string;
  level: string;
  code: string;
  full_path: string;
  depth: number;
}

/** A staff member assigned to a location (ward / nursing station / floor). */
export interface StaffLocationAssignment {
  id: string;
  user_id: string;
  full_name: string;
  username: string;
  role: string;
  role_label: string | null;
  is_primary: boolean;
  effective_from: string;
  effective_to: string | null;
}

/** Per-location pharmacy stock health (multi-pharmacy dashboard). */
export interface LocationStockSummary {
  location_id: string;
  location_name: string;
  stock_value: string;
  item_count: number;
  near_expiry_batches: number;
  expired_batches: number;
}

export interface PharmacyDeadStockRow {
  drug_name: string;
  current_stock: number;
  stock_value: string;
  last_dispensed_date: string | null;
  days_idle: number | null;
}

export interface DrugUtilizationRow {
  drug_name: string;
  generic_name: string | null;
  aware_category: string | null;
  total_dispensed: number;
  unique_patients: number;
}

export interface CreateOtcSaleRequest {
  items: PharmacyOrderItemInput[];
  notes?: string;
  store_location_id?: string;
}

export interface CreateDischargeMedsRequest {
  patient_id: string;
  discharge_summary_id: string;
  encounter_id?: string;
  items: PharmacyOrderItemInput[];
  notes?: string;
  allergy_override_reason?: string;
}

export interface CreateNdpsEntryRequest {
  catalog_item_id: string;
  action: NdpsRegisterAction;
  quantity: number;
  notes?: string;
  witnessed_by?: string;
}

export interface CreatePharmacyBatchRequest {
  catalog_item_id: string;
  batch_number: string;
  expiry_date: string;
  manufacture_date?: string;
  quantity_received: number;
  store_location_id?: string;
  supplier_info?: string;
  invoice_number?: string;
  supplier_batch_number?: string;
  purchase_rate?: number;
  selling_rate?: number;
}

export interface CreateStoreAssignmentRequest {
  store_location_id: string;
  is_central?: boolean;
  serves_departments?: string[];
  operating_hours?: unknown;
}

export interface PharmacyTransferItem {
  catalog_item_id: string;
  quantity: number;
}

export interface CreatePharmacyTransferRequest {
  from_location_id: string;
  to_location_id: string;
  items: PharmacyTransferItem[];
  notes?: string;
}

export interface CreatePharmacyReturnRequest {
  order_item_id: string;
  patient_id: string;
  quantity_returned: number;
  reason?: string;
}

export interface CreatePharmacyReturnBatchItemRequest {
  order_item_id: string;
  quantity_returned: number;
  reason?: string;
}

export interface CreatePharmacyReturnBatchRequest {
  patient_id: string;
  items: CreatePharmacyReturnBatchItemRequest[];
}

export interface ProcessPharmacyReturnRequest {
  status: PharmacyReturnStatusType;
}

// ══════════════════════════════════════════════════════════
//  IPD Module
// ══════════════════════════════════════════════════════════

export type AdmissionStatus = "admitted" | "transferred" | "discharged" | "absconded" | "deceased";
export type DischargeType = "normal" | "lama" | "dama" | "absconded" | "referred" | "deceased";
export type DischargeSummaryStatus = "draft" | "finalized";
export type AdmissionSource = "er" | "opd" | "direct" | "referral" | "transfer_in";

export interface Admission {
  id: string;
  tenant_id: string;
  encounter_id: string;
  patient_id: string;
  bed_id: string | null;
  admitting_doctor: string;
  status: AdmissionStatus;
  admitted_at: string;
  discharged_at: string | null;
  discharge_type: DischargeType | null;
  discharge_summary: string | null;
  provisional_diagnosis: string | null;
  comorbidities: unknown[];
  estimated_los_days: number | null;
  deposit_amount: number | null;
  deposit_paid: boolean;
  priority: string;
  admission_source: AdmissionSource | null;
  referral_from: string | null;
  referral_doctor: string | null;
  referral_notes: string | null;
  admission_weight_kg: number | null;
  admission_height_cm: number | null;
  expected_discharge_date: string | null;
  ward_id: string | null;
  mlc_case_id: string | null;
  ip_type: IpType | null;
  estimated_cost: number | null;
  is_critical: boolean;
  isolation_required: boolean;
  isolation_reason: string | null;
  primary_nurse_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdmissionRow {
  id: string;
  encounter_id: string;
  patient_id: string;
  bed_id: string | null;
  admitting_doctor: string;
  status: AdmissionStatus;
  admitted_at: string;
  discharged_at: string | null;
  patient_name: string;
  uhid: string;
  ward_name: string | null;
}

export type NursingTaskPriority = "routine" | "urgent" | "stat";
export type NursingTaskCategory =
  | "vital_check"
  | "wound_care"
  | "catheter_care"
  | "repositioning"
  | "mouth_care"
  | "hygiene"
  | "mobilization"
  | "teaching"
  | "drain_care"
  | "tracheostomy_care"
  | "medication"
  | "other";

export interface NursingTask {
  id: string;
  tenant_id: string;
  admission_id: string;
  assigned_to: string | null;
  task_type: string;
  description: string;
  is_completed: boolean;
  due_at: string | null;
  completed_at: string | null;
  completed_by: string | null;
  priority: NursingTaskPriority;
  category: NursingTaskCategory | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdmissionListResponse {
  admissions: AdmissionRow[];
  total: number;
  page: number;
  per_page: number;
}

export interface CreateAdmissionRequest {
  patient_id: string;
  department_id: string;
  doctor_id?: string;
  bed_id?: string;
  notes?: string;
  admission_source?: AdmissionSource;
  referral_from?: string;
  referral_doctor?: string;
  referral_notes?: string;
  admission_weight_kg?: number;
  admission_height_cm?: number;
  expected_discharge_date?: string;
  ward_id?: string;
}

export interface CreateAdmissionResponse {
  encounter: Encounter;
  admission: Admission;
}

export interface AdmissionDetailResponse {
  admission: Admission;
  encounter: Encounter;
  tasks: NursingTask[];
  attenders?: AdmissionAttender[];
}

export interface UpdateAdmissionRequest {
  bed_id?: string;
  notes?: string;
}

export interface TransferBedRequest {
  bed_id: string;
  notes?: string;
}

export interface DischargeRequest {
  discharge_type: DischargeType;
  discharge_summary?: string;
}

export interface CreateNursingTaskRequest {
  task_type: string;
  description: string;
  assigned_to?: string;
  due_at?: string;
  notes?: string;
}

export interface UpdateNursingTaskRequest {
  task_type?: string;
  description?: string;
  assigned_to?: string;
  is_completed?: boolean;
  due_at?: string;
  notes?: string;
}
