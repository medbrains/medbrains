// Cath lab types — split from index.ts, barrel-re-exported.

// ── Cath Lab ──

export type CathProcedureType =
  | "diagnostic_cath"
  | "pci"
  | "pacemaker"
  | "icd"
  | "eps"
  | "ablation"
  | "valve_intervention"
  | "structural"
  | "peripheral";

export type StemiPathwayStatus =
  | "door"
  | "ecg"
  | "cath_lab_activation"
  | "arterial_access"
  | "balloon_inflation"
  | "completed";

export type HemodynamicSite =
  | "aorta"
  | "lv"
  | "rv"
  | "ra"
  | "la"
  | "pa"
  | "pcwp"
  | "svg"
  | "lm"
  | "lad"
  | "lcx"
  | "rca"
  | "other";

export type CathDeviceType =
  | "stent"
  | "balloon"
  | "guidewire"
  | "catheter"
  | "closure_device"
  | "pacemaker"
  | "icd"
  | "lead"
  | "other";

/** Ophthalmology — a comprehensive eye exam. Per-eye: OD = right, OS = left. */
export interface OphthoExam {
  id: string;
  tenant_id: string;
  patient_id: string;
  encounter_id: string | null;
  visual_acuity_od: string | null;
  visual_acuity_os: string | null;
  sphere_od: string | null;
  sphere_os: string | null;
  cylinder_od: string | null;
  cylinder_os: string | null;
  axis_od: number | null;
  axis_os: number | null;
  iop_od: string | null;
  iop_os: string | null;
  slit_lamp: string | null;
  fundus: string | null;
  diagnosis: string | null;
  plan: string | null;
  examined_by: string | null;
  examined_at: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CreateOphthoExamRequest {
  patient_id: string;
  encounter_id?: string | null;
  visual_acuity_od?: string | null;
  visual_acuity_os?: string | null;
  sphere_od?: string | null;
  sphere_os?: string | null;
  cylinder_od?: string | null;
  cylinder_os?: string | null;
  axis_od?: number | null;
  axis_os?: number | null;
  iop_od?: string | null;
  iop_os?: string | null;
  slit_lamp?: string | null;
  fundus?: string | null;
  diagnosis?: string | null;
  plan?: string | null;
  status?: string | null;
}

export interface UpdateOphthoExamRequest {
  slit_lamp?: string | null;
  fundus?: string | null;
  diagnosis?: string | null;
  plan?: string | null;
  status?: string | null;
}

/** Dental — a dental exam (visit) + its tooth-wise chart entries. */
export interface DentalExam {
  id: string;
  tenant_id: string;
  patient_id: string;
  encounter_id: string | null;
  chief_complaint: string | null;
  diagnosis: string | null;
  treatment_plan: string | null;
  examined_by: string | null;
  examined_at: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DentalChartEntry {
  id: string;
  tenant_id: string;
  exam_id: string;
  tooth_number: string;
  condition: string;
  surface: string | null;
  treatment_planned: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDentalExamRequest {
  patient_id: string;
  encounter_id?: string | null;
  chief_complaint?: string | null;
  diagnosis?: string | null;
  treatment_plan?: string | null;
  status?: string | null;
}

export interface CreateDentalChartEntryRequest {
  tooth_number: string;
  condition: string;
  surface?: string | null;
  treatment_planned?: string | null;
  notes?: string | null;
}

/** Oncology depth — cancer TNM staging + radiation-therapy sessions. */
export interface CancerStaging {
  id: string;
  tenant_id: string;
  patient_id: string;
  primary_site: string;
  histology: string | null;
  t_stage: string | null;
  n_stage: string | null;
  m_stage: string | null;
  overall_stage: string | null;
  staged_by: string | null;
  staged_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RadiationSession {
  id: string;
  tenant_id: string;
  patient_id: string;
  site: string;
  technique: string | null;
  total_dose_gy: string | null;
  fractions: number | null;
  session_number: number | null;
  delivered_by: string | null;
  delivered_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCancerStagingRequest {
  patient_id: string;
  primary_site: string;
  histology?: string | null;
  t_stage?: string | null;
  n_stage?: string | null;
  m_stage?: string | null;
  overall_stage?: string | null;
  notes?: string | null;
}

export interface CreateRadiationRequest {
  patient_id: string;
  site: string;
  technique?: string | null;
  total_dose_gy?: string | null;
  fractions?: number | null;
  session_number?: number | null;
  notes?: string | null;
}

export interface CathProcedure {
  id: string;
  tenant_id: string;
  patient_id: string;
  procedure_type: CathProcedureType;
  operator_id: string;
  is_stemi: boolean;
  door_time: string | null;
  balloon_time: string | null;
  door_to_balloon_minutes: number | null;
  fluoroscopy_time_seconds: number | null;
  total_dap: number | null;
  total_air_kerma: number | null;
  contrast_type: string | null;
  contrast_volume_ml: number | null;
  findings: Record<string, unknown> | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCathProcedureRequest {
  patient_id: string;
  procedure_type: CathProcedureType;
  operator_id: string;
  is_stemi?: boolean;
  door_time?: string;
  contrast_type?: string;
  contrast_volume_ml?: number;
  findings?: Record<string, unknown>;
}

export interface CathHemodynamic {
  id: string;
  tenant_id: string;
  procedure_id: string;
  site: HemodynamicSite;
  systolic_mmhg: number | null;
  diastolic_mmhg: number | null;
  mean_mmhg: number | null;
  saturation_pct: number | null;
  gradient_mmhg: number | null;
  created_at: string;
}

export interface CreateCathHemodynamicRequest {
  site: HemodynamicSite;
  systolic_mmhg?: number;
  diastolic_mmhg?: number;
  mean_mmhg?: number;
  saturation_pct?: number;
  gradient_mmhg?: number;
}

export interface CathDevice {
  id: string;
  tenant_id: string;
  procedure_id: string;
  device_type: CathDeviceType;
  manufacturer: string | null;
  lot_number: string | null;
  barcode: string | null;
  is_consignment: boolean;
  vendor_id: string | null;
  unit_cost: number | null;
  billed: boolean;
  created_at: string;
}

export interface CreateCathDeviceRequest {
  device_type: CathDeviceType;
  manufacturer?: string;
  lot_number?: string;
  barcode?: string;
  is_consignment?: boolean;
  vendor_id?: string;
  unit_cost?: number;
}

export interface CathStemiTimeline {
  id: string;
  tenant_id: string;
  procedure_id: string;
  event: StemiPathwayStatus;
  event_time: string;
  recorded_by: string;
  created_at: string;
}

export interface CreateCathStemiEventRequest {
  event: StemiPathwayStatus;
  event_time: string;
}

export interface CathPostMonitoring {
  id: string;
  tenant_id: string;
  procedure_id: string;
  monitored_at: string;
  sheath_status: string | null;
  access_site_status: string | null;
  vitals: Record<string, unknown> | null;
  ambulation_started: boolean;
  created_at: string;
}

export interface CreateCathPostMonitoringRequest {
  monitored_at: string;
  sheath_status?: string;
  access_site_status?: string;
  vitals?: Record<string, unknown>;
  ambulation_started?: boolean;
}
