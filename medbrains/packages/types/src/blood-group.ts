import type { BloodGroup } from "./patient-registration";

/**
 * The eight ABO/Rh groups as the `blood_group` enum stores them, labelled the
 * way a bag or a wristband prints them. Forms send the value, never the label:
 * the enum rejects "A+".
 */
export const BLOOD_GROUP_OPTIONS: { value: Exclude<BloodGroup, "unknown">; label: string }[] = [
  { value: "a_positive", label: "A+" },
  { value: "a_negative", label: "A-" },
  { value: "b_positive", label: "B+" },
  { value: "b_negative", label: "B-" },
  { value: "ab_positive", label: "AB+" },
  { value: "ab_negative", label: "AB-" },
  { value: "o_positive", label: "O+" },
  { value: "o_negative", label: "O-" },
];

/** "a_positive" → "A+"; "unknown" → "Unknown"; anything else as given. */
export function bloodGroupLabel(value: string | null | undefined): string {
  if (!value) return "—";
  if (value === "unknown") return "Unknown";
  return BLOOD_GROUP_OPTIONS.find((o) => o.value === value)?.label ?? value;
}
