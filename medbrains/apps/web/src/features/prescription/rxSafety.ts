import type { DoseAlert, DrugSafetyCheckResult, WeightDoseAlert } from "@medbrains/types";

/** The live safety findings the writer shows: the server's drug-safety check. */
export type RxSafety = DrugSafetyCheckResult;

/** How loud a safety row is. */
export type SafetyState = "ok" | "warn" | "flag";

/** No findings yet: before the first check, and after a failed one. */
export const EMPTY_SAFETY: RxSafety = {
  interactions: [],
  allergy_conflicts: [],
  dose_alerts: [],
  dose_not_checked: [],
  weight_alerts: [],
  weight_not_checked: [],
  renal_alerts: [],
  hepatic_alerts: [],
  ingredient_alerts: [],
  pregnancy_alerts: [],
  conclusion: { severity: "clear", summary: "", recommendation: "", issue_count: 0 },
};

/** "4000 mg/day > max 3000 mg" for a line over its catalogue maximum. */
export function doseOverageLabel(alert: DoseAlert): string {
  return `${alert.total_per_day_label}/day > max ${alert.max_per_day_label}`;
}

/**
 * The "Max dose · 24h" row. An overage flags; a line the server could not
 * check warns and says why — it never reads as within the ceiling.
 */
export function maxDoseRow(safety: RxSafety): {
  state: SafetyState;
  detail: string;
  count: number;
} {
  const over = safety.dose_alerts;
  const unchecked = safety.dose_not_checked;
  const count = over.length + unchecked.length;
  if (over.length) {
    const detail = over.map((a) => `${a.drug_name}: ${doseOverageLabel(a)}`).join(", ");
    return { state: "flag", detail, count };
  }
  if (unchecked.length) {
    const detail = `Not checked — ${unchecked.map((n) => `${n.drug_name}: ${n.reason}`).join("; ")}`;
    return { state: "warn", detail, count };
  }
  return { state: "ok", detail: "Within catalog daily ceilings", count };
}

/** "500 mg/day is over the ~300 mg/day for 20 kg" for one weight-based alert. */
function weightAlertLabel(w: WeightDoseAlert): string {
  const per = `/${w.basis}`;
  return `${w.drug_name}: ${w.prescribed_per_day_label}${per} is ${w.direction} the ~${w.recommended_per_day_label}${per} for ${w.weight_kg} kg`;
}

/**
 * The "Paediatric dose · per kg" row. Over flags, under warns, and a line
 * the server could not check (no recent weight, unreadable rule) warns and
 * says why — it never reads as within range.
 */
export function weightDoseRow(safety: RxSafety): {
  state: SafetyState;
  detail: string;
  count: number;
} {
  const alerts = safety.weight_alerts;
  const unchecked = safety.weight_not_checked;
  const count = alerts.length + unchecked.length;
  const parts = alerts.map(weightAlertLabel);
  if (unchecked.length) {
    parts.push(`Not checked — ${unchecked.map((n) => `${n.drug_name}: ${n.reason}`).join("; ")}`);
  }
  const detail = parts.join(" · ");
  if (alerts.some((w) => w.direction === "over")) return { state: "flag", detail, count };
  if (count) return { state: "warn", detail, count };
  return { state: "ok", detail: "Within weight-based range (or not a paediatric patient)", count };
}
