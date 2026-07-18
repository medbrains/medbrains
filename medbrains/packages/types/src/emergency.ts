// Emergency (ER) types — split from index.ts, barrel-re-exported.

// ── Emergency ──────────────────────────────────────────

export type TriageLevel =
  | "immediate"
  | "emergent"
  | "urgent"
  | "less_urgent"
  | "non_urgent"
  | "expectant"
  | "unassigned";
export type ErVisitStatus =
  | "registered"
  | "triaged"
  | "in_treatment"
  | "observation"
  | "admitted"
  | "discharged"
  | "transferred"
  | "lama"
  | "deceased";
export type MlcStatus =
  | "registered"
  | "under_investigation"
  | "opinion_given"
  | "court_pending"
  | "closed";
export type MassCasualtyStatus = "activated" | "ongoing" | "scaling_down" | "deactivated";

export interface MailDnsRecord {
  record_type: string;
  host: string;
  value: string;
}

export interface ProvisionDomainResponse {
  domain: string;
  dns_records: MailDnsRecord[];
}

export interface PatientRadiologyReport {
  report_id: string;
  order_id: string;
  modality: string | null;
  ordered_at: string;
  status: string;
  findings: string;
  impression: string | null;
  is_critical: boolean;
  verified_at: string | null;
  alert_id: string | null;
  alert_acknowledged_at: string | null;
}

export interface PatientTimelineEvent {
  occurred_at: string;
  category: "opd" | "ipd" | "emergency" | "lab" | "radiology" | "pharmacy" | "diagnosis";
  title: string;
  subtitle: string | null;
  ref_id: string;
}

export interface ErBay {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  bay_type: string | null;
  is_active: boolean;
  sort_order: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ErBayRequest {
  code: string;
  name: string;
  bay_type?: string;
  is_active?: boolean;
  sort_order?: number;
  notes?: string;
}

export interface ErObservationNote {
  id: string;
  tenant_id: string;
  er_visit_id: string;
  observed_at: string;
  pulse: number | null;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  resp_rate: number | null;
  spo2: number | null;
  temperature: number | null;
  gcs: number | null;
  pain_score: number | null;
  note: string | null;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateObservationNoteRequest {
  pulse?: number;
  bp_systolic?: number;
  bp_diastolic?: number;
  resp_rate?: number;
  spo2?: number;
  temperature?: number;
  gcs?: number;
  pain_score?: number;
  note?: string;
}

export interface ErVisit {
  id: string;
  tenant_id: string;
  patient_id: string;
  encounter_id: string | null;
  visit_number: string;
  status: ErVisitStatus;
  arrival_mode: string | null;
  arrival_time: string;
  chief_complaint: string | null;
  is_mlc: boolean;
  is_brought_dead: boolean;
  triage_level: TriageLevel | null;
  attending_doctor_id: string | null;
  bay_number: string | null;
  disposition: string | null;
  disposition_time: string | null;
  disposition_notes: string | null;
  admitted_to: string | null;
  admission_id: string | null;
  door_to_doctor_mins: number | null;
  door_to_disposition_mins: number | null;
  vitals: Record<string, unknown> | null;
  notes: string | null;
  mass_casualty_event_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ErTriageAssessment {
  id: string;
  tenant_id: string;
  er_visit_id: string;
  triage_level: TriageLevel;
  triage_system: string;
  score: number | null;
  respiratory_rate: number | null;
  pulse_rate: number | null;
  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  spo2: number | null;
  gcs_score: number | null;
  gcs_eye: number | null;
  gcs_verbal: number | null;
  gcs_motor: number | null;
  pain_score: number | null;
  chief_complaint: string | null;
  presenting_symptoms: Record<string, unknown> | null;
  allergies: Record<string, unknown> | null;
  is_pregnant: boolean | null;
  disability_assessment: string | null;
  notes: string | null;
  assessed_by: string | null;
  assessed_at: string;
  created_at: string;
  updated_at: string;
}

export interface ErResuscitationLog {
  id: string;
  tenant_id: string;
  er_visit_id: string;
  log_type: string;
  timestamp: string;
  medication_name: string | null;
  dose: string | null;
  route: string | null;
  fluid_name: string | null;
  fluid_volume_ml: number | null;
  procedure_name: string | null;
  procedure_notes: string | null;
  vitals_snapshot: Record<string, unknown> | null;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ErCodeActivation {
  id: string;
  tenant_id: string;
  er_visit_id: string | null;
  code_type: string;
  activated_at: string;
  deactivated_at: string | null;
  location: string | null;
  response_team: Record<string, unknown> | null;
  crash_cart_checklist: Record<string, unknown> | null;
  outcome: string | null;
  notes: string | null;
  activated_by: string | null;
  deactivated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MlcCase {
  id: string;
  tenant_id: string;
  er_visit_id: string | null;
  patient_id: string;
  mlc_number: string;
  status: MlcStatus;
  case_type: string | null;
  fir_number: string | null;
  police_station: string | null;
  brought_by: string | null;
  informant_name: string | null;
  informant_relation: string | null;
  informant_contact: string | null;
  history_of_incident: string | null;
  examination_findings: string | null;
  medical_opinion: string | null;
  is_pocso: boolean;
  is_death_case: boolean;
  cause_of_death: string | null;
  registered_by: string | null;
  registered_at: string;
  created_at: string;
  updated_at: string;
}

export interface MlcDocument {
  id: string;
  tenant_id: string;
  mlc_case_id: string;
  document_type: string;
  title: string;
  body_diagram: Record<string, unknown> | null;
  content: Record<string, unknown>;
  generated_by: string | null;
  verified_by: string | null;
  verified_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MlcPoliceIntimation {
  id: string;
  tenant_id: string;
  mlc_case_id: string;
  intimation_number: string;
  police_station: string;
  officer_name: string | null;
  officer_designation: string | null;
  officer_contact: string | null;
  sent_at: string;
  sent_via: string | null;
  receipt_confirmed: boolean;
  receipt_confirmed_at: string | null;
  receipt_number: string | null;
  notes: string | null;
  sent_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MassCasualtyEvent {
  id: string;
  tenant_id: string;
  event_name: string;
  event_type: string | null;
  status: MassCasualtyStatus;
  activated_at: string;
  deactivated_at: string | null;
  location: string | null;
  estimated_casualties: number | null;
  actual_casualties: number | null;
  triage_summary: Record<string, unknown> | null;
  resources_deployed: Record<string, unknown> | null;
  notifications_sent: Record<string, unknown> | null;
  notes: string | null;
  activated_by: string | null;
  deactivated_by: string | null;
  created_at: string;
  updated_at: string;
}
