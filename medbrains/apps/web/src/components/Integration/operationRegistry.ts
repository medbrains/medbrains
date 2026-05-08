import type {
  MappingOperationType,
  OperationCategory,
  OperationDescriptor,
} from "@medbrains/types";

export const OPERATION_CATEGORIES: {
  key: OperationCategory;
  label: string;
}[] = [
  { key: "string", label: "String" },
  { key: "array", label: "Array" },
  { key: "number", label: "Number" },
  { key: "date", label: "Date" },
  { key: "conversion", label: "Conversion" },
  { key: "merge", label: "Merge" },
];

export const OPERATION_DESCRIPTORS: OperationDescriptor[] = [
  // ── String ──────────────────────────────────────────────
  {
    type: "uppercase",
    label: "Uppercase",
    category: "string",
    description: "Convert to UPPERCASE",
    hasConfig: false,
  },
  {
    type: "lowercase",
    label: "Lowercase",
    category: "string",
    description: "Convert to lowercase",
    hasConfig: false,
  },
  {
    type: "trim",
    label: "Trim",
    category: "string",
    description: "Remove leading/trailing whitespace",
    hasConfig: false,
  },
  {
    type: "capitalize",
    label: "Capitalize",
    category: "string",
    description: "Capitalize first letter of each word",
    hasConfig: false,
  },
  {
    type: "camel_case",
    label: "camelCase",
    category: "string",
    description: "Convert to camelCase",
    hasConfig: false,
  },
  {
    type: "snake_case",
    label: "snake_case",
    category: "string",
    description: "Convert to snake_case",
    hasConfig: false,
  },
  {
    type: "kebab_case",
    label: "kebab-case",
    category: "string",
    description: "Convert to kebab-case",
    hasConfig: false,
  },
  {
    type: "slug",
    label: "Slug",
    category: "string",
    description: "URL-safe slug (lowercase, hyphens)",
    hasConfig: false,
  },
  {
    type: "pad_start",
    label: "Pad Start",
    category: "string",
    description: "Pad string at start to target length",
    hasConfig: true,
  },
  {
    type: "pad_end",
    label: "Pad End",
    category: "string",
    description: "Pad string at end to target length",
    hasConfig: true,
  },
  {
    type: "substring",
    label: "Substring",
    category: "string",
    description: "Extract part of a string by index",
    hasConfig: true,
  },
  {
    type: "replace",
    label: "Replace",
    category: "string",
    description: "Replace text occurrences",
    hasConfig: true,
  },
  {
    type: "regex_replace",
    label: "Regex Replace",
    category: "string",
    description: "Replace using a regular expression",
    hasConfig: true,
  },
  {
    type: "regex_extract",
    label: "Regex Extract",
    category: "string",
    description: "Extract first match of a regex",
    hasConfig: true,
  },
  {
    type: "split",
    label: "Split",
    category: "string",
    description: "Split string into array by separator",
    hasConfig: true,
  },
  {
    type: "template",
    label: "Template",
    category: "string",
    description: "Interpolate {{value}} into a template",
    hasConfig: true,
  },
  {
    type: "truncate",
    label: "Truncate",
    category: "string",
    description: "Truncate string to max length",
    hasConfig: true,
  },
  {
    type: "encode_base64",
    label: "Encode Base64",
    category: "string",
    description: "Encode string as Base64",
    hasConfig: false,
  },
  {
    type: "decode_base64",
    label: "Decode Base64",
    category: "string",
    description: "Decode Base64 string",
    hasConfig: false,
  },

  // ── Array ───────────────────────────────────────────────
  {
    type: "join",
    label: "Join",
    category: "array",
    description: "Join array elements into a string",
    hasConfig: true,
  },
  {
    type: "flatten",
    label: "Flatten",
    category: "array",
    description: "Flatten nested arrays one level",
    hasConfig: false,
  },
  {
    type: "unique",
    label: "Unique",
    category: "array",
    description: "Remove duplicate values",
    hasConfig: false,
  },
  {
    type: "sort_array",
    label: "Sort",
    category: "array",
    description: "Sort array elements",
    hasConfig: false,
  },
  {
    type: "reverse",
    label: "Reverse",
    category: "array",
    description: "Reverse array order",
    hasConfig: false,
  },
  {
    type: "first",
    label: "First",
    category: "array",
    description: "Get first element",
    hasConfig: false,
  },
  {
    type: "last",
    label: "Last",
    category: "array",
    description: "Get last element",
    hasConfig: false,
  },
  {
    type: "nth",
    label: "Nth",
    category: "array",
    description: "Get element at index",
    hasConfig: true,
  },
  {
    type: "count",
    label: "Count",
    category: "array",
    description: "Get array length",
    hasConfig: false,
  },
  {
    type: "filter",
    label: "Filter",
    category: "array",
    description: "Filter elements by condition",
    hasConfig: true,
  },
  {
    type: "map_each",
    label: "Map Each",
    category: "array",
    description: "Apply operation to each element",
    hasConfig: true,
  },
  {
    type: "pluck",
    label: "Pluck",
    category: "array",
    description: "Extract field from each object",
    hasConfig: true,
  },
  {
    type: "sum",
    label: "Sum",
    category: "array",
    description: "Sum all numeric elements",
    hasConfig: false,
  },
  {
    type: "avg",
    label: "Average",
    category: "array",
    description: "Average of numeric elements",
    hasConfig: false,
  },
  {
    type: "array_min",
    label: "Min",
    category: "array",
    description: "Minimum value in array",
    hasConfig: false,
  },
  {
    type: "array_max",
    label: "Max",
    category: "array",
    description: "Maximum value in array",
    hasConfig: false,
  },
  {
    type: "push",
    label: "Push",
    category: "array",
    description: "Add a value to the array",
    hasConfig: true,
  },
  {
    type: "concat_arrays",
    label: "Concat Arrays",
    category: "array",
    description: "Concatenate with another array",
    hasConfig: false,
  },
  {
    type: "slice",
    label: "Slice",
    category: "array",
    description: "Extract a portion of the array",
    hasConfig: true,
  },
  {
    type: "chunk",
    label: "Chunk",
    category: "array",
    description: "Split array into chunks of N",
    hasConfig: true,
  },

  // ── Number ──────────────────────────────────────────────
  {
    type: "to_number",
    label: "To Number",
    category: "number",
    description: "Convert to numeric value",
    hasConfig: false,
  },
  {
    type: "round",
    label: "Round",
    category: "number",
    description: "Round to nearest integer",
    hasConfig: true,
  },
  {
    type: "ceil",
    label: "Ceil",
    category: "number",
    description: "Round up to nearest integer",
    hasConfig: false,
  },
  {
    type: "floor",
    label: "Floor",
    category: "number",
    description: "Round down to nearest integer",
    hasConfig: false,
  },
  {
    type: "abs",
    label: "Absolute",
    category: "number",
    description: "Get absolute value",
    hasConfig: false,
  },
  {
    type: "mod",
    label: "Modulo",
    category: "number",
    description: "Remainder after division",
    hasConfig: true,
  },
  { type: "add", label: "Add", category: "number", description: "Add a number", hasConfig: true },
  {
    type: "subtract",
    label: "Subtract",
    category: "number",
    description: "Subtract a number",
    hasConfig: true,
  },
  {
    type: "multiply",
    label: "Multiply",
    category: "number",
    description: "Multiply by a number",
    hasConfig: true,
  },
  {
    type: "divide",
    label: "Divide",
    category: "number",
    description: "Divide by a number",
    hasConfig: true,
  },
  {
    type: "clamp",
    label: "Clamp",
    category: "number",
    description: "Constrain value between min and max",
    hasConfig: true,
  },
  {
    type: "format_number",
    label: "Format Number",
    category: "number",
    description: "Format with decimal places and locale",
    hasConfig: true,
  },

  // ── Date ────────────────────────────────────────────────
  {
    type: "to_date",
    label: "To Date",
    category: "date",
    description: "Parse string to date",
    hasConfig: true,
  },
  {
    type: "format_date",
    label: "Format Date",
    category: "date",
    description: "Format date to string",
    hasConfig: true,
  },
  {
    type: "parse_date",
    label: "Parse Date",
    category: "date",
    description: "Parse date with specific format",
    hasConfig: true,
  },
  {
    type: "add_days",
    label: "Add Days",
    category: "date",
    description: "Add days to a date",
    hasConfig: true,
  },
  {
    type: "add_hours",
    label: "Add Hours",
    category: "date",
    description: "Add hours to a date",
    hasConfig: true,
  },
  {
    type: "subtract_days",
    label: "Subtract Days",
    category: "date",
    description: "Subtract days from a date",
    hasConfig: true,
  },
  {
    type: "date_diff",
    label: "Date Diff",
    category: "date",
    description: "Difference between two dates in days",
    hasConfig: false,
  },
  {
    type: "now",
    label: "Now",
    category: "date",
    description: "Current date/time (ignores input)",
    hasConfig: false,
  },
  {
    type: "extract_year",
    label: "Extract Year",
    category: "date",
    description: "Get year from date",
    hasConfig: false,
  },
  {
    type: "extract_month",
    label: "Extract Month",
    category: "date",
    description: "Get month from date",
    hasConfig: false,
  },
  {
    type: "extract_day",
    label: "Extract Day",
    category: "date",
    description: "Get day from date",
    hasConfig: false,
  },

  // ── Conversion ──────────────────────────────────────────
  {
    type: "to_string",
    label: "To String",
    category: "conversion",
    description: "Convert value to string",
    hasConfig: false,
  },
  {
    type: "to_boolean",
    label: "To Boolean",
    category: "conversion",
    description: "Convert to true/false",
    hasConfig: false,
  },
  {
    type: "to_array",
    label: "To Array",
    category: "conversion",
    description: "Wrap value in an array",
    hasConfig: false,
  },
  {
    type: "parse_json",
    label: "Parse JSON",
    category: "conversion",
    description: "Parse JSON string to object",
    hasConfig: false,
  },
  {
    type: "to_json",
    label: "To JSON",
    category: "conversion",
    description: "Serialize value to JSON string",
    hasConfig: false,
  },
  {
    type: "coalesce",
    label: "Coalesce",
    category: "conversion",
    description: "First non-null value (use with multi-source)",
    hasConfig: false,
  },
  {
    type: "default_value",
    label: "Default Value",
    category: "conversion",
    description: "Use fallback if null/empty",
    hasConfig: true,
  },
  {
    type: "is_null",
    label: "Is Null",
    category: "conversion",
    description: "Check if value is null",
    hasConfig: false,
  },
  {
    type: "is_empty",
    label: "Is Empty",
    category: "conversion",
    description: "Check if value is empty",
    hasConfig: false,
  },
  {
    type: "typeof",
    label: "Typeof",
    category: "conversion",
    description: "Get the type of the value",
    hasConfig: false,
  },

  // ── Merge ─────────────────────────────────────────────
  {
    type: "merge_field",
    label: "Merge Field",
    category: "merge",
    description: "Merge another source field into the pipeline (concat, template, fallback)",
    hasConfig: true,
  },
];

