// Print data payload types — split from index.ts, barrel-re-exported.

// ── Print Data ─────────────────────────────────────────

export interface MedicationLine {
  drug_name: string;
  dosage: string;
  route: string | null;
  frequency: string;
  duration: string;
  instructions: string | null;
}

export interface PrescriptionPrintData {
  patient_name: string;
  uhid: string;
  age: string | null;
  gender: string;
  phone: string;
  doctor_name: string;
  department: string | null;
  diagnosis: string | null;
  date: string;
  medications: MedicationLine[];
  advice: string | null;
  follow_up: string | null;
}

export interface LabResultLine {
  parameter_name: string;
  value: string;
  unit: string | null;
  normal_range: string | null;
  flag: string | null;
  /** The same analyte's last value, so a delta can be read against something. */
  previous_value: string | null;
  delta_percent: string | null;
  is_delta_flagged: boolean;
}

export interface LabReportPrintData {
  patient_name: string;
  uhid: string;
  age: string | null;
  gender: string;
  order_number: string | null;
  test_name: string;
  sample_type: string | null;
  collected_at: string | null;
  reported_at: string | null;
  referring_doctor: string | null;
  results: LabResultLine[];
  pathologist_name: string | null;
}

export interface RadiologyReportPrintData {
  patient_name: string;
  uhid: string;
  age: string | null;
  gender: string;
  modality: string;
  body_part: string | null;
  clinical_indication: string | null;
  findings: string;
  impression: string | null;
  recommendations: string | null;
  reported_by: string | null;
  verified_by: string | null;
  date: string;
}

export interface PatientCardPrintData {
  patient_name: string;
  uhid: string;
  date_of_birth: string | null;
  age: string | null;
  gender: string;
  phone: string;
  email: string | null;
  address: Record<string, unknown> | null;
  category: string;
  registered_at: string;
}

export interface WristbandPrintData {
  document_number: string;
  is_reprint: boolean;
  patient_name: string;
  uhid: string;
  age: string | null;
  gender: string;
  date_of_birth: string | null;
  blood_group: string | null;
  admission_date: string;
  bed_number: string | null;
  ward_name: string | null;
  doctor_name: string | null;
  is_critical: boolean;
  is_mlc: boolean;
  allergies: string[];
}

export interface OpdCertificatePrintData {
  document_number: string;
  is_reprint: boolean;
  certificate_number: string | null;
  certificate_type: string;
  patient_name: string;
  uhid: string;
  age: string | null;
  gender: string;
  date_of_birth: string | null;
  phone: string;
  doctor_name: string | null;
  department: string | null;
  encounter_date: string | null;
  issued_date: string;
  valid_from: string | null;
  valid_to: string | null;
  diagnosis: string | null;
  remarks: string | null;
  body: Record<string, unknown>;
  hospital_name: string | null;
}

export interface OpdProcedureConsentPrintData {
  document_number: string;
  is_reprint: boolean;
  consent_id: string;
  consent_type: string;
  status: string;
  patient_name: string;
  uhid: string;
  age: string | null;
  gender: string;
  date_of_birth: string | null;
  phone: string;
  doctor_name: string | null;
  department: string | null;
  encounter_date: string | null;
  procedure_name: string;
  risks_explained: string | null;
  alternatives_explained: string | null;
  benefits_explained: string | null;
  patient_questions: string | null;
  consented_by_name: string | null;
  consented_by_relation: string | null;
  witness_name: string | null;
  witness_designation: string | null;
  signed_at: string | null;
  withdrawn_at: string | null;
  withdrawal_reason: string | null;
  created_at: string;
  hospital_name: string | null;
}

export interface DeathCertificatePrintData {
  patient_name: string;
  uhid: string;
  age: string | null;
  gender: string;
  date_of_birth: string | null;
  admission_date: string;
  death_date: string | null;
  doctor_name: string | null;
  department: string | null;
  diagnosis: string | null;
  cause_of_death: string | null;
}

export interface DischargeSummaryPrintData {
  patient_name: string;
  uhid: string;
  age: string | null;
  gender: string;
  admission_date: string;
  discharge_date: string | null;
  department: string | null;
  doctor_name: string | null;
  bed_number: string | null;
  ward_name: string | null;
  discharge_type: string | null;
  discharge_summary: string | null;
  diagnosis: string | null;
}

