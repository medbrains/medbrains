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

import { isHypertensiveCrisis, NEWS2_BANDS } from "@medbrains/schemas";
import type { BadgeTone } from "@/components/ui";

/**
 * Stage 2 hypertension, inclusive: 140/90 is stage 2, not "nearly".
 *
 * Source: Whelton et al., 2017 ACC/AHA Guideline for the Prevention, Detection,
 * Evaluation, and Management of High Blood Pressure in Adults, Table 6 (stage 2:
 * systolic >=140 or diastolic >=90). A separate rule from NEWS2, which grades
 * low systolic pressure only and has no diastolic row. Shown amber; a crisis
 * (`isHypertensiveCrisis`, >=180/120, the guideline's "hypertensive crisis")
 * is red.
 */
export const SYSTOLIC_HIGH = 140;
export const DIASTOLIC_HIGH = 90;

export type VitalGrade = "normal" | "low" | "high" | "critical_low" | "critical_high";

export interface VitalBands {
  normal: readonly [number, number];
  borderline: readonly [number, number];
}

/**
 * Adult bands: NEWS2, Royal College of Physicians 2017, Chart 1, SpO2 Scale 1,
 * generated from the table the server scores with
 * (`crates/medbrains-clinical-scores/src/ews/news2_table.rs`). A parameter's
 * NEWS2 score is 0 inside `normal`, 1-2 inside `borderline` (amber), 3 outside
 * it (red):
 *
 *   * respiratory rate: <=8 (3), 9-11 (1), 12-20 (0), 21-24 (2), >=25 (3);
 *   * SpO2 Scale 1: <=91 (3), 92-93 (2), 94-95 (1), >=96 (0). Scale 2 is for
 *     hypercapnic respiratory failure on a clinician's prescription, which the
 *     vitals form does not carry, so it is not used here;
 *   * systolic: <=90 (3), 91-100 (2), 101-110 (1), 111-219 (0), >=220 (3);
 *   * pulse: <=40 (3), 41-50 (1), 51-90 (0), 91-110 (1), 111-130 (2), >=131 (3);
 *   * temperature (°C): <=35.0 (3), 35.1-36.0 (1), 36.1-38.0 (0),
 *     38.1-39.0 (1), >=39.1 (2).
 *
 * NEWS2 is for adults (16 and over), not in pregnancy.
 */
export const ADULT_VITAL_BANDS = NEWS2_BANDS satisfies Record<string, VitalBands>;

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

/** How much a grade asks for: red over amber over normal. */
function urgency(grade: VitalGrade): number {
  if (grade === "normal") return 0;
  return grade === "low" || grade === "high" ? 1 : 2;
}

/**
 * Blood pressure grade from both numbers: the worse of NEWS2's systolic grade
 * and the ACC/AHA hypertension rule (`SYSTOLIC_HIGH`). The hypertension rule wins
 * a tie, so a high diastolic (110/90, 85/125) is never shown as "Low".
 */
export function bloodPressureGrade(
  systolic: number | null | undefined,
  diastolic: number | null | undefined,
): VitalGrade {
  const sys = numeric(systolic);
  const dia = numeric(diastolic);
  const news2 = gradeVital(sys, ADULT_VITAL_BANDS.systolic_bp);
  const hypertension = hypertensionGrade(sys, dia);
  return urgency(hypertension) >= urgency(news2) ? hypertension : news2;
}

/** The ACC/AHA 2017 rule alone: crisis red, stage 2 amber, else normal. */
function hypertensionGrade(sys: number | null, dia: number | null): VitalGrade {
  if (isHypertensiveCrisis(sys, dia)) return "critical_high";
  const stage2 = (sys !== null && sys >= SYSTOLIC_HIGH) || (dia !== null && dia >= DIASTOLIC_HIGH);
  return stage2 ? "high" : "normal";
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
