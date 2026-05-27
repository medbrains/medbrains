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
import type {
  Camp,
  CreatePatientRequest,
  DepartmentRow,
  Facility,
  PharmacyCatalog,
  SetupUser,
  TerminologySearchResult,
} from "@medbrains/types";
import { IconCalendarMonth } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
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
} from "../../forms/patientRegistration.form";
import { lookupsService } from "../../services/lookups.service";
import { patientsService } from "../../services/patients.service";
import { tenantSettingsService } from "../../services/tenantSettings.service";
import { Icd11CodeSelect } from "../Clinical/Icd11CodeSelect";
import { ClinicalForm, FormRow, FormSection } from "../ClinicalForm";
import {
  AllergyField,
  buildPhoneCountryOptions,
  CountryPhoneInput,
  defaultPhoneCountryCode,
  detectPhoneCountryCode,
  formatPhoneWithCountryCode,
  stripPhoneCountryCode,
} from "../inputs";
import { AbhaLinkPanel } from "./AbhaLinkPanel";

interface PatientRegisterFormProps {
  isSubmitting?: boolean;
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

function agePart(value: number, unit: string): string {
  return `${value} ${unit}${value === 1 ? "" : "s"}`;
}

function formatAgeAsOfToday(value: Date | string | null | undefined): string | null {
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
    parts.push(agePart(years, "year"));
  }
  if (months > 0) {
    parts.push(agePart(months, "month"));
  }
  if (years === 0 && days > 0) {
    parts.push(agePart(days, "day"));
  }

  return parts.length > 0 ? parts.join(" ") : "0 days";
}

function ageHintAsOfToday(
  dateOfBirth: Date | string | null | undefined,
  ageYears: number | undefined,
  isEstimated: boolean,
): string {
  const exactAge = formatAgeAsOfToday(dateOfBirth);
  if (exactAge) {
    return `As of today: ${exactAge}${isEstimated ? " (estimated DOB)" : ""}`;
  }

  if (typeof ageYears === "number") {
    return `As of today: ${agePart(ageYears, "year")}; DOB is estimated until exact date is selected`;
  }

  return "Select DOB to fill age automatically";
}

export interface PatientRegistrationLinkedServicesOptions {
  createOpdVisit: boolean;
  openOpdAfterRegistration: boolean;
}

