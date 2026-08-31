/**
 * MBX Tier 3: Logic Evaluator (mbx:logic)
 *
 * Uses JSON Logic for condition evaluation — inherently injection-proof
 * because it's pure data (JSON), not code.
 *
 * JSON Logic supports: ==, ===, !=, !==, >, >=, <, <=,
 * and, or, !, !!, var, if, in, cat, log, max, min, +, -, *, /, %,
 * map, filter, reduce, all, some, none, merge, missing, missing_some
 *
 * Also provides backward compatibility with the existing FieldCondition
 * format used in the current form system.
 *
 * Security: JSON Logic is provably safe — it only does comparisons,
 * boolean logic, and variable lookups on a flat data object.
 * No function calls, no string interpolation, no code execution.
 */

// We also need the existing FieldCondition type for backward compat
import type { FieldCondition } from "@medbrains/types";
import jsonLogic, { type RulesLogic } from "json-logic-js";
import { createSandboxedContext, validateJsonLogicRule } from "./sandbox.js";
import type {
  EvaluationResult,
  ExpressionContext,
  JsonLogicData,
  JsonLogicRule,
  ValidationResult,
} from "./types.js";

/**
 * Evaluate a JSON Logic rule against a data context.
 *
 * @param rule - JSON Logic rule object
 * @param data - Data context for variable resolution
 * @returns EvaluationResult<boolean> — the rule's truth value
 *
 * @example
 * ```ts
 * evaluateLogic(
 *   { "===": [{ "var": "patient.category" }, "insurance"] },
 *   { patient: { category: "insurance" } }
 * );
 * // => { success: true, value: true }
 * ```
 */
export function evaluateLogic(
  rule: JsonLogicRule,
  data: ExpressionContext,
): EvaluationResult<boolean> {
  // Null/boolean rules are trivially valid
  if (rule === null) return { success: true, value: false };
  if (typeof rule === "boolean") return { success: true, value: rule };

  // Validate rule complexity
  const validation = validateJsonLogicRule(rule);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  try {
    const sandboxed = createSandboxedContext(data as Record<string, unknown>);
    // Flatten proxy for json-logic-js compatibility
    const flatData = flattenForJsonLogic(sandboxed);
    const result = jsonLogic.apply(rule as RulesLogic, flatData);
    return { success: true, value: Boolean(result) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Logic evaluation failed";
    return { success: false, error: message };
  }
}

/**
 * Validate a JSON Logic rule without evaluating it.
 */
export function validateLogic(rule: unknown): ValidationResult {
  if (rule === null || typeof rule === "boolean") {
    return { valid: true, nodeCount: 1 };
  }
  return validateJsonLogicRule(rule);
}

// ── Backward Compatibility: FieldCondition → JSON Logic ──

/**
 * Convert a legacy FieldCondition (current form system format) to JSON Logic.
 * This bridges the existing condition system with the new MBX evaluator.
 *
 * @param condition - Legacy FieldCondition from field_masters
 * @returns JsonLogicRule equivalent
 */
export function fieldConditionToJsonLogic(condition: FieldCondition): JsonLogicRule {
  // Handle composite conditions
  if (condition.all) {
    return {
      and: condition.all.map(fieldConditionToJsonLogic),
    };
  }
  if (condition.any) {
    return {
      or: condition.any.map(fieldConditionToJsonLogic),
    };
  }

  // Convert single condition to JSON Logic
  const varRef = { var: condition.field };

  switch (condition.operator) {
    case "eq":
      return { "===": [varRef, condition.value] };
    case "neq":
      return { "!==": [varRef, condition.value] };
    case "gt":
      return { ">": [varRef, condition.value] };
    case "lt":
      return { "<": [varRef, condition.value] };
    case "gte":
      return { ">=": [varRef, condition.value] };
    case "lte":
      return { "<=": [varRef, condition.value] };
    case "in":
      return { in: [varRef, condition.values ?? []] };
    case "not_in":
      return { "!": { in: [varRef, condition.values ?? []] } };
    case "contains":
      return { in: [condition.value, varRef] };
    case "is_empty":
      return {
        or: [{ "===": [varRef, null] }, { "===": [varRef, ""] }],
      };
    case "is_not_empty":
      return {
        and: [{ "!==": [varRef, null] }, { "!==": [varRef, ""] }],
      };
    default:
      return true; // Unknown operator — always true (safe default)
  }
}

/**
 * Evaluate a legacy FieldCondition using the JSON Logic evaluator.
 * This replaces the manual evaluateCondition function in @medbrains/schemas.
 *
 * @param condition - Legacy FieldCondition
 * @param formValues - Current form values
 * @param tenantContext - Optional tenant context for _tenant.* paths
 * @returns boolean — whether the condition is met
 */
export function evaluateFieldCondition(
  condition: FieldCondition,
  formValues: Record<string, unknown>,
  tenantContext?: Record<string, unknown>,
): boolean {
  // Merge tenant context into data under _tenant prefix
  const data: Record<string, unknown> = { ...formValues };
  if (tenantContext) {
    data._tenant = tenantContext;
  }

  // Convert to JSON Logic and evaluate
  const rule = fieldConditionToJsonLogic(condition);
  const result = evaluateLogic(rule, data);

  // On error, default to true (show the field — safe fallback)
  return result.success ? (result.value ?? true) : true;
}

/**
 * Flatten proxy-wrapped context to plain objects for json-logic-js.
 */
function flattenForJsonLogic(obj: unknown, depth = 0): JsonLogicData {
  if (depth > 5) return {};
  if (obj === null || obj === undefined) return {};
  if (typeof obj !== "object") return {};
  if (Array.isArray(obj)) return {};

  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    const val = (obj as Record<string, unknown>)[key];
    if (typeof val === "object" && val !== null && !Array.isArray(val) && !(val instanceof Date)) {
      result[key] = flattenForJsonLogic(val, depth + 1);
    } else {
      result[key] = val;
    }
  }
  return result;
}
