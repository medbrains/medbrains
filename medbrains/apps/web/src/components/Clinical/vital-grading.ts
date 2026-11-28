/**
 * How the vitals recorder grades a reading against its ranges: normal,
 * borderline or critical, and the badge that says so. Kept apart from the
 * recorder's markup because these are clinical thresholds, not styling.
 */

import { isHypertensiveCrisis } from "@medbrains/schemas";
import type { BadgeTone } from "@/components/ui";
import { bloodPressureSeverity } from "@/pages/opd/vitals-thresholds";

export type RangeLevel = "normal" | "borderline" | "critical";

/** A vital's normal and borderline ranges, inclusive; outside borderline is critical. */
export interface VitalRanges {
  normal: [number, number];
  borderline: [number, number];
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
 * Blood pressure's level: hypertensive crisis is critical, any stage of
 * hypertension or hypotension borderline.
 */
export function bloodPressureLevel(
  systolic: number | undefined,
  diastolic: number | undefined,
): RangeLevel | null {
  if (systolic === undefined || diastolic === undefined) return null;
  if (isHypertensiveCrisis(systolic, diastolic)) return "critical";
  return bloodPressureSeverity(systolic, diastolic) === "normal" ? "normal" : "borderline";
}
