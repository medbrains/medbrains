// MRD (medical records department) types — split from index.ts, barrel-re-exported.

// ── MRD (Medical Records Department) ────────────────────────

export type MrdRecordStatus = "active" | "archived" | "destroyed" | "missing";
export type MrdMovementStatus = "issued" | "returned" | "overdue";
export type MrdRegisterType = "birth" | "death";

export interface MrdMedicalRecord {
  id: string;
  tenant_id: string;
  patient_id: string;
  record_number: string;
  record_type: string;
  volume_number: number;
  total_pages: number | null;
  shelf_location: string | null;
  filing_method?: string | null;
  status: MrdRecordStatus;
  last_accessed_at: string | null;
  retention_years: number;
  destruction_due_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MrdRecordMovement {
  id: string;
  tenant_id: string;
  medical_record_id: string;
  issued_to_user_id: string | null;
  issued_to_department_id: string | null;
  issued_at: string;
  due_date: string | null;
  returned_at: string | null;
  status: MrdMovementStatus;
  purpose: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MrdBirthRegister {
  id: string;
  tenant_id: string;
  patient_id: string;
  admission_id: string | null;
  register_number: string;
  birth_date: string;
  birth_time: string | null;
  baby_gender: string;
  baby_weight_grams: number | null;
  birth_type: string;
  apgar_1min: number | null;
  apgar_5min: number | null;
  complications: string | null;
  attending_doctor_id: string | null;
  certificate_number: string | null;
  certificate_issued: boolean;
  father_name: string | null;
  mother_age: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MrdDeathRegister {
  id: string;
  tenant_id: string;
  patient_id: string;
  admission_id: string | null;
  er_visit_id: string | null;
  mlc_case_id: string | null;
  register_number: string;
  death_date: string;
  death_time: string | null;
  cause_of_death: string | null;
  immediate_cause: string | null;
  antecedent_cause: string | null;
  underlying_cause: string | null;
  manner_of_death: string;
  is_medico_legal: boolean;
  is_brought_dead: boolean;
  certifying_doctor_id: string | null;
  certificate_number: string | null;
  certificate_issued: boolean;
  reported_to_municipality: boolean;
  municipality_report_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MrdRetentionPolicy {
  id: string;
  tenant_id: string;
  record_type: string;
  category: string;
  retention_years: number;
  legal_reference: string | null;
  destruction_method: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type MrdCaseSheetPacketStatus =
  | "draft"
  | "generated"
  | "printed"
  | "filed"
  | "issued"
  | "returned"
  | "deficient"
  | "voided";

export type MrdCaseSheetPacketType = "opd" | "ipd";
export type MrdCaseSheetPageStatus = "pending" | "available" | "printed" | "deficient" | "waived";

export interface MrdStorageLocation {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  building: string | null;
  floor: string | null;
  room: string | null;
  rack: string | null;
  shelf: string | null;
  bin: string | null;
  barcode: string | null;
  capacity: number | null;
  current_count: number;
  is_active: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MrdCaseSheetPacket {
  id: string;
  tenant_id: string;
  patient_id: string;
  encounter_id: string | null;
  admission_id: string | null;
  medical_record_id: string | null;
  packet_number: string;
  packet_type: MrdCaseSheetPacketType;
  status: MrdCaseSheetPacketStatus;
  version: number;
  page_count: number;
  document_output_id: string | null;
  print_job_id: string | null;
  storage_location_id: string | null;
  shelf_location: string | null;
  source_snapshot: Record<string, unknown>;
  reprint_reason: string | null;
  notes: string | null;
  generated_by: string | null;
  generated_at: string;
  printed_by: string | null;
  printed_at: string | null;
  filed_by: string | null;
  filed_at: string | null;
  voided_by: string | null;
  voided_at: string | null;
  created_at: string;
  updated_at: string;
  patient_name: string | null;
  uhid: string | null;
}

export interface MrdCaseSheetPage {
  id: string;
  tenant_id: string;
  packet_id: string;
  page_code: string;
  page_title: string;
  page_order: number;
  source_module: string | null;
  source_table: string | null;
  source_id: string | null;
  document_output_id: string | null;
  is_required: boolean;
  status: MrdCaseSheetPageStatus;
  deficiency_reason: string | null;
  marked_deficient_by: string | null;
  marked_deficient_at: string | null;
  completed_at: string | null;
  printed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateMrdPageStatusInput {
  status: MrdCaseSheetPageStatus;
  deficiency_reason?: string;
}

export type RoiRequesterType = "patient" | "insurer" | "court" | "police" | "employer" | "other";
export type RoiStatus = "pending" | "approved" | "denied" | "released" | "expired";

export interface RoiRequest {
  id: string;
  tenant_id: string;
  patient_id: string;
  requester_type: RoiRequesterType;
  requester_name: string;
  requester_contact: string | null;
  purpose: string | null;
  record_scope: string;
  date_from: string | null;
  date_to: string | null;
  scope_notes: string | null;
  status: RoiStatus;
  authorization_obtained: boolean;
  expiry_date: string | null;
  requested_by: string | null;
  requested_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  decision_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoiAccessLogRow {
  id: string;
  tenant_id: string;
  roi_request_id: string;
  accessed_by: string;
  action: string;
  accessed_at: string;
  notes: string | null;
}

export interface CreateRoiInput {
  patient_id: string;
  requester_type: RoiRequesterType;
  requester_name: string;
  requester_contact?: string;
  purpose?: string;
  record_scope?: string;
  date_from?: string;
  date_to?: string;
  scope_notes?: string;
  authorization_obtained?: boolean;
}

export interface ReviewRoiInput {
  decision: "approved" | "denied";
  decision_reason?: string;
  expiry_date?: string;
}

export interface RoiAccessInput {
  action: "viewed" | "downloaded" | "released";
  notes?: string;
}

export type IngestionItemStatus = "uploaded" | "linked" | "filed";

export interface IngestionBatch {
  id: string;
  tenant_id: string;
  label: string;
  status: "open" | "closed";
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface IngestionItem {
  id: string;
  tenant_id: string;
  batch_id: string;
  file_url: string;
  original_filename: string;
  mime_type: string | null;
  barcode: string | null;
  linked_medical_record_id: string | null;
  linked_packet_id: string | null;
  extracted_text: string | null;
  ocr_status: string | null;
  status: IngestionItemStatus;
  notes: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AddIngestionItemInput {
  file_url: string;
  original_filename: string;
  mime_type?: string;
  barcode?: string;
}

export interface MrdCaseSheetCompletenessItem {
  code: string;
  label: string;
  source_module: string;
  status: "ok" | "missing" | "warning" | string;
  required: boolean;
  evidence_count: number;
  message: string;
}

export interface MrdCaseSheetCompletenessResponse {
  packet_id: string;
  packet_number: string;
  packet_type: MrdCaseSheetPacketType;
  completeness_pct: number;
  required_total: number;
  complete_total: number;
  missing_total: number;
  items: MrdCaseSheetCompletenessItem[];
}

export interface CreateMrdRecordRequest {
  patient_id: string;
  record_number?: string;
  record_type?: string;
  volume_number?: number;
  total_pages?: number;
  shelf_location?: string;
  filing_method?: string;
  retention_years?: number;
  destruction_due_date?: string;
  notes?: string;
}

export interface UpdateMrdRecordRequest {
  volume_number?: number;
  total_pages?: number;
  shelf_location?: string;
  status?: MrdRecordStatus;
  retention_years?: number;
  destruction_due_date?: string;
  notes?: string;
}

export interface IssueMrdRecordRequest {
  issued_to_user_id?: string;
  issued_to_department_id?: string;
  purpose?: string;
  due_days?: number;
  notes?: string;
}

export interface CreateMrdBirthRequest {
  patient_id: string;
  admission_id?: string;
  register_number?: string;
  birth_date: string;
  birth_time?: string;
  baby_gender: string;
  baby_weight_grams?: number;
  birth_type?: string;
  apgar_1min?: number;
  apgar_5min?: number;
  complications?: string;
  attending_doctor_id?: string;
  certificate_number?: string;
  certificate_issued?: boolean;
  father_name?: string;
  mother_age?: number;
}

export interface CreateMrdDeathRequest {
  patient_id: string;
  admission_id?: string;
  er_visit_id?: string;
  mlc_case_id?: string;
  register_number?: string;
  death_date: string;
  death_time?: string;
  cause_of_death?: string;
  immediate_cause?: string;
  antecedent_cause?: string;
  underlying_cause?: string;
  manner_of_death?: string;
  is_medico_legal?: boolean;
  is_brought_dead?: boolean;
  certifying_doctor_id?: string;
  certificate_number?: string;
  certificate_issued?: boolean;
  reported_to_municipality?: boolean;
  municipality_report_date?: string;
}

export interface CreateMrdRetentionPolicyRequest {
  record_type: string;
  category: string;
  retention_years: number;
  legal_reference?: string;
  destruction_method?: string;
  is_active?: boolean;
}

export interface UpdateMrdRetentionPolicyRequest {
  retention_years?: number;
  legal_reference?: string;
  destruction_method?: string;
  is_active?: boolean;
}

export interface ListMrdCaseSheetPacketsParams {
  status?: MrdCaseSheetPacketStatus;
  packet_type?: MrdCaseSheetPacketType;
  patient_id?: string;
  encounter_id?: string;
  admission_id?: string;
}

export interface CreateMrdStorageLocationRequest {
  code: string;
  name: string;
  building?: string;
  floor?: string;
  room?: string;
  rack?: string;
  shelf?: string;
  bin?: string;
  barcode?: string;
  capacity?: number;
  notes?: string;
}

export interface UpdateMrdStorageLocationRequest {
  name?: string;
  building?: string;
  floor?: string;
  room?: string;
  rack?: string;
  shelf?: string;
  bin?: string;
  barcode?: string;
  capacity?: number;
  is_active?: boolean;
  notes?: string;
}

export interface PrintMrdCaseSheetPacketRequest {
  printer_id?: string;
  copies?: number;
  reprint_reason?: string;
}

export interface FileMrdCaseSheetPacketRequest {
  storage_location_id: string;
  notes?: string;
}

export interface MrdMorbidityRow {
  icd_code: string | null;
  diagnosis_name: string;
  count: number;
}

export interface MrdMortalityRow {
  cause_of_death: string | null;
  manner_of_death: string;
  count: number;
}

export interface MrdMorbidityMortalityResponse {
  morbidity: MrdMorbidityRow[];
  mortality: MrdMortalityRow[];
}

export interface MrdAdmissionDischargeRow {
  department_name: string | null;
  total_admitted: number;
  total_discharged: number;
  total_deaths: number;
  avg_los_days: number | null;
}

export interface MrdAdmissionDischargeSummary {
  rows: MrdAdmissionDischargeRow[];
  total_admitted: number;
  total_discharged: number;
  total_deaths: number;
  overall_avg_los_days: number | null;
}

export type MrdFormType =
  | "progress_note"
  | "nursing_assessment"
  | "mar"
  | "vitals_chart"
  | "io_chart"
  | "discharge_checklist"
  | "pain_assessment"
  | "fall_risk"
  | "pressure_ulcer_risk"
  | "gcs"
  | "restraint_doc"
  | "preop_checklist"
  | "who_surgical_safety"
  | "anesthesia_record"
  | "operation_notes"
  | "postop_orders"
  | "blood_requisition"
  | "transfusion_monitoring"
  | "wound_assessment"
  | "nutrition_screening";

export interface MrdFormRecord {
  id: string;
  tenant_id: string;
  admission_id: string;
  form_type: MrdFormType;
  template_id: string | null;
  form_date: string;
  form_time: string | null;
  shift: "morning" | "afternoon" | "night" | null;
  form_data: Record<string, unknown>;
  completed_by: string | null;
  completed_at: string | null;
  verified_by: string | null;
  verified_at: string | null;
  pdf_url: string | null;
  created_at: string;
  created_by: string;
  updated_at: string;
  completed_by_name: string | null;
  verified_by_name: string | null;
}

export interface AttachFormDocumentRequest {
  s3_key: string;
}

// ══════════════════════════════════════════════════════════════
//  Specialty Clinical
// ══════════════════════════════════════════════════════════════
