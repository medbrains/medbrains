// Documents module types — split from index.ts, barrel-re-exported.

// ── Documents Module ─────────────────────────────────────

export type DocumentTemplateCategory =
  | "prescription"
  | "consultation_summary"
  | "discharge_summary"
  | "death_certificate"
  | "consent_form"
  | "lab_report"
  | "radiology_report"
  | "opd_bill"
  | "ipd_bill"
  | "receipt"
  | "case_sheet_cover"
  | "progress_note"
  | "nursing_assessment"
  | "mar_chart"
  | "vitals_chart"
  | "surgical_checklist"
  | "anesthesia_record"
  | "operation_note"
  | "employee_id_card"
  | "purchase_order"
  | "patient_card"
  | "wristband"
  | "queue_token"
  | "bmw_manifest"
  | "pcpndt_form_f"
  | "mlc_certificate"
  | "referral_letter"
  | "medical_certificate"
  | "fitness_certificate"
  | "blood_requisition"
  | "diet_chart"
  | "investigation_report"
  | "transfer_summary"
  | "admission_form"
  | "against_medical_advice"
  | "medico_legal_report"
  | "birth_certificate"
  | "duty_roster"
  | "indent_form"
  | "grn_form"
  | "custom";

export type DocumentOutputStatus =
  | "draft"
  | "generated"
  | "printed"
  | "downloaded"
  | "voided"
  | "superseded";

export type DocumentPrintFormat =
  | "a4_portrait"
  | "a4_landscape"
  | "a5_portrait"
  | "a5_landscape"
  | "thermal_80mm"
  | "thermal_58mm"
  | "label_50x25mm"
  | "wristband"
  | "custom";

export type DocumentWatermark =
  | "none"
  | "draft"
  | "confidential"
  | "copy"
  | "duplicate"
  | "uncontrolled"
  | "sample"
  | "cancelled";

export type PrintJobStatus = "queued" | "printing" | "completed" | "failed" | "cancelled";

export interface PrintEditorCapabilitiesResponse {
  paper_formats: string[];
  block_types: string[];
  barcode_types: string[];
  printer_types: string[];
  connection_types: string[];
}

export interface MockRenderPrintTemplateRequest {
  template_code?: string;
  print_format?: string;
  layout: Record<string, unknown>;
  sample_context?: Record<string, unknown>;
}

export interface MockRenderPrintTemplateResponse {
  render_id: string;
  format: string;
  page_count: number;
  warnings: string[];
  preview: Record<string, unknown>;
}

