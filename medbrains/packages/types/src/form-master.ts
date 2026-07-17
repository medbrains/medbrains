// Form Master / Field Master / Module Linker types — split from index.ts, barrel-re-exported.
import type {
  FieldAccessLevel,
  FieldDataType,
  FieldValidation,
  FormStatus,
  RequirementLevel,
} from "./common";
import type { FieldAction, FieldDataSource } from "./form-runtime";

// ── Form Master / Field Master / Module Linker ──────────

export interface FieldCondition {
  field: string;
  operator:
    | "eq"
    | "neq"
    | "in"
    | "not_in"
    | "contains"
    | "is_empty"
    | "is_not_empty"
    | "gt"
    | "lt"
    | "gte"
    | "lte";
  value?: unknown;
  values?: unknown[];
  all?: FieldCondition[];
  any?: FieldCondition[];
}

export interface RegulatoryClauseRef {
  body_code: string;
  body_name: string;
  clause_code: string | null;
  clause_reference: string | null;
  requirement_level: RequirementLevel;
}

export interface ResolvedField {
  field_code: string;
  label: string;
  description: string | null;
  data_type: FieldDataType;
  requirement_level: RequirementLevel;
  default_value: string | null;
  placeholder: string | null;
  validation: FieldValidation | null;
  ui_component: string | null;
  ui_width: string | null;
  ui_hint: string | null;
  icon: string | null;
  icon_position: "left" | "right" | null;
  condition: FieldCondition | null;
  is_quick_mode: boolean;
  is_hidden: boolean;
  access_level: FieldAccessLevel;
  regulatory_clauses: RegulatoryClauseRef[];
  data_source: FieldDataSource | null;
  actions: FieldAction[];
}

export interface ResolvedSection {
  code: string;
  name: string;
  sort_order: number;
  is_collapsible: boolean;
  is_default_open: boolean;
  icon: string | null;
  color: string | null;
  fields: ResolvedField[];
}

export interface ResolvedFormDefinition {
  form_code: string;
  form_name: string;
  version: number;
  config: Record<string, unknown> | null;
  sections: ResolvedSection[];
}

export interface TenantFieldOverride {
  id: string;
  tenant_id: string;
  field_id: string;
  form_id: string | null;
  label_override: string | null;
  requirement_override: RequirementLevel | null;
  is_hidden: boolean;
  validation_override: FieldValidation | null;
  created_at: string;
  updated_at: string;
}

export interface FormMaster {
  id: string;
  code: string;
  name: string;
  version: number;
  status: FormStatus;
  config: Record<string, unknown> | null;
  published_at: string | null;
  published_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FieldMaster {
  id: string;
  code: string;
  name: string;
  description: string | null;
  data_type: FieldDataType;
  is_system: boolean;
  is_active: boolean;
}

export interface ModuleFormLink {
  module_code: string;
  form_id: string;
  context: string;
}
