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
  machine_id: string | null;
  dialyzer_id: string | null;
  slot_id: string | null;
  dialyzer_use: number | null;
}

export interface CreateDialysisSessionRequest {
  patient_id: string;
  /** The patient's dialyzer: its use is counted; refused when shared, discarded or used up. */
  dialyzer_id?: string;
  /** The booked shift; it names the machine. */
  slot_id?: string;
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

// ── Dialysis unit: machines, dialyzers, shifts ──────────────────────────

export type DialysisSerology = "none" | "hbsag" | "hcv" | "hiv";
export type DialysisShift = "morning" | "afternoon" | "evening" | "night";

export interface DialysisMachine {
  id: string;
  code: string;
  name: string;
  serology: DialysisSerology;
  status: "active" | "maintenance" | "retired";
  location: string | null;
}

export interface SaveDialysisMachineRequest {
  code: string;
  name: string;
  serology: DialysisSerology;
  status?: "active" | "maintenance" | "retired";
  location?: string;
}

export interface Dialyzer {
  id: string;
  patient_id: string;
  label: string;
  model: string | null;
  serology: DialysisSerology;
  max_uses: number;
  uses: number;
  baseline_tcv_ml: string | null;
  last_tcv_ml: string | null;
  status: "in_use" | "discarded";
  discard_reason: string | null;
  issued_at: string;
}

export interface IssueDialyzerRequest {
  patient_id: string;
  label: string;
  model?: string;
  serology: DialysisSerology;
  baseline_tcv_ml?: number;
}

export interface DialysisSlot {
  id: string;
  machine_id: string;
  machine_code: string;
  patient_id: string;
  patient_name: string | null;
  uhid: string | null;
  slot_date: string;
  shift: DialysisShift;
  serology: DialysisSerology;
  status: "booked" | "completed" | "cancelled";
  created_at: string;
}

export interface BookDialysisSlotRequest {
  machine_id: string;
  patient_id: string;
  slot_date: string;
  shift: DialysisShift;
  serology: DialysisSerology;
}
