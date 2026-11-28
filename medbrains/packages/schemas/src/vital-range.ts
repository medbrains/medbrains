// One wording for a vital sign typed outside what its form accepts: refused, never rewritten.

export interface VitalRange {
  min: number;
  max: number;
}

/** The refusal shown beside a reading: "SpO2 must be between 50 and 100 %". */
export function vitalRangeMessage(label: string, range: VitalRange, unit = ""): string {
  return `${label} must be between ${range.min} and ${range.max}${unit ? ` ${unit}` : ""}`;
}

/** Why a typed reading cannot be saved; undefined when it can (blank is allowed). */
export function vitalRangeError(
  label: string,
  value: number | null | undefined,
  range: VitalRange,
  unit = "",
): string | undefined {
  if (value == null) return undefined;
  const inRange = Number.isFinite(value) && value >= range.min && value <= range.max;
  return inRange ? undefined : vitalRangeMessage(label, range, unit);
}
