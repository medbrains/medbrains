import type { z } from "zod";

// Blood pressure is two numbers — systolic (high) and diastolic (low) — and
// every screen that takes one validates it here, so a reading is accepted or
// refused the same way on the ward, in the ER and at a camp.

export const SYSTOLIC_RANGE = { min: 50, max: 300 } as const;
export const DIASTOLIC_RANGE = { min: 20, max: 200 } as const;

type Reading = number | null | undefined;

export interface BloodPressureErrors {
  systolic?: string;
  diastolic?: string;
}

function outOfRange(value: number, range: { min: number; max: number }): boolean {
  return !Number.isInteger(value) || value < range.min || value > range.max;
}

/** Errors for a reading; an empty object means it may be saved (blank is allowed). */
export function validateBloodPressure(systolic: Reading, diastolic: Reading): BloodPressureErrors {
  const hasSystolic = systolic != null;
  const hasDiastolic = diastolic != null;
  const errors: BloodPressureErrors = {};
  if (hasSystolic && outOfRange(systolic, SYSTOLIC_RANGE)) {
    errors.systolic = `Systolic must be a whole number, ${SYSTOLIC_RANGE.min}–${SYSTOLIC_RANGE.max} mmHg`;
  }
  if (hasDiastolic && outOfRange(diastolic, DIASTOLIC_RANGE)) {
    errors.diastolic = `Diastolic must be a whole number, ${DIASTOLIC_RANGE.min}–${DIASTOLIC_RANGE.max} mmHg`;
  }
  if (hasSystolic && !hasDiastolic) errors.diastolic = "Enter the diastolic (low) value too";
  if (hasDiastolic && !hasSystolic) errors.systolic = "Enter the systolic (high) value too";
  if (
    hasSystolic &&
    hasDiastolic &&
    !errors.systolic &&
    !errors.diastolic &&
    systolic <= diastolic
  ) {
    errors.diastolic = "Diastolic (low) must be lower than systolic (high)";
  }
  return errors;
}

export function isBloodPressureValid(systolic: Reading, diastolic: Reading): boolean {
  const errors = validateBloodPressure(systolic, diastolic);
  return !errors.systolic && !errors.diastolic;
}

/**
 * zod `superRefine` for a form object holding the pair under `systolicKey` and
 * `diastolicKey`. Accepts numbers or the numeric strings some forms keep.
 */
export function refineBloodPressure<S extends string, D extends string>(
  systolicKey: S,
  diastolicKey: D,
) {
  return (values: Partial<Record<S | D, unknown>>, ctx: z.RefinementCtx) => {
    const errors = validateBloodPressure(
      toReading(values[systolicKey]),
      toReading(values[diastolicKey]),
    );
    if (errors.systolic)
      ctx.addIssue({ code: "custom", path: [systolicKey], message: errors.systolic });
    if (errors.diastolic) {
      ctx.addIssue({ code: "custom", path: [diastolicKey], message: errors.diastolic });
    }
  };
}

/** A form value (number, numeric string, blank) as a reading. */
export function toReading(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Old free-text readings ("120/80") from before BP was two numbers. */
export function parseBloodPressureText(text: unknown): { systolic?: number; diastolic?: number } {
  const match = typeof text === "string" ? /^\s*(\d{2,3})\s*\/\s*(\d{2,3})\s*$/.exec(text) : null;
  return match ? { systolic: Number(match[1]), diastolic: Number(match[2]) } : {};
}

/** Hypertensive crisis: ≥180 systolic or ≥120 diastolic — treat now, not at the next round. */
export const HYPERTENSIVE_CRISIS = { systolic: 180, diastolic: 120 } as const;

export function isHypertensiveCrisis(systolic: Reading, diastolic: Reading): boolean {
  return (
    (systolic != null && systolic >= HYPERTENSIVE_CRISIS.systolic) ||
    (diastolic != null && diastolic >= HYPERTENSIVE_CRISIS.diastolic)
  );
}
