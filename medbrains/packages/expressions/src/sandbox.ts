/**
 * MBX Sandbox — Security Core
 *
 * Creates frozen, proxy-wrapped contexts that prevent:
 * 1. Prototype pollution (__proto__, constructor access)
 * 2. Global scope access (window, document, process)
 * 3. Mutation of context data
 * 4. Property enumeration attacks
 * 5. Deep property chain attacks (max 5 levels)
 *
 * Also validates expression ASTs for:
 * - Node count limits (max 100) to prevent DoS
 * - Assignment operator detection
 * - Dangerous property access
 */

import {
  BLOCKED_KEYS,
  type ExpressionContext,
  MAX_AST_NODES,
  MAX_DEPTH,
  type ValidationResult,
} from "./types.js";

/**
 * Creates a sandboxed context from raw data.
 * The returned object is deeply frozen and wrapped in a Proxy
 * that blocks dangerous property access.
 */
export function createSandboxedContext(data: Record<string, unknown>): ExpressionContext {
  // Deep copy to sever all shared references
  const cloned = safeDeepClone(data);
  return wrapWithProxy(cloned);
}

/**
 * Deep clone that strips dangerous keys during cloning.
 * Uses structured cloning logic but filters blocked properties.
 */
function safeDeepClone(obj: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return undefined;

  if (obj === null || obj === undefined) return obj;

  if (typeof obj === "number" || typeof obj === "string" || typeof obj === "boolean") {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => safeDeepClone(item, depth + 1));
  }

  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(obj as Record<string, unknown>)) {
      if (BLOCKED_KEYS.has(key)) continue;
      result[key] = safeDeepClone((obj as Record<string, unknown>)[key], depth + 1);
    }
    return result;
  }

  // Functions, Symbols, etc. are stripped
  return undefined;
}

/**
 * Wraps a cloned object in a Proxy that enforces:
 * - Read-only access (set/delete blocked)
 * - Blocked key filtering
 * - No prototype chain leakage
 */
function wrapWithProxy(obj: unknown): ExpressionContext {
  if (typeof obj !== "object" || obj === null) {
    return {} as ExpressionContext;
  }

  const target = obj as Record<string, unknown>;

  return new Proxy(target, {
    get(t, key: string | symbol): unknown {
      if (typeof key === "symbol") return undefined;
      if (BLOCKED_KEYS.has(key)) return undefined;
      const val = t[key];
      // Recursively proxy nested objects for deep protection
      if (
        typeof val === "object" &&
        val !== null &&
        !Array.isArray(val) &&
        !(val instanceof Date)
      ) {
        return wrapWithProxy(val);
      }
      return val;
    },
    set() {
      return false;
    },
    deleteProperty() {
      return false;
    },
    has(t, key: string | symbol): boolean {
      if (typeof key === "symbol") return false;
      if (BLOCKED_KEYS.has(key)) return false;
      return key in t;
    },
    ownKeys(t) {
      return Object.keys(t).filter((k) => !BLOCKED_KEYS.has(k));
    },
    getOwnPropertyDescriptor(t, key: string | symbol) {
      if (typeof key === "symbol") return undefined;
      if (BLOCKED_KEYS.has(key)) return undefined;
      const desc = Object.getOwnPropertyDescriptor(t, key);
      if (desc) {
        // Read-only is safe to report. Non-configurable is not: a proxy may
        // not describe a property as non-configurable when it is configurable
        // on the target, and the engine throws rather than tolerating it —
        // which broke every Object.keys() walk over a sandboxed context.
        // Writes are already refused by the set and deleteProperty traps.
        desc.writable = false;
        desc.configurable = true;
      }
      return desc;
    },
    getPrototypeOf() {
      return null;
    },
  }) as ExpressionContext;
}

/**
 * Resolves a dotted path ("patient.name") against a sandboxed context.
 * Enforces max depth and blocked key checks at every level.
 */
