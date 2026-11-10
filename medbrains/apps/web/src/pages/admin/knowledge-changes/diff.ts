/**
 * Pure logic behind the change-set screens: which cells changed, and how the
 * impact report is grouped. Kept apart from the components so it is tested
 * without rendering.
 */
import type {
  KnowledgeArea,
  KnowledgeChangeItem,
  KnowledgeImpactEntry,
  KnowledgeImpactReport,
  KnowledgeImpactSeverity,
  KnowledgeRowFields,
} from "@medbrains/types";
import { AREA_FIELDS, DIFF_ONLY_FIELDS } from "./labels";

export interface FieldChange {
  key: string;
  label: string;
  before: string;
  after: string;
  changed: boolean;
}

const EMPTY = "—";

export function showValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return EMPTY;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  // A flow track: its stations in order, branches named.
  if (Array.isArray(value)) {
    return value
      .map((s: { name?: string; lane?: string | null }) =>
        s.lane ? `${s.name} (${s.lane})` : String(s.name ?? ""),
      )
      .join(" → ");
  }
  return String(value);
}

/**
 * Every editable field of an item, old beside new. A removal's "after" is the
 * row switched off; an addition has no "before".
 */
export function diffItem(area: KnowledgeArea, item: KnowledgeChangeItem): FieldChange[] {
  const before = item.before;
  const after: KnowledgeRowFields | null =
    item.op === "delete" && before ? { ...before, is_active: false } : item.after;
  const fields = [
    ...AREA_FIELDS[area],
    ...(DIFF_ONLY_FIELDS[area] ?? []),
    { key: "is_active", label: "In use", kind: "text" as const },
  ];
  return fields.map(({ key, label }) => {
    const b = item.op === "create" ? EMPTY : showValue(before?.[key]);
    const a = showValue(after?.[key]);
    return { key, label, before: b, after: a, changed: b !== a };
  });
}

const ORDER: KnowledgeImpactSeverity[] = ["safety", "access", "money", "info"];

export interface ImpactGroup {
  severity: KnowledgeImpactSeverity;
  entries: KnowledgeImpactEntry[];
}

/** Entries grouped by severity, safety first, empty groups dropped. */
export function groupImpact(report: KnowledgeImpactReport): ImpactGroup[] {
  return ORDER.map((severity) => ({
    severity,
    entries: report.entries.filter((e) => e.severity === severity),
  })).filter((g) => g.entries.length > 0);
}

/** One chip per severity: how many records, "+" when a count is a floor. */
export function impactChips(
  report: KnowledgeImpactReport | null,
): { severity: KnowledgeImpactSeverity; text: string }[] {
  if (!report) return [];
  return groupImpact(report).map(({ severity, entries }) => {
    const total = entries.reduce((n, e) => n + e.count, 0);
    const floor = entries.some((e) => e.truncated) ? "+" : "";
    return { severity, text: `${total.toLocaleString()}${floor}` };
  });
}
