// Chronic care program/enrollment/adherence types — split from index.ts, barrel-re-exported.
import type {
  AdherenceEventType,
  ChronicProgramType,
  EnrollmentStatus,
  MedicationEventType,
  TransferType,
} from "./index";

// ── Chronic Care Requests ────────────────────────────────

export interface CreateChronicProgramRequest {
  name: string;
  code: string;
  program_type: ChronicProgramType;
  description?: string;
  protocol_id?: string;
  default_duration_months?: number;
  target_outcomes?: unknown[];
  monitoring_schedule?: unknown[];
}

export interface CreateChronicEnrollmentRequest {
  patient_id: string;
  program_id: string;
  primary_doctor_id?: string;
  enrollment_date?: string;
  expected_end_date?: string;
  diagnosis_id?: string;
  icd_code?: string;
  target_overrides?: unknown;
  notes?: string;
}

export interface UpdateEnrollmentStatusRequest {
  status: EnrollmentStatus;
  status_reason?: string;
}

export interface CreateTimelineEventRequest {
  patient_id: string;
  enrollment_id?: string;
  prescription_item_id?: string;
  encounter_id?: string;
  event_type: MedicationEventType;
  drug_name: string;
  generic_name?: string;
  atc_code?: string;
  catalog_item_id?: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  previous_dosage?: string;
  previous_frequency?: string;
  change_reason?: string;
  switched_from_drug?: string;
  effective_date?: string;
  end_date?: string;
}

export interface RecordAdherenceRequest {
  patient_id: string;
  enrollment_id: string;
  event_type: AdherenceEventType;
  event_date?: string;
  drug_name?: string;
  appointment_id?: string;
  pharmacy_order_id?: string;
  notes?: string;
}

export interface CreateOutcomeTargetRequest {
  patient_id: string;
  enrollment_id?: string;
  parameter_name: string;
  loinc_code?: string;
  target_value: number;
  unit: string;
  comparison: string;
  effective_from?: string;
  notes?: string;
}

export interface UpdateOutcomeTargetRequest {
  target_value?: number;
  comparison?: string;
  notes?: string;
}

// ══════════════════════════════════════════════════════════
//  Retrospective Data Entry
// ══════════════════════════════════════════════════════════

export type RetrospectiveEntryStatus = "pending" | "approved" | "rejected";

export interface RetrospectiveEntry {
  id: string;
  source_table: string;
  source_record_id: string;
  clinical_event_date: string;
  entry_date: string;
  entered_by: string;
  reason: string;
  status: RetrospectiveEntryStatus;
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
  created_at: string;
  entered_by_name?: string;
  reviewed_by_name?: string;
}

export interface RetrospectiveSettings {
  max_backdate_hours: number;
  requires_approval: boolean;
}

export interface CreateRetroEncounterRequest {
  patient_id: string;
  department_id: string;
  doctor_id: string;
  clinical_event_date: string;
  reason: string;
  visit_type?: string;
  chief_complaint?: string;
  notes?: string;
}

export interface ApproveRejectRequest {
  review_notes?: string;
}

// ══════════════════════════════════════════════════════════
//  Occupational Health
// ══════════════════════════════════════════════════════════

export type DrugScreenStatus =
  | "ordered"
  | "collected"
  | "sent_to_lab"
  | "mro_review"
  | "positive"
  | "negative"
  | "inconclusive"
  | "cancelled";
export type RtwClearanceStatus =
  | "pending_evaluation"
  | "cleared_full"
  | "cleared_with_restrictions"
  | "not_cleared"
  | "follow_up_required";