export function resolveContextPath(context: ExpressionContext, path: string): unknown {
  const parts = path.split(".");
  if (parts.length > MAX_DEPTH) return undefined;

  let current: unknown = context;
  for (const part of parts) {
    if (BLOCKED_KEYS.has(part)) return undefined;
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

// ── AST Validation ───────────────────────────────────────

/**
 * Validates an expr-eval expression string for safety.
 * Checks for:
 * - Assignment operators (=, +=, -=, etc.)
 * - Blocked property access (constructor, __proto__, etc.)
 * - Expression complexity (rough node count estimate)
 */
export function validateExpressionString(expr: string): ValidationResult {
  if (!expr || typeof expr !== "string") {
    return { valid: false, error: "Expression must be a non-empty string" };
  }

  // Check for assignment operators (but not == or ===, != or !==, <=, >=)
  if (/(?<![=!<>])=(?!=)/.test(expr)) {
    return {
      valid: false,
      error: "Assignment operators are not allowed in expressions",
    };
  }

  // Check for blocked property access
  for (const blocked of BLOCKED_KEYS) {
    // Match the blocked key as a standalone word or property access
    const pattern = new RegExp(`\\b${escapeRegex(blocked)}\\b`);
    if (pattern.test(expr)) {
      return {
        valid: false,
        error: `Access to '${blocked}' is blocked`,
      };
    }
  }

  // Estimate node count from tokens (rough heuristic)
  // Count operators, function calls, identifiers, and literals
  const tokens = expr.match(/\w+|[+\-*/%^]|[<>!=]=?|&&|\|\||[(),?:]/g);
  const nodeCount = tokens?.length ?? 0;

  if (nodeCount > MAX_AST_NODES) {
    return {
      valid: false,
      error: `Expression too complex: ${nodeCount} tokens exceeds limit of ${MAX_AST_NODES}`,
      nodeCount,
    };
  }

  return { valid: true, nodeCount };
}

/**
 * Validates a Handlebars template string for safety.
 */
export function validateTemplateString(template: string): ValidationResult {
  if (!template || typeof template !== "string") {
    return { valid: false, error: "Template must be a non-empty string" };
  }

  // Count interpolation points as rough complexity measure
  const interpolations = template.match(/\{\{[^}]*\}\}/g);
  const nodeCount = interpolations?.length ?? 0;

  if (nodeCount > MAX_AST_NODES) {
    return {
      valid: false,
      error: `Template too complex: ${nodeCount} interpolations exceeds limit of ${MAX_AST_NODES}`,
      nodeCount,
    };
  }

  // Check for blocked access within interpolations
  if (interpolations) {
    for (const interp of interpolations) {
      for (const blocked of BLOCKED_KEYS) {
        if (interp.includes(blocked)) {
          return {
            valid: false,
            error: `Access to '${blocked}' is blocked in template expressions`,
          };
        }
      }
    }
  }

  return { valid: true, nodeCount };
}

/**
 * Validates a JSON Logic rule for safety.
 * JSON Logic is inherently safe (pure data), but we still
 * check for excessive nesting depth.
 */
export function validateJsonLogicRule(rule: unknown, depth = 0): ValidationResult {
  if (depth > 20) {
    return { valid: false, error: "JSON Logic rule too deeply nested (max 20 levels)" };
  }

  if (
    rule === null ||
    typeof rule === "boolean" ||
    typeof rule === "number" ||
    typeof rule === "string"
  ) {
    return { valid: true, nodeCount: 1 };
  }

  if (Array.isArray(rule)) {
    let totalNodes = 0;
    for (const item of rule) {
      const result = validateJsonLogicRule(item, depth + 1);
      if (!result.valid) return result;
      totalNodes += result.nodeCount ?? 1;
    }
    if (totalNodes > MAX_AST_NODES) {
      return {
        valid: false,
        error: `JSON Logic rule too complex: ${totalNodes} nodes exceeds limit of ${MAX_AST_NODES}`,
        nodeCount: totalNodes,
      };
    }
    return { valid: true, nodeCount: totalNodes };
  }

  if (typeof rule === "object") {
    let totalNodes = 0;
    for (const value of Object.values(rule as Record<string, unknown>)) {
      const result = validateJsonLogicRule(value, depth + 1);
      if (!result.valid) return result;
      totalNodes += result.nodeCount ?? 1;
    }
    if (totalNodes > MAX_AST_NODES) {
      return {
        valid: false,
        error: `JSON Logic rule too complex: ${totalNodes} nodes exceeds limit of ${MAX_AST_NODES}`,
        nodeCount: totalNodes,
      };
    }
    return { valid: true, nodeCount: totalNodes };
  }

  return { valid: false, error: "Invalid JSON Logic rule type" };
}

/** Escape special regex characters in a string */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
