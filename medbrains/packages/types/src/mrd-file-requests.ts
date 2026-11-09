// The paper file a patient waits for: MRD file requests
// (crates/medbrains-mrd/src/file_requests, migration 1417).

export type MrdFileRequestStatus = "requested" | "picked" | "delivered" | "not_found" | "cancelled";

export interface MrdFileRequest {
  id: string;
  patient_id: string;
  patient_name: string;
  uhid: string;
  medical_record_id: string;
  record_number: string;
  encounter_id: string | null;
  appointment_id: string | null;
  source: "visit" | "pull_list";
  department_id: string | null;
  department_name: string | null;
  doctor_id: string | null;
  doctor_name: string | null;
  /** Rack / shelf / bin when it was asked for. */
  location_label: string | null;
  visit_date: string;
  slot_start: string | null;
  status: MrdFileRequestStatus;
  requested_at: string;
  due_at: string;
  picked_at: string | null;
  picked_by_name: string | null;
  delivered_at: string | null;
  delivered_by_name: string | null;
  escalated_at: string | null;
  /** Where the file is now when it is out: its open movement. */
  holder_department: string | null;
  holder_user: string | null;
  holder_since: string | null;
  /** The visit (or its appointment) was cancelled: a picked file goes back to its shelf. */
  visit_cancelled: boolean;
}

export type MrdFileScanStep = "picked" | "delivered";

export interface MrdFileScanRequest {
  barcode: string;
  step: MrdFileScanStep;
}

export interface MrdPullListBuilt {
  date: string;
  created: number;
}

export interface MrdBackscanItem {
  patient_id: string;
  patient_name: string;
  uhid: string;
  medical_record_id: string;
  record_number: string;
  location_label: string | null;
  next_visit_at: string;
  upcoming_visits: number;
}

export interface MrdDeliveryTimeRow {
  grouping: "all" | "department" | "runner";
  id: string | null;
  name: string | null;
  deliveries: number;
  median_minutes: number | null;
  p90_minutes: number | null;
}

export interface MrdVisitFileRequest {
  id: string;
  status: MrdFileRequestStatus;
  record_number: string;
  requested_at: string;
  due_at: string;
  picked_at: string | null;
  delivered_at: string | null;
}

/** The consultation's file chip. A file with no request is "not requested". */
export interface MrdVisitFileStatus {
  has_physical_file: boolean;
  request: MrdVisitFileRequest | null;
}

/** A cut-off list: the rows shown and how many more there were. */
export interface MrdListed<T> {
  items: T[];
  more: number;
}

export interface MrdDigitalSummary {
  allergies: MrdListed<{ allergen_name: string; reaction: string | null; severity: string | null }>;
  /** A withheld mental-health diagnosis (MHCA s.23) reads "Restricted entry". */
  diagnoses: MrdListed<{
    description: string;
    icd_code: string | null;
    encounter_date: string;
    withheld: boolean;
  }>;
  /** Set when the role may not read OPD diagnoses: how many are withheld. */
  diagnoses_withheld: number | null;
  medicines: MrdListed<{
    drug_name: string;
    dosage: string;
    frequency: string;
    duration: string;
    prescribed_on: string;
  }>;
  abnormal_results: MrdListed<{
    test_name: string;
    parameter_name: string;
    value: string;
    unit: string | null;
    flag: string | null;
    is_critical: boolean;
    resulted_on: string;
  }>;
}