export interface DocumentTemplate {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  category: DocumentTemplateCategory;
  module_code: string | null;
  description: string | null;
  version: number;
  is_active: boolean;
  is_default: boolean;
  print_format: DocumentPrintFormat;
  header_layout: Record<string, unknown> | null;
  body_layout: Record<string, unknown> | null;
  footer_layout: Record<string, unknown> | null;
  show_logo: boolean;
  logo_position: string | null;
  show_hospital_name: boolean;
  show_hospital_address: boolean;
  show_hospital_phone: boolean;
  show_registration_no: boolean;
  show_accreditation: boolean;
  font_family: string | null;
  font_size_pt: number | null;
  margin_top_mm: number | null;
  margin_bottom_mm: number | null;
  margin_left_mm: number | null;
  margin_right_mm: number | null;
  show_page_numbers: boolean;
  show_print_metadata: boolean;
  show_qr_code: boolean;
  default_watermark: DocumentWatermark;
  signature_blocks: Record<string, unknown> | null;
  required_context: string[] | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentTemplateVersion {
  id: string;
  tenant_id: string;
  template_id: string;
  version_number: number;
  snapshot: Record<string, unknown>;
  change_summary: string | null;
  created_by: string | null;
  created_at: string;
}

export interface DocumentOutput {
  id: string;
  tenant_id: string;
  template_id: string | null;
  template_version: number | null;
  module_code: string | null;
  source_table: string | null;
  source_id: string | null;
  patient_id: string | null;
  visit_id: string | null;
  admission_id: string | null;
  document_number: string;
  title: string;
  category: DocumentTemplateCategory;
  status: DocumentOutputStatus;
  file_url: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  page_count: number | null;
  print_count: number;
  first_printed_at: string | null;
  last_printed_at: string | null;
  watermark: DocumentWatermark;
  language_code: string | null;
  context_snapshot: Record<string, unknown> | null;
  qr_code_data: string | null;
  document_hash: string | null;
  generated_by: string | null;
  voided_by: string | null;
  voided_at: string | null;
  voided_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentOutputSignature {
  id: string;
  tenant_id: string;
  document_output_id: string;
  signer_role: string;
  signer_name: string | null;
  designation: string | null;
  registration_number: string | null;
  signature_type: string;
  signature_image_url: string | null;
  biometric_hash: string | null;
  aadhaar_ref: string | null;
  thumb_impression: boolean;
  signed_at: string;
  captured_by: string | null;
  created_at: string;
}

export interface DocumentFormReviewSchedule {
  id: string;
  tenant_id: string;
  template_id: string;
  review_cycle_months: number;
  last_reviewed_at: string | null;
  last_reviewed_by: string | null;
  next_review_due: string | null;
  review_status: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentOutputStats {
  total_documents: number;
  total_prints: number;
  by_category: Record<string, number>;
  by_status: Record<string, number>;
}

export type PrinterConnectionType = "network" | "usb" | "agent" | "browser";
export type PrinterType = "laser" | "thermal" | "label" | "wristband" | "virtual";

export interface PrinterConfig {
  id: string;
  tenant_id: string;
  name: string;
  printer_type: string;
  connection_type: string | null;
  connection_string: string | null;
  department_id: string | null;
  default_format: DocumentPrintFormat;
  capabilities: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PrintJob {
  id: string;
  tenant_id: string;
  document_output_id: string;
  printer_id: string | null;
  status: PrintJobStatus;
  copies: number;
  priority: number;
  department_id: string | null;
  submitted_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

// Request types
export interface CreateDocumentTemplateRequest {
  code: string;
  name: string;
  category: DocumentTemplateCategory;
  module_code?: string;
  description?: string;
  print_format?: DocumentPrintFormat;
  header_layout?: Record<string, unknown>;
  body_layout?: Record<string, unknown>;
  footer_layout?: Record<string, unknown>;
  show_logo?: boolean;
  logo_position?: string;
  show_hospital_name?: boolean;
  show_hospital_address?: boolean;
  show_hospital_phone?: boolean;
  show_registration_no?: boolean;
  show_accreditation?: boolean;
  font_family?: string;
  font_size_pt?: number;
  margin_top_mm?: number;
  margin_bottom_mm?: number;
  margin_left_mm?: number;
  margin_right_mm?: number;
  show_page_numbers?: boolean;
  show_print_metadata?: boolean;
  show_qr_code?: boolean;
  default_watermark?: DocumentWatermark;
  signature_blocks?: Record<string, unknown>;
  required_context?: string[];
}

export interface UpdateDocumentTemplateRequest {
  name?: string;
  category?: DocumentTemplateCategory;
  module_code?: string;
  description?: string;
  is_active?: boolean;
  print_format?: DocumentPrintFormat;
  header_layout?: Record<string, unknown>;
  body_layout?: Record<string, unknown>;
  footer_layout?: Record<string, unknown>;
  show_logo?: boolean;
  logo_position?: string;
  show_hospital_name?: boolean;
  show_hospital_address?: boolean;
  show_hospital_phone?: boolean;
  show_registration_no?: boolean;
  show_accreditation?: boolean;
  font_family?: string;
  font_size_pt?: number;
  margin_top_mm?: number;
  margin_bottom_mm?: number;
  margin_left_mm?: number;
  margin_right_mm?: number;
  show_page_numbers?: boolean;
  show_print_metadata?: boolean;
  show_qr_code?: boolean;
  default_watermark?: DocumentWatermark;
  signature_blocks?: Record<string, unknown>;
  required_context?: string[];
}

export interface GenerateDocumentRequest {
  template_code: string;
  title: string;
  module_code?: string;
  source_table?: string;
  source_id?: string;
  patient_id?: string;
  visit_id?: string;
  admission_id?: string;
  context: Record<string, unknown>;
  language_code?: string;
}

export interface BatchGenerateRequest {
  template_code: string;
  source_ids: string[];
  module_code?: string;
  source_table?: string;
}

export interface VoidDocumentRequest {
  reason: string;
}

export interface AddDocumentSignatureRequest {
  signer_role: string;
  signer_name?: string;
  designation?: string;
  registration_number?: string;
  signature_type: string;
  signature_image_url?: string;
  biometric_hash?: string;
  aadhaar_ref?: string;
  thumb_impression?: boolean;
}

export interface CreatePrinterRequest {
  name: string;
  printer_type?: PrinterType | string;
  connection_type?: PrinterConnectionType | string;
  connection_string?: string;
  department_id?: string;
  default_format?: DocumentPrintFormat;
  capabilities?: Record<string, unknown>;
}

export interface UpdatePrintJobRequest {
  status: PrintJobStatus;
  error_message?: string;
}

export interface CreateReviewScheduleRequest {
  template_id: string;
  review_cycle_months: number;
  next_review_due?: string;
  notes?: string;
}
