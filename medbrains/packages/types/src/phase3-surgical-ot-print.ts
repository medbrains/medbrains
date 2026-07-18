// Phase-3 surgical & OT print-data types — split from index.ts, barrel-re-exported.

// ── Phase 3: Surgical & OT Print Data ──────────────────────────

export interface CaseSheetCoverPrintData {
  patient_name: string;
  uhid: string;
  age: string | null;
  age_display: string;
  gender: string;
  admission_number: string;
  admission_date: string;
  ward_name: string;
  bed_number: string;
  attending_doctor: string;
  department: string;
  provisional_diagnosis: string | null;
  final_diagnosis: string | null;
  primary_diagnosis: string | null;
  secondary_diagnoses: string[];
  allergies: string[];
  blood_group: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  insurance_provider: string | null;
  policy_number: string | null;
  hospital_name: string;
  hospital_logo_url: string | null;
}

export interface PreopVitals {
  bp_systolic: number | null;
  bp_diastolic: number | null;
  pulse: number | null;
  temperature: number | null;
  spo2: number | null;
  respiratory_rate: number | null;
}

export interface PreopLabResult {
  test_name: string;
  value: string;
  unit: string | null;
  reference_range: string | null;
  is_abnormal: boolean;
}

export interface PreopAssessmentPrintData {
  patient_name: string;
  uhid: string;
  age_display: string;
  gender: string;
  admission_number: string;
  surgery_name: string | null;
  surgery_date: string | null;
  surgeon_name: string | null;
  anesthesiologist: string | null;
  asa_class: string | null;
  vitals: PreopVitals;
  height_cm: number | null;
  weight_kg: number | null;
  bmi: number | null;
  allergies: string[];
  current_medications: string[];
  past_surgeries: string[];
  comorbidities: string[];
  airway_assessment: string | null;
  mallampati_score: string | null;
  cardiac_clearance: boolean;
  pulmonary_clearance: boolean;
  renal_clearance: boolean;
  lab_results: PreopLabResult[];
  blood_arranged: boolean;
  blood_units: number | null;
  consent_signed: boolean;
  fasting_hours: number | null;
  special_instructions: string | null;
  assessed_by: string | null;
  assessed_at: string | null;
  hospital_name: string;
  hospital_logo_url: string | null;
}

export interface SurgicalSignIn {
  patient_identity_confirmed: boolean;
  site_marked: boolean;
  anesthesia_safety_check: boolean;
  pulse_oximeter_functioning: boolean;
  known_allergy: boolean;
  allergy_details: string | null;
  difficult_airway_risk: boolean;
  airway_equipment_available: boolean;
  blood_loss_risk: boolean;
  blood_products_available: boolean;
  completed_at: string | null;
  completed_by: string | null;
}

export interface SurgicalTimeOut {
  team_introduction_done: boolean;
  patient_name_confirmed: boolean;
  procedure_confirmed: boolean;
  site_confirmed: boolean;
  antibiotics_given: boolean;
  antibiotics_time: string | null;
  critical_steps_reviewed: boolean;
  equipment_issues_addressed: boolean;
  imaging_displayed: boolean;
  completed_at: string | null;
  completed_by: string | null;
}

export interface SurgicalSignOut {
  procedure_recorded: boolean;
  instrument_count_correct: boolean;
  sponge_count_correct: boolean;
  specimen_labeled: boolean;
  equipment_issues_documented: boolean;
  recovery_concerns_addressed: boolean;
  completed_at: string | null;
  completed_by: string | null;
}

export interface SurgicalSafetyChecklistPrintData {
  patient_name: string;
  uhid: string;
  surgery_name: string | null;
  surgery_date: string | null;
  surgeon_name: string | null;
  anesthesiologist: string | null;
  scrub_nurse: string | null;
  circulating_nurse: string | null;
  ot_room: string | null;
  sign_in: SurgicalSignIn;
  time_out: SurgicalTimeOut;
  sign_out: SurgicalSignOut;
  hospital_name: string;
  hospital_logo_url: string | null;
}

export interface AnesthesiaDrug {
  drug_name: string;
  dose: string;
  route: string;
  time_given: string;
}

export interface AnesthesiaVitalEntry {
  recorded_at: string;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  heart_rate: number | null;
  spo2: number | null;
  etco2: number | null;
  respiratory_rate: number | null;
  temperature: number | null;
}

export interface FluidEntry {
  fluid_name: string;
  volume_ml: number;
  time_given: string;
}

export interface BloodProductEntry {
  product_type: string;
  unit_number: string;
  volume_ml: number;
  time_given: string;
}

