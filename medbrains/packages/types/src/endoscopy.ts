// Endoscopy types — split from index.ts, barrel-re-exported.

// ── Endoscopy ──

export type ScopeStatus = "available" | "in_use" | "reprocessing" | "quarantine" | "decommissioned";

export type HldResult = "pass" | "fail" | "pending";

export interface EndoscopyProcedure {
  id: string;
  tenant_id: string;
  patient_id: string;
  scope_id: string | null;
  procedure_type: string;
  sedation_type: string | null;
  findings: Record<string, unknown> | null;
  biopsy_taken: boolean;
  sedation_drugs: Record<string, unknown> | null;
  aldrete_score_pre: number | null;
  aldrete_score_post: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateEndoscopyProcedureRequest {
  patient_id: string;
  scope_id?: string;
  procedure_type: string;
  sedation_type?: string;
  findings?: Record<string, unknown>;
  sedation_drugs?: Record<string, unknown>;
  aldrete_score_pre?: number;
  aldrete_score_post?: number;
}

export interface EndoscopyScope {
  id: string;
  tenant_id: string;
  serial_number: string;
  model: string | null;
  scope_type: string | null;
  status: ScopeStatus;
  last_hld_at: string | null;
  total_uses: number;
  last_culture_date: string | null;
  last_culture_result: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateEndoscopyScopeRequest {
  serial_number: string;
  model?: string;
  scope_type?: string;
}

export interface EndoscopyReprocessing {
  id: string;
  tenant_id: string;
  scope_id: string;
  procedure_id: string | null;
  leak_test_passed: boolean;
  hld_chemical: string | null;
  hld_concentration: string | null;
  hld_soak_minutes: number | null;
  hld_temperature: number | null;
  hld_result: HldResult;
  reprocessed_by: string;
  created_at: string;
}

export interface CreateEndoscopyReprocessingRequest {
  scope_id: string;
  procedure_id?: string;
  leak_test_passed: boolean;
  hld_chemical?: string;
  hld_concentration?: string;
  hld_soak_minutes?: number;
  hld_temperature?: number;
  hld_result: HldResult;
}

export interface EndoscopyBiopsySpecimen {
  id: string;
  tenant_id: string;
  procedure_id: string;
  site: string;
  container_label: string | null;
  fixative: string | null;
  chain_of_custody: Record<string, unknown> | null;
  pathology_result: string | null;
  created_at: string;
}

export interface CreateEndoscopyBiopsyRequest {
  site: string;
  container_label?: string;
  fixative?: string;
  chain_of_custody?: Record<string, unknown>;
}
