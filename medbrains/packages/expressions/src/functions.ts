/**
 * MBX Whitelisted Function Registry
 *
 * All functions are pure (no side effects), safe (no I/O, no DOM, no network),
 * and operate only on their input arguments. No function has access to
 * global state, the filesystem, or the network.
 *
 * Categories: Math, String, Date, Logic, Medical, Format
 */

import type { FunctionMeta, SafeFunction } from "./types.js";

// ── Math Functions (pure, no side effects) ───────────────

const ROUND: SafeFunction = (val: unknown, decimals: unknown = 0) => {
  const n = Number(val);
  const d = Number(decimals);
  if (!Number.isFinite(n)) return 0;
  const factor = 10 ** Math.max(0, Math.min(d, 20));
  return Math.round(n * factor) / factor;
};

const CEIL: SafeFunction = (val: unknown) => {
  const n = Number(val);
  return Number.isFinite(n) ? Math.ceil(n) : 0;
};

const FLOOR: SafeFunction = (val: unknown) => {
  const n = Number(val);
  return Number.isFinite(n) ? Math.floor(n) : 0;
};

const ABS: SafeFunction = (val: unknown) => {
  const n = Number(val);
  return Number.isFinite(n) ? Math.abs(n) : 0;
};

const MIN: SafeFunction = (...args: unknown[]) => {
  const nums = args.map(Number).filter(Number.isFinite);
  return nums.length > 0 ? Math.min(...nums) : 0;
};

const MAX: SafeFunction = (...args: unknown[]) => {
  const nums = args.map(Number).filter(Number.isFinite);
  return nums.length > 0 ? Math.max(...nums) : 0;
};

const POW: SafeFunction = (base: unknown, exp: unknown) => {
  const b = Number(base);
  const e = Number(exp);
  if (!Number.isFinite(b) || !Number.isFinite(e)) return 0;
  const result = b ** e;
  return Number.isFinite(result) ? result : 0;
};

const SQRT: SafeFunction = (val: unknown) => {
  const n = Number(val);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.sqrt(n);
};

const MOD: SafeFunction = (a: unknown, b: unknown) => {
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb) || nb === 0) return 0;
  return na % nb;
};

// ── String Functions (pure, no side effects) ─────────────

const CONCAT: SafeFunction = (...args: unknown[]) =>
  args.map((a) => (a == null ? "" : String(a))).join("");

const UPPER: SafeFunction = (s: unknown) => String(s ?? "").toUpperCase();

const LOWER: SafeFunction = (s: unknown) => String(s ?? "").toLowerCase();

const TRIM: SafeFunction = (s: unknown) => String(s ?? "").trim();

const LEN: SafeFunction = (s: unknown) => String(s ?? "").length;

const LEFT: SafeFunction = (s: unknown, n: unknown) => {
  const str = String(s ?? "");
  const count = Math.max(0, Math.floor(Number(n)));
  return str.slice(0, count);
};

const RIGHT: SafeFunction = (s: unknown, n: unknown) => {
  const str = String(s ?? "");
  const count = Math.max(0, Math.floor(Number(n)));
  return count >= str.length ? str : str.slice(-count);
};

const SUBSTRING: SafeFunction = (s: unknown, start: unknown, length?: unknown) => {
  const str = String(s ?? "");
  const startIdx = Math.max(0, Math.floor(Number(start)));
  if (length !== undefined) {
    const len = Math.max(0, Math.floor(Number(length)));
    return str.slice(startIdx, startIdx + len);
  }
  return str.slice(startIdx);
};

const REPLACE: SafeFunction = (s: unknown, search: unknown, replacement: unknown) =>
  String(s ?? "")
    .split(String(search ?? ""))
    .join(String(replacement ?? ""));

const STARTS_WITH: SafeFunction = (s: unknown, prefix: unknown) =>
  String(s ?? "").startsWith(String(prefix ?? ""));

const ENDS_WITH: SafeFunction = (s: unknown, suffix: unknown) =>
  String(s ?? "").endsWith(String(suffix ?? ""));

