// Clinical / identity form types — split from index.ts, barrel-re-exported.

// ── Clinical/Identity Forms ───────────────────────────────────────────────────

export interface AppointmentSlipPrintData {
  appointment_number: string;
  appointment_date: string;
  appointment_time: string;
  patient_name: string;
  uhid: string;
  phone: string | null;
  doctor_name: string;
  doctor_designation: string | null;
  department: string;
  clinic_location: string | null;
  visit_type: string;
  preparation_instructions: string | null;
  documents_to_bring: string[];
  estimated_wait_time: string | null;
  contact_for_queries: string | null;
  cancellation_policy: string | null;
  qr_code_data: string | null;
  hospital_name: string;
  hospital_address: string | null;
  hospital_logo_url: string | null;
}

export interface DataCategory {
  category: string;
  description: string;
  is_sensitive: boolean;
}

export interface ProcessingPurpose {
  purpose: string;
  legal_basis: string;
}

export interface DataSharingEntity {
  entity_type: string;
  entity_name: string | null;
  purpose: string;
}

export interface GrievanceOfficer {
  name: string;
  email: string;
  phone: string | null;
}

export interface DpdpConsentPrintData {
  consent_number: string;
  consent_date: string;
  patient_name: string;
  uhid: string;
  guardian_name: string | null;
  data_categories: DataCategory[];
  processing_purposes: ProcessingPurpose[];
  data_sharing: DataSharingEntity[];
  retention_period: string;
  patient_rights: string[];
  grievance_officer: GrievanceOfficer;
  consent_given: boolean;
  consent_method: string;
  witness_name: string | null;
  hospital_name: string;
  hospital_dpo_contact: string | null;
}

export interface VideoConsentPrintData {
  consent_number: string;
  consent_date: string;
  patient_name: string;
  uhid: string;
  consent_type: string;
  procedure_name: string | null;
  video_reference_id: string;
  video_duration_seconds: number;
  video_recorded_at: string;
  qr_code_to_video: string;
  video_url: string;
  video_verified: boolean;
  patient_visible_in_video: boolean;
  verbal_consent_given: boolean;
  witness_name: string | null;
  witness_relationship: string | null;
  recording_staff: string;
  hospital_name: string;
}

export interface RestraintMonitoring {
  datetime: string;
  nurse_name: string;
  patient_condition: string;
  circulation_checked: boolean;
  hydration_offered: boolean;
  toileting_offered: boolean;
  position_changed: boolean;
  continued_need_assessed: boolean;
  remarks: string | null;
}

export interface RestraintDocumentationPrintData {
  form_number: string;
  form_date: string;
  patient_name: string;
  uhid: string;
  ip_number: string | null;
  ward: string;
  diagnosis: string;
  restraint_type: string;
  restraint_device: string | null;
  indication: string;
  alternatives_tried: string[];
  start_datetime: string;
  planned_duration: string;
  actual_end_datetime: string | null;
  ordering_physician: string;
  physician_assessment: string;
  nursing_monitoring: RestraintMonitoring[];
  patient_condition_on_release: string | null;
  family_notified: boolean;
  family_notification_datetime: string | null;
  patient_rights_explained: boolean;
  consent_obtained: boolean;
  consent_from: string | null;
  review_by_psychiatrist: boolean;
  psychiatrist_name: string | null;
  mhca_compliance_verified: boolean;
  hospital_name: string;
}

export interface GstInvoiceItemLine {
  description: string;
  hsn_code: string | null;
  quantity: number;
  unit_price: string;
  tax_percent: string;
  total_price: string;
}

export interface GstInvoicePrintData {
  invoice_number: string;
  patient_name: string;
  uhid: string;
  subtotal: string;
  tax_amount: string;
  total_amount: string;
  hospital_gstin: string | null;
  hospital_name: string | null;
  hospital_address: string | null;
  items: GstInvoiceItemLine[];
  date: string;
}
