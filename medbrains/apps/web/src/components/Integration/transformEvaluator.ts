import type {
  FieldMapping,
  MappingOperationConfig,
  MappingOperationType,
  MappingSource,
  TransformStep,
} from "@medbrains/types";

// ── Types ─────────────────────────────────────────────────

export interface StepResult {
  stepId: string;
  operation: MappingOperationType;
  input: unknown;
  output: unknown;
  error?: string;
}

export interface MappingEvalResult {
  mappingId: string;
  sourceValue: unknown;
  steps: StepResult[];
  finalOutput: unknown;
  error?: string;
}

// ── Helpers ───────────────────────────────────────────────

function toStringValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

function toArray(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (v === null || v === undefined) return [];
  return [v];
}

function replaceAll(source: string, search: string, replacement: string): string {
  return source.split(search).join(replacement);
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current === "object") {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

// ── Resolve a single source (recursive for groups) ───────

function resolveSourceValue(source: MappingSource, sampleData: Record<string, unknown>): unknown {
  // If this source has children, it's a group — resolve recursively
  if (source.children && source.children.length > 0) {
    const childValues = source.children.map((c) => resolveSourceValue(c, sampleData));
    const mode = source.groupCombineMode ?? "concat";
    return combineValues(childValues, source.children, mode, source.groupCombineConfig ?? {});
  }
  // Leaf source — resolve from sample data
  return getNestedValue(sampleData, source.path);
}

/** Combine an array of resolved values using a mode */
function combineValues(
  values: unknown[],
  sources: MappingSource[],
  mode: string,
  config: { separator?: string; templateStr?: string; expression?: string },
): unknown {
  switch (mode) {
    case "concat": {
      const sep = config.separator ?? " ";
      return values.map((v) => toStringValue(v)).join(sep);
    }
    case "fallback":
      return values.find((v) => v !== null && v !== undefined && v !== "") ?? null;
    case "template": {
      const tpl = config.templateStr ?? "";
      let result = tpl;
      sources.forEach((s, i) => {
        const placeholder = `{{${s.path}}}`;
        const indexed = `{{source${i + 1}}}`;
        result = replaceAll(result, placeholder, toStringValue(values[i]));
        result = replaceAll(result, indexed, toStringValue(values[i]));
      });
      return result;
    }
    case "arithmetic": {
      const expr = config.expression ?? "";
      let result = expr;
      sources.forEach((s, i) => {
        const placeholder = `{{${s.path}}}`;
        const indexed = `{{source${i + 1}}}`;
        result = replaceAll(result, placeholder, String(toNumber(values[i])));
        result = replaceAll(result, indexed, String(toNumber(values[i])));
      });
      try {
        if (/^[\d\s+\-*/().]+$/.test(result)) {
          return new Function(`return (${result})`)() as number;
        }
        return result;
      } catch {
        return result;
      }
    }
    default:
      return values[0];
  }
}

// ── Combine sources ───────────────────────────────────────

function combineSourceValues(mapping: FieldMapping, sampleData: Record<string, unknown>): unknown {
  const mode = mapping.combineMode ?? "single";
  if (mode === "single" || !mapping.sources || mapping.sources.length === 0) {
    return getNestedValue(sampleData, mapping.from);
  }

  // Resolve each source (may be a leaf or a nested group)
  const values = mapping.sources.map((s) => resolveSourceValue(s, sampleData));

  return combineValues(values, mapping.sources, mode, mapping.combineConfig ?? {});
}

// ── Evaluation context ────────────────────────────────────

export interface EvalContext {
  sampleData?: Record<string, unknown>;
}

// ── Evaluate a single step ────────────────────────────────

export function evaluateStep(
  input: unknown,
  step: TransformStep,
  context?: EvalContext,
): { output: unknown; error?: string } {
  const cfg = step.config ?? {};

  try {
    const output = applyOperation(input, step.operation, cfg, context);
    return { output };
  } catch (e) {
    return {
      output: input,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

function applyOperation(
  input: unknown,
  op: MappingOperationType,
  cfg: MappingOperationConfig,
  context?: EvalContext,
): unknown {
  const str = () => toStringValue(input);
  const num = () => toNumber(input);
  const arr = () => toArray(input);

  switch (op) {
    case "none":
      return input;

    // ── String ──────────────────────────────────────
    case "uppercase":
      return str().toUpperCase();
    case "lowercase":
      return str().toLowerCase();
    case "trim":
      return str().trim();
    case "capitalize":
      return str()
        .split(" ")
        .map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
        .join(" ");
    case "camel_case": {
      const words = str()
        .split(/[\s_-]+/)
        .filter(Boolean);
      return words
        .map((w, i) =>
          i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
        )
        .join("");
    }
    case "snake_case":
      return str()
        .replace(/([a-z])([A-Z])/g, "$1_$2")
        .replace(/[\s-]+/g, "_")
        .toLowerCase();
    case "kebab_case":
      return str()
        .replace(/([a-z])([A-Z])/g, "$1-$2")
        .replace(/[\s_]+/g, "-")
        .toLowerCase();
    case "slug":
      return str()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    case "pad_start":
      return str().padStart(cfg.padLength ?? 0, cfg.padChar ?? " ");
    case "pad_end":
      return str().padEnd(cfg.padLength ?? 0, cfg.padChar ?? " ");
    case "substring":
      return str().slice(cfg.start ?? 0, cfg.end ?? undefined);
    case "replace":
      return replaceAll(str(), cfg.find ?? "", cfg.replaceWith ?? "");
    case "regex_replace": {
      const re = new RegExp(cfg.regex ?? "", cfg.regexFlags ?? "g");
      return str().replace(re, cfg.replaceWith ?? "");
    }
    case "regex_extract": {
      const re = new RegExp(cfg.regex ?? "", cfg.regexFlags ?? "");
      const match = str().match(re);
      return match ? match[0] : null;
    }
    case "split":
      return str().split(cfg.separator ?? ",");
    case "template": {
      const tpl = cfg.templateString ?? "{{value}}";
      return replaceAll(tpl, "{{value}}", str());
    }
    case "truncate": {
      const max = cfg.maxLength ?? 100;
      const suffix = cfg.suffix ?? "...";
      const s = str();
      return s.length > max ? s.slice(0, max) + suffix : s;
    }
    case "encode_base64":
      return btoa(str());
    case "decode_base64":
      return atob(str());

    // ── Array ───────────────────────────────────────
    case "join":
      return arr()
        .map((v) => toStringValue(v))
        .join(cfg.separator ?? ",");
    case "flatten":
      return arr().flat();
    case "unique":
      return [...new Set(arr().map((v) => JSON.stringify(v)))].map((v) => JSON.parse(v) as unknown);
    case "sort_array":
      return [...arr()].sort((a, b) => String(a).localeCompare(String(b)));
    case "reverse":
      return [...arr()].reverse();
    case "first":
      return arr()[0] ?? null;
    case "last": {
      const a = arr();
      return a[a.length - 1] ?? null;
    }
    case "nth":
      return arr()[cfg.index ?? 0] ?? null;
    case "count":
      return arr().length;
    case "filter": {
      const cond = cfg.condition ?? "";
      if (!cond) return arr();
      return arr().filter((item) => {
        const s = toStringValue(item);
        return s.includes(cond);
      });
    }
    case "map_each": {
      const field = cfg.field ?? "";
      if (!field) return arr();
      return arr().map((item) => {
        if (typeof item === "object" && item !== null) {
          return (item as Record<string, unknown>)[field];
        }
        return item;
      });
    }
    case "pluck": {
      const field = cfg.field ?? "";
      return arr().map((item) => {
        if (typeof item === "object" && item !== null) {
          return (item as Record<string, unknown>)[field];
        }
        return null;
      });
    }
    case "sum":
      return arr().reduce((acc: number, v) => acc + toNumber(v), 0);
    case "avg": {
      const a = arr();
      if (a.length === 0) return 0;
      const total = a.reduce((acc: number, v) => acc + toNumber(v), 0);
      return total / a.length;
    }
    case "array_min":
      return Math.min(...arr().map(toNumber));
    case "array_max":
      return Math.max(...arr().map(toNumber));
    case "push": {
      const a = arr();
      return [...a, cfg.defaultValue ?? null];
    }
    case "concat_arrays":
      return arr();
    case "slice":
      return arr().slice(cfg.start ?? 0, cfg.end ?? undefined);
    case "chunk": {
      const size = cfg.chunkSize ?? 1;
      const a = arr();
      const chunks: unknown[][] = [];
      for (let i = 0; i < a.length; i += size) {
        chunks.push(a.slice(i, i + size));
      }
      return chunks;
    }

    // ── Number ──────────────────────────────────────
    case "to_number":
      return toNumber(input);
    case "round": {
      const dp = cfg.decimalPlaces ?? 0;
      const factor = 10 ** dp;
      return Math.round(num() * factor) / factor;
    }
    case "ceil":
      return Math.ceil(num());
    case "floor":
      return Math.floor(num());
    case "abs":
      return Math.abs(num());
    case "mod":
      return num() % (cfg.operand ?? 1);
    case "add":
      return num() + (cfg.operand ?? 0);
    case "subtract":
      return num() - (cfg.operand ?? 0);
    case "multiply":
      return num() * (cfg.operand ?? 1);
    case "divide": {
      const divisor = cfg.operand ?? 1;
      if (divisor === 0) return num();
      return num() / divisor;
    }
    case "clamp":
      return Math.min(Math.max(num(), cfg.minValue ?? -Infinity), cfg.maxValue ?? Infinity);
    case "format_number": {
      const dp = cfg.decimalPlaces ?? 2;
      const locale = cfg.locale ?? "en-US";
      try {
        return num().toLocaleString(locale, {
          minimumFractionDigits: dp,
          maximumFractionDigits: dp,
        });
      } catch {
        return num().toFixed(dp);
      }
    }

    // ── Date ────────────────────────────────────────
    case "to_date": {
      const d = new Date(str());
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }
    case "format_date": {
      const d = new Date(str());
      if (Number.isNaN(d.getTime())) return null;
      const fmt = cfg.dateFormat ?? "YYYY-MM-DD";
      return formatDateSimple(d, fmt);
    }
    case "parse_date": {
      const d = new Date(str());
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }
    case "add_days": {
      const d = new Date(str());
      if (Number.isNaN(d.getTime())) return null;
      d.setDate(d.getDate() + (cfg.days ?? 0));
      return d.toISOString();
    }
    case "add_hours": {
      const d = new Date(str());
      if (Number.isNaN(d.getTime())) return null;
      d.setHours(d.getHours() + (cfg.hours ?? 0));
      return d.toISOString();
    }
    case "subtract_days": {
      const d = new Date(str());
      if (Number.isNaN(d.getTime())) return null;
      d.setDate(d.getDate() - (cfg.days ?? 0));
      return d.toISOString();
    }
    case "date_diff": {
      // Just return the input as-is for now (need 2nd date for diff)
      return str();
    }
    case "now":
      return new Date().toISOString();
    case "extract_year":
      return new Date(str()).getFullYear();
    case "extract_month":
      return new Date(str()).getMonth() + 1;
    case "extract_day":
      return new Date(str()).getDate();

    // ── Conversion ──────────────────────────────────
    case "to_string":
      return toStringValue(input);
    case "to_boolean": {
      if (typeof input === "boolean") return input;
      const s = str().toLowerCase().trim();
      return s === "true" || s === "1" || s === "yes";
    }
    case "to_array":
      return Array.isArray(input) ? input : [input];
    case "parse_json":
      try {
        return JSON.parse(str()) as unknown;
      } catch {
        return null;
      }
    case "to_json":
      return JSON.stringify(input);
    case "coalesce":
      return input ?? null;
    case "default_value":
      return input === null || input === undefined || input === ""
        ? (cfg.defaultValue ?? null)
        : input;
    case "is_null":
      return input === null || input === undefined;
    case "is_empty":
      return (
        input === null ||
        input === undefined ||
        input === "" ||
        (Array.isArray(input) && input.length === 0)
      );
    case "typeof":
      if (input === null) return "null";
      if (Array.isArray(input)) return "array";
      return typeof input;

    // ── Merge ────────────────────────────────────────
    case "merge_field": {
      const fieldPath = cfg.mergeFieldPath ?? "";
      const mergeValue =
        fieldPath && context?.sampleData ? getNestedValue(context.sampleData, fieldPath) : null;
      const mode = cfg.mergeCombineMode ?? "concat";

      switch (mode) {
        case "concat": {
          const sep = cfg.separator ?? " ";
          return toStringValue(input) + sep + toStringValue(mergeValue);
        }
        case "fallback":
          return input !== null && input !== undefined && input !== "" ? input : mergeValue;
        case "template": {
          const tpl = cfg.templateString ?? "{{current}} {{merged}}";
          let result = tpl;
          result = replaceAll(result, "{{current}}", toStringValue(input));
          result = replaceAll(result, "{{merged}}", toStringValue(mergeValue));
          return result;
        }
        case "arithmetic": {
          const expr = cfg.templateString ?? "{{current}} + {{merged}}";
          let result = expr;
          result = replaceAll(result, "{{current}}", String(toNumber(input)));
          result = replaceAll(result, "{{merged}}", String(toNumber(mergeValue)));
          try {
            if (/^[\d\s+\-*/().]+$/.test(result)) {
              return new Function(`return (${result})`)() as number;
            }
            return result;
          } catch {
            return result;
          }
        }
        default:
          return `${toStringValue(input)} ${toStringValue(mergeValue)}`;
      }
    }

    default:
      return input;
  }
}

// ── Simple date format ────────────────────────────────────

function formatDateSimple(date: Date, fmt: string): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const h = date.getHours();
  const min = date.getMinutes();
  const s = date.getSeconds();

  return fmt
    .replace("YYYY", String(y))
    .replace("YY", String(y).slice(-2))
    .replace("MM", String(m).padStart(2, "0"))
    .replace("DD", String(d).padStart(2, "0"))
    .replace("HH", String(h).padStart(2, "0"))
    .replace("mm", String(min).padStart(2, "0"))
    .replace("ss", String(s).padStart(2, "0"));
}

// ── Evaluate a chain of steps ─────────────────────────────

export function evaluateChain(
  input: unknown,
  chain: TransformStep[],
  context?: EvalContext,
): StepResult[] {
  const results: StepResult[] = [];
  let current = input;

  for (const step of chain) {
    const { output, error } = evaluateStep(current, step, context);
    results.push({
      stepId: step.id,
      operation: step.operation,
      input: current,
      output,
      error,
    });
    current = output;
  }

  return results;
}

// ── Evaluate a complete mapping ───────────────────────────

export function evaluateMapping(
  mapping: FieldMapping,
  sampleData: Record<string, unknown>,
): MappingEvalResult {
  const sourceValue = combineSourceValues(mapping, sampleData);
  const chain = mapping.chain ?? [];

  const ctx: EvalContext = { sampleData };

  if (chain.length === 0) {
    // Legacy single-operation support
    if (mapping.operation && mapping.operation !== "none") {
      const step: TransformStep = {
        id: `legacy_${mapping.id}`,
        operation: mapping.operation,
        config: mapping.operationConfig ?? {},
      };
      const steps = evaluateChain(sourceValue, [step], ctx);
      return {
        mappingId: mapping.id,
        sourceValue,
        steps,
        finalOutput: steps[steps.length - 1]?.output ?? sourceValue,
      };
    }
    return {
      mappingId: mapping.id,
      sourceValue,
      steps: [],
      finalOutput: sourceValue,
    };
  }

  const steps = evaluateChain(sourceValue, chain, ctx);
  const lastStep = steps[steps.length - 1];
  const hasError = steps.some((s) => s.error);

  return {
    mappingId: mapping.id,
    sourceValue,
    steps,
    finalOutput: lastStep?.output ?? sourceValue,
    error: hasError ? "One or more steps had errors" : undefined,
  };
}