export interface AnesthesiaRecordPrintData {
  patient_name: string;
  uhid: string;
  age_display: string;
  gender: string;
  weight_kg: number | null;
  height_cm: number | null;
  surgery_name: string | null;
  surgery_date: string | null;
  surgeon_name: string | null;
  anesthesiologist: string | null;
  anesthesia_assistant: string | null;
  asa_class: string | null;
  anesthesia_type: string | null;
  anesthesia_start: string | null;
  anesthesia_end: string | null;
  surgery_start: string | null;
  surgery_end: string | null;
  preop_diagnosis: string | null;
  airway_management: string | null;
  airway_device: string | null;
  tube_size: string | null;
  intubation_attempts: number | null;
  drugs_administered: AnesthesiaDrug[];
  vital_entries: AnesthesiaVitalEntry[];
  fluids_given: FluidEntry[];
  blood_products: BloodProductEntry[];
  estimated_blood_loss_ml: number | null;
  urine_output_ml: number | null;
  complications: string[];
  postop_instructions: string | null;
  transfer_destination: string | null;
  hospital_name: string;
  hospital_logo_url: string | null;
}

export interface OperationNotesPrintData {
  patient_name: string;
  uhid: string;
  age_display: string;
  gender: string;
  admission_number: string;
  surgery_date: string | null;
  surgery_start: string | null;
  surgery_end: string | null;
  ot_room: string | null;
  surgeon_name: string | null;
  assistant_surgeons: string[];
  anesthesiologist: string | null;
  scrub_nurse: string | null;
  preop_diagnosis: string | null;
  postop_diagnosis: string | null;
  procedure_name: string | null;
  procedure_code: string | null;
  laterality: string | null;
  anesthesia_type: string | null;
  position: string | null;
  incision: string | null;
  findings: string | null;
  procedure_details: string | null;
  specimens_sent: string[];
  drains_placed: string[];
  implants_used: string[];
  estimated_blood_loss_ml: number | null;
  complications: string | null;
  postop_instructions: string | null;
  dictated_by: string | null;
  dictated_at: string | null;
  hospital_name: string;
  hospital_logo_url: string | null;
}

export interface PostopFluidOrder {
  fluid_name: string;
  rate_ml_hr: number;
  duration_hours: number;
}

export interface PostopMedicationOrder {
  drug_name: string;
  dose: string;
  route: string;
  frequency: string;
  duration: string | null;
  special_instructions: string | null;
}

export interface PostopOrdersPrintData {
  patient_name: string;
  uhid: string;
  ward_name: string | null;
  bed_number: string | null;
  surgery_name: string | null;
  surgery_date: string | null;
  surgeon_name: string | null;
  postop_diagnosis: string | null;
  diet_orders: string | null;
  activity_orders: string | null;
  position_orders: string | null;
  fluid_orders: PostopFluidOrder[];
  medication_orders: PostopMedicationOrder[];
  monitoring_orders: string[];
  drain_care: string[];
  wound_care: string | null;
  catheter_care: string | null;
  vte_prophylaxis: string | null;
  pain_management: string | null;
  labs_to_order: string[];
  imaging_to_order: string[];
  notify_conditions: string[];
  special_instructions: string | null;
  ordered_by: string | null;
  ordered_at: string | null;
  hospital_name: string;
  hospital_logo_url: string | null;
}

export interface TransfusionVitals {
  bp_systolic: number | null;
  bp_diastolic: number | null;
  pulse: number | null;
  temperature: number | null;
  spo2: number | null;
  respiratory_rate: number | null;
}

export interface TransfusionMonitoringEntry {
  recorded_at: string;
  vitals: TransfusionVitals;
  volume_transfused_ml: number;
  adverse_reaction: boolean;
  reaction_details: string | null;
  recorded_by: string | null;
}

export interface TransfusionMonitoringPrintData {
  patient_name: string;
  uhid: string;
  ward_name: string | null;
  bed_number: string | null;
  blood_group: string | null;
  rh_type: string | null;
  product_type: string | null;
  unit_number: string | null;
  donation_date: string | null;
  expiry_date: string | null;
  volume_ml: number | null;
  crossmatch_compatible: boolean;
  consent_obtained: boolean;
  indication: string | null;
  ordered_by: string | null;
  transfusion_start: string | null;
  transfusion_end: string | null;
  pre_transfusion_vitals: TransfusionVitals | null;
  monitoring_entries: TransfusionMonitoringEntry[];
  post_transfusion_vitals: TransfusionVitals | null;
  total_volume_transfused_ml: number | null;
  complications: string[];
  transfusion_nurse: string | null;
  hospital_name: string;
  hospital_logo_url: string | null;
}
