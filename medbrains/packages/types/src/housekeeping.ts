// Housekeeping types — split from index.ts, barrel-re-exported.

// ── Housekeeping ──────────────────────────────────────────

export type CleaningAreaType =
  | "icu"
  | "ward"
  | "ot"
  | "er"
  | "lab"
  | "pharmacy"
  | "corridor"
  | "lobby"
  | "washroom"
  | "kitchen"
  | "general";
export type CleaningTaskStatusType =
  | "pending"
  | "assigned"
  | "in_progress"
  | "completed"
  | "verified"
  | "rejected";
export type LinenStatusType = "clean" | "in_use" | "soiled" | "washing" | "condemned";
export type LinenContaminationTypeValue = "regular" | "contaminated" | "isolation";

export interface CleaningSchedule {
  id: string;
  tenant_id: string;
  area_type: CleaningAreaType;
  location_id?: string;
  department_id?: string;
  frequency_hours: number;
  checklist_items: unknown;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CleaningTask {
  id: string;
  tenant_id: string;
  schedule_id?: string;
  location_id?: string;
  department_id?: string;
  area_type: CleaningAreaType;
  task_date: string;
  assigned_to?: string;
  status: CleaningTaskStatusType;
  started_at?: string;
  completed_at?: string;
  verified_by?: string;
  verified_at?: string;
  checklist_results: unknown;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface RoomTurnaround {
  id: string;
  tenant_id: string;
  location_id?: string;
  patient_id?: string;
  discharge_at?: string;
  dirty_at?: string;
  cleaning_started_at?: string;
  cleaning_completed_at?: string;
  ready_at?: string;
  turnaround_minutes?: number;
  cleaned_by?: string;
  verified_by?: string;
  created_at: string;
  updated_at: string;
}

export interface PestControlSchedule {
  id: string;
  tenant_id: string;
  location_id?: string;
  department_id?: string;
  pest_type: string;
  frequency_months: number;
  last_done?: string;
  next_due?: string;
  vendor_name?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface PestControlLog {
  id: string;
  tenant_id: string;
  schedule_id?: string;
  treatment_date: string;
  treatment_type: string;
  chemicals_used?: string;
  areas_treated: unknown;
  vendor_name?: string;
  certificate_no?: string;
  next_due?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface LinenItem {
  id: string;
  tenant_id: string;
  barcode?: string;
  item_type: string;
  current_status: LinenStatusType;
  ward_id?: string;
  wash_count: number;
  max_washes: number;
  commissioned_date?: string;
  condemned_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface LinenMovement {
  id: string;
  tenant_id: string;
  linen_item_id?: string;
  movement_type: string;
  from_ward?: string;
  to_ward?: string;
  quantity: number;
  weight_kg?: number;
  contamination_type: LinenContaminationTypeValue;
  batch_id?: string;
  recorded_by?: string;
  movement_date: string;
  created_at: string;
  updated_at: string;
}

export interface LaundryBatch {
  id: string;
  tenant_id: string;
  batch_number: string;
  items_count: number;
  total_weight?: number;
  contamination_type: LinenContaminationTypeValue;
  wash_formula?: string;
  wash_temperature?: number;
  cycle_minutes?: number;
  started_at?: string;
  completed_at?: string;
  status: string;
  operator_name?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface LinenParLevel {
  id: string;
  tenant_id: string;
  ward_id?: string;
  item_type: string;
  par_level: number;
  current_stock: number;
  reorder_level: number;
  created_at: string;
  updated_at: string;
}

export interface LinenCondemnation {
  id: string;
  tenant_id: string;
  linen_item_id?: string;
  reason: string;
  wash_count_at_condemn?: number;
  condemned_by?: string;
  condemned_date: string;
  replacement_requested: boolean;
  created_at: string;
  updated_at: string;
}

// Request types
export interface CreateCleaningScheduleRequest {
  area_type: string;
  location_id?: string;
  department_id?: string;
  frequency_hours?: number;
  checklist_items?: unknown;
  is_active?: boolean;
  notes?: string;
}
export interface UpdateCleaningScheduleRequest {
  area_type?: string;
  location_id?: string;
  department_id?: string;
  frequency_hours?: number;
  checklist_items?: unknown;
  is_active?: boolean;
  notes?: string;
}
export interface CreateCleaningTaskRequest {
  schedule_id?: string;
  location_id?: string;
  department_id?: string;
  area_type: string;
  task_date?: string;
  assigned_to?: string;
  notes?: string;
}
export interface UpdateTaskStatusRequest {
  status: string;
}
export interface CreateTurnaroundRequest {
  location_id?: string;
  patient_id?: string;
  discharge_at?: string;
  dirty_at?: string;
  cleaned_by?: string;
}
export interface CreatePestControlScheduleRequest {
  location_id?: string;
  department_id?: string;
  pest_type: string;
  frequency_months?: number;
  last_done?: string;
  next_due?: string;
  vendor_name?: string;
  notes?: string;
}
export interface UpdatePestControlScheduleRequest {
  pest_type?: string;
  frequency_months?: number;
  last_done?: string;
  next_due?: string;
  vendor_name?: string;
  notes?: string;
}
export interface CreatePestControlLogRequest {
  schedule_id?: string;
  treatment_date: string;
  treatment_type: string;
  chemicals_used?: string;
  areas_treated?: unknown;
  vendor_name?: string;
  certificate_no?: string;
  next_due?: string;
  notes?: string;
}
export interface CreateLinenItemRequest {
  barcode?: string;
  item_type: string;
  current_status?: string;
  ward_id?: string;
  max_washes?: number;
  commissioned_date?: string;
  notes?: string;
}
export interface UpdateLinenItemRequest {
  current_status?: string;
  ward_id?: string;
  notes?: string;
}
export interface CreateLinenMovementRequest {
  linen_item_id?: string;
  movement_type: string;
  from_ward?: string;
  to_ward?: string;
  quantity?: number;
  weight_kg?: number;
  contamination_type?: string;
  batch_id?: string;
  recorded_by?: string;
}
export interface CreateLaundryBatchRequest {
  batch_number: string;
  items_count?: number;
  total_weight?: number;
  contamination_type?: string;
  wash_formula?: string;
  wash_temperature?: number;
  cycle_minutes?: number;
  operator_name?: string;
  notes?: string;
}
export interface UpsertParLevelRequest {
  ward_id?: string;
  item_type: string;
  par_level: number;
  current_stock?: number;
  reorder_level?: number;
}
export interface CreateLinenCondemnationRequest {
  linen_item_id?: string;
  reason: string;
  wash_count_at_condemn?: number;
  replacement_requested?: boolean;
}
