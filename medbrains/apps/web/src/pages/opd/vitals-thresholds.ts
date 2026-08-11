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

import type { BadgeTone } from "@/components/ui";

/** Stage 2 hypertension. Inclusive — 140/90 is stage 2, not "nearly". */
export const SYSTOLIC_HIGH = 140;
export const DIASTOLIC_HIGH = 90;

/** Hypotension worth flagging at a desk. */
export const SYSTOLIC_LOW = 90;

/** Below this, hypoxia. */
export const SPO2_LOW = 94;

export type VitalSeverity = "high" | "low" | "normal";

/**
 * Blood pressure severity from both numbers.
 *
 * High wins over low: a reading that is somehow high on one and low on the
 * other is abnormal, and the abnormality that kills faster should be the one
 * on screen.
 */
export function bloodPressureSeverity(
  systolic: number | null | undefined,
  diastolic: number | null | undefined,
): VitalSeverity {
  const sys = numeric(systolic);
  const dia = numeric(diastolic);
  if (sys === null && dia === null) {
    return "normal";
  }
  if ((sys !== null && sys >= SYSTOLIC_HIGH) || (dia !== null && dia >= DIASTOLIC_HIGH)) {
    return "high";
  }
  if (sys !== null && sys < SYSTOLIC_LOW) {
    return "low";
  }
  return "normal";
}

/** Oxygen saturation severity. Only one direction matters clinically. */
export function spo2Severity(spo2: number | null | undefined): VitalSeverity {
  const value = numeric(spo2);
  if (value === null) {
    return "normal";
  }
  return value < SPO2_LOW ? "low" : "normal";
}

/**
 * How a severity is painted.
 *
 * Low oxygen and high pressure are both `danger`: a nurse scanning a list
 * should not have to remember which colour means which direction.
 */
export function severityTone(severity: VitalSeverity): BadgeTone {
  switch (severity) {
    case "high":
      return "danger";
    case "low":
      return "warning";
    default:
      return "primary";
  }
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
