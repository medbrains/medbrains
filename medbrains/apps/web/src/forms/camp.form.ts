import type {
  CampFollowupTypeFormValue,
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
