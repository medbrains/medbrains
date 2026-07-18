// MRD form print-data types — split from index.ts, barrel-re-exported.

// ── MRD Form Print Data ─────────────────────────────────

export interface VitalSignsBlock {
  temperature: string | null;
  pulse: string | null;
  bp_systolic: string | null;
  bp_diastolic: string | null;
  respiratory_rate: string | null;
  spo2: string | null;
  pain_score: string | null;
}

export interface IoBalanceBlock {
  intake_oral: string | null;
  intake_iv: string | null;
  intake_other: string | null;
  output_urine: string | null;
  output_drain: string | null;
  output_other: string | null;
  balance: string | null;
}

export interface ProgressNotePrintData {
  patient_name: string;
  uhid: string;
  age: string | null;
  gender: string;
  admission_date: string;
  bed_number: string | null;
  ward_name: string | null;
  diagnosis: string | null;
  note_date: string;
  note_time: string | null;
  shift: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  vital_signs: VitalSignsBlock | null;
  io_balance: IoBalanceBlock | null;
  doctor_name: string;
  doctor_signature: string | null;
}

export interface NursingAssessmentPrintData {
  patient_name: string;
  uhid: string;
  age: string | null;
  gender: string;
  admission_date: string;
  bed_number: string | null;
  ward_name: string | null;
  assessment_date: string;
  assessment_time: string;
  shift: string;
  chief_complaint: string | null;
  history: string | null;
  allergies: string[];
  vital_signs: VitalSignsBlock;
  consciousness_level: string | null;
  pain_assessment: string | null;
  skin_integrity: string | null;
  mobility_status: string | null;
  fall_risk_score: number | null;
  braden_score: number | null;
  nutritional_status: string | null;
  iv_lines: string[];
  drains_tubes: string[];
  nursing_diagnosis: string[];
  care_plan: string | null;
  nurse_name: string;
  nurse_signature: string | null;
}

export interface MarAdministration {
  scheduled_time: string;
  actual_time: string | null;
  given_by: string | null;
  status: string;
  notes: string | null;
}

export interface MarMedicationRow {
  drug_name: string;
  dose: string;
  route: string;
  frequency: string;
  scheduled_times: string[];
  administrations: MarAdministration[];
}

export interface MarPrintData {
  patient_name: string;
  uhid: string;
  age: string | null;
  gender: string;
  bed_number: string | null;
  ward_name: string | null;
  allergies: string[];
  chart_date: string;
  medications: MarMedicationRow[];
}

export interface VitalReading {
  recorded_at: string;
  shift: string | null;
  temperature: string | null;
  pulse: string | null;
  bp_systolic: string | null;
  bp_diastolic: string | null;
  respiratory_rate: string | null;
  spo2: string | null;
  pain_score: string | null;
  recorded_by: string | null;
}

export interface VitalsChartPrintData {
  patient_name: string;
  uhid: string;
  age: string | null;
  gender: string;
  bed_number: string | null;
  ward_name: string | null;
  chart_date: string;
  readings: VitalReading[];
}

export interface IoEntry {
  recorded_at: string;
  shift: string | null;
  intake_oral: number | null;
  intake_iv: number | null;
  intake_ng: number | null;
  intake_other: number | null;
  output_urine: number | null;
  output_vomit: number | null;
  output_drain: number | null;
  output_stool: number | null;
  output_other: number | null;
  recorded_by: string | null;
}

export interface IoTotals {
  total_intake: number;
  total_output: number;
  balance: number;
}

export interface IoChartPrintData {
  patient_name: string;
  uhid: string;
  age: string | null;
  gender: string;
  bed_number: string | null;
  ward_name: string | null;
  chart_date: string;
  entries: IoEntry[];
  daily_totals: IoTotals;
}

export interface ChecklistItem {
  category: string;
  item: string;
  completed: boolean;
  completed_by: string | null;
  completed_at: string | null;
  notes: string | null;
}

export interface FollowUpItem {
  department: string;
  doctor_name: string | null;
  recommended_date: string;
  reason: string | null;
}

export interface DischargeChecklistPrintData {
  patient_name: string;
  uhid: string;
  age: string | null;
  gender: string;
  admission_date: string;
  expected_discharge_date: string;
  bed_number: string | null;
  ward_name: string | null;
  diagnosis: string | null;
  discharge_type: string | null;
  checklist_items: ChecklistItem[];
  discharge_medications: string[];
  follow_up_appointments: FollowUpItem[];
  patient_education_completed: boolean;
  discharge_summary_ready: boolean;
  final_bill_settled: boolean;
  verified_by: string | null;
  verified_at: string | null;
}
