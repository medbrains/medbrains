import type { MappingFieldType, TransformStep } from "@medbrains/types";

/**
 * Resolve a dot-path against a data object.
 * e.g. resolveValue({ patient: { name: "John" } }, "patient.name") → "John"
 */
function resolveValue(data: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = data;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Infer the MappingFieldType from a runtime JS value.
 */
export function inferTypeFromValue(value: unknown): MappingFieldType {
  if (value === null) return "null";
  if (value === undefined) return "unknown";
  if (Array.isArray(value)) return "array";
  if (value instanceof Date) return "date";
  if (typeof value === "string") {
    // Check if it looks like an ISO date string
    if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?/.test(value)) return "date";
    return "string";
  }
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "object") return "object";
  return "unknown";
}

/**
 * Infer the type of a field path from sample data.
 */
export function inferFieldType(
  sampleData: Record<string, unknown>,
  fieldPath: string,
): MappingFieldType {
  const value = resolveValue(sampleData, fieldPath);
  return inferTypeFromValue(value);
}

/** Short display labels for types */
export const TYPE_LABELS: Record<MappingFieldType, string> = {
  string: "str",
  number: "num",
  boolean: "bool",
  array: "arr",
  object: "obj",
  date: "date",
  null: "null",
  unknown: "?",
};

/** Colors for type badges */
export const TYPE_COLORS: Record<MappingFieldType, string> = {
  string: "blue",
  number: "orange",
  boolean: "teal",
  array: "violet",
  object: "cyan",
  date: "grape",
  null: "gray",
  unknown: "gray",
};

/**
 * Infer MappingFieldType from a field name/path using common naming conventions.
 * Used for destination fields where we don't have sample data.
 */
export function inferTypeFromFieldName(path: string): MappingFieldType {
  const leaf = (path.split(".").pop() ?? "").toLowerCase();
  if (!leaf) return "unknown";

  // Boolean patterns
  if (/^(is_|has_|can_|should_|enable|active|visible|disabled|verified|approved)/.test(leaf))
    return "boolean";
  if (/(flag|_active|_enabled|_visible|_verified|_approved|_blocked)$/.test(leaf)) return "boolean";

  // Date patterns
  if (
    /(date|_at|_time|_on|timestamp|created|updated|deleted|expired|scheduled|dob|birth)/.test(leaf)
  )
    return "date";

  // Number patterns
  if (
    /(count|amount|qty|quantity|total|price|cost|rate|age|weight|height|dose|_id|number|balance|score|rank|index|size|duration|length|percentage|percent|ratio)$/.test(
      leaf,
    )
  )
    return "number";

  // Array patterns
  if (
    /(list|tags|items|array|entries|records|results|children|members|roles|permissions|codes|values|options|categories|groups|attachments|medications|diagnoses|allergies|symptoms)$/.test(
      leaf,
    )
  )
    return "array";

  // Object patterns
  if (
    /(data|config|meta|metadata|settings|options_obj|payload|body|address|contact|details|info|profile|preferences)$/.test(
      leaf,
    )
  )
    return "object";

  // Default to string for names, descriptions, labels, codes, etc.
  return "string";
}

/**
 * Given a source type and a destination type, return a conversion TransformStep
 * that bridges the mismatch, or null if no conversion needed/possible.
 */
export function getAutoConversionStep(
  sourceType: MappingFieldType,
  destType: MappingFieldType,
): TransformStep | null {
  if (sourceType === destType) return null;
  if (sourceType === "unknown" || destType === "unknown") return null;
  if (sourceType === "null") return null;

  const id = `auto_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  // string → array: wrap in array
  if (sourceType === "string" && destType === "array") {
    return { id, operation: "to_array" as TransformStep["operation"], config: {} };
  }
  // array → string: join
  if (sourceType === "array" && destType === "string") {
    return { id, operation: "join" as TransformStep["operation"], config: { separator: ", " } };
  }
  // string → number
  if (sourceType === "string" && destType === "number") {
    return { id, operation: "to_number" as TransformStep["operation"], config: {} };
  }
  // number → string
  if (sourceType === "number" && destType === "string") {
    return { id, operation: "to_string" as TransformStep["operation"], config: {} };
  }
  // string → date
  if (sourceType === "string" && destType === "date") {
    return { id, operation: "to_date" as TransformStep["operation"], config: {} };
  }
  // date → string
  if (sourceType === "date" && destType === "string") {
    return { id, operation: "format_date" as TransformStep["operation"], config: {} };
  }
  // * → boolean
  if (destType === "boolean") {
    return { id, operation: "to_boolean" as TransformStep["operation"], config: {} };
  }
  // * → string
  if (destType === "string") {
    return { id, operation: "to_string" as TransformStep["operation"], config: {} };
  }
  // * → array
  if (destType === "array") {
    return { id, operation: "to_array" as TransformStep["operation"], config: {} };
  }

  return null;
}
