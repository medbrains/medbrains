// Maternity / OB-GYN types — split from index.ts, barrel-re-exported.

// ── Maternity / OB-GYN ──

export type AncRiskCategory = "low" | "moderate" | "high" | "very_high";

export type DeliveryType =
  | "normal_vaginal"
  | "assisted_vaginal"
  | "lscs_elective"
  | "lscs_emergency"
  | "breech";

export type LaborStage = "first_latent" | "first_active" | "second" | "third" | "completed";

export interface MaternityRegistration {
  id: string;
  tenant_id: string;
  patient_id: string;
  registration_number: string;
  lmp_date: string | null;
  edd_date: string | null;
  gravida: number;
  para: number;
  abortion: number;
  living: number;
  risk_category: AncRiskCategory;
  blood_group: string | null;
  is_high_risk: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateMaternityRegistrationRequest {
  patient_id: string;
  registration_number: string;
  lmp_date?: string;
  edd_date?: string;
  gravida?: number;
  para?: number;
  abortion?: number;
  living?: number;
  risk_category?: AncRiskCategory;
  blood_group?: string;
}

export interface AncVisit {
  id: string;
  tenant_id: string;
  registration_id: string;
  visit_number: number;
  gestational_weeks: number | null;
  weight_kg: number | null;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  fundal_height_cm: number | null;
  fetal_heart_rate: number | null;
  hemoglobin: number | null;
  pcpndt_form_f_filed: boolean;
  pcpndt_form_f_number: string | null;
  examined_by: string;
  created_at: string;
}

export interface CreateAncVisitRequest {
  visit_number: number;
  gestational_weeks?: number;
  weight_kg?: number;
  bp_systolic?: number;
  bp_diastolic?: number;
  fundal_height_cm?: number;
  fetal_heart_rate?: number;
  hemoglobin?: number;
  pcpndt_form_f_filed?: boolean;
  pcpndt_form_f_number?: string;
  examined_by: string;
}

export interface LaborRecord {
  id: string;
  tenant_id: string;
  registration_id: string;
  admission_id: string | null;
  labor_onset_time: string | null;
  current_stage: LaborStage;
  partograph_data: Record<string, unknown> | null;
  cervical_dilation_log: Record<string, unknown> | null;
  delivery_type: DeliveryType | null;
  apgar_1min: number | null;
  apgar_5min: number | null;
  baby_weight_gm: number | null;
  pph_severity: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateLaborRecordRequest {
  admission_id?: string;
  labor_onset_time?: string;
  current_stage?: LaborStage;
  partograph_data?: Record<string, unknown>;
}

export interface CreateNewbornResponse {
  newborn: NewbornRecord;
  anti_d_required: boolean;
}

export interface NewbornRecord {
  id: string;
  tenant_id: string;
  labor_id: string;
  birth_date: string;
  gender: string;
  weight_gm: number;
  apgar_1min: number | null;
  apgar_5min: number | null;
  vaccinations_given: Record<string, unknown> | null;
  nicu_admission_needed: boolean;
  birth_certificate_number: string | null;
  mother_id: string | null;
  id_band_number: string | null;
  created_at: string;
}

export interface CreateNewbornRecordRequest {
  birth_date: string;
  gender: string;
  weight_gm: number;
  apgar_1min?: number;
  apgar_5min?: number;
  vaccinations_given?: Record<string, unknown>;
  nicu_admission_needed?: boolean;
  birth_certificate_number?: string;
  id_band_number?: string;
}

export interface VerifyNewbornIdentityRequest {
  scanned_mother_uhid: string;
  scanned_band?: string;
}

export interface VerifyNewbornIdentityResult {
  mother_match: boolean;
  band_match: boolean | null;
  mother_uhid: string | null;
  verified: boolean;
}

export interface PostnatalRecord {
  id: string;
  tenant_id: string;
  registration_id: string;
  day_postpartum: number;
  mother_vitals: Record<string, unknown> | null;
  baby_vitals: Record<string, unknown> | null;
  baby_weight_gm: number | null;
  created_at: string;
}

export interface CreatePostnatalRecordRequest {
  day_postpartum: number;
  mother_vitals?: Record<string, unknown>;
  baby_vitals?: Record<string, unknown>;
  baby_weight_gm?: number;
}
