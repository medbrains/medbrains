// Field mapping (map-data transform node) types — split from index.ts, barrel-re-exported.

// ── Field Mapping (Map Data Transform Node) ─────────────

export type StringOperationType =
  | "uppercase"
  | "lowercase"
  | "trim"
  | "capitalize"
  | "camel_case"
  | "snake_case"
  | "kebab_case"
  | "slug"
  | "pad_start"
  | "pad_end"
  | "substring"
  | "replace"
  | "regex_replace"
  | "regex_extract"
  | "split"
  | "template"
  | "truncate"
  | "encode_base64"
  | "decode_base64";

export type ArrayOperationType =
  | "join"
  | "flatten"
  | "unique"
  | "sort_array"
  | "reverse"
  | "first"
  | "last"
  | "nth"
  | "count"
  | "filter"
  | "map_each"
  | "pluck"
  | "sum"
  | "avg"
  | "array_min"
  | "array_max"
  | "push"
  | "concat_arrays"
  | "slice"
  | "chunk";

export type NumberOperationType =
  | "to_number"
  | "round"
  | "ceil"
  | "floor"
  | "abs"
  | "mod"
  | "add"
  | "subtract"
  | "multiply"
  | "divide"
  | "clamp"
  | "format_number";

export type DateOperationType =
  | "to_date"
  | "format_date"
  | "parse_date"
  | "add_days"
  | "add_hours"
  | "subtract_days"
  | "date_diff"
  | "now"
  | "extract_year"
  | "extract_month"
  | "extract_day";

export type ConversionOperationType =
  | "to_string"
  | "to_boolean"
  | "to_array"
  | "parse_json"
  | "to_json"
  | "coalesce"
  | "default_value"
  | "is_null"
  | "is_empty"
  | "typeof";

export type MergeOperationType = "merge_field";

export type MappingOperationType =
  | "none"
  | StringOperationType
  | ArrayOperationType
  | NumberOperationType
  | DateOperationType
  | ConversionOperationType
  | MergeOperationType;

export type OperationCategory = "string" | "array" | "number" | "date" | "conversion" | "merge";

export interface OperationDescriptor {
  type: MappingOperationType;
  label: string;
  category: OperationCategory;
  description: string;
  hasConfig: boolean;
}

export interface MappingOperationConfig {
  dateFormat?: string;
  separator?: string;
  start?: number;
  end?: number;
  find?: string;
  replaceWith?: string;
  defaultValue?: string;
  templateString?: string;
  padChar?: string;
  padLength?: number;
  regex?: string;
  regexFlags?: string;
  maxLength?: number;
  suffix?: string;
  index?: number;
  field?: string;
  condition?: string;
  chunkSize?: number;
  operand?: number;
  minValue?: number;
  maxValue?: number;
  decimalPlaces?: number;
  locale?: string;
  inputFormat?: string;
  outputFormat?: string;
  days?: number;
  hours?: number;
  /** merge_field: path of the additional source field to merge */
  mergeFieldPath?: string;
  /** merge_field: how to combine — concat, template, fallback, arithmetic */
  mergeCombineMode?: string;
}

export interface TransformStep {
  id: string;
  operation: MappingOperationType;
  config: MappingOperationConfig;
}

// Combine modes for multi-source mapping
export type CombineMode = "single" | "concat" | "fallback" | "template" | "arithmetic";

export interface MappingSource {
  id: string;
  path: string;
  nodeId?: string;
  /** Nested group: when children exist, this is a group node */
  children?: MappingSource[];
  /** Combine mode for this group's children */
  groupCombineMode?: CombineMode;
  /** Combine config for this group */
  groupCombineConfig?: CombineConfig;
}

export interface CombineConfig {
  separator?: string;
  templateStr?: string;
  expression?: string;
}

export type MappingFieldType =
  | "string"
  | "number"
  | "boolean"
  | "array"
  | "object"
  | "date"
  | "null"
  | "unknown";

export interface TargetFieldSuggestion {
  path: string;
  label: string;
  group: string;
  type?: MappingFieldType;
}

export interface FieldMapping {
  id: string;
  from: string;
  to: string;
  operation: MappingOperationType;
  operationConfig: MappingOperationConfig;
  chain?: TransformStep[];
  sources?: MappingSource[];
  combineMode?: CombineMode;
  combineConfig?: CombineConfig;
}

export interface AvailableField {
  nodeId: string;
  nodeLabel: string;
  path: string;
  source?: string;
  type?: MappingFieldType;
}
