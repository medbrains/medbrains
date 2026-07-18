// Care view / ward dashboard types — split from index.ts, barrel-re-exported.

// ── Care View / Ward Dashboard ──────────────────────────

export interface PatientCardRow {
  admission_id: string;
  patient_id: string;
  encounter_id: string;
  patient_name: string;
  uhid: string;
  bed_id: string | null;
  bed_name: string | null;
  ward_id: string | null;
  ward_name: string | null;
  is_critical: boolean;
  isolation_required: boolean;
  ip_type: string | null;
  admitting_doctor_name: string | null;
  primary_nurse_name: string | null;
  pending_tasks: number;
  overdue_tasks: number;
  pending_meds: number;
  overdue_meds: number;
  vitals_due: boolean;
  fall_risk_level: string | null;
  latest_news2_score: number | null;
  active_clinical_docs: number;
  expected_discharge_date: string | null;
}

export interface WardSummary {
  total_beds: number;
  occupied: number;
  critical_count: number;
  isolation_count: number;
  pending_discharges: number;
  overdue_tasks_total: number;
}

export interface WardGridResponse {
  patients: PatientCardRow[];
  summary: WardSummary;
}

export interface NurseTaskItem {
  task_id: string;
  admission_id: string;
  patient_name: string;
  bed_name: string | null;
  description: string;
  category: string | null;
  priority: string;
  due_at: string | null;
  is_overdue: boolean;
}

export interface MedAdminItem {
  mar_id: string;
  admission_id: string;
  patient_name: string;
  bed_name: string | null;
  drug_name: string;
  dose: string;
  route: string;
  scheduled_at: string;
  is_overdue: boolean;
  is_high_alert: boolean;
}

export interface MyTasksResponse {
  nursing_tasks: NurseTaskItem[];
  medication_tasks: MedAdminItem[];
}

export interface VitalsChecklistRow {
  admission_id: string;
  patient_name: string;
  bed_name: string | null;
  last_vitals_at: string | null;
  hours_since_last: number | null;
  vitals_due: boolean;
}

export interface HandoverSummaryPatient {
  admission_id: string;
  patient_name: string;
  bed_name: string | null;
  is_critical: boolean;
  isolation_required: boolean;
  provisional_diagnosis: string | null;
  pending_tasks: string[];
  pending_meds: string[];
  active_clinical_docs: string[];
}

export interface HandoverSummaryResponse {
  ward_name: string;
  shift: string;
  patients: HandoverSummaryPatient[];
  total_patients: number;
  critical_count: number;
}

export interface DischargeReadinessRow {
  admission_id: string;
  patient_name: string;
  uhid: string;
  bed_name: string | null;
  ward_name: string | null;
  expected_discharge_date: string | null;
  billing_cleared: boolean;
  pharmacy_cleared: boolean;
  nursing_cleared: boolean;
  doctor_cleared: boolean;
  pending_lab_count: number;
  readiness_pct: number;
}

export interface UpdatePrimaryNurseRequest {
  primary_nurse_id: string | null;
}

// ══════════════════════════════════════════════════════════
//  Chronic Care / Drug-o-gram
// ══════════════════════════════════════════════════════════

export type ChronicProgramType =
  | "tb_dots"
  | "hiv_art"
  | "diabetes"
  | "hypertension"
  | "ckd"
  | "copd"
  | "asthma"
  | "cancer_chemo"
  | "mental_health"
  | "epilepsy"
  | "thyroid"
  | "rheumatic"
  | "other";

export type EnrollmentStatus =
  | "active"
  | "completed"
  | "discontinued"
  | "transferred"
  | "lost_to_followup"
  | "deceased";

export type MedicationEventType =
  | "started"
  | "dose_changed"
  | "switched"
  | "discontinued"
  | "resumed"
  | "held";

export type AdherenceEventType =
  | "dose_taken"
  | "dose_missed"
  | "dose_late"
  | "refill_on_time"
  | "refill_late"
  | "refill_missed"
  | "appointment_attended"
  | "appointment_missed"
  | "appointment_rescheduled";

