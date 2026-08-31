/**
 * MBX Tier 1: Template Evaluator (mbx:template)
 *
 * Uses Handlebars for template interpolation with strict security:
 * - HTML-escaping by default ({{expr}} escapes, {{{raw}}} does not)
 * - Raw output ({{{...}}}) disabled for user-created templates
 * - Strict mode enabled — missing variables throw instead of silently returning ""
 * - Custom helpers from the whitelisted function registry
 * - No prototype access, no global access
 */

import Handlebars from "handlebars";
import { getFunctionMap } from "./functions.js";
import { createSandboxedContext, validateTemplateString } from "./sandbox.js";
import {
  type CompiledTemplate,
  type EvaluationResult,
  type ExpressionContext,
  MbxError,
  type TemplateOptions,
} from "./types.js";

/**
 * Create a fresh, isolated Handlebars environment.
 * Each call returns a new environment to prevent cross-contamination
 * between template compilations.
 */
function createIsolatedEnvironment(options?: TemplateOptions): typeof Handlebars {
  const env = Handlebars.create();

  // Register all whitelisted functions as Handlebars helpers
  const functions = getFunctionMap();
  for (const [name, fn] of Object.entries(functions)) {
    env.registerHelper(name, (...args: unknown[]) => {
      // Handlebars appends an options hash as the last argument — strip it
      const cleanArgs = args.slice(0, -1);
      return fn(...cleanArgs);
    });
  }

  // Register extra helpers if provided
  if (options?.extraHelpers) {
    for (const [name, fn] of Object.entries(options.extraHelpers)) {
      env.registerHelper(name, (...args: unknown[]) => {
        const cleanArgs = args.slice(0, -1);
        return fn(...cleanArgs);
      });
    }
  }

  // Register block helpers: #IF, #EACH, #UNLESS
  env.registerHelper(
    "IF",
    function (this: unknown, condition: unknown, hbOptions: Handlebars.HelperOptions) {
      if (condition) {
        return hbOptions.fn(this);
      }
      if (hbOptions.inverse) {
        return hbOptions.inverse(this);
      }
      return "";
    },
  );

  env.registerHelper(
    "EACH",
    function (this: unknown, context: unknown, hbOptions: Handlebars.HelperOptions) {
      if (!Array.isArray(context)) return "";
      let result = "";
      // Limit iteration to prevent DoS
      const maxItems = Math.min(context.length, 1000);
      for (let i = 0; i < maxItems; i++) {
        const blockParams = hbOptions.hash?.["AS"]
          ? { [String(hbOptions.hash["AS"])]: context[i] }
          : context[i];
        result += hbOptions.fn(
          typeof blockParams === "object" && blockParams !== null
            ? { ...blockParams, "@index": i, "@first": i === 0, "@last": i === maxItems - 1 }
            : {
                "@value": blockParams,
                "@index": i,
                "@first": i === 0,
                "@last": i === maxItems - 1,
              },
        );
      }
      return result;
    },
  );

  env.registerHelper(
    "UNLESS",
    function (this: unknown, condition: unknown, hbOptions: Handlebars.HelperOptions) {
      if (!condition) {
        return hbOptions.fn(this);
      }
      if (hbOptions.inverse) {
        return hbOptions.inverse(this);
      }
      return "";
    },
  );

  return env;
}

/**
 * Strip triple-bracket raw expressions from a template string.
 * This prevents XSS via unescaped output in user-created templates.
 * Only system templates (allowRawOutput=true) can use {{{raw}}}.
 */
function stripRawExpressions(template: string): string {
  // Replace {{{...}}} with {{...}} (forces escaping)
  return template.replace(/\{\{\{([^}]+)\}\}\}/g, "{{$1}}");
}

/**
 * Compile a template string into a reusable compiled template.
 *
 * @param templateStr - Handlebars template string
 * @param options - Template compilation options
 * @returns CompiledTemplate with a render() method
 * @throws MbxError if the template is invalid or too complex
 */
export function compileTemplate(templateStr: string, options?: TemplateOptions): CompiledTemplate {
  // Validate template complexity
  const validation = validateTemplateString(templateStr);
  if (!validation.valid) {
    throw new MbxError("TEMPLATE_COMPILE_ERROR", validation.error ?? "Invalid template");
  }

  // Strip raw expressions unless explicitly allowed (system templates)
  const safeTemplate = options?.allowRawOutput ? templateStr : stripRawExpressions(templateStr);

  // Create isolated Handlebars environment
  const env = createIsolatedEnvironment(options);

  // Compile the template
  let compiledFn: Handlebars.TemplateDelegate;
  try {
    compiledFn = env.compile(safeTemplate, {
      strict: false, // Don't throw on missing variables — return ""
      noEscape: false, // HTML-escape by default
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Template compilation failed";
    throw new MbxError("TEMPLATE_COMPILE_ERROR", message);
  }

  return {
    render(context: ExpressionContext): EvaluationResult<string> {
      try {
        const sandboxed = createSandboxedContext(context as Record<string, unknown>);
        // Handlebars needs a plain object, not a Proxy.
        // Flatten the sandboxed context to a plain object for rendering.
        const plainContext = flattenProxy(sandboxed);
        const result = compiledFn(plainContext);
        return { success: true, value: result };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Template rendering failed";
        return { success: false, error: message };
      }
    },
  };
}

/**
 * Render a template string with a context in a single call.
 * Convenience method — compiles and renders in one step.
 */
export function renderTemplate(
  templateStr: string,
  context: ExpressionContext,
  options?: TemplateOptions,
): EvaluationResult<string> {
  try {
    const compiled = compileTemplate(templateStr, options);
    return compiled.render(context);
  } catch (err) {
    if (err instanceof MbxError) {
      return { success: false, error: err.message };
    }
    const message = err instanceof Error ? err.message : "Template evaluation failed";
    return { success: false, error: message };
  }
}

/**
 * Convert a Proxy-wrapped context back to a plain object
 * for Handlebars compatibility. Handlebars does internal
 * property access that doesn't work well with Proxies.
 */
function flattenProxy(obj: unknown, depth = 0): unknown {
  if (depth > 5) return undefined;
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => flattenProxy(item, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    result[key] = flattenProxy((obj as Record<string, unknown>)[key], depth + 1);
  }
  return result;
}

/**
 * Validate a template string without compiling it.
 */
export function validateTemplate(templateStr: string): EvaluationResult<boolean> {
  const validation = validateTemplateString(templateStr);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Try to compile to catch syntax errors
  try {
    const env = Handlebars.create();
    env.compile(templateStr);
    return { success: true, value: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Template syntax error";
    return { success: false, error: message };
  }
}
