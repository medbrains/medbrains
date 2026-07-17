import type { DrugSchedule, FormularyStatus, SchemaField } from "./index";
// IPD clinical expansion types — split from index.ts, barrel-re-exported.

// ── IPD Clinical Expansion ──────────────────────────────────

export type ProgressNoteType =
  | "doctor_round"
  | "nursing_note"
  | "specialist_opinion"
  | "dietitian_note"
  | "physiotherapy_note"
  | "social_worker_note"
  | "discharge_note";
export type ClinicalAssessmentType =
  | "morse_fall_scale"
  | "braden_scale"
  | "gcs"
  | "pain_vas"
  | "pain_nrs"
  | "pain_flacc"
  | "barthel_adl"
  | "norton_scale"
  | "waterlow_score"
  | "rass"
  | "cam"
  | "news2"
  | "mews"
  | "custom";
export type MarStatus = "scheduled" | "given" | "held" | "refused" | "missed" | "self_administered";
export type CarePlanStatus = "active" | "resolved" | "discontinued";
export type NursingShift = "morning" | "afternoon" | "night";

export interface IpdProgressNote {
  id: string;
  tenant_id: string;
  admission_id: string;
  encounter_id: string | null;
  note_type: ProgressNoteType;
  author_id: string;
  note_date: string;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  is_addendum: boolean;
  parent_note_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface IpdClinicalAssessment {
  id: string;
  tenant_id: string;
  admission_id: string;
  assessment_type: ClinicalAssessmentType;
  score_value: number | null;
  risk_level: string | null;
  score_details: unknown;
  assessed_by: string;
  assessed_at: string;
  created_at: string;
  updated_at: string;
}

export interface IpdMedicationAdministration {
  id: string;
  tenant_id: string;
  admission_id: string;
  prescription_item_id: string | null;
  drug_name: string;
  dose: string;
  route: string;
  frequency: string | null;
  scheduled_at: string;
  administered_at: string | null;
  status: MarStatus;
  administered_by: string | null;
  witnessed_by: string | null;
  barcode_verified: boolean;
  is_high_alert: boolean;
  hold_reason: string | null;
  refused_reason: string | null;
  notes: string | null;
  prn_reason: string | null;
  missed_reason: string | null;
  double_checked_by: string | null;
  batch_stock_id: string | null;
  batch_number: string | null;
  batch_expiry: string | null;
  created_at: string;
  updated_at: string;
}

/** A due-now dose enriched for the nurse's medication round. */
export interface MarDueRow {
  id: string;
  admission_id: string;
  patient_id: string;
  patient_name: string;
  bed_id: string | null;
  drug_name: string;
  dose: string;
  route: string;
  frequency: string | null;
  scheduled_at: string;
  status: MarStatus;
  is_high_alert: boolean;
  batch_number: string | null;
  batch_expiry: string | null;
}

export interface UpdateMarRoundInput {
  status: MarStatus;
  administered_at?: string;
  witnessed_by?: string;
  barcode_verified?: boolean;
  hold_reason?: string;
  refused_reason?: string;
  missed_reason?: string;
  notes?: string;
}

export interface IpdIntakeOutput {
  id: string;
  tenant_id: string;
  admission_id: string;
  is_intake: boolean;
  category: string;
  volume_ml: number;
  description: string | null;
  recorded_at: string;
  recorded_by: string;
  shift: NursingShift;
  created_at: string;
}

export type InfusionStatus = "ordered" | "running" | "paused" | "completed" | "discontinued";

export interface IvFluidOrder {
  id: string;
  tenant_id: string | null;
  admission_id: string | null;
  fluid_name: string;
  volume_ml: number;
  rate: string | null;
  additives: string[] | null;
  start_time: string;
  duration_hours: number | null;
  status: InfusionStatus;
  rate_ml_per_hr: string | null;
  site: string | null;
  pump_serial: string | null;
  ordered_by: string | null;
  started_at: string | null;
  planned_end_time: string | null;
  actual_end_time: string | null;
  discontinued_reason: string | null;
  discontinued_by: string | null;
  discontinued_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateInfusionInput {
  fluid_name: string;
  volume_ml: number;
  rate_ml_per_hr?: number;
  site?: string;
  pump_serial?: string;
  additives?: string[];
  duration_hours?: number;
  ysite_override_reason?: string;
}

export interface UpdateInfusionInput {
  status?: InfusionStatus;
  rate_ml_per_hr?: number;
  site?: string;
  pump_serial?: string;
  discontinued_reason?: string;
}

export interface IoBalanceResponse {
  total_intake_ml: number;
  total_output_ml: number;
  balance_ml: number;
}

export interface IpdNursingAssessment {
  id: string;
  tenant_id: string;
  admission_id: string;
  assessed_by: string;
  assessed_at: string;
  general_appearance: unknown;
  skin_assessment: unknown;
  pain_assessment: unknown;
  nutritional_status: unknown;
  elimination_status: unknown;
  respiratory_status: unknown;
  psychosocial_status: unknown;
  fall_risk_assessment: unknown;
  allergies: string | null;
  medications_on_admission: string | null;
  personal_belongings: unknown;
  patient_education_needs: string | null;
  created_at: string;
  updated_at: string;
}

export interface IpdCarePlan {
  id: string;
  tenant_id: string;
  admission_id: string;
  nursing_diagnosis: string;
  goals: string | null;
  interventions: unknown;
  evaluation: string | null;
  status: CarePlanStatus;
  initiated_by: string;
  initiated_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface IpdHandoverReport {
  id: string;
  tenant_id: string;
  admission_id: string;
  shift: NursingShift;
  handover_date: string;
  outgoing_nurse: string;
  incoming_nurse: string;
  identification: string | null;
  situation: string | null;
  background: string | null;
  assessment: string | null;
  recommendation: string | null;
  pending_tasks: unknown;
  acknowledged_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface IpdDischargeChecklist {
  id: string;
  tenant_id: string;
  admission_id: string;
  item_code: string;
  item_label: string;
  status: string;
  completed_by: string | null;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// IPD Clinical Request Types
export interface CreateProgressNoteRequest {
  note_type: ProgressNoteType;
  note_date?: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  is_addendum?: boolean;
  parent_note_id?: string;
}
export interface UpdateProgressNoteRequest {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
}
export interface CreateAssessmentRequest {
  assessment_type: ClinicalAssessmentType;
  score_value?: number;
  risk_level?: string;
  score_details?: unknown;
}
export interface CreateMarRequest {
  prescription_item_id?: string;
  drug_name: string;
  dose: string;
  route: string;
  frequency?: string;
  scheduled_at: string;
  is_high_alert?: boolean;
  notes?: string;
}
export interface UpdateMarRequest {
  status: MarStatus;
  administered_at?: string;
  witnessed_by?: string;
  barcode_verified?: boolean;
  hold_reason?: string;
  refused_reason?: string;
  notes?: string;
}
export interface CreateIntakeOutputRequest {
  is_intake: boolean;
  category: string;
  volume_ml: number;
  description?: string;
  recorded_at?: string;
  shift: NursingShift;
}
export interface CreateNursingAssessmentRequest {
  general_appearance?: unknown;
  skin_assessment?: unknown;
  pain_assessment?: unknown;
  nutritional_status?: unknown;
  elimination_status?: unknown;
  respiratory_status?: unknown;
  psychosocial_status?: unknown;
  fall_risk_assessment?: unknown;
  allergies?: string;
  medications_on_admission?: string;
  personal_belongings?: unknown;
  patient_education_needs?: string;
}
export interface CreateCarePlanRequest {
  nursing_diagnosis: string;
  goals?: string;
  interventions?: unknown;
}
export interface UpdateCarePlanRequest {
  goals?: string;
  interventions?: unknown;
  evaluation?: string;
  status?: CarePlanStatus;
}
export interface CreateHandoverRequest {
  shift: NursingShift;
  handover_date?: string;
  incoming_nurse: string;
  identification?: string;
  situation?: string;
  background?: string;
  assessment?: string;
  recommendation?: string;
  pending_tasks?: unknown;
}
export interface UpdateDischargeChecklistRequest {
  status: string;
}

// ══════════════════════════════════════════════════════════════
//  Operation Theatre (OT)
// ══════════════════════════════════════════════════════════════

export type OtBookingStatus =
  | "requested"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "postponed";
export type OtCasePriority = "elective" | "urgent" | "emergency";
export type AnesthesiaType =
  | "general"
  | "spinal"
  | "epidural"
  | "regional_block"
  | "local"
  | "sedation"
  | "combined";
export type AsaClassification = "asa_1" | "asa_2" | "asa_3" | "asa_4" | "asa_5" | "asa_6";
export type ChecklistPhase = "sign_in" | "time_out" | "sign_out";
export type OtRoomStatus = "available" | "in_use" | "cleaning" | "maintenance" | "reserved";
export type PreopClearanceStatus = "pending" | "cleared" | "not_cleared" | "conditional";
export type PostopRecoveryStatus =
  | "in_recovery"
  | "stable"
  | "shifted_to_ward"
  | "shifted_to_icu"
  | "discharged";

export interface OtRoom {
  id: string;
  tenant_id: string;
  location_id: string | null;
  name: string;
  code: string;
  status: OtRoomStatus;
  specialties: unknown;
  equipment: unknown;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OtBooking {
  id: string;
  tenant_id: string;
  patient_id: string;
  admission_id: string | null;
  ot_room_id: string;
  primary_surgeon_id: string;
  anesthetist_id: string | null;
  scheduled_date: string;
  scheduled_start: string;
  scheduled_end: string;
  actual_start: string | null;
  actual_end: string | null;
  procedure_name: string;
  procedure_code: string | null;
  laterality: string | null;
  priority: OtCasePriority;
  status: OtBookingStatus;
  consent_obtained: boolean;
  site_marked: boolean;
  blood_arranged: boolean;
  assistant_surgeons: unknown;
  scrub_nurses: unknown;
  circulating_nurses: unknown;
  estimated_duration_min: number | null;
  actual_start_time: string | null;
  actual_end_time: string | null;
  turnaround_minutes: number | null;
  cancellation_reason: string | null;
  postpone_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OtBookingListResponse {
  bookings: OtBooking[];
  total: number;
  page: number;
  per_page: number;
}

export interface OtPreopAssessment {
  id: string;
  tenant_id: string;
  booking_id: string;
  clearance_status: PreopClearanceStatus;
  asa_class: AsaClassification | null;
  airway_assessment: unknown;
  cardiac_assessment: unknown;
  pulmonary_assessment: unknown;
  lab_results_reviewed: boolean;
  imaging_reviewed: boolean;
  blood_group_confirmed: boolean;
  fasting_status: boolean;
  npo_since: string | null;
  allergies_noted: string | null;
  current_medications: string | null;
  conditions: string | null;
  assessed_by: string;
  assessed_at: string;
  created_at: string;
  updated_at: string;
}

export interface OtHandoffItem {
  key: string;
  label: string;
  checked: boolean;
}

export interface OtPreopHandoff {
  id: string;
  tenant_id: string;
  booking_id: string;
  items: OtHandoffItem[];
  handed_off_by: string | null;
  received_by: string | null;
  completed: boolean;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type OtPostopHandoff = OtPreopHandoff;

export type StationHandoffStatus = "open" | "acknowledged";

/** Generic location/station handoff (open-pickup) — used across modules. */
export interface StationHandoff {
  id: string;
  tenant_id: string;
  module: string;
  station_type: string;
  station_key: string;
  station_label: string | null;
  title: string;
  summary: string | null;
  items: unknown;
  status: StationHandoffStatus;
  handed_off_by: string;
  handed_off_at: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateStationHandoffInput {
  module: string;
  station_type: string;
  station_key: string;
  station_label?: string;
  title: string;
  summary?: string;
  items?: unknown;
}

export interface UpsertPreopHandoffInput {
  items?: OtHandoffItem[];
  received_by?: string;
  notes?: string;
  completed?: boolean;
}

export interface OtSurgicalSafetyChecklist {
  id: string;
  tenant_id: string;
  booking_id: string;
  phase: ChecklistPhase;
  items: unknown;
  completed: boolean;
  completed_by: string | null;
  completed_at: string | null;
  verified_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OtCaseRecord {
  id: string;
  tenant_id: string;
  booking_id: string;
  surgeon_id: string;
  patient_in_time: string | null;
  patient_out_time: string | null;
  incision_time: string | null;
  closure_time: string | null;
  procedure_performed: string;
  findings: string | null;
  technique: string | null;
  complications: string | null;
  blood_loss_ml: number | null;
  specimens: unknown;
  implants: unknown;
  drains: unknown;
  instrument_count_correct_before: boolean | null;
  instrument_count_correct_after: boolean | null;
  sponge_count_correct: boolean | null;
  count_discrepancy_action: string | null;
  cssd_issuance_ids: unknown;
  surgical_site_infection: boolean;
  ssi_detected_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OtAnesthesiaRecord {
  id: string;
  tenant_id: string;
  booking_id: string;
  anesthetist_id: string;
  anesthesia_type: AnesthesiaType;
  asa_class: AsaClassification | null;
  induction_time: string | null;
  intubation_time: string | null;
  extubation_time: string | null;
  airway_details: unknown;
  drugs_administered: unknown;
  monitoring_events: unknown;
  fluids_given: unknown;
  blood_products: unknown;
  adverse_events: unknown;
  complications: string | null;
  fasting_override_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OtPostopRecord {
  id: string;
  tenant_id: string;
  booking_id: string;
  destination_bed_id: string | null;
  recovery_status: PostopRecoveryStatus;
  arrival_time: string | null;
  discharge_time: string | null;
  aldrete_score_arrival: number | null;
  aldrete_score_discharge: number | null;
  vitals_on_arrival: unknown;
  monitoring_entries: unknown;
  pain_assessment: string | null;
  fluid_orders: string | null;
  diet_orders: string | null;
  activity_orders: string | null;
  disposition: string | null;
  postop_orders: unknown;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OtSurgeonPreference {
  id: string;
  tenant_id: string;
  surgeon_id: string;
  procedure_name: string;
  position: string | null;
  skin_prep: string | null;
  draping: string | null;
  instruments: unknown;
  sutures: unknown;
  implants: unknown;
  equipment: unknown;
  medications: unknown;
  special_instructions: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// OT Request Types
export interface CreateOtRoomRequest {
  name: string;
  code: string;
  location_id?: string;
  specialties?: unknown;
  equipment?: unknown;
}
export interface UpdateOtRoomRequest {
  name?: string;
  status?: OtRoomStatus;
  specialties?: unknown;
  equipment?: unknown;
  is_active?: boolean;
}
export interface CreateOtBookingRequest {
  patient_id: string;
  admission_id?: string;
  ot_room_id: string;
  primary_surgeon_id: string;
  anesthetist_id?: string;
  scheduled_date: string;
  scheduled_start: string;
  scheduled_end: string;
  procedure_name: string;
  procedure_code?: string;
  laterality?: string;
  priority?: OtCasePriority;
  estimated_duration_min?: number;
  assistant_surgeons?: unknown;
  scrub_nurses?: unknown;
  circulating_nurses?: unknown;
  notes?: string;
  /** Override reason if the primary surgeon's registration has expired (logged). */
  credential_override_reason?: string;
}
export interface UpdateOtBookingRequest {
  ot_room_id?: string;
  anesthetist_id?: string;
  scheduled_date?: string;
  scheduled_start?: string;
  scheduled_end?: string;
  procedure_name?: string;
  laterality?: string;
  priority?: OtCasePriority;
  consent_obtained?: boolean;
  site_marked?: boolean;
  blood_arranged?: boolean;
  assistant_surgeons?: unknown;
  scrub_nurses?: unknown;
  circulating_nurses?: unknown;
  estimated_duration_min?: number;
  notes?: string;
}
export interface UpdateOtBookingStatusRequest {
  status: OtBookingStatus;
  actual_start?: string;
  actual_end?: string;
  cancellation_reason?: string;
  postpone_reason?: string;
}
export interface CreatePreopAssessmentRequest {
  asa_class?: AsaClassification;
  airway_assessment?: unknown;
  cardiac_assessment?: unknown;
  pulmonary_assessment?: unknown;
  lab_results_reviewed?: boolean;
  imaging_reviewed?: boolean;
  blood_group_confirmed?: boolean;
  fasting_status?: boolean;
  npo_since?: string;
  allergies_noted?: string;
  current_medications?: string;
  conditions?: string;
}
export interface UpdatePreopAssessmentRequest {
  clearance_status?: PreopClearanceStatus;
  asa_class?: AsaClassification;
  airway_assessment?: unknown;
  cardiac_assessment?: unknown;
  pulmonary_assessment?: unknown;
  lab_results_reviewed?: boolean;
  imaging_reviewed?: boolean;
  blood_group_confirmed?: boolean;
  fasting_status?: boolean;
  npo_since?: string;
}
export interface CreateSafetyChecklistRequest {
  phase: ChecklistPhase;
  items: unknown;
}
export interface UpdateSafetyChecklistRequest {
  items?: unknown;
  completed?: boolean;
}
export interface CreateCaseRecordRequest {
  patient_in_time?: string;
  patient_out_time?: string;
  incision_time?: string;
  closure_time?: string;
  procedure_performed: string;
  findings?: string;
  technique?: string;
  complications?: string;
  blood_loss_ml?: number;
  specimens?: unknown;
  implants?: unknown;
  drains?: unknown;
  instrument_count_correct_before?: boolean;
  instrument_count_correct_after?: boolean;
  sponge_count_correct?: boolean;
  count_discrepancy_action?: string;
  cssd_issuance_ids?: unknown;
  notes?: string;
}
export interface UpdateCaseRecordRequest {
  patient_out_time?: string;
  closure_time?: string;
  findings?: string;
  technique?: string;
  complications?: string;
  blood_loss_ml?: number;
  specimens?: unknown;
  implants?: unknown;
  drains?: unknown;
  instrument_count_correct_after?: boolean;
  sponge_count_correct?: boolean;
  count_discrepancy_action?: string;
  notes?: string;
}
export interface CreateAnesthesiaRecordRequest {
  anesthesia_type: AnesthesiaType;
  asa_class?: AsaClassification;
  induction_time?: string;
  intubation_time?: string;
  airway_details?: unknown;
  drugs_administered?: unknown;
  fasting_override_reason?: string;
  notes?: string;
}
export interface UpdateAnesthesiaRecordRequest {
  extubation_time?: string;
  monitoring_events?: unknown;
  fluids_given?: unknown;
  blood_products?: unknown;
  adverse_events?: unknown;
  complications?: string;
  notes?: string;
}
export interface CreatePostopRecordRequest {
  destination_bed_id?: string;
  arrival_time?: string;
  aldrete_score_arrival?: number;
  vitals_on_arrival?: unknown;
  pain_assessment?: string;
  fluid_orders?: string;
  diet_orders?: string;
  activity_orders?: string;
  postop_orders?: unknown;
  notes?: string;
}
export interface UpdatePostopRecordRequest {
  recovery_status?: PostopRecoveryStatus;
  discharge_time?: string;
  aldrete_score_discharge?: number;
  monitoring_entries?: unknown;
  disposition?: string;
  notes?: string;
}
export interface CreateSurgeonPreferenceRequest {
  surgeon_id: string;
  procedure_name: string;
  position?: string;
  skin_prep?: string;
  draping?: string;
  instruments?: unknown;
  sutures?: unknown;
  implants?: unknown;
  equipment?: unknown;
  medications?: unknown;
  special_instructions?: string;
}
export interface UpdateSurgeonPreferenceRequest {
  position?: string;
  skin_prep?: string;
  draping?: string;
  instruments?: unknown;
  sutures?: unknown;
  implants?: unknown;
  equipment?: unknown;
  medications?: unknown;
  special_instructions?: string;
  is_active?: boolean;
}

// ══════════════════════════════════════════════════════════════
//  Blood Bank & Transfusion Medicine
// ══════════════════════════════════════════════════════════════

export type DonationType = "whole_blood" | "apheresis_platelets" | "apheresis_plasma";

export type BloodComponentType =
  | "whole_blood"
  | "prbc"
  | "ffp"
  | "platelets"
  | "cryoprecipitate"
  | "granulocytes";

export type BloodBagStatus =
  | "collected"
  | "processing"
  | "tested"
  | "available"
  | "reserved"
  | "crossmatched"
  | "issued"
  | "transfused"
  | "returned"
  | "expired"
  | "discarded";

export type CrossmatchStatus =
  | "requested"
  | "testing"
  | "compatible"
  | "incompatible"
  | "issued"
  | "cancelled";

export type TransfusionReactionSeverity = "mild" | "moderate" | "severe" | "fatal";

export interface BloodDonor {
  id: string;
  tenant_id: string;
  donor_number: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  blood_group: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  id_type: string | null;
  id_number: string | null;
  is_active: boolean;
  is_deferred: boolean;
  deferral_reason: string | null;
  deferral_until: string | null;
  last_donation: string | null;
  total_donations: number;
  medical_history: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface BloodDonation {
  id: string;
  tenant_id: string;
  donor_id: string;
  bag_number: string;
  donation_type: DonationType;
  volume_ml: number;
  donated_at: string;
  collected_by: string | null;
  camp_name: string | null;
  adverse_reaction: string | null;
  notes: string | null;
  created_at: string;
}

export interface BloodComponent {
  id: string;
  tenant_id: string;
  donation_id: string;
  component_type: BloodComponentType;
  bag_number: string;
  blood_group: string;
  volume_ml: number;
  status: BloodBagStatus;
  collected_at: string;
  expiry_at: string;
  storage_location: string | null;
  storage_temperature: string | null;
  tti_status: string | null;
  tti_tested_at: string | null;
  issued_to_patient: string | null;
  issued_at: string | null;
  issued_by: string | null;
  discarded_at: string | null;
  discard_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrossmatchRequest {
  id: string;
  tenant_id: string;
  patient_id: string;
  component_id: string | null;
  requested_by: string;
  blood_group: string;
  component_type: BloodComponentType;
  units_requested: number;
  clinical_indication: string | null;
  status: CrossmatchStatus;
  result: string | null;
  tested_by: string | null;
  tested_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransfusionRecord {
  id: string;
  tenant_id: string;
  patient_id: string;
  component_id: string;
  crossmatch_id: string | null;
  administered_by: string;
  verified_by: string | null;
  patient_verified_by: string | null;
  product_verified_by: string | null;
  started_at: string;
  completed_at: string | null;
  volume_transfused_ml: number | null;
  has_reaction: boolean;
  reaction_type: string | null;
  reaction_severity: TransfusionReactionSeverity | null;
  reaction_details: string | null;
  reaction_reported_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DonorListResponse {
  donors: BloodDonor[];
  total: number;
  page: number;
  per_page: number;
}

export interface CreateDonorRequest {
  donor_number: string;
  first_name: string;
  last_name: string;
  blood_group: string;
  date_of_birth?: string;
  gender?: string;
  phone?: string;
  email?: string;
  address?: string;
  id_type?: string;
  id_number?: string;
}

export interface CreateDonationRequest {
  bag_number: string;
  donation_type?: DonationType;
  volume_ml: number;
  camp_name?: string;
  notes?: string;
}

export interface AdverseReaction {
  reaction_type:
    | "vasovagal"
    | "hematoma"
    | "nerve_injury"
    | "citrate_reaction"
    | "allergic"
    | "other";
  severity: "mild" | "moderate" | "severe";
  description: string;
  treatment_given: string;
  outcome: "resolved" | "referred" | "hospitalized";
}

export interface UpdateDonationRequest {
  adverse_reaction?: string;
  notes?: string;
}

export interface CreateComponentRequest {
  donation_id: string;
  component_type: BloodComponentType;
  bag_number: string;
  blood_group: string;
  volume_ml: number;
  expiry_at: string;
  storage_location?: string;
}

export interface UpdateComponentStatusRequest {
  status: BloodBagStatus;
  discard_reason?: string;
}

export interface CreateCrossmatchRequestBody {
  patient_id: string;
  blood_group: string;
  component_type?: BloodComponentType;
  units_requested?: number;
  clinical_indication?: string;
}

export interface UpdateCrossmatchRequestBody {
  status?: CrossmatchStatus;
  result?: string;
  component_id?: string;
}

export interface CreateTransfusionRequest {
  patient_id: string;
  component_id: string;
  crossmatch_id?: string;
  patient_verified_by: string;
  product_verified_by: string;
}

export interface RecordReactionRequest {
  reaction_type: string;
  reaction_severity: TransfusionReactionSeverity;
  reaction_details?: string;
}

export type TransfusionObservationPhase = "baseline" | "fifteen_min" | "periodic" | "completion";

export interface TransfusionObservation {
  id: string;
  tenant_id: string;
  transfusion_id: string;
  phase: TransfusionObservationPhase;
  temperature_c: number | null;
  pulse: number | null;
  systolic_bp: number | null;
  diastolic_bp: number | null;
  respiratory_rate: number | null;
  adverse_signs: boolean;
  reaction_suspected: boolean;
  notes: string | null;
  observed_by: string | null;
  observed_at: string;
  created_at: string;
}

export interface RecordTransfusionObservationRequest {
  phase: TransfusionObservationPhase;
  temperature_c?: number;
  pulse?: number;
  systolic_bp?: number;
  diastolic_bp?: number;
  respiratory_rate?: number;
  adverse_signs?: boolean;
  notes?: string;
}

// ══════════════════════════════════════════════════════════════
//  ICU / Critical Care
// ══════════════════════════════════════════════════════════════

export type IcuScoreType =
  | "apache_ii"
  | "apache_iv"
  | "sofa"
  | "gcs"
  | "prism"
  | "snappe"
  | "rass"
  | "cam_icu";

export type VentilatorMode =
  | "cmv"
  | "acv"
  | "simv"
  | "psv"
  | "cpap"
  | "bipap"
  | "hfov"
  | "aprv"
  | "niv"
  | "other";

export type IcuDeviceType =
  | "central_line"
  | "urinary_catheter"
  | "ventilator"
  | "arterial_line"
  | "peripheral_iv"
  | "nasogastric_tube"
  | "chest_tube"
  | "tracheostomy";

export type NutritionRoute = "enteral" | "parenteral" | "oral" | "npo";

export interface IcuFlowsheet {
  id: string;
  tenant_id: string;
  admission_id: string;
  recorded_at: string;
  recorded_by: string;
  heart_rate: number | null;
  systolic_bp: number | null;
  diastolic_bp: number | null;
  mean_arterial_bp: number | null;
  respiratory_rate: number | null;
  spo2: number | null;
  temperature: number | null;
  cvp: number | null;
  intake_ml: number | null;
  output_ml: number | null;
  urine_ml: number | null;
  drain_ml: number | null;
  infusions: Record<string, unknown>[] | null;
  notes: string | null;
  created_at: string;
}

export interface IcuVentilatorRecord {
  id: string;
  tenant_id: string;
  admission_id: string;
  recorded_at: string;
  recorded_by: string;
  mode: VentilatorMode;
  fio2: number | null;
  peep: number | null;
  tidal_volume: number | null;
  respiratory_rate: number | null;
  pip: number | null;
  plateau_pressure: number | null;
  ph: number | null;
  pao2: number | null;
  paco2: number | null;
  hco3: number | null;
  sao2: number | null;
  lactate: number | null;
  notes: string | null;
  created_at: string;
}

export interface IcuScore {
  id: string;
  tenant_id: string;
  admission_id: string;
  score_type: IcuScoreType;
  score_value: number;
  score_details: Record<string, unknown> | null;
  predicted_mortality: number | null;
  scored_at: string;
  scored_by: string;
  notes: string | null;
  created_at: string;
}

export interface IcuDevice {
  id: string;
  tenant_id: string;
  admission_id: string;
  device_type: IcuDeviceType;
  inserted_at: string;
  inserted_by: string | null;
  removed_at: string | null;
  removed_by: string | null;
  site: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface IcuBundleCheck {
  id: string;
  tenant_id: string;
  device_id: string;
  checked_at: string;
  checked_by: string;
  is_compliant: boolean;
  still_needed: boolean;
  checklist: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
}

export interface IcuNutrition {
  id: string;
  tenant_id: string;
  admission_id: string;
  recorded_at: string;
  recorded_by: string;
  route: NutritionRoute;
  formula_name: string | null;
  rate_ml_hr: number | null;
  calories_kcal: number | null;
  protein_gm: number | null;
  volume_ml: number | null;
  notes: string | null;
  created_at: string;
}

export interface IcuNeonatalRecord {
  id: string;
  tenant_id: string;
  admission_id: string;
  recorded_at: string;
  recorded_by: string;
  gestational_age_weeks: number | null;
  birth_weight_gm: number | null;
  current_weight_gm: number | null;
  bilirubin_total: number | null;
  bilirubin_direct: number | null;
  phototherapy_active: boolean;
  phototherapy_hours: number | null;
  breast_milk_type: string | null;
  breast_milk_volume_ml: number | null;
  hearing_screen_result: string | null;
  sepsis_screen_result: string | null;
  mother_patient_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface CreateIcuFlowsheetRequest {
  heart_rate?: number;
  systolic_bp?: number;
  diastolic_bp?: number;
  mean_arterial_bp?: number;
  respiratory_rate?: number;
  spo2?: number;
  temperature?: number;
  cvp?: number;
  intake_ml?: number;
  output_ml?: number;
  urine_ml?: number;
  drain_ml?: number;
  infusions?: Record<string, unknown>[];
  notes?: string;
}

export interface CreateIcuVentilatorRequest {
  mode: VentilatorMode;
  fio2?: number;
  peep?: number;
  tidal_volume?: number;
  respiratory_rate?: number;
  pip?: number;
  plateau_pressure?: number;
  ph?: number;
  pao2?: number;
  paco2?: number;
  hco3?: number;
  sao2?: number;
  lactate?: number;
  notes?: string;
}

export interface CreateIcuScoreRequest {
  score_type: IcuScoreType;
  score_value: number;
  score_details?: Record<string, unknown>;
  predicted_mortality?: number;
  notes?: string;
}

export interface CreateIcuDeviceRequest {
  device_type: IcuDeviceType;
  site?: string;
  notes?: string;
}

export interface CreateIcuBundleCheckRequest {
  is_compliant: boolean;
  still_needed: boolean;
  checklist?: Record<string, unknown>;
  notes?: string;
}

export interface CreateIcuNutritionRequest {
  route: NutritionRoute;
  formula_name?: string;
  rate_ml_hr?: number;
  calories_kcal?: number;
  protein_gm?: number;
  volume_ml?: number;
  notes?: string;
}

export interface CreateIcuNeonatalRequest {
  gestational_age_weeks?: number;
  birth_weight_gm?: number;
  current_weight_gm?: number;
  bilirubin_total?: number;
  bilirubin_direct?: number;
  phototherapy_active?: boolean;
  phototherapy_hours?: number;
  breast_milk_type?: string;
  breast_milk_volume_ml?: number;
  hearing_screen_result?: string;
  sepsis_screen_result?: string;
  mother_patient_id?: string;
  notes?: string;
}

// ══════════════════════════════════════════════════════════════
//  Camp Management
// ══════════════════════════════════════════════════════════════

export type CampType =
  | "general_health"
  | "blood_donation"
  | "vaccination"
  | "eye_screening"
  | "dental"
  | "awareness"
  | "specialized";

export type CampStatus = "planned" | "approved" | "setup" | "active" | "completed" | "cancelled";

export type CampRegistrationStatus =
  | "registered"
  | "screened"
  | "referred"
  | "converted"
  | "no_show";

export type CampFollowupStatus = "scheduled" | "completed" | "missed" | "cancelled";

export interface Camp {
  id: string;
  tenant_id: string;
  camp_code: string;
  name: string;
  camp_type: CampType;
  status: CampStatus;
  organizing_department_id: string | null;
  coordinator_id: string | null;
  scheduled_date: string;
  start_time: string | null;
  end_time: string | null;
  venue_name: string | null;
  venue_address: string | null;
  venue_city: string | null;
  venue_state: string | null;
  venue_pincode: string | null;
  venue_latitude: number | null;
  venue_longitude: number | null;
  expected_participants: number | null;
  actual_participants: number | null;
  budget_allocated: number | null;
  budget_spent: number | null;
  logistics_notes: string | null;
  equipment_list: unknown | null;
  is_free: boolean;
  discount_percentage: number | null;
  approved_by: string | null;
  approved_at: string | null;
  completed_at: string | null;
  cancellation_reason: string | null;
  summary_notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampTeamMember {
  id: string;
  tenant_id: string;
  camp_id: string;
  employee_id: string;
  employee_code?: string | null;
  employee_name?: string | null;
  department_name?: string | null;
  role_in_camp: string;
  is_confirmed: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampStaffOption {
  id: string;
  employee_code: string;
  display_name: string;
  department_id: string | null;
  department_name: string | null;
  designation_name: string | null;
  status: string;
}

export interface CampMedicineOption {
  id: string;
  code: string;
  name: string;
  generic_name: string | null;
  unit: string | null;
  current_stock: number;
  base_price: string;
  tax_percent: string;
  drug_schedule: DrugSchedule | null;
  is_controlled: boolean;
  is_lasa: boolean;
  batch_tracking_required: boolean;
  formulary_status: FormularyStatus;
}

export interface CampRegistration {
  id: string;
  tenant_id: string;
  camp_id: string;
  registration_number: string;
  person_name: string;
  age: number | null;
  gender: string | null;
  phone: string | null;
  address: string | null;
  id_proof_type: string | null;
  id_proof_number: string | null;
  patient_id: string | null;
  clinical_department_id: string | null;
  attending_doctor_id: string | null;
  service_line: string | null;
  status: CampRegistrationStatus;
  chief_complaint: string | null;
  is_walk_in: boolean;
  registered_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampOpenEncounterResponse {
  encounter_id: string;
  queue_id?: string | null;
  patient_id: string;
  patient_name: string;
  uhid: string;
  department_id: string;
  doctor_id?: string | null;
}

export interface OpenCampRegistrationEncounterRequest {
  department_id?: string | null;
  doctor_id?: string | null;
}

export interface CampScreening {
  id: string;
  tenant_id: string;
  registration_id: string;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  pulse_rate: number | null;
  spo2: number | null;
  temperature: number | null;
  blood_sugar_random: number | null;
  bmi: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  visual_acuity_left: string | null;
  visual_acuity_right: string | null;
  findings: string | null;
  diagnosis: string | null;
  advice: string | null;
  referred_to_hospital: boolean;
  referral_department: string | null;
  referral_urgency: string | null;
  screened_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampLabSample {
  id: string;
  tenant_id: string;
  registration_id: string;
  sample_type: string;
  test_requested: string | null;
  barcode: string | null;
  collected_at: string | null;
  collected_by: string | null;
  sent_to_lab: boolean;
  lab_order_id: string | null;
  result_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampBillingRecord {
  id: string;
  tenant_id: string;
  registration_id: string;
  service_description: string;
  standard_amount: number;
  discount_percentage: number | null;
  charged_amount: number;
  tax_percent: number;
  tax_amount: number;
  total_amount: number;
  sponsor_covered_amount: number;
  is_free: boolean;
  payment_mode: string | null;
  payment_reference: string | null;
  source_module: string | null;
  source_entity_id: string | null;
  billed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampFollowup {
  id: string;
  tenant_id: string;
  registration_id: string;
  followup_date: string;
  followup_type: string;
  status: CampFollowupStatus;
  notes: string | null;
  outcome: string | null;
  converted_to_patient: boolean;
  converted_patient_id: string | null;
  converted_department_id: string | null;
  followed_up_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampPacketPatientSummary {
  patient_id: string;
  uhid: string;
  display_name: string;
  gender: string;
  date_of_birth: string | null;
  age_years: number | null;
  phone_last4: string | null;
  blood_group: string | null;
  no_known_allergies: boolean | null;
  last_visit_date: string | null;
  is_vip: boolean;
  is_medico_legal: boolean;
  updated_at: string;
}

export interface CampPacketAllergy {
  patient_id: string;
  allergy_type: string;
  allergen_name: string;
  allergen_code: string | null;
  reaction: string | null;
  severity: string | null;
}

export interface CampPacketVital {
  patient_id: string;
  encounter_id: string;
  temperature: number | null;
  pulse: number | null;
  systolic_bp: number | null;
  diastolic_bp: number | null;
  respiratory_rate: number | null;
  spo2: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  bmi: number | null;
  notes: string | null;
  recorded_at: string;
}

export interface CampPacketRegistrationHistory {
  patient_id: string | null;
  registration_id: string;
  camp_id: string;
  camp_code: string;
  camp_name: string;
  registration_number: string;
  person_name: string;
  age: number | null;
  gender: string | null;
  phone_last4: string | null;
  chief_complaint: string | null;
  status: string;
  venue_city: string | null;
  venue_state: string | null;
  registered_at: string;
  current_camp: boolean;
}

export interface CampPacketVisitHistory {
  patient_id: string;
  encounter_id: string;
  encounter_type: string;
  status: string;
  encounter_date: string;
  department_name: string | null;
  doctor_name: string | null;
  notes: string | null;
  diagnosis_summary: string | null;
  prescription_summary: string | null;
}

export interface CampPacketDiagnosisHistory {
  patient_id: string;
  encounter_id: string;
  icd_code: string | null;
  description: string;
  is_primary: boolean;
  severity: string | null;
  certainty: string | null;
  onset_date: string | null;
  created_at: string;
}

export interface CampPacketMedicationHistory {
  patient_id: string;
  encounter_id: string;
  prescription_id: string;
  drug_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  route: string | null;
  instructions: string | null;
  item_status: string;
  prescribed_at: string;
}

export interface CampRemoteSetup {
  id: string;
  tenant_id: string;
  camp_id: string;
  village_name: string | null;
  block_name: string | null;
  district_name: string | null;
  site_landmark: string | null;
  latitude: number | null;
  longitude: number | null;
  expected_footfall: number | null;
  site_contact_name: string | null;
  site_contact_phone: string | null;
  local_authority_name: string | null;
  local_authority_phone: string | null;
  referral_facility_name: string | null;
  referral_facility_phone: string | null;
  ambulance_contact_name: string | null;
  ambulance_contact_phone: string | null;
  emergency_route_notes: string | null;
  network_plan: string | null;
  power_plan: string | null;
  water_sanitation_plan: string | null;
  privacy_plan: string | null;
  crowd_control_plan: string | null;
  bmw_plan: string | null;
  infection_control_plan: string | null;
  status: "draft" | "ready" | "blocked" | "closed";
  readiness_score: number;
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampRemoteChecklistItem {
  id: string;
  tenant_id: string;
  camp_id: string;
  category: string;
  code: string;
  label: string;
  nabh_chapter: string;
  required: boolean;
  status: "pending" | "ok" | "issue" | "not_applicable";
  notes: string | null;
  evidence_attachment_id: string | null;
  checked_by: string | null;
  checked_at: string | null;
  created_at: string;
  updated_at: string;
}

export type CampSupplyCategory =
  | "equipment"
  | "consumable"
  | "medicine"
  | "ppe"
  | "biomedical_waste"
  | "document"
  | "it"
  | "other";

export type CampIncidentType =
  | "patient_safety"
  | "infection_control"
  | "biomedical_waste"
  | "facility_safety"
  | "staff_safety"
  | "data_privacy"
  | "equipment"
  | "network"
  | "crowd_control"
  | "other";

export interface CampSupplyItem {
  id: string;
  tenant_id: string;
  camp_id: string;
  category: CampSupplyCategory;
  catalog_item_id: string | null;
  batch_stock_id: string | null;
  store_location_id: string | null;
  item_name: string;
  unit: string | null;
  planned_qty: number;
  packed_qty: number;
  consumed_qty: number;
  returned_qty: number;
  batch_no: string | null;
  expiry_date: string | null;
  charge_mode: "free" | "paid" | "mixed" | "sponsor_covered";
  unit_price: number;
  tax_percent: number;
  cost_amount: number;
  sponsor_covered_amount: number;
  concession_percentage: number;
  approval_required: boolean;
  is_critical: boolean;
  shortage_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface UnifiedAsset {
  tenant_id: string;
  source_type: string;
  source_id: string;
  display_code: string | null;
  name: string;
  asset_domain: string;
  asset_category_id: string | null;
  asset_category_name: string | null;
  store_category_id: string | null;
  store_category_name: string | null;
  department_id: string | null;
  location_id: string | null;
  facility_id: string | null;
  location_label: string | null;
  status: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  barcode_value: string | null;
  is_active: boolean;
  is_critical: boolean;
  camp_eligible: boolean;
  requires_pm: boolean;
  requires_calibration: boolean;
  next_pm_due: string | null;
  next_calibration_due: string | null;
  compliance_state: string;
  open_reservation_count: number;
}

/** Store stock value rolled up by category. */
export interface MaterialsCategoryValue {
  category: string | null;
  item_count: number;
  stock_value: string;
}

/** Cross-domain materials KPIs for the workspace analytics section. */
export interface MaterialsAnalytics {
  stock_value: string;
  asset_value: string;
  total_value: string;
  stock_item_count: number;
  asset_count: number;
  low_stock_count: number;
  out_of_stock_count: number;
  dead_stock_count: number;
  open_requisitions: number;
  categories: MaterialsCategoryValue[];
}

/** A normalised inventory line — a store-stock item or a capital asset. */
export interface InventoryItem {
  id: string;
  /** "stock" | "asset". */
  kind: string;
  code: string | null;
  name: string;
  category: string | null;
  department_name: string | null;
  unit: string | null;
  /** Quantity on hand (numeric string from the API). */
  on_hand: string;
  reorder_level: number | null;
  unit_value: string | null;
  total_value: string | null;
  /** "in_stock" | "low" | "out" | "na". */
  stock_status: string;
}

/** A normalised cross-domain requisition (store indent or asset request). */
export interface Requisition {
  id: string;
  /** "store_indent" | "asset_request". */
  kind: string;
  reference: string | null;
  title: string;
  department_name: string | null;
  requested_by_name: string | null;
  priority: string | null;
  status: string;
  open: boolean;
  created_at: string;
}

/** One row of the asset-movement ledger / inter-department request flow. */
export interface AssetMovement {
  id: string;
  source_type: string;
  source_id: string;
  movement_type: string;
  status: "requested" | "completed" | "rejected" | "cancelled";
  from_department_id: string | null;
  to_department_id: string | null;
  from_department_name: string | null;
  to_department_name: string | null;
  from_location: string | null;
  to_location: string | null;
  reason: string | null;
  requested_by: string | null;
  requested_by_name: string | null;
  completed_by: string | null;
  completed_by_name: string | null;
  completed_at: string | null;
  rejection_reason: string | null;
  asset_name: string | null;
  asset_code: string | null;
  created_at: string;
}

export interface CreateAssetMovementRequest {
  source_type: string;
  source_id: string;
  movement_type?: string;
  to_department_id?: string;
  to_location?: string;
  reason?: string;
  /** True → record + relocate in one step; otherwise lands as a request. */
  complete_now?: boolean;
}

export interface RejectAssetMovementRequest {
  rejection_reason?: string;
}

export interface AssetCategory {
  id: string;
  tenant_id: string | null;
  code: string;
  name: string;
  parent_id: string | null;
  asset_domain: string;
  description: string | null;
  regulatory_class: string | null;
  default_pm_frequency: string | null;
  default_calibration_frequency: string | null;
  requires_pm: boolean;
  requires_calibration: boolean;
  is_camp_eligible: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface StoreCategory {
  id: string;
  tenant_id: string | null;
  code: string;
  name: string;
  parent_id: string | null;
  store_domain: string;
  description: string | null;
  requires_batch_tracking: boolean;
  requires_expiry_tracking: boolean;
  requires_temperature_log: boolean;
  requires_license_tracking: boolean;
  is_camp_source: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface AssetClassification {
  id: string;
  tenant_id: string;
  source_type: string;
  source_id: string;
  asset_category_id: string | null;
  store_category_id: string | null;
  asset_domain: string;
  criticality: "critical" | "high" | "routine" | "low" | string;
  custody_mode: "asset_tagged" | "serialised" | "pooled" | "non_movable" | string;
  is_camp_eligible: boolean;
  tags: string[];
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampAssetReservation {
  id: string;
  tenant_id: string;
  camp_id: string;
  asset_classification_id: string | null;
  source_type: string;
  source_id: string;
  asset_category_id: string | null;
  asset_code: string | null;
  asset_name: string;
  asset_snapshot: Record<string, unknown>;
  required_from: string | null;
  required_to: string | null;
  quantity: number;
  status: "requested" | "reserved" | "issued" | "returned" | "damaged" | "lost" | "cancelled";
  is_critical: boolean;
  requested_by: string | null;
  reserved_by: string | null;
  reserved_at: string | null;
  issued_by: string | null;
  issued_to: string | null;
  issued_at: string | null;
  returned_by: string | null;
  returned_at: string | null;
  issue_condition: string | null;
  return_condition: string | null;
  damage_notes: string | null;
  loss_notes: string | null;
  reconciliation_notes: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampReferral {
  id: string;
  tenant_id: string;
  camp_id: string;
  registration_id: string | null;
  referred_to_facility: string;
  referral_department: string | null;
  urgency: "routine" | "urgent" | "emergency";
  reason: string;
  transport_mode: string | null;
  ambulance_required: boolean;
  attendant_name: string | null;
  attendant_phone: string | null;
  status: "created" | "sent" | "accepted" | "completed" | "cancelled";
  referred_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampIncident {
  id: string;
  tenant_id: string;
  camp_id: string;
  registration_id: string | null;
  incident_type: CampIncidentType;
  severity: "low" | "moderate" | "high" | "critical";
  description: string;
  immediate_action: string | null;
  status: "open" | "contained" | "closed";
  reported_by: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampReadinessSummary {
  required_total: number;
  required_done: number;
  issue_count: number;
  score: number;
  ready: boolean;
}

export interface CampPlanningFinancials {
  planned_budget: string;
  planned_patient_collection: string;
  planned_sponsor_coverage: string;
  planned_cost: string;
  actual_patient_collection: string;
  sponsor_receivable: string;
  sponsor_collected: string;
  actual_cost: string;
  profit_loss: string;
  margin_pct: number;
  budget_variance: string;
  budget_variance_pct: number;
  cash_surplus: string;
  free_issue_value: string;
  paid_issue_value: string;
}

export interface CampPlanningStockSummary {
  total_items: number;
  medicine_items: number;
  approval_required_items: number;
  shortage_items: number;
  critical_shortage_items: number;
  traceability_gap_items: number;
  supply_return_pending_items: number;
  asset_reservation_items: number;
  asset_critical_unissued_items: number;
  asset_return_pending_items: number;
  asset_reconciliation_blocked_items: number;
}

export interface CampPlanningActionItem {
  code: string;
  label: string;
  severity: "success" | "warning" | "danger" | string;
  status: "ok" | "pending" | "blocked" | string;
  owner_module: string;
  evidence: string;
  blocks_activation: boolean;
  blocks_closeout: boolean;
}

export interface CampPlanningSummary {
  camp_id: string;
  camp_status: string;
  readiness: CampReadinessSummary;
  financials: CampPlanningFinancials;
  stock: CampPlanningStockSummary;
  action_items: CampPlanningActionItem[];
  activation_blocked: boolean;
  closeout_blocked: boolean;
}

export interface CampRemoteOperationsResponse {
  setup: CampRemoteSetup;
  checklist: CampRemoteChecklistItem[];
  supplies: CampSupplyItem[];
  referrals: CampReferral[];
  incidents: CampIncident[];
  readiness: CampReadinessSummary;
}

export interface CampPacketDepartmentRef {
  id: string;
  code: string;
  name: string;
  department_type: string;
}

export interface CampPacketDoctorRef {
  id: string;
  full_name: string;
  specialization: string | null;
  medical_registration_number: string | null;
  department_ids: string[];
}

export interface CampPacketLabTestRef {
  id: string;
  code: string;
  name: string;
  department_id: string | null;
  sample_type: string | null;
  price: string;
  loinc_code: string | null;
}

export interface CampPacketPharmacyStockRef {
  catalog_item_id: string;
  code: string;
  name: string;
  generic_name: string | null;
  category: string | null;
  unit: string | null;
  base_price: string;
  tax_percent: string;
  current_stock: number;
  drug_schedule: string | null;
  is_controlled: boolean;
  is_lasa: boolean;
  aware_category: string | null;
  prescription_only: boolean | null;
  batch_id: string | null;
  batch_number: string | null;
  expiry_date: string | null;
  quantity_on_hand: number | null;
  store_location_id: string | null;
  selling_rate: string | null;
}

export interface CampPacketResponse {
  camp: Camp;
  team: CampTeamMember[];
  registrations: CampRegistration[];
  screenings: CampScreening[];
  lab_samples: CampLabSample[];
  remote_setup: CampRemoteSetup | null;
  remote_checklist: CampRemoteChecklistItem[];
  supplies: CampSupplyItem[];
  patient_summaries: CampPacketPatientSummary[];
  active_allergies: CampPacketAllergy[];
  recent_vitals: CampPacketVital[];
  registration_history: CampPacketRegistrationHistory[];
  visit_history: CampPacketVisitHistory[];
  diagnosis_history: CampPacketDiagnosisHistory[];
  medication_history: CampPacketMedicationHistory[];
  department_refs: CampPacketDepartmentRef[];
  doctor_refs: CampPacketDoctorRef[];
  lab_test_refs: CampPacketLabTestRef[];
  pharmacy_stock_refs: CampPacketPharmacyStockRef[];
  downloaded_at: string;
  expires_at: string;
  packet_revision: string;
}

export type CampSyncEventType =
  | "camp.patient.upsert"
  | "camp.opd.encounter.create"
  | "camp.vitals.record"
  | "camp.lab.order.create"
  | "camp.lab.sample.collect"
  | "camp.prescription.create"
  | "camp.pharmacy.dispense"
  | "camp.billing.record"
  | "camp.stock.adjust"
  | "camp.registration.create"
  | "camp.screening.create"
  | "camp.lab_sample.create"
  | "camp.referral.create"
  | "camp.incident.create"
  | "camp.checklist.update"
  | "camp.supply.create"
  | "camp.supply.update";

export interface CampSyncInboundEvent {
  idempotency_key: string;
  event_type: CampSyncEventType;
  client_entity_id?: string;
  occurred_at?: string;
  payload: Record<string, unknown>;
}

export interface CampSyncInboundRequest {
  camp_id: string;
  device_id: string;
  events: CampSyncInboundEvent[];
}

export interface CampSyncEventResult {
  idempotency_key: string;
  event_type: string;
  status: "applied" | "duplicate" | "failed";
  server_entity_type: string | null;
  server_entity_id: string | null;
  server_entities?: Record<string, string | null>;
  message: string | null;
}

export interface CampSyncInboundResponse {
  camp_id: string;
  device_id: string;
  accepted: number;
  applied: number;
  duplicates: number;
  failed: number;
  results: CampSyncEventResult[];
}

export interface CreateCampRequest {
  name: string;
  camp_type: string;
  organizing_department_id?: string;
  coordinator_id?: string;
  scheduled_date: string;
  start_time?: string;
  end_time?: string;
  venue_name?: string;
  venue_address?: string;
  venue_city?: string;
  venue_state?: string;
  venue_pincode?: string;
  venue_latitude?: number;
  venue_longitude?: number;
  expected_participants?: number;
  budget_allocated?: number;
  logistics_notes?: string;
  equipment_list?: unknown;
  is_free?: boolean;
  discount_percentage?: number;
}

export interface UpdateCampRequest {
  name?: string;
  organizing_department_id?: string;
  coordinator_id?: string;
  scheduled_date?: string;
  start_time?: string;
  end_time?: string;
  venue_name?: string;
  venue_address?: string;
  venue_city?: string;
  venue_state?: string;
  venue_pincode?: string;
  venue_latitude?: number;
  venue_longitude?: number;
  expected_participants?: number;
  budget_allocated?: number;
  budget_spent?: number;
  logistics_notes?: string;
  equipment_list?: unknown;
  is_free?: boolean;
  discount_percentage?: number;
  summary_notes?: string;
}

export interface CancelCampRequest {
  cancellation_reason?: string;
}

export interface AddCampTeamMemberRequest {
  employee_id: string;
  role_in_camp: string;
  is_confirmed?: boolean;
  notes?: string;
}

export interface UpsertCampRemoteSetupRequest {
  village_name?: string;
  block_name?: string;
  district_name?: string;
  site_landmark?: string;
  latitude?: number;
  longitude?: number;
  expected_footfall?: number;
  site_contact_name?: string;
  site_contact_phone?: string;
  local_authority_name?: string;
  local_authority_phone?: string;
  referral_facility_name?: string;
  referral_facility_phone?: string;
  ambulance_contact_name?: string;
  ambulance_contact_phone?: string;
  emergency_route_notes?: string;
  network_plan?: string;
  power_plan?: string;
  water_sanitation_plan?: string;
  privacy_plan?: string;
  crowd_control_plan?: string;
  bmw_plan?: string;
  infection_control_plan?: string;
  status?: "draft" | "ready" | "blocked" | "closed";
}

export interface UpdateCampRemoteChecklistItemRequest {
  status: "pending" | "ok" | "issue" | "not_applicable";
  notes?: string;
}

export interface CreateCampSupplyItemRequest {
  category: CampSupplyItem["category"];
  catalog_item_id?: string;
  batch_stock_id?: string;
  store_location_id?: string;
  item_name: string;
  unit?: string;
  planned_qty?: number;
  packed_qty?: number;
  batch_no?: string;
  expiry_date?: string;
  charge_mode?: CampSupplyItem["charge_mode"];
  unit_price?: number;
  tax_percent?: number;
  cost_amount?: number;
  sponsor_covered_amount?: number;
  concession_percentage?: number;
  approval_required?: boolean;
  is_critical?: boolean;
  shortage_notes?: string;
}

export interface BulkCreateCampSupplyItemsRequest {
  items: CreateCampSupplyItemRequest[];
}

export interface BulkCreateCampSupplyItemsResponse {
  count: number;
  created: CampSupplyItem[];
}

export interface UpdateCampSupplyItemRequest {
  packed_qty?: number;
  consumed_qty?: number;
  returned_qty?: number;
  shortage_notes?: string;
}

export interface ListAssetsParams {
  source_type?: string;
  source_id?: string;
  asset_domain?: string;
  asset_category_id?: string;
  camp_eligible?: boolean;
  available_only?: boolean;
  search?: string;
}

export interface CreateAssetCategoryRequest {
  code?: string;
  name: string;
  parent_id?: string | null;
  asset_domain: string;
  description?: string | null;
  regulatory_class?: string | null;
  default_pm_frequency?: string | null;
  default_calibration_frequency?: string | null;
  requires_pm?: boolean;
  requires_calibration?: boolean;
  is_camp_eligible?: boolean;
  sort_order?: number;
}

export type UpdateAssetCategoryRequest = Partial<CreateAssetCategoryRequest> & {
  is_active?: boolean;
};

export interface CreateStoreCategoryRequest {
  code?: string;
  name: string;
  parent_id?: string | null;
  store_domain: string;
  description?: string | null;
  requires_batch_tracking?: boolean;
  requires_expiry_tracking?: boolean;
  requires_temperature_log?: boolean;
  requires_license_tracking?: boolean;
  is_camp_source?: boolean;
  sort_order?: number;
}

export type UpdateStoreCategoryRequest = Partial<CreateStoreCategoryRequest> & {
  is_active?: boolean;
};

export interface UpsertAssetClassificationRequest {
  source_type: string;
  source_id: string;
  asset_category_id?: string | null;
  store_category_id?: string | null;
  asset_domain: string;
  criticality?: "critical" | "high" | "routine" | "low";
  custody_mode?: "asset_tagged" | "serialised" | "pooled" | "non_movable";
  is_camp_eligible?: boolean;
  tags?: string[];
  notes?: string | null;
}

export interface ListCampAssetCandidatesParams {
  source_type?: string;
  asset_domain?: string;
  asset_category_id?: string;
  search?: string;
  required_from?: string;
  required_to?: string;
}

export interface CreateCampAssetReservationRequest {
  source_type: string;
  source_id: string;
  asset_category_id?: string | null;
  required_from?: string | null;
  required_to?: string | null;
  quantity?: number;
  is_critical?: boolean;
  notes?: string | null;
}

export interface IssueCampAssetRequest {
  issued_to?: string | null;
  issue_condition?: string | null;
  notes?: string | null;
}

export interface ReturnCampAssetRequest {
  status?: "returned" | "damaged" | "lost";
  return_condition?: string | null;
  damage_notes?: string | null;
  loss_notes?: string | null;
  reconciliation_notes?: string | null;
  notes?: string | null;
}

export interface CreateCampReferralRequest {
  registration_id?: string;
  referred_to_facility: string;
  referral_department?: string;
  urgency?: CampReferral["urgency"];
  reason: string;
  transport_mode?: string;
  ambulance_required?: boolean;
  attendant_name?: string;
  attendant_phone?: string;
}

export interface UpdateCampReferralRequest {
  status?: CampReferral["status"];
  transport_mode?: string;
  attendant_name?: string;
  attendant_phone?: string;
}

export interface CreateCampIncidentRequest {
  registration_id?: string;
  incident_type: CampIncident["incident_type"];
  severity?: CampIncident["severity"];
  description: string;
  immediate_action?: string;
}

export interface UpdateCampIncidentRequest {
  status?: CampIncident["status"];
  immediate_action?: string;
}

export interface CreateCampRegistrationRequest {
  camp_id: string;
  person_name: string;
  age?: number;
  gender?: string;
  phone?: string;
  address?: string;
  id_proof_type?: string;
  id_proof_number?: string;
  patient_id?: string;
  clinical_department_id?: string;
  attending_doctor_id?: string;
  service_line?: string;
  chief_complaint?: string;
  is_walk_in?: boolean;
}

export interface UpdateCampRegistrationRequest {
  status?: string;
  patient_id?: string;
  chief_complaint?: string;
}

export interface CreateCampScreeningRequest {
  registration_id: string;
  bp_systolic?: number;
  bp_diastolic?: number;
  pulse_rate?: number;
  spo2?: number;
  temperature?: number;
  blood_sugar_random?: number;
  bmi?: number;
  height_cm?: number;
  weight_kg?: number;
  visual_acuity_left?: string;
  visual_acuity_right?: string;
  findings?: string;
  diagnosis?: string;
  advice?: string;
  referred_to_hospital?: boolean;
  referral_department?: string;
  referral_urgency?: string;
}

export interface CreateCampLabSampleRequest {
  registration_id: string;
  sample_type: string;
  test_requested: string;
  barcode?: string;
}

export interface LinkCampLabSampleRequest {
  lab_order_id: string;
  result_summary?: string;
}

export interface CreateCampBillingRequest {
  registration_id: string;
  service_description: string;
  standard_amount: number;
  discount_percentage?: number;
  charged_amount: number;
  tax_percent?: number;
  sponsor_covered_amount?: number;
  is_free?: boolean;
  payment_mode?: string;
  payment_reference?: string;
  source_module?: string;
  source_entity_id?: string;
}

export interface CreateCampFollowupRequest {
  registration_id: string;
  followup_date: string;
  followup_type: string;
  notes?: string;
}

export interface UpdateCampFollowupRequest {
  status?: string;
  notes?: string;
  outcome?: string;
  converted_to_patient?: boolean;
  converted_patient_id?: string;
  converted_department_id?: string;
}

export interface CampStatsResponse {
  total_registrations: number;
  screened: number;
  referred: number;
  converted: number;
  lab_samples: number;
  followups_scheduled: number;
  followups_completed: number;
  billing_total: number;
}

// ══════════════════════════════════════════════════════════════
//  Consent Management
// ══════════════════════════════════════════════════════════════

export type ConsentTemplateCategory =
  | "general"
  | "surgical"
  | "anesthesia"
  | "blood_transfusion"
  | "investigation"
  | "data_sharing"
  | "research"
  | "photography"
  | "teaching"
  | "refusal"
  | "advance_directive"
  | "organ_donation"
  | "communication"
  | "custom";

export type ConsentAuditAction =
  | "created"
  | "granted"
  | "denied"
  | "signed"
  | "refused"
  | "withdrawn"
  | "revoked"
  | "expired"
  | "renewed"
  | "amended";

export type ConsentSignatureType =
  | "pen_on_paper"
  | "digital_pen"
  | "aadhaar_esign"
  | "biometric_thumb"
  | "otp"
  | "video_consent"
  | "verbal_witness";

export interface ConsentTemplate {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  category: ConsentTemplateCategory;
  version: number;
  body_text: Record<string, string>;
  risks_section: Record<string, string> | null;
  alternatives_section: Record<string, string> | null;
  benefits_section: Record<string, string> | null;
  required_fields: string[];
  requires_witness: boolean;
  requires_doctor: boolean;
  validity_days: number | null;
  applicable_departments: string[] | null;
  is_read_aloud_required: boolean;
  is_active: boolean;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** List row — omits body_text + risks/alternatives/benefits sections (heavy JSONB). */
export interface ConsentTemplateListItem {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  category: ConsentTemplateCategory;
  version: number;
  required_fields: string[];
  requires_witness: boolean;
  requires_doctor: boolean;
  validity_days: number | null;
  applicable_departments: string[] | null;
  is_read_aloud_required: boolean;
  is_active: boolean;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConsentAuditEntry {
  id: string;
  tenant_id: string;
  patient_id: string;
  consent_source: string;
  consent_id: string;
  action: ConsentAuditAction;
  old_status: string | null;
  new_status: string | null;
  changed_by: string | null;
  change_reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ConsentSignatureMetadata {
  id: string;
  tenant_id: string;
  consent_source: string;
  consent_id: string;
  signature_type: ConsentSignatureType;
  signature_image_url: string | null;
  video_consent_url: string | null;
  aadhaar_esign_ref: string | null;
  aadhaar_esign_timestamp: string | null;
  biometric_hash: string | null;
  biometric_device_id: string | null;
  witness_name: string | null;
  witness_designation: string | null;
  witness_signature_url: string | null;
  doctor_signature_url: string | null;
  captured_at: string;
  captured_by: string | null;
  created_at: string;
}

export interface CreateConsentTemplateRequest {
  code: string;
  name: string;
  category?: ConsentTemplateCategory;
  version?: number;
  body_text?: Record<string, string>;
  risks_section?: Record<string, string>;
  alternatives_section?: Record<string, string>;
  benefits_section?: Record<string, string>;
  required_fields?: string[];
  requires_witness?: boolean;
  requires_doctor?: boolean;
  validity_days?: number;
  applicable_departments?: string[];
  is_read_aloud_required?: boolean;
  is_active?: boolean;
  sort_order?: number;
}

export interface UpdateConsentTemplateRequest {
  name?: string;
  category?: ConsentTemplateCategory;
  version?: number;
  body_text?: Record<string, string>;
  risks_section?: Record<string, string>;
  alternatives_section?: Record<string, string>;
  benefits_section?: Record<string, string>;
  required_fields?: string[];
  requires_witness?: boolean;
  requires_doctor?: boolean;
  validity_days?: number;
  applicable_departments?: string[];
  is_read_aloud_required?: boolean;
  is_active?: boolean;
  sort_order?: number;
}

export interface VerifyConsentRequest {
  patient_id: string;
  consent_type?: string;
  procedure_type?: string;
}

export interface VerifyConsentResponse {
  is_valid: boolean;
  consent_id: string | null;
  consent_source: string | null;
  expires_at: string | null;
}

export interface ConsentSummaryItem {
  consent_type: string;
  source: string;
  status: string;
  consent_id: string;
  valid_until: string | null;
}

export interface RevokeConsentRequest {
  consent_source: string;
  consent_id: string;
  patient_id: string;
  reason?: string;
}

export interface CreateConsentSignatureRequest {
  consent_source: string;
  consent_id: string;
  signature_type: ConsentSignatureType;
  signature_image_url?: string;
  video_consent_url?: string;
  aadhaar_esign_ref?: string;
  aadhaar_esign_timestamp?: string;
  biometric_hash?: string;
  biometric_device_id?: string;
  witness_name?: string;
  witness_designation?: string;
  witness_signature_url?: string;
  doctor_signature_url?: string;
}

// ══════════════════════════════════════════════════════════════
//  CSSD (Central Sterile Supply Department)
// ══════════════════════════════════════════════════════════════

export type InstrumentStatus =
  | "available"
  | "in_use"
  | "decontaminating"
  | "sterilizing"
  | "sterile"
  | "damaged"
  | "condemned";

export type SterilizationMethod = "steam" | "eto" | "plasma" | "dry_heat" | "flash";

export type IndicatorType = "chemical" | "biological";

export type LoadStatus = "loading" | "running" | "completed" | "failed";

export interface CssdSterilizer {
  id: string;
  tenant_id: string;
  name: string;
  model: string | null;
  serial_number: string | null;
  method: SterilizationMethod;
  chamber_size_liters: number | null;
  location: string | null;
  is_active: boolean;
  last_maintenance_at: string | null;
  next_maintenance_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CssdInstrument {
  id: string;
  tenant_id: string;
  barcode: string;
  name: string;
  category: string | null;
  manufacturer: string | null;
  status: InstrumentStatus;
  purchase_date: string | null;
  lifecycle_uses: number;
  max_uses: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CssdInstrumentSet {
  id: string;
  tenant_id: string;
  set_code: string;
  set_name: string;
  department: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CssdSetItem {
  id: string;
  tenant_id: string;
  set_id: string;
  instrument_id: string;
  quantity: number;
}

export interface CssdSterilizationLoad {
  id: string;
  tenant_id: string;
  load_number: string;
  sterilizer_id: string;
  method: SterilizationMethod;
  status: LoadStatus;
  operator_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  cycle_time_minutes: number | null;
  temperature_c: number | null;
  pressure_psi: number | null;
  is_flash: boolean;
  flash_reason: string | null;
  notes: string | null;
  created_at: string;
}

export interface CssdLoadItem {
  id: string;
  tenant_id: string;
  load_id: string;
  set_id: string | null;
  instrument_id: string | null;
  quantity: number;
  pack_expiry_date: string | null;
}

export interface CssdIndicatorResult {
  id: string;
  tenant_id: string;
  load_id: string;
  indicator_type: IndicatorType;
  indicator_brand: string | null;
  indicator_lot: string | null;
  result_pass: boolean;
  read_at: string;
  read_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface CssdIssuance {
  id: string;
  tenant_id: string;
  load_item_id: string | null;
  set_id: string | null;
  issued_to_department: string;
  issued_to_patient_id: string | null;
  issued_by: string | null;
  issued_at: string;
  returned_at: string | null;
  returned_by: string | null;
  is_recalled: boolean;
  recall_reason: string | null;
  notes: string | null;
  created_at: string;
}

export interface CssdMaintenanceLog {
  id: string;
  tenant_id: string;
  sterilizer_id: string;
  maintenance_type: string;
  performed_by: string | null;
  performed_at: string;
  next_due_at: string | null;
  findings: string | null;
  actions_taken: string | null;
  cost: number | null;
  notes: string | null;
  created_at: string;
}

export interface CreateCssdInstrumentRequest {
  barcode: string;
  name: string;
  category?: string;
  manufacturer?: string;
  purchase_date?: string;
  max_uses?: number;
  notes?: string;
}

export interface UpdateCssdInstrumentRequest {
  name?: string;
  category?: string;
  manufacturer?: string;
  status?: InstrumentStatus;
  max_uses?: number;
  notes?: string;
}

export interface CreateCssdSetRequest {
  set_code: string;
  set_name: string;
  department?: string;
  description?: string;
  items?: Array<{ instrument_id: string; quantity?: number }>;
}

export interface CreateCssdSterilizerRequest {
  name: string;
  model?: string;
  serial_number?: string;
  method?: SterilizationMethod;
  chamber_size_liters?: number;
  location?: string;
}

export interface UpdateCssdSterilizerRequest {
  name?: string;
  model?: string;
  serial_number?: string;
  method?: SterilizationMethod;
  chamber_size_liters?: number;
  location?: string;
  is_active?: boolean;
}

export interface CreateCssdLoadRequest {
  sterilizer_id: string;
  method: SterilizationMethod;
  is_flash?: boolean;
  flash_reason?: string;
  notes?: string;
}

export interface UpdateCssdLoadStatusRequest {
  status: LoadStatus;
  cycle_time_minutes?: number;
  temperature_c?: number;
  pressure_psi?: number;
}

export interface AddCssdLoadItemRequest {
  set_id?: string;
  instrument_id?: string;
  quantity?: number;
  pack_expiry_date?: string;
}

export interface RecordCssdIndicatorRequest {
  indicator_type: IndicatorType;
  indicator_brand?: string;
  indicator_lot?: string;
  result_pass: boolean;
  notes?: string;
}

export interface CreateCssdIssuanceRequest {
  load_item_id?: string;
  set_id?: string;
  issued_to_department: string;
  issued_to_patient_id?: string;
  notes?: string;
}

export interface CreateCssdMaintenanceRequest {
  maintenance_type: string;
  performed_by?: string;
  next_due_at?: string;
  findings?: string;
  actions_taken?: string;
  cost?: number;
  notes?: string;
}

// ══════════════════════════════════════════════════════════════
//  Diet & Kitchen
// ══════════════════════════════════════════════════════════════

export type DietType =
  | "regular"
  | "diabetic"
  | "renal"
  | "cardiac"
  | "liquid"
  | "soft"
  | "high_protein"
  | "low_sodium"
  | "npo"
  | "custom";
export type MealType =
  | "breakfast"
  | "morning_snack"
  | "lunch"
  | "afternoon_snack"
  | "dinner"
  | "bedtime_snack";
export type DietOrderStatus = "active" | "modified" | "completed" | "cancelled";
export type MealPrepStatus = "pending" | "preparing" | "ready" | "dispatched" | "delivered";

export interface DietTemplate {
  id: string;
  tenant_id: string;
  name: string;
  diet_type: DietType;
  description: string | null;
  calories_target: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sodium_mg: number | null;
  restrictions: string[];
  suitable_for: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DietOrder {
  id: string;
  tenant_id: string;
  patient_id: string;
  admission_id: string | null;
  template_id: string | null;
  diet_type: DietType;
  status: DietOrderStatus;
  ordered_by: string | null;
  special_instructions: string | null;
  allergies_flagged: string[];
  is_npo: boolean;
  npo_reason: string | null;
  start_date: string;
  end_date: string | null;
  calories_target: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface KitchenMenu {
  id: string;
  tenant_id: string;
  name: string;
  week_number: number | null;
  season: string | null;
  is_active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface KitchenMenuItem {
  id: string;
  tenant_id: string;
  menu_id: string;
  day_of_week: number;
  meal_type: MealType;
  diet_type: DietType;
  item_name: string;
  description: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  is_vegetarian: boolean;
  allergens: string[];
}

export interface MealPreparation {
  id: string;
  tenant_id: string;
  diet_order_id: string;
  meal_type: MealType;
  meal_date: string;
  status: MealPrepStatus;
  prepared_by: string | null;
  prepared_at: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  delivered_to_ward: string | null;
  delivered_to_bed: string | null;
  patient_feedback: string | null;
  feedback_rating: number | null;
  notes: string | null;
  created_at: string;
}

export interface MealCount {
  id: string;
  tenant_id: string;
  count_date: string;
  meal_type: MealType;
  ward: string;
  total_beds: number;
  occupied: number;
  npo_count: number;
  regular_count: number;
  special_count: number;
  notes: string | null;
  created_at: string;
}

export interface KitchenInventory {
  id: string;
  tenant_id: string;
  item_name: string;
  category: string | null;
  unit: string;
  current_stock: number;
  reorder_level: number | null;
  supplier: string | null;
  last_procured_at: string | null;
  expiry_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface KitchenAudit {
  id: string;
  tenant_id: string;
  audit_date: string;
  auditor_name: string;
  audit_type: string;
  temperature_log: Record<string, unknown>;
  hygiene_score: number | null;
  findings: string | null;
  corrective_actions: string | null;
  is_compliant: boolean;
  next_audit_date: string | null;
  attachments: string[];
  created_at: string;
}

export interface CreateDietTemplateRequest {
  name: string;
  diet_type?: DietType;
  description?: string;
  calories_target?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  fiber_g?: number;
  sodium_mg?: number;
  restrictions?: string[];
  suitable_for?: string[];
}

export interface UpdateDietTemplateRequest {
  name?: string;
  diet_type?: DietType;
  description?: string;
  calories_target?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  fiber_g?: number;
  sodium_mg?: number;
  restrictions?: string[];
  suitable_for?: string[];
  is_active?: boolean;
}

export interface CreateDietOrderRequest {
  patient_id: string;
  admission_id?: string;
  template_id?: string;
  diet_type?: DietType;
  special_instructions?: string;
  allergies_flagged?: string[];
  is_npo?: boolean;
  npo_reason?: string;
  start_date?: string;
  end_date?: string;
  calories_target?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  preferences?: Record<string, unknown>;
}

export interface UpdateDietOrderRequest {
  diet_type?: DietType;
  status?: DietOrderStatus;
  special_instructions?: string;
  is_npo?: boolean;
  npo_reason?: string;
  end_date?: string;
  calories_target?: number;
  preferences?: Record<string, unknown>;
}

export interface CreateKitchenMenuRequest {
  name: string;
  week_number?: number;
  season?: string;
  valid_from?: string;
  valid_until?: string;
}

export interface CreateMenuItemRequest {
  day_of_week: number;
  meal_type: MealType;
  diet_type?: DietType;
  item_name: string;
  description?: string;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  is_vegetarian?: boolean;
  allergens?: string[];
}

export interface CreateMealPrepRequest {
  diet_order_id: string;
  meal_type: MealType;
  meal_date?: string;
}

export interface UpdateMealPrepStatusRequest {
  status: MealPrepStatus;
  delivered_to_ward?: string;
  delivered_to_bed?: string;
  patient_feedback?: string;
  feedback_rating?: number;
  notes?: string;
}

export interface CreateMealCountRequest {
  count_date?: string;
  meal_type: MealType;
  ward: string;
  total_beds: number;
  occupied: number;
  npo_count?: number;
  regular_count?: number;
  special_count?: number;
  notes?: string;
}

export interface CreateKitchenInventoryRequest {
  item_name: string;
  category?: string;
  unit?: string;
  current_stock?: number;
  reorder_level?: number;
  supplier?: string;
  expiry_date?: string;
}

export interface UpdateKitchenInventoryRequest {
  item_name?: string;
  category?: string;
  unit?: string;
  current_stock?: number;
  reorder_level?: number;
  supplier?: string;
  expiry_date?: string;
  is_active?: boolean;
}

export interface CreateKitchenAuditRequest {
  audit_date?: string;
  auditor_name: string;
  audit_type?: string;
  temperature_log?: Record<string, unknown>;
  hygiene_score?: number;
  findings?: string;
  corrective_actions?: string;
  is_compliant?: boolean;
  next_audit_date?: string;
}

export interface ClientErrorReportRequest {
  route: string;
  name?: string;
  message: string;
  stack?: string;
  component_stack?: string;
  method?: string;
  source?: "ui" | "api" | "console";
  status?: number;
  user_agent?: string;
  occurred_at?: string;
}

export interface ClientErrorReportResponse {
  accepted: boolean;
  delivered_to_github: boolean;
  issue_number?: number;
}

// ══════════════════════════════════════════════════════════════
//  Integration Hub
// ══════════════════════════════════════════════════════════════

export type PipelineStatus = "draft" | "active" | "paused" | "archived";
export type ExecutionStatus = "pending" | "running" | "completed" | "failed" | "skipped";
export type PipelineTriggerType = "internal_event" | "schedule" | "webhook" | "manual";
export type PipelineNodeType = "trigger" | "condition" | "action" | "transform" | "delay";

export interface ReactFlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface ReactFlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
}

export interface IntegrationPipeline {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  description: string | null;
  status: PipelineStatus;
  trigger_type: PipelineTriggerType;
  trigger_config: Record<string, unknown>;
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
  metadata: Record<string, unknown>;
  version: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PipelineSummary {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: PipelineStatus;
  trigger_type: PipelineTriggerType;
  version: number;
  execution_count: number;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntegrationExecution {
  id: string;
  tenant_id: string;
  pipeline_id: string;
  pipeline_version: number;
  trigger_event: string | null;
  status: ExecutionStatus;
  input_data: Record<string, unknown>;
  output_data: Record<string, unknown>;
  node_results: Record<string, unknown>;
  error: string | null;
  triggered_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface IntegrationNodeTemplate {
  id: string;
  tenant_id: string | null;
  node_type: PipelineNodeType;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  category: string | null;
  config_schema: Record<string, unknown>;
  default_config: Record<string, unknown>;
  output_schema: { fields?: SchemaField[] } & Record<string, unknown>;
  input_schema?: { fields?: SchemaField[] } & Record<string, unknown>;
  is_system: boolean;
  created_at: string;
}

export interface PipelineListResponse {
  pipelines: PipelineSummary[];
  total: number;
  page: number;
  per_page: number;
}

export interface ExecutionListResponse {
  executions: IntegrationExecution[];
  total: number;
  page: number;
  per_page: number;
}

export interface CreatePipelineRequest {
  name: string;
  code: string;
  description?: string;
  trigger_type: PipelineTriggerType;
  trigger_config?: Record<string, unknown>;
  nodes?: ReactFlowNode[];
  edges?: ReactFlowEdge[];
  metadata?: Record<string, unknown>;
}

export interface UpdatePipelineRequest {
  name?: string;
  description?: string;
  trigger_type?: PipelineTriggerType;
  trigger_config?: Record<string, unknown>;
  nodes?: ReactFlowNode[];
  edges?: ReactFlowEdge[];
  metadata?: Record<string, unknown>;
}

export interface UpdatePipelineStatusRequest {
  status: PipelineStatus;
}

export interface TriggerPipelineRequest {
  input_data?: Record<string, unknown>;
}
