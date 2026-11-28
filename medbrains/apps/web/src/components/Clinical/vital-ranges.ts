import { isBloodPressureValid, type VitalRange, vitalRangeError } from "@medbrains/schemas";
import type { CreateVitalRequest } from "@medbrains/types";
import { useState } from "react";
import { useTranslation } from "react-i18next";

/** What the range rule needs to know about one of the recorder's number fields. */
interface RangedVital extends VitalRange {
  key: string;
  labelKey: string;
  unit: string;
  step: number;
}

/**
 * The range rule for the recorder's number fields. A reading typed outside its
 * range is kept as typed, refused in words and never saved: the inputs used to
 * clamp it on blur, so "SpO2 150" became a saved, normal-looking 100.
 */
export function useVitalRanges(vitals: RangedVital[], showAll: boolean) {
  const { t } = useTranslation("clinical");
  const [left, setLeft] = useState<ReadonlySet<string>>(new Set());
  /** Why this reading cannot be saved, in words; undefined when it can. */
  const error = (vital: RangedVital, value: number | undefined) =>
    vitalRangeError(t(vital.labelKey), value, vital, vital.unit);
  return {
    /** The reading to grade; none when it is impossible, so "150" gets no status. */
    gradable: (vital: RangedVital, value: number | undefined) =>
      error(vital, value) ? undefined : value,
    canSave: (values: Record<string, number | undefined>) =>
      isBloodPressureValid(values.systolic_bp, values.diastolic_bp) &&
      !vitals.some((vital) => error(vital, values[vital.key])),
    fieldProps: (vital: RangedVital, value: number | undefined) => ({
      min: vital.min,
      max: vital.max,
      step: vital.step,
      clampBehavior: "none" as const,
      onBlur: () => setLeft((prev) => new Set(prev).add(vital.key)),
      error: showAll || left.has(vital.key) ? error(vital, value) : undefined,
    }),
  };
}

/**
 * The recorder's values as held by a form that embeds it without its buttons,
 * with whether they may be saved. Returns `[vitals, valid, onChange]`.
 */
export function useRecorderVitals(): [
  CreateVitalRequest,
  boolean,
  (vitals: CreateVitalRequest, valid: boolean) => void,
] {
  const [state, setState] = useState({ vitals: {} as CreateVitalRequest, valid: true });
  return [state.vitals, state.valid, (vitals, valid) => setState({ vitals, valid })];
}
