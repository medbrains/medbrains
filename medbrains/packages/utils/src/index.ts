export { applyServerErrors, ValidationError } from "./form-errors.js";

/**
 * Deep clone an object. Uses structuredClone when available,
 * falls back to JSON parse/stringify for non-browser environments.
 */
export function deepClone<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  // Fallback for environments without structuredClone
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Format an ISO date string for display.
 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format an ISO date string with time for display.
 */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Capitalize the first letter of a string.
 */
export function capitalize(str: string): string {
  if (str.length === 0) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert a snake_case string to Title Case for display.
 */
export function snakeToTitle(str: string): string {
  return str
    .split("_")
    .map((word) => capitalize(word))
    .join(" ");
}

/**
 * Truncate a string to a max length, adding ellipsis if truncated.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength - 1)}\u2026`;
}

// ── Privacy / Masking Utilities ──────────────────────────────────────────────

export type MaskableFieldAccessLevel = "edit" | "view" | "mask" | "hidden";

const fieldAccessRank: Record<MaskableFieldAccessLevel, number> = {
  edit: 0,
  view: 1,
  mask: 2,
  hidden: 3,
};

function isMaskableIdentifierChar(char: string): boolean {
  return /^[A-Za-z0-9]$/.test(char);
}

export function mostRestrictedFieldAccess(
  accessLevels: readonly MaskableFieldAccessLevel[],
): MaskableFieldAccessLevel {
  return accessLevels.reduce<MaskableFieldAccessLevel>((current, next) => {
    return fieldAccessRank[next] > fieldAccessRank[current] ? next : current;
  }, "edit");
}

/**
 * Mask every ASCII alpha-numeric character except the last visible segment.
 * Separators are preserved so values stay recognizable without exposing the raw identifier.
 */
export function maskIdentifierKeepLast(value: string | null | undefined, visibleChars = 4): string {
  const source = value?.trim() ?? "";
  if (!source) return "";

  const chars = Array.from(source);
  const maskableCount = chars.filter(isMaskableIdentifierChar).length;
  if (maskableCount === 0) return "";

  let remainingVisible = Math.min(visibleChars, maskableCount);
  const reversed: string[] = [];
  for (let index = chars.length - 1; index >= 0; index -= 1) {
    const char = chars[index];
    if (!char) continue;
    if (!isMaskableIdentifierChar(char)) {
      reversed.push(char);
      continue;
    }
    if (remainingVisible > 0) {
      remainingVisible -= 1;
      reversed.push(char);
    } else {
      reversed.push("X");
    }
  }

  return reversed.reverse().join("");
}

export function maskPhone(value: string | null | undefined): string {
  return maskIdentifierKeepLast(value, 4);
}

export function maskName(value: string | null | undefined): string {
  return value?.trim() ? "Masked name" : "";
}

export function maskEmail(value: string | null | undefined): string {
  const source = value?.trim() ?? "";
  if (!source) return "";
  const atIndex = source.indexOf("@");
  if (atIndex <= 0) return maskIdentifierKeepLast(source, 2);

  const local = source.slice(0, atIndex);
  const domain = source.slice(atIndex + 1);
  const visibleLocal = local.slice(0, 1);
  return `${visibleLocal}${"X".repeat(Math.max(local.length - 1, 3))}@${domain}`;
}

export function maskAmount(value: string | null | undefined): string {
  return value?.trim() ? "Amount masked" : "";
}

export function maskSensitiveText(value: string | null | undefined, label = "Masked"): string {
  return value?.trim() ? label : "";
}

export function fieldAccessText(
  access: MaskableFieldAccessLevel,
  value: string | null | undefined,
  kind: "amount" | "email" | "identifier" | "name" | "phone" | "text" = "text",
): string {
  if (access === "hidden") return "Restricted";
  if (access !== "mask") return value?.trim() || "\u2014";
  if (kind === "amount") return maskAmount(value) || "Masked";
  if (kind === "email") return maskEmail(value) || "Masked";
  if (kind === "phone") return maskPhone(value) || "Masked";
  if (kind === "identifier") return maskIdentifierKeepLast(value, 4) || "Masked";
  if (kind === "name") return maskName(value) || "Masked";
  return maskSensitiveText(value) || "Masked";
}

// ── Case Conversion Utilities ────────────────────────────────────────────────
// Backend uses snake_case, Frontend uses camelCase

/**
 * Convert a camelCase string to snake_case.
 * @example camelToSnake("firstName") // "first_name"
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Convert a snake_case string to camelCase.
 * @example snakeToCamel("first_name") // "firstName"
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

type CamelToSnakeCase<S extends string> = S extends `${infer T}${infer U}`
  ? T extends Uppercase<T>
    ? `_${Lowercase<T>}${CamelToSnakeCase<U>}`
    : `${T}${CamelToSnakeCase<U>}`
  : S;

type SnakeToCamelCase<S extends string> = S extends `${infer T}_${infer U}`
  ? `${T}${Capitalize<SnakeToCamelCase<U>>}`
  : S;

type KeysToCamelCase<T> = {
  [K in keyof T as K extends string ? SnakeToCamelCase<K> : K]: T[K] extends object
    ? KeysToCamelCase<T[K]>
    : T[K];
};

type KeysToSnakeCase<T> = {
  [K in keyof T as K extends string ? CamelToSnakeCase<K> : K]: T[K] extends object
    ? KeysToSnakeCase<T[K]>
    : T[K];
};

/**
 * Recursively convert all object keys from snake_case to camelCase.
 * Useful for transforming API responses to frontend format.
 */
export function keysToCamel<T extends Record<string, unknown>>(obj: T): KeysToCamelCase<T> {
  if (Array.isArray(obj)) {
    return obj.map((item) =>
      typeof item === "object" && item !== null
        ? keysToCamel(item as Record<string, unknown>)
        : item,
    ) as KeysToCamelCase<T>;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = snakeToCamel(key);
    if (value !== null && typeof value === "object") {
      result[camelKey] = keysToCamel(value as Record<string, unknown>);
    } else {
      result[camelKey] = value;
    }
  }
  return result as KeysToCamelCase<T>;
}

/**
 * Recursively convert all object keys from camelCase to snake_case.
 * Useful for transforming frontend data to API request format.
 */
export function keysToSnake<T extends Record<string, unknown>>(obj: T): KeysToSnakeCase<T> {
  if (Array.isArray(obj)) {
    return obj.map((item) =>
      typeof item === "object" && item !== null
        ? keysToSnake(item as Record<string, unknown>)
        : item,
    ) as KeysToSnakeCase<T>;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = camelToSnake(key);
    if (value !== null && typeof value === "object") {
      result[snakeKey] = keysToSnake(value as Record<string, unknown>);
    } else {
      result[snakeKey] = value;
    }
  }
  return result as KeysToSnakeCase<T>;
}
