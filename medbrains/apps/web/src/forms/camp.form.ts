import type {
  CampFollowupTypeFormValue,
  CampHistoryAnswerFormValue,
  CampIdProofTypeFormValue,
  CampTypeFormValue,
} from "@medbrains/schemas";
import {
  campFollowupTypeValues,
  campIdProofTypeValues,
  campTypeValues,
  numberFromFormValue,
  optionalIntegerFromFormValue,
  optionalNumberFromFormValue,
  optionalTextFromFormValue,
} from "@medbrains/schemas";

const campTypeLabels: Record<CampTypeFormValue, string> = {
  general_health: "General Health",
  blood_donation: "Blood Donation",
  vaccination: "Vaccination",
  eye_screening: "Eye Screening",
  dental: "Dental",
  awareness: "Awareness",
  specialized: "Specialized",
};

const campIdProofTypeLabels: Record<CampIdProofTypeFormValue, string> = {
  aadhar: "Aadhaar Card",
  pan: "PAN Card",
  passport: "Passport",
  voter_id: "Voter ID",
  driving_license: "Driving License",
  ration_card: "Ration Card",
  employee_id: "Employee ID",
  other: "Other",
};

const campFollowupTypeLabels: Record<CampFollowupTypeFormValue, string> = {
  phone_call: "Phone Call",
  hospital_visit: "Hospital Visit",
  home_visit: "Home Visit",
};

export const campTypeOptions = campTypeValues.map((value) => ({
  value,
  label: campTypeLabels[value],
}));

export const campIdProofTypeOptions = campIdProofTypeValues.map((value) => ({
  value,
  label: campIdProofTypeLabels[value],
}));

export const campFollowupTypeOptions = campFollowupTypeValues.map((value) => ({
  value,
  label: campFollowupTypeLabels[value],
}));

export function campNumberOrFallback(value: number | string, fallback: number): number {
  return numberFromFormValue(value, fallback);
}

export function campOptionalNumber(value: number | string): number | undefined {
  return optionalNumberFromFormValue(value);
}

export function campOptionalInteger(value: number | string): number | undefined {
  return optionalIntegerFromFormValue(value);
}

export function campOptionalText(value: string): string | undefined {
  return optionalTextFromFormValue(value);
}

/**
 * A camp history answer carries three states. Blank is "not asked", which is a
 * different fact from "asked and denied" — a screening camp must not record an
 * unasked question as a negative finding, so blank maps to `undefined` and
 * never to `false`.
 */
export function campHistoryAnswer(value: CampHistoryAnswerFormValue): boolean | undefined {
  if (value === "yes") return true;
  if (value === "no") return false;
  return undefined;
}

/** The reverse, for loading a saved screening back into the form. */
export function campHistoryFormValue(value: boolean | null): CampHistoryAnswerFormValue {
  if (value === true) return "yes";
  if (value === false) return "no";
  return "";
}

/**
 * ICD codes are typed as one comma- or space-separated string at the counter
 * and stored as an array. Uppercased because ICD-10 is, and de-duplicated
 * because a rushed typist repeats one.
 */
export function campIcdCodes(value: string): string[] | undefined {
  const codes = value
    .split(/[,\s]+/)
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);
  return codes.length > 0 ? [...new Set(codes)] : undefined;
}