const CONTAINS: SafeFunction = (s: unknown, search: unknown) =>
  String(s ?? "").includes(String(search ?? ""));

const REPEAT: SafeFunction = (s: unknown, count: unknown) => {
  const str = String(s ?? "");
  const n = Math.max(0, Math.min(Math.floor(Number(count)), 1000));
  return str.repeat(n);
};

const PAD_START: SafeFunction = (s: unknown, length: unknown, fill: unknown = " ") => {
  const str = String(s ?? "");
  const len = Math.max(0, Math.min(Math.floor(Number(length)), 1000));
  return str.padStart(len, String(fill ?? " "));
};

const PAD_END: SafeFunction = (s: unknown, length: unknown, fill: unknown = " ") => {
  const str = String(s ?? "");
  const len = Math.max(0, Math.min(Math.floor(Number(length)), 1000));
  return str.padEnd(len, String(fill ?? " "));
};

// ── Date Functions (read-only, deterministic except NOW/TODAY) ──

const NOW: SafeFunction = () => new Date();

const TODAY: SafeFunction = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const AGE: SafeFunction = (dob: unknown) => {
  if (!dob) return 0;
  const birthDate = new Date(String(dob));
  if (Number.isNaN(birthDate.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return Math.max(0, age);
};

const DATEDIFF: SafeFunction = (d1: unknown, d2: unknown, unit: unknown = "days") => {
  const date1 = d1 instanceof Date ? d1 : new Date(String(d1 ?? ""));
  const date2 = d2 instanceof Date ? d2 : new Date(String(d2 ?? ""));
  if (Number.isNaN(date1.getTime()) || Number.isNaN(date2.getTime())) return 0;

  const diffMs = date2.getTime() - date1.getTime();
  const unitStr = String(unit).toLowerCase();

  switch (unitStr) {
    case "days":
      return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    case "hours":
      return Math.floor(diffMs / (1000 * 60 * 60));
    case "minutes":
      return Math.floor(diffMs / (1000 * 60));
    case "months": {
      const months =
        (date2.getFullYear() - date1.getFullYear()) * 12 + (date2.getMonth() - date1.getMonth());
      return months;
    }
    case "years":
      return date2.getFullYear() - date1.getFullYear();
    default:
      return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }
};

const FORMAT_DATE: SafeFunction = (date: unknown, fmt: unknown = "DD/MM/YYYY") => {
  const d = date instanceof Date ? date : new Date(String(date ?? ""));
  if (Number.isNaN(d.getTime())) return "";

  const format = String(fmt);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");

  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const seconds = d.getSeconds();

  return format
    .replace("YYYY", String(year))
    .replace("YY", String(year).slice(-2))
    .replace("DD", pad(day))
    .replace("MM", pad(month))
    .replace("HH", pad(hours))
    .replace("mm", pad(minutes))
    .replace("ss", pad(seconds));
};

const DATE_ADD: SafeFunction = (date: unknown, amount: unknown, unit: unknown = "days") => {
  const d = date instanceof Date ? new Date(date.getTime()) : new Date(String(date ?? ""));
  if (Number.isNaN(d.getTime())) return null;
  const n = Math.floor(Number(amount));
  if (!Number.isFinite(n)) return null;

  const unitStr = String(unit).toLowerCase();
  switch (unitStr) {
    case "days":
      d.setDate(d.getDate() + n);
      break;
    case "months":
      d.setMonth(d.getMonth() + n);
      break;
    case "years":
      d.setFullYear(d.getFullYear() + n);
      break;
    case "hours":
      d.setHours(d.getHours() + n);
      break;
    case "minutes":
      d.setMinutes(d.getMinutes() + n);
      break;
    default:
      d.setDate(d.getDate() + n);
  }

  return d;
};

const YEAR: SafeFunction = (date: unknown) => {
  const d = date instanceof Date ? date : new Date(String(date ?? ""));
  return Number.isNaN(d.getTime()) ? 0 : d.getFullYear();
};

const MONTH: SafeFunction = (date: unknown) => {
  const d = date instanceof Date ? date : new Date(String(date ?? ""));
  return Number.isNaN(d.getTime()) ? 0 : d.getMonth() + 1;
};

const DAY: SafeFunction = (date: unknown) => {
  const d = date instanceof Date ? date : new Date(String(date ?? ""));
  return Number.isNaN(d.getTime()) ? 0 : d.getDate();
};

// ── Logic Functions (pure) ───────────────────────────────

const IF: SafeFunction = (cond: unknown, t: unknown, f: unknown) => (cond ? t : f);

const AND: SafeFunction = (...args: unknown[]) => args.every(Boolean);

const OR: SafeFunction = (...args: unknown[]) => args.some(Boolean);

const NOT: SafeFunction = (val: unknown) => !val;

const COALESCE: SafeFunction = (...args: unknown[]) => args.find((a) => a != null) ?? null;

const IS_EMPTY: SafeFunction = (val: unknown) =>
  val === null || val === undefined || val === "" || (Array.isArray(val) && val.length === 0);

const IS_NUMBER: SafeFunction = (val: unknown) => typeof val === "number" && Number.isFinite(val);

const IS_STRING: SafeFunction = (val: unknown) => typeof val === "string";

// ── Medical Functions (domain-specific, pure) ────────────

/** Body Mass Index: weight(kg) / height(m)^2 */
const BMI: SafeFunction = (weightKg: unknown, heightCm: unknown) => {
  const w = Number(weightKg);
  const h = Number(heightCm);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return 0;
  const heightM = h / 100;
  return w / (heightM * heightM);
};

/** Body Surface Area (Mosteller formula): sqrt((weight*height)/3600) */
const BSA: SafeFunction = (weightKg: unknown, heightCm: unknown) => {
  const w = Number(weightKg);
  const h = Number(heightCm);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return 0;
  return Math.sqrt((w * h) / 3600);
};

/** Estimated GFR (CKD-EPI simplified for demonstration) */
const GFR: SafeFunction = (creatinine: unknown, age: unknown, isFemale: unknown) => {
  const cr = Number(creatinine);
  const a = Number(age);
  const female = Boolean(isFemale);
  if (!Number.isFinite(cr) || !Number.isFinite(a) || cr <= 0 || a <= 0) return 0;

  // Simplified CKD-EPI: 186 * Cr^-1.154 * Age^-0.203 * [0.742 if female]
  let gfr = 186 * cr ** -1.154 * a ** -0.203;
  if (female) gfr *= 0.742;
  return Math.max(0, gfr);
};

/** APGAR score sum */
const APGAR: SafeFunction = (...scores: unknown[]) => {
  let total = 0;
  for (const s of scores) {
    const n = Number(s);
    if (Number.isFinite(n) && n >= 0 && n <= 2) {
      total += n;
    }
  }
  return total;
};

/** Ideal Body Weight (Devine formula) */
const IBW: SafeFunction = (heightCm: unknown, isMale: unknown) => {
  const h = Number(heightCm);
  if (!Number.isFinite(h) || h <= 0) return 0;
  const heightInches = h / 2.54;
  const baseHeight = 60; // 5 feet in inches
  const inchesOver = Math.max(0, heightInches - baseHeight);
  return isMale ? 50 + 2.3 * inchesOver : 45.5 + 2.3 * inchesOver;
};

// ── Format Functions (pure, locale-aware) ────────────────

const FORMAT_PHONE: SafeFunction = (phone: unknown) => {
  const p = String(phone ?? "").replace(/\D/g, "");
  if (p.length === 10) {
    return `${p.slice(0, 5)}-${p.slice(5)}`;
  }
  if (p.length === 12 && p.startsWith("91")) {
    return `+91 ${p.slice(2, 7)}-${p.slice(7)}`;
  }
  return String(phone ?? "");
};

const FORMAT_CURRENCY: SafeFunction = (amount: unknown, currency: unknown = "INR") => {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "0.00";
  const curr = String(currency ?? "INR");
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: curr,
      minimumFractionDigits: 2,
    }).format(n);
  } catch {
    return n.toFixed(2);
  }
};

