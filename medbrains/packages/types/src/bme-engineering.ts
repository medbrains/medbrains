// BME / biomedical-engineering form types — split from index.ts, barrel-re-exported.

// ── BME/Engineering Forms ─────────────────────────────────────────────────────

export interface EquipmentCoverage {
  equipment_name: string;
  equipment_id: string;
  location: string;
  serial_number: string | null;
}

export interface EscalationContact {
  level: number;
  name: string;
  designation: string;
  phone: string;
  email: string | null;
}

export interface AmcContractPrintData {
  contract_number: string;
  contract_type: string;
  vendor_name: string;
  vendor_contact: string | null;
  vendor_email: string | null;
  equipment_covered: EquipmentCoverage[];
  contract_start: string;
  contract_end: string;
  contract_value: number;
  payment_terms: string | null;
  response_time_sla: string | null;
  resolution_time_sla: string | null;
  inclusions: string[];
  exclusions: string[];
  escalation_contacts: EscalationContact[];
  renewal_date: string | null;
  hospital_name: string;
}

export interface CalibrationParameter {
  parameter_name: string;
  unit: string;
  nominal_value: string;
  measured_value: string;
  tolerance: string;
  result: string;
}

export interface CalibrationCertificatePrintData {
  certificate_number: string;
  calibration_date: string;
  next_calibration_due: string;
  equipment_name: string;
  equipment_id: string;
  serial_number: string | null;
  manufacturer: string | null;
  model: string | null;
  location: string;
  calibration_agency: string;
  agency_accreditation: string | null;
  calibration_standard: string | null;
  parameters_calibrated: CalibrationParameter[];
  calibration_result: string;
  calibrated_by: string;
  approved_by: string | null;
  remarks: string | null;
  hospital_name: string;
}

export interface ReplacedPart {
  part_name: string;
  part_number: string | null;
  quantity: number;
  cost: number | null;
}

export interface EquipmentBreakdownReportPrintData {
  report_number: string;
  report_date: string;
  equipment_name: string;
  equipment_id: string;
  serial_number: string | null;
  location: string;
  department: string;
  breakdown_datetime: string;
  reported_by: string;
  fault_description: string;
  impact_assessment: string | null;
  immediate_action_taken: string | null;
  root_cause: string | null;
  repair_action: string | null;
  parts_replaced: ReplacedPart[];
  downtime_hours: number;
  repair_cost: number | null;
  repaired_by: string | null;
  repair_completed_at: string | null;
  verified_by: string | null;
  preventive_measures: string | null;
  hospital_name: string;
}

export interface MaintenanceEvent {
  date: string;
  maintenance_type: string;
  description: string;
  performed_by: string;
  cost: number | null;
}

export interface BreakdownEvent {
  date: string;
  fault: string;
  downtime_hours: number;
  repair_cost: number | null;
}

export interface CalibrationEvent {
  date: string;
  agency: string;
  result: string;
  next_due: string;
}

export interface EquipmentHistoryCardPrintData {
  equipment_name: string;
  equipment_id: string;
  serial_number: string | null;
  manufacturer: string | null;
  model: string | null;
  purchase_date: string | null;
  installation_date: string | null;
  warranty_expiry: string | null;
  purchase_cost: number | null;
  location: string;
  department: string;
  asset_category: string | null;
  maintenance_history: MaintenanceEvent[];
  breakdown_history: BreakdownEvent[];
  calibration_history: CalibrationEvent[];
  total_maintenance_cost: number;
  total_downtime_hours: number;
  current_status: string;
  last_updated: string;
  hospital_name: string;
}

export interface MgpsReading {
  time: string;
  gas_type: string;
  line_pressure: number;
  purity_percent: number | null;
  flow_rate: number | null;
  alarm_status: string;
}

export interface MgpsConsumption {
  o2_liters: number;
  n2o_liters: number;
  air_liters: number;
  vacuum_liters: number;
}

export interface MgpsIncident {
  time: string;
  description: string;
  action_taken: string;
}

export interface CylinderBank {
  bank_id: string;
  gas_type: string;
  primary_pressure: number;
  secondary_pressure: number;
  cylinders_full: number;
  cylinders_in_use: number;
  cylinders_empty: number;
}

export interface MgpsDailyLogPrintData {
  log_date: string;
  shift: string;
  operator_name: string;
  readings: MgpsReading[];
  consumption: MgpsConsumption;
  incidents: MgpsIncident[];
  cylinder_status: CylinderBank[];
  manifold_status: string;
  remarks: string | null;
  supervisor_verified: boolean;
  supervisor_name: string | null;
  hospital_name: string;
}

export interface WaterTestParameter {
  parameter: string;
  unit: string;
  result: string;
  acceptable_range: string;
  status: string;
}

