// Other-specialties types — split from index.ts, barrel-re-exported.

// ── Other Specialties ──

export interface SpecialtyTemplate {
  id: string;
  tenant_id: string;
  specialty: string;
  template_name: string;
  template_code: string;
  form_schema: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateSpecialtyTemplateRequest {
  specialty: string;
  template_name: string;
  template_code: string;
  form_schema: Record<string, unknown>;
}

export interface SpecialtyRecord {
  id: string;
  tenant_id: string;
  patient_id: string;
  specialty: string;
  template_id: string | null;
  form_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateSpecialtyRecordRequest {
  patient_id: string;
  specialty: string;
  template_id?: string;
  form_data: Record<string, unknown>;
}

export interface DialysisSession {
  id: string;
  tenant_id: string;
  patient_id: string;
  machine_number: string | null;
  access_type: string | null;
  pre_weight_kg: number | null;
  post_weight_kg: number | null;
  uf_goal_ml: number | null;
  uf_achieved_ml: number | null;
  pre_vitals: Record<string, unknown> | null;
  post_vitals: Record<string, unknown> | null;
  kt_v: number | null;
  urr_pct: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDialysisSessionRequest {
  patient_id: string;
  machine_number?: string;
  access_type?: string;
  pre_weight_kg?: number;
  uf_goal_ml?: number;
  duration_minutes?: number;
  pre_vitals?: Record<string, unknown>;
}

export interface CreateDialysisResponse {
  session: DialysisSession;
  uf_rate_ml_kg_hr: number | null;
  uf_rate_exceeds_safe: boolean;
}

export interface ChemoProtocol {
  id: string;
  tenant_id: string;
  patient_id: string;
  protocol_name: string;
  cancer_type: string | null;
  staging: string | null;
  regimen: Record<string, unknown> | null;
  cycle_number: number;
  toxicity_grade: number | null;
  recist_response: string | null;
  tumor_board_reviewed: boolean;
  tumor_board_date: string | null;
  anthracycline_agent: string | null;
  anthracycline_dose_mg_m2: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateChemoProtocolRequest {
  patient_id: string;
  protocol_name: string;
  cancer_type?: string;
  staging?: string;
  regimen?: Record<string, unknown>;
  cycle_number?: number;
  toxicity_grade?: number;
  recist_response?: string;
  tumor_board_reviewed?: boolean;
  tumor_board_date?: string;
  anthracycline_agent?: string;
  anthracycline_dose_mg_m2?: number;
}

export interface AnthracyclineCumulativeResult {
  agent: string;
  cumulative_mg_m2: number;
  ceiling_mg_m2: number | null;
  remaining_mg_m2: number | null;
  near_ceiling: boolean;
  over_ceiling: boolean;
}
