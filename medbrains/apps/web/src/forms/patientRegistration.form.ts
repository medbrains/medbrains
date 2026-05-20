import type {
  BloodGroupFormValue,
  GenderFormValue,
  MaritalStatusFormValue,
  PatientCategoryFormValue,
  ReferredByKindFormValue,
  RegistrationSourceFormValue,
  RegistrationTypeFormValue,
} from "@medbrains/schemas";
import type { Camp } from "@medbrains/types";

export const genderOptions: { value: GenderFormValue; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "unknown", label: "Unknown" },
];

export const bloodGroupOptions: { value: BloodGroupFormValue; label: string }[] = [
  { value: "a_positive", label: "A+" },
  { value: "a_negative", label: "A-" },
  { value: "b_positive", label: "B+" },
  { value: "b_negative", label: "B-" },
  { value: "ab_positive", label: "AB+" },
  { value: "ab_negative", label: "AB-" },
  { value: "o_positive", label: "O+" },
  { value: "o_negative", label: "O-" },
  { value: "unknown", label: "Unknown" },
];

export const maritalStatusOptions: { value: MaritalStatusFormValue; label: string }[] = [
  { value: "single", label: "Single" },
  { value: "married", label: "Married" },
  { value: "divorced", label: "Divorced" },
  { value: "widowed", label: "Widowed" },
  { value: "separated", label: "Separated" },
  { value: "domestic_partner", label: "Domestic partner" },
  { value: "unknown", label: "Unknown" },
];

export const categoryOptions: { value: PatientCategoryFormValue; label: string }[] = [
  { value: "general", label: "General" },
  { value: "private", label: "Private" },
  { value: "insurance", label: "Insurance" },
  { value: "pmjay", label: "PMJAY" },
  { value: "cghs", label: "CGHS" },
  { value: "esi", label: "ESI" },
  { value: "corporate", label: "Corporate" },
  { value: "staff", label: "Staff" },
  { value: "vip", label: "VIP" },
  { value: "mlc", label: "MLC" },
  { value: "free", label: "Free" },
  { value: "charity", label: "Charity" },
];

export const registrationTypeOptions: { value: RegistrationTypeFormValue; label: string }[] = [
  { value: "new", label: "New" },
  { value: "revisit", label: "Revisit" },
  { value: "transfer_in", label: "Transfer in" },
  { value: "referral", label: "Referral" },
  { value: "emergency", label: "Emergency" },
  { value: "camp", label: "Camp" },
  { value: "telemedicine", label: "Telemedicine" },
  { value: "pre_registration", label: "Pre-registration" },
];

export const registrationSourceOptions: { value: RegistrationSourceFormValue; label: string }[] = [
  { value: "walk_in", label: "Walk-in" },
  { value: "phone", label: "Phone" },
  { value: "online_portal", label: "Online portal" },
  { value: "mobile_app", label: "Mobile app" },
  { value: "kiosk", label: "Kiosk" },
  { value: "referral", label: "Referral" },
  { value: "ambulance", label: "Ambulance" },
  { value: "camp", label: "Camp" },
  { value: "telemedicine", label: "Telemedicine" },
];

export const referredByKindOptions: { value: ReferredByKindFormValue; label: string }[] = [
  { value: "doctor", label: "Doctor" },
  { value: "asha", label: "ASHA" },
  { value: "camp_worker", label: "Camp worker" },
  { value: "facility", label: "Facility / hospital" },
  { value: "ngo", label: "NGO" },
  { value: "self", label: "Self / walk-in" },
  { value: "other", label: "Other" },
];

export const prefixOptions = [
  { value: "Mr.", label: "Mr." },
  { value: "Mrs.", label: "Mrs." },
  { value: "Ms.", label: "Ms." },
  { value: "Miss", label: "Miss" },
  { value: "Master", label: "Master" },
  { value: "Baby", label: "Baby" },
  { value: "Baby of", label: "Baby of" },
  { value: "Dr.", label: "Dr." },
  { value: "Prof.", label: "Prof." },
  { value: "Shri", label: "Shri" },
  { value: "Smt.", label: "Smt." },
  { value: "Kumari", label: "Kumari" },
  { value: "Rev.", label: "Rev." },
  { value: "Mx.", label: "Mx." },
];

export function estimateDobFromAge(ageYears: number): Date {
  const today = new Date();
  return new Date(today.getFullYear() - ageYears, 0, 1);
}

export function trimOrUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function optionLabel<T extends { value: string; label: string }>(
  options: T[],
  value: string | undefined,
): string | undefined {
  return options.find((option) => option.value === value)?.label;
}

export function campVenueLabel(camp: Camp): string | undefined {
  const parts = [camp.venue_name, camp.venue_city, camp.venue_state, camp.venue_pincode].filter(
    (part): part is string => Boolean(part),
  );
  return parts.length > 0 ? parts.join(", ") : undefined;
}

export function campReferenceLabel(camp: Camp): string {
  return [camp.camp_code, camp.name, camp.scheduled_date.slice(0, 10), campVenueLabel(camp)]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}
