// Infection control types — split from index.ts, barrel-re-exported.

// ── Infection Control ─────────────────────────────────────
export type HaiType = "clabsi" | "cauti" | "vap" | "ssi" | "cdiff" | "mrsa" | "other";
export type InfectionStatusType = "suspected" | "confirmed" | "ruled_out";
export type AntibioticRequestStatusType = "pending" | "approved" | "denied" | "expired";
export type WasteCategoryType =
  | "yellow"
  | "red"
  | "white_translucent"
  | "blue"
  | "cytotoxic"
  | "chemical"
  | "radioactive";
export type OutbreakStatusType = "suspected" | "confirmed" | "contained" | "closed";

export interface InfectionSurveillanceEvent {
  id: string;
  tenant_id: string;
  patient_id: string;
  admission_id?: string;
  hai_type: HaiType;
  infection_status: InfectionStatusType;
  organism?: string;
  susceptibility_pattern?: unknown;
  device_type?: string;
  insertion_date?: string;
  infection_date: string;
  location_id?: string;
  department_id?: string;
  nhsn_criteria?: string;
  contributing_factors?: unknown;
  notes?: string;
  reported_by: string;
  confirmed_by?: string;
  confirmed_at?: string;
  created_at: string;
  updated_at: string;
}

export type IndwellingDeviceType =
  | "central_line"
  | "urinary_catheter"
  | "ventilator"
  | "peripheral_iv"
  | "other";

export interface IndwellingDevice {
  id: string;
  tenant_id: string;
  patient_id: string;
  admission_id: string | null;
  device_type: IndwellingDeviceType;
  site: string | null;
  indication: string;
  inserted_at: string;
  inserted_by: string | null;
  last_reviewed_at: string;
  still_indicated: boolean;
  removed_at: string | null;
  removed_by: string | null;
  removal_reason: string | null;
  notes: string | null;
  created_at: string;
}

export interface CreateIndwellingDeviceRequest {
  patient_id: string;
  admission_id?: string;
  device_type: IndwellingDeviceType;
  site?: string;
  indication: string;
}

export interface ReviewIndwellingDeviceRequest {
  still_indicated: boolean;
  notes?: string;
}

export interface RemoveIndwellingDeviceRequest {
  removal_reason: string;
}

export interface InfectionDeviceDay {
  id: string;
  tenant_id: string;
  location_id: string;
  department_id?: string;
  record_date: string;
  patient_days: number;
  central_line_days: number;
  urinary_catheter_days: number;
  ventilator_days: number;
  recorded_by: string;
  created_at: string;
  updated_at: string;
}

