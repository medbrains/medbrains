// Emergency (ER) request types — split from index.ts, barrel-re-exported.

// ── Emergency Request Types ────────────────────────────

export interface CreateErVisitRequest {
  patient_id: string;
  arrival_mode?: string;
  chief_complaint?: string;
  is_mlc?: boolean;
  is_brought_dead?: boolean;
  bay_number?: string;
  vitals?: Record<string, unknown>;
  notes?: string;
  mass_casualty_event_id?: string;
}

export interface UpdateErVisitRequest {
  status?: string;
  triage_level?: string;
  attending_doctor_id?: string;
  bay_number?: string;
  disposition?: string;
  disposition_notes?: string;
  admitted_to?: string;
  admission_id?: string;
  door_to_doctor_mins?: number;
  door_to_disposition_mins?: number;
  vitals?: Record<string, unknown>;
  notes?: string;
}

export interface CreateTriageRequest {
  triage_level: string;
  triage_system?: string;
  score?: number;
  respiratory_rate?: number;
  pulse_rate?: number;
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  spo2?: number;
  gcs_score?: number;
  gcs_eye?: number;
  gcs_verbal?: number;
  gcs_motor?: number;
  pain_score?: number;
  chief_complaint?: string;
  presenting_symptoms?: Record<string, unknown>;
  allergies?: Record<string, unknown>;
  is_pregnant?: boolean;
  disability_assessment?: string;
  notes?: string;
}

export interface CreateResuscitationLogRequest {
  log_type: string;
  medication_name?: string;
  dose?: string;
  route?: string;
  fluid_name?: string;
  fluid_volume_ml?: number;
  procedure_name?: string;
  procedure_notes?: string;
  vitals_snapshot?: Record<string, unknown>;
  notes?: string;
}

export interface CreateCodeActivationRequest {
  er_visit_id?: string;
  code_type: string;
  location: string;
  response_team?: Record<string, unknown>;
  crash_cart_checklist?: Record<string, unknown>;
  notes?: string;
}

export interface DeactivateCodeRequest {
  outcome: string;
  notes?: string;
}

export interface CreateMlcCaseRequest {
  er_visit_id?: string;
  patient_id: string;
  case_type?: string;
  fir_number?: string;
  police_station?: string;
  brought_by?: string;
  informant_name?: string;
  informant_relation?: string;
  informant_contact?: string;
  history_of_incident?: string;
  examination_findings?: string;
  is_pocso?: boolean;
  is_death_case?: boolean;
}

export interface UpdateMlcCaseRequest {
  status?: string;
  case_type?: string;
  fir_number?: string;
  police_station?: string;
  examination_findings?: string;
  medical_opinion?: string;
  cause_of_death?: string;
}

export interface CreateMlcDocumentRequest {
  document_type: string;
  title: string;
  body_diagram?: Record<string, unknown>;
  content: Record<string, unknown>;
  notes?: string;
}

export interface CreatePoliceIntimationRequest {
  police_station: string;
  officer_name?: string;
  officer_designation?: string;
  officer_contact?: string;
  sent_via?: string;
  notes?: string;
}

export interface ConfirmPoliceReceiptRequest {
  receipt_number: string;
  notes?: string;
}

export interface CreateMassCasualtyEventRequest {
  event_name: string;
  event_type?: string;
  location?: string;
  estimated_casualties?: number;
  notes?: string;
}

export interface UpdateMassCasualtyEventRequest {
  status?: string;
  actual_casualties?: number;
  triage_summary?: Record<string, unknown>;
  resources_deployed?: Record<string, unknown>;
  notifications_sent?: Record<string, unknown>;
  notes?: string;
}
