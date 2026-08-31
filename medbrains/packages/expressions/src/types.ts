/**
 * MedBrains Expression Language (MBX) — Type Definitions
 *
 * Three expression tiers:
 *   Tier 1: mbx:template — Print templates & display text (Handlebars)
 *   Tier 2: mbx:expr     — Computed fields & formulas (expr-eval)
 *   Tier 3: mbx:logic    — Conditions, visibility rules (JSON Logic)
 *
 * Security: All tiers share a sandboxed evaluator core.
 * No eval(), no Function constructor, no prototype access.
 */

// ── Sandbox Types ────────────────────────────────────────

/** Keys that are blocked from context access */
export const BLOCKED_KEYS = new Set([
  "__proto__",
  "constructor",
  "prototype",
  "window",
  "document",
  "global",
  "globalThis",
  "process",
  "require",
  "import",
  "eval",
  "Function",
  "setTimeout",
  "setInterval",
  "setImmediate",
  "XMLHttpRequest",
  "fetch",
  "WebSocket",
  "Worker",
  "SharedWorker",
  "ServiceWorker",
  "importScripts",
  "Proxy",
  "Reflect",
]);

/** Maximum AST nodes per expression to prevent DoS */
export const MAX_AST_NODES = 100;

/** Maximum property access depth */
export const MAX_DEPTH = 5;

/** Maximum evaluation time in milliseconds */
export const MAX_EVAL_MS = 50;

// ── Function Registry Types ──────────────────────────────

/** A whitelisted pure function that can be called from expressions */
export type SafeFunction = (...args: unknown[]) => unknown;

/** Function category for documentation/UI grouping */
export type FunctionCategory = "math" | "string" | "date" | "logic" | "medical" | "format";

/** Metadata about a registered function */
export interface FunctionMeta {
  name: string;
  category: FunctionCategory;
  description: string;
  params: FunctionParam[];
  returnType: string;
  fn: SafeFunction;
}

/** Function parameter definition */
export interface FunctionParam {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

// ── Evaluation Types ─────────────────────────────────────

/** Result of expression validation */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  nodeCount?: number;
}

/** Result of expression evaluation */
export interface EvaluationResult<T = unknown> {
  success: boolean;
  value?: T;
  error?: string;
}

/** Context data passed to expression evaluators */
export type ExpressionContext = Readonly<Record<string, unknown>>;

// ── Template Types (Tier 1) ──────────────────────────────

/** Options for template compilation and rendering */
export interface TemplateOptions {
  /** Allow triple-bracket {{{raw}}} output (system templates only) */
  allowRawOutput?: boolean;
  /** Additional Handlebars helpers */
  extraHelpers?: Record<string, SafeFunction>;
}

/** A compiled template ready for rendering */
export interface CompiledTemplate {
  render: (context: ExpressionContext) => EvaluationResult<string>;
}

// ── Computed Types (Tier 2) ──────────────────────────────

/** Options for computed field evaluation */
export interface ComputedOptions {
  /** Additional functions beyond the registry */
  extraFunctions?: Record<string, SafeFunction>;
}

// ── Logic Types (Tier 3) ─────────────────────────────────

/**
 * JSON Logic rule — a plain JSON object that represents a logical expression.
 * Cannot execute code, access prototypes, or cause side effects.
 *
 * Examples:
 *   { "===": [{ "var": "patient.category" }, "insurance"] }
 *   { "and": [{ ">": [{ "var": "age" }, 18] }, { "!==": [{ "var": "id" }, null] }] }
 */
export type JsonLogicRule = Record<string, unknown> | boolean | null;

/** Data object for JSON Logic evaluation */
export type JsonLogicData = Record<string, unknown>;

// ── Expression Tier Identifiers ──────────────────────────

/** The three expression tier identifiers */
export type ExpressionTier = "mbx:template" | "mbx:expr" | "mbx:logic";

// ── Error Types ──────────────────────────────────────────

/** Custom error for expression-related failures */
export class MbxError extends Error {
  public readonly code: MbxErrorCode;

  constructor(code: MbxErrorCode, message: string) {
    super(message);
    this.name = "MbxError";
    this.code = code;
  }
}

export type MbxErrorCode =
  | "EXPRESSION_TOO_COMPLEX"
  | "EVALUATION_TIMEOUT"
  | "INVALID_EXPRESSION"
  | "ASSIGNMENT_NOT_ALLOWED"
  | "BLOCKED_ACCESS"
  | "UNKNOWN_FUNCTION"
  | "TEMPLATE_COMPILE_ERROR"
  | "TEMPLATE_RENDER_ERROR"
  | "INVALID_ARGUMENT";