const _descriptorMap = new Map<string, OperationDescriptor>();
for (const d of OPERATION_DESCRIPTORS) {
  _descriptorMap.set(d.type, d);
}

export function getDescriptor(type: MappingOperationType): OperationDescriptor | undefined {
  return _descriptorMap.get(type);
}

export function getOperationsByCategory(category: OperationCategory): OperationDescriptor[] {
  return OPERATION_DESCRIPTORS.filter((d) => d.category === category);
}

export function getConfigSummary(
  type: MappingOperationType,
  config: Record<string, unknown>,
): string {
  switch (type) {
    case "substring":
      return `[${config.start ?? 0}..${config.end ?? ""}]`;
    case "replace":
      return `"${config.find ?? ""}" → "${config.replaceWith ?? ""}"`;
    case "regex_replace":
    case "regex_extract":
      return `/${config.regex ?? ""}/`;
    case "pad_start":
    case "pad_end":
      return `"${config.padChar ?? " "}" × ${config.padLength ?? 0}`;
    case "truncate":
      return `max ${config.maxLength ?? 0}`;
    case "split":
    case "join":
      return `"${config.separator ?? ","}"`;
    case "template":
      return config.templateString ? String(config.templateString).slice(0, 20) : "";
    case "nth":
    case "slice":
      return `[${config.index ?? config.start ?? 0}]`;
    case "chunk":
      return `size ${config.chunkSize ?? 1}`;
    case "filter":
      return config.condition ? String(config.condition).slice(0, 20) : "";
    case "pluck":
    case "map_each":
      return config.field ? String(config.field) : "";
    case "add":
    case "subtract":
    case "multiply":
    case "divide":
    case "mod":
      return `${config.operand ?? 0}`;
    case "round":
      return config.decimalPlaces != null ? `${config.decimalPlaces}dp` : "";
    case "clamp":
      return `${config.minValue ?? ""}..${config.maxValue ?? ""}`;
    case "format_number":
      return `${config.decimalPlaces ?? 2}dp`;
    case "to_date":
    case "format_date":
    case "parse_date":
      return config.dateFormat ? String(config.dateFormat) : "";
    case "add_days":
    case "subtract_days":
      return `${config.days ?? 0}d`;
    case "add_hours":
      return `${config.hours ?? 0}h`;
    case "default_value":
      return config.defaultValue ? String(config.defaultValue).slice(0, 15) : "";
    case "push":
      return config.defaultValue ? String(config.defaultValue).slice(0, 10) : "";
    case "merge_field": {
      const path = config.mergeFieldPath ? String(config.mergeFieldPath) : "";
      const mode = config.mergeCombineMode ? String(config.mergeCombineMode) : "concat";
      const leaf = path.split(".").pop() ?? path;
      return leaf ? `+ ${leaf} (${mode})` : mode;
    }
    default:
      return "";
  }
}
