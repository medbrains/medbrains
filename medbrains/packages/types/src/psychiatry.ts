// Psychiatry types — split from index.ts, barrel-re-exported.

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
  nominated_rep_contact: string | null;
  nominated_rep_relation: string | null;
  substance_abuse_flag: boolean;
  is_restricted: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatePsychPatientRequest {
  patient_id: string;
  admission_category: PsychAdmissionCategory;
  advance_directive_text?: string;
  nominated_rep_name?: string;
  nominated_rep_contact?: string;
  nominated_rep_relation?: string;
  substance_abuse_flag?: boolean;
}

export interface PsychAssessment {
  id: string;
  tenant_id: string;
  psych_patient_id: string;
  assessment_type: string;
  mental_status_exam: Record<string, unknown> | null;
  ham_d_score: number | null;
  bprs_score: number | null;
  risk_assessment: Record<string, unknown> | null;
  created_at: string;
}

export interface CreatePsychAssessmentRequest {
  assessment_type: string;
  mental_status_exam?: Record<string, unknown>;
  ham_d_score?: number;
  bprs_score?: number;
  risk_assessment?: Record<string, unknown>;
}

export interface PsychEctSession {
  id: string;
  tenant_id: string;
  psych_patient_id: string;
  session_number: number;
  consent_obtained: boolean;
  laterality: EctLaterality;
  stimulus_dose: string | null;
  seizure_duration: string | null;
  anesthetic: string | null;
  performed_by: string;
  created_at: string;
}

export interface CreatePsychEctRequest {
  session_number: number;
  consent_obtained: boolean;
  laterality: EctLaterality;
  stimulus_dose?: string;
  seizure_duration?: string;
  anesthetic?: string;
  performed_by: string;
}

export interface PsychRestraint {
  id: string;
  tenant_id: string;
  psych_patient_id: string;
  restraint_type: RestraintType;
  start_time: string;
  review_due_at: string;
  reviewed_at: string | null;
  released_at: string | null;
  released_by: string | null;
  created_at: string;
}

export interface CreatePsychRestraintRequest {
  restraint_type: RestraintType;
  start_time: string;
}

export interface PsychMhrbNotification {
  id: string;
  tenant_id: string;
  psych_patient_id: string;
  notification_type: string;
  reference_number: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CreatePsychMhrbRequest {
  notification_type: string;
  reference_number?: string;
}

export interface PsychCounselingSession {
  id: string;
  tenant_id: string;
  psych_patient_id: string;
  session_type: string;
  therapist_id: string;
  modality: string | null;
  outcome_rating: number | null;
  created_at: string;
}

export interface CreatePsychCounselingRequest {
  session_type: string;
  therapist_id: string;
  modality?: string;
  outcome_rating?: number;
}
