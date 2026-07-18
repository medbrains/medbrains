// IPD post-discharge workflow types — split from index.ts, barrel-re-exported.

// ── IPD post-discharge workflow (migration 0108) ──
export type IpdDischargeStep =
  | "discharge_ordered"
  | "bill_closed"
  | "rx_dispensed"
  | "counseling_done"
  | "card_printed"
  | "bed_released"
  | "completed";

export interface IpdDischargeWorkflow {
  id: string;
  tenant_id: string;
  admission_id: string;
  discharge_ordered_at: string | null;
  bill_closed_at: string | null;
  bill_closed_by: string | null;
  rx_dispensed_at: string | null;
  rx_dispensed_by: string | null;
  counseling_done_at: string | null;
  counseling_done_by: string | null;
  counseling_topics: string[] | null;
  card_printed_at: string | null;
  card_printed_by: string | null;
  bed_released_at: string | null;
  bed_released_by: string | null;
  transport_arranged: boolean | null;
  transport_notes: string | null;
  follow_up_appt_id: string | null;
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface IpdDischargeStepUpdate {
  step: IpdDischargeStep;
  counseling_topics?: string[];
  transport_arranged?: boolean;
  transport_notes?: string;
  follow_up_appt_id?: string;
  notes?: string;
}

export interface IpdDamaRecord {
  id: string;
  tenant_id: string;
  admission_id: string;
  record_type: "dama" | "lama";
  declared_at: string;
  declared_by: string | null;
  patient_signed: boolean | null;
  patient_signature_url: string | null;
  relative_name: string | null;
  relative_relation: string | null;
  relative_signed: boolean | null;
  relative_signature_url: string | null;
  witness_name: string | null;
  witness_signed: boolean | null;
  witness_signature_url: string | null;
  risks_explained: string | null;
  reason_for_leaving: string | null;
  is_mlc_case: boolean | null;
  mlc_notification_sent_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface IpdDamaRequest {
  record_type: "dama" | "lama";
  patient_signed?: boolean;
  relative_name?: string;
  relative_relation?: string;
  relative_signed?: boolean;
  witness_name?: string;
  witness_signed?: boolean;
  risks_explained?: string;
  reason_for_leaving?: string;
  is_mlc_case?: boolean;
  notes?: string;
}

export interface IpdPostDischargeRow {
  id: string;
  tenant_id: string;
  admission_id: string;
  patient_id: string;
  survey_sent_at: string | null;
  survey_sent_via: string | null;
  survey_responded_at: string | null;
  survey_score: number | null;
  survey_comments: string | null;
  followup_appt_id: string | null;
  followup_due_date: string | null;
  followup_attended: boolean | null;
  readmitted_within_30d: boolean | null;
  readmission_admission_id: string | null;
  readmission_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface IpdMortalityReview {
  id: string;
  tenant_id: string;
  admission_id: string;
  death_at: string;
  cause_of_death: string | null;
  primary_dx: string | null;
  is_mlc_case: boolean | null;
  autopsy_required: boolean | null;
  autopsy_done_at: string | null;
  review_due_at: string;
  reviewed_at: string | null;
  reviewer_id: string | null;
  review_findings: string | null;
  avoidable: boolean | null;
  contributory_factors: string[] | null;
  action_items: string | null;
  death_summary_signed_at: string | null;
  civil_form_filed_at: string | null;
  body_released_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface IpdMortalityCreate {
  admission_id: string;
  death_at: string;
  cause_of_death?: string;
  primary_dx?: string;
  is_mlc_case?: boolean;
  autopsy_required?: boolean;
}

export interface IpdMortalitySubmit {
  review_findings: string;
  avoidable: boolean;
  contributory_factors?: string[];
  action_items?: string;
}

// Pharmacy
export interface DrugInteractionCheckRequest {
  patient_id: string;
  drug_id: string;
}

export interface DrugInteractionResult {
  interacting_drug: string;
  interaction_type: string;
  severity: string;
  description: string;
}

export interface PrescriptionAuditEntry {
  action: string;
  changed_by: string;
  changed_at: string;
  old_value: string | null;
  new_value: string | null;
  field_name: string;
}

export interface FormularyCheckResult {
  drug_id: string;
  drug_name: string;
  is_formulary: boolean;
  requires_approval: boolean;
  alternative_drugs: string[];
}

// Billing — Service Packages (distinct from existing BillingPackage)
export interface BillingServicePackage {
  id: string;
  tenant_id: string;
  package_name: string;
  package_code: string;
  description: string | null;
  total_amount: number;
  components: unknown[];
  is_active: boolean;
  created_at: string;
}

export interface CreateBillingServicePackageRequest {
  package_name: string;
  package_code: string;
  description?: string;
  total_amount: number;
  components?: unknown[];
}

export interface CopayCalculation {
  invoice_amount: number;
  insurance_coverage: number;
  copay_amount: number;
  deductible: number;
  patient_responsibility: number;
}

export interface ErFastInvoiceRequest {
  emergency_visit_id: string;
  patient_id: string;
  notes?: string | null;
  additional_charges?: Array<{ description: string; amount: number }>;
}

// Billing Concessions
export type ConcessionStatus = "pending" | "approved" | "rejected" | "auto_applied";

export interface BillingConcession {
  id: string;
  tenant_id: string;
  invoice_id: string | null;
  invoice_item_id: string | null;
  patient_id: string;
  concession_type: string;
  original_amount: number;
  concession_percent: number | null;
  concession_amount: number;
  final_amount: number;
  reason: string | null;
  status: ConcessionStatus;
  requested_by: string;
  approved_by: string | null;
  approved_at: string | null;
  auto_rule: string | null;
  source_module: string | null;
  source_entity_id: string | null;
  created_at: string;
}

export interface ConcessionListResponse {
  concessions: BillingConcession[];
  total: number;
  page: number;
  per_page: number;
}

export interface CreateConcessionRequest {
  invoice_id?: string;
  invoice_item_id?: string;
  patient_id: string;
  concession_type: string;
  original_amount: number;
  concession_percent?: number;
  concession_amount: number;
  final_amount: number;
  reason: string;
  source_module?: string;
  source_entity_id?: string;
}

export interface AutoConcessionRulesResponse {
  rules: AutoConcessionRule[];
}

export interface AutoConcessionRule {
  name: string;
  concession_type: string;
  percent: number;
  reason?: string;
  is_active: boolean;
  applicable_modules?: string[];
  patient_categories?: string[];
}

// Camp
export interface CampAnalytics {
  total_camps: number;
  total_registrations: number;
  total_screened: number;
  total_referred: number;
  total_converted: number;
  conversion_rate_pct: number;
  screening_yield_pct: number;
  total_billing: number;
  avg_cost_per_patient: number;
  followup_scheduled: number;
  followup_completed: number;
  followup_compliance_pct: number;
  by_type?: Record<string, number>;
}

export interface CampReport {
  camp: Record<string, unknown>;
  stats: {
    total_registrations: number;
    total_screenings: number;
    referred: number;
    converted: number;
    followups_total: number;
    followups_completed: number;
    billing_total: number;
  };
  generated_at: string;
  generated_by: string;
}

// Facilities
export interface SchedulePmRequest {
  equipment_ids?: string[];
  frequency: string;
  start_date: string;
}

export interface EnergyAnalytics {
  by_source: Array<{ source_type: string; total_kwh: number; total_cost: number }>;
  monthly_trend: Array<{ month: string; total_kwh: number; total_cost: number }>;
  peak_hours: Array<{ hour: number; avg_kwh: number }>;
}

// Front Office
export interface VisitorAnalytics {
  total_visitors: number;
  by_department: Record<string, number>;
  by_hour: Record<string, number>;
  avg_visit_duration_minutes: number;
}

export interface QueueMetrics {
  department: string;
  avg_wait_minutes: number;
  throughput_per_hour: number;
  current_waiting: number;
  longest_wait_minutes: number;
}

// HR
export interface TrainingComplianceRow {
  program_id: string;
  program_name: string;
  total_staff: number;
  completed: number;
  compliance_pct: number;
  is_mandatory: boolean;
}
