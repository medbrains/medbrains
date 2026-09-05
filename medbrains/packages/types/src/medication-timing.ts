// Medication timing (structured administration instructions) types — split from index.ts, barrel-re-exported.
import type { DiagnosisCodingSystem, PharmacyRxStatus, Prescription } from "./index";

// ── Medication Timing (structured instructions) ──────────────
export type FoodTiming = "before_food" | "with_food" | "after_food" | "empty_stomach" | "any";
export type TimeOfDay = "morning" | "afternoon" | "evening" | "bedtime";

export interface MedicationTiming {
  _v: 1;
  food_timing?: FoodTiming;
  time_slots?: TimeOfDay[];
  specific_times?: string[];
  custom_instruction?: string;
}

export interface PrescriptionItem {
  id: string;
  tenant_id: string;
  prescription_id: string;
  drug_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  route: string | null;
  instructions: string | null;
  created_at: string;
  item_status: string;
  discontinued_at: string | null;
  discontinued_by: string | null;
  discontinue_reason: string | null;
  catalog_item_id: string | null;
}

export interface PrescriptionItemInput {
  drug_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  route?: string;
  instructions?: string;
  catalog_item_id?: string;
}

export type RxOrderMode = "written" | "verbal" | "telephone";

export interface CreatePrescriptionRequest {
  notes?: string;
  items: PrescriptionItemInput[];
  order_mode?: RxOrderMode;
  ordering_doctor_id?: string;
  read_back_confirmed?: boolean;
  /** Reason for prescribing over the catalogue max dose — required when a line exceeds it. */
  dose_override_reason?: string;
  /** Reason for prescribing despite a documented drug allergy — required on conflict. */
  allergy_override_reason?: string;
  /** Reason for prescribing despite a major/contraindicated drug-drug interaction — required on conflict. */
  interaction_override_reason?: string;
  /** Reason for prescribing two drugs with the same active ingredient (therapeutic duplication) — required on conflict. */
  duplicate_override_reason?: string;
  /** Reason for prescribing when the prescriber's medical registration has expired — required in that case. */
  credential_override_reason?: string;
}

export interface UpdatePrescriptionRequest {
  notes?: string;
  items: PrescriptionItemInput[];
}

export interface PrescriptionWithItems {
  prescription: Prescription;
  items: PrescriptionItem[];
  pharmacy_status?: PharmacyRxStatus | null;
  pharmacy_rx_queue_id?: string | null;
  pharmacy_order_id?: string | null;
}

export interface PrescriptionTemplate {
  id: string;
  tenant_id: string;
  created_by: string;
  name: string;
  description: string | null;
  department_id: string | null;
  is_shared: boolean;
  items: PrescriptionItemInput[];
  created_at: string;
  updated_at: string;
}

export interface CreatePrescriptionTemplateRequest {
  name: string;
  description?: string;
  department_id?: string;
  is_shared?: boolean;
  items: PrescriptionItemInput[];
}

export interface PrescriptionHistoryItem {
  prescription: Prescription;
  items: PrescriptionItem[];
  encounter_date: string;
  doctor_name: string | null;
  pharmacy_status?: PharmacyRxStatus | null;
  pharmacy_rx_queue_id?: string | null;
  pharmacy_order_id?: string | null;
}

export type CertificateType =
  | "medical"
  | "fitness"
  | "sick_leave"
  | "disability"
  | "death"
  | "birth"
  | "custom";

