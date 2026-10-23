// Psychiatry types — split from index.ts, barrel-re-exported.
// Names match the Rust structs in medbrains-core/src/specialty/psychiatry.rs
// so `make check-types` pairs them; a renamed type here is a type nobody checks.

// ── Psychiatry ──

export type PsychAdmissionCategory = "independent" | "supported" | "minor_supported" | "emergency";

export type EctLaterality = "bilateral" | "right_unilateral" | "left_unilateral";

export type RestraintType = "physical" | "chemical" | "seclusion";

export interface PsychPatient {
  id: string;
  tenant_id: string;
  patient_id: string;
  admission_category: PsychAdmissionCategory;
  advance_directive_text: string | null;
  nominated_rep_name: string | null;
  nominated_rep_relation: string | null;
  nominated_rep_contact: string | null;
  substance_abuse_flag: boolean;
  /** Visible only to the treating psychiatrist, break-glass, and holders of
   *  specialty.psychiatry.restricted.view (MHCA 2017 s.23). */
  is_restricted: boolean;
  treating_psychiatrist_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePsychPatientRequest {
  patient_id: string;
  admission_category: PsychAdmissionCategory;
  advance_directive_text?: string;
  nominated_rep_name?: string;
  nominated_rep_relation?: string;
  nominated_rep_contact?: string;
  substance_abuse_flag?: boolean;
  treating_psychiatrist_id?: string;
  notes?: string;
}

export interface UpdatePsychPatientRequest
  extends Partial<Omit<CreatePsychPatientRequest, "patient_id">> {
  is_restricted?: boolean;
}

export interface PsychAssessment {
  id: string;
  tenant_id: string;
  psych_patient_id: string;
  assessment_type: string;
  mental_status_exam: Record<string, unknown>;
  ham_d_score: number | null;
  bprs_score: number | null;
  gaf_score: number | null;
  risk_assessment: Record<string, unknown>;
  assessed_by: string;
  assessed_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePsychAssessmentRequest {
  assessment_type: string;
  mental_status_exam?: Record<string, unknown>;
  ham_d_score?: number;
  bprs_score?: number;
  gaf_score?: number;
  risk_assessment?: Record<string, unknown>;
  notes?: string;
}

export interface PsychEctRegister {
  id: string;
  tenant_id: string;
  psych_patient_id: string;
  session_number: number;
  consent_obtained: boolean;
  laterality: EctLaterality;
  /** rust_decimal — serialised as a string. */
  stimulus_dose: string | null;
  seizure_duration_sec: number | null;
  anesthetic: string | null;
  muscle_relaxant: string | null;
  performed_by: string;
  anesthetist_id: string | null;
  session_date: string;
  complications: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePsychEctRequest {
  session_number: number;
  consent_obtained: boolean;
  laterality: EctLaterality;
  stimulus_dose?: number;
  seizure_duration_sec?: number;
  anesthetic?: string;
  muscle_relaxant?: string;
  anesthetist_id?: string;
  complications?: string;
  notes?: string;
}

export interface PsychSeclusionRestraint {
  id: string;
  tenant_id: string;
  psych_patient_id: string;
  restraint_type: RestraintType;
  reason: string;
  start_time: string;
  review_due_at: string;
  reviewed_at: string | null;
  /** Null while the restraint is still in force. */
  end_time: string | null;
  ordered_by: string;
  released_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePsychRestraintRequest {
  restraint_type: RestraintType;
  reason: string;
  /** 1–4 hours; the server rejects anything longer. */
  review_due_hours?: number;
  notes?: string;
}

export interface ReleasePsychRestraintRequest {
  notes?: string;
}

export interface PsychMhrbNotification {
  id: string;
  tenant_id: string;
  psych_patient_id: string;
  notification_type: string;
  reference_number: string | null;
  status: string;
  sent_at: string | null;
  acknowledged_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePsychMhrbRequest {
  notification_type: string;
  reference_number?: string;
  notes?: string;
}

export interface UpdatePsychMhrbRequest {
  status?: string;
  notes?: string;
}

export interface PsychCounselingSession {
  id: string;
  tenant_id: string;
  psych_patient_id: string;
  session_type: string;
  therapist_id: string;
  modality: string | null;
  duration_minutes: number | null;
  outcome_rating: number | null;
  session_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePsychCounselingRequest {
  session_type: string;
  therapist_id: string;
  modality?: string;
  duration_minutes?: number;
  outcome_rating?: number;
  notes?: string;
}