export function PatientRegisterForm({
  isSubmitting,
  submitLabel = "Register",
  onSubmit,
  onCancel,
  initialValues,
}: PatientRegisterFormProps) {
  const isEdit = submitLabel.toLowerCase().includes("save");
  const initialPhoneCountryCode = initialValues?.phone
    ? detectPhoneCountryCode(initialValues.phone)
    : null;
  const initialAlternatePhoneCountryCode = initialValues?.phone_secondary
    ? detectPhoneCountryCode(initialValues.phone_secondary)
    : null;
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
      create_opd_visit: initialValues?.create_opd_visit ?? !isEdit,
      open_opd_after_registration: initialValues?.open_opd_after_registration ?? !isEdit,
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
  const dateOfBirthAgeHint = ageHintAsOfToday(dateOfBirthValue, ageYearsValue, dobEstimated);

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
    const options = new Set<string>(["NKDA"]);
    for (const value of splitDrugAllergyTags(drugAllergiesValue)) {
      options.add(value);
    }
    for (const item of drugAllergyCatalog) {
      if (item.is_active) {
        options.add(drugAllergyOptionLabel(item));
      }
    }
    return [...options].sort();
  }, [drugAllergyCatalog, drugAllergiesValue]);
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
      setStepError(
        "Fill the highlighted intake fields before saving. Tick 'Unknown patient' if name / DOB / phone are not available.",
      );
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
      setStepError("Complete the highlighted intake fields before continuing.");
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
    "Intake",
    "Contact & identity",
    "Family · address · safety",
    "Prefs & billing",
    "Review",
  ];

  return (
    <Box w="100%">
      <ClinicalForm
        title={isEdit ? "Edit patient" : "Patient registration"}
        titleAccent={isEdit ? undefined : "— OPD"}
        subtitle={
          isEdit ? "Update demographic, contact, and clinical-safety fields" : "New patient intake"
        }
        onSubmit={handleSubmit(submit)}
        footerMeta={
          isEdit
            ? "Changes are not saved until you click Save"
            : "Save now creates a minimum-fields patient; Register complete saves the full record."
        }
        actions={
          <>
            {isFirstStep ? (
              <Button variant="default" onClick={onCancel} type="button">
                Cancel
              </Button>
            ) : (
              <Button variant="default" onClick={goBack} type="button">
                Back
              </Button>
            )}
            {!isEdit && !isLastStep && (
              <Button variant="light" onClick={saveNow} loading={isSubmitting} type="button">
                Save now
              </Button>
            )}
            {!isLastStep && (
              <Button onClick={goNext} type="button">
                Next
              </Button>
            )}
            {isLastStep && (
              <Button type="submit" loading={isSubmitting}>
                {isEdit ? submitLabel : "Register complete"}
              </Button>
            )}
          </>
        }
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
          mb="lg"
          size="sm"
        >
          {stepLabels.map((label) => (
            <Stepper.Step key={label} label={label} />
          ))}
        </Stepper>

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
          <FormSection num="01" name="Identity">
            <FormRow label="Unknown / unidentified patient">
              <Controller
                control={control}
                name="is_unknown_patient"
                render={({ field }) => (
                  <Checkbox
                    aria-label="Unknown patient"
                    label="Unknown / unidentified patient — skip name and use UHID only"
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
            <FormRow label="Name" required>
              <Grid>
                <Grid.Col span={{ base: 12, sm: 2 }}>
                  <Controller
                    control={control}
                    name="prefix"
                    render={({ field }) => (
                      <Select
                        aria-label="Prefix"
                        placeholder="Prefix"
                        data={prefixOptions}
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
                    aria-label="First Name"
                    placeholder="First name"
                    error={errors.first_name?.message}
                    {...register("first_name")}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 3 }}>
                  <TextInput
                    aria-label="Middle name"
                    placeholder="Middle"
                    {...register("middle_name")}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 3 }}>
                  <TextInput
                    aria-label="Last Name"
                    placeholder="Last name"
                    error={errors.last_name?.message}
                    {...register("last_name")}
                  />
                </Grid.Col>
              </Grid>
            </FormRow>

            <FormRow label="Age · date of birth">
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
                          aria-label="Age years"
                          placeholder="Age in years"
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
                        aria-label="Date of birth"
                        placeholder="Select exact date of birth"
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
                    {dateOfBirthAgeHint} · Pick day in the calendar to set DOB, or type age to
                    estimate DOB.
                  </Text>
                </Grid.Col>
              </Grid>
            </FormRow>

            <FormRow label="Sex · blood group" required>
              <Grid>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Controller
                    control={control}
                    name="gender"
                    render={({ field }) => (
                      <Select
                        aria-label="Gender"
                        data={genderOptions}
                        value={field.value}
                        onChange={(v) => v && field.onChange(v)}
                        error={errors.gender?.message}
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
                        aria-label="Blood group"
                        placeholder="Unknown"
                        data={bloodGroupOptions}
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
          <FormSection num="02" name="Phone">
            <FormRow label="Phone" required>
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
                        countryAriaLabel="Primary phone country"
                        numberAriaLabel="Phone (primary) Phone Primary"
                        placeholder="xxxxxxxxxx"
                        error={errors.phone?.message}
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
                        countryAriaLabel="Alternate phone country"
                        numberAriaLabel="Phone (alternate) Phone Alternate"
                        placeholder="Alternate phone"
                        error={errors.phone_secondary?.message}
                      />
                    )}
                  />
                </Grid.Col>
              </Grid>
            </FormRow>
          </FormSection>
        )}

        {activeStep === 1 && (
          <FormSection num="02" name="Email">
            <FormRow label="Email">
              <TextInput
                aria-label="Email"
                type="email"
                placeholder="patient@example.com"
                error={errors.email?.message}
                {...register("email")}
              />
            </FormRow>
          </FormSection>
        )}

        {activeStep === 1 && (
          <FormSection num="03" name="Digital identity">
            <FormRow label="ABHA">
              <AbhaLinkPanel
                status={abhaLinkStatus}
                numberField={
                  <TextInput
                    aria-label="ABHA number"
                    placeholder="14 digit ABHA number"
                    error={errors.abha_number?.message}
                    {...register("abha_number")}
                  />
                }
                addressField={
                  <TextInput
                    aria-label="ABHA address"
                    placeholder="name@abdm"
                    error={errors.abha_address?.message}
                    {...register("abha_address")}
                  />
                }
              />
            </FormRow>
            <FormRow label="Aadhaar">
              <TextInput
                aria-label="Aadhaar number"
                placeholder="12 digit Aadhaar"
                description="The server stores only a masked value and SHA-256 hash, not the raw Aadhaar number."
                error={errors.aadhaar_number?.message}
                {...register("aadhaar_number")}
              />
            </FormRow>
          </FormSection>
        )}

        {activeStep === 0 && (
          <FormSection num="04" name="Registration context">
            <FormRow label="Patient type · source">
              <Grid>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Controller
                    control={control}
                    name="registration_type"
                    render={({ field }) => (
                      <Select
                        aria-label="Registration type"
                        data={registrationTypeOptions}
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
                        aria-label="Registration source"
                        data={registrationSourceOptions}
                        value={field.value ?? null}
                        onChange={(v) => field.onChange(v ?? undefined)}
                        clearable
                      />
                    )}
                  />
                </Grid.Col>
              </Grid>
            </FormRow>
            <FormRow label="Camp reference">
              <Grid>
                <Grid.Col span={{ base: 12, sm: 5 }}>
                  <Controller
                    control={control}
                    name="camp_id"
                    render={({ field }) => (
                      <Select
                        aria-label="Camp reference"
                        placeholder="Select existing camp"
                        data={campOptions}
                        value={field.value ?? null}
                        error={errors.camp_id?.message}
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
                        aria-label="Camp name"
                        placeholder="Village / school / outreach camp name"
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
          <FormSection num="04" name="Referrals">
            <FormRow label="Referred by">
              <Grid>
                <Grid.Col span={{ base: 12, sm: 3 }}>
                  <Controller
                    control={control}
                    name="referred_by_kind"
                    render={({ field }) => (
                      <Select
                        aria-label="Referral type"
                        placeholder="Referral type"
                        data={referredByKindOptions}
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
                        aria-label="Referring doctor"
                        placeholder={
                          referredByKind === "doctor" ? "Select doctor" : "Optional doctor link"
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
                        aria-label="Referred by"
                        placeholder="Name of doctor / ASHA / camp worker"
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
                    aria-label="Referred by phone"
                    placeholder="Phone"
                    error={errors.referred_by_phone?.message}
                    {...register("referred_by_phone")}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 8 }}>
                  <Controller
                    control={control}
                    name="referred_by_facility"
                    render={({ field }) => (
                      <Autocomplete
                        aria-label="Referred by facility"
                        placeholder="Facility / village / NGO"
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
          <FormSection num="05" name="Clinical ownership">
            <FormRow label="Department · consultant">
              <Grid>
                <Grid.Col span={{ base: 12, sm: 5 }}>
                  <Controller
                    control={control}
                    name="department_id"
                    render={({ field }) => (
                      <Select
                        aria-label="Department"
                        placeholder="Select department"
                        data={departmentOptions}
                        value={field.value ?? null}
                        onChange={(v) => field.onChange(v ?? undefined)}
                        error={errors.department_id?.message}
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
                        aria-label="Concerned consultant"
                        placeholder="Select concerned consultant"
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
                    aria-label="Clinical unit"
                    placeholder="Unit"
                    {...register("clinical_unit")}
                  />
                </Grid.Col>
              </Grid>
            </FormRow>
            <FormRow label="Provisional diagnosis">
              <Grid>
                <Grid.Col span={{ base: 12, sm: 7 }}>
                  <TextInput
                    aria-label="Initial diagnosis"
                    placeholder="Clinical impression at registration"
                    {...register("initial_diagnosis_text")}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 5 }}>
                  <Controller
                    control={control}
                    name="icd11_code"
                    render={({ field }) => (
                      <Icd11CodeSelect
                        aria-label="ICD-11 code"
                        placeholder="Search ICD-11"
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
                        error={errors.icd11_code?.message}
                      />
                    )}
                  />
                </Grid.Col>
              </Grid>
            </FormRow>
            {!isEdit && (
              <FormRow label="Linked services">
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Controller
                      control={control}
                      name="create_opd_visit"
                      render={({ field }) => (
                        <Checkbox
                          aria-label="Send to OPD queue"
                          label="Send to OPD queue after registration"
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
                          aria-label="Open OPD after registration"
                          label="Open OPD visit after queue entry"
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
          <FormSection num="06" name="Allergy status">
            <FormRow label="Allergy state" required>
              <Controller
                control={control}
                name="allergy_status"
                render={({ field }) => (
                  <Select
                    aria-label="Allergy status"
                    data={[
                      { value: "not_asked_yet", label: "Not asked yet" },
                      { value: "no_known_allergies", label: "No known allergies" },
                      { value: "known_allergies", label: "Known allergies (record on next step)" },
                    ]}
                    value={field.value ?? "not_asked_yet"}
                    onChange={(v) => field.onChange(v ?? "not_asked_yet")}
                    error={errors.allergy_status?.message}
                  />
                )}
              />
            </FormRow>
          </FormSection>
        )}

        {activeStep === 2 && (
          <FormSection num="07" name="Safety flags">
            <FormRow label="Safety flags">
              <Grid>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <Controller
                    control={control}
                    name="is_medico_legal"
                    render={({ field }) => (
                      <Checkbox
                        aria-label="Medico-legal case"
                        label="Medico-legal case"
                        checked={field.value ?? false}
                        onChange={(event) => field.onChange(event.currentTarget.checked)}
                      />
                    )}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <TextInput
                    aria-label="MLC number"
                    placeholder="MLC number"
                    {...register("mlc_number")}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <Controller
                    control={control}
                    name="is_vip"
                    render={({ field }) => (
                      <Checkbox
                        aria-label="VIP patient"
                        label="VIP patient"
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
          <FormSection num="08" name="Allergy details">
            {/* Both fields are optional — many patients have no known
              allergies. Empty = "not yet recorded"; the prescriber
              still gets a banner before issuing meds, but registration
              is not blocked for routine OPD intake. */}
            <FormRow label="General allergies (food, environmental, contact)">
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
                      placeholder="Pollen, dust, peanuts, latex, etc. — or leave blank if none known"
                      severity="watch"
                      badgeLabel={has ? "Logged" : "Optional"}
                      hint="Examples: peanuts, shellfish, latex, dust mites. Skip if patient is unsure or has no known allergies."
                    />
                  );
                }}
              />
            </FormRow>
            <FormRow label="Drug allergies">
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
                      placeholder="Search pharmacy drug, or type NKDA / outside drug allergy"
                      clearable
                      splitChars={[",", ";"]}
                      acceptValueOnBlur
                      loading={isDrugAllergyCatalogLoading}
                      description={
                        has
                          ? "Selected drug allergies are saved on the patient profile and surfaced during prescribing."
                          : "Select from pharmacy where possible. Free text is allowed for outside or unknown drugs."
                      }
                      error={errors.drug_allergies?.message}
                    />
                  );
                }}
              />
            </FormRow>
          </FormSection>
        )}

        {activeStep === 2 && (
          <FormSection num="09" name="Family & background">
            <FormRow label="Father's name">
              <TextInput {...register("father_name")} />
            </FormRow>
            <FormRow label="Guardian">
              <Grid>
                <Grid.Col span={{ base: 12, sm: 8 }}>
                  <TextInput placeholder="Name" {...register("guardian_name")} />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <TextInput placeholder="Relation" {...register("guardian_relation")} />
                </Grid.Col>
              </Grid>
            </FormRow>
            <FormRow label="Marital · religion · occupation">
              <Grid>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <Controller
                    control={control}
                    name="marital_status"
                    render={({ field }) => (
                      <Select
                        placeholder="Marital"
                        data={maritalStatusOptions}
                        value={field.value ?? null}
                        onChange={(v) => field.onChange(v ?? undefined)}
                        clearable
                      />
                    )}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <TextInput placeholder="Religion" {...register("religion")} />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <TextInput placeholder="Occupation" {...register("occupation")} />
                </Grid.Col>
              </Grid>
            </FormRow>
          </FormSection>
        )}

        {activeStep === 2 && (
          <FormSection num="10" name="Address">
            <FormRow label="Address line 1">
              <Textarea
                placeholder="House / building / street"
                autosize
                minRows={2}
                {...register("line1")}
              />
            </FormRow>
            <FormRow label="Address line 2">
              <TextInput placeholder="Locality / area (optional)" {...register("line2")} />
            </FormRow>
            <FormRow label="Landmark">
              <TextInput
                placeholder="Near temple / opposite school / etc."
                {...register("landmark")}
              />
            </FormRow>
            <FormRow label="City · district · state · pin">
              <Grid>
                <Grid.Col span={{ base: 12, sm: 3 }}>
                  <TextInput placeholder="City / village" {...register("city")} />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 3 }}>
                  <TextInput placeholder="District / Taluka" {...register("district")} />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 2 }}>
                  <TextInput placeholder="State" {...register("state")} />
                </Grid.Col>
                <Grid.Col span={{ base: 6, sm: 2 }}>
                  <TextInput placeholder="Pin" {...register("postal_code")} />
                </Grid.Col>
                <Grid.Col span={{ base: 6, sm: 2 }}>
                  <TextInput defaultValue="India" {...register("country")} />
                </Grid.Col>
              </Grid>
            </FormRow>
          </FormSection>
        )}

        {activeStep === 2 && (
          <FormSection num="11" name="Next of kin & emergency contact">
            <FormRow label="Next of kin">
              <Grid>
                <Grid.Col span={{ base: 12, sm: 5 }}>
                  <TextInput placeholder="Full name" {...register("next_of_kin_name")} />
                </Grid.Col>
                <Grid.Col span={{ base: 6, sm: 3 }}>
                  <TextInput placeholder="Relation" {...register("next_of_kin_relation")} />
                </Grid.Col>
                <Grid.Col span={{ base: 6, sm: 4 }}>
                  <TextInput
                    placeholder="Phone"
                    error={errors.next_of_kin_phone?.message}
                    {...register("next_of_kin_phone")}
                  />
                </Grid.Col>
              </Grid>
            </FormRow>
            <FormRow label="Emergency contact (different person if needed)">
              <Grid>
                <Grid.Col span={{ base: 12, sm: 5 }}>
                  <TextInput placeholder="Full name" {...register("emergency_contact_name")} />
                </Grid.Col>
                <Grid.Col span={{ base: 6, sm: 3 }}>
                  <TextInput placeholder="Relation" {...register("emergency_contact_relation")} />
                </Grid.Col>
                <Grid.Col span={{ base: 6, sm: 4 }}>
                  <TextInput
                    placeholder="Phone"
                    error={errors.emergency_contact_phone?.message}
                    {...register("emergency_contact_phone")}
                  />
                </Grid.Col>
              </Grid>
            </FormRow>
          </FormSection>
        )}

        {activeStep === 3 && (
          <FormSection num="12" name="Preferences & care continuity">
            <FormRow label="Preferred ward / room class">
              <Controller
                control={control}
                name="preferred_room_class"
                render={({ field }) => (
                  <Select
                    placeholder="No preference"
                    data={[
                      { value: "general", label: "General ward" },
                      { value: "semi_private", label: "Semi-private" },
                      { value: "private", label: "Private" },
                      { value: "deluxe", label: "Deluxe" },
                      { value: "suite", label: "Suite" },
                      { value: "icu", label: "ICU (clinical decision)" },
                    ]}
                    value={field.value ?? null}
                    onChange={(v) => field.onChange(v ?? undefined)}
                    clearable
                  />
                )}
              />
            </FormRow>
            <FormRow label="Dietary preference">
              <Grid>
                <Grid.Col span={{ base: 12, sm: 5 }}>
                  <Controller
                    control={control}
                    name="dietary_preference"
                    render={({ field }) => (
                      <Select
                        placeholder="No preference"
                        data={[
                          { value: "vegetarian", label: "Vegetarian" },
                          { value: "vegan", label: "Vegan" },
                          { value: "non_veg", label: "Non-vegetarian" },
                          { value: "jain", label: "Jain" },
                          { value: "halal", label: "Halal" },
                          { value: "kosher", label: "Kosher" },
                          { value: "diabetic", label: "Diabetic-friendly" },
                        ]}
                        value={field.value ?? null}
                        onChange={(v) => field.onChange(v ?? undefined)}
                        clearable
                      />
                    )}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 7 }}>
                  <TextInput
                    placeholder="Restrictions / allergies — gluten-free, low-sodium, etc."
                    {...register("dietary_restrictions")}
                  />
                </Grid.Col>
              </Grid>
            </FormRow>
            <FormRow label="Religious / cultural observances">
              <TextInput
                placeholder="Daily prayer times, fasting, pre-procedure rituals, female-only attendant, etc."
                {...register("religious_observances")}
              />
            </FormRow>
            <FormRow label="Preferred language">
              <TextInput
                placeholder="Tamil, Hindi, English, etc."
                {...register("language_preference")}
              />
            </FormRow>
            <FormRow label="Primary physician (referring / family doctor)">
              <Grid>
                <Grid.Col span={{ base: 12, sm: 7 }}>
                  <TextInput placeholder="Name" {...register("primary_physician_name")} />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 5 }}>
                  <TextInput
                    placeholder="In-house staff ID (optional)"
                    {...register("primary_physician_id")}
                  />
                </Grid.Col>
              </Grid>
            </FormRow>
          </FormSection>
        )}

        {activeStep === 3 && (
          <FormSection num="13" name="Insurance & visitor pass">
            <FormRow label="Secondary insurance">
              <Grid>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <TextInput
                    placeholder="Provider — second policy (e.g. corporate top-up)"
                    {...register("secondary_insurance_provider")}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <TextInput
                    placeholder="Policy / member number"
                    {...register("secondary_insurance_policy_no")}
                  />
                </Grid.Col>
              </Grid>
            </FormRow>
            <FormRow label="Default attendant pass count">
              <TextInput
                type="number"
                placeholder="Number of bedside attendants allowed (defaults per ward type)"
                error={errors.attendant_passes_count?.message}
                {...register("attendant_passes_count")}
              />
            </FormRow>
          </FormSection>
        )}

        {activeStep === 3 && (
          <FormSection num="14" name="Registration">
            <FormRow label="Patient category">
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <Select
                    aria-label="Patient category"
                    placeholder="General"
                    data={categoryOptions}
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
    </Box>
  );
}

