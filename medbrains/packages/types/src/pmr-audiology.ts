// PMR / audiology types — split from index.ts, barrel-re-exported.

// ── PMR / Audiology ──

export type RehabDiscipline =
  | "physiotherapy"
  | "occupational_therapy"
  | "speech_therapy"
  | "psychology"
  | "prosthetics_orthotics";

export type HearingTestType = "pta" | "bera" | "oae" | "tympanometry" | "speech_audiometry";

export interface RehabPlan {
  id: string;
  tenant_id: string;
  patient_id: string;
  discipline: RehabDiscipline;
  goals: string | null;
  plan_details: Record<string, unknown> | null;
  fim_score_initial: number | null;
  barthel_score_initial: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateRehabPlanRequest {
  patient_id: string;
  discipline: RehabDiscipline;
  goals?: string;
  plan_details?: Record<string, unknown>;
  fim_score_initial?: number;
  barthel_score_initial?: number;
}

export interface RehabSession {
  id: string;
  tenant_id: string;
  plan_id: string;
  session_number: number;
  therapist_id: string;
  intervention: string | null;
  pain_score: number | null;
  rom: Record<string, unknown> | null;
  strength: Record<string, unknown> | null;
  fim_score: number | null;
  barthel_score: number | null;
  created_at: string;
}

export interface CreateRehabSessionRequest {
  session_number: number;
  therapist_id: string;
  intervention?: string;
  pain_score?: number;
  rom?: Record<string, unknown>;
  strength?: Record<string, unknown>;
  fim_score?: number;
  barthel_score?: number;
}

export interface AudiologyTest {
  id: string;
  tenant_id: string;
  patient_id: string;
  test_type: HearingTestType;
  right_ear_results: Record<string, unknown> | null;
  left_ear_results: Record<string, unknown> | null;
  is_nhsp: boolean;
  nhsp_referral_needed: boolean;
  audiogram_data: Record<string, unknown> | null;
  created_at: string;
}

export interface CreateAudiologyTestRequest {
  patient_id: string;
  test_type: HearingTestType;
  right_ear_results?: Record<string, unknown>;
  left_ear_results?: Record<string, unknown>;
  is_nhsp?: boolean;
  nhsp_referral_needed?: boolean;
  audiogram_data?: Record<string, unknown>;
}

export interface PsychometricTest {
  id: string;
  tenant_id: string;
  patient_id: string;
  test_name: string;
  raw_data_encrypted: Record<string, unknown> | null;
  summary_for_clinician: string | null;
  is_restricted: boolean;
  created_at: string;
}

export interface CreatePsychometricTestRequest {
  patient_id: string;
  test_name: string;
  raw_data_encrypted?: Record<string, unknown>;
  summary_for_clinician?: string;
}
