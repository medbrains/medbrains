// Palliative / mortuary / nuclear-medicine types — split from index.ts, barrel-re-exported.

// ── Palliative / Mortuary / Nuclear Medicine ──

export type DnrStatus = "active" | "expired" | "revoked";

export type BodyStatus =
  | "received"
  | "cold_storage"
  | "inquest_pending"
  | "pm_scheduled"
  | "pm_completed"
  | "released"
  | "unclaimed"
  | "disposed";

export type RadiopharmaceuticalType = "diagnostic" | "therapeutic";

export interface DnrOrder {
  id: string;
  tenant_id: string;
  patient_id: string;
  admission_id: string | null;
  status: DnrStatus;
  review_due_at: string;
  scope: string | null;
  authorized_by: string;
  revoked_at: string | null;
  revoked_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDnrOrderRequest {
  patient_id: string;
  admission_id?: string;
  scope?: string;
}

export interface PainAssessment {
  id: string;
  tenant_id: string;
  patient_id: string;
  pain_score: number;
  who_ladder_step: number | null;
  opioid_dose_morphine_eq: number | null;
  breakthrough_doses: number | null;
  created_at: string;
}

export interface CreatePainAssessmentRequest {
  patient_id: string;
  pain_score: number;
  who_ladder_step?: number;
  opioid_dose_morphine_eq?: number;
  breakthrough_doses?: number;
}

export interface MortuaryRecord {
  id: string;
  tenant_id: string;
  body_receipt_number: string;
  deceased_name: string;
  is_mlc: boolean;
  mlc_case_id: string | null;
  cold_storage_slot: string | null;
  temperature_log: Record<string, unknown> | null;
  status: BodyStatus;
  pm_requested: boolean;
  pm_conducted_by: string | null;
  pm_date: string | null;
  pm_findings: string | null;
  viscera_chain_of_custody: Record<string, unknown> | null;
  unclaimed_fir_filed: boolean;
  unclaimed_photo_taken: boolean;
  organ_donation_status: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMortuaryRecordRequest {
  body_receipt_number: string;
  deceased_name: string;
  is_mlc?: boolean;
  mlc_case_id?: string;
  cold_storage_slot?: string;
}

export interface NuclearMedSource {
  id: string;
  tenant_id: string;
  isotope: string;
  activity_mci: number;
  half_life_hours: number;
  aerb_license_number: string | null;
  batch_number: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateNuclearMedSourceRequest {
  isotope: string;
  activity_mci: number;
  half_life_hours: number;
  aerb_license_number?: string;
  batch_number?: string;
}

export interface NuclearMedAdministration {
  id: string;
  tenant_id: string;
  source_id: string;
  patient_id: string;
  dose_mci: number;
  route: string | null;
  indication: string | null;
  waste_disposed: boolean;
  created_at: string;
}

export interface CreateNuclearMedAdminRequest {
  source_id: string;
  patient_id: string;
  dose_mci: number;
  route?: string;
  indication?: string;
  waste_disposed?: boolean;
}