export interface MedicalCertificate {
  id: string;
  tenant_id: string;
  patient_id: string;
  encounter_id: string | null;
  doctor_id: string;
  certificate_type: CertificateType;
  certificate_number: string | null;
  issued_date: string;
  valid_from: string | null;
  valid_to: string | null;
  diagnosis: string | null;
  remarks: string | null;
  body: Record<string, unknown>;
  is_void: boolean;
  voided_by: string | null;
  voided_at: string | null;
  void_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMedicalCertificateRequest {
  patient_id: string;
  encounter_id?: string;
  certificate_type: CertificateType;
  issued_date?: string;
  valid_from?: string;
  valid_to?: string;
  diagnosis?: string;
  remarks?: string;
  body: Record<string, unknown>;
}

export interface VoidMedicalCertificateRequest {
  void_reason: string;
}

// ══════════════════════════════════════════════════════════
//  Vitals History (Trend Charts)
// ══════════════════════════════════════════════════════════

export interface VitalHistoryPoint {
  id: string;
  encounter_id: string;
  encounter_date: string;
  temperature: number | null;
  pulse: number | null;
  systolic_bp: number | null;
  diastolic_bp: number | null;
  respiratory_rate: number | null;
  spo2: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  bmi: number | null;
  recorded_at: string;
}

// ══════════════════════════════════════════════════════════
//  Referrals
// ══════════════════════════════════════════════════════════

export type ReferralUrgency = "routine" | "urgent" | "emergency";
export type ReferralStatus = "pending" | "accepted" | "declined" | "completed" | "cancelled";

export interface ReferralWithNames {
  id: string;
  patient_id: string;
  encounter_id: string | null;
  from_department_id: string;
  from_department_name: string | null;
  to_department_id: string;
  to_department_name: string | null;
  from_doctor_id: string | null;
  from_doctor_name: string | null;
  to_doctor_id: string | null;
  to_doctor_name: string | null;
  urgency: ReferralUrgency;
  status: ReferralStatus;
  reason: string;
  clinical_notes: string | null;
  response_notes: string | null;
  responded_at: string | null;
  created_at: string;
}

export interface CreateReferralRequest {
  patient_id: string;
  encounter_id?: string;
  to_department_id: string;
  to_doctor_id?: string;
  urgency?: ReferralUrgency;
  reason: string;
  clinical_notes?: string;
}

// ══════════════════════════════════════════════════════════
//  Procedure Catalog & Orders
// ══════════════════════════════════════════════════════════

export interface ProcedureCatalog {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  description: string | null;
  department_id: string | null;
  category: string | null;
  base_price: number | null;
  duration_minutes: number | null;
  requires_consent: boolean;
  requires_anesthesia: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ProcedureOrderStatus =
  | "ordered"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface ProcedureOrderWithName {
  id: string;
  patient_id: string;
  encounter_id: string;
  procedure_id: string;
  procedure_name: string | null;
  procedure_code: string | null;
  ordered_by: string;
  priority: string;
  status: ProcedureOrderStatus;
  scheduled_date: string | null;
  notes: string | null;
  findings: string | null;
  created_at: string;
}

export interface CreateProcedureOrderRequest {
  patient_id: string;
  encounter_id: string;
  procedure_id: string;
  priority?: string;
  scheduled_date?: string;
  notes?: string;
}

// ══════════════════════════════════════════════════════════
//  Duplicate Order Detection
// ══════════════════════════════════════════════════════════

export interface DuplicateOrderInfo {
  id: string;
  order_type: string;
  name: string | null;
  status: string;
  created_at: string;
}

// ══════════════════════════════════════════════════════════
//  Doctor Dockets
// ══════════════════════════════════════════════════════════

export interface DoctorDocket {
  id: string;
  tenant_id: string;
  doctor_id: string;
  docket_date: string;
  total_patients: number;
  new_patients: number;
  follow_ups: number;
  referrals_made: number;
  procedures_done: number;
  notes: string | null;
  generated_at: string;
  created_at: string;
}

// ══════════════════════════════════════════════════════════
//  Patient Reminders
// ══════════════════════════════════════════════════════════

export type ReminderType =
  | "follow_up"
  | "lab_review"
  | "medication_review"
  | "vaccination"
  | "screening"
  | "custom";

export type ReminderStatus =
  | "pending"
  | "sent"
  | "acknowledged"
  | "completed"
  | "cancelled"
  | "overdue";

export type ReminderPriority = "low" | "normal" | "high" | "urgent";

export interface PatientReminder {
  id: string;
  tenant_id: string;
  patient_id: string;
  encounter_id: string | null;
  doctor_id: string;
  reminder_type: ReminderType;
  reminder_date: string;
  title: string;
  description: string | null;
  priority: ReminderPriority;
  status: ReminderStatus;
  notification_channels: string[];
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateReminderRequest {
  patient_id: string;
  encounter_id?: string;
  reminder_type: ReminderType;
  reminder_date: string;
  title: string;
  description?: string;
  priority?: ReminderPriority;
}

// ══════════════════════════════════════════════════════════
//  Patient Feedback
// ══════════════════════════════════════════════════════════

export interface PatientFeedback {
  id: string;
  tenant_id: string;
  patient_id: string;
  encounter_id: string | null;
  doctor_id: string | null;
  department_id: string | null;
  rating: number | null;
  wait_time_rating: number | null;
  staff_rating: number | null;
  cleanliness_rating: number | null;
  overall_experience: string | null;
  suggestions: string | null;
  would_recommend: boolean | null;
  is_anonymous: boolean;
  submitted_at: string;
  created_at: string;
}

export interface CreateFeedbackRequest {
  patient_id: string;
  encounter_id?: string;
  doctor_id?: string;
  department_id?: string;
  rating?: number;
  wait_time_rating?: number;
  staff_rating?: number;
  cleanliness_rating?: number;
  overall_experience?: string;
  suggestions?: string;
  would_recommend?: boolean;
  is_anonymous?: boolean;
}

// ══════════════════════════════════════════════════════════
//  Procedure Consents
// ══════════════════════════════════════════════════════════

export type ProcedureConsentStatus = "pending" | "signed" | "refused" | "withdrawn" | "expired";

export type ProcedureConsentType =
  | "procedure"
  | "anesthesia"
  | "blood_transfusion"
  | "surgery"
  | "investigation"
  | "general";

export interface ProcedureConsent {
  id: string;
  tenant_id: string;
  patient_id: string;
  encounter_id: string | null;
  procedure_order_id: string | null;
  procedure_name: string;
  consent_type: ProcedureConsentType;
  risks_explained: string | null;
  alternatives_explained: string | null;
  benefits_explained: string | null;
  patient_questions: string | null;
  consented_by_name: string | null;
  consented_by_relation: string | null;
  witness_name: string | null;
  witness_designation: string | null;
  doctor_id: string;
  status: ProcedureConsentStatus;
  signed_at: string | null;
  refused_at: string | null;
  refusal_reason: string | null;
  withdrawn_at: string | null;
  withdrawal_reason: string | null;
  expires_at: string | null;
  body: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateConsentRequest {
  patient_id: string;
  encounter_id?: string;
  procedure_order_id?: string;
  procedure_name: string;
  consent_type?: ProcedureConsentType;
  risks_explained?: string;
  alternatives_explained?: string;
  benefits_explained?: string;
  patient_questions?: string;
  consented_by_name?: string;
  consented_by_relation?: string;
  witness_name?: string;
  witness_designation?: string;
}

export interface RevokeProcedureConsentRequest {
  withdrawal_reason: string;
}

// ══════════════════════════════════════════════════════════
//  Patient Diagnoses (cross-encounter)
// ══════════════════════════════════════════════════════════

export interface PatientDiagnosisRow {
  id: string;
  encounter_id: string;
  icd_code: string | null;
  icd_system: DiagnosisCodingSystem;
  icd_display: string | null;
  icd_source_url: string | null;
  icd_source_version: string | null;
  icd_provider_mode: string | null;
  description: string;
  is_primary: boolean;
  notes: string | null;
  severity: string | null;
  certainty: string | null;
  onset_date: string | null;
  resolved_date: string | null;
  snomed_code: string | null;
  snomed_display: string | null;
  encounter_date: string;
  doctor_name: string | null;
  created_at: string;
}

// ══════════════════════════════════════════════════════════
//  Consultation Templates
// ══════════════════════════════════════════════════════════

export interface ConsultationTemplate {
  id: string;
  tenant_id: string;
  created_by: string;
  name: string;
  description: string | null;
  specialty: string | null;
  department_id: string | null;
  is_shared: boolean;
  chief_complaints: string[];
  default_history: Record<string, unknown>;
  default_examination: Record<string, unknown>;
  default_ros: Record<string, unknown>;
  default_plan: string | null;
  common_diagnoses: string[];
  common_medications: Record<string, unknown>[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateConsultationTemplateRequest {
  name: string;
  description?: string;
  specialty?: string;
  department_id?: string;
  is_shared: boolean;
  chief_complaints?: string[];
  default_history?: Record<string, unknown>;
  default_examination?: Record<string, unknown>;
  default_ros?: Record<string, unknown>;
  default_plan?: string;
  common_diagnoses?: string[];
  common_medications?: Record<string, unknown>[];
}

// ══════════════════════════════════════════════════════════
//  OPD Appointments
// ══════════════════════════════════════════════════════════

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "checked_in"
  | "in_consultation"
  | "completed"
  | "cancelled"
  | "no_show";

export type AppointmentType = "new_visit" | "follow_up" | "consultation" | "procedure" | "walk_in";

export interface DoctorSchedule {
  id: string;
  tenant_id: string;
  doctor_id: string;
  department_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_mins: number;
  max_patients: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DoctorScheduleException {
  id: string;
  tenant_id: string;
  doctor_id: string;
  exception_date: string;
  is_available: boolean;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
  created_at: string;
}

export interface Appointment {
  id: string;
  tenant_id: string;
  patient_id: string;
  doctor_id: string;
  department_id: string;
  appointment_date: string;
  slot_start: string;
  slot_end: string;
  appointment_type: AppointmentType;
  status: AppointmentStatus;
  token_number: number | null;
  reason: string | null;
  cancel_reason: string | null;
  notes: string | null;
  encounter_id: string | null;
  checked_in_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  recurrence_pattern: string | null;
  recurrence_group_id: string | null;
  recurrence_index: number | null;
  appointment_group_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AppointmentWithPatient extends Appointment {
  patient_name: string | null;
  doctor_name: string;
}

export interface AvailableSlot {
  start_time: string;
  end_time: string;
  booked_count: number;
  max_patients: number;
  is_available: boolean;
}

export interface CreateScheduleRequest {
  doctor_id: string;
  department_id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_mins?: number;
  max_patients?: number;
}

export interface UpdateScheduleRequest {
  start_time?: string;
  end_time?: string;
  slot_duration_mins?: number;
  max_patients?: number;
  is_active?: boolean;
}

export interface CreateScheduleExceptionRequest {
  doctor_id: string;
  exception_date: string;
  is_available?: boolean;
  start_time?: string;
  end_time?: string;
  reason?: string;
}

export interface BookAppointmentRequest {
  patient_id: string;
  doctor_id: string;
  department_id: string;
  appointment_date: string;
  slot_start: string;
  slot_end: string;
  appointment_type?: AppointmentType;
  reason?: string;
  notes?: string;
  recurrence_pattern?: "weekly" | "biweekly" | "monthly";
  recurrence_count?: number;
}

export interface RescheduleAppointmentRequest {
  appointment_date: string;
  slot_start: string;
  slot_end: string;
}

export interface CancelAppointmentRequest {
  cancel_reason?: string;
}

// ══════════════════════════════════════════════════════════
//  Patient Visit History / Timeline
// ══════════════════════════════════════════════════════════

export interface PatientVisitRow {
  id: string;
  encounter_type: "opd" | "ipd" | "emergency";
  status: "open" | "in_progress" | "completed" | "cancelled";
  encounter_date: string;
  doctor_name: string | null;
  department_name: string | null;
  chief_complaint: string | null;
  diagnosis_count: number | null;
  prescription_count: number | null;
  lab_order_count: number | null;
  created_at: string;
}

export interface PatientConsultationHistoryRow {
  id: string;
  encounter_id: string;
  encounter_type: "opd" | "ipd" | "emergency";
  status: "open" | "in_progress" | "completed" | "cancelled";
  encounter_date: string;
  doctor_name: string | null;
  department_name: string | null;
  chief_complaint: string | null;
  history: string | null;
  examination: string | null;
  plan: string | null;
  notes: string | null;
  hpi: string | null;
  general_appearance: string | null;
  created_at: string;
  updated_at: string;
}

export interface PatientLabOrderRow {
  id: string;
  test_name: string | null;
  status: LabOrderStatus;
  priority: string;
  ordered_by_name: string | null;
  result_count: number | null;
  /** When the sample was taken. Null means nobody has drawn it yet — a
   *  different problem from a slow analyser, needing a different person. */
  collected_at: string | null;
  verified_at: string | null;
  /** The order's override, else the catalogue's `tat_hours` for that test.
   *  Null where neither is set: an expectation nobody stated is not a
   *  deadline anybody missed. */
  expected_tat_minutes: number | null;
  /** A sample can be rejected and re-collected, so this is a note on the
   *  order rather than a terminal status. */
  rejection_reason: string | null;
  sample_barcode: string | null;
  created_at: string;
  updated_at: string;
}

export interface PatientInvoiceRow {
  id: string;
  invoice_number: string;
  status: InvoiceStatus;
  total_amount: string;
  paid_amount: string;
  balance: string;
  item_count: number | null;
  issued_at: string | null;
  created_at: string;
}

export interface PatientAppointmentRow {
  id: string;
  appointment_date: string;
  slot_start: string;
  slot_end: string;
  appointment_type: string;
  status: string;
  doctor_name: string | null;
  department_name: string | null;
  reason: string | null;
  created_at: string;
}

// ══════════════════════════════════════════════════════════
//  Billing Module
// ══════════════════════════════════════════════════════════

export type InvoiceStatus =
  | "draft"
  | "issued"
  | "partially_paid"
  | "paid"
  | "cancelled"
  | "refunded";
export type ChargeSource =
  | "opd"
  | "ipd"
  | "lab"
  | "pharmacy"
  | "procedure"
  | "radiology"
  | "manual"
  | "ot"
  | "emergency"
  | "diet"
  | "cssd"
  | "ambulance";
export type PaymentMode =
  | "cash"
  | "card"
  | "upi"
  | "bank_transfer"
  | "cheque"
  | "insurance"
  | "credit";

export interface Invoice {
  id: string;
  tenant_id: string;
  invoice_number: string;
  patient_id: string;
  encounter_id: string | null;
  admission_id: string | null;
  status: InvoiceStatus;
  subtotal: string;
  tax_amount: string;
  discount_amount: string;
  total_amount: string;
  paid_amount: string;
  notes: string | null;
  issued_at: string | null;
  cgst_amount: string;
  sgst_amount: string;
  igst_amount: string;
  cess_amount: string;
  is_interim: boolean;
  billing_period_start: string | null;
  billing_period_end: string | null;
  sequence_number: number | null;
  corporate_id: string | null;
  place_of_supply: string | null;
  is_er_deferred: boolean;
  cloned_from_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  tenant_id: string;
  invoice_id: string;
  charge_code: string;
  description: string;
  source: ChargeSource;
  source_id: string | null;
  quantity: number;
  unit_price: string;
  tax_percent: string;
  total_price: string;
  gst_rate: string;
  gst_type: GstType;
  cgst_amount: string;
  sgst_amount: string;
  igst_amount: string;
  hsn_sac_code: string | null;
  ordering_doctor_id: string | null;
  department_id: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  tenant_id: string;
  invoice_id: string;
  amount: string;
  mode: PaymentMode;
  reference_number: string | null;
  received_by: string | null;
  notes: string | null;
  paid_at: string;
  created_at: string;
}

export interface ChargeMaster {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  category: string;
  base_price: string;
  tax_percent: string;
  is_active: boolean;
  hsn_sac_code: string | null;
  gst_category: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceListResponse {
  invoices: Invoice[];
  total: number;
  page: number;
  per_page: number;
}

export interface CreateInvoiceRequest {
  patient_id: string;
  encounter_id?: string;
  admission_id?: string;
  notes?: string;
  is_er_deferred?: boolean;
}

export interface AddInvoiceItemRequest {
  charge_code: string;
  description: string;
  source: string;
  source_id?: string;
  quantity: number;
  unit_price: number;
  tax_percent?: number;
  ordering_doctor_id?: string;
  department_id?: string;
}

export interface RecordPaymentRequest {
  amount: number;
  mode: string;
  reference_number?: string;
  notes?: string;
  counter_id?: string;
  shift?: string;
}

export interface InvoiceDetailResponse {
  invoice: Invoice;
  items: InvoiceItem[];
  payments: Payment[];
}

export interface CreateChargeMasterRequest {
  code: string;
  name: string;
  category: string;
  base_price: number;
  tax_percent?: number;
  hsn_sac_code?: string;
  gst_category?: string;
}

export interface UpdateChargeMasterRequest {
  name?: string;
  category?: string;
  base_price?: number;
  tax_percent?: number;
  is_active?: boolean;
  hsn_sac_code?: string;
  gst_category?: string;
}

// -- Billing Packages --

export interface BillingPackage {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  description: string | null;
  total_price: string;
  discount_percent: string;
  is_active: boolean;
  valid_from: string | null;
  valid_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillingPackageItem {
  id: string;
  tenant_id: string;
  package_id: string;
  charge_code: string;
  description: string;
  quantity: number;
  unit_price: string;
  created_at: string;
}

export interface CreatePackageRequest {
  code: string;
  name: string;
  description?: string;
  total_price: number;
  discount_percent?: number;
  valid_from?: string;
  valid_to?: string;
  items: CreatePackageItemRequest[];
}

export interface CreatePackageItemRequest {
  charge_code: string;
  description: string;
  quantity: number;
  unit_price: number;
}

export interface UpdatePackageRequest {
  name?: string;
  description?: string;
  total_price?: number;
  discount_percent?: number;
  is_active?: boolean;
  valid_from?: string;
  valid_to?: string;
}

export interface PackageDetailResponse {
  package: BillingPackage;
  items: BillingPackageItem[];
}

// -- Rate Plans --

export interface RatePlan {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  patient_category: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RatePlanItem {
  id: string;
  tenant_id: string;
  rate_plan_id: string;
  charge_code: string;
  override_price: string;
  override_tax_percent: string | null;
  created_at: string;
}

export interface CreateRatePlanRequest {
  name: string;
  description?: string;
  patient_category?: string;
  is_default?: boolean;
  items: CreateRatePlanItemRequest[];
}

export interface CreateRatePlanItemRequest {
  charge_code: string;
  override_price: number;
  override_tax_percent?: number;
}

export interface UpdateRatePlanRequest {
  name?: string;
  description?: string;
  patient_category?: string;
  is_default?: boolean;
  is_active?: boolean;
}

export interface RatePlanDetailResponse {
  plan: RatePlan;
  items: RatePlanItem[];
}

// -- Discounts --

export interface InvoiceDiscount {
  id: string;
  tenant_id: string;
  invoice_id: string;
  discount_type: string;
  discount_value: string;
  reason: string | null;
  approved_by: string | null;
  created_at: string;
}

export interface AddDiscountRequest {
  discount_type: string;
  discount_value: number;
  reason?: string;
}

// -- Refunds --

export interface Refund {
  id: string;
  tenant_id: string;
  invoice_id: string;
  payment_id: string | null;
  refund_number: string;
  amount: string;
  reason: string;
  mode: PaymentMode;
  reference_number: string | null;
  refunded_by: string | null;
  refunded_at: string;
  created_at: string;
}

export interface CreateRefundRequest {
  invoice_id: string;
  payment_id?: string;
  amount: number;
  reason: string;
  mode: string;
  reference_number?: string;
}

// -- Credit Notes --

export type CreditNoteStatus = "active" | "used" | "cancelled";

export interface CreditNote {
  id: string;
  tenant_id: string;
  credit_note_number: string;
  invoice_id: string;
  amount: string;
  reason: string;
  status: CreditNoteStatus;
  used_against_invoice_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCreditNoteRequest {
  invoice_id: string;
  amount: number;
  reason: string;
}

// -- Receipts --

export interface Receipt {
  id: string;
  tenant_id: string;
  receipt_number: string;
  invoice_id: string;
  payment_id: string;
  amount: string;
  receipt_date: string;
  printed_at: string | null;
  created_at: string;
}

// -- Insurance Claims --

export type InsuranceClaimType = "cashless" | "reimbursement";
export type InsuranceClaimStatus =
  | "initiated"
  | "pre_auth_requested"
  | "pre_auth_approved"
  | "pre_auth_rejected"
  | "claim_submitted"
  | "claim_approved"
  | "claim_rejected"
  | "settled"
  | "partially_settled";

export type InsuranceSchemeType = "private" | "cghs" | "echs" | "pmjay" | "esis" | "state_scheme";

export interface InsuranceClaim {
  id: string;
  tenant_id: string;
  invoice_id: string;
  patient_id: string;
  insurance_provider: string;
  policy_number: string | null;
  claim_number: string | null;
  claim_type: InsuranceClaimType;
  status: InsuranceClaimStatus;
  pre_auth_amount: string | null;
  approved_amount: string | null;
  settled_amount: string | null;
  tpa_name: string | null;
  notes: string | null;
  submitted_at: string | null;
  settled_at: string | null;
  created_by: string | null;
  scheme_type: InsuranceSchemeType;
  co_pay_percent: string | null;
  deductible_amount: string | null;
  member_id: string | null;
  scheme_card_number: string | null;
  is_secondary: boolean;
  primary_claim_id: string | null;
  tpa_rate_plan_id: string | null;
  nhcx_correlation_id: string | null;
  nhcx_api_call_id: string | null;
  nhcx_recipient_code: string | null;
  nhcx_response_payload: unknown | null;
  nhcx_response_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateInsuranceClaimRequest {
  invoice_id: string;
  patient_id: string;
  insurance_provider: string;
  policy_number?: string;
  claim_type: string;
  pre_auth_amount?: number;
  tpa_name?: string;
  notes?: string;
  scheme_type?: string;
  co_pay_percent?: number;
  deductible_amount?: number;
  member_id?: string;
  scheme_card_number?: string;
}

export interface UpdateInsuranceClaimRequest {
  status?: string;
  claim_number?: string;
  approved_amount?: number;
  settled_amount?: number;
  notes?: string;
}

// -- Auto-Billing --

export interface ManualAutoChargeRequest {
  encounter_id: string;
  modules: string[];
}

export interface ManualAutoChargeResponse {
  invoice_id: string | null;
  items_added: number;
  items_skipped: number;
  errors: string[];
}

// -- Billing Phase 2: GST, Advances, Corporate, Reports --

export type GstType = "cgst_sgst" | "igst" | "exempt";
export type AdvancePurpose = "admission" | "prepaid" | "general" | "procedure";
export type AdvanceStatus = "active" | "partially_used" | "fully_used" | "refunded";

export interface PatientAdvance {
  id: string;
  tenant_id: string;
  patient_id: string;
  encounter_id: string | null;
  advance_number: string;
  amount: string;
  balance: string;
  payment_mode: PaymentMode;
  reference_number: string | null;
  purpose: AdvancePurpose;
  status: AdvanceStatus;
  received_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdvanceAdjustment {
  id: string;
  tenant_id: string;
  advance_id: string;
  invoice_id: string;
  amount_adjusted: string;
  adjusted_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface CorporateClient {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  gst_number: string | null;
  billing_address: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  credit_limit: string;
  credit_days: number;
  agreed_discount_percent: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CorporateEnrollment {
  id: string;
  tenant_id: string;
  corporate_id: string;
  patient_id: string;
  employee_id: string | null;
  department: string | null;
  is_active: boolean;
  enrolled_at: string;
  created_at: string;
}

export interface CreateAdvanceRequest {
  patient_id: string;
  encounter_id?: string;
  amount: number;
  payment_mode: string;
  reference_number?: string;
  purpose?: string;
  notes?: string;
}

export interface AdjustAdvanceRequest {
  invoice_id: string;
  amount: number;
  notes?: string;
}

export interface RefundAdvanceRequest {
  amount: number;
  reason: string;
  mode?: string;
  reference_number?: string;
}

export interface CreateInterimInvoiceRequest {
  encounter_id: string;
  patient_id: string;
  notes?: string;
}

export interface CreateCorporateRequest {
  code: string;
  name: string;
  gst_number?: string;
  billing_address?: string;
  contact_email?: string;
  contact_phone?: string;
  credit_limit?: number;
  credit_days?: number;
  agreed_discount_percent?: number;
}

export interface UpdateCorporateRequest {
  name?: string;
  gst_number?: string;
  billing_address?: string;
  contact_email?: string;
  contact_phone?: string;
  credit_limit?: number;
  credit_days?: number;
  agreed_discount_percent?: number;
  is_active?: boolean;
}

export interface CreateEnrollmentRequest {
  patient_id: string;
  employee_id?: string;
  department?: string;
}

export interface BillingSummaryReport {
  total_invoiced: string;
  total_collected: string;
  total_outstanding: string;
  total_refunded: string;
  total_discounts: string;
  invoice_count: number;
  payment_modes: PaymentModeSummary[];
}

export interface PaymentModeSummary {
  mode: string;
  total: string;
  count: number;
}

export interface DepartmentRevenueRow {
  department: string;
  total_revenue: string;
  invoice_count: number;
}

export interface CollectionEfficiencyReport {
  overall_rate: string;
  months: MonthlyEfficiency[];
}

export interface MonthlyEfficiency {
  month: string;
  invoiced: string;
  collected: string;
  rate: string;
}

export interface AgingBucket {
  bucket: string;
  count: number;
  total_amount: string;
}

export interface DailySummary {
  date: string;
  invoices_created: number;
  invoices_issued: number;
  total_billed: string;
  total_collected: string;
  payments: PaymentModeSummary[];
}

// -- Day Close, Write-Offs, TPA Rate Cards, Audit --

export type DayCloseStatus = "open" | "verified" | "discrepancy";
export type WriteOffStatus = "pending" | "approved" | "rejected";
export type AuditAction =
  | "invoice_created"
  | "invoice_issued"
  | "invoice_cancelled"
  | "payment_recorded"
  | "payment_voided"
  | "refund_created"
  | "discount_applied"
  | "discount_removed"
  | "advance_collected"
  | "advance_adjusted"
  | "advance_refunded"
  | "credit_note_created"
  | "credit_note_applied"
  | "claim_created"
  | "claim_updated"
  | "day_closed"
  | "write_off_created"
  | "write_off_approved"
  | "invoice_cloned";

export interface DayEndClose {
  id: string;
  tenant_id: string;
  close_date: string;
  cashier_id: string;
  expected_cash: string;
  actual_cash: string;
  cash_difference: string;
  total_card: string;
  total_upi: string;
  total_cheque: string;
  total_bank_transfer: string;
  total_insurance: string;
  total_collected: string;
  invoices_count: number;
  payments_count: number;
  refunds_total: string;
  advances_total: string;
  status: DayCloseStatus;
  counter_id: string | null;
  shift: string | null;
  denominations: Record<string, number> | null;
  actual_card: string;
  actual_upi: string;
  card_difference: string;
  upi_difference: string;
  verification_notes: string | null;
  verified_by: string | null;
  verified_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BadDebtWriteOff {
  id: string;
  tenant_id: string;
  invoice_id: string;
  write_off_number: string;
  amount: string;
  reason: string;
  status: WriteOffStatus;
  requested_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillingAuditEntry {
  id: string;
  tenant_id: string;
  action: AuditAction;
  entity_type: string;
  entity_id: string;
  invoice_id: string | null;
  patient_id: string | null;
  amount: string | null;
  previous_state: unknown;
  new_state: unknown;
  performed_by: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface TpaRateCard {
  id: string;
  tenant_id: string;
  tpa_name: string;
  insurance_provider: string;
  rate_plan_id: string | null;
  scheme_type: string | null;
  valid_from: string | null;
  valid_to: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateDayCloseRequest {
  close_date: string;
  actual_cash: number;
  notes?: string;
  counter_id?: string;
  shift?: string;
  denominations?: Record<string, number>;
  actual_card?: number;
  actual_upi?: number;
}

export interface CreateWriteOffRequest {
  invoice_id: string;
  amount: number;
  reason: string;
  notes?: string;
}

export interface ApproveWriteOffRequest {
  approved: boolean;
  notes?: string;
}

export interface CreateTpaRateCardRequest {
  tpa_name: string;
  insurance_provider: string;
  rate_plan_id?: string;
  scheme_type?: string;
  valid_from?: string;
  valid_to?: string;
  is_active?: boolean;
}

export interface UpdateTpaRateCardRequest {
  tpa_name?: string;
  insurance_provider?: string;
  rate_plan_id?: string;
  scheme_type?: string;
  valid_from?: string;
  valid_to?: string;
  is_active?: boolean;
}

export interface DoctorRevenueRow {
  doctor_id: string | null;
  doctor_name: string;
  total_revenue: string;
  item_count: number;
}

export interface InsurancePanelRow {
  insurance_provider: string;
  total_claims: number;
  total_claimed: string;
  total_approved: string;
  total_settled: string;
  pending_count: number;
}

export interface ReconciliationReport {
  close_date: string;
  expected_cash: string;
  actual_cash: string;
  cash_difference: string;
  system_total: string;
  total_payments: string;
  total_refunds: string;
  variance: string;
  status: DayCloseStatus;
}

export interface AuditLogResponse {
  entries: BillingAuditEntry[];
  total: number;
  page: number;
  per_page: number;
}

// ══════════════════════════════════════════════════════════
//  Billing Phase 3 — Multi-Currency, Credit, Accounting, TDS, GST, ERP
// ══════════════════════════════════════════════════════════

export type CurrencyCode =
  | "INR"
  | "USD"
  | "EUR"
  | "GBP"
  | "AED"
  | "SAR"
  | "SGD"
  | "BDT"
  | "NPR"
  | "LKR";
export type CreditPatientStatus = "active" | "overdue" | "suspended" | "closed";
export type JournalEntryType =
  | "manual"
  | "auto_invoice"
  | "auto_payment"
  | "auto_refund"
  | "auto_write_off"
  | "auto_advance";
export type JournalEntryStatus = "draft" | "posted" | "reversed";
export type ReconStatus = "unmatched" | "matched" | "discrepancy" | "excluded";
export type GstrFilingStatus = "draft" | "validated" | "filed" | "accepted" | "error";
export type TdsStatus = "deducted" | "deposited" | "certificate_issued";
export type ErpExportStatus = "pending" | "exported" | "failed" | "acknowledged";

export interface ExchangeRate {
  id: string;
  tenant_id: string;
  from_currency: CurrencyCode;
  to_currency: CurrencyCode;
  rate: number;
  effective_date: string;
  source: string | null;
  created_at: string;
}

export interface CreditPatient {
  id: string;
  tenant_id: string;
  patient_id: string;
  credit_limit: number;
  current_balance: number;
  status: CreditPatientStatus;
  approved_by: string | null;
  overdue_since: string | null;
  reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface GlAccount {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  account_type: "asset" | "liability" | "equity" | "revenue" | "expense";
  parent_id: string | null;
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface JournalEntry {
  id: string;
  tenant_id: string;
  entry_number: string;
  entry_date: string;
  entry_type: JournalEntryType;
  status: JournalEntryStatus;
  total_debit: number;
  total_credit: number;
  description: string | null;
  reference_type: string | null;
  reference_id: string | null;
  posted_by: string | null;
  posted_at: string | null;
  reversal_of_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface JournalEntryLine {
  id: string;
  tenant_id: string;
  journal_entry_id: string;
  account_id: string;
  department_id: string | null;
  debit_amount: number;
  credit_amount: number;
  narration: string | null;
  created_at: string;
}

export interface JournalEntryDetail {
  entry: JournalEntry;
  lines: JournalEntryLine[];
}

export interface BankTransaction {
  id: string;
  tenant_id: string;
  bank_name: string;
  account_number: string;
  transaction_date: string;
  value_date: string | null;
  description: string | null;
  debit_amount: number;
  credit_amount: number;
  running_balance: number | null;
  reference_number: string | null;
  recon_status: ReconStatus;
  matched_payment_id: string | null;
  matched_refund_id: string | null;
  import_batch: string | null;
  matched_by: string | null;
  matched_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TdsDeduction {
  id: string;
  tenant_id: string;
  invoice_id: string | null;
  deductee_name: string;
  deductee_pan: string;
  tds_section: string;
  tds_rate: number;
  base_amount: number;
  tds_amount: number;
  status: TdsStatus;
  deducted_date: string;
  challan_number: string | null;
  challan_date: string | null;
  certificate_number: string | null;
  certificate_date: string | null;
  financial_year: string;
  quarter: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface GstReturnSummary {
  id: string;
  tenant_id: string;
  return_type: string;
  period: string;
  filing_status: GstrFilingStatus;
  total_taxable: number;
  total_cgst: number;
  total_sgst: number;
  total_igst: number;
  total_cess: number;
  total_tax: number;
  hsn_summary: unknown[] | null;
  invoice_count: number;
  arn: string | null;
  filed_by: string | null;
  filed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ErpExportLog {
  id: string;
  tenant_id: string;
  target_system: string;
  export_type: string;
  record_ids: string[];
  date_from: string | null;
  date_to: string | null;
  status: ErpExportStatus;
  payload: unknown | null;
  response: unknown | null;
  error_message: string | null;
  exported_by: string | null;
  created_at: string;
}

export interface InvoicePrintData {
  invoice: Invoice;
  items: InvoiceItem[];
  payments: Payment[];
  hospital_gstin: string | null;
  hospital_name: string | null;
  hospital_address: string | null;
  patient_name: string | null;
  patient_address: string | null;
  hsn_summary: HsnSummaryRow[];
}

export interface HsnSummaryRow {
  hsn_code: string;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_tax: number;
  item_count: number;
}

export interface BillingThresholdStatus {
  encounter_id: string;
  current_total: number;
  threshold: number | null;
  exceeded: boolean;
  percentage_used: number | null;
}

export interface DualInsuranceResult {
  primary_claim: InsuranceClaim | null;
  secondary_claim: InsuranceClaim | null;
  patient_responsibility: number;
  coordination_notes: string;
}

export interface CreditAgingRow {
  patient_id: string;
  patient_name: string | null;
  credit_limit: number;
  current_balance: number;
  status: CreditPatientStatus;
  overdue_since: string | null;
  days_overdue: number | null;
}

export interface SchemeRateResult {
  charge_code: string;
  scheme_type: string;
  override_price: number | null;
  tpa_name: string | null;
  rate_plan_name: string | null;
}

export interface FinancialMisReport {
  total_revenue: number;
  total_collections: number;
  total_outstanding: number;
  total_refunds: number;
  total_write_offs: number;
  total_advances: number;
  collection_rate: number;
  period_from: string;
  period_to: string;
}

export interface ProfitLossDeptRow {
  department_id: string | null;
  department_name: string | null;
  revenue: number;
  expenses: number;
  profit: number;
}

export interface AutoReconcileResponse {
  matched_count: number;
  unmatched_count: number;
}

export interface ImportBankTransactionsResponse {
  imported: number;
  import_batch: string;
}

export interface CreateExchangeRateRequest {
  from_currency: CurrencyCode;
  to_currency?: CurrencyCode;
  rate: number;
  effective_date: string;
  source?: string;
}

export interface CreateCreditPatientRequest {
  patient_id: string;
  credit_limit: number;
  reason?: string;
  notes?: string;
}

export interface UpdateCreditPatientRequest {
  credit_limit?: number;
  status?: CreditPatientStatus;
  notes?: string;
}

export interface JournalLineInput {
  account_id: string;
  department_id?: string;
  debit_amount: number;
  credit_amount: number;
  narration?: string;
}

export interface CreateJournalEntryRequest {
  entry_date: string;
  description?: string;
  reference_type?: string;
  reference_id?: string;
  lines: JournalLineInput[];
}

export interface ImportBankTransactionRow {
  bank_name: string;
  account_number: string;
  transaction_date: string;
  value_date?: string;
  description?: string;
  debit_amount: number;
  credit_amount: number;
  running_balance?: number;
  reference_number?: string;
}

export interface ImportBankTransactionsRequest {
  transactions: ImportBankTransactionRow[];
  import_batch?: string;
}

export interface MatchBankTransactionRequest {
  payment_id?: string;
  refund_id?: string;
  notes?: string;
}

export interface CreateTdsRequest {
  invoice_id?: string;
  deductee_name: string;
  deductee_pan: string;
  tds_section: string;
  tds_rate: number;
  base_amount: number;
  deducted_date: string;
  financial_year: string;
  quarter: string;
}

export interface GenerateGstrRequest {
  return_type: string;
  period: string;
}

export interface ErpExportRequest {
  target_system: string;
  export_type: string;
  date_from?: string;
  date_to?: string;
}

export interface CreateGlAccountRequest {
  code: string;
  name: string;
  account_type: string;
  parent_id?: string;
  description?: string;
}

export interface UpdateGlAccountRequest {
  name?: string;
  description?: string;
  is_active?: boolean;
}

// ══════════════════════════════════════════════════════════
//  Lab Module
// ══════════════════════════════════════════════════════════

export type LabOrderStatus =
  | "ordered"
  | "sample_collected"
  | "processing"
  | "completed"
  | "verified"
  | "cancelled";
export type LabPriority = "routine" | "urgent" | "stat";
export type LabResultFlag =
  | "normal"
  | "low"
  | "high"
  | "critical_low"
  | "critical_high"
  | "abnormal";
export type LabReportStatus = "preliminary" | "final" | "amended";
export type LabQcStatus = "accepted" | "rejected" | "warning";
export type LabOutsourceStatus = "pending_send" | "sent" | "result_received" | "cancelled";
export type LabPhlebotomyStatus = "waiting" | "in_progress" | "completed" | "skipped";
export type LabWestgardRule = "1_2s" | "1_3s" | "2_2s" | "r_4s" | "4_1s" | "10x";

export interface LabOrder {
  id: string;
  tenant_id: string;
  patient_id: string;
  encounter_id: string | null;
  test_id: string;
  ordered_by: string;
  status: LabOrderStatus;
  priority: LabPriority;
  notes: string | null;
  rejection_reason: string | null;
  collected_at: string | null;
  collected_by: string | null;
  verified_by: string | null;
  verified_at: string | null;
  // Phase 2 fields
  sample_barcode: string | null;
  is_outsourced: boolean;
  report_status: LabReportStatus | null;
  is_report_locked: boolean;
  expected_tat_minutes: number | null;
  completed_at: string | null;
  parent_order_id: string | null;
  // Phase 3 fields
  is_stat: boolean;
  collection_center_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LabResult {
  id: string;
  tenant_id: string;
  order_id: string;
  parameter_name: string;
  value: string;
  unit: string | null;
  normal_range: string | null;
  flag: LabResultFlag | null;
  notes: string | null;
  // Phase 2 fields
  previous_value: string | null;
  delta_percent: string | null;
  is_delta_flagged: boolean;
  is_auto_validated: boolean;
  entered_by: string | null;
  updated_at: string;
  created_at: string;
}

export interface LabTestCatalog {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  department_id: string | null;
  sample_type: string | null;
  normal_range: string | null;
  unit: string | null;
  price: string;
  tat_hours: number | null;
  is_active: boolean;
  // Phase 2 fields
  loinc_code: string | null;
  method: string | null;
  specimen_volume: string | null;
  critical_low: string | null;
  critical_high: string | null;
  delta_check_percent: string | null;
  auto_validation_rules: Record<string, unknown> | null;
  allows_add_on: boolean;
  /** Draw tube for this assay, printed on the requisition slip. */
  container: string | null;
  fasting_required: boolean;
  /** null means unspecified, not zero. */
  fasting_hours: number | null;
  created_at: string;
  updated_at: string;
}

export interface LabOrderListResponse {
  orders: LabOrder[];
  total: number;
  page: number;
  per_page: number;
}

export interface CollectSampleRequest {
  patient_identifier: string;
}

export interface CreateLabOrderRequest {
  patient_id: string;
  encounter_id?: string;
  test_id: string;
  priority?: LabPriority;
  notes?: string;
}

export interface AddResultsRequest {
  results: ResultInput[];
}

export interface ResultInput {
  parameter_name: string;
  value: string;
  unit?: string;
  normal_range?: string;
  flag?: LabResultFlag;
}

export interface LabOrderDetailResponse {
  order: LabOrder;
  results: LabResult[];
  /** What the catalogue says this test is measured in. Absent when the
   *  catalogue row has been retired since the order was placed. */
  test: LabTestDefaults | null;
}

export interface LabTestDefaults {
  name: string;
  code: string;
  unit: string | null;
  normal_range: string | null;
  sample_type: string | null;
}

export interface CreateLabCatalogRequest {
  code: string;
  name: string;
  department_id?: string;
  sample_type?: string;
  normal_range?: string;
  unit?: string;
  price: number;
  tat_hours?: number;
  // Phase 2 fields
  loinc_code?: string;
  method?: string;
  specimen_volume?: string;
  critical_low?: number;
  critical_high?: number;
  delta_check_percent?: number;
  auto_validation_rules?: Record<string, unknown>;
  allows_add_on?: boolean;
  /** Draw tube, e.g. "Lavender EDTA". A wrong additive cannot be salvaged. */
  container?: string;
  fasting_required?: boolean;
  fasting_hours?: number;
}

export interface UpdateLabCatalogRequest {
  name?: string;
  department_id?: string;
  sample_type?: string;
  normal_range?: string;
  unit?: string;
  price?: number;
  tat_hours?: number;
  is_active?: boolean;
  // Phase 2 fields
  loinc_code?: string;
  method?: string;
  specimen_volume?: string;
  critical_low?: number;
  critical_high?: number;
  delta_check_percent?: number;
  auto_validation_rules?: Record<string, unknown>;
  allows_add_on?: boolean;
  /** Draw tube, e.g. "Lavender EDTA". A wrong additive cannot be salvaged. */
  container?: string;
  fasting_required?: boolean;
  fasting_hours?: number;
}

// Lab Panels / Profiles

export interface LabTestPanel {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  description: string | null;
  price: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LabPanelTest {
  id: string;
  tenant_id: string;
  panel_id: string;
  test_id: string;
  sort_order: number;
}

export interface CreateLabPanelRequest {
  code: string;
  name: string;
  description?: string;
  price: number;
  test_ids: string[];
}

export interface UpdateLabPanelRequest {
  name?: string;
  description?: string;
  price?: number;
  is_active?: boolean;
  test_ids?: string[];
}

export interface LabPanelDetailResponse {
  panel: LabTestPanel;
  tests: LabPanelTest[];
}

export interface RejectSampleRequest {
  rejection_reason: string;
}

// Lab Phase 2 — Enhanced Results, QC/NABL, Operations

export interface LabResultAmendment {
  id: string;
  tenant_id: string;
  result_id: string;
  order_id: string;
  original_value: string | null;
  amended_value: string | null;
  original_flag: LabResultFlag | null;
  amended_flag: LabResultFlag | null;
  reason: string;
  amended_by: string;
  amended_at: string;
}

export interface LabCriticalAlert {
  id: string;
  tenant_id: string;
  order_id: string;
  result_id: string;
  patient_id: string;
  parameter_name: string;
  value: string;
  flag: LabResultFlag;
  notified_to: string | null;
  notified_at: string | null;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  readback_value: string | null;
  readback_verified: boolean;
  created_at: string;
}

export interface LabReagentLot {
  id: string;
  tenant_id: string;
  reagent_name: string;
  lot_number: string;
  manufacturer: string | null;
  test_id: string | null;
  received_date: string | null;
  expiry_date: string | null;
  quantity: string | null;
  quantity_unit: string | null;
  is_active: boolean;
  // Phase 3 fields
  reorder_level: number | null;
  consumption_per_test: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LabQcResult {
  id: string;
  tenant_id: string;
  test_id: string;
  lot_id: string;
  level: string;
  target_mean: string | null;
  target_sd: string | null;
  observed_value: string | null;
  sd_index: string | null;
  status: LabQcStatus;
  westgard_violations: LabWestgardRule[] | null;
  run_date: string | null;
  run_time: string;
  performed_by: string | null;
  reviewer_notes: string | null;
  reviewed_by: string | null;
  created_at: string;
}

export interface LabCalibration {
  id: string;
  tenant_id: string;
  test_id: string;
  instrument_name: string | null;
  calibrator_lot: string | null;
  calibration_date: string | null;
  next_calibration_date: string | null;
  result_summary: Record<string, unknown> | null;
  is_passed: boolean;
  performed_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface LabOutsourcedOrder {
  id: string;
  tenant_id: string;
  order_id: string;
  external_lab_name: string;
  external_lab_code: string | null;
  sent_date: string | null;
  expected_return_date: string | null;
  actual_return_date: string | null;
  external_ref_number: string | null;
  status: LabOutsourceStatus;
  cost: string | null;
  notes: string | null;
  sent_by: string | null;
  received_by: string | null;
  created_at: string;
  updated_at: string;
}

/** One row of the bench worklist: what is waiting to be run.
 *
 * `patient_name` is "Restricted" for a reader who holds lab.orders.list but
 * not patients.view — a quality officer, for instance. The bench needs the
 * barcode and the order, not the name. */
export interface LabAnalyzerWorklistRow {
  order_id: string;
  patient_id: string;
  sample_barcode: string;
  patient_name: string;
  ordered_at: string;
}

export interface LabPhlebotomyQueueItem {
  id: string;
  tenant_id: string;
  order_id: string;
  patient_id: string;
  priority: LabPriority;
  queue_number: number | null;
  status: LabPhlebotomyStatus;
  assigned_to: string | null;
  location_id: string | null;
  queued_at: string;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Lab Phase 2 Request Types

export interface AmendResultRequest {
  result_id: string;
  amended_value: string;
  amended_flag?: LabResultFlag;
  reason: string;
}

export interface UpdateReportStatusRequest {
  report_status: LabReportStatus;
}

export interface AddOnTestRequest {
  test_id: string;
  priority?: LabPriority;
  notes?: string;
}

export interface CreateReagentLotRequest {
  reagent_name: string;
  lot_number: string;
  manufacturer?: string;
  test_id?: string;
  received_date?: string;
  expiry_date?: string;
  quantity?: number;
  quantity_unit?: string;
  notes?: string;
}

export interface UpdateReagentLotRequest {
  reagent_name?: string;
  manufacturer?: string;
  test_id?: string;
  expiry_date?: string;
  quantity?: number;
  quantity_unit?: string;
  is_active?: boolean;
  notes?: string;
}

export interface CreateQcResultRequest {
  test_id: string;
  lot_id: string;
  level: string;
  target_mean?: number;
  target_sd?: number;
  observed_value?: number;
  run_date?: string;
  reviewer_notes?: string;
}

export interface CreateCalibrationRequest {
  test_id: string;
  instrument_name?: string;
  calibrator_lot?: string;
  calibration_date?: string;
  next_calibration_date?: string;
  result_summary?: Record<string, unknown>;
  is_passed?: boolean;
  notes?: string;
}

export interface CreatePhlebotomyEntryRequest {
  order_id: string;
  patient_id: string;
  priority?: LabPriority;
  location_id?: string;
  notes?: string;
}

export interface UpdatePhlebotomyStatusRequest {
  status: LabPhlebotomyStatus;
}

export interface CreateOutsourcedOrderRequest {
  order_id: string;
  external_lab_name: string;
  external_lab_code?: string;
  sent_date?: string;
  expected_return_date?: string;
  cost?: number;
  notes?: string;
}

export interface UpdateOutsourcedOrderRequest {
  status?: LabOutsourceStatus;
  actual_return_date?: string;
  external_ref_number?: string;
  cost?: number;
  notes?: string;
}

// Lab Phase 2 Response Types

export interface CumulativeReportResponse {
  patient_id: string;
  test_id: string;
  results: CumulativeResultRow[];
}

export interface CumulativeResultRow {
  order_id: string;
  parameter_name: string;
  value: string;
  flag: LabResultFlag | null;
  created_at: string;
}

export interface TatMonitoringRow {
  order_id: string;
  test_id: string;
  patient_id: string;
  expected_tat_minutes: number | null;
  actual_minutes: number | null;
  is_breached: boolean;
  ordered_at: string;
  completed_at: string | null;
}

// Lab Phase 3 Enums

export type LabHomeCollectionStatus =
  | "scheduled"
  | "assigned"
  | "in_transit"
  | "arrived"
  | "collected"
  | "returned_to_lab"
  | "cancelled";

export type LabCollectionCenterType = "hospital" | "satellite" | "partner" | "camp";

export type LabSampleArchiveStatus = "stored" | "retrieved" | "discarded" | "expired";

export type LabDispatchMethod = "counter" | "email" | "sms" | "whatsapp" | "portal" | "courier";

export type LabEqasEvaluation = "acceptable" | "marginal" | "unacceptable" | "pending";

// Lab Phase 3 Interfaces

export interface LabHomeCollection {
  id: string;
  tenant_id: string;
  order_id: string | null;
  patient_id: string;
  scheduled_date: string;
  scheduled_time_slot: string | null;
  address_line: string | null;
  city: string | null;
  pincode: string | null;
  contact_phone: string | null;
  assigned_phlebotomist: string | null;
  status: LabHomeCollectionStatus;
  special_instructions: string | null;
  collected_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LabCollectionCenter {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  center_type: LabCollectionCenterType;
  address: string | null;
  city: string | null;
  phone: string | null;
  contact_person: string | null;
  is_active: boolean;
  operating_hours: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LabSampleArchive {
  id: string;
  tenant_id: string;
  order_id: string | null;
  patient_id: string | null;
  sample_barcode: string | null;
  storage_location: string | null;
  stored_at: string | null;
  archived_by: string | null;
  status: LabSampleArchiveStatus;
  retrieved_at: string | null;
  retrieved_by: string | null;
  disposal_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface LabReportDispatch {
  id: string;
  tenant_id: string;
  order_id: string;
  patient_id: string;
  dispatch_method: LabDispatchMethod;
  dispatched_to: string | null;
  dispatched_by: string | null;
  dispatched_at: string;
  received_confirmation: boolean;
  confirmed_at: string | null;
  notes: string | null;
  created_at: string;
  /** Set when the record was voided. Voided rows stay in the list, marked —
   *  a dispatch to the wrong recipient is a disclosure, and deleting it would
   *  hide the incident rather than correct the record. */
  voided_at?: string | null;
  void_reason?: string | null;
}

export interface LabReportTemplate {
  id: string;
  tenant_id: string;
  department_id: string | null;
  template_name: string;
  header_html: string | null;
  footer_html: string | null;
  logo_url: string | null;
  report_format: Record<string, unknown> | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** List row — omits header_html/footer_html/report_format (fetched by id when editing). */
export interface LabReportTemplateListItem {
  id: string;
  tenant_id: string;
  department_id: string | null;
  template_name: string;
  logo_url: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LabEqasResult {
  id: string;
  tenant_id: string;
  program_name: string;
  provider: string | null;
  test_id: string | null;
  cycle: string | null;
  sample_number: string | null;
  expected_value: number | null;
  reported_value: number | null;
  evaluation: LabEqasEvaluation;
  bias_percent: number | null;
  z_score: number | null;
  report_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LabProficiencyTest {
  id: string;
  tenant_id: string;
  program: string;
  test_id: string | null;
  survey_round: string | null;
  sample_id: string | null;
  assigned_value: number | null;
  reported_value: number | null;
  acceptable_range_low: number | null;
  acceptable_range_high: number | null;
  is_acceptable: boolean | null;
  evaluation_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface LabNablDocument {
  id: string;
  tenant_id: string;
  document_type: string | null;
  document_number: string;
  title: string;
  version: string | null;
  effective_date: string | null;
  review_date: string | null;
  approved_by: string | null;
  file_path: string | null;
  is_current: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LabHistopathReport {
  id: string;
  tenant_id: string;
  order_id: string;
  patient_id: string;
  specimen_type: string | null;
  clinical_history: string | null;
  gross_description: string | null;
  microscopy_findings: string | null;
  special_stains: Record<string, unknown> | null;
  immunohistochemistry: Record<string, unknown> | null;
  synoptic_data: Record<string, unknown> | null;
  diagnosis: string | null;
  icd_code: string | null;
  pathologist_id: string | null;
  reported_at: string | null;
  notes: string | null;
  turnaround_days: number | null;
  created_at: string;
  updated_at: string;
}

export interface LabCytologyReport {
  id: string;
  tenant_id: string;
  order_id: string;
  patient_id: string;
  specimen_type: string | null;
  clinical_indication: string | null;
  adequacy: string | null;
  screening_findings: string | null;
  diagnosis: string | null;
  bethesda_category: string | null;
  cytopathologist_id: string | null;
  reported_at: string | null;
  icd_code: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LabMolecularReport {
  id: string;
  tenant_id: string;
  order_id: string;
  patient_id: string;
  test_method: string | null;
  target_gene: string | null;
  primer_details: string | null;
  amplification_data: Record<string, unknown> | null;
  ct_value: number | null;
  result_interpretation: string | null;
  quantitative_value: number | null;
  quantitative_unit: string | null;
  kit_name: string | null;
  kit_lot: string | null;
  performed_by: string | null;
  reported_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LabB2bClient {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  client_type: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  contact_person: string | null;
  credit_limit: number | null;
  payment_terms_days: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LabB2bRate {
  id: string;
  tenant_id: string;
  client_id: string;
  test_id: string;
  agreed_price: number | null;
  discount_percent: number | null;
  effective_from: string | null;
  effective_to: string | null;
  created_at: string;
  updated_at: string;
}

// Lab Phase 3 Request Types

export interface CreateHomeCollectionRequest {
  order_id?: string;
  patient_id: string;
  scheduled_date: string;
  scheduled_time_slot?: string;
  address_line?: string;
  city?: string;
  pincode?: string;
  contact_phone?: string;
  special_instructions?: string;
}

export interface UpdateHomeCollectionRequest {
  assigned_phlebotomist?: string;
  scheduled_date?: string;
  scheduled_time_slot?: string;
  address_line?: string;
  city?: string;
  pincode?: string;
  contact_phone?: string;
  special_instructions?: string;
  notes?: string;
}

export interface HomeCollectionStatusRequest {
  status: LabHomeCollectionStatus;
  /**
   * Required when moving to "collected": the identifier read off the patient,
   * verified server-side against the order's UHID before the draw is accepted.
   */
  patient_identifier?: string;
  /** The label on the tube. Every downstream analyzer match keys on it. */
  sample_barcode?: string;
  notes?: string;
}

export interface CreateCollectionCenterRequest {
  code: string;
  name: string;
  center_type: LabCollectionCenterType;
  address?: string;
  city?: string;
  phone?: string;
  contact_person?: string;
  operating_hours?: Record<string, unknown>;
  notes?: string;
}

export interface UpdateCollectionCenterRequest {
  name?: string;
  center_type?: LabCollectionCenterType;
  address?: string;
  city?: string;
  phone?: string;
  contact_person?: string;
  operating_hours?: Record<string, unknown>;
  is_active?: boolean;
  notes?: string;
}

export interface CreateSampleArchiveRequest {
  order_id?: string;
  patient_id?: string;
  sample_barcode?: string;
  storage_location?: string;
  notes?: string;
}

export interface CreateReportDispatchRequest {
  order_id: string;
  patient_id: string;
  dispatch_method: LabDispatchMethod;
  dispatched_to?: string;
  notes?: string;
}

export interface CreateReportTemplateRequest {
  department_id?: string;
  template_name: string;
  header_html?: string;
  footer_html?: string;
  logo_url?: string;
  report_format?: Record<string, unknown>;
  is_default?: boolean;
}

export interface UpdateReportTemplateRequest {
  template_name?: string;
  header_html?: string;
  footer_html?: string;
  logo_url?: string;
  report_format?: Record<string, unknown>;
  is_default?: boolean;
  is_active?: boolean;
}

export interface CreateEqasResultRequest {
  program_name: string;
  provider?: string;
  test_id?: string;
  cycle?: string;
  sample_number?: string;
  expected_value?: number;
  reported_value?: number;
  evaluation?: LabEqasEvaluation;
  bias_percent?: number;
  z_score?: number;
  report_date?: string;
  notes?: string;
}

export interface UpdateEqasResultRequest {
  evaluation?: LabEqasEvaluation;
  reported_value?: number;
  bias_percent?: number;
  z_score?: number;
  notes?: string;
}

export interface CreateProficiencyTestRequest {
  program: string;
  test_id?: string;
  survey_round?: string;
  sample_id?: string;
  assigned_value?: number;
  reported_value?: number;
  acceptable_range_low?: number;
  acceptable_range_high?: number;
  is_acceptable?: boolean;
  evaluation_date?: string;
  notes?: string;
}

export interface CreateNablDocumentRequest {
  document_type?: string;
  document_number: string;
  title: string;
  version?: string;
  effective_date?: string;
  review_date?: string;
  file_path?: string;
  is_current?: boolean;
  notes?: string;
}

export interface UpdateNablDocumentRequest {
  title?: string;
  version?: string;
  effective_date?: string;
  review_date?: string;
  file_path?: string;
  is_current?: boolean;
  notes?: string;
}

export interface CreateHistopathReportRequest {
  order_id: string;
  patient_id: string;
  specimen_type?: string;
  clinical_history?: string;
  gross_description?: string;
  microscopy_findings?: string;
  special_stains?: Record<string, unknown>;
  immunohistochemistry?: Record<string, unknown>;
  synoptic_data?: Record<string, unknown>;
  diagnosis?: string;
  icd_code?: string;
  notes?: string;
  turnaround_days?: number;
}

export interface CreateCytologyReportRequest {
  order_id: string;
  patient_id: string;
  specimen_type?: string;
  clinical_indication?: string;
  adequacy?: string;
  screening_findings?: string;
  diagnosis?: string;
  bethesda_category?: string;
  icd_code?: string;
  notes?: string;
}

export interface CreateMolecularReportRequest {
  order_id: string;
  patient_id: string;
  test_method?: string;
  target_gene?: string;
  primer_details?: string;
  amplification_data?: Record<string, unknown>;
  ct_value?: number;
  result_interpretation?: string;
  quantitative_value?: number;
  quantitative_unit?: string;
  kit_name?: string;
  kit_lot?: string;
  notes?: string;
}

export interface CreateB2bClientRequest {
  code: string;
  name: string;
  client_type?: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  contact_person?: string;
  credit_limit?: number;
  payment_terms_days?: number;
}

export interface UpdateB2bClientRequest {
  name?: string;
  client_type?: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  contact_person?: string;
  credit_limit?: number;
  payment_terms_days?: number;
  is_active?: boolean;
}

export interface CreateB2bRateRequest {
  test_id: string;
  agreed_price?: number;
  discount_percent?: number;
  effective_from?: string;
  effective_to?: string;
}

export interface HomeCollectionStatsRow {
  status: LabHomeCollectionStatus;
  count: number;
}

export interface ReagentConsumptionRow {
  id: string;
  reagent_name: string;
  lot_number: string;
  quantity: number | null;
  quantity_unit: string | null;
  reorder_level: number | null;
  consumption_per_test: number | null;
  is_active: boolean;
  expiry_date: string | null;
}

// ══════════════════════════════════════════════════════════
//  Radiology Module
// ══════════════════════════════════════════════════════════

export type RadiologyOrderStatus =
  | "ordered"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "reported"
  | "verified"
  | "cancelled";

export type RadiologyPriority = "routine" | "urgent" | "stat";

export type RadiologyReportStatus = "draft" | "preliminary" | "final" | "amended";

export interface RadiologyModality {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RadiologyOrder {
  id: string;
  tenant_id: string;
  patient_id: string;
  encounter_id: string | null;
  modality_id: string;
  ordered_by: string;
  body_part: string | null;
  clinical_indication: string | null;
  priority: RadiologyPriority;
  status: RadiologyOrderStatus;
  scheduled_at: string | null;
  completed_at: string | null;
  notes: string | null;
  contrast_required: boolean;
  pregnancy_checked: boolean;
  allergy_flagged: boolean;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface RadiologyReport {
  id: string;
  tenant_id: string;
  order_id: string;
  reported_by: string;
  verified_by: string | null;
  status: RadiologyReportStatus;
  findings: string;
  impression: string | null;
  recommendations: string | null;
  is_critical: boolean;
  template_name: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RadiationDoseRecord {
  id: string;
  tenant_id: string;
  order_id: string;
  patient_id: string;
  modality_code: string;
  body_part: string | null;
  dose_value: string | null;
  dose_unit: string;
  dlp: string | null;
  ctdi_vol: string | null;
  dap: string | null;
  fluoroscopy_time_seconds: number | null;
  recorded_by: string | null;
  recorded_at: string;
  created_at: string;
}

export interface RadiologyOrderListResponse {
  orders: RadiologyOrder[];
  total: number;
  page: number;
  per_page: number;
}

export interface CreateRadiologyOrderRequest {
  patient_id: string;
  encounter_id?: string;
  modality_id: string;
  body_part?: string;
  clinical_indication?: string;
  priority?: string;
  scheduled_at?: string;
  notes?: string;
  contrast_required?: boolean;
  pregnancy_checked?: boolean;
  allergy_flagged?: boolean;
}

export interface RadiologyOrderDetailResponse {
  order: RadiologyOrder;
  report: RadiologyReport | null;
  dose_records: RadiationDoseRecord[];
}

export interface RadiologyDicomStudy {
  id: string;
  patient_id?: string;
  study_instance_uid: string;
  modality: string;
  study_date: string | null;
  study_description: string | null;
  instance_count: number;
  series_count: number;
  viewer_url: string | null;
  pacs_url?: string | null;
  file_size_bytes?: number | null;
  orthanc_id?: string | null;
}

export interface CancelRadiologyOrderRequest {
  cancellation_reason: string;
}

export interface CreateRadiologyReportRequest {
  findings: string;
  impression?: string;
  recommendations?: string;
  is_critical?: boolean;
  template_name?: string;
  status?: string;
}

export interface CreateModalityRequest {
  code: string;
  name: string;
  description?: string;
}

export interface UpdateModalityRequest {
  name?: string;
  description?: string;
  is_active?: boolean;
}

export interface RecordDoseRequest {
  modality_code: string;
  body_part?: string;
  dose_value?: number;
  dose_unit?: string;
  dlp?: number;
  ctdi_vol?: number;
  dap?: number;
  fluoroscopy_time_seconds?: number;
}

// ══════════════════════════════════════════════════════════
//  Pharmacy Module
// ══════════════════════════════════════════════════════════

export type PharmacyOrderStatus =
  | "ordered"
  | "dispensed"
  | "partially_dispensed"
  | "cancelled"
  | "returned";
export type StockTransactionType = "receipt" | "issue" | "return" | "adjustment";
export type DrugSchedule = "H" | "H1" | "X" | "G" | "OTC" | "NDPS";
export type FormularyStatus = "approved" | "restricted" | "non_formulary";
export type AwareCategory = "access" | "watch" | "reserve";

export interface PharmacyCatalog {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  generic_name: string | null;
  category: string | null;
  manufacturer: string | null;
  unit: string | null;
  base_price: string;
  tax_percent: string;
  current_stock: number;
  reorder_level: number;
  is_active: boolean;
  // Regulatory fields
  drug_schedule: DrugSchedule | null;
  is_controlled: boolean;
  inn_name: string | null;
  atc_code: string | null;
  rxnorm_code: string | null;
  snomed_code: string | null;
  formulary_status: FormularyStatus;
  aware_category: AwareCategory | null;
  is_lasa: boolean;
  lasa_group: string | null;
  max_dose_per_day: string | null;
  batch_tracking_required: boolean;
  storage_conditions: string | null;
  black_box_warning: string | null;
  /** GTIN/EAN-13 or other pack barcode. Batch and expiry live on the batch. */
  barcode: string | null;
  created_at: string;
  updated_at: string;
}

/** A stock row with its batch facts aggregated server-side.
 *
 * `batch_count` and `earliest_expiry` come from SQL, not from counting a
 * fetched batch list in the browser — the batch endpoint caps at 500 rows,
 * so a large pharmacy counted a window and called it a total. */
export interface StockListItem extends PharmacyCatalog {
  batch_count: number;
  earliest_expiry: string | null;
}

export interface ComplianceSettings {
  enforce_drug_scheduling: boolean;
  enforce_ndps_tracking: boolean;
  enforce_formulary: boolean;
  enforce_drug_interactions: boolean;
  enforce_antibiotic_stewardship: boolean;
  enforce_lasa_warnings: boolean;
  enforce_max_dose_check: boolean;
  enforce_batch_tracking: boolean;
  show_schedule_badges: boolean;
  show_controlled_warnings: boolean;
  show_formulary_status: boolean;
  show_aware_category: boolean;
}

export type PharmacyDispensingType = "prescription" | "otc" | "discharge" | "package" | "emergency";
export type NdpsRegisterAction =
  | "receipt"
  | "dispensed"
  | "destroyed"
  | "transferred"
  | "adjustment";
export type PharmacyReturnStatusType =
  | "requested"
  | "approved"
  | "returned_to_stock"
  | "destroyed"
  | "rejected";

export interface PharmacyOrder {
  id: string;
  tenant_id: string;
  prescription_id: string | null;
  patient_id: string;
  encounter_id: string | null;
  ordered_by: string;
  status: PharmacyOrderStatus;
  notes: string | null;
  // Phase 2 fields
  dispensing_type: PharmacyDispensingType;
  discharge_summary_id: string | null;
  billing_package_id: string | null;
  store_location_id: string | null;
  interaction_check_result: unknown | null;
  dispensed_by: string | null;
  dispensed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PharmacyOrderItem {
  id: string;
  tenant_id: string;
  order_id: string;
  catalog_item_id: string | null;
  drug_name: string;
  quantity: number;
  unit_price: string;
  total_price: string;
  // Phase 2 fields
  batch_number: string | null;
  expiry_date: string | null;
  batch_stock_id: string | null;
  quantity_prescribed: number | null;
  quantity_dispensed: number;
  quantity_returned: number;
  removed_at: string | null;
  removed_by: string | null;
  remove_reason: string | null;
  created_at: string;
}

/** A dispensable batch (FEFO order) for a catalog item. */
export interface FefoBatch {
  batch_id: string;
  batch_number: string;
  expiry_date: string;
  quantity_on_hand: number;
}

export interface RepeatEligibility {
  prescription_id: string;
  repeats_allowed: number;
  repeats_used: number;
  remaining: number;
  last_dispense_at: string | null;
  next_eligible_at: string | null;
  is_eligible_now: boolean;
}

export interface PharmacySubstitution {
  id: string;
  tenant_id: string;
  pharmacy_order_item_id: string;
  original_drug_id: string;
  substituted_drug_id: string;
  reason: string;
  inn_match: boolean;
  patient_consent_obtained: boolean;
  substituted_by: string;
  substituted_at: string;
}

export interface CreateSubstitutionInput {
  pharmacy_order_item_id: string;
  original_drug_id: string;
  substituted_drug_id: string;
  reason: string;
  inn_match: boolean;
  patient_consent_obtained?: boolean;
}

export interface PharmacyStockTransaction {
  id: string;
  tenant_id: string;
  catalog_item_id: string;
  transaction_type: StockTransactionType;
  quantity: number;
  reference_id: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
}

export interface PharmacyOrderListResponse {
  orders: PharmacyOrder[];
  total: number;
  page: number;
  per_page: number;
}

export interface CreatePharmacyOrderRequest {
  patient_id: string;
  prescription_id?: string;
  encounter_id?: string;
  notes?: string;
  items: PharmacyOrderItemInput[];
  dispensing_type?: PharmacyDispensingType;
  discharge_summary_id?: string;
  billing_package_id?: string;
  store_location_id?: string;
  safety_override_reason?: string;
  allergy_override_reason?: string;
}

export interface PharmacyOrderItemInput {
  catalog_item_id?: string;
  drug_name: string;
  quantity: number;
  unit_price: number;
}

export interface PharmacyOrderDetailResponse {
  order: PharmacyOrder;
  items: PharmacyOrderItem[];
  admission_id: string | null;
  billing_invoice_id: string | null;
}

export interface UpdatePharmacyOrderItemRequest {
  quantity: number;
}

export interface CreatePharmacyCatalogRequest {
  code: string;
  name: string;
  generic_name?: string;
  category?: string;
  manufacturer?: string;
  unit?: string;
  base_price: number;
  tax_percent?: number;
  reorder_level?: number;
  // Regulatory
  drug_schedule?: DrugSchedule;
  is_controlled?: boolean;
  inn_name?: string;
  atc_code?: string;
  rxnorm_code?: string;
  snomed_code?: string;
  formulary_status?: FormularyStatus;
  aware_category?: AwareCategory;
  is_lasa?: boolean;
  lasa_group?: string;
  max_dose_per_day?: string;
  batch_tracking_required?: boolean;
  storage_conditions?: string;
  black_box_warning?: string;
  barcode?: string;
}

export interface UpdatePharmacyCatalogRequest {
  name?: string;
  generic_name?: string;
  category?: string;
  manufacturer?: string;
  unit?: string;
  base_price?: number;
  tax_percent?: number;
  reorder_level?: number;
  is_active?: boolean;
  // Regulatory
  drug_schedule?: DrugSchedule;
  is_controlled?: boolean;
  inn_name?: string;
  atc_code?: string;
  rxnorm_code?: string;
  snomed_code?: string;
  formulary_status?: FormularyStatus;
  aware_category?: AwareCategory;
  is_lasa?: boolean;
  lasa_group?: string;
  max_dose_per_day?: string;
  batch_tracking_required?: boolean;
  storage_conditions?: string;
  black_box_warning?: string;
  barcode?: string;
}

export interface CreateStockTransactionRequest {
  catalog_item_id: string;
  transaction_type: StockTransactionType;
  quantity: number;
  reference_id?: string;
  notes?: string;
}

/** A doctor who sends work to the laboratory, and what they are paid for it. */
export interface LabReferralDoctor {
  id: string;
  name: string;
  phone: string | null;
  specialization: string | null;
  hospital_name: string | null;
  commission_pct: number | null;
  is_active: boolean;
}

/** One settled or pending commission period. */
export interface LabReferralPayout {
  id: string;
  referral_doctor_id: string;
  period_start: string;
  period_end: string;
  order_count: number;
  total_revenue: string;
  commission_amount: string;
  status: string;
}

/**
 * What a referring client owes.
 *
 * `credit_available` is computed server-side as limit minus used, so the
 * screen does not do the subtraction twice and disagree with the backend.
 */
export interface LabB2bCreditSummary {
  id: string;
  name: string;
  credit_limit: string | null;
  credit_used: string | null;
  credit_available: string | null;
  payment_terms_days: number | null;
}
