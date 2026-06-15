// DataTable feature helpers — pure sorting + CSV export, framework-free so
// they're trivially testable and keep DataTable.tsx focused on rendering.

export type SortDir = "asc" | "desc";

export interface SortState {
  key: string;
  dir: SortDir;
}

type SortValue = string | number | null | undefined;

/** Null-safe, numeric-aware comparison (ascending). */
export function compareValues(a: SortValue, b: SortValue): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

/** Stable sort of rows by a value getter; non-mutating. */
export function sortRows<T>(rows: T[], getValue: (row: T) => SortValue, dir: SortDir): T[] {
  const factor = dir === "desc" ? -1 : 1;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const cmp = compareValues(getValue(a.row), getValue(b.row));
      return cmp !== 0 ? cmp * factor : a.index - b.index;
    })
    .map((entry) => entry.row);
}

/** Next sort state when a header is clicked: asc → desc → cleared. */
export function nextSortState(current: SortState | null, key: string): SortState | null {
  if (!current || current.key !== key) return { key, dir: "asc" };
  if (current.dir === "asc") return { key, dir: "desc" };
  return null;
}

function csvCell(value: unknown): string {
  const str = value == null ? "" : String(value);
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/** Build a CSV string from header labels + a matrix of cell values. */
export function buildCsv(headers: string[], rows: Array<Array<string | number | null>>): string {
  return [headers, ...rows].map((cells) => cells.map(csvCell).join(",")).join("\r\n");
}

/** Trigger a client-side download of CSV text (BOM-prefixed for Excel). */
export function downloadCsv(fileName: string, content: string): void {
  const blob = new Blob([`﻿${content}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName.endsWith(".csv") ? fileName : `${fileName}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
