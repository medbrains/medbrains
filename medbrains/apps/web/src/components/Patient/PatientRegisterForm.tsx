import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Grid,
  NumberInput,
  Select,
  Stepper,
  TagsInput,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import type {
  PatientRegistrationFormInput,
  PatientRegistrationInitialValues,
} from "@medbrains/schemas";
import { patientRegistrationFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  Camp,
  CreatePatientRequest,
  DepartmentRow,
  Facility,
  PharmacyCatalog,
  SetupUser,
  TerminologySearchResult,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCalendarMonth } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Icd11CodeSelect } from "@/components/Clinical/Icd11CodeSelect";
import { ClinicalForm, FormRow, FormSection } from "@/components/ClinicalForm";
import {
  AllergyField,
  buildPhoneCountryOptions,
  CountryPhoneInput,
  defaultPhoneCountryCode,
  detectPhoneCountryCode,
  formatPhoneWithCountryCode,
  stripPhoneCountryCode,
} from "@/components/inputs";
import {
  bloodGroupOptions,
  campReferenceLabel,
  campVenueLabel,
  categoryOptions,
  estimateDobFromAge,
  genderOptions,
  maritalStatusOptions,
  optionLabel,
  prefixOptions,
  referredByKindOptions,
  registrationSourceOptions,
  registrationTypeOptions,
  trimOrUndefined,
} from "@/forms/patientRegistration.form";
import { lookupsService } from "@/services/lookups.service";
import { patientsService } from "@/services/patients.service";
import { tenantSettingsService } from "@/services/tenantSettings.service";
import { AbhaLinkPanel } from "./AbhaLinkPanel";

interface PatientRegisterFormProps {
  isSubmitting?: boolean;
  mode?: "create" | "edit";
  submitLabel?: string;
  onSubmit: (
    req: CreatePatientRequest,
    linkedServices?: PatientRegistrationLinkedServicesOptions,
  ) => void | Promise<void>;
  onCancel: () => void;
  initialValues?: PatientRegistrationInitialValues;
}

