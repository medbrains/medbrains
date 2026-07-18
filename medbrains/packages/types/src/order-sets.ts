// Order sets types — split from index.ts, barrel-re-exported.

// ── Order Sets ─────────────────────────────────────────────

export type OrderSetContext =
  | "general"
  | "admission"
  | "pre_operative"
  | "diagnosis_specific"
  | "department_specific";
export type OrderSetItemType = "lab" | "medication" | "nursing" | "diet";

export interface OrderSetTemplate {
  id: string;
  tenant_id: string;
  name: string;
  code: string | null;
  description: string | null;
  context: OrderSetContext;
  department_id: string | null;
  trigger_diagnoses: string[] | null;
  surgery_type: string | null;
  version: number;
  is_current: boolean;
  parent_template_id: string | null;
  is_active: boolean;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderSetTemplateItem {
  id: string;
  tenant_id: string;
  template_id: string;
  item_type: OrderSetItemType;
  sort_order: number;
  is_mandatory: boolean;
  default_selected: boolean;
  lab_test_id: string | null;
  lab_priority: string | null;
  lab_notes: string | null;
  drug_catalog_id: string | null;
  drug_name: string | null;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  route: string | null;
  med_instructions: string | null;
  task_type: string | null;
  task_description: string | null;
  task_frequency: string | null;
  diet_template_id: string | null;
  diet_type: string | null;
  diet_instructions: string | null;
  created_at: string;
}

export interface OrderSetActivation {
  id: string;
  tenant_id: string;
  template_id: string;
  template_version: number;
  encounter_id: string | null;
  patient_id: string;
  admission_id: string | null;
  activated_by: string | null;
  diagnosis_icd: string | null;
  total_items: number;
  selected_items: number;
  notes: string | null;
  created_at: string;
}

export interface OrderSetActivationItem {
  id: string;
  tenant_id: string;
  activation_id: string;
  template_item_id: string | null;
  item_type: OrderSetItemType;
  was_selected: boolean;
  skip_reason: string | null;
  lab_order_id: string | null;
  prescription_id: string | null;
  nursing_task_id: string | null;
  diet_order_id: string | null;
  created_at: string;
}

export interface OrderSetUsageStats {
  id: string;
  tenant_id: string;
  template_id: string;
  period_start: string;
  period_end: string;
  activation_count: number;
  unique_doctors: number;
  items_ordered: number;
  items_skipped: number;
  completion_rate: number;
}

export interface TemplateWithItems {
  template: OrderSetTemplate;
  items: OrderSetTemplateItem[];
}

export interface ActivationWithItems {
  activation: OrderSetActivation;
  items: OrderSetActivationItem[];
}

export interface ActivationCounts {
  lab_orders: number;
  prescriptions: number;
  nursing_tasks: number;
  diet_orders: number;
}

export interface ActivationResult {
  activation: OrderSetActivation;
  items_created: ActivationCounts;
}

export interface OrderSetAnalyticsSummary {
  total_templates: number;
  total_activations: number;
  unique_doctors: number;
  avg_completion_rate: number;
}

export interface CreateOrderSetTemplateRequest {
  name: string;
  code?: string;
  description?: string;
  context: OrderSetContext;
  department_id?: string;
  trigger_diagnoses?: string[];
  surgery_type?: string;
}

export interface UpdateOrderSetTemplateRequest {
  name?: string;
  code?: string;
  description?: string;
  context?: OrderSetContext;
  department_id?: string;
  trigger_diagnoses?: string[];
  surgery_type?: string;
}

export interface AddOrderSetItemRequest {
  item_type: OrderSetItemType;
  sort_order?: number;
  is_mandatory?: boolean;
  default_selected?: boolean;
  lab_test_id?: string;
  lab_priority?: string;
  lab_notes?: string;
  drug_catalog_id?: string;
  drug_name?: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  route?: string;
  med_instructions?: string;
  task_type?: string;
  task_description?: string;
  task_frequency?: string;
  diet_template_id?: string;
  diet_type?: string;
  diet_instructions?: string;
}

export interface UpdateOrderSetItemRequest {
  sort_order?: number;
  is_mandatory?: boolean;
  default_selected?: boolean;
  lab_test_id?: string;
  lab_priority?: string;
  lab_notes?: string;
  drug_catalog_id?: string;
  drug_name?: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  route?: string;
  med_instructions?: string;
  task_type?: string;
  task_description?: string;
  task_frequency?: string;
  diet_template_id?: string;
  diet_type?: string;
  diet_instructions?: string;
}

export interface ActivateOrderSetRequest {
  template_id: string;
  encounter_id?: string;
  patient_id: string;
  admission_id?: string;
  diagnosis_icd?: string;
  notes?: string;
  items: { template_item_id: string; selected: boolean; skip_reason?: string }[];
}
