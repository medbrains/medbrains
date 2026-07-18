// Ambulance fleet management types — split from index.ts, barrel-re-exported.

// ── Ambulance Fleet Management ──────────────────────────

export type AmbulanceType = "bls" | "als" | "patient_transport" | "mortuary" | "neonatal";
export type AmbulanceStatusType =
  | "available"
  | "on_trip"
  | "maintenance"
  | "off_duty"
  | "decommissioned";
export type AmbulanceTripType = "emergency" | "scheduled" | "inter_facility" | "discharge";
export type AmbulanceTripStatus =
  | "requested"
  | "dispatched"
  | "en_route_pickup"
  | "at_pickup"
  | "en_route_drop"
  | "at_drop"
  | "completed"
  | "cancelled";
export type AmbulanceTripPriority = "critical" | "urgent" | "routine";
export type AmbulanceMaintenanceStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "overdue"
  | "cancelled";

export interface AmbulanceRow {
  id: string;
  tenant_id: string;
  vehicle_number: string;
  ambulance_code: string;
  ambulance_type: AmbulanceType;
  status: AmbulanceStatusType;
  make: string | null;
  model: string | null;
  year_of_manufacture: number | null;
  chassis_number: string | null;
  engine_number: string | null;
  fitness_certificate_expiry: string | null;
  insurance_expiry: string | null;
  pollution_certificate_expiry: string | null;
  permit_expiry: string | null;
  equipment_checklist: unknown | null;
  has_ventilator: boolean;
  has_defibrillator: boolean;
  has_oxygen: boolean;
  seating_capacity: number | null;
  gps_device_id: string | null;
  last_latitude: number | null;
  last_longitude: number | null;
  last_location_at: string | null;
  default_driver_id: string | null;
  current_driver_id: string | null;
  odometer_km: number | null;
  fuel_type: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AmbulanceDriverRow {
  id: string;
  tenant_id: string;
  employee_id: string;
  license_number: string;
  license_type: string;
  license_expiry: string;
  is_active: boolean;
  bls_certified: boolean;
  bls_expiry: string | null;
  defensive_driving: boolean;
  shift_pattern: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AmbulanceTripRow {
  id: string;
  tenant_id: string;
  trip_code: string;
  ambulance_id: string | null;
  driver_id: string | null;
  trip_type: AmbulanceTripType;
  status: AmbulanceTripStatus;
  priority: AmbulanceTripPriority;
  patient_id: string | null;
  patient_name: string | null;
  patient_phone: string | null;
  pickup_address: string;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  pickup_landmark: string | null;
  drop_address: string | null;
  drop_latitude: number | null;
  drop_longitude: number | null;
  drop_landmark: string | null;
  requested_at: string;
  dispatched_at: string | null;
  pickup_arrived_at: string | null;
  patient_loaded_at: string | null;
  drop_arrived_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  vitals_at_pickup: unknown | null;
  vitals_at_drop: unknown | null;
  clinical_notes: string | null;
  oxygen_administered: boolean | null;
  iv_started: boolean | null;
  odometer_start: number | null;
  odometer_end: number | null;
  distance_km: number | null;
  cancellation_reason: string | null;
  is_billable: boolean;
  base_charge: number | null;
  per_km_charge: number | null;
  total_amount: number | null;
  billing_invoice_id: string | null;
  er_visit_id: string | null;
  transport_request_id: string | null;
  requested_by: string | null;
  dispatched_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AmbulanceTripLogRow {
  id: string;
  tenant_id: string;
  trip_id: string;
  event_type: string;
  latitude: number | null;
  longitude: number | null;
  speed_kmh: number | null;
  heading: number | null;
  event_data: unknown | null;
  recorded_by: string | null;
  recorded_at: string;
}

export interface AmbulanceMaintenanceRow {
  id: string;
  tenant_id: string;
  ambulance_id: string;
  maintenance_type: string;
  status: AmbulanceMaintenanceStatus;
  scheduled_date: string;
  started_at: string | null;
  completed_at: string | null;
  description: string | null;
  vendor_name: string | null;
  cost: number | null;
  odometer_at_service: number | null;
  next_service_km: number | null;
  next_service_date: string | null;
  findings: string | null;
  parts_replaced: unknown | null;
  performed_by: string | null;
  approved_by: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAmbulanceRequest {
  vehicle_number: string;
  ambulance_type: AmbulanceType;
  make?: string;
  model?: string;
  year_of_manufacture?: number;
  chassis_number?: string;
  engine_number?: string;
  fitness_certificate_expiry?: string;
  insurance_expiry?: string;
  pollution_certificate_expiry?: string;
  permit_expiry?: string;
  equipment_checklist?: unknown;
  has_ventilator?: boolean;
  has_defibrillator?: boolean;
  has_oxygen?: boolean;
  seating_capacity?: number;
  gps_device_id?: string;
  default_driver_id?: string;
  fuel_type?: string;
  notes?: string;
}

export interface UpdateAmbulanceRequest {
  vehicle_number?: string;
  ambulance_type?: AmbulanceType;
  status?: AmbulanceStatusType;
  make?: string;
  model?: string;
  year_of_manufacture?: number;
  chassis_number?: string;
  engine_number?: string;
  fitness_certificate_expiry?: string;
  insurance_expiry?: string;
  pollution_certificate_expiry?: string;
  permit_expiry?: string;
  equipment_checklist?: unknown;
  has_ventilator?: boolean;
  has_defibrillator?: boolean;
  has_oxygen?: boolean;
  seating_capacity?: number;
  gps_device_id?: string;
  default_driver_id?: string;
  odometer_km?: number;
  fuel_type?: string;
  notes?: string;
}

export interface UpdateAmbulanceLocationRequest {
  latitude: number;
  longitude: number;
}

export interface CreateAmbulanceDriverRequest {
  employee_id: string;
  license_number: string;
  license_type: string;
  license_expiry: string;
  bls_certified?: boolean;
  bls_expiry?: string;
  defensive_driving?: boolean;
  shift_pattern?: string;
  phone?: string;
  notes?: string;
}

export interface UpdateAmbulanceDriverRequest {
  license_number?: string;
  license_type?: string;
  license_expiry?: string;
  is_active?: boolean;
  bls_certified?: boolean;
  bls_expiry?: string;
  defensive_driving?: boolean;
  shift_pattern?: string;
  phone?: string;
  notes?: string;
}

export interface CreateAmbulanceTripRequest {
  trip_type: AmbulanceTripType;
  priority?: AmbulanceTripPriority;
  ambulance_id?: string;
  driver_id?: string;
  patient_id?: string;
  patient_name?: string;
  patient_phone?: string;
  pickup_address: string;
  pickup_latitude?: number;
  pickup_longitude?: number;
  pickup_landmark?: string;
  drop_address?: string;
  drop_latitude?: number;
  drop_longitude?: number;
  drop_landmark?: string;
  er_visit_id?: string;
  transport_request_id?: string;
  is_billable?: boolean;
}

export interface UpdateAmbulanceTripRequest {
  ambulance_id?: string;
  driver_id?: string;
  patient_id?: string;
  patient_name?: string;
  patient_phone?: string;
  pickup_address?: string;
  drop_address?: string;
  vitals_at_pickup?: unknown;
  vitals_at_drop?: unknown;
  clinical_notes?: string;
  oxygen_administered?: boolean;
  iv_started?: boolean;
  odometer_start?: number;
  odometer_end?: number;
  base_charge?: number;
  per_km_charge?: number;
  total_amount?: number;
}

export interface UpdateAmbulanceTripStatusRequest {
  status: AmbulanceTripStatus;
  cancellation_reason?: string;
}

export interface AddAmbulanceTripLogRequest {
  event_type: string;
  latitude?: number;
  longitude?: number;
  speed_kmh?: number;
  event_data?: unknown;
}

export interface CreateAmbulanceMaintenanceRequest {
  ambulance_id: string;
  maintenance_type: string;
  scheduled_date: string;
  description?: string;
  vendor_name?: string;
  cost?: number;
  odometer_at_service?: number;
  next_service_km?: number;
  next_service_date?: string;
  notes?: string;
}

export interface UpdateAmbulanceMaintenanceRequest {
  maintenance_type?: string;
  status?: AmbulanceMaintenanceStatus;
  scheduled_date?: string;
  description?: string;
  vendor_name?: string;
  cost?: number;
  odometer_at_service?: number;
  next_service_km?: number;
  next_service_date?: string;
  findings?: string;
  parts_replaced?: unknown;
  performed_by?: string;
  notes?: string;
}
