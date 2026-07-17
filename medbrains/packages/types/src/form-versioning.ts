// Form versioning + regulatory-body types — split from index.ts, barrel-re-exported.
import type { FieldDataType, FieldValidation, FormStatus, RequirementLevel } from "./common";

// ── Form Versioning Types ──────────────────────────────────

export interface FormVersionSummary {
  id: string;
  form_id: string;
  version: number;
  name: string;
  status: FormStatus;
  config: Record<string, unknown> | null;
  change_summary: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
}

export interface FormVersionSnapshot {
  id: string;
  form_id: string;
  version: number;
  name: string;
  status: FormStatus;
  config: Record<string, unknown> | null;
  snapshot: FormSnapshotData;
  change_summary: string | null;
  created_by: string | null;
  created_at: string;
}

export interface FormSnapshotData {
  sections: FormSnapshotSection[];
}

export interface FormSnapshotSection {
  id: string;
  code: string;
  name: string;
  sort_order: number;
  is_collapsible: boolean;
  is_default_open: boolean;
  icon: string | null;
  color: string | null;
  fields: FormSnapshotField[];
}

export interface FormSnapshotField {
  ff_id: string;
  field_id: string;
  field_code: string;
  field_name: string;
  data_type: FieldDataType;
  sort_order: number;
  label_override: string | null;
  is_quick_mode: boolean;
  icon: string | null;
  icon_position: string | null;
  field_master_snapshot: {
    placeholder: string | null;
    validation: FieldValidation | null;
    ui_width: string | null;
    data_source: Record<string, unknown> | null;
    actions: Record<string, unknown> | null;
  };
}

export interface PublishFormRequest {
  change_summary?: string;
}

export interface FormDiffResponse {
  v1: number;
  v2: number;
  config_changes: PropertyChange[];
  section_changes: SectionChange[];
  summary: DiffSummary;
}

export interface PropertyChange {
  property: string;
  old_value: unknown;
  new_value: unknown;
}

export interface SectionChange {
  code: string;
  name: string;
  change_type: "added" | "removed" | "modified";
  field_changes: FieldChange[];
}

export interface FieldChange {
  field_code: string;
  field_name: string;
  change_type: "added" | "removed" | "modified" | "moved";
  property_changes: PropertyChange[];
}

export interface DiffSummary {
  sections_added: number;
  sections_removed: number;
  sections_modified: number;
  fields_added: number;
  fields_removed: number;
  fields_modified: number;
}

export interface FieldAuditEntry {
  id: string;
  field_id: string;
  action: "created" | "updated";
  previous_state: Record<string, unknown> | null;
  new_state: Record<string, unknown>;
  changed_fields: string[] | null;
  changed_by: string | null;
  changed_by_name: string | null;
  changed_at: string;
}

export interface TenantFieldOverrideRow {
  id: string;
  field_id: string;
  field_code: string;
  field_name: string;
  form_id: string | null;
  label_override: string | null;
  requirement_override: RequirementLevel | null;
  is_hidden: boolean;
  validation_override: FieldValidation | null;
}

export interface RegulatoryClauseWithContext {
  id: string;
  field_id: string;
  field_code: string;
  field_name: string;
  regulatory_body_id: string;
  body_code: string;
  body_name: string;
  body_level: string;
  requirement_level: RequirementLevel;
  clause_reference: string | null;
  clause_code: string | null;
  description: string | null;
}

export interface CreateFormRequest {
  code: string;
  name: string;
  status?: FormStatus;
  config?: Record<string, unknown>;
}

export interface UpdateFormRequest {
  name?: string;
  status?: FormStatus;
  config?: Record<string, unknown>;
}

export interface CreateFieldRequest {
  code: string;
  name: string;
  description?: string;
  data_type: FieldDataType;
  default_value?: string;
  placeholder?: string;
  validation?: FieldValidation;
  ui_component?: string;
  ui_width?: string;
  fhir_path?: string;
  db_table?: string;
  db_column?: string;
}

export interface UpdateFieldRequest {
  name?: string;
  description?: string;
  data_type?: FieldDataType;
  validation?: FieldValidation;
  default_value?: string;
  placeholder?: string;
  ui_component?: string;
  ui_width?: string;
  is_active?: boolean;
}

export interface CreateSectionRequest {
  code: string;
  name: string;
  sort_order?: number;
  is_collapsible?: boolean;
  is_default_open?: boolean;
  icon?: string;
  color?: string;
}

export interface UpdateSectionRequest {
  name?: string;
  is_collapsible?: boolean;
  is_default_open?: boolean;
  icon?: string;
  color?: string;
}

export interface AddFieldToFormRequest {
  field_id: string;
  section_id: string;
  sort_order?: number;
  label_override?: string;
  is_quick_mode?: boolean;
  icon?: string | null;
  icon_position?: string | null;
}

export interface UpdateFormFieldRequest {
  label_override?: string | null;
  is_quick_mode?: boolean;
  section_id?: string;
  icon?: string | null;
  icon_position?: string | null;
}

export interface ReorderItem {
  id: string;
  sort_order: number;
}

export interface CreateModuleLinkRequest {
  module_code: string;
  form_id: string;
  context?: string;
}

// ── Regulatory Body Management ────────────────────────────

export interface RegulatoryBodyFull {
  id: string;
  code: string;
  name: string;
  level: "international" | "national" | "state" | "education";
  country_id: string | null;
  state_id: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateRegulatoryBodyRequest {
  code: string;
  name: string;
  level: "international" | "national" | "state" | "education";
  country_id?: string;
  state_id?: string;
  description?: string;
}

export interface UpdateRegulatoryBodyRequest {
  name?: string;
  description?: string;
  is_active?: boolean;
}

export interface CreateRegulatoryLinkRequest {
  field_id: string;
  regulatory_body_id: string;
  requirement_level: RequirementLevel;
  clause_reference?: string;
  clause_code?: string;
  description?: string;
}

export interface UpdateRegulatoryLinkRequest {
  requirement_level?: RequirementLevel;
  clause_reference?: string;
  clause_code?: string;
  description?: string;
}
