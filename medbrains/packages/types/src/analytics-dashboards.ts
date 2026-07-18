// Analytics & dashboards types — split from index.ts, barrel-re-exported.

// ── Analytics & Dashboards ─────────────────────────────────

export interface DeptRevenueRow {
  department_name: string;
  revenue: number;
  invoice_count: number;
}

export interface AnalyticsDoctorRevenueRow {
  doctor_name: string;
  department_name: string;
  revenue: number;
  patient_count: number;
}

export interface IpdCensusRow {
  date: string;
  admissions: number;
  discharges: number;
  deaths: number;
  active: number;
}

export interface LabTatRow {
  test_name: string;
  order_count: number;
  avg_tat_mins: number;
  p90_tat_mins: number;
  min_tat_mins: number;
  max_tat_mins: number;
}

export interface PharmacySalesRow {
  drug_name: string;
  category: string | null;
  quantity_sold: number;
  total_revenue: number;
}

export interface OtUtilizationRow {
  room_name: string;
  total_bookings: number;
  completed: number;
  cancelled: number;
  avg_duration_mins: number;
  utilization_pct: number;
}

export interface ErVolumeRow {
  date: string;
  total_visits: number;
  immediate: number;
  emergent: number;
  urgent: number;
  less_urgent: number;
  non_urgent: number;
  avg_door_to_doctor_mins: number;
}

export interface ClinicalIndicatorRow {
  period: string;
  mortality_rate: number;
  infection_rate: number;
  readmission_rate: number;
  avg_los_days: number;
}

export interface OpdFootfallRow {
  date: string;
  department_name: string;
  visit_count: number;
  new_patients: number;
  follow_ups: number;
}

export interface BedOccupancyRow {
  ward_name: string;
  total_beds: number;
  occupied: number;
  vacant: number;
  occupancy_pct: number;
}

export type ReportPriority = "p1" | "p2" | "p3";

export type ReportReadiness =
  | "live_api"
  | "query_buildable"
  | "derived_view"
  | "predictive"
  | "capture_needed";

export type ReportExportFormat = "pdf" | "excel" | "csv" | "png";

export type ReportExportMode = "standard" | "governed";

export type ReportDataStatus = "live" | "not_wired";

export type EChartsTemplate =
  | "line_stack"
  | "line_gradient"
  | "area_stack"
  | "bar_stack"
  | "bar_race"
  | "bar_waterfall"
  | "heatmap_cartesian"
  | "heatmap_calendar"
  | "boxplot"
  | "sankey"
  | "graph_network"
  | "radar"
  | "treemap"
  | "sunburst"
  | "funnel"
  | "gauge"
  | "geo_map"
  | "effect_scatter_map"
  | "pictorial_bar"
  | "custom_svg"
  | "timeline"
  | "parallel_coordinates"
  | "theme_river"
  | "candlestick_ohlc";

export interface ReportDefinition {
  id: string;
  title: string;
  purpose: string;
  source_tables: string[];
  source_events: string[];
  event_payload_keys: string[];
  indicator_targets: string[];
  permissions: string[];
  priority: ReportPriority;
  readiness: ReportReadiness;
  chart_types: string[];
  echarts_template: EChartsTemplate;
  visual_kind: string;
  refresh: string;
  exports: ReportExportFormat[];
  export_mode: ReportExportMode;
  drilldowns: string[];
  data_endpoint: string | null;
}

export interface ReportFamilyDefinition {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  reports: ReportDefinition[];
}

export interface ReportCatalogResponse {
  generated_at: string;
  families: ReportFamilyDefinition[];
}

export interface ReportDataSummary {
  row_count: number;
  status: ReportDataStatus;
  source: string;
  warning: string | null;
}

export interface ReportDataResponse<T = unknown> {
  report_id: string;
  generated_at: string;
  summary: ReportDataSummary;
  rows: T[];
}