const FORMAT_NUMBER: SafeFunction = (num: unknown, decimals: unknown = 0) => {
  const n = Number(num);
  const d = Math.max(0, Math.min(Math.floor(Number(decimals)), 20));
  if (!Number.isFinite(n)) return "0";
  try {
    return new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    }).format(n);
  } catch {
    return n.toFixed(d);
  }
};

// ── Registry ─────────────────────────────────────────────

/** Complete function registry with metadata */
export const FUNCTION_REGISTRY: ReadonlyMap<string, FunctionMeta> = new Map<string, FunctionMeta>([
  // Math
  [
    "ROUND",
    {
      name: "ROUND",
      category: "math",
      description: "Round to N decimal places",
      params: [
        { name: "value", type: "number", required: true },
        { name: "decimals", type: "number", required: false },
      ],
      returnType: "number",
      fn: ROUND,
    },
  ],
  [
    "CEIL",
    {
      name: "CEIL",
      category: "math",
      description: "Round up to nearest integer",
      params: [{ name: "value", type: "number", required: true }],
      returnType: "number",
      fn: CEIL,
    },
  ],
  [
    "FLOOR",
    {
      name: "FLOOR",
      category: "math",
      description: "Round down to nearest integer",
      params: [{ name: "value", type: "number", required: true }],
      returnType: "number",
      fn: FLOOR,
    },
  ],
  [
    "ABS",
    {
      name: "ABS",
      category: "math",
      description: "Absolute value",
      params: [{ name: "value", type: "number", required: true }],
      returnType: "number",
      fn: ABS,
    },
  ],
  [
    "MIN",
    {
      name: "MIN",
      category: "math",
      description: "Minimum of values",
      params: [{ name: "values", type: "number[]", required: true }],
      returnType: "number",
      fn: MIN,
    },
  ],
  [
    "MAX",
    {
      name: "MAX",
      category: "math",
      description: "Maximum of values",
      params: [{ name: "values", type: "number[]", required: true }],
      returnType: "number",
      fn: MAX,
    },
  ],
  [
    "POW",
    {
      name: "POW",
      category: "math",
      description: "Base raised to power",
      params: [
        { name: "base", type: "number", required: true },
        { name: "exponent", type: "number", required: true },
      ],
      returnType: "number",
      fn: POW,
    },
  ],
  [
    "SQRT",
    {
      name: "SQRT",
      category: "math",
      description: "Square root",
      params: [{ name: "value", type: "number", required: true }],
      returnType: "number",
      fn: SQRT,
    },
  ],
  [
    "MOD",
    {
      name: "MOD",
      category: "math",
      description: "Modulo (remainder)",
      params: [
        { name: "a", type: "number", required: true },
        { name: "b", type: "number", required: true },
      ],
      returnType: "number",
      fn: MOD,
    },
  ],

  // String
  [
    "CONCAT",
    {
      name: "CONCAT",
      category: "string",
      description: "Concatenate strings",
      params: [{ name: "values", type: "string[]", required: true }],
      returnType: "string",
      fn: CONCAT,
    },
  ],
  [
    "UPPER",
    {
      name: "UPPER",
      category: "string",
      description: "Convert to uppercase",
      params: [{ name: "text", type: "string", required: true }],
      returnType: "string",
      fn: UPPER,
    },
  ],
  [
    "LOWER",
    {
      name: "LOWER",
      category: "string",
      description: "Convert to lowercase",
      params: [{ name: "text", type: "string", required: true }],
      returnType: "string",
      fn: LOWER,
    },
  ],
  [
    "TRIM",
    {
      name: "TRIM",
      category: "string",
      description: "Remove leading/trailing whitespace",
      params: [{ name: "text", type: "string", required: true }],
      returnType: "string",
      fn: TRIM,
    },
  ],
  [
    "LEN",
    {
      name: "LEN",
      category: "string",
      description: "String length",
      params: [{ name: "text", type: "string", required: true }],
      returnType: "number",
      fn: LEN,
    },
  ],
  [
    "LEFT",
    {
      name: "LEFT",
      category: "string",
      description: "First N characters",
      params: [
        { name: "text", type: "string", required: true },
        { name: "count", type: "number", required: true },
      ],
      returnType: "string",
      fn: LEFT,
    },
  ],
  [
    "RIGHT",
    {
      name: "RIGHT",
      category: "string",
      description: "Last N characters",
      params: [
        { name: "text", type: "string", required: true },
        { name: "count", type: "number", required: true },
      ],
      returnType: "string",
      fn: RIGHT,
    },
  ],
  [
    "SUBSTRING",
    {
      name: "SUBSTRING",
      category: "string",
      description: "Extract substring",
      params: [
        { name: "text", type: "string", required: true },
        { name: "start", type: "number", required: true },
        { name: "length", type: "number", required: false },
      ],
      returnType: "string",
      fn: SUBSTRING,
    },
  ],
  [
    "REPLACE",
    {
      name: "REPLACE",
      category: "string",
      description: "Replace all occurrences",
      params: [
        { name: "text", type: "string", required: true },
        { name: "search", type: "string", required: true },
        { name: "replacement", type: "string", required: true },
      ],
      returnType: "string",
      fn: REPLACE,
    },
  ],
  [
    "STARTS_WITH",
    {
      name: "STARTS_WITH",
      category: "string",
      description: "Check if string starts with prefix",
      params: [
        { name: "text", type: "string", required: true },
        { name: "prefix", type: "string", required: true },
      ],
      returnType: "boolean",
      fn: STARTS_WITH,
    },
  ],
  [
    "ENDS_WITH",
    {
      name: "ENDS_WITH",
      category: "string",
      description: "Check if string ends with suffix",
      params: [
        { name: "text", type: "string", required: true },
        { name: "suffix", type: "string", required: true },
      ],
      returnType: "boolean",
      fn: ENDS_WITH,
    },
  ],
  [
    "CONTAINS",
    {
      name: "CONTAINS",
      category: "string",
      description: "Check if string contains substring",
      params: [
        { name: "text", type: "string", required: true },
        { name: "search", type: "string", required: true },
      ],
      returnType: "boolean",
      fn: CONTAINS,
    },
  ],
  [
    "REPEAT",
    {
      name: "REPEAT",
      category: "string",
      description: "Repeat string N times",
      params: [
        { name: "text", type: "string", required: true },
        { name: "count", type: "number", required: true },
      ],
      returnType: "string",
      fn: REPEAT,
    },
  ],
  [
    "PAD_START",
    {
      name: "PAD_START",
      category: "string",
      description: "Pad start of string",
      params: [
        { name: "text", type: "string", required: true },
        { name: "length", type: "number", required: true },
        { name: "fill", type: "string", required: false },
      ],
      returnType: "string",
      fn: PAD_START,
    },
  ],
  [
    "PAD_END",
    {
      name: "PAD_END",
      category: "string",
      description: "Pad end of string",
      params: [
        { name: "text", type: "string", required: true },
        { name: "length", type: "number", required: true },
        { name: "fill", type: "string", required: false },
      ],
      returnType: "string",
      fn: PAD_END,
    },
  ],

  // Date
  [
    "NOW",
    {
      name: "NOW",
      category: "date",
      description: "Current date and time",
      params: [],
      returnType: "Date",
      fn: NOW,
    },
  ],
  [
    "TODAY",
    {
      name: "TODAY",
      category: "date",
      description: "Current date (midnight)",
      params: [],
      returnType: "Date",
      fn: TODAY,
    },
  ],
  [
    "AGE",
    {
      name: "AGE",
      category: "date",
      description: "Age in years from date of birth",
      params: [{ name: "dob", type: "string|Date", required: true }],
      returnType: "number",
      fn: AGE,
    },
  ],
  [
    "DATEDIFF",
    {
      name: "DATEDIFF",
      category: "date",
      description: "Difference between two dates",
      params: [
        { name: "date1", type: "string|Date", required: true },
        { name: "date2", type: "string|Date", required: true },
        {
          name: "unit",
          type: "string",
          required: false,
          description: "days|hours|minutes|months|years",
        },
      ],
      returnType: "number",
      fn: DATEDIFF,
    },
  ],
  [
    "FORMAT_DATE",
    {
      name: "FORMAT_DATE",
      category: "date",
      description: "Format a date",
      params: [
        { name: "date", type: "string|Date", required: true },
        { name: "format", type: "string", required: false, description: "DD/MM/YYYY HH:mm:ss" },
      ],
      returnType: "string",
      fn: FORMAT_DATE,
    },
  ],
  [
    "DATE_ADD",
    {
      name: "DATE_ADD",
      category: "date",
      description: "Add time to a date",
      params: [
        { name: "date", type: "string|Date", required: true },
        { name: "amount", type: "number", required: true },
        { name: "unit", type: "string", required: false },
      ],
      returnType: "Date",
      fn: DATE_ADD,
    },
  ],
  [
    "YEAR",
    {
      name: "YEAR",
      category: "date",
      description: "Extract year from date",
      params: [{ name: "date", type: "string|Date", required: true }],
      returnType: "number",
      fn: YEAR,
    },
  ],
  [
    "MONTH",
    {
      name: "MONTH",
      category: "date",
      description: "Extract month (1-12) from date",
      params: [{ name: "date", type: "string|Date", required: true }],
      returnType: "number",
      fn: MONTH,
    },
  ],
  [
    "DAY",
    {
      name: "DAY",
      category: "date",
      description: "Extract day from date",
      params: [{ name: "date", type: "string|Date", required: true }],
      returnType: "number",
      fn: DAY,
    },
  ],

  // Logic
  [
    "IF",
    {
      name: "IF",
      category: "logic",
      description: "Conditional: IF(condition, trueValue, falseValue)",
      params: [
        { name: "condition", type: "boolean", required: true },
        { name: "trueValue", type: "any", required: true },
        { name: "falseValue", type: "any", required: true },
      ],
      returnType: "any",
      fn: IF,
    },
  ],
  [
    "AND",
    {
      name: "AND",
      category: "logic",
      description: "Logical AND of all arguments",
      params: [{ name: "values", type: "boolean[]", required: true }],
      returnType: "boolean",
      fn: AND,
    },
  ],
  [
    "OR",
    {
      name: "OR",
      category: "logic",
      description: "Logical OR of all arguments",
      params: [{ name: "values", type: "boolean[]", required: true }],
      returnType: "boolean",
      fn: OR,
    },
  ],
  [
    "NOT",
    {
      name: "NOT",
      category: "logic",
      description: "Logical NOT",
      params: [{ name: "value", type: "boolean", required: true }],
      returnType: "boolean",
      fn: NOT,
    },
  ],
  [
    "COALESCE",
    {
      name: "COALESCE",
      category: "logic",
      description: "First non-null value",
      params: [{ name: "values", type: "any[]", required: true }],
      returnType: "any",
      fn: COALESCE,
    },
  ],
  [
    "IS_EMPTY",
    {
      name: "IS_EMPTY",
      category: "logic",
      description: "Check if value is null, undefined, empty string, or empty array",
      params: [{ name: "value", type: "any", required: true }],
      returnType: "boolean",
      fn: IS_EMPTY,
    },
  ],
  [
    "IS_NUMBER",
    {
      name: "IS_NUMBER",
      category: "logic",
      description: "Check if value is a finite number",
      params: [{ name: "value", type: "any", required: true }],
      returnType: "boolean",
      fn: IS_NUMBER,
    },
  ],
  [
    "IS_STRING",
    {
      name: "IS_STRING",
      category: "logic",
      description: "Check if value is a string",
      params: [{ name: "value", type: "any", required: true }],
      returnType: "boolean",
      fn: IS_STRING,
    },
  ],

  // Medical
  [
    "BMI",
    {
      name: "BMI",
      category: "medical",
      description: "Body Mass Index: weight(kg) / height(m)^2",
      params: [
        { name: "weightKg", type: "number", required: true },
        { name: "heightCm", type: "number", required: true },
      ],
      returnType: "number",
      fn: BMI,
    },
  ],
  [
    "BSA",
    {
      name: "BSA",
      category: "medical",
      description: "Body Surface Area (Mosteller formula)",
      params: [
        { name: "weightKg", type: "number", required: true },
        { name: "heightCm", type: "number", required: true },
      ],
      returnType: "number",
      fn: BSA,
    },
  ],
  [
    "GFR",
    {
      name: "GFR",
      category: "medical",
      description: "Estimated Glomerular Filtration Rate (CKD-EPI simplified)",
      params: [
        { name: "creatinine", type: "number", required: true },
        { name: "age", type: "number", required: true },
        { name: "isFemale", type: "boolean", required: true },
      ],
      returnType: "number",
      fn: GFR,
    },
  ],
  [
    "APGAR",
    {
      name: "APGAR",
      category: "medical",
      description: "APGAR score (sum of 0-2 scores)",
      params: [{ name: "scores", type: "number[]", required: true, description: "Each 0-2" }],
      returnType: "number",
      fn: APGAR,
    },
  ],
  [
    "IBW",
    {
      name: "IBW",
      category: "medical",
      description: "Ideal Body Weight (Devine formula)",
      params: [
        { name: "heightCm", type: "number", required: true },
        { name: "isMale", type: "boolean", required: true },
      ],
      returnType: "number",
      fn: IBW,
    },
  ],

  // Format
  [
    "FORMAT_PHONE",
    {
      name: "FORMAT_PHONE",
      category: "format",
      description: "Format Indian phone number",
      params: [{ name: "phone", type: "string", required: true }],
      returnType: "string",
      fn: FORMAT_PHONE,
    },
  ],
  [
    "FORMAT_CURRENCY",
    {
      name: "FORMAT_CURRENCY",
      category: "format",
      description: "Format as currency (default INR)",
      params: [
        { name: "amount", type: "number", required: true },
        { name: "currency", type: "string", required: false },
      ],
      returnType: "string",
      fn: FORMAT_CURRENCY,
    },
  ],
  [
    "FORMAT_NUMBER",
    {
      name: "FORMAT_NUMBER",
      category: "format",
      description: "Format number with locale",
      params: [
        { name: "number", type: "number", required: true },
        { name: "decimals", type: "number", required: false },
      ],
      returnType: "string",
      fn: FORMAT_NUMBER,
    },
  ],
]);

/**
 * Get a flat record of function name → function for injection into expr-eval.
 * This is the primary way computed.ts gets access to registered functions.
 */
export function getFunctionMap(): Record<string, SafeFunction> {
  const map: Record<string, SafeFunction> = {};
  for (const [name, meta] of FUNCTION_REGISTRY) {
    map[name] = meta.fn;
  }
  return map;
}

/**
 * Get all function metadata grouped by category.
 * Used by the form builder UI to show available functions.
 */
export function getFunctionsByCategory(): Record<string, FunctionMeta[]> {
  const grouped: Record<string, FunctionMeta[]> = {};
  for (const meta of FUNCTION_REGISTRY.values()) {
    const list = grouped[meta.category] ?? [];
    list.push(meta);
    grouped[meta.category] = list;
  }
  return grouped;
}

/**
 * Check if a function name is registered (case-insensitive lookup).
 */
export function isFunctionRegistered(name: string): boolean {
  return FUNCTION_REGISTRY.has(name.toUpperCase());
}
