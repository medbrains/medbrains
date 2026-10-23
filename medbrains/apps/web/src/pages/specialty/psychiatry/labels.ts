import type { EctLaterality, PsychAdmissionCategory, RestraintType } from "@medbrains/types";

export const ADMISSION_CATEGORIES: { value: PsychAdmissionCategory; label: string }[] = [
  { value: "independent", label: "Independent (s.86)" },
  { value: "supported", label: "Supported (s.89)" },
  { value: "minor_supported", label: "Minor (s.87)" },
  { value: "emergency", label: "Emergency (s.94)" },
];

export const RESTRAINT_TYPES: { value: RestraintType; label: string }[] = [
  { value: "physical", label: "Physical restraint" },
  { value: "chemical", label: "Chemical restraint" },
  { value: "seclusion", label: "Seclusion" },
];

export const ECT_LATERALITY: { value: EctLaterality; label: string }[] = [
  { value: "bilateral", label: "Bilateral" },
  { value: "right_unilateral", label: "Right unilateral" },
  { value: "left_unilateral", label: "Left unilateral" },
];

export const MHRB_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "sent", label: "Sent" },
  { value: "acknowledged", label: "Acknowledged" },
];

export function admissionCategoryLabel(value: PsychAdmissionCategory): string {
  return ADMISSION_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export function labelOf<T extends string>(options: { value: T; label: string }[], value: T) {
  return options.find((o) => o.value === value)?.label ?? value;
}

export function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString() : "—";
}

export function formatDateTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "—";
}

/** Empty strings from a form become absent fields, not "" in the database. */
export function blankToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
