// Command center types — split from index.ts, barrel-re-exported.

// ── Command Center ─────────────────────────────────────────

export interface PatientFlowSnapshot {
  registered_today: number;
  opd_waiting: number;
  opd_in_consult: number;
  er_active: number;
  ipd_admitted: number;
  pending_discharge: number;
  discharged_today: number;
}

export interface HourlyFlowRow {
  hour: number;
  admissions: number;
  discharges: number;
  er_arrivals: number;
  opd_visits: number;
}

export interface BottleneckRow {
  area: string;
  metric: string;
  current_value: number;
  threshold: number;
  severity: string;
}

export interface DepartmentLoadRow {
  department_id: string;
  department_name: string;
  bed_total: number;
  bed_occupied: number;
  occupancy_pct: number;
  queue_depth: number;
  avg_wait_mins: number;
}

export interface DepartmentAlertRow {
  id: string;
  department_id: string;
  department_name: string;
  alert_level: string;
  metric_code: string;
  current_value: number;
  threshold_value: number;
  message: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

export interface AlertThresholdRow {
  id: string;
  department_id: string;
  department_name: string;
  metric_code: string;
  warning_threshold: number | null;
  critical_threshold: number | null;
  is_active: boolean;
}

export interface CreateAlertThresholdRequest {
  department_id: string;
  metric_code: string;
  warning_threshold?: number;
  critical_threshold?: number;
}

export interface UpdateAlertThresholdRequest {
  warning_threshold?: number;
  critical_threshold?: number;
  is_active?: boolean;
}

export interface PendingDischargeRow {
  admission_id: string;
  patient_id: string;
  patient_name: string;
  uhid: string;
  ward_name: string;
  bed_code: string;
  doctor_name: string;
  admitted_at: string;
  expected_discharge_date: string | null;
  days_admitted: number;
  pending_labs: number;
  pending_billing: boolean;
  summary_draft: boolean;
  checklist_pending: number;
}

export interface BedTurnaroundRow {
  location_id: string;
  location_code: string;
  ward_name: string;
  status: string;
  discharge_at: string | null;
  cleaning_started_at: string | null;
  cleaning_completed_at: string | null;
  turnaround_minutes: number | null;
}

export interface TurnaroundStatsRow {
  ward_name: string;
  avg_turnaround_mins: number;
  max_turnaround_mins: number;
  beds_awaiting_cleaning: number;
  beds_being_cleaned: number;
}

export interface TransportRequestRow {
  id: string;
  patient_name: string | null;
  from_location: string | null;
  to_location: string | null;
  transport_mode: string;
  status: string;
  priority: string;
  requested_by_name: string;
  assigned_to_name: string | null;
  requested_at: string;
  assigned_at: string | null;
  picked_up_at: string | null;
  completed_at: string | null;
  notes: string | null;
}

export interface CreateTransportRequest {
  patient_id?: string;
  admission_id?: string;
  from_location_id?: string;
  to_location_id?: string;
  transport_mode: string;
  priority?: string;
  notes?: string;
}

export interface UpdateTransportRequest {
  transport_mode?: string;
  priority?: string;
  notes?: string;
}

export interface AssignTransportRequest {
  assigned_to: string;
}

export interface KpiTile {
  code: string;
  label: string;
  value: number;
  unit: string;
  trend: number | null;
  period: string;
}

// ══════════════════════════════════════════════════════════
//  Audit Trail
// ══════════════════════════════════════════════════════════

export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: unknown | null;
  new_values: unknown | null;
  ip_address: string | null;
  module: string | null;
  description: string | null;
  created_at: string;
}

export interface AuditLogSummary {
  id: string;
  user_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  module: string | null;
  description: string | null;
  created_at: string;
}

export interface AccessLogEntry {
  id: string;
  user_id: string;
  user_name: string | null;
  entity_type: string;
  entity_id: string | null;
  patient_id: string | null;
  patient_name: string | null;
  action: string;
  ip_address: string | null;
  module: string | null;
  created_at: string;
}

export interface AuditLogQuery {
  module?: string;
  entity_type?: string;
  entity_id?: string;
  user_id?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  per_page?: number;
}

export interface AccessLogQuery {
  patient_id?: string;
  user_id?: string;
  entity_type?: string;
  module?: string;
  from?: string;
  to?: string;
  page?: number;
  per_page?: number;
}

export interface AuditStats {
  total_entries: number;
  today_entries: number;
  top_modules: ModuleCount[];
  top_users: UserActionCount[];
  action_breakdown: ActionCount[];
}

export interface ModuleCount {
  module: string | null;
  count: number;
}

export interface UserActionCount {
  user_name: string | null;
  count: number;
}

export interface ActionCount {
  action: string;
  count: number;
}

export interface LogAccessRequest {
  entity_type: string;
  entity_id?: string;
  patient_id?: string;
  module?: string;
}

export interface IntegrityResult {
  valid: boolean;
  total_checked: number;
  broken_at: string | null;
  expected_hash: string | null;
  actual_prev_hash: string | null;
}
