// Regulatory & compliance types — split from index.ts, barrel-re-exported.

// ── Regulatory & Compliance ─────────────────────────────────

export type ComplianceChecklistStatus =
  | "not_started"
  | "in_progress"
  | "compliant"
  | "non_compliant"
  | "not_applicable";
export type AdverseEventSeverity = "mild" | "moderate" | "severe" | "fatal";
export type AdverseEventStatus = "draft" | "submitted" | "under_review" | "closed" | "withdrawn";
export type PcpndtFormStatus = "draft" | "submitted" | "registered" | "expired";

export interface ComplianceChecklist {
  id: string;
  tenant_id: string;
  department_id?: string;
  accreditation_body: string;
  standard_code: string;
  name: string;
  description?: string;
  assessment_period_start: string;
  assessment_period_end: string;
  overall_status: ComplianceChecklistStatus;
  compliance_score?: number;
  total_items: number;
  compliant_items: number;
  non_compliant_items: number;
  assessed_by?: string;
  assessed_at?: string;
  next_review_date?: string;
  notes?: string;
  created_by: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ComplianceChecklistItem {
  id: string;
  tenant_id: string;
  checklist_id: string;
  item_number: number;
  criterion: string;
  status: ComplianceChecklistStatus;
  evidence_summary?: string;
  evidence_documents: unknown[];
  gap_description?: string;
  corrective_action?: string;
  target_date?: string;
  responsible_user_id?: string;
  verified_by?: string;
  verified_at?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ComplianceChecklistWithItems extends ComplianceChecklist {
  items: ComplianceChecklistItem[];
}

export interface AdrReport {
  id: string;
  tenant_id: string;
  report_number: string;
  patient_id?: string;
  reporter_id: string;
  reporter_type: string;
  drug_name: string;
  drug_generic_name?: string;
  drug_batch_number?: string;
  manufacturer?: string;
  reaction_description: string;
  onset_date?: string;
  reaction_date: string;
  severity: AdverseEventSeverity;
  outcome?: string;
  causality_assessment?: string;
  status: AdverseEventStatus;
  seriousness_criteria: unknown[];
  dechallenge?: string;
  rechallenge?: string;
  concomitant_drugs: unknown[];
  relevant_history?: string;
  submitted_to_pvpi: boolean;
  pvpi_reference?: string;
  submitted_at?: string;
  created_by: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface MateriovigilanceReport {
  id: string;
  tenant_id: string;
  report_number: string;
  patient_id?: string;
  reporter_id: string;
  device_name: string;
  device_manufacturer?: string;
  device_model?: string;
  device_batch?: string;
  event_description: string;
  event_date: string;
  severity: AdverseEventSeverity;
  patient_outcome?: string;
  device_action?: string;
  status: AdverseEventStatus;
  submitted_to_cdsco: boolean;
  cdsco_reference?: string;
  submitted_at?: string;
  investigation_findings?: string;
  corrective_action?: string;
  created_by: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface PcpndtForm {
  id: string;
  tenant_id: string;
  form_number: string;
  patient_id: string;
  referral_doctor_id?: string;
  performing_doctor_id: string;
  procedure_type: string;
  indication: string;
  gestational_age_weeks?: number;
  lmp_date?: string;
  declaration_text?: string;
  status: PcpndtFormStatus;
  form_signed_at?: string;
  patient_consent_id?: string;
  registered_with?: string;
  registration_date?: string;
  quarterly_report_included: boolean;
  gender_disclosure_blocked: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ComplianceCalendarEvent {
  id: string;
  tenant_id: string;
  title: string;
  description?: string;
  regulatory_body_id?: string;
  event_type: string;
  due_date: string;
  reminder_days: number[];
  department_id?: string;
  assigned_to?: string;
  status: string;
  completed_at?: string;
  completed_by?: string;
  recurrence: string;
  source_table?: string;
  source_id?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ComplianceDashboard {
  accreditation_scores: AccreditationScore[];
  department_scores: DepartmentComplianceScore[];
  upcoming_deadlines: ComplianceCalendarEvent[];
  overdue_items: number;
  total_checklists: number;
  compliant_checklists: number;
  license_expiring_soon: number;
}

export interface AccreditationScore {
  body: string;
  total_standards: number;
  compliant: number;
  non_compliant: number;
  score_percent: number;
}

export interface DepartmentComplianceScore {
  department_id: string;
  department_name: string;
  avg_score: number;
  checklist_count: number;
}

export interface ComplianceGap {
  checklist_id: string;
  checklist_name: string;
  department_id?: string;
  department_name?: string;
  accreditation_body: string;
  non_compliant_items: number;
  gap_descriptions: string[];
}

export interface CreateChecklistRequest {
  department_id?: string;
  accreditation_body: string;
  standard_code: string;
  name: string;
  description?: string;
  assessment_period_start: string;
  assessment_period_end: string;
  next_review_date?: string;
  notes?: string;
}

export interface UpdateChecklistRequest {
  overall_status?: ComplianceChecklistStatus;
  compliance_score?: number;
  next_review_date?: string;
  notes?: string;
}

export interface ChecklistItemInput {
  id?: string;
  item_number: number;
  criterion: string;
  status: ComplianceChecklistStatus;
  evidence_summary?: string;
  evidence_documents?: unknown[];
  gap_description?: string;
  corrective_action?: string;
  target_date?: string;
  responsible_user_id?: string;
}

export interface CreateAdrRequest {
  patient_id?: string;
  reporter_type?: string;
  drug_name: string;
  drug_generic_name?: string;
  drug_batch_number?: string;
  manufacturer?: string;
  reaction_description: string;
  onset_date?: string;
  reaction_date: string;
  severity: AdverseEventSeverity;
  outcome?: string;
  causality_assessment?: string;
  seriousness_criteria?: unknown[];
  dechallenge?: string;
  rechallenge?: string;
  concomitant_drugs?: unknown[];
  relevant_history?: string;
}

export interface UpdateAdrRequest {
  reaction_description?: string;
  severity?: AdverseEventSeverity;
  outcome?: string;
  causality_assessment?: string;
  status?: AdverseEventStatus;
  seriousness_criteria?: unknown[];
  dechallenge?: string;
  rechallenge?: string;
  concomitant_drugs?: unknown[];
  relevant_history?: string;
}

export interface CreateMvRequest {
  patient_id?: string;
  device_name: string;
  device_manufacturer?: string;
  device_model?: string;
  device_batch?: string;
  event_description: string;
  event_date: string;
  severity: AdverseEventSeverity;
  patient_outcome?: string;
  device_action?: string;
  investigation_findings?: string;
  corrective_action?: string;
}

export interface UpdateMvRequest {
  event_description?: string;
  severity?: AdverseEventSeverity;
  patient_outcome?: string;
  device_action?: string;
  status?: AdverseEventStatus;
  investigation_findings?: string;
  corrective_action?: string;
}

export interface CreatePcpndtRequest {
  patient_id: string;
  referral_doctor_id?: string;
  performing_doctor_id: string;
  procedure_type: string;
  indication: string;
  gestational_age_weeks?: number;
  lmp_date?: string;
  declaration_text?: string;
  patient_consent_id?: string;
}

export interface UpdatePcpndtRequest {
  status?: PcpndtFormStatus;
  registered_with?: string;
  registration_date?: string;
  quarterly_report_included?: boolean;
}

export interface CreateCalendarEventRequest {
  title: string;
  description?: string;
  regulatory_body_id?: string;
  event_type: string;
  due_date: string;
  reminder_days?: number[];
  department_id?: string;
  assigned_to?: string;
  recurrence?: string;
}

export interface UpdateCalendarEventRequest {
  title?: string;
  description?: string;
  due_date?: string;
  status?: string;
  assigned_to?: string;
  recurrence?: string;
}

export interface PcpndtQuarterlySummary {
  quarter_start: string;
  total_forms: number;
  by_procedure_type: { procedure_type: string; count: number }[];
}
