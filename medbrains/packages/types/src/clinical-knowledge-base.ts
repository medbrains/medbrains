// Clinical knowledge base (CKB) types — split from index.ts, barrel-re-exported.

// ── Clinical Knowledge Base (CKB) ──
export interface DiagnosisReference {
  icd10_code: string;
  name: string;
  department?: string | null;
  is_notifiable: boolean;
  reporting_body?: string | null;
  report_timeframe?: string | null;
}

export interface NotifiableReport {
  id: string;
  patient_id?: string | null;
  encounter_id?: string | null;
  icd10_code: string;
  disease_name: string;
  reporting_body?: string | null;
  detected_at: string;
  status: string;
  report_ref?: string | null;
  submitted_at?: string | null;
  notes?: string | null;
}

export interface UpdateNotifiableReportRequest {
  status: string;
  report_ref?: string;
  notes?: string;
}

export interface DrugReference {
  generic_name: string;
  inn_name?: string | null;
  atc_code?: string | null;
  max_dose_per_day?: string | null;
  max_single_dose?: string | null;
  dose_per_kg?: string | null;
  renal_adjust_egfr_threshold?: number | null;
  renal_adjust_rule?: string | null;
  hepatic_caution?: string | null;
  pregnancy_category?: string | null;
  brands?: string | null;
  is_nlem: boolean;
}

export interface LabReference {
  test?: string | null;
  analyte: string;
  unit?: string | null;
  normal_low?: number | null;
  normal_high?: number | null;
  critical_low?: number | null;
  critical_high?: number | null;
  category?: string | null;
  pregnancy_low?: number | null;
  pregnancy_high?: number | null;
  elderly_low?: number | null;
  elderly_high?: number | null;
}

export interface StateScheme {
  state_code: string;
  state_name: string;
  scheme_name: string;
  coverage: string;
  drug_count: number;
}

export interface StateFormularyRow {
  generic_name: string;
  scheme_name: string;
  coverage: string;
}

export interface DoseAlert {
  drug_name: string;
  per_dose: string;
  doses_per_day: number;
  total_per_day_label: string;
  max_per_day_label: string;
}

export interface WeightDoseAlert {
  drug_name: string;
  direction: "over" | "under";
  prescribed_per_day_label: string;
  recommended_per_day_label: string;
  weight_kg: number;
}

export interface DoseCheckItem {
  drug_name: string;
  dosage: string;
  frequency: string;
  catalog_item_id?: string;
}

export interface CheckDrugInteractionsRequest {
  drug_names: string[];
  patient_id?: string;
  items?: DoseCheckItem[];
}

export interface CreateDrugInteractionRequest {
  drug_a_name: string;
  drug_b_name: string;
  severity: "minor" | "moderate" | "major" | "contraindicated";
  description: string;
  mechanism?: string;
  management?: string;
}

export interface CriticalValueRule {
  id: string;
  tenant_id: string;
  test_code: string;
  test_name: string;
  low_critical: number | null;
  high_critical: number | null;
  unit: string | null;
  age_min: number | null;
  age_max: number | null;
  gender: string | null;
  alert_message: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCriticalValueRuleRequest {
  test_code: string;
  test_name: string;
  low_critical?: number;
  high_critical?: number;
  unit?: string;
  age_min?: number;
  age_max?: number;
  gender?: string;
  alert_message: string;
}

export interface ClinicalProtocol {
  id: string;
  tenant_id: string;
  name: string;
  code: string | null;
  category: string;
  description: string | null;
  trigger_conditions: unknown[];
  steps: unknown[];
  department_id: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateClinicalProtocolRequest {
  name: string;
  code?: string;
  category: string;
  description?: string;
  trigger_conditions?: unknown[];
  steps?: unknown[];
  department_id?: string;
}

export interface RestrictedDrugApproval {
  id: string;
  tenant_id: string;
  prescription_id: string | null;
  encounter_id: string;
  patient_id: string;
  drug_name: string;
  catalog_item_id: string | null;
  reason: string;
  requested_by: string;
  approved_by: string | null;
  status: "pending" | "approved" | "denied" | "expired";
  approved_at: string | null;
  denied_reason: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateRestrictedDrugApprovalRequest {
  encounter_id: string;
  patient_id: string;
  drug_name: string;
  catalog_item_id?: string;
  reason: string;
}

export interface PreAuthorizationRequest {
  id: string;
  tenant_id: string;
  patient_id: string;
  encounter_id: string;
  insurance_provider: string;
  policy_number: string | null;
  procedure_codes: string[];
  diagnosis_codes: string[];
  estimated_cost: number | null;
  status: "pending" | "submitted" | "approved" | "denied" | "expired";
  auth_number: string | null;
  approved_amount: number | null;
  valid_from: string | null;
  valid_until: string | null;
  notes: string | null;
  submitted_by: string;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePreAuthRequest {
  patient_id: string;
  encounter_id: string;
  insurance_provider: string;
  policy_number?: string;
  procedure_codes?: string[];
  diagnosis_codes?: string[];
  estimated_cost?: number;
  notes?: string;
}

export interface UpdatePreAuthRequest {
  status?: string;
  auth_number?: string;
  approved_amount?: number;
  valid_from?: string;
  valid_until?: string;
  notes?: string;
}

export interface PgLogbookEntry {
  id: string;
  tenant_id: string;
  user_id: string;
  encounter_id: string | null;
  entry_type: "case" | "procedure" | "ward_round" | "emergency" | "seminar" | "other";
  title: string;
  description: string | null;
  diagnosis_codes: string[];
  procedure_codes: string[];
  department_id: string | null;
  supervisor_id: string | null;
  supervisor_verified: boolean;
  verified_at: string | null;
  entry_date: string;
  created_at: string;
  updated_at: string;
}

export interface CreatePgLogbookRequest {
  encounter_id?: string;
  entry_type: string;
  title: string;
  description?: string;
  diagnosis_codes?: string[];
  procedure_codes?: string[];
  department_id?: string;
  supervisor_id?: string;
  entry_date?: string;
}

export interface CoSignatureRequest {
  id: string;
  tenant_id: string;
  encounter_id: string;
  order_type: "prescription" | "procedure" | "lab_order" | "referral" | "other";
  order_id: string;
  requested_by: string;
  approver_id: string;
  status: "pending" | "approved" | "denied";
  approved_at: string | null;
  denied_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCoSignatureRequest {
  encounter_id: string;
  order_type: string;
  order_id: string;
  approver_id: string;
}