export interface MicrobiologicalResult {
  total_plate_count: string;
  coliform_count: string;
  e_coli: string;
  pseudomonas: string | null;
  endotoxin_level: string | null;
}

export interface WaterQualityTestPrintData {
  test_date: string;
  sample_id: string;
  sample_location: string;
  sample_type: string;
  collected_by: string;
  tested_by: string;
  test_parameters: WaterTestParameter[];
  overall_result: string;
  microbiological_results: MicrobiologicalResult | null;
  action_required: string | null;
  next_test_due: string | null;
  remarks: string | null;
  hospital_name: string;
}

export interface RunEvent {
  start_time: string;
  end_time: string | null;
  duration_minutes: number;
  reason: string;
  load_percent: number | null;
}

export interface FuelStatus {
  opening_level: number;
  closing_level: number;
  fuel_added: number;
  fuel_consumed: number;
}

export interface BatteryStatus {
  voltage: number;
  current: number;
  charge_percent: number;
  health_status: string;
}

export interface DgUpsParameters {
  voltage_r: number | null;
  voltage_y: number | null;
  voltage_b: number | null;
  frequency: number | null;
  load_kw: number | null;
  runtime_hours: number;
}

export interface DgUpsRunLogPrintData {
  log_date: string;
  equipment_type: string;
  equipment_id: string;
  location: string;
  capacity: string;
  run_events: RunEvent[];
  fuel_status: FuelStatus | null;
  battery_status: BatteryStatus | null;
  daily_parameters: DgUpsParameters;
  operator_name: string;
  remarks: string | null;
  hospital_name: string;
}

export interface FireExtinguisherCheck {
  location: string;
  extinguisher_type: string;
  capacity: string;
  expiry_date: string;
  pressure_ok: boolean;
  seal_intact: boolean;
  accessible: boolean;
  signage_ok: boolean;
  status: string;
}

export interface FireAlarmCheck {
  zone: string;
  panel_ok: boolean;
  detectors_ok: boolean;
  sounders_ok: boolean;
  battery_ok: boolean;
  last_tested: string | null;
  status: string;
}

export interface FireHydrantCheck {
  location: string;
  water_flow_ok: boolean;
  hose_condition: string;
  nozzle_ok: boolean;
  valve_operational: boolean;
  status: string;
}

export interface EmergencyExitCheck {
  location: string;
  signage_illuminated: boolean;
  path_clear: boolean;
  door_operational: boolean;
  panic_bar_ok: boolean;
  status: string;
}

export interface SprinklerCheck {
  zones_inspected: number;
  heads_ok: boolean;
  valve_ok: boolean;
  pressure_ok: boolean;
  last_flow_test: string | null;
  status: string;
}

export interface FireEquipmentInspectionPrintData {
  inspection_date: string;
  inspection_number: string;
  inspector_name: string;
  inspector_designation: string;
  area_inspected: string;
  fire_extinguishers: FireExtinguisherCheck[];
  fire_alarms: FireAlarmCheck[];
  fire_hydrants: FireHydrantCheck[];
  emergency_exits: EmergencyExitCheck[];
  sprinkler_system: SprinklerCheck | null;
  overall_status: string;
  deficiencies_found: string[];
  corrective_actions: string[];
  next_inspection_due: string;
  supervisor_verified: boolean;
  hospital_name: string;
}

export interface MateriovigilanceReportPrintData {
  report_number: string;
  report_date: string;
  reporter_name: string;
  reporter_designation: string;
  reporter_department: string;
  equipment_name: string;
  equipment_id: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  lot_batch_number: string | null;
  incident_date: string;
  incident_description: string;
  patient_involved: boolean;
  patient_outcome: string | null;
  injury_type: string | null;
  immediate_action: string | null;
  root_cause_analysis: string | null;
  corrective_action: string | null;
  reported_to_cdsco: boolean;
  cdsco_reference: string | null;
  status: string;
  hospital_name: string;
}

export interface DrillObservation {
  observation: string;
  category: string;
  action_required: string | null;
}

export interface FirstResponder {
  name: string;
  role: string;
  response_time_seconds: number;
  performance: string;
}

export interface FireMockDrillReportPrintData {
  drill_number: string;
  drill_date: string;
  drill_time: string;
  drill_type: string;
  scenario: string;
  area_covered: string;
  participants_count: number;
  evacuation_time_minutes: number;
  target_time_minutes: number;
  observations: DrillObservation[];
  equipment_used: string[];
  first_responders: FirstResponder[];
  areas_for_improvement: string[];
  recommendations: string[];
  drill_conductor: string;
  fire_officer_name: string | null;
  overall_rating: string;
  next_drill_scheduled: string | null;
  hospital_name: string;
}