export interface AntibioticStewardshipRequest {
  id: string;
  tenant_id: string;
  patient_id: string;
  antibiotic_name: string;
  dose?: string;
  route?: string;
  frequency?: string;
  duration_days?: number;
  indication: string;
  culture_sent: boolean;
  culture_result?: string;
  request_status: AntibioticRequestStatusType;
  requested_by: string;
  requested_at: string;
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
  escalation_reason?: string;
  auto_stop_date?: string;
  timeout_decision: string | null;
  timeout_decision_at: string | null;
  timeout_reviewed_by: string | null;
  timeout_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AntibioticTimeoutReviewBody {
  decision: string;
  notes?: string;
}

export interface AntibioticConsumptionRecord {
  id: string;
  tenant_id: string;
  department_id?: string;
  antibiotic_name: string;
  atc_code?: string;
  record_month: string;
  quantity_used: number;
  ddd?: number;
  patient_days: number;
  ddd_per_1000_patient_days?: number;
  created_at: string;
  updated_at: string;
}

export interface BiowasteRecord {
  id: string;
  tenant_id: string;
  department_id: string;
  waste_category: WasteCategoryType;
  weight_kg: number;
  record_date: string;
  container_count: number;
  disposal_vendor?: string;
  manifest_number?: string;
  notes?: string;
  recorded_by: string;
  created_at: string;
  updated_at: string;
}

export interface NeedleStickIncident {
  id: string;
  tenant_id: string;
  incident_number: string;
  staff_id: string;
  incident_date: string;
  location_id?: string;
  department_id?: string;
  device_type: string;
  procedure_during?: string;
  body_part?: string;
  depth?: string;
  source_patient_id?: string;
  hiv_status?: string;
  hbv_status?: string;
  hcv_status?: string;
  pep_initiated: boolean;
  pep_details?: string;
  follow_up_schedule?: unknown;
  outcome?: string;
  reported_by: string;
  created_at: string;
  updated_at: string;
}

export interface HandHygieneAudit {
  id: string;
  tenant_id: string;
  audit_date: string;
  location_id?: string;
  department_id: string;
  auditor_id: string;
  observations: number;
  compliant: number;
  non_compliant: number;
  compliance_rate?: number;
  moment_breakdown?: unknown;
  staff_category?: string;
  findings?: string;
  created_at: string;
  updated_at: string;
}

export interface CultureSurveillance {
  id: string;
  tenant_id: string;
  culture_type: string;
  sample_site: string;
  location_id?: string;
  department_id?: string;
  collection_date: string;
  result?: string;
  organism?: string;
  colony_count?: number;
  acceptable?: boolean;
  action_taken?: string;
  collected_by: string;
  created_at: string;
  updated_at: string;
}

export interface OutbreakEvent {
  id: string;
  tenant_id: string;
  outbreak_number: string;
  organism: string;
  outbreak_status: OutbreakStatusType;
  detected_date: string;
  location_id?: string;
  department_id?: string;
  initial_cases: number;
  total_cases: number;
  description?: string;
  control_measures?: unknown;
  hicc_notified: boolean;
  hicc_notified_at?: string;
  containment_date?: string;
  closure_date?: string;
  root_cause?: string;
  lessons_learned?: string;
  reported_by: string;
  created_at: string;
  updated_at: string;
}

export interface OutbreakContact {
  id: string;
  tenant_id: string;
  outbreak_id: string;
  patient_id?: string;
  staff_id?: string;
  contact_type: string;
  exposure_date?: string;
  screening_date?: string;
  screening_result?: string;
  quarantine_required: boolean;
  quarantine_start?: string;
  quarantine_end?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Request types
export interface CreateSurveillanceEventRequest {
  patient_id: string;
  hai_type: HaiType;
  organism?: string;
  device_type?: string;
  insertion_date?: string;
  infection_date: string;
  location_id?: string;
  department_id?: string;
  nhsn_criteria?: string;
  notes?: string;
}
export interface RecordDeviceDaysRequest {
  location_id: string;
  department_id?: string;
  record_date: string;
  patient_days: number;
  central_line_days: number;
  urinary_catheter_days: number;
  ventilator_days: number;
}
export interface CreateStewardshipRequest {
  patient_id: string;
  antibiotic_name: string;
  dose?: string;
  route?: string;
  frequency?: string;
  duration_days?: number;
  indication: string;
  culture_sent: boolean;
  escalation_reason?: string;
}
export interface ReviewStewardshipRequest {
  request_status: AntibioticRequestStatusType;
  review_notes?: string;
}
export interface CreateBiowasteRecordRequest {
  department_id: string;
  waste_category: WasteCategoryType;
  weight_kg: number;
  record_date: string;
  container_count: number;
  disposal_vendor?: string;
  manifest_number?: string;
  notes?: string;
}
export interface CreateNeedleStickIncidentRequest {
  staff_id: string;
  incident_date: string;
  location_id?: string;
  department_id?: string;
  device_type: string;
  procedure_during?: string;
  body_part?: string;
  depth?: string;
  source_patient_id?: string;
  pep_initiated: boolean;
  pep_details?: string;
}
export interface CreateHygieneAuditRequest {
  audit_date: string;
  department_id: string;
  observations: number;
  compliant: number;
  non_compliant: number;
  moment_breakdown?: unknown;
  staff_category?: string;
  findings?: string;
}
export interface CreateCultureSurveillanceRequest {
  culture_type: string;
  sample_site: string;
  location_id?: string;
  department_id?: string;
  collection_date: string;
  result?: string;
  organism?: string;
  colony_count?: number;
  acceptable?: boolean;
  action_taken?: string;
}
export interface CreateOutbreakRequest {
  organism: string;
  detected_date: string;
  location_id?: string;
  department_id?: string;
  initial_cases: number;
  description?: string;
}
export interface UpdateOutbreakRequest {
  outbreak_status?: OutbreakStatusType;
  total_cases?: number;
  control_measures?: unknown;
  hicc_notified?: boolean;
  root_cause?: string;
  lessons_learned?: string;
}
export interface CreateOutbreakContactRequest {
  patient_id?: string;
  staff_id?: string;
  contact_type: string;
  exposure_date?: string;
  quarantine_required: boolean;
  notes?: string;
}
