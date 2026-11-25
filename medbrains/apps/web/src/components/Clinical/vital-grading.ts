/**
 * How the vitals recorder grades a reading, by the patient's age.
 *
 * Heart rate, respiratory rate and systolic pressure have different normal
 * ranges at different ages; a healthy newborn's pulse of 140 is critical on
 * an adult chart. Under 16 those three use the HQSC paediatric charts
 * (`@/lib/paediatric-vital-bands`); with no age on record they are not
 * graded at all and the screen says the age is needed.
 */

import { isHypertensiveCrisis } from "@medbrains/schemas";
import type { BadgeTone } from "@/components/ui";
import { paediatricRanges, type Range } from "@/lib/paediatric-vital-bands";
import { bloodPressureSeverity } from "@/pages/opd/vitals-thresholds";

export type RangeLevel = "normal" | "borderline" | "critical";

/** A vital's normal and borderline ranges; outside borderline is critical. */
export interface VitalRanges {
  normal: Range;
  borderline: Range;
}

/** The vitals whose normal range depends on age. */
const AGE_DEPENDENT = new Set(["pulse", "respiratory_rate"]);

/**
 * The ranges to grade `key` by at `ageYears`: the paediatric chart under 16,
 * `adult` otherwise, and `null` (do not grade) when an age-dependent vital
 * has no age.
 */
export function rangesForAge(
  key: string,
  adult: VitalRanges,
  ageYears: number | null,
): VitalRanges | null {
  if (!AGE_DEPENDENT.has(key)) return adult;
  if (ageYears === null) return null;
  const chart = paediatricRanges(ageYears);
  if (!chart) return adult;
  return key === "pulse" ? chart.pulse : chart.respiratory_rate;
}

/** Where a value falls: normal, borderline or critical. */
export function rangeLevel(
  ranges: VitalRanges | null,
  value: number | undefined,
): RangeLevel | null {
  if (value === undefined || !ranges) return null;
  const { normal, borderline } = ranges;
  if (value >= normal[0] && value <= normal[1]) return "normal";
  if (value >= borderline[0] && value <= borderline[1]) return "borderline";
  return "critical";
}

/** The "low–high" text of the normal range, or "" when it is not a real range. */
export function rangeLabel(ranges: VitalRanges | null): string {
  if (!ranges) return "";
  const { normal } = ranges;
  if (normal[0] === 0 && normal[1] >= 999) return "";
  return `${normal[0]}–${normal[1]}`;
}

/** The badge for a value: Normal, Low, High, Critical low or Critical high. */
export function rangeStatus(
  ranges: VitalRanges | null,
  value: number | undefined,
): { label: string; color: BadgeTone } | null {
  const level = rangeLevel(ranges, value);
  if (!level || !ranges || value === undefined) return null;
  if (level === "normal") return { label: "Normal", color: "success" };
  const low = value < ranges.normal[0];
  const critical = level === "critical";
  const direction = low ? "low" : "high";
  const label = critical ? `Critical ${direction}` : low ? "Low" : "High";
  return { label, color: critical ? "danger" : "warning" };
}

/**
 * Blood pressure's level. Adults: hypertensive crisis is critical, any
 * stage of hypertension or hypotension borderline. Under 16: systolic
 * against the paediatric chart (it has no diastolic row). No age: `null`.
 */
export function bloodPressureLevel(
  systolic: number | undefined,
  diastolic: number | undefined,
  ageYears: number | null,
): RangeLevel | null {
  if (systolic === undefined || diastolic === undefined || ageYears === null) return null;
  const chart = paediatricRanges(ageYears);
  if (chart) return rangeLevel(chart.systolic_bp, systolic);
  if (isHypertensiveCrisis(systolic, diastolic)) return "critical";
  return bloodPressureSeverity(systolic, diastolic) === "normal" ? "normal" : "borderline";
}