export interface OccHealthScreening {
  id: string;
  tenant_id: string;
  employee_id: string;
  examiner_id?: string;
  screening_type: string;
  screening_date: string;
  fitness_status: string;
  findings: Record<string, unknown>;
  restrictions: unknown[];
  next_due_date?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface OccHealthDrugScreen {
  id: string;
  tenant_id: string;
  employee_id: string;
  screening_id?: string;
  specimen_id?: string;
  status: DrugScreenStatus;
  chain_of_custody: Record<string, unknown>;
  panel: string;
  results: Record<string, unknown>;
  mro_reviewer_id?: string;
  mro_decision?: string;
  mro_reviewed_at?: string;
  collected_at?: string;
  created_at: string;
  updated_at: string;
}

export interface OccHealthVaccination {
  id: string;
  tenant_id: string;
  employee_id: string;
  vaccine_name: string;
  dose_number: number;
  administered_date: string;
  batch_number?: string;
  administered_by?: string;
  next_due_date?: string;
  is_compliant: boolean;
  exemption_type?: string;
  exemption_reason?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface OccHealthInjuryReport {
  id: string;
  tenant_id: string;
  employee_id: string;
  report_number: string;
  injury_date: string;
  injury_type: string;
  injury_description?: string;
  body_part_affected?: string;
  location_of_incident?: string;
  is_osha_recordable: boolean;
  lost_work_days: number;
  restricted_days: number;
  workers_comp_claim_number?: string;
  workers_comp_status?: string;
  rtw_status: RtwClearanceStatus;
  rtw_restrictions: unknown[];
  rtw_cleared_date?: string;
  rtw_cleared_by?: string;
  employer_access_notes?: string;
  reported_by?: string;
  created_at: string;
  updated_at: string;
}

export interface VaccinationComplianceRow {
  vaccine_name: string;
  total_employees: number;
  compliant_count: number;
  compliance_pct: number;
}

export interface EmployerViewResponse {
  id: string;
  employee_id: string;
  report_number: string;
  injury_date: string;
  injury_type: string;
  is_osha_recordable: boolean;
  lost_work_days: number;
  restricted_days: number;
  rtw_status: RtwClearanceStatus;
  rtw_restrictions: unknown[];
  employer_access_notes?: string;
}

export interface CreateOccScreeningRequest {
  employee_id: string;
  screening_type: string;
  screening_date: string;
  fitness_status?: string;
  findings?: Record<string, unknown>;
  restrictions?: unknown[];
  next_due_date?: string;
  examiner_id?: string;
  notes?: string;
}

export interface UpdateOccScreeningRequest {
  fitness_status?: string;
  findings?: Record<string, unknown>;
  restrictions?: unknown[];
  next_due_date?: string;
  notes?: string;
}

export interface CreateDrugScreenRequest {
  employee_id: string;
  screening_id?: string;
  panel?: string;
}

export interface UpdateDrugScreenRequest {
  status?: DrugScreenStatus;
  results?: Record<string, unknown>;
  mro_decision?: string;
}

export interface CreateVaccinationRequest {
  employee_id: string;
  vaccine_name: string;
  dose_number?: number;
  administered_date: string;
  batch_number?: string;
  next_due_date?: string;
  is_compliant?: boolean;
  exemption_type?: string;
  exemption_reason?: string;
  notes?: string;
}

export interface CreateInjuryRequest {
  employee_id: string;
  injury_date: string;
  injury_type: string;
  injury_description?: string;
  body_part_affected?: string;
  location_of_incident?: string;
  is_osha_recordable?: boolean;
}

export type ExposureType = "needlestick" | "sharps_cut" | "mucocutaneous" | "other";
export type SourceSerostatus = "positive" | "negative" | "unknown";

export interface OccHealthExposure {
  id: string;
  tenant_id: string;
  employee_id: string;
  exposure_at: string;
  exposure_type: ExposureType;
  device: string | null;
  body_site: string | null;
  source_patient_id: string | null;
  source_known: boolean;
  source_hiv: SourceSerostatus;
  source_hbv: SourceSerostatus;
  source_hcv: SourceSerostatus;
  first_aid_done: boolean;
  pep_recommended: boolean;
  pep_started: boolean;
  pep_details: string | null;
  notes: string | null;
  reported_by: string | null;
  created_at: string;
}

export interface CreateStaffExposureRequest {
  employee_id: string;
  exposure_at: string;
  exposure_type: ExposureType;
  device?: string;
  body_site?: string;
  source_patient_id?: string;
  source_known?: boolean;
  source_hiv?: SourceSerostatus;
  source_hbv?: SourceSerostatus;
  source_hcv?: SourceSerostatus;
  first_aid_done?: boolean;
  pep_started?: boolean;
  pep_details?: string;
  notes?: string;
}

export interface UpdateInjuryRequest {
  injury_description?: string;
  is_osha_recordable?: boolean;
  lost_work_days?: number;
  restricted_days?: number;
  workers_comp_claim_number?: string;
  workers_comp_status?: string;
  rtw_status?: RtwClearanceStatus;
  rtw_restrictions?: unknown[];
  employer_access_notes?: string;
}

// ══════════════════════════════════════════════════════════
//  Utilization Review
// ══════════════════════════════════════════════════════════

export type UrReviewType = "pre_admission" | "admission" | "continued_stay" | "retrospective";
export type UrDecision = "approved" | "denied" | "pending_info" | "modified" | "escalated";

export interface UtilizationReview {
  id: string;
  tenant_id: string;
  admission_id: string;
  patient_id: string;
  reviewer_id?: string;
  review_type: UrReviewType;
  review_date: string;
  patient_status: string;
  decision: UrDecision;
  criteria_source?: string;
  criteria_met: unknown[];
  clinical_summary?: string;
  expected_los_days?: number;
  actual_los_days?: number;
  is_outlier: boolean;
  approved_days?: number;
  next_review_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface UrPayerCommunication {
  id: string;
  tenant_id: string;
  review_id: string;
  communication_type: string;
  payer_name: string;
  reference_number?: string;
  communicated_at: string;
  summary?: string;
  response?: string;
  attachments: unknown[];
  communicated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface UrStatusConversion {
  id: string;
  tenant_id: string;
  admission_id: string;
  from_status: string;
  to_status: string;
  conversion_date: string;
  reason?: string;
  effective_from: string;
  converted_by?: string;
  created_at: string;
  updated_at: string;
}

export interface UrAnalyticsSummary {
  total_reviews: number;
  avg_expected_los?: number;
  avg_actual_los?: number;
  outlier_count: number;
  denial_count: number;
  approval_rate: number;
}

export interface LosComparisonRow {
  department_name?: string;
  review_count: number;
  avg_expected_los?: number;
  avg_actual_los?: number;
}

export interface CreateUrReviewRequest {
  admission_id: string;
  patient_id: string;
  review_type: UrReviewType;
  patient_status?: string;
  criteria_source?: string;
  criteria_met?: unknown[];
  clinical_summary?: string;
  expected_los_days?: number;
  actual_los_days?: number;
  approved_days?: number;
  next_review_date?: string;
  notes?: string;
}

export interface UpdateUrReviewRequest {
  decision?: UrDecision;
  criteria_met?: unknown[];
  clinical_summary?: string;
  expected_los_days?: number;
  actual_los_days?: number;
  approved_days?: number;
  next_review_date?: string;
  notes?: string;
}

export interface CreateUrCommunicationRequest {
  review_id: string;
  communication_type: string;
  payer_name: string;
  reference_number?: string;
  summary?: string;
}

export interface CreateUrConversionRequest {
  admission_id: string;
  from_status: string;
  to_status: string;
  reason?: string;
}

// ══════════════════════════════════════════════════════════
//  Case Management
// ══════════════════════════════════════════════════════════

export type CaseMgmtStatus = "assigned" | "active" | "pending_discharge" | "discharged" | "closed";
export type DischargeBarrierType =
  | "insurance_auth"
  | "placement"
  | "equipment"
  | "family"
  | "transport"
  | "financial"
  | "clinical"
  | "documentation"
  | "other";

export interface CaseAssignment {
  id: string;
  tenant_id: string;
  admission_id: string;
  patient_id: string;
  case_manager_id: string;
  status: CaseMgmtStatus;
  priority: string;
  target_discharge_date?: string;
  actual_discharge_date?: string;
  discharge_disposition?: string;
  disposition_details: Record<string, unknown>;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface DischargeBarrier {
  id: string;
  tenant_id: string;
  case_assignment_id: string;
  barrier_type: DischargeBarrierType;
  description: string;
  identified_date: string;
  is_resolved: boolean;
  resolved_date?: string;
  resolved_by?: string;
  escalated_to?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CaseReferral {
  id: string;
  tenant_id: string;
  case_assignment_id: string;
  referral_type: string;
  referred_to: string;
  status: string;
  facility_details: Record<string, unknown>;
  outcome?: string;
  referred_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CaseloadRow {
  case_manager_id: string;
  active_cases: number;
  pending_discharge: number;
  total_cases: number;
}

export interface DispositionRow {
  disposition?: string;
  count: number;
}

export interface BarrierAnalyticsRow {
  barrier_type: string;
  count: number;
  avg_days_open?: number;
}

export interface OutcomeAnalytics {
  avg_days_to_discharge?: number;
  total_discharged: number;
  total_with_barriers: number;
}

export interface CreateCaseAssignmentRequest {
  admission_id: string;
  patient_id: string;
  case_manager_id: string;
  priority?: string;
  target_discharge_date?: string;
  notes?: string;
}

export interface UpdateCaseAssignmentRequest {
  status?: CaseMgmtStatus;
  priority?: string;
  target_discharge_date?: string;
  actual_discharge_date?: string;
  discharge_disposition?: string;
  disposition_details?: Record<string, unknown>;
  notes?: string;
}

export interface AutoAssignRequest {
  admission_id: string;
  patient_id: string;
  priority?: string;
}

export interface CreateDischargeBarrierRequest {
  case_assignment_id: string;
  barrier_type: DischargeBarrierType;
  description: string;
}

export interface UpdateDischargeBarrierRequest {
  description?: string;
  is_resolved?: boolean;
  escalated_to?: string;
  notes?: string;
}

export interface CreateCaseReferralRequest {
  case_assignment_id: string;
  referral_type: string;
  referred_to: string;
  facility_details?: Record<string, unknown>;
}

export interface UpdateCaseReferralRequest {
  status?: string;
  outcome?: string;
  facility_details?: Record<string, unknown>;
}

// ══════════════════════════════════════════════════════════
//  Scheduling / No-Show AI
// ══════════════════════════════════════════════════════════

export interface NoshowPredictionScore {
  id: string;
  tenant_id: string;
  appointment_id: string;
  patient_id: string;
  predicted_noshow_probability: number;
  risk_level: string;
  features_used: Record<string, unknown>;
  model_version: string;
  scored_at: string;
  created_at: string;
}

export interface SchedulingWaitlistEntry {
  id: string;
  tenant_id: string;
  patient_id: string;
  doctor_id?: string;
  department_id?: string;
  preferred_date_from?: string;
  preferred_date_to?: string;
  preferred_time_from?: string;
  preferred_time_to?: string;
  priority: string;
  status: string;
  offered_appointment_id?: string;
  reason?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface SchedulingOverbookingRule {
  id: string;
  tenant_id: string;
  doctor_id: string;
  department_id: string;
  day_of_week: number;
  max_overbook_slots: number;
  overbook_threshold_probability: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OverbookingRecommendation {
  doctor_id: string;
  department_id: string;
  date: string;
  day_of_week: number;
  max_overbook_slots: number;
  threshold_probability: number;
  recommendation: string;
}

export interface AutoFillResult {
  waiting_count: number;
  message: string;
}

export interface NoshowRateRow {
  doctor_id?: string;
  department_id?: string;
  total_appointments: number;
  noshow_count: number;
  noshow_rate?: number;
}

export interface PredictionAccuracyReport {
  model_version: string;
  total_predictions: number;
  message: string;
}

export interface WaitlistStatsResponse {
  total_waiting: number;
  total_offered: number;
  total_booked: number;
  avg_wait_days?: number;
}

export interface ScoreAppointmentRequest {
  appointment_id: string;
}

export interface ScoreBatchRequest {
  appointment_ids: string[];
}

export interface CreateWaitlistRequest {
  patient_id: string;
  doctor_id?: string;
  department_id?: string;
  preferred_date_from?: string;
  preferred_date_to?: string;
  preferred_time_from?: string;
  preferred_time_to?: string;
  priority?: string;
  reason?: string;
}

export interface UpdateWaitlistRequest {
  preferred_date_from?: string;
  preferred_date_to?: string;
  preferred_time_from?: string;
  preferred_time_to?: string;
  priority?: string;
  status?: string;
}

export interface OfferSlotRequest {
  offered_appointment_id: string;
}

export interface RespondToOfferRequest {
  accept: boolean;
}

export interface CreateOverbookingRuleRequest {
  doctor_id: string;
  department_id: string;
  day_of_week: number;
  max_overbook_slots?: number;
  overbook_threshold_probability?: number;
}

export interface UpdateOverbookingRuleRequest {
  max_overbook_slots?: number;
  overbook_threshold_probability?: number;
  is_active?: boolean;
}

// ══════════════════════════════════════════════════════════
//  Batch 2 Analytics & New Endpoint Types
// ══════════════════════════════════════════════════════════

// Quality — auto-calculate, pending acks, evidence
export interface PendingAckUser {
  user_id: string;
  full_name: string;
}

export interface AutoScheduleRequest {
  months_ahead?: number;
}

export interface EvidenceCompilation {
  accreditation_body: string;
  total_standards: number;
  compliant_count: number;
  compliance_rate: number;
  non_compliant_items: unknown[];
}

// Lab — TAT analytics, auto-validate, crossmatch
export interface LabTatAnalyticsRow {
  test_name: string;
  total_orders: number;
  avg_tat_minutes: number | null;
  p95_tat_minutes: number | null;
  within_sla: number;
}

export interface AutoValidateResult {
  result_id: string;
  auto_validated: boolean;
  message: string;
}

export interface LabCrossmatchLink {
  order_id: string;
  patient_id: string;
  crossmatch_requests: unknown[];
}

// ICU — LOS analytics, device infections
export interface IcuLosAnalytics {
  total_admissions: number;
  avg_los_days: number | null;
  median_los_days: number | null;
  readmission_count: number;
  readmission_rate: number | null;
}

export interface DeviceInfectionRate {
  device_type: string;
  total_device_days: number;
  infection_count: number;
  rate_per_1000: number | null;
}

// BME — MTBF, uptime
export interface BmeMtbfRow {
  equipment_id: string;
  equipment_name: string;
  total_operating_hours: number | null;
  breakdown_count: number;
  mtbf_hours: number | null;
}

export interface BmeUptimeRow {
  equipment_id: string;
  equipment_name: string;
  total_days: number | null;
  downtime_days: number | null;
  uptime_percent: number | null;
}

// Blood Bank — TTI report, hemovigilance
export interface TtiReportRow {
  tti_status: string;
  count: number;
}

export interface TtiReport {
  total_components: number;
  by_status: TtiReportRow[];
}

export interface HemovigilanceRow {
  reaction_type: string | null;
  severity: string | null;
  count: number;
}

export interface HemovigilanceReport {
  reporting_period: string;
  total_transfusions: number;
  total_reactions: number;
  reaction_rate_percent: number;
  reactions_by_type: HemovigilanceRow[];
}

// Radiology — TAT, appointments
export interface RadiologyTatRow {
  modality_name: string;
  total_orders: number;
  avg_tat_hours: number | null;
  completed_count: number;
}

export interface CreateRadiologyAppointmentRequest {
  patient_id: string;
  modality_id: string;
  encounter_id: string;
  test_id?: string;
  priority?: string;
  notes?: string;
}

// Housekeeping — BMW schedule, sharp replacement
export interface BmwScheduleEntry {
  ward: string;
  category: string;
  total_weight_kg: number;
  record_count: number;
  latest_collection: string | null;
}

export interface SharpReplacementRequest {
  location_id: string;
  container_type?: string;
  notes?: string;
}

// Emergency — ER-to-IPD admission
export interface AdmitFromErRequest {
  bed_id: string;
  admitting_doctor_id: string;
  admission_notes?: string;
}

export interface AdmitFromErResponse {
  er_visit_id: string;
  admission_id: string;
  encounter_id: string;
  patient_id: string;
  ward_id: string | null;
  bed_id: string;
  status: "admitted";
}

// ══════════════════════════════════════════════════════════
//  Batch 2 — Analytics & Reporting Types
// ══════════════════════════════════════════════════════════

// Infection Control Analytics
export interface HaiRateRow {
  infection_type: string;
  count: number;
  patient_days: number;
  rate_per_1000: number;
}

export interface DeviceUtilizationRow {
  unit_name: string;
  device_type: string;
  device_days: number;
  patient_days: number;
  utilization_ratio: number;
}

export interface AntimicrobialConsumptionRow {
  drug_name: string;
  atc_code: string | null;
  total_ddd: number;
  patient_days: number;
  ddd_per_1000: number;
}

export interface SurgicalProphylaxisRow {
  procedure_type: string;
  total_cases: number;
  timely_count: number;
  compliance_pct: number;
}

export interface CultureSensitivityRow {
  organism: string;
  antibiotic: string;
  sensitive_count: number;
  resistant_count: number;
  intermediate_count: number;
  total_tests: number;
  sensitivity_pct: number;
}

export interface MdroRow {
  organism: string;
  month: string;
  case_count: number;
  rate_per_1000: number;
}

export interface CreateExposureRequest {
  event_type: string;
  source_patient_id?: string;
  exposed_staff_id?: string;
  exposure_date: string;
  exposure_type: string;
  pep_initiated: boolean;
  details?: Record<string, unknown>;
  notes?: string;
}

export interface IcMeeting {
  id: string;
  tenant_id: string;
  meeting_date: string;
  meeting_type: string;
  attendees: unknown[];
  agenda: string | null;
  minutes: string | null;
  action_items: unknown[];
  created_at: string;
}

export interface CreateIcMeetingRequest {
  meeting_date: string;
  meeting_type?: string;
  attendees?: string[];
  agenda?: string;
  minutes?: string;
}

export interface MonthlySurveillanceReport {
  month: string;
  hai_count: number;
  hai_rate: number;
  hand_hygiene_compliance: number;
  bmw_total_kg: number;
  culture_count: number;
  mdro_count: number;
  outbreak_count: number;
}

export interface CreateOutbreakRcaRequest {
  methodology: string;
  root_causes: string[];
  contributing_factors: string[];
  corrective_actions: string[];
  notes?: string;
}

// Quality Analytics
export interface ScheduleAuditsRequest {
  template_audit_id?: string;
  department_ids: string[];
  frequency: string;
  start_date: string;
  end_date: string;
}

export interface AuditFinding {
  id: string;
  audit_id: string;
  finding_type: string;
  description: string;
  severity: string;
  recommendation: string | null;
  status: string;
  created_at: string;
}

export interface CreateAuditFindingRequest {
  finding_type: string;
  description: string;
  severity: string;
  recommendation?: string;
}

export interface CommitteeDashboard {
  total_meetings_scheduled: number;
  meetings_held: number;
  action_items_open: number;
  action_items_closed: number;
  action_items_overdue: number;
}

export interface CreateMortalityReviewRequest {
  patient_id: string;
  death_date: string;
  primary_diagnosis: string;
  contributing_factors?: string[];
  review_findings?: string;
  preventability?: string;
  recommendations?: string[];
}

export interface PatientSafetyIndicator {
  indicator_name: string;
  event_count: number;
  patient_days: number;
  rate_per_1000: number;
  benchmark: number | null;
}

export interface DepartmentScorecard {
  department_id: string;
  department_name: string;
  overall_score: number;
  indicator_scores: Record<string, number>;
}

// Regulatory
export interface AutoPopulateRequest {
  standard_ids?: string[];
}

export interface RegulatorySubmission {
  id: string;
  tenant_id: string;
  submission_type: string;
  submitted_to: string;
  reference_number: string | null;
  submitted_at: string;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface CreateRegulatorySubmissionRequest {
  submission_type: string;
  submitted_to: string;
  reference_number?: string;
  submitted_at: string;
  status?: string;
  notes?: string;
}

export interface StaffCredentialSummary {
  employee_id: string;
  employee_name: string;
  credential_type: string;
  expiry_date: string | null;
  days_until_expiry: number | null;
  status: string;
}

export interface LicenseDashboardItem {
  id: string;
  license_type: string;
  license_number: string | null;
  issued_date: string | null;
  expiry_date: string | null;
  days_until_expiry: number | null;
  renewal_status: string;
  responsible_person: string | null;
}

export interface NablDocumentSummary {
  document_type: string;
  total_required: number;
  total_uploaded: number;
  completeness_pct: number;
}

// Setup
export interface BulkCreateUsersRequest {
  users: Array<{
    username: string;
    email: string;
    password: string;
    full_name: string;
    role_id: string;
  }>;
}

export interface CompletenessCheck {
  departments: number;
  users: number;
  roles: number;
  services: number;
  locations: number;
  drugs: number;
  lab_tests: number;
}

export interface SystemHealth {
  user_count: number;
  department_count: number;
  module_count: number;
  migration_count: number;
  table_sizes: Record<string, number>;
}

// Scheduling
export interface SchedulingConflict {
  resource_id: string;
  resource_name: string;
  slot_a_id: string;
  slot_b_id: string;
  overlap_start: string;
  overlap_end: string;
}

export interface ScheduleAnalytics {
  total_slots: number;
  utilized_slots: number;
  utilization_rate: number;
  no_show_count: number;
  no_show_rate: number;
  avg_wait_minutes: number;
}

export interface CreateRecurringRequest {
  resource_id: string;
  resource_type: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  repeat_count: number;
  start_date: string;
}

export interface CreateBlockRequest {
  resource_id: string;
  resource_type: string;
  start_time: string;
  end_time: string;
  block_reason: string;
}

// Occupational Health
export interface OccHealthHazard {
  id: string;
  tenant_id: string;
  hazard_type: string;
  location: string;
  risk_level: string;
  description: string | null;
  mitigation: string | null;
  assessed_date: string;
  created_at: string;
}

export interface CreateOccHealthHazardRequest {
  hazard_type: string;
  location: string;
  risk_level: string;
  description?: string;
  mitigation?: string;
  assessed_date: string;
}

export interface OccHealthAnalytics {
  total_screenings: number;
  by_type: Record<string, number>;
  by_department: Record<string, number>;
  fitness_rates: Record<string, number>;
}

export interface ReturnToWorkClearanceRequest {
  employee_id: string;
  clearance_date: string;
  restrictions?: string;
  follow_up_date?: string;
  notes?: string;
}

// OPD
export interface PharmacyDispatchStatus {
  prescription_id: string;
  drug_name: string;
  quantity_ordered: number;
  quantity_dispensed: number;
  status: string;
}

export interface FollowupComplianceRow {
  patient_id: string;
  patient_name: string | null;
  uhid: string | null;
  encounter_id: string;
  department_id: string | null;
  doctor_id: string | null;
  last_visit_date: string;
  follow_up_date: string;
  days_overdue: number;
  department: string | null;
}

// IPD
export interface DischargeSummary {
  admission_id: string;
  patient_name: string;
  admission_date: string;
  discharge_date: string | null;
  diagnoses: string[];
  procedures: string[];
  medications: string[];
  instructions: string | null;
  follow_up: string | null;
}

export interface BedTransferRequest {
  to_bed_id: string;
  reason: string;
  notes?: string;
}

export interface BedTransferResponse {
  success: true;
  admission_id: string;
  transfer_id: string;
  from_bed_id: string | null;
  to_bed_id: string;
  transfer_type: TransferType;
  reason: string;
  transferred_by: string;
  transferred_at: string;
}

export interface ExpectedDischargeRow {
  admission_id: string;
  patient_id: string;
  patient_name: string | null;
  uhid: string | null;
  ward: string | null;
  bed_number: string | null;
  expected_discharge_date: string;
  attending_doctor: string | null;
  days_admitted: number;
}