export interface ReceiptPrintData {
  document_number: string;
  is_reprint: boolean;
  receipt_number: string | null;
  patient_name: string;
  uhid: string;
  invoice_number: string;
  amount: string;
  payment_mode: string;
  reference_number: string | null;
  received_by: string | null;
  paid_at: string;
  hospital_name: string | null;
}

export interface EstimateItemLine {
  description: string;
  quantity: number;
  unit_price: string;
  total_price: string;
}

export interface EstimatePrintData {
  invoice_number: string;
  patient_name: string;
  uhid: string;
  subtotal: string;
  tax_amount: string;
  discount_amount: string;
  total_amount: string;
  items: EstimateItemLine[];
  hospital_name: string | null;
  date: string;
}

export interface CreditNotePrintData {
  credit_note_number: string;
  invoice_number: string;
  patient_name: string;
  uhid: string;
  amount: string;
  reason: string;
  status: string;
  created_at: string;
  hospital_name: string | null;
}

export interface TdsCertificatePrintData {
  deductee_name: string;
  deductee_pan: string;
  tds_section: string;
  tds_rate: string;
  base_amount: string;
  tds_amount: string;
  deducted_date: string;
  certificate_number: string | null;
  certificate_date: string | null;
  financial_year: string;
  quarter: string;
  hospital_name: string | null;
}

export interface PackageAdditionalCharge {
  description: string;
  amount: number;
  reason: string | null;
}

export interface PackageExclusion {
  description: string;
  amount: number;
}

export interface PackageBillPrintData {
  bill_number: string;
  bill_date: string;
  patient_name: string;
  uhid: string;
  admission_number: string | null;
  admission_date: string | null;
  discharge_date: string | null;
  package_name: string;
  package_code: string | null;
  package_description: string | null;
  package_inclusions: string[];
  package_amount: number;
  additional_charges: PackageAdditionalCharge[];
  additional_total: number;
  exclusions_used: PackageExclusion[];
  exclusion_total: number;
  gross_amount: number;
  discount_amount: number;
  tax_amount: number;
  net_amount: number;
  advance_paid: number;
  insurance_amount: number;
  balance_due: number;
  amount_in_words: string;
  doctor_name: string | null;
  department: string | null;
  hospital_name: string;
  hospital_address: string | null;
  hospital_gstin: string | null;
  hospital_logo_url: string | null;
}

export interface InsuranceClaimPrintData {
  claim_number: string;
  claim_date: string;
  claim_type: string;
  tpa_name: string | null;
  insurance_company: string | null;
  policy_number: string | null;
  member_id: string | null;
  // Patient Information
  patient_name: string;
  uhid: string;
  age_display: string;
  gender: string;
  relation_to_primary: string | null;
  primary_holder_name: string | null;
  primary_holder_id: string | null;
  // Treatment Details
  admission_date: string | null;
  discharge_date: string | null;
  length_of_stay: number | null;
  diagnosis: string;
  icd_codes: string[];
  procedure_performed: string | null;
  procedure_codes: string[];
  treating_doctor: string;
  department: string | null;
  // Billing
  room_charges: number;
  nursing_charges: number;
  investigation_charges: number;
  medicine_charges: number;
  consultation_charges: number;
  procedure_charges: number;
  other_charges: number;
  total_bill_amount: number;
  pre_auth_amount: number | null;
  claim_amount: number;
  patient_payable: number;
  // Documents
  pre_auth_number: string | null;
  pre_auth_date: string | null;
  discharge_summary_attached: boolean;
  investigation_reports_attached: boolean;
  bill_attached: boolean;
  // Declaration
  declaration_date: string;
  patient_signature_obtained: boolean;
  hospital_stamp: boolean;
  hospital_name: string;
  hospital_address: string | null;
  hospital_empanelment_number: string | null;
  hospital_logo_url: string | null;
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 5: Admin/HR, BME, Blood Bank, OT, Clinical Forms
// ══════════════════════════════════════════════════════════════════════════════
