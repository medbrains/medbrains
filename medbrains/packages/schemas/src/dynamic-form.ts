import type {
  FieldCondition,
  FieldDataType,
  FieldValidation,
  ResolvedField,
  ResolvedFormDefinition,
} from "@medbrains/types";
import { z } from "zod";

/**
 * Build a Zod schema dynamically from a ResolvedFormDefinition.
 * Maps each visible field's data_type + validation + requirement_level
 * to the appropriate Zod type.
 */
export function buildFormSchema(
  definition: ResolvedFormDefinition,
  options?: {
    /** Only include quick-mode fields */
    quickMode?: boolean;
    /** Current form values for condition evaluation */
    formValues?: Record<string, unknown>;
    /** Tenant context for _tenant.* condition paths */
    tenantContext?: Record<string, unknown>;
  },
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const section of definition.sections) {
    for (const field of section.fields) {
      if (field.is_hidden) continue;
      if (field.access_level === "hidden") continue;
      if (options?.quickMode && !field.is_quick_mode) continue;

      // Check condition — if condition exists and evaluates to false, make field optional
      let conditionMet = true;
      if (field.condition && options?.formValues) {
        conditionMet = evaluateCondition(
          field.condition,
          options.formValues,
          options.tenantContext,
        );
      }

      // View-only fields need no validation — accept any value
      if (field.access_level === "view") {
        shape[field.field_code] = z.any().optional();
        continue;
      }

      const fieldSchema = buildFieldSchema(field, conditionMet);
      shape[field.field_code] = fieldSchema;
    }
  }

  return z.object(shape);
}

/**
 * Build a Zod schema for a single field based on its data_type,
 * validation rules, and requirement level.
 */
function buildFieldSchema(field: ResolvedField, conditionMet: boolean): z.ZodTypeAny {
  const isMandatory =
    field.requirement_level === "mandatory" ||
    (field.requirement_level === "conditional" && conditionMet);

  let schema = buildBaseSchema(field.data_type, field.validation);

  // Apply validation rules
  schema = applyValidation(schema, field.data_type, field.validation);

  // Apply requirement
  if (!isMandatory) {
    // For non-mandatory fields, allow empty string or undefined
    return schema.optional().or(z.literal(""));
  }

  return schema;
}

/**
 * Build the base Zod type from a field_data_type.
 */
function buildBaseSchema(
  dataType: FieldDataType,
  validation: FieldValidation | null,
): z.ZodTypeAny {
  switch (dataType) {
    case "text":
    case "email":
    case "phone":
    case "textarea":
    case "hidden":
    case "computed":
      return z.string();

    case "number":
      return z.coerce.number().int();

    case "decimal":
      return z.coerce.number();

    case "date":
    case "datetime":
    case "time":
      return z.string(); // ISO 8601 string

    case "boolean":
    case "checkbox":
      return z.boolean();

    case "select":
    case "radio":
      if (validation?.options && validation.options.length > 0) {
        const opts = validation.options as [string, ...string[]];
        return z.enum(opts);
      }
      return z.string();

    case "multiselect":
      if (validation?.options && validation.options.length > 0) {
        const opts = validation.options as [string, ...string[]];
        return z.array(z.enum(opts));
      }
      return z.array(z.string());

    case "file":
      return z.any(); // File objects handled by form component

    case "uuid_fk":
      return z.string().uuid();

    case "json":
      return z.record(z.string(), z.unknown());

    default:
      return z.string();
  }
}

/**
 * Apply validation rules (min_length, max_length, regex, min, max)
 * to a base schema.
 */
function applyValidation(
  schema: z.ZodTypeAny,
  dataType: FieldDataType,
  validation: FieldValidation | null,
): z.ZodTypeAny {
  if (!validation) return schema;

  // String validations
  if (schema instanceof z.ZodString) {
    let s = schema;
    if (validation.min_length !== undefined) {
      s = s.min(validation.min_length);
    }
    if (validation.max_length !== undefined) {
      s = s.max(validation.max_length);
    }
    if (validation.regex) {
      try {
        s = s.regex(new RegExp(validation.regex));
      } catch {
        // Invalid regex — skip
      }
    }
    if (dataType === "email") {
      s = s.email();
    }
    return s;
  }

  // Number validations
  if (schema instanceof z.ZodNumber) {
    let n = schema;
    if (validation.min !== undefined) {
      n = n.min(validation.min);
    }
    if (validation.max !== undefined) {
      n = n.max(validation.max);
    }
    return n;
  }

  return schema;
}

/**
 * Evaluate a field condition against current form values.
 * Supports operators: eq, neq, in, not_in, contains, is_empty, is_not_empty, gt, lt, gte, lte.
 * Supports composite conditions: all (AND), any (OR).
 * Special _tenant.* paths read from tenant context.
 */
export function evaluateCondition(
  condition: FieldCondition,
  formValues: Record<string, unknown>,
  tenantContext?: Record<string, unknown>,
): boolean {
  // Composite conditions
  if (condition.all) {
    return condition.all.every((c) => evaluateCondition(c, formValues, tenantContext));
  }
  if (condition.any) {
    return condition.any.some((c) => evaluateCondition(c, formValues, tenantContext));
  }

  // Resolve field value
  const fieldPath = condition.field;
  let fieldValue: unknown;

  if (fieldPath.startsWith("_tenant.")) {
    const key = fieldPath.slice("_tenant.".length);
    fieldValue = tenantContext?.[key];
  } else {
    fieldValue = formValues[fieldPath];
  }

  // Evaluate operator
  switch (condition.operator) {
    case "eq":
      return fieldValue === condition.value;

    case "neq":
      return fieldValue !== condition.value;

    case "in":
      if (Array.isArray(condition.values)) {
        return condition.values.includes(fieldValue);
      }
      return false;

    case "not_in":
      if (Array.isArray(condition.values)) {
        return !condition.values.includes(fieldValue);
      }
      return true;

    case "contains":
      if (typeof fieldValue === "string" && typeof condition.value === "string") {
        return fieldValue.includes(condition.value);
      }
      if (Array.isArray(fieldValue)) {
        return fieldValue.includes(condition.value);
      }
      return false;

    case "is_empty":
      return (
        fieldValue === null ||
        fieldValue === undefined ||
        fieldValue === "" ||
        (Array.isArray(fieldValue) && fieldValue.length === 0)
      );

    case "is_not_empty":
      return (
        fieldValue !== null &&
        fieldValue !== undefined &&
        fieldValue !== "" &&
        !(Array.isArray(fieldValue) && fieldValue.length === 0)
      );

    case "gt":
      return typeof fieldValue === "number" && typeof condition.value === "number"
        ? fieldValue > condition.value
        : false;

    case "lt":
      return typeof fieldValue === "number" && typeof condition.value === "number"
        ? fieldValue < condition.value
        : false;

    case "gte":
      return typeof fieldValue === "number" && typeof condition.value === "number"
        ? fieldValue >= condition.value
        : false;

    case "lte":
      return typeof fieldValue === "number" && typeof condition.value === "number"
        ? fieldValue <= condition.value
        : false;

    default:
      return false;
  }
}
