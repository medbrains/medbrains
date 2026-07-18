// IPD phase-2 types (wards, bed dashboard, discharge summaries) — split from index.ts, barrel-re-exported.
import type { DischargeSummaryStatus } from "./pharmacy-phase2";

// ── IPD Phase 2 — Wards, Bed Dashboard, Discharge Summaries ─

export interface Ward {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  department_id: string | null;
  ward_type: string;
  total_beds: number;
  gender_restriction: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WardBedMapping {
  id: string;
  tenant_id: string;
  ward_id: string;
  bed_location_id: string;
  bed_type_id: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface AdmissionAttender {
  id: string;
  tenant_id: string;
  admission_id: string;
  relationship: string;
  name: string;
  phone: string | null;
  alt_phone: string | null;
  address: string | null;
  id_proof_type: string | null;
  id_proof_number: string | null;
  is_primary: boolean;
  created_at: string;
}

export interface DischargeSummaryTemplate {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  sections: unknown[];
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ErDischargeSummary {
  id: string;
  tenant_id: string;
  er_visit_id: string;
  status: "draft" | "finalized";
  final_diagnosis: string | null;
  condition_at_discharge: string | null;
  clinical_course: string | null;
  treatment_given: string | null;
  medications_on_discharge: string | null;
  follow_up_instructions: string | null;
  follow_up_date: string | null;
  warning_signs: string | null;
  prepared_by: string | null;
  verified_by: string | null;
  finalized_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ErDischargeSummaryRequest {
  final_diagnosis?: string;
  condition_at_discharge?: string;
  clinical_course?: string;
  treatment_given?: string;
  medications_on_discharge?: string;
  follow_up_instructions?: string;
  follow_up_date?: string;
  warning_signs?: string;
}

export interface IpdNoDuesCertificate {
  id: string;
  tenant_id: string;
  admission_id: string;
  total_billed: string;
  total_paid: string;
  balance: string;
  issued_by: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface IpdDischargeSummary {
  id: string;
  tenant_id: string;
  admission_id: string;
  template_id: string | null;
  status: DischargeSummaryStatus;
  final_diagnosis: string | null;
  condition_at_discharge: string | null;
  course_in_hospital: string | null;
  treatment_given: string | null;
  procedures_performed: unknown[];
  investigation_summary: string | null;
  medications_on_discharge: unknown[];
  follow_up_instructions: string | null;
  follow_up_date: string | null;
  dietary_advice: string | null;
  activity_restrictions: string | null;
  warning_signs: string | null;
  emergency_contact_info: string | null;
  prepared_by: string | null;
  verified_by: string | null;
  finalized_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateWardRequest {
  code: string;
  name: string;
  department_id?: string;
  ward_type?: string;
  gender_restriction?: string;
  is_active?: boolean;
}

export interface UpdateWardRequest {
  name?: string;
  department_id?: string;
  ward_type?: string;
  gender_restriction?: string;
  is_active?: boolean;
}

export interface WardListRow {
  id: string;
  code: string;
  name: string;
  department_name: string | null;
  ward_type: string;
  total_beds: number;
  vacant_beds: number;
  gender_restriction: string;
  is_active: boolean;
}

export interface AssignBedToWardRequest {
  bed_location_id: string;
  bed_type_id?: string;
  sort_order?: number;
}

export interface WardBedRow {
  mapping_id: string;
  bed_location_id: string;
  bed_name: string;
  bed_type_name: string | null;
  status: string;
  patient_name: string | null;
  patient_uhid: string | null;
  sort_order: number;
}

export interface BedDashboardSummary {
  ward_id: string | null;
  ward_name: string | null;
  total: number;
  vacant_clean: number;
  vacant_dirty: number;
  occupied: number;
  reserved: number;
  maintenance: number;
  blocked: number;
}

export interface BedDashboardRow {
  bed_state_id: string;
  bed_location_id: string;
  bed_name: string;
  ward_id: string | null;
  ward_name: string | null;
  bed_status: string;
  patient_name: string | null;
  patient_uhid: string | null;
  admission_id: string | null;
}

export interface UpdateBedStatusRequest {
  status: string;
}

export interface CreateAttenderRequest {
  relationship: string;
  name: string;
  phone?: string;
  alt_phone?: string;
  address?: string;
  id_proof_type?: string;
  id_proof_number?: string;
  is_primary?: boolean;
}

export interface CreateDischargeTemplateRequest {
  code: string;
  name: string;
  sections: unknown[];
  is_default?: boolean;
  is_active?: boolean;
}

export interface CreateDischargeSummaryRequest {
  template_id?: string;
  final_diagnosis?: string;
  condition_at_discharge?: string;
  course_in_hospital?: string;
  treatment_given?: string;
  procedures_performed?: unknown[];
  investigation_summary?: string;
  medications_on_discharge?: unknown[];
  follow_up_instructions?: string;
  follow_up_date?: string;
  dietary_advice?: string;
  activity_restrictions?: string;
  warning_signs?: string;
  emergency_contact_info?: string;
}

export interface UpdateDischargeSummaryRequest {
  final_diagnosis?: string;
  condition_at_discharge?: string;
  course_in_hospital?: string;
  treatment_given?: string;
  procedures_performed?: unknown[];
  investigation_summary?: string;
  medications_on_discharge?: unknown[];
  follow_up_instructions?: string;
  follow_up_date?: string;
  dietary_advice?: string;
  activity_restrictions?: string;
  warning_signs?: string;
  emergency_contact_info?: string;
}

export interface CensusWardRow {
  ward_id: string | null;
  ward_name: string | null;
  total_beds: number;
  occupied: number;
  vacant: number;
}

export interface OccupancyRow {
  ward_id: string | null;
  ward_name: string | null;
  total_beds: number;
  occupied_bed_days: number;
  total_bed_days: number;
  occupancy_pct: number;
}

export interface AlosRow {
  department_name: string | null;
  discharge_type: string;
  avg_los_days: number;
  count: number;
}

export interface DischargeStatRow {
  discharge_type: string;
  count: number;
}
