import type { AbdmDashboardMonth } from "@medbrains/types";

/** `part` of `whole` as a whole-number percent; null when there is no whole. */
export function percentOf(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

/** A percent for a stat card: "—" when there was nothing to measure, never 0%. */
export function formatPercent(value: number | null): string {
  return value === null ? "—" : `${value}%`;
}

export function formatInr(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}

/** The last `count` months, newest first, as `YYYY-MM` keys and labels. */
export function monthOptions(today: Date, count: number): { value: string; label: string }[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    return {
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
    };
  });
}

/** Progress towards the DHIS threshold, capped at 100 for the bar. */
export function thresholdProgress(eligible: number, threshold: number): number {
  return threshold > 0 ? Math.min(100, Math.round((eligible / threshold) * 100)) : 0;
}

export interface TrendRow {
  month: string;
  opdWithAbhaPercent: number | null;
  linked: number;
  eligible: number;
  estimateInr: number;
}

/** One row per month for the trend chart and its table. */
export function trendRows(trend: AbdmDashboardMonth[]): TrendRow[] {
  return trend.map((m) => ({
    month: new Date(`${m.month}T00:00:00`).toLocaleDateString("en-IN", {
      month: "short",
      year: "2-digit",
    }),
    opdWithAbhaPercent: percentOf(m.opd_with_abha, m.opd_visits),
    linked: m.dhis.linked_category_1 + m.dhis.linked_category_2,
    eligible: m.estimate.eligible_links,
    estimateInr: m.estimate.hip_inr + m.estimate.hiu_inr,
  }));
}
