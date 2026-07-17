// Form-runtime types (data-source binding + field actions) — split from index.ts, barrel-re-exported.

// ── Data Source Binding ─────────────────────────────────

/** How a select/multiselect/radio/checkbox field gets its options */
export type DataSourceType = "static" | "api" | "dependent";

export interface FieldDataSource {
  type: DataSourceType;

  // For type="api" — direct API fetch
  endpoint?: string;
  method?: "GET" | "POST";
  valueKey?: string;
  labelKey?: string;
  params?: Record<string, string>;

  // For type="dependent" — cascading (extends api)
  dependsOn?: string;
  parentParamKey?: string;
}

// ── Field Actions ───────────────────────────────────────

export type FieldActionTrigger = "on_click" | "on_blur" | "on_change";
export type FieldActionType = "api_call" | "validate" | "lookup" | "copy_value";

export interface FieldAction {
  id: string;
  label: string;
  trigger: FieldActionTrigger;
  actionType: FieldActionType;
  icon?: string;

  // For api_call
  endpoint?: string;
  method?: "GET" | "POST";
  bodyMapping?: Record<string, string>;
  responseMapping?: Record<string, string>;

  // For validate
  validationExpr?: string;

  // For lookup
  lookupEntity?: string;
  lookupDisplayFields?: string[];

  // For copy_value
  sourceField?: string;
  targetField?: string;
}
