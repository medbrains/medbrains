/** Reading a widget's resolved data, shared by its tile and its expanded view. */

import { formatDateTime } from "@/lib/date-utils";

/** Read a JSON-ish value from an unknown record. */
export function field(obj: unknown, key: string): unknown {
  return obj && typeof obj === "object" ? (obj as Record<string, unknown>)[key] : undefined;
}

export function formatValue(value: unknown, format?: string): string {
  // Number(null) is 0: an unknown must not print as a real zero.
  if (value === null || value === undefined) return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return typeof value === "string" ? value : "—";
  if (format === "currency") {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(n);
  }
  return new Intl.NumberFormat().format(n);
}

export function rows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  const items =
    field(data, "items") ?? field(data, "rows") ?? field(data, "data") ?? field(data, "trend");
  return Array.isArray(items) ? (items as Record<string, unknown>[]) : [];
}

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** A table cell as a person reads it: timestamps in local time, blanks as a dash. */
export function cellText(value: unknown): string {
  if (typeof value === "string" && ISO_TIMESTAMP.test(value)) return formatDateTime(value);
  return String(value ?? "—");
}
