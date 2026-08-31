// Dashboard widget builder types — split from index.ts, barrel-re-exported.

import type { Admission, CreatePoItemInput } from "./index";
import type { AppointmentStatus, AppointmentType, RxOrderMode } from "./medication-timing";

// ── Dashboard Widget Builder Types ──────────────────────

export type WidgetType =
  | "stat_card"
  | "data_table"
  | "list"
  | "chart"
  | "quick_actions"
  | "module_embed"
  | "form_embed"
  | "system_health"
  | "custom_html";

export type WidgetCategory = "metrics" | "data" | "actions" | "module" | "system" | "general";

export interface LayoutConfig {
  columns: number;
  row_height: number;
  gap: number;
}

export interface Dashboard {
  id: string;
  tenant_id: string;
  user_id: string | null;
  name: string;
  code: string;
  description: string | null;
  is_default: boolean;
  role_codes: string[];
  department_ids: string[];
  group_ids: string[];
  layout_config: LayoutConfig;
  is_active: boolean;
  created_by: string | null;
  cloned_from: string | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardSummary {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_default: boolean;
  role_codes: string[];
  department_ids: string[];
  user_id: string | null;
  is_active: boolean;
  widget_count: number;
  created_at: string;
}

export interface DashboardWidget {
  id: string;
  dashboard_id: string;
  widget_type: WidgetType;
  title: string;
  subtitle: string | null;
  icon: string | null;
  color: string | null;
  config: Record<string, unknown>;
  data_source: WidgetDataSource;
  data_filters: WidgetDataFilters;
  variants: WidgetVariant[];
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  min_width: number;
  min_height: number;
  refresh_interval: number | null;
  is_visible: boolean;
  permission_code: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** Per-audience widget override — the matching variant (user > group > role) is
 *  merged onto the widget server-side, so a widget can show different info per
 *  viewer. See migration 0198. */
export interface WidgetVariant {
  match: { roles?: string[]; groups?: string[]; users?: string[] };
  title?: string;
  subtitle?: string;
  config?: Record<string, unknown>;
  data_source?: WidgetDataSource;
}

export interface DashboardWithWidgets {
  dashboard: Dashboard;
  widgets: DashboardWidget[];
}

export interface WidgetTemplate {
  id: string;
  tenant_id: string | null;
  name: string;
  description: string | null;
  widget_type: WidgetType;
  icon: string | null;
  color: string | null;
  default_config: Record<string, unknown>;
  default_source: Record<string, unknown>;
  default_width: number;
  default_height: number;
  category: string;
  is_system: boolean;
  required_permissions: string[];
  required_departments: string[];
  created_at: string;
}

export interface WidgetDataSource {
  type: "module_query" | "api" | "static";
  module?: string;
  query?: string;
  params?: Record<string, unknown>;
  static_data?: unknown;
}

export type DataFilterScope = "auto" | "all" | "custom";

/** Maps widget template UUIDs to "visible" or "hidden" for per-role/per-user overrides. */
export type WidgetAccessMap = Record<string, "visible" | "hidden">;

export interface WidgetDataFilters {
  scope?: DataFilterScope;
  department_ids?: string[];
  doctor_id?: string;
  date_range?: "today" | "week" | "month" | "custom";
  custom_start?: string;
  custom_end?: string;
}

export interface StatCardConfig {
  format?: "number" | "currency" | "percent";
  trend_period?: "day" | "week" | "month";
  suffix?: string;
}

export interface DataTableConfig {
  columns: { key: string; label: string; sortable?: boolean }[];
  page_size?: number;
  show_search?: boolean;
  row_click_path?: string;
}

export interface ListConfig {
  max_items?: number;
  show_timestamp?: boolean;
  show_icon?: boolean;
  empty_message?: string;
}

export interface QuickActionsConfig {
  actions: {
    label: string;
    path: string;
    icon?: string;
    color?: string;
    permission?: string;
    description?: string;
  }[];
}

export interface ModuleEmbedConfig {
  module_code: string;
  view_mode: "card" | "table" | "compact_list" | "stats";
  filters?: Record<string, unknown>;
}

export interface ChartConfig {
  chart_type: "bar" | "line" | "pie" | "donut";
  x_key?: string;
  y_key?: string;
  colors?: string[];
}

export interface CreateDashboardRequest {
  name: string;
  code: string;
  description?: string;
  role_codes?: string[];
  department_ids?: string[];
  group_ids?: string[];
  layout_config?: LayoutConfig;
  is_default?: boolean;
}

export interface UpdateDashboardRequest {
  name?: string;
  description?: string;
  role_codes?: string[];
  department_ids?: string[];
  group_ids?: string[];
  layout_config?: LayoutConfig;
  is_default?: boolean;
  is_active?: boolean;
}

export interface PersonalizeDashboardRequest {
  source_dashboard_id: string;
  name?: string;
}

export interface CreateWidgetRequest {
  widget_type: WidgetType;
  title: string;
  subtitle?: string;
  icon?: string;
  color?: string;
  config?: Record<string, unknown>;
  data_source?: WidgetDataSource;
  data_filters?: WidgetDataFilters;
  position_x?: number;
  position_y?: number;
  width?: number;
  height?: number;
  refresh_interval?: number;
  permission_code?: string;
  template_id?: string;
}

export interface UpdateWidgetRequest {
  title?: string;
  subtitle?: string;
  icon?: string;
  color?: string;
  config?: Record<string, unknown>;
  data_source?: WidgetDataSource;
  data_filters?: WidgetDataFilters;
  position_x?: number;
  position_y?: number;
  width?: number;
  height?: number;
  refresh_interval?: number;
  is_visible?: boolean;
  permission_code?: string;
}

export interface UpdateLayoutRequest {
  widgets: {
    id: string;
    position_x: number;
    position_y: number;
    width: number;
    height: number;
  }[];
}

export interface WidgetDataResponse {
  widget_id: string;
  data: unknown;
  fetched_at: string;
}

export interface DashboardStatsResponse {
  total_patients: number;
  today_registrations: number;
  opd_queue_count: number;
  today_visits: number;
  lab_pending: number;
  today_revenue: string;
  today_appointments: number;
  ipd_active: number;
  recent_activity: RecentActivity[];
}

export interface RecentActivity {
  activity_type: string;
  description: string;
  occurred_at: string;
}

// ══════════════════════════════════════════════════════════
//  Indent / Store Module
// ══════════════════════════════════════════════════════════

export type IndentType = "general" | "pharmacy" | "lab" | "surgical" | "housekeeping" | "emergency";
export type IndentPriority = "normal" | "urgent" | "emergency";
export type IndentStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "partially_approved"
  | "rejected"
  | "issued"
  | "partially_issued"
  | "closed"
  | "cancelled";
export type StockMovementType = "receipt" | "issue" | "return" | "adjustment" | "transfer";

export type VedClass = "vital" | "essential" | "desirable";
export type CondemnationStatus =
  | "initiated"
  | "committee_review"
  | "approved"
  | "condemned"
  | "rejected";
export type SupplierPaymentStatus = "pending" | "partially_paid" | "paid" | "overdue" | "disputed";
export type ConsumableIssueStatus = "issued" | "returned" | "billed";

export interface StoreCatalog {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  category: string | null;
  sub_category: string | null;
  unit: string;
  base_price: string;
  current_stock: number;
  reorder_level: number;
  is_active: boolean;
  /** 'consumable' (clinical) | 'stationery' (office supplies). */
  domain: string;
  is_implant: boolean;
  is_high_value: boolean;
  ved_class: VedClass | null;
  hsn_code: string | null;
  bin_location: string | null;
  last_issue_date: string | null;
  last_receipt_date: string | null;
  min_stock: number;
  max_stock: number;
  created_at: string;
  updated_at: string;
}

export interface IndentRequisition {
  id: string;
  tenant_id: string;
  indent_number: string;
  department_id: string;
  requested_by: string;
  indent_type: IndentType;
  priority: IndentPriority;
  status: IndentStatus;
  total_amount: string;
  approved_by: string | null;
  approved_at: string | null;
  context: Record<string, unknown>;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface IndentItem {
  id: string;
  tenant_id: string;
  requisition_id: string;
  catalog_item_id: string | null;
  item_name: string;
  quantity_requested: number;
  quantity_approved: number;
  quantity_issued: number;
  unit_price: string;
  total_price: string;
  item_context: Record<string, unknown>;
  notes: string | null;
  created_at: string;
}

export interface StoreStockMovement {
  id: string;
  tenant_id: string;
  catalog_item_id: string;
  movement_type: StockMovementType;
  quantity: number;
  reference_type: string | null;
  reference_id: string | null;
  department_id: string | null;
  store_location_id: string | null;
  batch_stock_id: string | null;
  patient_id: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
}

export interface IndentRequisitionListResponse {
  requisitions: IndentRequisition[];
  total: number;
  page: number;
  per_page: number;
}

export interface IndentRequisitionDetailResponse {
  requisition: IndentRequisition;
  items: IndentItem[];
}

export interface CreateIndentItemInput {
  catalog_item_id?: string;
  item_name: string;
  quantity_requested: number;
  unit_price?: number;
  item_context?: Record<string, unknown>;
  notes?: string;
}

export interface CreateIndentRequisitionRequest {
  department_id: string;
  indent_type: IndentType;
  priority?: IndentPriority;
  context?: Record<string, unknown>;
  notes?: string;
  items: CreateIndentItemInput[];
}

/** A device/app instance's resolved identity on boot: form-factor × user/role × location. */
export interface ManifestLocation {
  department_id: string | null;
  label: string | null;
  scope: Record<string, unknown>;
}

export interface ManifestStation {
  id: string;
  code: string;
  name: string;
  station_type: string;
  department_id: string | null;
}

export interface ManifestDevice {
  id: string;
  label: string;
  paired_at: string;
}

export interface AppManifest {
  tenant_id: string;
  app_variant: string | null;
  role: string;
  user_id: string;
  device: ManifestDevice | null;
  location: ManifestLocation;
  station: ManifestStation | null;
  config: Record<string, unknown>;
}

/** A station master — the concrete place a device/app instance sits. */
export interface Station {
  id: string;
  department_id: string | null;
  code: string;
  name: string;
  station_type: string;
  location_scope: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}

export const STATION_TYPES = [
  "nurse_station",
  "opd_counter",
  "ward_console",
  "kiosk_point",
  "billing_counter",
  "pharmacy_counter",
  "lab_counter",
  "reception",
  "display",
  "other",
] as const;

export interface ApproveIndentItemInput {
  item_id: string;
  quantity_approved: number;
}

export interface ApproveIndentRequest {
  items: ApproveIndentItemInput[];
  notes?: string;
}

export interface IssueIndentItemInput {
  item_id: string;
  quantity_issued: number;
}

export interface IssueIndentRequest {
  items: IssueIndentItemInput[];
  notes?: string;
}

export interface CreateStoreCatalogRequest {
  code: string;
  name: string;
  category?: string;
  sub_category?: string;
  unit?: string;
  base_price?: number;
  reorder_level?: number;
  /** 'consumable' (default) | 'stationery'. */
  domain?: string;
}

export interface UpdateStoreCatalogRequest {
  name?: string;
  category?: string;
  sub_category?: string;
  unit?: string;
  base_price?: number;
  reorder_level?: number;
  is_active?: boolean;
  ved_class?: VedClass;
  is_implant?: boolean;
  is_high_value?: boolean;
  hsn_code?: string;
  bin_location?: string;
  min_stock?: number;
  max_stock?: number;
}

export interface StockMovementListResponse {
  movements: StoreStockMovement[];
  total: number;
  page: number;
  per_page: number;
}

export interface CreateStoreStockMovementRequest {
  catalog_item_id: string;
  movement_type: StockMovementType;
  quantity: number;
  reference_type?: string;
  reference_id?: string;
  notes?: string;
}

// ══════════════════════════════════════════════════════════
//  Inventory Phase 2
// ══════════════════════════════════════════════════════════

export interface PatientConsumableIssue {
  id: string;
  tenant_id: string;
  patient_id: string;
  catalog_item_id: string;
  batch_stock_id: string | null;
  department_id: string | null;
  encounter_id: string | null;
  admission_id: string | null;
  quantity: number;
  returned_qty: number;
  unit_price: string;
  status: ConsumableIssueStatus;
  is_chargeable: boolean;
  invoice_item_id: string | null;
  issued_by: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImplantRegistryEntry {
  id: string;
  tenant_id: string;
  catalog_item_id: string;
  batch_stock_id: string | null;
  patient_id: string;
  serial_number: string | null;
  implant_date: string;
  implant_site: string | null;
  surgeon_id: string | null;
  manufacturer: string | null;
  model_number: string | null;
  warranty_expiry: string | null;
  removal_date: string | null;
  removal_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EquipmentCondemnation {
  id: string;
  tenant_id: string;
  catalog_item_id: string;
  condemnation_number: string;
  status: CondemnationStatus;
  reason: string;
  current_value: string;
  purchase_value: string;
  committee_remarks: string | null;
  approved_by: string | null;
  approved_at: string | null;
  disposal_method: string | null;
  disposed_at: string | null;
  initiated_by: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupplierPayment {
  id: string;
  tenant_id: string;
  vendor_id: string;
  po_id: string | null;
  grn_id: string | null;
  payment_number: string;
  invoice_amount: string;
  paid_amount: string;
  balance_amount: string;
  status: SupplierPaymentStatus;
  payment_date: string | null;
  due_date: string | null;
  payment_method: string | null;
  reference_number: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ReorderAlert {
  id: string;
  tenant_id: string;
  catalog_item_id: string;
  alert_type: string;
  current_stock: number;
  threshold_level: number;
  is_acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Analytics row types
export interface ConsumptionAnalysisRow {
  item_name: string;
  department_name: string | null;
  total_issued: number;
  total_value: string;
}

export interface AbcAnalysisRow {
  item_name: string;
  annual_value: string;
  cumulative_pct: number;
  abc_class: string;
}

export interface VedAnalysisRow {
  item_name: string;
  ved_class: string | null;
  current_stock: number;
  reorder_level: number;
}

export interface FsnAnalysisRow {
  item_name: string;
  last_issue_date: string | null;
  days_since_last_issue: number | null;
  fsn_class: string;
}

export interface DeadStockRow {
  item_name: string;
  current_stock: number;
  stock_value: string;
  last_movement_date: string | null;
  days_idle: number | null;
}

export interface InventoryValuationRow {
  item_name: string;
  category: string | null;
  current_stock: number;
  avg_unit_cost: string;
  total_value: string;
}

export interface PurchaseConsumptionTrendRow {
  period: string;
  total_purchased: number;
  total_consumed: number;
  net_change: number;
}

export interface VendorPerformanceRow {
  vendor_name: string;
  total_orders: number;
  on_time_pct: number;
  rejection_rate: number;
  avg_delivery_days: number;
}

export interface VendorComparisonRow {
  vendor_name: string;
  item_name: string;
  unit_price: string;
  delivery_days: number | null;
  rejection_rate: number | null;
}

export interface ComplianceCheckRow {
  check_name: string;
  status: string;
  detail: string;
}

// Request types
export interface IssueToPatientRequest {
  patient_id: string;
  catalog_item_id: string;
  batch_stock_id?: string;
  department_id?: string;
  encounter_id?: string;
  admission_id?: string;
  quantity: number;
  unit_price?: number;
  is_chargeable?: boolean;
  notes?: string;
}

export interface DepartmentIssueRequest {
  catalog_item_id: string;
  department_id: string;
  quantity: number;
  notes?: string;
}

export interface ReturnToStoreRequest {
  catalog_item_id: string;
  quantity: number;
  department_id?: string;
  patient_consumable_id?: string;
  notes?: string;
}

export interface CreateImplantRequest {
  catalog_item_id: string;
  batch_stock_id?: string;
  patient_id: string;
  serial_number?: string;
  implant_date: string;
  implant_site?: string;
  surgeon_id?: string;
  manufacturer?: string;
  model_number?: string;
  warranty_expiry?: string;
  notes?: string;
}

export interface UpdateImplantRequest {
  implant_site?: string;
  manufacturer?: string;
  model_number?: string;
  warranty_expiry?: string;
  removal_date?: string;
  removal_reason?: string;
  notes?: string;
}

export interface CreateCondemnationRequest {
  catalog_item_id: string;
  reason: string;
  current_value?: number;
  purchase_value?: number;
  notes?: string;
}

export interface UpdateCondemnationStatusRequest {
  status: CondemnationStatus;
  committee_remarks?: string;
  disposal_method?: string;
}

export interface CreateSupplierPaymentRequest {
  vendor_id: string;
  po_id?: string;
  grn_id?: string;
  invoice_amount: number;
  paid_amount?: number;
  due_date?: string;
  payment_method?: string;
  reference_number?: string;
  notes?: string;
}

export interface UpdateSupplierPaymentRequest {
  paid_amount: number;
  payment_method?: string;
  reference_number?: string;
  notes?: string;
}

export interface CreateEmergencyPoRequest {
  vendor_id: string;
  store_location_id?: string;
  emergency_reason: string;
  expected_delivery?: string;
  notes?: string;
  items: CreatePoItemInput[];
}

export interface ConsignmentUsageRequest {
  batch_stock_id: string;
  quantity: number;
  patient_id?: string;
  encounter_id?: string;
  admission_id?: string;
  notes?: string;
}

// ══════════════════════════════════════════════════════════
//  OPD Module
// ══════════════════════════════════════════════════════════

export type EncounterType = "opd" | "ipd" | "emergency";
export type EncounterStatus = "open" | "in_progress" | "completed" | "cancelled";
export type QueueStatus = "waiting" | "called" | "in_consultation" | "completed" | "no_show";

export interface Encounter {
  id: string;
  tenant_id: string;
  patient_id: string;
  encounter_type: EncounterType;
  status: EncounterStatus;
  department_id: string | null;
  doctor_id: string | null;
  encounter_date: string;
  notes: string | null;
  attributes: Record<string, unknown>;
  visit_type: string | null;
  /** Recorded at reception. The doctor's clinical version lives on the consultation. */
  chief_complaint: string | null;
  created_at: string;
  updated_at: string;
}

/** Whether this tenant requires an OPD registration before medical records may be opened. */
export interface OpdRegistrationPolicy {
  require_opd_registration: boolean;
}

export interface OpdQueue {
  id: string;
  tenant_id: string;
  encounter_id: string;
  department_id: string;
  doctor_id: string | null;
  token_number: number;
  status: QueueStatus;
  queue_date: string;
  called_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QueueEntry {
  id: string;
  encounter_id: string;
  department_id: string;
  doctor_id: string | null;
  token_number: number;
  status: string;
  queue_date: string;
  called_at: string | null;
  completed_at: string | null;
  patient_id: string;
  patient_name: string | null;
  uhid: string | null;
  visit_type: string | null;
  /** Why this patient is waiting, carried from the encounter. */
  chief_complaint: string | null;
  /** Whether the vitals counter has recorded anything for this encounter yet. */
  has_vitals: boolean;
  camp_id: string | null;
  camp_name: string | null;
  appointment_id: string | null;
  appointment_type: AppointmentType | null;
  appointment_status: AppointmentStatus | null;
  appointment_date: string | null;
  appointment_slot_start: string | null;
  appointment_slot_end: string | null;
  appointment_reason: string | null;
}

export interface EncounterListResponse {
  encounters: Encounter[];
  total: number;
  page: number;
  per_page: number;
}

export interface CreateEncounterRequest {
  patient_id: string;
  department_id: string;
  doctor_id?: string;
  appointment_id?: string | null;
  notes?: string;
  visit_type?: string;
  camp_id?: string;
  chief_complaint?: string;
}

export interface CreateEncounterResponse {
  encounter: Encounter;
  queue: OpdQueue;
}

export interface UpdateEncounterRequest {
  department_id?: string;
  doctor_id?: string;
  notes?: string;
  status?: string;
}

export interface NutritionScreening {
  id: string;
  patient_id: string;
  admission_id: string | null;
  height_cm: number;
  weight_kg: number;
  bmi: number;
  weight_loss_percent: number;
  acute_disease_no_intake: boolean;
  bmi_score: number;
  weight_loss_score: number;
  acute_score: number;
  total_score: number;
  risk: string;
  notes: string | null;
  assessed_by: string | null;
  created_at: string;
}

export interface CreateNutritionScreeningRequest {
  patient_id: string;
  admission_id?: string | null;
  height_cm: number;
  weight_kg: number;
  weight_loss_percent?: number;
  acute_disease_no_intake?: boolean;
  notes?: string | null;
}

export interface CumulativeDoseResult {
  study_count: number;
  cumulative_dlp: number;
  estimated_effective_msv: number;
  review_threshold_msv: number;
  over_threshold: boolean;
  near_threshold: boolean;
}

export interface ContrastScreeningRequest {
  patient_id: string;
  prior_contrast_reaction?: string | null;
  on_metformin?: boolean;
}

export interface ContrastScreeningResult {
  egfr: number | null;
  cin_risk: string;
  reaction_risk: string;
  metformin_action: string;
  clearance: string;
  flags: string[];
}

export interface LungProtectiveRequest {
  height_cm: number;
  sex: string;
  tidal_volume_ml?: number;
}

export interface LungProtectiveResult {
  ibw_kg: number;
  target_ml: number;
  low_ml: number;
  high_ml: number;
  set_ml_per_kg: number | null;
  within_range: boolean | null;
  response: string;
}

export interface AnionGapRequest {
  sodium: number;
  chloride: number;
  bicarbonate: number;
  albumin_g_dl?: number;
}

export interface AnionGapResult {
  anion_gap: number;
  corrected_anion_gap: number | null;
  category: "high" | "normal" | "low";
  response: string;
}

export interface OsmolarGapRequest {
  sodium: number;
  glucose_mg_dl: number;
  bun_mg_dl: number;
  measured_osm: number;
  ethanol_mg_dl?: number;
}

export interface OsmolarGapResult {
  calculated_osm: number;
  osmolar_gap: number;
  category: "elevated" | "normal";
  response: string;
}

export interface PaediatricFluidRequest {
  weight_kg: number;
}

export interface PaediatricFluidResult {
  weight_kg: number;
  hourly_ml: number;
  daily_ml: number;
  response: string;
}

export interface GcsRequest {
  eye: number;
  verbal: number;
  motor: number;
}

export interface GcsResult {
  total: number;
  eye: number;
  verbal: number;
  motor: number;
  severity: string;
  airway_at_risk: boolean;
  response: string;
}

export interface AldreteRequest {
  activity: number;
  respiration: number;
  circulation: number;
  consciousness: number;
  oxygenation: number;
}

export interface AldreteResult {
  total: number;
  activity: number;
  respiration: number;
  circulation: number;
  consciousness: number;
  oxygenation: number;
  discharge_ready: boolean;
  response: string;
}

export interface HypoglycemiaEvent {
  id: string;
  patient_id: string;
  admission_id: string | null;
  glucose_value: number;
  conscious: boolean;
  severity: string;
  treatment: string | null;
  treatment_given_at: string | null;
  recheck_glucose: number | null;
  recheck_at: string | null;
  resolved: boolean;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
}

export interface HypoglycemiaView {
  event: HypoglycemiaEvent;
  treatment_advice: string;
}

export interface CreateHypoglycemiaRequest {
  patient_id: string;
  admission_id?: string | null;
  glucose_value: number;
  conscious?: boolean;
  treatment?: string | null;
  notes?: string | null;
}

export interface HypoglycemiaRecheckRequest {
  recheck_glucose: number;
}

export interface MedReconciliation {
  id: string;
  patient_id: string;
  admission_id: string | null;
  transition_type: string;
  status: string;
  notes: string | null;
  reconciled_by: string | null;
  reconciled_at: string | null;
  created_at: string;
}

export interface MedReconciliationItem {
  id: string;
  reconciliation_id: string;
  drug_name: string;
  dose: string | null;
  frequency: string | null;
  route: string | null;
  source: string;
  decision: string | null;
  decision_reason: string | null;
}

export interface MedReconciliationView {
  reconciliation: MedReconciliation;
  items: MedReconciliationItem[];
}

export interface NewMedItem {
  drug_name: string;
  dose?: string | null;
  frequency?: string | null;
  route?: string | null;
  source?: string | null;
}

export interface CreateMedReconciliationRequest {
  patient_id: string;
  admission_id?: string | null;
  transition_type: string;
  notes?: string | null;
  items: NewMedItem[];
}

export interface DecideItemRequest {
  decision: string;
  decision_reason?: string | null;
}

export interface SepsisBundle {
  id: string;
  patient_id: string;
  admission_id: string | null;
  recognised_at: string;
  fluids_indicated: boolean;
  initial_lactate: number | null;
  lactate_measured_at: string | null;
  blood_cultures_at: string | null;
  antibiotics_at: string | null;
  fluids_started_at: string | null;
  vasopressors_at: string | null;
  bundle_compliant: boolean;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SepsisBundleElement {
  key: string;
  label: string;
  done: boolean;
  on_time: boolean;
  required: boolean;
}

export interface SepsisBundleView {
  bundle: SepsisBundle;
  elements: SepsisBundleElement[];
}

export interface CreateSepsisBundleRequest {
  patient_id: string;
  admission_id?: string | null;
  recognised_at?: string;
  fluids_indicated?: boolean;
  initial_lactate?: number | null;
  notes?: string | null;
}

export interface UpdateSepsisBundleRequest {
  mark_lactate?: boolean;
  mark_cultures?: boolean;
  mark_antibiotics?: boolean;
  mark_fluids?: boolean;
  mark_vasopressors?: boolean;
  fluids_indicated?: boolean;
  initial_lactate?: number | null;
  notes?: string | null;
}

export interface PewsRequest {
  behaviour: number;
  cardiovascular: number;
  respiratory: number;
  quarter_hourly_nebuliser?: boolean;
  persistent_vomiting?: boolean;
}

export interface PewsResult {
  total: number;
  behaviour: number;
  cardiovascular: number;
  respiratory: number;
  extra: number;
  max_domain: number;
  triggered: boolean;
  response: string;
}

export interface CamIcuRequest {
  rass: number;
  acute_change_or_fluctuating: boolean;
  inattention: boolean;
  disorganized_thinking: boolean;
}

export interface CamIcuResult {
  rass: number;
  assessable: boolean;
  feature1_acute_or_fluctuating: boolean;
  feature2_inattention: boolean;
  feature3_altered_loc: boolean;
  feature4_disorganized_thinking: boolean;
  delirium_present: boolean;
  response: string;
}

export interface CpotRequest {
  facial_expression: number;
  body_movements: number;
  muscle_tension: number;
  ventilator_or_vocalization: number;
  intubated?: boolean;
}

export interface CpotResult {
  total: number;
  facial_expression: number;
  body_movements: number;
  muscle_tension: number;
  ventilator_or_vocalization: number;
  significant_pain: boolean;
  response: string;
}

export interface WellsPeRequest {
  clinical_signs_dvt?: boolean;
  pe_most_likely?: boolean;
  heart_rate_over_100?: boolean;
  immobilization_or_surgery?: boolean;
  previous_dvt_pe?: boolean;
  hemoptysis?: boolean;
  malignancy?: boolean;
}

export interface WellsPeResult {
  score: number;
  risk_tier: string;
  pe_likely: boolean;
  recommended_workup: string;
  response: string;
}

export interface Cha2ds2VascRequest {
  age: number;
  sex_female?: boolean;
  congestive_heart_failure?: boolean;
  hypertension?: boolean;
  diabetes?: boolean;
  stroke_tia_thromboembolism?: boolean;
  vascular_disease?: boolean;
}

export interface Cha2ds2VascResult {
  score: number;
  age_points: number;
  sex_points: number;
  non_sex_score: number;
  anticoagulation: string;
  response: string;
}

export interface HasBledRequest {
  age: number;
  uncontrolled_hypertension?: boolean;
  abnormal_renal_function?: boolean;
  abnormal_liver_function?: boolean;
  stroke?: boolean;
  bleeding_history?: boolean;
  labile_inr?: boolean;
  drugs_antiplatelet_nsaid?: boolean;
  alcohol_excess?: boolean;
}

export interface HasBledResult {
  score: number;
  elderly_point: number;
  risk: string;
  high_risk: boolean;
  response: string;
}

export interface CiwaArRequest {
  nausea_vomiting: number;
  tremor: number;
  paroxysmal_sweats: number;
  anxiety: number;
  agitation: number;
  tactile_disturbances: number;
  auditory_disturbances: number;
  visual_disturbances: number;
  headache: number;
  orientation: number;
}

export interface CiwaArResult {
  total: number;
  severity: string;
  medication_indicated: boolean;
  response: string;
}

export interface ChildPughRequest {
  bilirubin_mg_dl: number;
  albumin_g_dl: number;
  inr: number;
  ascites: string;
  encephalopathy: string;
}

export interface ChildPughResult {
  total: number;
  bilirubin_points: number;
  albumin_points: number;
  inr_points: number;
  ascites_points: number;
  encephalopathy_points: number;
  class: string;
  response: string;
}

export interface SofaRequest {
  pao2_fio2: number;
  respiratory_support?: boolean;
  platelets: number;
  bilirubin_mg_dl: number;
  cardiovascular_score: number;
  gcs: number;
  creatinine_mg_dl: number;
}

export interface SofaResult {
  total: number;
  respiration: number;
  coagulation: number;
  liver: number;
  cardiovascular: number;
  cns: number;
  renal: number;
  mortality_band: string;
  response: string;
}

export interface MeldRequest {
  bilirubin_mg_dl: number;
  inr: number;
  creatinine_mg_dl: number;
  dialysis_twice_past_week?: boolean;
}

export interface MeldResult {
  score: number;
  mortality_band: string;
  response: string;
}

export interface Curb65Request {
  confusion?: boolean;
  urea_over_7?: boolean;
  respiratory_rate_30_plus?: boolean;
  low_blood_pressure?: boolean;
  age: number;
}

export interface Curb65Result {
  score: number;
  age_point: number;
  risk: string;
  disposition: string;
  response: string;
}

export interface GlasgowBlatchfordRequest {
  urea_mmol_l: number;
  hemoglobin_g_dl: number;
  sex_male?: boolean;
  systolic_bp: number;
  pulse_100_plus?: boolean;
  melena?: boolean;
  syncope?: boolean;
  hepatic_disease?: boolean;
  cardiac_failure?: boolean;
}

export interface GlasgowBlatchfordResult {
  score: number;
  urea_points: number;
  hemoglobin_points: number;
  systolic_bp_points: number;
  risk: string;
  response: string;
}

export interface WellsDvtRequest {
  active_cancer?: boolean;
  paralysis_or_immobilisation?: boolean;
  bedridden_or_surgery?: boolean;
  localized_tenderness?: boolean;
  entire_leg_swollen?: boolean;
  calf_swelling_3cm?: boolean;
  pitting_edema?: boolean;
  collateral_veins?: boolean;
  previous_dvt?: boolean;
  alternative_diagnosis?: boolean;
}

export interface WellsDvtResult {
  score: number;
  risk_tier: string;
  dvt_likely: boolean;
  recommended_workup: string;
  response: string;
}

export interface MeowsRequest {
  respiratory_rate: number;
  spo2: number;
  temperature: number;
  systolic_bp: number;
  diastolic_bp: number;
  pulse: number;
  not_alert?: boolean;
}

export interface MeowsParam {
  name: string;
  band: string;
}

export interface MeowsResult {
  params: MeowsParam[];
  yellow_count: number;
  red_count: number;
  triggered: boolean;
  response: string;
}

export interface QsofaRequest {
  respiratory_rate: number;
  systolic_bp: number;
  altered_mentation?: boolean;
}

export interface QsofaResult {
  total: number;
  respiratory_rate: number;
  systolic_bp: number;
  mentation: number;
  high_risk: boolean;
  response: string;
}

export interface News2Request {
  respiratory_rate: number;
  spo2: number;
  on_oxygen?: boolean;
  temperature: number;
  systolic_bp: number;
  pulse: number;
  confused_or_worse?: boolean;
}

export interface News2Result {
  total: number;
  respiratory_rate: number;
  spo2: number;
  supplemental_o2: number;
  temperature: number;
  systolic_bp: number;
  pulse: number;
  consciousness: number;
  any_param_three: boolean;
  risk: string;
  response: string;
}

/** VTE (Padua) risk factors — shared by the create request and the stored assessment. */
export interface VteRiskFactors {
  active_cancer: boolean;
  previous_vte: boolean;
  reduced_mobility: boolean;
  thrombophilia: boolean;
  recent_trauma_surgery: boolean;
  age_over_70: boolean;
  cardiac_resp_failure: boolean;
  acute_mi_stroke: boolean;
  acute_infection_rheum: boolean;
  obesity: boolean;
  hormonal_treatment: boolean;
}

export interface CreateVteRequest extends Partial<VteRiskFactors> {
  patient_id: string;
  admission_id?: string;
  has_bleeding_risk?: boolean;
  prophylaxis_type?: string;
  notes?: string;
}

export interface VteRiskAssessment extends VteRiskFactors {
  id: string;
  patient_id: string;
  admission_id: string | null;
  score: number;
  high_risk: boolean;
  prophylaxis_recommended: boolean;
  has_bleeding_risk: boolean;
  prophylaxis_type: string | null;
  notes: string | null;
  assessed_by: string | null;
  created_at: string;
}

export interface Vital {
  id: string;
  tenant_id: string;
  encounter_id: string;
  temperature: string | null;
  pulse: number | null;
  systolic_bp: number | null;
  diastolic_bp: number | null;
  respiratory_rate: number | null;
  spo2: number | null;
  weight_kg: string | null;
  height_cm: string | null;
  bmi: string | null;
  notes: string | null;
  recorded_by: string;
  recorded_at: string;
  created_at: string;
}

export interface CreateVitalRequest {
  temperature?: number;
  pulse?: number;
  systolic_bp?: number;
  diastolic_bp?: number;
  respiratory_rate?: number;
  spo2?: number;
  weight_kg?: number;
  height_cm?: number;
  notes?: string;
}

// -- Structured History Types --

export interface PastMedicalEntry {
  condition: string;
  diagnosed_year?: number;
  status: "active" | "resolved" | "controlled";
  notes?: string;
}

export interface PastSurgicalEntry {
  procedure: string;
  year?: number;
  hospital?: string;
  notes?: string;
}

export interface FamilyHistoryEntry {
  relation: string;
  condition: string;
  age_of_onset?: number;
  is_alive?: boolean;
  notes?: string;
}

export interface SocialHistory {
  smoking?: { status: "never" | "former" | "current"; packs_per_day?: number; years?: number };
  alcohol?: { status: "never" | "occasional" | "moderate" | "heavy"; frequency?: string };
  tobacco_chewing?: { status: "never" | "former" | "current"; details?: string };
  occupation?: string;
  diet?: string;
  exercise?: string;
  notes?: string;
}

export interface ROSSystem {
  abnormal: boolean;
  details?: string;
}

/** Dynamic — keys are configurable per hospital via tenant_settings.clinical.ros_systems */
export type ReviewOfSystems = Record<string, ROSSystem | undefined>;

export interface PhysicalExamination {
  general?: string;
  heent?: string;
  neck?: string;
  cardiovascular?: string;
  respiratory?: string;
  abdomen?: string;
  musculoskeletal?: string;
  neurological?: string;
  skin?: string;
  extremities?: string;
  genitourinary?: string;
  psychiatric?: string;
}

export interface Consultation {
  id: string;
  tenant_id: string;
  encounter_id: string;
  doctor_id: string;
  chief_complaint: string | null;
  history: string | null;
  examination: string | null;
  plan: string | null;
  notes: string | null;
  hpi: string | null;
  past_medical_history: PastMedicalEntry[] | null;
  past_surgical_history: PastSurgicalEntry[] | null;
  family_history: FamilyHistoryEntry[] | null;
  social_history: SocialHistory | null;
  review_of_systems: ReviewOfSystems | null;
  physical_examination: PhysicalExamination | null;
  general_appearance: string | null;
  snomed_codes: Array<{ code: string; display: string }> | null;
  created_at: string;
  updated_at: string;
}

export interface CreateConsultationRequest {
  chief_complaint?: string;
  history?: string;
  examination?: string;
  plan?: string;
  notes?: string;
  hpi?: string;
  past_medical_history?: PastMedicalEntry[];
  past_surgical_history?: PastSurgicalEntry[];
  family_history?: FamilyHistoryEntry[];
  social_history?: SocialHistory;
  review_of_systems?: ReviewOfSystems;
  physical_examination?: PhysicalExamination;
  general_appearance?: string;
}

export interface UpdateConsultationRequest {
  chief_complaint?: string;
  history?: string;
  examination?: string;
  plan?: string;
  notes?: string;
  hpi?: string;
  past_medical_history?: PastMedicalEntry[];
  past_surgical_history?: PastSurgicalEntry[];
  family_history?: FamilyHistoryEntry[];
  social_history?: SocialHistory;
  review_of_systems?: ReviewOfSystems;
  physical_examination?: PhysicalExamination;
  general_appearance?: string;
  snomed_codes?: Array<{ code: string; display: string }>;
}

export type DiagnosisSeverity = "mild" | "moderate" | "severe" | "critical";
export type DiagnosisCertainty = "suspected" | "probable" | "confirmed" | "ruled_out";
export type DiagnosisCodingSystem = "icd10" | "icd11" | "snomed";

export interface Diagnosis {
  id: string;
  tenant_id: string;
  encounter_id: string;
  icd_code: string | null;
  icd_system: DiagnosisCodingSystem;
  icd_display: string | null;
  icd_source_url: string | null;
  icd_source_version: string | null;
  icd_provider_mode: string | null;
  description: string;
  is_primary: boolean;
  notes: string | null;
  severity: string | null;
  certainty: string | null;
  onset_date: string | null;
  resolved_date: string | null;
  snomed_code: string | null;
  snomed_display: string | null;
  created_at: string;
}

export interface CreateDiagnosisRequest {
  icd_code?: string;
  icd_system?: DiagnosisCodingSystem;
  icd_display?: string;
  icd_source_url?: string;
  icd_source_version?: string;
  icd_provider_mode?: string;
  description: string;
  is_primary?: boolean;
  notes?: string;
  severity?: DiagnosisSeverity;
  certainty?: DiagnosisCertainty;
  onset_date?: string;
  resolved_date?: string;
  snomed_code?: string;
  snomed_display?: string;
}

export interface UpdateDiagnosisRequest {
  icd_code?: string;
  icd_system?: DiagnosisCodingSystem;
  icd_display?: string;
  icd_source_url?: string;
  icd_source_version?: string;
  icd_provider_mode?: string;
  description?: string;
  is_primary?: boolean;
  notes?: string;
  severity?: DiagnosisSeverity;
  certainty?: DiagnosisCertainty;
  onset_date?: string | null;
  resolved_date?: string | null;
  snomed_code?: string | null;
  snomed_display?: string | null;
}

// -- ICD-10 Reference --

export interface Icd10Code {
  id: string;
  code: string;
  short_desc: string;
  long_desc: string | null;
  category: string | null;
  chapter: string | null;
  is_billable: boolean;
  is_active: boolean;
  created_at: string;
}

// -- SNOMED CT Reference --

export interface SnomedCode {
  id: string;
  code: string;
  display_name: string;
  semantic_tag: string | null;
  is_active: boolean;
  created_at: string;
}

// -- Clinical Corpus / Note Completion --

export type ClinicalCorpusType =
  | "soap_phrase"
  | "medical_term"
  | "lay_term"
  | "icd10"
  | "icd11"
  | "snomed"
  | "loinc"
  | "rxnorm";

export type ClinicalCorpusLicenseStatus =
  | "owned"
  | "open"
  | "licensed"
  | "restricted"
  | "reference_only";

export interface ClinicalCorpusEntry {
  id: string;
  tenant_id: string | null;
  entry_key: string;
  corpus_type: ClinicalCorpusType;
  section: string | null;
  term: string;
  aliases: string[];
  short_text: string | null;
  insert_text: string | null;
  source_name: string;
  source_url: string | null;
  license_name: string | null;
  license_status: ClinicalCorpusLicenseStatus;
  source_version: string | null;
  language: string;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SearchClinicalCorpusParams {
  q: string;
  section?: string;
  corpus_type?: ClinicalCorpusType;
  limit?: number;
}

export interface CreateClinicalCorpusEntryRequest {
  corpus_type: ClinicalCorpusType;
  section?: string;
  term: string;
  aliases?: string[];
  short_text?: string;
  insert_text?: string;
  source_name?: string;
  source_url?: string;
  license_name?: string;
  license_status?: ClinicalCorpusLicenseStatus;
  source_version?: string;
  language?: string;
  priority?: number;
}

export interface UpdateClinicalCorpusEntryRequest {
  section?: string;
  term?: string;
  aliases?: string[];
  short_text?: string;
  insert_text?: string;
  source_name?: string;
  source_url?: string;
  license_name?: string;
  license_status?: ClinicalCorpusLicenseStatus;
  source_version?: string;
  language?: string;
  priority?: number;
  is_active?: boolean;
}

// -- Terminology Service --

export type TerminologySystem = "icd11" | "snomed";

export type TerminologyProviderMode =
  | "official_api_cache"
  | "official_api_cloud"
  | "official_api_local"
  | "official_release_cache"
  | "local_cache";

export interface TerminologySearchResult {
  system: TerminologySystem;
  code: string;
  display: string;
  semantic_tag: string | null;
  source: string;
  source_url: string | null;
  source_version: string | null;
  active: boolean;
  provider_mode: TerminologyProviderMode;
  corpus_entry_id: string | null;
}

export interface TerminologySearchResponse {
  results: TerminologySearchResult[];
  suggestions: string[];
}

export interface SearchTerminologyParams {
  system: TerminologySystem;
  q: string;
  limit?: number;
  semantic_tag?: string;
}

export interface LookupTerminologyParams {
  system: TerminologySystem;
  code: string;
}

// -- Wait Time Estimation --

export interface WaitEstimate {
  estimated_minutes: number;
  queue_position: number;
  avg_consultation_minutes: number;
}

// -- Multi-Doctor Appointment Group --

export interface SlotRequest {
  doctor_id: string;
  department_id: string;
  appointment_date: string;
  slot_start: string;
  slot_end: string;
  appointment_type?: AppointmentType;
  notes?: string;
}

export interface BookAppointmentGroupRequest {
  patient_id: string;
  slot_requests: SlotRequest[];
}

// -- OPD → IPD Admission --

export interface AdmitFromOpdRequest {
  department_id: string;
  ward_id?: string;
  bed_id?: string;
  doctor_id?: string;
  notes?: string;
}

export interface AdmitFromOpdResponse {
  ipd_encounter: Encounter;
  admission: Admission;
  vitals_copied: number;
  diagnoses_copied: number;
  prescriptions_copied: number;
}

// -- Available Beds --

export interface AvailableBed {
  bed_id: string;
  bed_number: string;
  ward_id: string | null;
  ward_name: string | null;
  room_number: string | null;
  bed_type: string | null;
  is_isolation: boolean;
}

// -- Chief Complaint Masters --

export interface ChiefComplaintMaster {
  id: string;
  tenant_id: string;
  name: string;
  category: string | null;
  synonyms: string[];
  suggested_icd: string[];
  is_active: boolean;
  created_at: string;
}

export interface Prescription {
  id: string;
  tenant_id: string;
  encounter_id: string;
  doctor_id: string;
  notes: string | null;
  order_mode: RxOrderMode;
  transcribed_by: string | null;
  read_back_confirmed: boolean;
  countersign_due_at: string | null;
  is_signed: boolean;
  created_at: string;
  updated_at: string;
}
