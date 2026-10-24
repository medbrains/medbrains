// Psychiatry types — split from index.ts, barrel-re-exported.
// Names match the Rust structs in medbrains-core/src/specialty/psychiatry.rs
// so `make check-types` pairs them; a renamed type here is a type nobody checks.

// ── Psychiatry ──

export type PsychAdmissionCategory =
  | "independent"
  | "supported"
  | "minor_supported"
  | "emergency"
  | "supported_extended";

export type EctLaterality = "bilateral" | "right_unilateral" | "left_unilateral";

export type RestraintType = "physical" | "chemical" | "seclusion";

export interface PsychPatient {
  id: string;
  tenant_id: string;
  patient_id: string;
  admission_category: PsychAdmissionCategory;
  substance_abuse_flag: boolean;
  /** Visible only to the treating psychiatrist, break-glass, and holders of
   *  specialty.psychiatry.restricted.view (MHCA 2017 s.23). */
  is_restricted: boolean;
  treating_psychiatrist_id: string | null;
  notes: string | null;
  /** The patient's consent to share mental-health records through ABDM. */
  abdm_mh_share_consented_at: string | null;
  abdm_mh_share_consented_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePsychPatientRequest {
  patient_id: string;
  admission_category: PsychAdmissionCategory;
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
  /** MHCA s.95(2): the Board's prior permission for ECT on a minor. */
  board_permission_ref: string | null;
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
  board_permission_ref?: string;
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
  /** s.97(1)(b): the psychiatrist in charge who authorised it. */
  authorised_by: string | null;
  /** s.97(3): method and nature. */
  method: string | null;
  last_resort_confirmed: boolean;
  /** s.97(5): the nominated representative must be told within 24 hours. */
  nominated_rep_informed_at: string | null;
  nominated_rep_informed_by: string | null;
}

export interface CreatePsychRestraintRequest {
  /** Seclusion is refused: MHCA s.97(1) prohibits it. */
  restraint_type: RestraintType;
  reason: string;
  method: string;
  last_resort_confirmed: boolean;
  authorised_by?: string;
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

// ── Mental Healthcare Act 2017 structured records ──

export type ExaminerRole = "psychiatrist" | "mental_health_professional" | "medical_practitioner";
export type AdmissionApplicant = "self" | "nominated_representative" | "medical_practitioner";
export type AdmissionCriterion =
  | "self_harm"
  | "harm_to_others"
  | "unable_to_self_care"
  | "property_damage";

export interface PsychAdmission {
  id: string;
  tenant_id: string;
  psych_patient_id: string;
  category: PsychAdmissionCategory;
  admitted_at: string;
  applicant: AdmissionApplicant;
  criteria: AdmissionCriterion[];
  least_restrictive_certified: boolean;
  needs_high_support: boolean;
  capacity_note: string | null;
  examiner1_id: string | null;
  examiner1_role: ExaminerRole | null;
  examiner1_examined_at: string | null;
  examiner2_id: string | null;
  examiner2_role: ExaminerRole | null;
  examiner2_examined_at: string | null;
  extension_number: number;
  /** Null for s.86: an independent patient may leave at will. */
  period_ends_at: string | null;
  minor_safeguards_confirmed: boolean;
  board_report_due_at: string | null;
  board_reported_at: string | null;
  board_reference: string | null;
  board_decision_due_at: string | null;
  board_decision: "permitted" | "discharge_ordered" | null;
  board_decided_at: string | null;
  discharged_at: string | null;
  discharge_note: string | null;
  admitted_by: string;
  created_at: string;
  updated_at: string;
}

export interface PsychExaminationInput {
  user_id: string;
  role: ExaminerRole;
  examined_at: string;
}

export interface CreatePsychAdmissionRequest {
  category: PsychAdmissionCategory;
  admitted_at?: string;
  applicant: AdmissionApplicant;
  criteria: AdmissionCriterion[];
  least_restrictive_certified: boolean;
  needs_high_support: boolean;
  minor_safeguards_confirmed: boolean;
  capacity_note?: string;
  examinations: PsychExaminationInput[];
  extension_number?: number;
}

export type NominatedRepBasis =
  | "appointed_by_patient"
  | "advance_directive"
  | "relative"
  | "care_giver"
  | "board_appointed"
  | "temporary_ngo"
  | "legal_guardian"
  | "recorded_before_structure";

export interface PsychNominatedRepresentative {
  id: string;
  tenant_id: string;
  psych_patient_id: string;
  full_name: string;
  relationship: string | null;
  phone: string | null;
  address: string | null;
  basis: NominatedRepBasis;
  written_consent_received: boolean;
  appointment_document_ref: string | null;
  appointed_on: string | null;
  revoked_at: string | null;
  revoke_reason: string | null;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePsychRepresentativeRequest {
  full_name: string;
  relationship?: string;
  phone?: string;
  address?: string;
  basis: Exclude<NominatedRepBasis, "recorded_before_structure">;
  written_consent_received: boolean;
  appointment_document_ref?: string;
  appointed_on?: string;
}

export type AdvanceDirectiveStatus =
  | "active"
  | "revoked"
  | "modified_by_board"
  | "cancelled_by_board";

export interface PsychAdvanceDirective {
  id: string;
  tenant_id: string;
  psych_patient_id: string;
  made_on: string | null;
  made_by: "patient" | "legal_guardian" | "recorded_before_structure";
  treatment_wishes: string | null;
  treatment_refusals: string | null;
  representative_preferences: string | null;
  document_ref: string | null;
  status: AdvanceDirectiveStatus;
  revoked_at: string | null;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePsychDirectiveRequest {
  made_on?: string;
  made_by: "patient" | "legal_guardian";
  treatment_wishes?: string;
  treatment_refusals?: string;
  representative_preferences?: string;
  document_ref?: string;
}

export type DirectiveChallengeGround =
  | "not_free_will"
  | "not_intended_for_circumstances"
  | "not_well_informed"
  | "lacked_capacity"
  | "contrary_to_law";

export interface PsychDirectiveChallenge {
  id: string;
  tenant_id: string;
  advance_directive_id: string;
  applicant_role: "mental_health_professional" | "relative" | "care_giver";
  grounds: DirectiveChallengeGround[];
  details: string;
  status: "pending_board" | "upheld" | "modified" | "cancelled";
  board_reference: string | null;
  decided_at: string | null;
  decision_note: string | null;
  filed_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreatePsychChallengeRequest {
  applicant_role: PsychDirectiveChallenge["applicant_role"];
  grounds: DirectiveChallengeGround[];
  details: string;
}

export interface DecidePsychChallengeRequest {
  status: "upheld" | "modified" | "cancelled";
  board_reference?: string;
  decision_note?: string;
}

export type ScreeningInstrument = "phq9" | "gad7";

export interface PsychScreening {
  id: string;
  tenant_id: string;
  psych_patient_id: string;
  instrument: ScreeningInstrument;
  answers: number[];
  total: number;
  severity: "minimal" | "mild" | "moderate" | "moderately_severe" | "severe";
  /** PHQ-9 item 9 above zero — a same-day suicide-risk review is required. */
  item9_positive: boolean;
  administered_by: string;
  administered_at: string;
  safety_review_status: "not_required" | "pending" | "completed";
  safety_reviewed_by: string | null;
  safety_reviewed_at: string | null;
  safety_review_outcome: string | null;
  safety_review_note: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePsychScreeningRequest {
  instrument: ScreeningInstrument;
  answers: number[];
  notes?: string;
}

export interface PsychSafetyReviewRequest {
  outcome: "no_current_risk" | "low" | "moderate" | "high";
  note: string;
}

export interface PendingSafetyReview {
  screening_id: string;
  psych_patient_id: string;
  patient_id: string;
  total: number;
  administered_at: string;
}

export interface RestraintReportRow {
  id: string;
  psych_patient_id: string;
  patient_id: string;
  restraint_type: RestraintType;
  method: string | null;
  reason: string;
  start_time: string;
  end_time: string | null;
  authorised_by: string | null;
  nominated_rep_informed_at: string | null;
}

export interface MentalHealthSharing {
  enabled: boolean;
}
