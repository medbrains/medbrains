export { ValidationError, applyServerErrors } from "./form-errors.js";

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
  return str.slice(0, maxLength - 1) + "\u2026";
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