interface ReviewSummaryProps {
  values: PatientRegistrationFormInput;
  dobEstimated: boolean;
}

function ReviewSummary({ values, dobEstimated }: ReviewSummaryProps) {
  const name = values.is_unknown_patient
    ? "Unknown patient"
    : [values.prefix, values.first_name, values.middle_name, values.last_name, values.suffix]
        .filter(Boolean)
        .join(" ") || "—";
  const dob = values.date_of_birth
    ? new Date(values.date_of_birth).toISOString().slice(0, 10)
    : "—";
  const allergyLabel: Record<string, string> = {
    not_asked_yet: "Not asked yet",
    no_known_allergies: "No known allergies",
    known_allergies: "Known allergies",
  };
  return (
    <FormSection num="15" name="Review">
      <FormRow label="Identity">
        <Text size="sm">
          {name} · {values.gender ?? "—"} · DOB {dob}
          {dobEstimated ? " (estimated)" : ""}
        </Text>
      </FormRow>
      <FormRow label="Contact">
        <Text size="sm">
          {values.phone || "—"}
          {values.phone_secondary ? ` · alt ${values.phone_secondary}` : ""}
          {values.email ? ` · ${values.email}` : ""}
        </Text>
      </FormRow>
      <FormRow label="Registration">
        <Text size="sm">
          Type {values.registration_type ?? "—"} · source {values.registration_source ?? "—"}
          {values.camp_name ? ` · camp ${values.camp_name}` : ""}
        </Text>
      </FormRow>
      <FormRow label="Clinical">
        <Text size="sm">
          Dept {values.department_id ?? "—"} · consultant {values.consultant_id ?? "—"}
          {values.create_opd_visit ? " · queued to OPD" : ""}
        </Text>
      </FormRow>
      <FormRow label="Allergies">
        <Text size="sm">
          {allergyLabel[values.allergy_status ?? "not_asked_yet"]}
          {values.known_allergies ? ` · ${values.known_allergies}` : ""}
          {values.drug_allergies ? ` · drugs: ${values.drug_allergies}` : ""}
        </Text>
      </FormRow>
      <Alert color="green" variant="light" mt="md">
        Press Register complete to save the full record. Use Back to edit any step.
      </Alert>
    </FormSection>
  );
}
