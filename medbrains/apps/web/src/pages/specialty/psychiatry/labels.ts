import type { EctLaterality, PsychAdmissionCategory, RestraintType } from "@medbrains/types";

export const ADMISSION_CATEGORIES: { value: PsychAdmissionCategory; label: string }[] = [
  { value: "independent", label: "Independent (s.86)" },
  { value: "supported", label: "Supported (s.89)" },
  { value: "minor_supported", label: "Minor (s.87)" },
  { value: "supported_extended", label: "Supported beyond 30 days (s.90)" },
  { value: "emergency", label: "Emergency (s.94)" },
];

export const RESTRAINT_TYPES: { value: RestraintType; label: string }[] = [
  { value: "physical", label: "Physical restraint" },
  { value: "chemical", label: "Chemical restraint" },
  { value: "seclusion", label: "Seclusion (prohibited since MHCA s.97)" },
];

/** What may be started now: s.97(1) prohibits seclusion outright. */
export const RESTRAINT_TYPES_ALLOWED = RESTRAINT_TYPES.filter((t) => t.value !== "seclusion");

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

export const EXAMINER_ROLES = [
  { value: "psychiatrist", label: "Psychiatrist" },
  { value: "mental_health_professional", label: "Mental health professional" },
  { value: "medical_practitioner", label: "Medical practitioner" },
];

export const APPLICANTS = [
  { value: "self", label: "The patient (s.86)" },
  { value: "nominated_representative", label: "Nominated representative" },
  { value: "medical_practitioner", label: "Medical practitioner (emergency)" },
];

export const CRITERIA = [
  { value: "self_harm", label: "Recent or threatened harm to self" },
  { value: "harm_to_others", label: "Violence, or fear of violence, to others" },
  { value: "unable_to_self_care", label: "Unable to care for self, placing them at risk" },
  { value: "property_damage", label: "Serious damage to property (emergency only)" },
];

/** Shown beside the section on the admission form. */
export const SECTION_REQUIREMENTS: Record<string, string> = {
  independent:
    "Adult asking for admission, needing at most minimal support to decide. May leave at will.",
  minor_supported:
    "Applied for by the nominated representative. Two examinations in the last 7 days, one by a psychiatrist. Housed apart from adults with the representative or an attendant present. Board told within 72 hours.",
  supported:
    "Applied for by the nominated representative. A psychiatrist and a mental health professional or medical practitioner examined in the last 7 days. Up to 30 days. Board told within 3 days for a woman, 7 days otherwise.",
  supported_extended:
    "Two psychiatrists examined in the last 7 days. 90 days, then 120, then 180 per extension. Board told within 7 days and decides within 21.",
  emergency: "Up to 72 hours, only to prevent death or serious harm. No ECT.",
};

export const REP_BASES = [
  { value: "appointed_by_patient", label: "Appointed by the patient in writing" },
  { value: "advance_directive", label: "Named in the advance directive" },
  { value: "relative", label: "Relative" },
  { value: "care_giver", label: "Care-giver" },
  { value: "board_appointed", label: "Appointed by the Board" },
  { value: "temporary_ngo", label: "Temporary — registered organisation" },
  { value: "legal_guardian", label: "Legal guardian (minor)" },
];

export const CHALLENGE_GROUNDS = [
  { value: "not_free_will", label: "Not made of the patient's own free will" },
  { value: "not_intended_for_circumstances", label: "Not meant for the present circumstances" },
  { value: "not_well_informed", label: "Patient was not sufficiently well informed" },
  { value: "lacked_capacity", label: "Patient lacked capacity when making it" },
  { value: "contrary_to_law", label: "Contrary to law or the Constitution" },
];

export const APPLICANT_ROLES = [
  { value: "mental_health_professional", label: "Mental health professional" },
  { value: "relative", label: "Relative" },
  { value: "care_giver", label: "Care-giver" },
];
