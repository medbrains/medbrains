// Lab / blood-bank print-data (phase 2) types — split from index.ts, barrel-re-exported.

// ── Lab/Blood Bank Print Data (Phase 2) ─────────────────

export interface AntibioticSensitivity {
  antibiotic_name: string;
  antibiotic_class: string | null;
  mic: string | null;
  interpretation: string;
  zone_size: string | null;
}

export interface CultureSensitivityPrintData {
  patient_name: string;
  uhid: string;
  age: string | null;
  gender: string;
  sample_type: string;
  sample_id: string;
  collected_at: string | null;
  received_at: string | null;
  reported_at: string | null;
  referring_doctor: string | null;
  clinical_history: string | null;
  organism_isolated: string | null;
  colony_count: string | null;
  gram_stain: string | null;
  sensitivity_results: AntibioticSensitivity[];
  interpretation: string | null;
  comments: string | null;
  microbiologist_name: string | null;
  hospital_name: string | null;
  nabl_logo: boolean;
}

export interface IhcMarker {
  marker_name: string;
  result: string;
  intensity: string | null;
  percentage: string | null;
}

export interface HistopathReportPrintData {
  patient_name: string;
  uhid: string;
  age: string | null;
  gender: string;
  specimen_type: string;
  specimen_id: string;
  collected_at: string | null;
  received_at: string | null;
  reported_at: string | null;
  referring_doctor: string | null;
  clinical_history: string | null;
  gross_description: string | null;
  microscopic_description: string | null;
  diagnosis: string;
  icd_o_morphology: string | null;
  icd_o_topography: string | null;
  staging: string | null;
  grade: string | null;
  margin_status: string | null;
  lymph_node_status: string | null;
  ihc_markers: IhcMarker[];
  comments: string | null;
  pathologist_name: string | null;
  hospital_name: string | null;
  nabl_logo: boolean;
}

export interface CrossmatchUnit {
  bag_number: string;
  donation_date: string;
  expiry_date: string;
  donor_blood_group: string;
  volume_ml: number;
  crossmatch_result: string;
  issue_status: string;
}

export interface CrossmatchReportPrintData {
  patient_name: string;
  uhid: string;
  age: string | null;
  gender: string;
  blood_group: string;
  rh_type: string;
  request_date: string;
  request_number: string;
  ward: string | null;
  bed: string | null;
  diagnosis: string | null;
  requesting_doctor: string | null;
  units_requested: number;
  component_type: string;
  crossmatch_results: CrossmatchUnit[];
  antibody_screen: string | null;
  special_requirements: string | null;
  technician_name: string | null;
  verified_by: string | null;
  hospital_name: string | null;
}

export interface ComponentSlipPrintData {
  issue_number: string;
  issue_date: string;
  issue_time: string;
  patient_name: string;
  uhid: string;
  blood_group: string;
  ward: string | null;
  bed: string | null;
  bag_number: string;
  component_type: string;
  volume_ml: number;
  donation_date: string;
  expiry_date: string;
  crossmatch_result: string;
  special_instructions: string | null;
  issued_by: string | null;
  verified_by: string | null;
  barcode_data: string;
  hospital_name: string | null;
}

export interface OrderedTest {
  test_name: string;
  test_code: string | null;
  sample_type: string | null;
  container: string | null;
}

export interface InvestigationRequisitionPrintData {
  requisition_number: string;
  requisition_date: string;
  patient_name: string;
  uhid: string;
  age: string | null;
  gender: string;
  ward: string | null;
  bed: string | null;
  requesting_doctor: string | null;
  department: string | null;
  clinical_history: string | null;
  diagnosis: string | null;
  tests_ordered: OrderedTest[];
  priority: string;
  fasting_required: boolean;
  special_instructions: string | null;
  barcode_data: string;
}
