/**
 * When a vital sign should be shown as abnormal.
 *
 * Pulled out of the badge markup because these are clinical thresholds, not
 * styling. They were wrong in two ways while they lived inline, and neither
 * was visible in a component that renders a coloured pill:
 *
 *   * the boundary was exclusive — `systolic > 140` — so a reading of exactly
 *     140 rendered as normal. 140/90 is stage 2 hypertension by every
 *     definition in use here, including the one the camp analytics applies
 *     ("stage 2 elevation >=140/90");
 *   * diastolic was not consulted at all, so 130/95 — hypertensive on the
 *     diastolic alone — showed as normal.
 *
 * Both matter on real data: of 1,269 blood pressures recorded at the August
 * 2026 camp, 476 were stage 2, and readings sit on the boundary constantly
 * because clinicians round to the nearest 5 or 10.
 */

import { isHypertensiveCrisis } from "@medbrains/schemas";
import type { BadgeTone } from "@/components/ui";

/** Stage 2 hypertension. Inclusive — 140/90 is stage 2, not "nearly". */
export const SYSTOLIC_HIGH = 140;
export const DIASTOLIC_HIGH = 90;

/**
 * Systolic at or below this is critical.
 *
 * Source: Royal College of Physicians, National Early Warning Score (NEWS) 2
 * (2017) observation chart, where a systolic of 90 mmHg or less scores 3 — the
 * chart's red band, which alone calls for urgent clinical review. It is the
 * band this server already scores with (`score_sbp` in
 * `crates/medbrains-clinical-scores/src/news2.rs`). Adult band; NEWS2 does not
 * apply to children or in pregnancy. Before this, 70/40 was only "low", in
 * amber with no word. TO CONFIRM by the hospital's clinical lead.
 */
export const SYSTOLIC_CRITICAL_LOW = 90;

export type VitalGrade = "normal" | "low" | "high" | "critical_low" | "critical_high";

export interface VitalBands {
  normal: readonly [number, number];
  borderline: readonly [number, number];
}

/**
 * The entry form's adult bands, here so the doctor's view grades the same
 * reading the same way. (Temperature's depend on the unit: `getTemperatureConfig`.)
 */
export const ADULT_VITAL_BANDS = {
  pulse: { normal: [60, 100], borderline: [50, 120] },
  spo2: { normal: [95, 100], borderline: [90, 100] },
  respiratory_rate: { normal: [12, 20], borderline: [10, 25] },
} as const satisfies Record<string, VitalBands>;

/** Grades a reading: inside normal, inside borderline (low/high), or beyond it (critical). */
export function gradeVital(
  value: number | string | null | undefined,
  bands: VitalBands,
): VitalGrade {
  const reading = numeric(value);
  if (reading === null) return "normal";
  if (reading < bands.normal[0]) return reading >= bands.borderline[0] ? "low" : "critical_low";
  if (reading > bands.normal[1]) return reading <= bands.borderline[1] ? "high" : "critical_high";
  return "normal";
}

/**
 * Blood pressure grade from both numbers. Critical wins over high: a crisis
 * (180/120 and above) or a systolic of 90 or less cannot wait.
 */
export function bloodPressureGrade(
  systolic: number | null | undefined,
  diastolic: number | null | undefined,
): VitalGrade {
  const sys = numeric(systolic);
  const dia = numeric(diastolic);
  if (isHypertensiveCrisis(sys, dia)) return "critical_high";
  if (sys !== null && sys <= SYSTOLIC_CRITICAL_LOW) return "critical_low";
  if ((sys !== null && sys >= SYSTOLIC_HIGH) || (dia !== null && dia >= DIASTOLIC_HIGH)) {
    return "high";
  }
  return "normal";
}

/** The grade in words, so the colour never carries the meaning alone. */
export function gradeLabel(grade: VitalGrade): string {
  const words = grade.replace("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** How a grade is painted: critical in either direction is danger. */
export function gradeTone(grade: VitalGrade): BadgeTone {
  if (grade === "normal") return "primary";
  return grade === "low" || grade === "high" ? "warning" : "danger";
}

/**
 * A value that can be compared, or `null`.
 *
 * A missing reading is not a normal reading — 273 of the camp's 1,542
 * registrations have no systolic at all — so anything unparseable becomes
 * `null` and is excluded from the comparison rather than coerced to 0, which
 * would read as profound hypotension.
 */
function numeric(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
