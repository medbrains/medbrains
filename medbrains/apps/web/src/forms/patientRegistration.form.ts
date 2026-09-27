import type {
  BloodGroupFormValue,
  GenderFormValue,
  MaritalStatusFormValue,
  PatientCategoryFormValue,
  ReferredByKindFormValue,
  RegistrationSourceFormValue,
  RegistrationTypeFormValue,
} from "@medbrains/schemas";
import { registrationCatalogue } from "@medbrains/schemas";
import type { Camp } from "@medbrains/types";

/**
 * A field's fixed choices, from the shared registration catalogue — the list
 * the server and both native apps accept. Typed to the form's value union,
 * which the catalogue's values are by construction.
 */
function catalogueOptions<T extends string>(fieldId: string): { value: T; label: string }[] {
  const field = registrationCatalogue.fields.find((f) => f.id === fieldId);
  if (field?.options.source !== "fixed") return [];
  return field.options.options.map((o) => ({ value: o.value as T, label: o.label }));
}

export const genderOptions = catalogueOptions<GenderFormValue>("gender");

export const bloodGroupOptions = catalogueOptions<BloodGroupFormValue>("blood_group");

export const maritalStatusOptions = catalogueOptions<MaritalStatusFormValue>("marital_status");

export const categoryOptions = catalogueOptions<PatientCategoryFormValue>("category");

export const registrationTypeOptions =
  catalogueOptions<RegistrationTypeFormValue>("registration_type");

export const registrationSourceOptions =
  catalogueOptions<RegistrationSourceFormValue>("registration_source");

export const referredByKindOptions = catalogueOptions<ReferredByKindFormValue>(
  "attributes.referred_by_kind",
);

export const prefixOptions = catalogueOptions<string>("prefix");

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
