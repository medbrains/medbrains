/**
 * MBX Tier 2: Computed Field Evaluator (mbx:expr)
 *
 * Uses expr-eval-fork for parsing and evaluating math/string expressions.
 * Excel-inspired formula syntax: BMI(weight_kg, height_cm)
 *
 * Security:
 * - expr-eval-fork does NOT use eval() or new Function()
 * - All functions are whitelisted via the function registry
 * - AST is validated before evaluation (node count, assignment detection)
 * - Context is sandboxed (frozen, proxy-wrapped)
 * - No access to window, document, global, process, etc.
 */

import { Parser, type Value } from "expr-eval-fork";
import { getFunctionMap } from "./functions.js";
import { createSandboxedContext, validateExpressionString } from "./sandbox.js";
import type {
  ComputedOptions,
  EvaluationResult,
  ExpressionContext,
  SafeFunction,
  ValidationResult,
} from "./types.js";

/**
 * Create a configured expr-eval-fork Parser instance with all
 * whitelisted functions pre-registered.
 */
function createParser(): Parser {
  const parser = new Parser({
    operators: {
      // Enable safe operators
      add: true,
      concatenate: true,
      conditional: true,
      divide: true,
      factorial: false, // Not needed, potential DoS
      multiply: true,
      power: true,
      remainder: true,
      subtract: true,
      // Comparison
      logical: true,
      comparison: true,
      // Disabled — unsafe
      assignment: false, // CRITICAL: No assignments
      in: true,
    },
  });

  return parser;
}

/**
 * Build the variables/functions object for expr-eval evaluation.
 * Merges context data with whitelisted functions.
 */
function buildEvalContext(
  context: ExpressionContext,
  extraFunctions?: Record<string, SafeFunction>,
): Record<string, unknown> {
  const functions = getFunctionMap();
  const sandboxed = createSandboxedContext(context as Record<string, unknown>);

  // Flatten the proxy for expr-eval compatibility
  const flat: Record<string, unknown> = {};
  for (const key of Object.keys(sandboxed)) {
    flat[key] = flattenForExprEval(sandboxed[key]);
  }

  // Merge functions (functions take precedence over variables with same name)
  return {
    ...flat,
    ...functions,
    ...(extraFunctions ?? {}),
  };
}

/**
 * Flatten nested proxy objects for expr-eval.
 * expr-eval resolves dotted paths (e.g., patient.name) internally,
 * but it needs plain objects to do so.
 */
function flattenForExprEval(val: unknown, depth = 0): unknown {
  if (depth > 5) return undefined;
  if (val === null || val === undefined) return val;
  if (typeof val !== "object") return val;
  if (val instanceof Date) return val;
  if (Array.isArray(val)) {
    return val.map((item) => flattenForExprEval(item, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const key of Object.keys(val as Record<string, unknown>)) {
    result[key] = flattenForExprEval((val as Record<string, unknown>)[key], depth + 1);
  }
  return result;
}

/**
 * Evaluate a computed expression against a context.
 *
 * @param expression - Expression string, e.g. "BMI(weight_kg, height_cm)"
 * @param context - Data context with field values
 * @param options - Optional extra functions
 * @returns EvaluationResult with the computed value
 *
 * @example
 * ```ts
 * evaluateComputed("BMI(weight_kg, height_cm)", {
 *   weight_kg: 70,
 *   height_cm: 175,
 * });
 * // => { success: true, value: 22.857... }
 * ```
 */
export function evaluateComputed(
  expression: string,
  context: ExpressionContext,
  options?: ComputedOptions,
): EvaluationResult {
  // Validate expression string
  const validation = validateExpressionString(expression);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  try {
    const parser = createParser();
    const parsed = parser.parse(expression);

    // Build context with functions
    const evalContext = buildEvalContext(context, options?.extraFunctions);

    // Evaluate — cast to Value for expr-eval's type system
    // Our context contains numbers, strings, and nested objects which align with Value
    const result = parsed.evaluate(evalContext as unknown as Value);

    return { success: true, value: result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Expression evaluation failed";
    return { success: false, error: message };
  }
}

/**
 * Validate a computed expression without evaluating it.
 * Checks syntax, blocked access, and complexity limits.
 */
export function validateComputed(expression: string): ValidationResult {
  // String-level validation
  const stringValidation = validateExpressionString(expression);
  if (!stringValidation.valid) {
    return stringValidation;
  }

  // Try to parse — catches syntax errors
  try {
    const parser = createParser();
    parser.parse(expression);
    return { valid: true, nodeCount: stringValidation.nodeCount };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid expression syntax";
    return { valid: false, error: message };
  }
}

/**
 * Extract variable names referenced in a computed expression.
 * Used by the form builder UI to show which fields a formula depends on.
 */
export function extractVariables(expression: string): string[] {
  try {
    const parser = createParser();
    const parsed = parser.parse(expression);
    // expr-eval's variables() method returns referenced variable names
    return parsed.variables({ withMembers: true });
  } catch {
    return [];
  }
}
