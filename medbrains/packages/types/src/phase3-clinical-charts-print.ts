// Phase-3 clinical-charts print-data types — split from index.ts, barrel-re-exported.

// ── Phase 3: Clinical Charts Print Data ──────────────────────────

export interface FluidIntakeEntry {
  recorded_at: string;
  source: string;
  volume_ml: number;
  recorded_by: string | null;
}

export interface FluidOutputEntry {
  recorded_at: string;
  source: string;
  volume_ml: number;
  recorded_by: string | null;
}

export interface FluidBalanceChartPrintData {
  patient_name: string;
  uhid: string;
  ward_name: string | null;
  bed_number: string | null;
  chart_date: string;
  intake_entries: FluidIntakeEntry[];
  output_entries: FluidOutputEntry[];
  total_intake_ml: number;
  total_output_ml: number;
  net_balance_ml: number;
  previous_balance_ml: number | null;
  cumulative_balance_ml: number | null;
  target_intake_ml: number | null;
  target_output_ml: number | null;
  fluid_restriction: string | null;
  special_instructions: string | null;
  hospital_name: string;
  hospital_logo_url: string | null;
}

export interface PainAssessmentEntry {
  assessed_at: string;
  pain_score: number;
  pain_location: string | null;
  pain_character: string | null;
  intervention: string | null;
  reassessment_score: number | null;
  assessed_by: string | null;
}

export interface PainAssessmentPrintData {
  patient_name: string;
  uhid: string;
  age_display: string;
  ward_name: string | null;
  bed_number: string | null;
  assessment_date: string;
  pain_scale_used: string;
  assessments: PainAssessmentEntry[];
  current_pain_management: string | null;
  prn_medications: string[];
  non_pharmacological_interventions: string[];
  pain_goals: string | null;
  special_considerations: string | null;
  hospital_name: string;
  hospital_logo_url: string | null;
}

export interface FallRiskAssessmentPrintData {
  patient_name: string;
  uhid: string;
  age_display: string;
  ward_name: string | null;
  bed_number: string | null;
  assessed_at: string;
  fall_history: boolean;
  fall_history_score: number;
  secondary_diagnosis: boolean;
  secondary_diagnosis_score: number;
  ambulatory_aid: string | null;
  ambulatory_aid_score: number;
  iv_heparin_lock: boolean;
  iv_heparin_lock_score: number;
  gait: string | null;
  gait_score: number;
  mental_status: string | null;
  mental_status_score: number;
  total_score: number;
  risk_level: string;
  interventions_required: string[];
  bed_alarm_required: boolean;
  one_to_one_required: boolean;
  mobility_aids: string[];
  assessed_by: string | null;
  hospital_name: string;
  hospital_logo_url: string | null;
}

export interface SkinAssessmentEntry {
  body_area: string;
  condition: string;
  moisture: string | null;
  wound_present: boolean;
  wound_stage: string | null;
  notes: string | null;
}

export interface PressureUlcerRiskPrintData {
  patient_name: string;
  uhid: string;
  age_display: string;
  ward_name: string | null;
  bed_number: string | null;
  assessed_at: string;
  sensory_perception: string;
  sensory_perception_score: number;
  moisture: string;
  moisture_score: number;
  activity: string;
  activity_score: number;
  mobility: string;
  mobility_score: number;
  nutrition: string;
  nutrition_score: number;
  friction_shear: string;
  friction_shear_score: number;
  total_score: number;
  risk_level: string;
  skin_assessments: SkinAssessmentEntry[];
  interventions_required: string[];
  repositioning_schedule: string | null;
  special_mattress_required: boolean;
  nutritional_consult: boolean;
  assessed_by: string | null;
  hospital_name: string;
  hospital_logo_url: string | null;
}

export interface GcsEntry {
  assessed_at: string;
  eye_response: number;
  verbal_response: number;
  motor_response: number;
  total_score: number;
  pupil_left_size: number | null;
  pupil_left_reaction: string | null;
  pupil_right_size: number | null;
  pupil_right_reaction: string | null;
  assessed_by: string | null;
}

export interface GcsChartPrintData {
  patient_name: string;
  uhid: string;
  age_display: string;
  ward_name: string | null;
  bed_number: string | null;
  primary_diagnosis: string | null;
  chart_date: string;
  entries: GcsEntry[];
  baseline_gcs: number | null;
  current_gcs: number | null;
  trend: string | null;
  neuro_observations: string | null;
  notify_physician_if: string | null;
  hospital_name: string;
  hospital_logo_url: string | null;
}

export interface TransfusionRequisitionPrintData {
  patient_name: string;
  uhid: string;
  age_display: string;
  gender: string;
  ward_name: string | null;
  bed_number: string | null;
  blood_group: string | null;
  rh_type: string | null;
  diagnosis: string | null;
  indication: string | null;
  product_requested: string;
  units_requested: number;
  urgency: string;
  hemoglobin_level: number | null;
  platelet_count: number | null;
  inr: number | null;
  previous_transfusions: number | null;
  previous_reactions: boolean;
  reaction_details: string | null;
  special_requirements: string[];
  consent_signed: boolean;
  sample_collected_at: string | null;
  sample_collected_by: string | null;
  requested_by: string | null;
  requested_at: string | null;
  hospital_name: string;
  hospital_logo_url: string | null;
}
