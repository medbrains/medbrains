// Billing print-data (phase 2) types — split from index.ts, barrel-re-exported.

// ── Billing Print Data (Phase 2) ────────────────────────

export interface BillLineItem {
  description: string;
  service_code: string | null;
  hsn_sac: string | null;
  quantity: number;
  unit_price: string;
  discount: string;
  tax_percent: string;
  total: string;
}

export interface BillCategoryTotal {
  category: string;
  amount: string;
}

export interface OpdBillPrintData {
  invoice_number: string;
  invoice_date: string;
  patient_name: string;
  uhid: string;
  age: string | null;
  gender: string;
  phone: string;
  doctor_name: string | null;
  department: string | null;
  items: BillLineItem[];
  subtotal: string;
  discount_amount: string;
  tax_amount: string;
  total_amount: string;
  amount_paid: string;
  balance_due: string;
  payment_mode: string | null;
  hospital_name: string | null;
  hospital_gstin: string | null;
}

export interface IpdInterimBillPrintData {
  bill_number: string;
  bill_date: string;
  patient_name: string;
  uhid: string;
  age: string | null;
  gender: string;
  admission_date: string;
  bed_number: string | null;
  ward_name: string | null;
  doctor_name: string | null;
  department: string | null;
  diagnosis: string | null;
  room_charges: string;
  investigation_charges: string;
  procedure_charges: string;
  pharmacy_charges: string;
  consumable_charges: string;
  professional_fees: string;
  other_charges: string;
  items: BillLineItem[];
  subtotal: string;
  discount_amount: string;
  tax_amount: string;
  total_amount: string;
  advance_paid: string;
  balance_due: string;
  los_days: number;
  hospital_name: string | null;
}

export interface IpdFinalBillPrintData {
  invoice_number: string;
  invoice_date: string;
  patient_name: string;
  uhid: string;
  age: string | null;
  gender: string;
  admission_date: string;
  discharge_date: string | null;
  bed_number: string | null;
  ward_name: string | null;
  doctor_name: string | null;
  department: string | null;
  diagnosis: string | null;
  discharge_type: string | null;
  category_breakup: BillCategoryTotal[];
  items: BillLineItem[];
  subtotal: string;
  discount_amount: string;
  tax_amount: string;
  total_amount: string;
  advance_paid: string;
  insurance_approved: string;
  patient_payable: string;
  amount_paid: string;
  balance_due: string;
  los_days: number;
  hospital_name: string | null;
  hospital_gstin: string | null;
}

export interface AdvanceReceiptPrintData {
  receipt_number: string;
  receipt_date: string;
  patient_name: string;
  uhid: string;
  admission_id: string | null;
  amount: string;
  amount_in_words: string;
  payment_mode: string;
  reference_number: string | null;
  purpose: string;
  received_by: string | null;
  hospital_name: string | null;
}

export interface RefundReceiptPrintData {
  receipt_number: string;
  receipt_date: string;
  patient_name: string;
  uhid: string;
  original_receipt_number: string | null;
  refund_amount: string;
  amount_in_words: string;
  refund_mode: string;
  reference_number: string | null;
  reason: string;
  approved_by: string | null;
  processed_by: string | null;
  hospital_name: string | null;
}

export interface InsurancePreauthPrintData {
  request_number: string;
  request_date: string;
  patient_name: string;
  uhid: string;
  age: string | null;
  gender: string;
  policy_number: string;
  insurance_company: string;
  tpa_name: string | null;
  employee_id: string | null;
  corporate_name: string | null;
  admission_date: string | null;
  expected_los: number | null;
  diagnosis: string | null;
  icd_codes: string[];
  planned_procedures: string[];
  estimated_cost: string;
  treating_doctor: string | null;
  contact_number: string;
  hospital_name: string | null;
}

export interface CashlessClaimPrintData {
  claim_number: string;
  claim_date: string;
  patient_name: string;
  uhid: string;
  policy_number: string;
  insurance_company: string;
  tpa_name: string | null;
  admission_date: string;
  discharge_date: string | null;
  diagnosis: string | null;
  procedures_performed: string[];
  total_bill_amount: string;
  approved_amount: string;
  deductions: string;
  patient_payable: string;
  claim_status: string;
  treating_doctor: string | null;
  hospital_name: string | null;
}

export interface PackageEstimatePrintData {
  estimate_number: string;
  estimate_date: string;
  valid_until: string;
  patient_name: string | null;
  package_name: string;
  package_code: string;
  procedure_name: string;
  inclusions: string[];
  exclusions: string[];
  package_price: string;
  additional_charges_note: string | null;
  terms_conditions: string[];
  hospital_name: string | null;
}
