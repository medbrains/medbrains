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

export interface DpdpConsentPrintData {
  consent_date: string;
  patient_name: string;
  uhid: string;
  consented_by: string;
  consented_by_relation: string | null;
  /** The consent template the patient was shown, when one was used. */
  consent_form: string | null;
  consent_version: string | null;
  /** granted, denied, withdrawn or pending. */
  consent_status: string;
  consent_method: string;
  witness_name: string | null;
  valid_until: string | null;
  withdrawn_at: string | null;
  withdrawal_reason: string | null;
  patient_rights: string[];
  hospital_name: string;
}

export interface VideoConsentPrintData {
  consent_number: string | null;
  consent_date: string;
  patient_name: string;
  uhid: string;
  consent_type: string;
  procedure_name: string | null;
  video_reference_id: string;
  video_duration_seconds: number | null;
  video_recorded_at: string;
  qr_code_to_video: string;
  video_url: string;
  video_verified: boolean | null;
  patient_visible_in_video: boolean | null;
  verbal_consent_given: boolean | null;
  witness_name: string | null;
  witness_relationship: string | null;
  recording_staff: string;
  hospital_name: string;
}

/**
 * One recorded monitoring round on a restrained patient.
 *
 * Follows `restraint_monitoring_logs`, which records what the nurse observed.
 * The previous shape carried booleans for hydration, toileting and position
 * changes that nothing in the system stores — they could only be invented,
 * and the print handler duly invented them.
 */
export interface RestraintMonitoring {
  datetime: string;
  nurse_name: string;
  patient_condition: string;
  /** True only because a circulation observation was written down. */
  circulation_checked: boolean;
  skin_checked: boolean;
  circulation_finding: string | null;
  skin_finding: string | null;
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
  family_notified: boolean | null;
  family_notification_datetime: string | null;
  patient_rights_explained: boolean | null;
  consent_obtained: boolean | null;
  consent_from: string | null;
  review_by_psychiatrist: boolean | null;
  psychiatrist_name: string | null;
  mhca_compliance_verified: boolean | null;
  hospital_name: string;
}

export interface GstInvoiceItemLine {
  description: string;
  hsn_code: string | null;
  quantity: number;
  unit_price: string;
  tax_percent: string;
  total_price: string;
  generic_name: string | null;
  /** Drug schedule ("H", "H1", "X"), for medicine lines. */
  schedule: string | null;
  manufacturer: string | null;
  batch_number: string | null;
  /** "MM/YY". */
  expiry: string | null;
  mrp: string | null;
  discount_amount: string;
  cgst_amount: string;
  sgst_amount: string;
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
  /** Any line is a medicine: printed as a pharmacy bill. */
  is_pharmacy: boolean;
  patient_phone: string | null;
  /** Present when a Schedule H1 or X drug is on the bill. */
  patient_address: string | null;
  prescriber_name: string | null;
  prescriber_registration: string | null;
  pharmacist_name: string | null;
  pharmacist_registration: string | null;
  drug_licence: string | null;
  cgst_total: string;
  sgst_total: string;
  mrp_total: string | null;
  savings: string | null;
  paid_amount: string;
  balance_due: string;
  rx_valid_until: string | null;
  refills_left: number | null;
  schedules: string[];
  upi_link: string | null;
  verify_url: string | null;
}

/** What the QR on a printed bill confirms — no patient detail. */
export interface VerifiedBill {
  hospital_name: string;
  invoice_number: string;
  invoice_date: string;
  total_amount: string;
  paid_amount: string;
  status: string;
}
