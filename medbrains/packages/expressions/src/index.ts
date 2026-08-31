/**
 * MedBrains Expression Language (MBX)
 *
 * A sandboxed expression engine with three tiers:
 *   Tier 1: mbx:template — Print templates & display text (Handlebars)
 *   Tier 2: mbx:expr     — Computed fields & formulas (expr-eval)
 *   Tier 3: mbx:logic    — Conditions, visibility rules (JSON Logic)
 *
 * Security guarantees:
 *   - No eval(), no Function constructor
 *   - Whitelisted functions only
 *   - Frozen, proxy-wrapped contexts
 *   - AST size limits (max 100 nodes)
 *   - No prototype access, no global access
 *   - HTML-escaping by default in templates
 *   - Read-only data, no side effects
 */

// Tier 2: Computed Fields
export { evaluateComputed, extractVariables, validateComputed } from "./computed.js";
// Function registry
export {
  FUNCTION_REGISTRY,
  getFunctionMap,
  getFunctionsByCategory,
  isFunctionRegistered,
} from "./functions.js";

// Tier 3: Logic / Conditions
export {
  evaluateFieldCondition,
  evaluateLogic,
  fieldConditionToJsonLogic,
  validateLogic,
} from "./logic.js";

// Sandbox utilities
export {
  createSandboxedContext,
  resolveContextPath,
  validateExpressionString,
  validateJsonLogicRule,
  validateTemplateString,
} from "./sandbox.js";
// Tier 1: Templates
export { compileTemplate, renderTemplate, validateTemplate } from "./template.js";

// Types
export type {
  CompiledTemplate,
  ComputedOptions,
  EvaluationResult,
  ExpressionContext,
  ExpressionTier,
  FunctionCategory,
  FunctionMeta,
  FunctionParam,
  JsonLogicData,
  JsonLogicRule,
  MbxErrorCode,
  SafeFunction,
  TemplateOptions,
  ValidationResult,
} from "./types.js";

export { BLOCKED_KEYS, MAX_AST_NODES, MAX_DEPTH, MAX_EVAL_MS, MbxError } from "./types.js";
