// IPD phase-3a response types — split from index.ts, barrel-re-exported.

// ── IPD Phase 3a Response Types ────────────────────────────

export interface LabOrderSummary {
  id: string;
  test_name: string;
  ordered_at: string;
  status: string;
}

export interface LabResultSummary {
  id: string;
  order_id: string;
  parameter_name: string;
  value: string | null;
  unit: string | null;
  reference_range: string | null;
  is_abnormal: boolean;
}

export interface RadiologyOrderSummary {
  id: string;
  modality: string;
  body_part: string | null;
  ordered_at: string;
  status: string;
  findings: string | null;
}

export interface InvestigationsResponse {
  lab_orders: LabOrderSummary[];
  lab_results: LabResultSummary[];
  radiology_orders: RadiologyOrderSummary[];
}

export interface EstimatedCostResponse {
  daily_rate: number;
  nursing_charge: number;
  estimated_days: number;
  room_total: number;
  nursing_total: number;
  deposit_required: number;
  total_estimated: number;
}

export interface DeptChargeGroup {
  department_name: string;
  total: number;
}

export interface BillingSummaryResponse {
  charges_by_dept: DeptChargeGroup[];
  total_charges: number;
  total_payments: number;
  outstanding_balance: number;
}

export interface AdmissionPrintData {
  patient_name: string;
  uhid: string;
  age: number | null;
  gender: string | null;
  admission_date: string;
  bed_number: string | null;
  ward_name: string | null;
  department_name: string | null;
  doctor_name: string | null;
  ip_type: string | null;
  provisional_diagnosis: string | null;
}

export interface SurgeonCaseloadEntry {
  surgeon_id: string;
  surgeon_name: string;
  total_cases: number;
  avg_duration_minutes: number | null;
  complication_count: number;
  cancellation_count: number;
}

export interface AnesthesiaComplicationEntry {
  case_id: string;
  patient_name: string;
  procedure_name: string;
  anesthesia_type: string;
  complications: string | null;
  adverse_events: unknown;
  case_date: string;
}

export interface LinkMlcRequest {
  mlc_case_id: string;
}