export interface ChronicProgram {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  program_type: ChronicProgramType;
  description: string | null;
  protocol_id: string | null;
  default_duration_months: number | null;
  target_outcomes: unknown[];
  monitoring_schedule: unknown[];
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ChronicEnrollmentRow {
  id: string;
  patient_id: string;
  program_id: string;
  patient_name: string;
  uhid: string;
  program_name: string;
  program_type: string;
  enrollment_date: string;
  expected_end_date: string | null;
  actual_end_date: string | null;
  status: EnrollmentStatus;
  status_reason: string | null;
  primary_doctor_name: string | null;
  icd_code: string | null;
  notes: string | null;
  target_overrides: unknown | null;
  created_at: string;
}

export interface MedicationTimelineEvent {
  id: string;
  event_type: MedicationEventType;
  drug_name: string;
  generic_name: string | null;
  atc_code: string | null;
  dosage: string | null;
  frequency: string | null;
  route: string | null;
  previous_dosage: string | null;
  previous_frequency: string | null;
  change_reason: string | null;
  switched_from_drug: string | null;
  effective_date: string;
  end_date: string | null;
  ordered_by_name: string;
  is_auto_generated: boolean;
  enrollment_id: string | null;
  created_at: string;
}

export interface LabTimelinePoint {
  result_id: string;
  parameter_name: string;
  value: string;
  numeric_value: number | null;
  unit: string | null;
  flag: string | null;
  result_date: string;
  loinc_code: string | null;
}

export interface LabSeriesGroup {
  parameter_name: string;
  loinc_code: string | null;
  unit: string | null;
  target_value: number | null;
  data_points: LabTimelinePoint[];
}

export interface VitalTimelinePoint {
  id: string;
  parameter: string;
  value: string;
  numeric_value: number | null;
  recorded_at: string;
}

export interface ActiveDrugRow {
  drug_name: string;
  generic_name: string | null;
  dosage: string | null;
  frequency: string | null;
  route: string | null;
  started_date: string;
}

export interface DrugTimelineWithLabsResponse {
  medication_events: MedicationTimelineEvent[];
  lab_series: LabSeriesGroup[];
  vitals_series: VitalTimelinePoint[];
  active_drugs: ActiveDrugRow[];
}

export interface AdherenceRow {
  id: string;
  event_type: AdherenceEventType;
  event_date: string;
  drug_name: string | null;
  recorded_by_name: string;
  notes: string | null;
  created_at: string;
}

export interface MonthlyAdherence {
  month: string;
  taken: number;
  missed: number;
  late: number;
}

export interface AdherenceSummaryResponse {
  doses_taken: number;
  doses_missed: number;
  doses_late: number;
  dose_adherence_pct: number;
  refills_on_time: number;
  refills_late: number;
  refills_missed: number;
  appointments_attended: number;
  appointments_missed: number;
  appointments_rescheduled: number;
  by_month: MonthlyAdherence[];
}

export interface PatientOutcomeTarget {
  id: string;
  parameter_name: string;
  loinc_code: string | null;
  target_value: number;
  unit: string;
  comparison: string;
  effective_from: string;
  notes: string | null;
  enrollment_id: string | null;
}

export interface OutcomeTargetWithActual {
  target: PatientOutcomeTarget;
  latest_value: number | null;
  latest_date: string | null;
  at_target: boolean | null;
}

export interface OutcomeDashboardResponse {
  targets: OutcomeTargetWithActual[];
  adherence_rate: number | null;
  enrollment_duration_days: number | null;
  active_enrollments: number;
}

export interface PolypharmacyInteractionAlert {
  id: string;
  drug_a_name: string;
  drug_b_name: string;
  severity: string;
  description: string | null;
  management: string | null;
  status: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  override_reason: string | null;
  detected_at: string;
}

export interface DiagnosisSummaryItem {
  diagnosis_name: string;
  icd_code: string | null;
  diagnosed_date: string | null;
}

export interface ChronicEnrollmentSummary {
  program_name: string;
  enrollment_date: string;
  status: string;
}

export interface TreatmentSummaryResponse {
  patient_name: string;
  uhid: string;
  date_of_birth: string | null;
  gender: string | null;
  active_diagnoses: DiagnosisSummaryItem[];
  current_medications: ActiveDrugRow[];
  lab_trends: LabSeriesGroup[];
  targets: OutcomeTargetWithActual[];
  adherence_rate: number | null;
  enrollments: ChronicEnrollmentSummary[];
}