function splitDrugAllergyTags(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinDrugAllergyTags(values: string[]): string {
  return values
    .map((item) => item.trim())
    .filter(Boolean)
    .join(", ");
}

function drugAllergyOptionLabel(item: PharmacyCatalog): string {
  return [
    item.name,
    item.generic_name,
    item.drug_schedule ? `Schedule ${item.drug_schedule}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

interface LabelOption {
  value: string;
  label: string;
}

const PATIENT_REGISTRATION_ERROR_KEYS: Record<string, string> = {
  "First name must be at most 100 characters": "validation.firstNameMax",
  "Last name must be at most 100 characters": "validation.lastNameMax",
  "Phone must contain only digits, +, -, spaces, and parentheses": "validation.phonePattern",
  "Invalid email address": "validation.invalidEmail",
  "ABHA number must be 14 digits": "validation.abhaNumberDigits",
  "Aadhaar must be a 12 digit number": "validation.aadhaarDigits",
  "First name is required": "validation.firstNameRequired",
  "Last name is required": "validation.lastNameRequired",
  "Phone is required": "validation.phoneRequired",
  "Enter age or pick date of birth": "validation.ageOrDobRequired",
  "Gender is required": "validation.genderRequired",
  "Confirm allergy state (Not asked / No known / Known)": "validation.allergyStateRequired",
  "Select a camp reference or enter the village / school camp name":
    "validation.campReferenceRequired",
  "Referral source is required": "validation.referralSourceRequired",
  "Enter who referred the patient": "validation.referredByRequired",
  "MLC number is required for medico-legal patients": "validation.mlcNumberRequired",
  "Select a department to send the patient to OPD": "validation.departmentForOpdRequired",
  "Select an existing camp before sending camp patient to OPD": "validation.existingCampRequired",
  "Enter a valid whole number": "validation.validWholeNumber",
};

function optionKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function translateEnumOptions<T extends LabelOption>(
  options: readonly T[],
  keyPrefix: string,
  t: TFunction,
): T[] {
  return options.map((option) => ({
    ...option,
    label: t(`${keyPrefix}.${option.value}`, { defaultValue: option.label }),
  }));
}

function translateCodeOptions<T extends LabelOption>(
  options: readonly T[],
  keyPrefix: string,
  t: TFunction,
): T[] {
  return options.map((option) => ({
    ...option,
    label: t(`${keyPrefix}.${optionKey(option.value)}`, { defaultValue: option.label }),
  }));
}

function translatedError(t: TFunction, message: string | undefined): string | undefined {
  if (!message) {
    return undefined;
  }
  const key = PATIENT_REGISTRATION_ERROR_KEYS[message];
  return key ? t(key) : t("validation.generic");
}

function calculateAgeYears(dateOfBirth: Date): number {
  const today = new Date();
  let years = today.getFullYear() - dateOfBirth.getFullYear();
  const birthdayThisYear = new Date(
    today.getFullYear(),
    dateOfBirth.getMonth(),
    dateOfBirth.getDate(),
  );
  if (birthdayThisYear > today) {
    years -= 1;
  }
  return Math.max(0, years);
}

function parseDatePickerValue(value: Date | string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDatePickerValue(value: Date | string | null | undefined): string | null {
  const date = parseDatePickerValue(value);
  if (!date) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function agePart(value: number, unit: "day" | "month" | "year", t: TFunction): string {
  return t(`registrationForm.age.${unit}`, { count: value });
}

function formatAgeAsOfToday(value: Date | string | null | undefined, t: TFunction): string | null {
  const dateOfBirth = parseDatePickerValue(value);
  if (!dateOfBirth) {
    return null;
  }

  const today = new Date();
  const birthDate = new Date(
    dateOfBirth.getFullYear(),
    dateOfBirth.getMonth(),
    dateOfBirth.getDate(),
  );
  const currentDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (birthDate > currentDate) {
    return null;
  }

  let years = currentDate.getFullYear() - birthDate.getFullYear();
  let months = currentDate.getMonth() - birthDate.getMonth();
  let days = currentDate.getDate() - birthDate.getDate();

  if (days < 0) {
    months -= 1;
    days += new Date(currentDate.getFullYear(), currentDate.getMonth(), 0).getDate();
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const parts: string[] = [];
  if (years > 0) {
    parts.push(agePart(years, "year", t));
  }
  if (months > 0) {
    parts.push(agePart(months, "month", t));
  }
  if (years === 0 && days > 0) {
    parts.push(agePart(days, "day", t));
  }

  return parts.length > 0 ? parts.join(" ") : t("registrationForm.age.zeroDays");
}

function ageHintAsOfToday(
  dateOfBirth: Date | string | null | undefined,
  ageYears: number | undefined,
  isEstimated: boolean,
  t: TFunction,
): string {
  const exactAge = formatAgeAsOfToday(dateOfBirth, t);
  if (exactAge) {
    return isEstimated
      ? t("registrationForm.hint.ageAsOfTodayEstimated", { age: exactAge })
      : t("registrationForm.hint.ageAsOfToday", { age: exactAge });
  }

  if (typeof ageYears === "number") {
    return t("registrationForm.hint.ageEstimatedUntilDob", {
      age: agePart(ageYears, "year", t),
    });
  }

  return t("registrationForm.hint.selectDob");
}

export interface PatientRegistrationLinkedServicesOptions {
  createOpdVisit: boolean;
  openOpdAfterRegistration: boolean;
}

export function PatientRegisterForm({
  isSubmitting,
  mode = "create",
  submitLabel,
  onSubmit,
  onCancel,
  initialValues,
}: PatientRegisterFormProps) {
  const { t } = useTranslation("patients");
  const isEdit = mode === "edit";
  const resolvedSubmitLabel = submitLabel ?? (isEdit ? t("actions.save") : t("actions.register"));
  const initialPhoneCountryCode = initialValues?.phone
    ? detectPhoneCountryCode(initialValues.phone)
    : null;
  const initialAlternatePhoneCountryCode = initialValues?.phone_secondary
    ? detectPhoneCountryCode(initialValues.phone_secondary)
    : null;
  // "Send to OPD queue" is checked BY DEFAULT, and the visit it creates needs
  // `opd.visit.create` — which registering a patient does not imply. Without it
  // the patient was registered, the queue step failed into a warning, and the
  // patient simply was not in the queue. Every time, because it is the default.
  const canCreateOpdVisit = useHasPermission(P.OPD.VISIT_CREATE);
  const {
    register,
    control,
    setValue,
    getValues,
    trigger,
    clearErrors,
    watch,
    handleSubmit,
    formState: { errors },
  } = useForm<PatientRegistrationFormInput>({
    resolver: zodResolver(patientRegistrationFormSchema),
    defaultValues: {
      gender: initialValues?.gender ?? "unknown",
      prefix: initialValues?.prefix,
      first_name: initialValues?.first_name ?? "",
      middle_name: initialValues?.middle_name,
      last_name: initialValues?.last_name ?? "",
      is_unknown_patient: initialValues?.is_unknown_patient ?? false,
      suffix: initialValues?.suffix,
      date_of_birth: initialValues?.date_of_birth ? new Date(initialValues.date_of_birth) : null,
      blood_group: initialValues?.blood_group,
      marital_status: initialValues?.marital_status,
      religion: initialValues?.religion,
      occupation: initialValues?.occupation,
      phone: stripPhoneCountryCode(
        initialValues?.phone,
        initialPhoneCountryCode ?? defaultPhoneCountryCode(null),
      ),
      phone_secondary: stripPhoneCountryCode(
        initialValues?.phone_secondary,
        initialAlternatePhoneCountryCode ?? defaultPhoneCountryCode(null),
      ),
      email: initialValues?.email ?? "",
      father_name: initialValues?.father_name,
      guardian_name: initialValues?.guardian_name,
      guardian_relation: initialValues?.guardian_relation,
      category: initialValues?.category,
      registration_type: initialValues?.registration_type ?? "new",
      registration_source: initialValues?.registration_source ?? "walk_in",
      referred_by_kind: initialValues?.referred_by_kind ?? "self",
      referred_by_user_id: initialValues?.referred_by_user_id,
      referred_by_name: initialValues?.referred_by_name,
      referred_by_phone: initialValues?.referred_by_phone,
      referred_by_facility: initialValues?.referred_by_facility,
      department_id: initialValues?.department_id,
      consultant_id: initialValues?.consultant_id,
      clinical_unit: initialValues?.clinical_unit,
      camp_id: initialValues?.camp_id,
      camp_name: initialValues?.camp_name,
      initial_diagnosis_text: initialValues?.initial_diagnosis_text,
      icd11_code: initialValues?.icd11_code,
      allergy_status: initialValues?.allergy_status ?? "not_asked_yet",
      known_allergies: initialValues?.known_allergies,
      drug_allergies: initialValues?.drug_allergies,
      // `??` only falls through when the caller passes nothing, so a caller
      // that hard-sets create_opd_visit — the camp registration route does —
      // used to beat the permission check. The checkbox is hidden without
      // opd.visit.create, so there was no way to unset it either: the visit
      // call went out and 403'd into a swallowed queueWarning, leaving a
      // patient registered and silently not queued.
      create_opd_visit: (initialValues?.create_opd_visit ?? !isEdit) && canCreateOpdVisit,
      open_opd_after_registration:
        (initialValues?.open_opd_after_registration ?? !isEdit) && canCreateOpdVisit,
    },
  });
  const [activeStep, setActiveStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [selectedIcd11, setSelectedIcd11] = useState<TerminologySearchResult | null>(null);
  const [dobEstimated, setDobEstimated] = useState(Boolean(initialValues?.is_dob_estimated));
  const [phoneCountryCodeOverride, setPhoneCountryCodeOverride] = useState(initialPhoneCountryCode);
  const [alternatePhoneCountryCodeOverride, setAlternatePhoneCountryCodeOverride] = useState(
    initialAlternatePhoneCountryCode,
  );
  const [drugAllergySearch, setDrugAllergySearch] = useState("");
  const dateOfBirthValue = watch("date_of_birth");
  const ageYearsValue = watch("age_years");
  const drugAllergiesValue = watch("drug_allergies");
  const trimmedDrugAllergySearch = drugAllergySearch.trim();
  const dateOfBirthAgeHint = ageHintAsOfToday(dateOfBirthValue, ageYearsValue, dobEstimated, t);
  const fieldError = (message: string | undefined) => translatedError(t, message);

  const { data: departments = [] } = useQuery<DepartmentRow[]>({
    queryKey: ["setup-departments"],
    queryFn: () => patientsService.listDepartments(),
    staleTime: 5 * 60 * 1000,
  });
  const { data: doctors = [] } = useQuery<SetupUser[]>({
    queryKey: ["setup-doctors"],
    queryFn: () => patientsService.listDoctors(),
    staleTime: 5 * 60 * 1000,
  });
  const { data: camps = [] } = useQuery<Camp[]>({
    queryKey: ["camp-camps", "patient-registration"],
    queryFn: () => patientsService.listCamps({ status: "active" }),
    staleTime: 5 * 60 * 1000,
  });
  const { data: facilities = [] } = useQuery<Facility[]>({
    queryKey: ["setup-facilities", "patient-registration"],
    queryFn: () => patientsService.listFacilities(),
    staleTime: 5 * 60 * 1000,
  });
  const { data: tenant } = useQuery({
    queryKey: ["setup-tenant"],
    queryFn: () => tenantSettingsService.getTenant(),
    staleTime: 60_000,
  });
  const { data: geoCountries = [] } = useQuery({
    queryKey: ["geo-countries"],
    queryFn: () => tenantSettingsService.geoCountries(),
    staleTime: 5 * 60_000,
  });
  const { data: drugAllergyCatalog = [], isFetching: isDrugAllergyCatalogLoading } = useQuery<
    PharmacyCatalog[]
  >({
    queryKey: ["pharmacy-catalog", "patient-registration-drug-allergies", trimmedDrugAllergySearch],
    queryFn: () => lookupsService.listPharmacyCatalog({ search: trimmedDrugAllergySearch }),
    enabled: trimmedDrugAllergySearch.length >= 2,
    staleTime: 60_000,
  });

  const departmentOptions = useMemo(
    () =>
      departments
        .filter((department) => department.is_active)
        .map((department) => ({
          value: department.id,
          label: `${department.name} (${department.code})`,
        })),
    [departments],
  );
  const consultantOptions = useMemo(
    () =>
      doctors
        .filter((doctor) => doctor.is_active)
        .map((doctor) => ({
          value: doctor.id,
          label: [doctor.full_name, doctor.specialization, doctor.medical_registration_number]
            .filter(Boolean)
            .join(" · "),
        })),
    [doctors],
  );
  const campOptions = useMemo(
    () =>
      camps
        .filter((camp) => camp.status !== "cancelled")
        .map((camp) => ({
          value: camp.id,
          label: campReferenceLabel(camp),
        })),
    [camps],
  );
  const campNameOptions = useMemo(() => {
    const options = new Set<string>();
    for (const camp of camps) {
      options.add(camp.name);
      const venue = campVenueLabel(camp);
      if (venue) options.add(venue);
    }
    return [...options].sort();
  }, [camps]);
  const referredByNameOptions = useMemo(
    () =>
      doctors
        .filter((doctor) => doctor.is_active)
        .map((doctor) => doctor.full_name)
        .sort(),
    [doctors],
  );
  const referredByFacilityOptions = useMemo(() => {
    const options = new Set<string>();
    for (const facility of facilities) {
      if (facility.is_active) options.add(facility.name);
    }
    for (const camp of camps) {
      options.add(camp.name);
      const venue = campVenueLabel(camp);
      if (venue) options.add(venue);
    }
    return [...options].sort();
  }, [camps, facilities]);
  const phoneDialOptions = useMemo(
    () => buildPhoneCountryOptions(geoCountries, tenant?.country_id),
    [geoCountries, tenant?.country_id],
  );
  const drugAllergyOptions = useMemo(() => {
    const options = new Set<string>([t("registrationForm.options.drugAllergy.nkda")]);
    for (const value of splitDrugAllergyTags(drugAllergiesValue)) {
      options.add(value);
    }
    for (const item of drugAllergyCatalog) {
      if (item.is_active) {
        options.add(drugAllergyOptionLabel(item));
      }
    }
    return [...options].sort();
  }, [drugAllergyCatalog, drugAllergiesValue, t]);
  const localizedGenderOptions = useMemo(
    () => translateEnumOptions(genderOptions, "options.gender", t),
    [t],
  );
  const localizedBloodGroupOptions = useMemo(
    () => translateEnumOptions(bloodGroupOptions, "options.bloodGroup", t),
    [t],
  );
  const localizedMaritalStatusOptions = useMemo(
    () => translateEnumOptions(maritalStatusOptions, "options.maritalStatus", t),
    [t],
  );
  const localizedCategoryOptions = useMemo(
    () => translateEnumOptions(categoryOptions, "options.category", t),
    [t],
  );
  const localizedRegistrationTypeOptions = useMemo(
    () => translateEnumOptions(registrationTypeOptions, "options.registrationType", t),
    [t],
  );
  const localizedRegistrationSourceOptions = useMemo(
    () => translateEnumOptions(registrationSourceOptions, "options.registrationSource", t),
    [t],
  );
  const localizedReferredByKindOptions = useMemo(
    () => translateEnumOptions(referredByKindOptions, "options.referredByKind", t),
    [t],
  );
  const localizedPrefixOptions = useMemo(
    () => translateCodeOptions(prefixOptions, "options.prefix", t),
    [t],
  );
  const allergyStatusOptions = useMemo(
    () => [
      { value: "not_asked_yet", label: t("options.allergyStatus.not_asked_yet") },
      { value: "no_known_allergies", label: t("options.allergyStatus.no_known_allergies") },
      { value: "known_allergies", label: t("options.allergyStatus.known_allergies") },
    ],
    [t],
  );
  const roomClassOptions = useMemo(
    () => [
      { value: "general", label: t("options.roomClass.general") },
      { value: "semi_private", label: t("options.roomClass.semi_private") },
      { value: "private", label: t("options.roomClass.private") },
      { value: "deluxe", label: t("options.roomClass.deluxe") },
      { value: "suite", label: t("options.roomClass.suite") },
      { value: "icu", label: t("options.roomClass.icu") },
    ],
    [t],
  );
  const dietaryPreferenceOptions = useMemo(
    () => [
      { value: "vegetarian", label: t("options.dietaryPreference.vegetarian") },
      { value: "vegan", label: t("options.dietaryPreference.vegan") },
      { value: "non_veg", label: t("options.dietaryPreference.non_veg") },
      { value: "jain", label: t("options.dietaryPreference.jain") },
      { value: "halal", label: t("options.dietaryPreference.halal") },
      { value: "kosher", label: t("options.dietaryPreference.kosher") },
      { value: "diabetic", label: t("options.dietaryPreference.diabetic") },
    ],
    [t],
  );
  const referredByKind = watch("referred_by_kind");
  const createOpdVisit = watch("create_opd_visit");
  const abhaNumber = watch("abha_number");
  const abhaAddress = watch("abha_address");
  const abhaLinkStatus = abhaNumber?.trim() || abhaAddress?.trim() ? "ready" : "manual";
  const tenantCountryPhoneCode = tenant?.phone_code
    ? tenant.phone_code
    : geoCountries.find((country) => country.id === tenant?.country_id)?.phone_code;
  const deploymentPhoneCountryCode = defaultPhoneCountryCode(tenantCountryPhoneCode);
  const phoneCountryCode = phoneCountryCodeOverride ?? deploymentPhoneCountryCode;
  const alternatePhoneCountryCode = alternatePhoneCountryCodeOverride ?? deploymentPhoneCountryCode;

  const buildPatientRequest = (values: PatientRegistrationFormInput): CreatePatientRequest => {
    const dateOfBirth =
      values.date_of_birth ??
      (typeof values.age_years === "number" ? estimateDobFromAge(values.age_years) : null);
    const isDobEstimated =
      Boolean(dateOfBirth) &&
      (dobEstimated || (!values.date_of_birth && typeof values.age_years === "number"));
    const departmentName =
      optionLabel(departmentOptions, values.department_id)?.replace(/\s+\([^)]*\)$/, "") ??
      undefined;
    const consultantName = optionLabel(consultantOptions, values.consultant_id);
    const address: Record<string, unknown> = {};
    if (values.line1) address.line1 = values.line1;
    if (values.line2) address.line2 = values.line2;
    if (values.landmark) address.landmark = values.landmark;
    if (values.city) address.city = values.city;
    if (values.district) address.district = values.district;
    if (values.state) address.state = values.state;
    if (values.postal_code) address.postal_code = values.postal_code;
    if (values.country) address.country = values.country;

    const attributes: Record<string, unknown> = {};
    const allergies = values.known_allergies?.trim();
    attributes.allergy_status = values.allergy_status ?? "not_asked_yet";
    attributes.no_known_allergies = values.allergy_status === "no_known_allergies";
    if (allergies) attributes.known_allergies = allergies;
    const drugAllergies = values.drug_allergies?.trim();
    if (drugAllergies) attributes.drug_allergies = drugAllergies;
    // Next-of-kin & emergency-contact: collected separately because the
    // immediate caregiver is often not the same person we'd call in a
    // crisis (e.g. domestic violence, estranged family).
    if (values.next_of_kin_name) {
      attributes.next_of_kin = {
        name: values.next_of_kin_name,
        relation: values.next_of_kin_relation,
        phone: values.next_of_kin_phone,
      };
    }
    if (values.emergency_contact_name) {
      attributes.emergency_contact = {
        name: values.emergency_contact_name,
        relation: values.emergency_contact_relation,
        phone: values.emergency_contact_phone,
      };
    }
    if (values.preferred_room_class) attributes.preferred_room_class = values.preferred_room_class;
    if (values.dietary_preference) attributes.dietary_preference = values.dietary_preference;
    if (values.dietary_restrictions) attributes.dietary_restrictions = values.dietary_restrictions;
    if (values.religious_observances)
      attributes.religious_observances = values.religious_observances;
    if (values.language_preference) attributes.language_preference = values.language_preference;
    if (values.primary_physician_id) attributes.primary_physician_id = values.primary_physician_id;
    if (values.primary_physician_name)
      attributes.primary_physician_name = values.primary_physician_name;
    if (values.referred_by_kind) attributes.referred_by_kind = values.referred_by_kind;
    if (values.referred_by_user_id) attributes.referred_by_user_id = values.referred_by_user_id;
    if (values.secondary_insurance_provider) {
      attributes.secondary_insurance = {
        provider: values.secondary_insurance_provider,
        policy_no: values.secondary_insurance_policy_no,
      };
    }
    if (values.attendant_passes_count) {
      attributes.attendant_passes_count = Number(values.attendant_passes_count);
    }

    const req: CreatePatientRequest = {
      first_name: values.is_unknown_patient ? "Unknown" : values.first_name,
      last_name: values.is_unknown_patient ? "Patient" : values.last_name,
      gender: values.gender,
      phone: formatPhoneWithCountryCode(values.phone, phoneCountryCode) ?? "",
      date_of_birth: dateOfBirth ? dateOfBirth.toISOString().slice(0, 10) : null,
      is_dob_estimated: isDobEstimated,
      email: values.email || null,
      prefix: values.prefix || undefined,
      middle_name: values.middle_name || undefined,
      suffix: values.suffix || undefined,
      father_name: values.father_name || undefined,
      guardian_name: values.guardian_name || undefined,
      guardian_relation: values.guardian_relation || undefined,
      marital_status: values.marital_status,
      religion: values.religion || undefined,
      blood_group: values.blood_group,
      occupation: values.occupation || undefined,
      phone_secondary: formatPhoneWithCountryCode(
        values.phone_secondary,
        alternatePhoneCountryCode,
      ),
      category: values.category,
      registration_type: values.registration_type,
      registration_source: values.registration_source,
      financial_class: values.financial_class,
      abha_number: trimOrUndefined(values.abha_number),
      abha_address: trimOrUndefined(values.abha_address),
      aadhaar_number: trimOrUndefined(values.aadhaar_number),
      referred_by_name: trimOrUndefined(values.referred_by_name),
      referred_by_phone: trimOrUndefined(values.referred_by_phone),
      referred_by_facility: trimOrUndefined(values.referred_by_facility),
      department_id: values.department_id || undefined,
      department_name: departmentName,
      consultant_id: values.consultant_id || undefined,
      consultant_name: consultantName,
      clinical_unit: trimOrUndefined(values.clinical_unit),
      camp_id: trimOrUndefined(values.camp_id),
      camp_name: trimOrUndefined(values.camp_name),
      initial_diagnosis_text: trimOrUndefined(values.initial_diagnosis_text),
      icd11_code: trimOrUndefined(values.icd11_code),
      icd11_display: selectedIcd11?.display,
      icd11_source_url: selectedIcd11?.source_url ?? undefined,
      icd11_source_version: selectedIcd11?.source_version ?? undefined,
      icd11_provider_mode: selectedIcd11?.provider_mode,
      is_medico_legal: values.is_medico_legal || undefined,
      mlc_number: values.mlc_number || undefined,
      is_vip: values.is_vip || undefined,
      is_unknown_patient: values.is_unknown_patient || undefined,
      address: Object.keys(address).length > 0 ? address : null,
      attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
    };
    return req;
  };

  const submit = (values: PatientRegistrationFormInput) => {
    const req = buildPatientRequest(values);
    void onSubmit(req, {
      createOpdVisit: values.create_opd_visit ?? false,
      openOpdAfterRegistration: values.open_opd_after_registration ?? false,
    });
  };

  // Step 1 (intake) fields validated by the zod schema's superRefine.
  // We hand react-hook-form's `trigger` the field list so error messages
  // come from the validator, not from a separate ad-hoc function.
  const STEP1_FIELDS: Array<keyof PatientRegistrationFormInput> = [
    "first_name",
    "last_name",
    "phone",
    "age_years",
    "date_of_birth",
    "gender",
    "camp_id",
    "department_id",
    "allergy_status",
  ];

  const validateImmediateStep = async (): Promise<boolean> => {
    const ok = await trigger(STEP1_FIELDS);
    return ok;
  };

  const saveNow = async () => {
    if (!(await validateImmediateStep())) {
      setStepError(t("registrationForm.error.fillHighlightedBeforeSaving"));
      return;
    }
    setStepError(null);
    const values = getValues();
    const req = buildPatientRequest(values);
    void onSubmit(req, {
      createOpdVisit: values.create_opd_visit ?? false,
      openOpdAfterRegistration: values.open_opd_after_registration ?? false,
    });
  };

  const goNext = async () => {
    if (activeStep === 0 && !(await validateImmediateStep())) {
      setStepError(t("registrationForm.error.completeHighlightedBeforeContinuing"));
      return;
    }
    setStepError(null);
    const fieldsByStep: Array<Array<keyof PatientRegistrationFormInput>> = [
      [],
      ["email", "abha_number", "aadhaar_number", "referred_by_phone"],
      ["line1", "city", "next_of_kin_phone", "emergency_contact_phone", "mlc_number"],
      ["category", "financial_class", "attendant_passes_count"],
      [],
    ];
    const fields = fieldsByStep[activeStep] ?? [];
    if (fields.length > 0) {
      const ok = await trigger(fields);
      if (!ok) return;
    }
    setActiveStep((step) => Math.min(step + 1, 4));
  };
  const goBack = () => setActiveStep((step) => Math.max(0, step - 1));
  const lastStep = 4;
  const isFirstStep = activeStep === 0;
  const isLastStep = activeStep === lastStep;

  const stepLabels = [
    t("registrationForm.steps.intake"),
    t("registrationForm.steps.contactIdentity"),
    t("registrationForm.steps.familyAddressSafety"),
    t("registrationForm.steps.preferencesBilling"),
    t("registrationForm.steps.review"),
  ];

  return (
    <Box w="100%" pb={84}>
      <ClinicalForm
        title={isEdit ? t("registrationForm.title.edit") : t("registrationForm.title.create")}
        titleAccent={isEdit ? undefined : t("registrationForm.titleAccent.opd")}
        subtitle={
          isEdit ? t("registrationForm.subtitle.edit") : t("registrationForm.subtitle.create")
        }
        onSubmit={handleSubmit(submit)}
        footerMeta={
          isEdit ? t("registrationForm.footer.edit") : t("registrationForm.footer.create")
        }
        actions={
          <>
            {isFirstStep ? (
              <Button variant="default" onClick={onCancel} type="button">
                {t("actions.cancel")}
              </Button>
            ) : (
              <Button variant="default" onClick={goBack} type="button">
                {t("actions.back")}
              </Button>
            )}
            {!isEdit && !isLastStep && (
              <Button variant="light" onClick={saveNow} loading={isSubmitting} type="button">
                {t("actions.saveNow")}
              </Button>
            )}
            {!isLastStep && (
              <Button onClick={goNext} type="button">
                {t("actions.next")}
              </Button>
            )}
            {isLastStep && (
              <Button type="submit" loading={isSubmitting}>
                {isEdit ? resolvedSubmitLabel : t("actions.registerComplete")}
              </Button>
            )}
          </>
        }
      >
        {stepError && (
          <Alert
            color="red"
            variant="light"
            mb="sm"
            onClose={() => setStepError(null)}
            withCloseButton
          >
            {stepError}
          </Alert>
        )}

        {activeStep === 0 && (
          <FormSection num="01" name={t("registrationForm.section.identity")}>
            <FormRow label={t("registrationForm.row.unknownPatient")}>
              <Controller
                control={control}
                name="is_unknown_patient"
                render={({ field }) => (
                  <Checkbox
                    aria-label={t("registrationForm.aria.unknownPatient")}
                    label={t("registrationForm.label.unknownPatientSkipName")}
                    checked={field.value ?? false}
                    onChange={(event) => {
                      const checked = event.currentTarget.checked;
                      field.onChange(checked);
                      if (checked) {
                        clearErrors(["first_name", "last_name"]);
                      }
                    }}
                  />
                )}
              />
            </FormRow>
            <FormRow label={t("registrationForm.row.name")} required>
              <Grid>
                <Grid.Col span={{ base: 12, sm: 2 }}>
                  <Controller
                    control={control}
                    name="prefix"
                    render={({ field }) => (
                      <Select
                        aria-label={t("registrationForm.aria.prefix")}
                        placeholder={t("registrationForm.placeholder.prefix")}
                        data={localizedPrefixOptions}
                        value={field.value ?? null}
                        onChange={(v) => field.onChange(v ?? undefined)}
                        searchable
                        clearable
                      />
                    )}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <TextInput
                    aria-label={t("registrationForm.aria.firstName")}
                    placeholder={t("registrationForm.placeholder.firstName")}
                    error={fieldError(errors.first_name?.message)}
                    {...register("first_name")}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 3 }}>
                  <TextInput
                    aria-label={t("registrationForm.aria.middleName")}
                    placeholder={t("registrationForm.placeholder.middleName")}
                    {...register("middle_name")}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 3 }}>
                  <TextInput
                    aria-label={t("registrationForm.aria.lastName")}
                    placeholder={t("registrationForm.placeholder.lastName")}
                    error={fieldError(errors.last_name?.message)}
                    {...register("last_name")}
                  />
                </Grid.Col>
              </Grid>
            </FormRow>

            <FormRow label={t("registrationForm.row.ageDob")}>
              <Grid>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <Controller
                    control={control}
                    name="age_years"
                    render={({ field }) => {
                      // If DOB is set but age_years didn't sync (e.g. a stale
                      // Controller render), derive it from the watched DOB so
                      // the input never silently shows 0.
                      const derivedAge = dateOfBirthValue
                        ? calculateAgeYears(
                            dateOfBirthValue instanceof Date
                              ? dateOfBirthValue
                              : (parseDatePickerValue(dateOfBirthValue) ?? new Date(0)),
                          )
                        : undefined;
                      const displayValue =
                        typeof field.value === "number" ? field.value : (derivedAge ?? "");
                      return (
                        <NumberInput
                          aria-label={t("registrationForm.aria.ageYears")}
                          placeholder={t("registrationForm.placeholder.ageYears")}
                          min={0}
                          max={125}
                          value={displayValue}
                          onChange={(value) => {
                            const age = typeof value === "number" ? value : undefined;
                            field.onChange(age);
                            if (typeof age === "number") {
                              setDobEstimated(true);
                              setValue("date_of_birth", estimateDobFromAge(age), {
                                shouldDirty: true,
                                shouldTouch: true,
                                shouldValidate: true,
                              });
                            } else if (dobEstimated) {
                              setDobEstimated(false);
                              setValue("date_of_birth", null, {
                                shouldDirty: true,
                                shouldTouch: true,
                                shouldValidate: true,
                              });
                            }
                          }}
                        />
                      );
                    }}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 8 }}>
                  <Controller
                    control={control}
                    name="date_of_birth"
                    render={({ field }) => (
                      <DatePickerInput
                        aria-label={t("registrationForm.aria.dateOfBirth")}
                        placeholder={t("registrationForm.placeholder.dateOfBirth")}
                        valueFormat="DD MMM YYYY"
                        value={toDatePickerValue(field.value)}
                        onChange={(v) => {
                          const date = parseDatePickerValue(v);
                          setDobEstimated(false);
                          field.onChange(date);
                          if (date) {
                            setValue("age_years", calculateAgeYears(date), {
                              shouldDirty: true,
                              shouldTouch: true,
                              shouldValidate: true,
                            });
                          } else {
                            setValue("age_years", undefined, {
                              shouldDirty: true,
                              shouldTouch: true,
                              shouldValidate: true,
                            });
                          }
                        }}
                        clearable
                        defaultLevel="decade"
                        maxDate={new Date()}
                        leftSection={<IconCalendarMonth size={16} />}
                      />
                    )}
                  />
                </Grid.Col>
                <Grid.Col span={12}>
                  <Text size="xs" c="yellow.7" fw={500}>
                    {dateOfBirthAgeHint} {t("registrationForm.hint.ageDobInstruction")}
                  </Text>
                </Grid.Col>
              </Grid>
            </FormRow>

            <FormRow label={t("registrationForm.row.sexBloodGroup")} required>
              <Grid>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Controller
                    control={control}
                    name="gender"
                    render={({ field }) => (
                      <Select
                        aria-label={t("registrationForm.aria.gender")}
                        data={localizedGenderOptions}
                        value={field.value}
                        onChange={(v) => v && field.onChange(v)}
                        error={fieldError(errors.gender?.message)}
                      />
                    )}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Controller
                    control={control}
                    name="blood_group"
                    render={({ field }) => (
                      <Select
                        aria-label={t("registrationForm.aria.bloodGroup")}
                        placeholder={t("options.bloodGroup.unknown")}
                        data={localizedBloodGroupOptions}
                        value={field.value ?? null}
                        onChange={(v) => field.onChange(v ?? undefined)}
                        clearable
                      />
                    )}
                  />
                </Grid.Col>
              </Grid>
            </FormRow>
          </FormSection>
        )}

        {activeStep === 0 && (
          <FormSection num="02" name={t("registrationForm.section.phone")}>
            <FormRow label={t("registrationForm.row.phone")} required>
              <Grid>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Controller
                    control={control}
                    name="phone"
                    render={({ field }) => (
                      <CountryPhoneInput
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        countryCode={phoneCountryCode}
                        onCountryCodeChange={setPhoneCountryCodeOverride}
                        countryOptions={phoneDialOptions}
                        countryAriaLabel={t("registrationForm.aria.primaryPhoneCountry")}
                        numberAriaLabel={t("registrationForm.aria.primaryPhone")}
                        placeholder={t("registrationForm.placeholder.primaryPhone")}
                        error={fieldError(errors.phone?.message)}
                      />
                    )}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Controller
                    control={control}
                    name="phone_secondary"
                    render={({ field }) => (
                      <CountryPhoneInput
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        countryCode={alternatePhoneCountryCode}
                        onCountryCodeChange={setAlternatePhoneCountryCodeOverride}
                        countryOptions={phoneDialOptions}
                        countryAriaLabel={t("registrationForm.aria.alternatePhoneCountry")}
                        numberAriaLabel={t("registrationForm.aria.alternatePhone")}
                        placeholder={t("registrationForm.placeholder.alternatePhone")}
                        error={fieldError(errors.phone_secondary?.message)}
                      />
                    )}
                  />
                </Grid.Col>
              </Grid>
            </FormRow>
          </FormSection>
        )}

        {activeStep === 1 && (
          <FormSection num="02" name={t("registrationForm.section.email")}>
            <FormRow label={t("registrationForm.row.email")}>
              <TextInput
                aria-label={t("registrationForm.aria.email")}
                type="email"
                placeholder={t("registrationForm.placeholder.email")}
                error={fieldError(errors.email?.message)}
                {...register("email")}
              />
            </FormRow>
          </FormSection>
        )}

        {activeStep === 1 && (
          <FormSection num="03" name={t("registrationForm.section.digitalIdentity")}>
            <FormRow label={t("registrationForm.row.abha")}>
              <AbhaLinkPanel
                status={abhaLinkStatus}
                numberField={
                  <TextInput
                    aria-label={t("registrationForm.aria.abhaNumber")}
                    placeholder={t("registrationForm.placeholder.abhaNumber")}
                    error={fieldError(errors.abha_number?.message)}
                    {...register("abha_number")}
                  />
                }
                addressField={
                  <TextInput
                    aria-label={t("registrationForm.aria.abhaAddress")}
                    placeholder={t("registrationForm.placeholder.abhaAddress")}
                    error={fieldError(errors.abha_address?.message)}
                    {...register("abha_address")}
                  />
                }
              />
            </FormRow>
            <FormRow label={t("registrationForm.row.aadhaar")}>
              <TextInput
                aria-label={t("registrationForm.aria.aadhaarNumber")}
                placeholder={t("registrationForm.placeholder.aadhaarNumber")}
                description={t("registrationForm.description.aadhaarStorage")}
                error={fieldError(errors.aadhaar_number?.message)}
                {...register("aadhaar_number")}
              />
            </FormRow>
          </FormSection>
        )}

        {activeStep === 0 && (
          <FormSection num="04" name={t("registrationForm.section.registrationContext")}>
            <FormRow label={t("registrationForm.row.patientTypeSource")}>
              <Grid>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Controller
                    control={control}
                    name="registration_type"
                    render={({ field }) => (
                      <Select
                        aria-label={t("registrationForm.aria.registrationType")}
                        data={localizedRegistrationTypeOptions}
                        value={field.value ?? null}
                        onChange={(v) => {
                          field.onChange(v ?? undefined);
                          if (v === "camp") {
                            setValue("registration_source", "camp", {
                              shouldDirty: true,
                              shouldValidate: true,
                            });
                          }
                        }}
                        clearable
                      />
                    )}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Controller
                    control={control}
                    name="registration_source"
                    render={({ field }) => (
                      <Select
                        aria-label={t("registrationForm.aria.registrationSource")}
                        data={localizedRegistrationSourceOptions}
                        value={field.value ?? null}
                        onChange={(v) => field.onChange(v ?? undefined)}
                        clearable
                      />
                    )}
                  />
                </Grid.Col>
              </Grid>
            </FormRow>
            <FormRow label={t("registrationForm.row.campReference")}>
              <Grid>
                <Grid.Col span={{ base: 12, sm: 5 }}>
                  <Controller
                    control={control}
                    name="camp_id"
                    render={({ field }) => (
                      <Select
                        aria-label={t("registrationForm.aria.campReference")}
                        placeholder={t("registrationForm.placeholder.campReference")}
                        data={campOptions}
                        value={field.value ?? null}
                        error={fieldError(errors.camp_id?.message)}
                        onChange={(value) => {
                          field.onChange(value ?? undefined);
                          const camp = camps.find((item) => item.id === value);
                          if (camp) {
                            setValue("camp_name", camp.name, {
                              shouldDirty: true,
                              shouldValidate: true,
                            });
                            setValue("registration_type", "camp", {
                              shouldDirty: true,
                              shouldValidate: true,
                            });
                            setValue("registration_source", "camp", {
                              shouldDirty: true,
                              shouldValidate: true,
                            });
                            const venue = campVenueLabel(camp);
                            if (venue) {
                              setValue("referred_by_facility", venue, {
                                shouldDirty: true,
                                shouldValidate: true,
                              });
                            }
                            if (camp.organizing_department_id) {
                              setValue("department_id", camp.organizing_department_id, {
                                shouldDirty: true,
                                shouldValidate: true,
                              });
                            }
                          }
                        }}
                        searchable
                        clearable
                      />
                    )}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 7 }}>
                  <Controller
                    control={control}
                    name="camp_name"
                    render={({ field }) => (
                      <Autocomplete
                        aria-label={t("registrationForm.aria.campName")}
                        placeholder={t("registrationForm.placeholder.campName")}
                        data={campNameOptions}
                        value={field.value ?? ""}
                        onBlur={field.onBlur}
                        onChange={(value) => field.onChange(value || undefined)}
                        clearable
                      />
                    )}
                  />
                </Grid.Col>
              </Grid>
            </FormRow>
          </FormSection>
        )}

        {activeStep === 1 && (
          <FormSection num="04" name={t("registrationForm.section.referrals")}>
            <FormRow label={t("registrationForm.row.referredBy")}>
              <Grid>
                <Grid.Col span={{ base: 12, sm: 3 }}>
                  <Controller
                    control={control}
                    name="referred_by_kind"
                    render={({ field }) => (
                      <Select
                        aria-label={t("registrationForm.aria.referralType")}
                        placeholder={t("registrationForm.placeholder.referralType")}
                        data={localizedReferredByKindOptions}
                        value={field.value ?? null}
                        onChange={(value) => {
                          field.onChange(value ?? undefined);
                          if (value !== "doctor") {
                            setValue("referred_by_user_id", undefined, {
                              shouldDirty: true,
                              shouldValidate: true,
                            });
                          }
                        }}
                        clearable
                      />
                    )}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <Controller
                    control={control}
                    name="referred_by_user_id"
                    render={({ field }) => (
                      <Select
                        aria-label={t("registrationForm.aria.referringDoctor")}
                        placeholder={
                          referredByKind === "doctor"
                            ? t("registrationForm.placeholder.selectDoctor")
                            : t("registrationForm.placeholder.optionalDoctorLink")
                        }
                        data={consultantOptions}
                        value={field.value ?? null}
                        onChange={(value) => {
                          field.onChange(value ?? undefined);
                          const doctor = doctors.find((item) => item.id === value);
                          if (doctor) {
                            setValue("referred_by_name", doctor.full_name, {
                              shouldDirty: true,
                              shouldValidate: true,
                            });
                          }
                        }}
                        searchable
                        clearable
                        disabled={referredByKind !== "doctor"}
                      />
                    )}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 5 }}>
                  <Controller
                    control={control}
                    name="referred_by_name"
                    render={({ field }) => (
                      <Autocomplete
                        aria-label={t("registrationForm.aria.referredBy")}
                        placeholder={t("registrationForm.placeholder.referredByName")}
                        data={referredByNameOptions}
                        value={field.value ?? ""}
                        onBlur={field.onBlur}
                        onChange={(value) => field.onChange(value || undefined)}
                        clearable
                      />
                    )}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <TextInput
                    aria-label={t("registrationForm.aria.referredByPhone")}
                    placeholder={t("registrationForm.placeholder.phone")}
                    error={fieldError(errors.referred_by_phone?.message)}
                    {...register("referred_by_phone")}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 8 }}>
                  <Controller
                    control={control}
                    name="referred_by_facility"
                    render={({ field }) => (
                      <Autocomplete
                        aria-label={t("registrationForm.aria.referredByFacility")}
                        placeholder={t("registrationForm.placeholder.referredByFacility")}
                        data={referredByFacilityOptions}
                        value={field.value ?? ""}
                        onBlur={field.onBlur}
                        onChange={(value) => field.onChange(value || undefined)}
                        clearable
                      />
                    )}
                  />
                </Grid.Col>
              </Grid>
            </FormRow>
          </FormSection>
        )}

        {activeStep === 0 && (
          <FormSection num="05" name={t("registrationForm.section.clinicalOwnership")}>
            <FormRow label={t("registrationForm.row.departmentConsultant")}>
              <Grid>
                <Grid.Col span={{ base: 12, sm: 5 }}>
                  <Controller
                    control={control}
                    name="department_id"
                    render={({ field }) => (
                      <Select
                        aria-label={t("registrationForm.aria.department")}
                        placeholder={t("registrationForm.placeholder.department")}
                        data={departmentOptions}
                        value={field.value ?? null}
                        onChange={(v) => field.onChange(v ?? undefined)}
                        error={fieldError(errors.department_id?.message)}
                        searchable
                        clearable
                      />
                    )}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 5 }}>
                  <Controller
                    control={control}
                    name="consultant_id"
                    render={({ field }) => (
                      <Select
                        aria-label={t("registrationForm.aria.concernedConsultant")}
                        placeholder={t("registrationForm.placeholder.concernedConsultant")}
                        data={consultantOptions}
                        value={field.value ?? null}
                        onChange={(v) => field.onChange(v ?? undefined)}
                        searchable
                        clearable
                      />
                    )}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 2 }}>
                  <TextInput
                    aria-label={t("registrationForm.aria.clinicalUnit")}
                    placeholder={t("registrationForm.placeholder.clinicalUnit")}
                    {...register("clinical_unit")}
                  />
                </Grid.Col>
              </Grid>
            </FormRow>
            <FormRow label={t("registrationForm.row.provisionalDiagnosis")}>
              <Grid>
                <Grid.Col span={{ base: 12, sm: 7 }}>
                  <TextInput
                    aria-label={t("registrationForm.aria.initialDiagnosis")}
                    placeholder={t("registrationForm.placeholder.initialDiagnosis")}
                    {...register("initial_diagnosis_text")}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 5 }}>
                  <Controller
                    control={control}
                    name="icd11_code"
                    render={({ field }) => (
                      <Icd11CodeSelect
                        aria-label={t("registrationForm.aria.icd11Code")}
                        placeholder={t("registrationForm.placeholder.icd11Code")}
                        value={field.value ?? null}
                        onChange={(value) => {
                          field.onChange(value ?? undefined);
                          if (!value) {
                            setSelectedIcd11(null);
                            setValue("initial_diagnosis_text", "", {
                              shouldDirty: true,
                              shouldValidate: true,
                            });
                          }
                        }}
                        onSelectResult={(result) => {
                          setSelectedIcd11(result);
                          setValue("initial_diagnosis_text", result.display, {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                        }}
                        error={fieldError(errors.icd11_code?.message)}
                      />
                    )}
                  />
                </Grid.Col>
              </Grid>
            </FormRow>
            {!isEdit && canCreateOpdVisit && (
              <FormRow label={t("registrationForm.row.linkedServices")}>
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Controller
                      control={control}
                      name="create_opd_visit"
                      render={({ field }) => (
                        <Checkbox
                          aria-label={t("registrationForm.aria.sendToOpdQueue")}
                          label={t("registrationForm.label.sendToOpdQueue")}
                          checked={field.value ?? false}
                          onChange={(event) => {
                            field.onChange(event.currentTarget.checked);
                            if (!event.currentTarget.checked) {
                              setValue("open_opd_after_registration", false, {
                                shouldDirty: true,
                                shouldValidate: true,
                              });
                            }
                          }}
                        />
                      )}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Controller
                      control={control}
                      name="open_opd_after_registration"
                      render={({ field }) => (
                        <Checkbox
                          aria-label={t("registrationForm.aria.openOpdAfterRegistration")}
                          label={t("registrationForm.label.openOpdAfterQueue")}
                          checked={(field.value ?? false) && Boolean(createOpdVisit)}
                          disabled={!createOpdVisit}
                          onChange={(event) => field.onChange(event.currentTarget.checked)}
                        />
                      )}
                    />
                  </Grid.Col>
                </Grid>
              </FormRow>
            )}
          </FormSection>
        )}

        {activeStep === 0 && (
          <FormSection num="06" name={t("registrationForm.section.allergyStatus")}>
            <FormRow label={t("registrationForm.row.allergyState")} required>
              <Controller
                control={control}
                name="allergy_status"
                render={({ field }) => (
                  <Select
                    aria-label={t("registrationForm.aria.allergyStatus")}
                    data={allergyStatusOptions}
                    value={field.value ?? "not_asked_yet"}
                    onChange={(v) => field.onChange(v ?? "not_asked_yet")}
                    error={fieldError(errors.allergy_status?.message)}
                  />
                )}
              />
            </FormRow>
          </FormSection>
        )}

        {activeStep === 2 && (
          <FormSection num="07" name={t("registrationForm.section.safetyFlags")}>
            <FormRow label={t("registrationForm.row.safetyFlags")}>
              <Grid>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <Controller
                    control={control}
                    name="is_medico_legal"
                    render={({ field }) => (
                      <Checkbox
                        aria-label={t("registrationForm.aria.medicoLegalCase")}
                        label={t("registrationForm.label.medicoLegalCase")}
                        checked={field.value ?? false}
                        onChange={(event) => field.onChange(event.currentTarget.checked)}
                      />
                    )}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <TextInput
                    aria-label={t("registrationForm.aria.mlcNumber")}
                    placeholder={t("registrationForm.placeholder.mlcNumber")}
                    error={fieldError(errors.mlc_number?.message)}
                    {...register("mlc_number")}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <Controller
                    control={control}
                    name="is_vip"
                    render={({ field }) => (
                      <Checkbox
                        aria-label={t("registrationForm.aria.vipPatient")}
                        label={t("registrationForm.label.vipPatient")}
                        checked={field.value ?? false}
                        onChange={(event) => field.onChange(event.currentTarget.checked)}
                      />
                    )}
                  />
                </Grid.Col>
              </Grid>
            </FormRow>
          </FormSection>
        )}

        {activeStep === 3 && (
          <FormSection num="08" name={t("registrationForm.section.allergyDetails")}>
            {/* Both fields are optional — many patients have no known
              allergies. Empty = "not yet recorded"; the prescriber
              still gets a banner before issuing meds, but registration
              is not blocked for routine OPD intake. */}
            <FormRow label={t("registrationForm.row.generalAllergies")}>
              <Controller
                control={control}
                name="known_allergies"
                render={({ field }) => {
                  const v = (field.value ?? "").trim();
                  const has = v.length > 0;
                  return (
                    <AllergyField
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      placeholder={t("registrationForm.placeholder.generalAllergies")}
                      severity="watch"
                      badgeLabel={
                        has
                          ? t("registrationForm.badge.logged")
                          : t("registrationForm.badge.optional")
                      }
                      hint={t("registrationForm.hint.generalAllergies")}
                    />
                  );
                }}
              />
            </FormRow>
            <FormRow label={t("registrationForm.row.drugAllergies")}>
              <Controller
                control={control}
                name="drug_allergies"
                render={({ field }) => {
                  const values = splitDrugAllergyTags(field.value);
                  const has = values.length > 0;
                  return (
                    <TagsInput
                      value={values}
                      onChange={(nextValues) => field.onChange(joinDrugAllergyTags(nextValues))}
                      data={drugAllergyOptions}
                      searchValue={drugAllergySearch}
                      onSearchChange={setDrugAllergySearch}
                      placeholder={t("registrationForm.placeholder.drugAllergies")}
                      clearable
                      splitChars={[",", ";"]}
                      acceptValueOnBlur
                      loading={isDrugAllergyCatalogLoading}
                      description={
                        has
                          ? t("registrationForm.description.drugAllergiesSaved")
                          : t("registrationForm.description.drugAllergiesEntry")
                      }
                      error={fieldError(errors.drug_allergies?.message)}
                    />
                  );
                }}
              />
            </FormRow>
          </FormSection>
        )}

        {activeStep === 2 && (
          <FormSection num="09" name={t("registrationForm.section.familyBackground")}>
            <FormRow label={t("registrationForm.row.fatherName")}>
              <TextInput {...register("father_name")} />
            </FormRow>
            <FormRow label={t("registrationForm.row.guardian")}>
              <Grid>
                <Grid.Col span={{ base: 12, sm: 8 }}>
                  <TextInput
                    placeholder={t("registrationForm.placeholder.name")}
                    {...register("guardian_name")}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <TextInput
                    placeholder={t("registrationForm.placeholder.relation")}
                    {...register("guardian_relation")}
                  />
                </Grid.Col>
              </Grid>
            </FormRow>
            <FormRow label={t("registrationForm.row.maritalReligionOccupation")}>
              <Grid>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <Controller
                    control={control}
                    name="marital_status"
                    render={({ field }) => (
                      <Select
                        placeholder={t("registrationForm.placeholder.marital")}
                        data={localizedMaritalStatusOptions}
                        value={field.value ?? null}
                        onChange={(v) => field.onChange(v ?? undefined)}
                        clearable
                      />
                    )}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <TextInput
                    placeholder={t("registrationForm.placeholder.religion")}
                    {...register("religion")}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <TextInput
                    placeholder={t("registrationForm.placeholder.occupation")}
                    {...register("occupation")}
                  />
                </Grid.Col>
              </Grid>
            </FormRow>
          </FormSection>
        )}

        {activeStep === 2 && (
          <FormSection num="10" name={t("registrationForm.section.address")}>
            <FormRow label={t("registrationForm.row.addressLine1")}>
              <Textarea
                placeholder={t("registrationForm.placeholder.addressLine1")}
                autosize
                minRows={2}
                {...register("line1")}
              />
            </FormRow>
            <FormRow label={t("registrationForm.row.addressLine2")}>
              <TextInput
                placeholder={t("registrationForm.placeholder.addressLine2")}
                {...register("line2")}
              />
            </FormRow>
            <FormRow label={t("registrationForm.row.landmark")}>
              <TextInput
                placeholder={t("registrationForm.placeholder.landmark")}
                {...register("landmark")}
              />
            </FormRow>
            <FormRow label={t("registrationForm.row.cityDistrictStatePin")}>
              <Grid>
                <Grid.Col span={{ base: 12, sm: 3 }}>
                  <TextInput
                    placeholder={t("registrationForm.placeholder.city")}
                    {...register("city")}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 3 }}>
                  <TextInput
                    placeholder={t("registrationForm.placeholder.district")}
                    {...register("district")}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 2 }}>
                  <TextInput
                    placeholder={t("registrationForm.placeholder.state")}
                    {...register("state")}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 6, sm: 2 }}>
                  <TextInput
                    placeholder={t("registrationForm.placeholder.pin")}
                    {...register("postal_code")}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 6, sm: 2 }}>
                  <TextInput
                    defaultValue={t("registrationForm.default.country")}
                    {...register("country")}
                  />
                </Grid.Col>
              </Grid>
            </FormRow>
          </FormSection>
        )}

        {activeStep === 2 && (
          <FormSection num="11" name={t("registrationForm.section.nextOfKinEmergency")}>
            <FormRow label={t("registrationForm.row.nextOfKin")}>
              <Grid>
                <Grid.Col span={{ base: 12, sm: 5 }}>
                  <TextInput
                    placeholder={t("registrationForm.placeholder.fullName")}
                    {...register("next_of_kin_name")}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 6, sm: 3 }}>
                  <TextInput
                    placeholder={t("registrationForm.placeholder.relation")}
                    {...register("next_of_kin_relation")}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 6, sm: 4 }}>
                  <TextInput
                    placeholder={t("registrationForm.placeholder.phone")}
                    error={fieldError(errors.next_of_kin_phone?.message)}
                    {...register("next_of_kin_phone")}
                  />
                </Grid.Col>
              </Grid>
            </FormRow>
            <FormRow label={t("registrationForm.row.emergencyContact")}>
              <Grid>
                <Grid.Col span={{ base: 12, sm: 5 }}>
                  <TextInput
                    placeholder={t("registrationForm.placeholder.fullName")}
                    {...register("emergency_contact_name")}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 6, sm: 3 }}>
                  <TextInput
                    placeholder={t("registrationForm.placeholder.relation")}
                    {...register("emergency_contact_relation")}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 6, sm: 4 }}>
                  <TextInput
                    placeholder={t("registrationForm.placeholder.phone")}
                    error={fieldError(errors.emergency_contact_phone?.message)}
                    {...register("emergency_contact_phone")}
                  />
                </Grid.Col>
              </Grid>
            </FormRow>
          </FormSection>
        )}

        {activeStep === 3 && (
          <FormSection num="12" name={t("registrationForm.section.preferencesCareContinuity")}>
            <FormRow label={t("registrationForm.row.preferredWardRoomClass")}>
              <Controller
                control={control}
                name="preferred_room_class"
                render={({ field }) => (
                  <Select
                    placeholder={t("registrationForm.placeholder.noPreference")}
                    data={roomClassOptions}
                    value={field.value ?? null}
                    onChange={(v) => field.onChange(v ?? undefined)}
                    clearable
                  />
                )}
              />
            </FormRow>
            <FormRow label={t("registrationForm.row.dietaryPreference")}>
              <Grid>
                <Grid.Col span={{ base: 12, sm: 5 }}>
                  <Controller
                    control={control}
                    name="dietary_preference"
                    render={({ field }) => (
                      <Select
                        placeholder={t("registrationForm.placeholder.noPreference")}
                        data={dietaryPreferenceOptions}
                        value={field.value ?? null}
                        onChange={(v) => field.onChange(v ?? undefined)}
                        clearable
                      />
                    )}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 7 }}>
                  <TextInput
                    placeholder={t("registrationForm.placeholder.dietaryRestrictions")}
                    {...register("dietary_restrictions")}
                  />
                </Grid.Col>
              </Grid>
            </FormRow>
            <FormRow label={t("registrationForm.row.religiousObservances")}>
              <TextInput
                placeholder={t("registrationForm.placeholder.religiousObservances")}
                {...register("religious_observances")}
              />
            </FormRow>
            <FormRow label={t("registrationForm.row.preferredLanguage")}>
              <TextInput
                placeholder={t("registrationForm.placeholder.preferredLanguage")}
                {...register("language_preference")}
              />
            </FormRow>
            <FormRow label={t("registrationForm.row.primaryPhysician")}>
              <Grid>
                <Grid.Col span={{ base: 12, sm: 7 }}>
                  <TextInput
                    placeholder={t("registrationForm.placeholder.name")}
                    {...register("primary_physician_name")}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 5 }}>
                  <TextInput
                    placeholder={t("registrationForm.placeholder.inHouseStaffId")}
                    {...register("primary_physician_id")}
                  />
                </Grid.Col>
              </Grid>
            </FormRow>
          </FormSection>
        )}

        {activeStep === 3 && (
          <FormSection num="13" name={t("registrationForm.section.insuranceVisitorPass")}>
            <FormRow label={t("registrationForm.row.secondaryInsurance")}>
              <Grid>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <TextInput
                    placeholder={t("registrationForm.placeholder.secondaryInsuranceProvider")}
                    {...register("secondary_insurance_provider")}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <TextInput
                    placeholder={t("registrationForm.placeholder.policyMemberNumber")}
                    {...register("secondary_insurance_policy_no")}
                  />
                </Grid.Col>
              </Grid>
            </FormRow>
            <FormRow label={t("registrationForm.row.defaultAttendantPassCount")}>
              <TextInput
                type="number"
                placeholder={t("registrationForm.placeholder.attendantPassCount")}
                error={fieldError(errors.attendant_passes_count?.message)}
                {...register("attendant_passes_count")}
              />
            </FormRow>
          </FormSection>
        )}

        {activeStep === 3 && (
          <FormSection num="14" name={t("registrationForm.section.registration")}>
            <FormRow label={t("registrationForm.row.patientCategory")}>
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <Select
                    aria-label={t("registrationForm.aria.patientCategory")}
                    placeholder={t("options.category.general")}
                    data={localizedCategoryOptions}
                    value={field.value ?? null}
                    onChange={(v) => field.onChange(v ?? undefined)}
                    clearable
                  />
                )}
              />
            </FormRow>
          </FormSection>
        )}

        {activeStep === 4 && <ReviewSummary values={watch()} dobEstimated={dobEstimated} />}
      </ClinicalForm>

      <Box
        style={{
          position: "fixed",
          bottom: 0,
          // Align to the content area, not the whole viewport — clear the nav rail.
          left: "var(--app-shell-navbar-width, 0px)",
          right: 0,
          zIndex: 190,
          padding: "12px 24px",
          background: "var(--mb-bg-content, var(--mantine-color-body))",
          borderTop: "1px solid var(--mb-border-subtle)",
          boxShadow: "0 -2px 12px rgba(0, 0, 0, 0.08)",
          overflowX: "auto",
        }}
      >
        <Stepper
          active={activeStep}
          onStepClick={(idx) => {
            if (idx <= activeStep) {
              setActiveStep(idx);
              setStepError(null);
            }
          }}
          allowNextStepsSelect={false}
          size="sm"
          styles={{ root: { minWidth: "min-content" } }}
        >
          {stepLabels.map((label) => (
            <Stepper.Step key={label} label={label} />
          ))}
        </Stepper>
      </Box>
    </Box>
  );
}

interface ReviewSummaryProps {
  values: PatientRegistrationFormInput;
  dobEstimated: boolean;
}

function ReviewSummary({ values, dobEstimated }: ReviewSummaryProps) {
  const { t } = useTranslation("patients");
  const name = values.is_unknown_patient
    ? t("registrationForm.summary.unknownPatient")
    : [values.prefix, values.first_name, values.middle_name, values.last_name, values.suffix]
        .filter(Boolean)
        .join(" ") || t("common.dash");
  const dob = values.date_of_birth
    ? new Date(values.date_of_birth).toISOString().slice(0, 10)
    : t("common.dash");
  const allergyStatus = values.allergy_status ?? "not_asked_yet";
  return (
    <FormSection num="15" name={t("registrationForm.section.review")}>
      <FormRow label={t("registrationForm.summary.identity")}>
        <Text size="sm">
          {t("registrationForm.summary.identityLine", {
            dob,
            estimated: dobEstimated ? t("registrationForm.summary.estimatedSuffix") : "",
            gender: values.gender ? t(`options.gender.${values.gender}`) : t("common.dash"),
            name,
          })}
        </Text>
      </FormRow>
      <FormRow label={t("registrationForm.summary.contact")}>
        <Text size="sm">
          {values.phone || t("common.dash")}
          {values.phone_secondary
            ? t("registrationForm.summary.altPhone", { phone: values.phone_secondary })
            : ""}
          {values.email ? t("registrationForm.summary.email", { email: values.email }) : ""}
        </Text>
      </FormRow>
      <FormRow label={t("registrationForm.summary.registration")}>
        <Text size="sm">
          {t("registrationForm.summary.registrationLine", {
            source: values.registration_source
              ? t(`options.registrationSource.${values.registration_source}`)
              : t("common.dash"),
            type: values.registration_type
              ? t(`options.registrationType.${values.registration_type}`)
              : t("common.dash"),
          })}
          {values.camp_name ? t("registrationForm.summary.camp", { camp: values.camp_name }) : ""}
        </Text>
      </FormRow>
      <FormRow label={t("registrationForm.summary.clinical")}>
        <Text size="sm">
          {t("registrationForm.summary.clinicalLine", {
            consultant: values.consultant_id ?? t("common.dash"),
            department: values.department_id ?? t("common.dash"),
          })}
          {values.create_opd_visit ? t("registrationForm.summary.queuedToOpd") : ""}
        </Text>
      </FormRow>
      <FormRow label={t("registrationForm.summary.allergies")}>
        <Text size="sm">
          {t(`options.allergyStatus.${allergyStatus}`)}
          {values.known_allergies
            ? t("registrationForm.summary.knownAllergies", { allergies: values.known_allergies })
            : ""}
          {values.drug_allergies
            ? t("registrationForm.summary.drugAllergies", { allergies: values.drug_allergies })
            : ""}
        </Text>
      </FormRow>
      <Alert color="green" variant="light" mt="md">
        {t("registrationForm.summary.reviewAlert")}
      </Alert>
    </FormSection>
  );
}
