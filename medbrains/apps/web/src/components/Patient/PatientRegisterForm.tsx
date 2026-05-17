import {
  Box,
  Button,
  Checkbox,
  Grid,
  NumberInput,
  Select,
  Textarea,
  TextInput,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { api } from "@medbrains/api";
import type {
  BloodGroup,
  CreatePatientRequest,
  DepartmentRow,
  FinancialClass,
  Gender,
  MaritalStatus,
  PatientCategory,
  RegistrationSource,
  RegistrationType,
  SetupUser,
} from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { ClinicalForm, FormRow, FormSection } from "../ClinicalForm";
import { AllergyField } from "../inputs";

export interface PatientRegisterFormInitialValues {
  prefix?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  suffix?: string;
  date_of_birth?: string;
  gender?: Gender;
  blood_group?: BloodGroup;
  marital_status?: MaritalStatus;
  religion?: string;
  occupation?: string;
  phone?: string;
  phone_secondary?: string;
  email?: string;
  father_name?: string;
  guardian_name?: string;
  guardian_relation?: string;
  category?: PatientCategory;
  known_allergies?: string;
}

interface PatientRegisterFormProps {
  quickMode?: boolean;
  isSubmitting?: boolean;
  submitLabel?: string;
  onSubmit: (req: CreatePatientRequest) => void | Promise<void>;
  onCancel: () => void;
  initialValues?: PatientRegisterFormInitialValues;
}

interface FormValues {
  prefix?: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  suffix?: string;
  date_of_birth?: Date | null;
  age_years?: number;
  gender: Gender;
  blood_group?: BloodGroup;
  marital_status?: MaritalStatus;
  religion?: string;
  occupation?: string;
  phone: string;
  phone_secondary?: string;
  email?: string;
  father_name?: string;
  guardian_name?: string;
  guardian_relation?: string;
  category?: PatientCategory;
  registration_type?: RegistrationType;
  registration_source?: RegistrationSource;
  financial_class?: FinancialClass;
  abha_number?: string;
  abha_address?: string;
  aadhaar_number?: string;
  referred_by_name?: string;
  referred_by_phone?: string;
  referred_by_facility?: string;
  department_id?: string;
  consultant_id?: string;
  clinical_unit?: string;
  camp_id?: string;
  camp_name?: string;
  initial_diagnosis_text?: string;
  icd10_code?: string;
  icd11_code?: string;
  is_medico_legal?: boolean;
  mlc_number?: string;
  is_vip?: boolean;
  known_allergies?: string;
  drug_allergies?: string;
  // Address
  line1?: string;
  line2?: string;
  city?: string;
  district?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  landmark?: string;
  // Multi-speciality / VIP attributes (stored in patients.attributes JSONB)
  next_of_kin_name?: string;
  next_of_kin_relation?: string;
  next_of_kin_phone?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relation?: string;
  preferred_room_class?: string;
  dietary_preference?: string;
  dietary_restrictions?: string;
  religious_observances?: string;
  language_preference?: string;
  primary_physician_id?: string;
  primary_physician_name?: string;
  secondary_insurance_provider?: string;
  secondary_insurance_policy_no?: string;
  attendant_passes_count?: string;
}

const genderOptions: { value: Gender; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "unknown", label: "Unknown" },
];

const bloodGroupOptions: { value: BloodGroup; label: string }[] = [
  { value: "a_positive", label: "A+" },
  { value: "a_negative", label: "A−" },
  { value: "b_positive", label: "B+" },
  { value: "b_negative", label: "B−" },
  { value: "ab_positive", label: "AB+" },
  { value: "ab_negative", label: "AB−" },
  { value: "o_positive", label: "O+" },
  { value: "o_negative", label: "O−" },
  { value: "unknown", label: "Unknown" },
];

const maritalStatusOptions: { value: MaritalStatus; label: string }[] = [
  { value: "single", label: "Single" },
  { value: "married", label: "Married" },
  { value: "divorced", label: "Divorced" },
  { value: "widowed", label: "Widowed" },
  { value: "separated", label: "Separated" },
  { value: "domestic_partner", label: "Domestic partner" },
  { value: "unknown", label: "Unknown" },
];

const categoryOptions: { value: PatientCategory; label: string }[] = [
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

const registrationTypeOptions: { value: RegistrationType; label: string }[] = [
  { value: "new", label: "New" },
  { value: "revisit", label: "Revisit" },
  { value: "transfer_in", label: "Transfer in" },
  { value: "referral", label: "Referral" },
  { value: "emergency", label: "Emergency" },
  { value: "camp", label: "Camp" },
  { value: "telemedicine", label: "Telemedicine" },
  { value: "pre_registration", label: "Pre-registration" },
];

const registrationSourceOptions: { value: RegistrationSource; label: string }[] = [
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

const prefixOptions = [
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

function estimateDobFromAge(ageYears: number): Date {
  const today = new Date();
  return new Date(today.getFullYear() - ageYears, 0, 1);
}

function trimOrUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function optionLabel<T extends { value: string; label: string }>(
  options: T[],
  value: string | undefined,
): string | undefined {
  return options.find((option) => option.value === value)?.label;
}

export function PatientRegisterForm({
  quickMode = false,
  isSubmitting,
  submitLabel = "Register",
  onSubmit,
  onCancel,
  initialValues,
}: PatientRegisterFormProps) {
  const {
    register,
    control,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      gender: initialValues?.gender ?? "unknown",
      prefix: initialValues?.prefix,
      first_name: initialValues?.first_name ?? "",
      middle_name: initialValues?.middle_name,
      last_name: initialValues?.last_name ?? "",
      suffix: initialValues?.suffix,
      date_of_birth: initialValues?.date_of_birth ? new Date(initialValues.date_of_birth) : null,
      blood_group: initialValues?.blood_group,
      marital_status: initialValues?.marital_status,
      religion: initialValues?.religion,
      occupation: initialValues?.occupation,
      phone: initialValues?.phone ?? "",
      phone_secondary: initialValues?.phone_secondary,
      email: initialValues?.email,
      father_name: initialValues?.father_name,
      guardian_name: initialValues?.guardian_name,
      guardian_relation: initialValues?.guardian_relation,
      category: initialValues?.category,
      registration_type: "new",
      registration_source: "walk_in",
      known_allergies: initialValues?.known_allergies,
    },
  });

  const { data: departments = [] } = useQuery<DepartmentRow[]>({
    queryKey: ["setup-departments"],
    queryFn: () => api.listDepartments(),
    staleTime: 5 * 60 * 1000,
  });
  const { data: doctors = [] } = useQuery<SetupUser[]>({
    queryKey: ["setup-doctors"],
    queryFn: () => api.listDoctors(),
    staleTime: 5 * 60 * 1000,
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

  const submit = (values: FormValues) => {
    const dateOfBirth =
      values.date_of_birth ??
      (typeof values.age_years === "number" ? estimateDobFromAge(values.age_years) : null);
    const isDobEstimated = !values.date_of_birth && typeof values.age_years === "number";
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
      first_name: values.first_name,
      last_name: values.last_name,
      gender: values.gender,
      phone: values.phone,
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
      phone_secondary: values.phone_secondary || undefined,
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
      icd10_code: trimOrUndefined(values.icd10_code),
      icd11_code: trimOrUndefined(values.icd11_code),
      is_medico_legal: values.is_medico_legal || undefined,
      mlc_number: values.mlc_number || undefined,
      is_vip: values.is_vip || undefined,
      address: Object.keys(address).length > 0 ? address : null,
      attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
    };
    void onSubmit(req);
  };

  const isEdit = submitLabel.toLowerCase().includes("save");

  return (
    <Box maw={960} mx="auto">
      <ClinicalForm
        title={isEdit ? "Edit patient" : "Patient registration"}
        titleAccent={isEdit ? undefined : "— OPD"}
        subtitle={
          isEdit ? "Update demographic, contact, and clinical-safety fields" : "New patient intake"
        }
        onSubmit={handleSubmit(submit)}
        footerMeta={isEdit ? "Changes are not saved until you click Save" : "Auto-saved as draft"}
        actions={
          <>
            <Button variant="default" onClick={onCancel} type="button">
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {submitLabel}
            </Button>
          </>
        }
      >
        <FormSection num="01" name="Identity">
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
                  aria-label="First name"
                  placeholder="First name"
                  error={errors.first_name?.message}
                  {...register("first_name", { required: "First name required" })}
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
                  aria-label="Last name"
                  placeholder="Last name"
                  error={errors.last_name?.message}
                  {...register("last_name", { required: "Last name required" })}
                />
              </Grid.Col>
            </Grid>
          </FormRow>

          <FormRow label="Date of birth · age">
            <Grid>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Controller
                  control={control}
                  name="date_of_birth"
                  render={({ field }) => (
                    <DateInput
                      aria-label="Date of birth"
                      placeholder="DD / MM / YYYY"
                      value={field.value ?? null}
                      onChange={(v) => field.onChange(v ? new Date(v) : null)}
                      clearable
                      maxDate={new Date()}
                    />
                  )}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Controller
                  control={control}
                  name="age_years"
                  render={({ field }) => (
                    <NumberInput
                      aria-label="Age years"
                      placeholder="Age in years"
                      min={0}
                      max={125}
                      value={field.value ?? ""}
                      onChange={(value) => {
                        const age = typeof value === "number" ? value : undefined;
                        field.onChange(age);
                        if (typeof age === "number") {
                          setValue("date_of_birth", estimateDobFromAge(age), {
                            shouldDirty: true,
                          });
                        }
                      }}
                    />
                  )}
                />
              </Grid.Col>
            </Grid>
          </FormRow>

          <FormRow label="Sex · blood group" required>
            <Grid>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Controller
                  control={control}
                  name="gender"
                  rules={{ required: "Gender required" }}
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

        <FormSection num="02" name="Contact">
          <FormRow label="Phone" required>
            <Grid>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  aria-label="Phone (primary)"
                  placeholder="+91 xxxxxxxxxx"
                  error={errors.phone?.message}
                  {...register("phone", { required: "Phone required" })}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  aria-label="Phone (alternate)"
                  placeholder="Alternate phone"
                  {...register("phone_secondary")}
                />
              </Grid.Col>
            </Grid>
          </FormRow>

          <FormRow label="Email">
            <TextInput
              aria-label="Email"
              type="email"
              placeholder="patient@example.com"
              {...register("email")}
            />
          </FormRow>
        </FormSection>

        <FormSection num="03" name="Digital identity">
          <FormRow label="ABHA">
            <Grid>
              <Grid.Col span={{ base: 12, sm: 5 }}>
                <TextInput
                  aria-label="ABHA number"
                  placeholder="14 digit ABHA number"
                  {...register("abha_number")}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 7 }}>
                <TextInput
                  aria-label="ABHA address"
                  placeholder="name@abdm"
                  {...register("abha_address")}
                />
              </Grid.Col>
            </Grid>
          </FormRow>
          <FormRow label="Aadhaar">
            <TextInput
              aria-label="Aadhaar number"
              placeholder="12 digit Aadhaar"
              description="The server stores only a masked value and SHA-256 hash, not the raw Aadhaar number."
              {...register("aadhaar_number")}
            />
          </FormRow>
        </FormSection>

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
                          setValue("registration_source", "camp", { shouldDirty: true });
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
                <TextInput
                  aria-label="Camp ID"
                  placeholder="Camp UUID if already created"
                  {...register("camp_id")}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 7 }}>
                <TextInput
                  aria-label="Camp name"
                  placeholder="Village / school / outreach camp name"
                  {...register("camp_name")}
                />
              </Grid.Col>
            </Grid>
          </FormRow>
          <FormRow label="Referred by">
            <Grid>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <TextInput
                  aria-label="Referred by"
                  placeholder="Doctor / ASHA / camp worker"
                  {...register("referred_by_name")}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <TextInput
                  aria-label="Referred by phone"
                  placeholder="Phone"
                  {...register("referred_by_phone")}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <TextInput
                  aria-label="Referred by facility"
                  placeholder="Facility / village / NGO"
                  {...register("referred_by_facility")}
                />
              </Grid.Col>
            </Grid>
          </FormRow>
        </FormSection>

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
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  aria-label="Initial diagnosis"
                  placeholder="Clinical impression at registration"
                  {...register("initial_diagnosis_text")}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 6, sm: 3 }}>
                <TextInput
                  aria-label="ICD-10 code"
                  placeholder="ICD-10"
                  {...register("icd10_code")}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 6, sm: 3 }}>
                <TextInput
                  aria-label="ICD-11 code"
                  placeholder="ICD-11"
                  {...register("icd11_code")}
                />
              </Grid.Col>
            </Grid>
          </FormRow>
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

        <FormSection num="06" name="Allergies">
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
                const v = (field.value ?? "").trim();
                const has = v.length > 0;
                const isNkda = v.toLowerCase() === "nkda";
                return (
                  <AllergyField
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    placeholder="e.g. 'Penicillin — anaphylaxis' or 'NKDA' for No Known Drug Allergies"
                    severity={has ? "watch" : "blocking"}
                    badgeLabel={has ? (isNkda ? "NKDA" : "Logged") : "Confirm before Rx"}
                    hint={
                      has
                        ? "Drug-class allergies: every prescription will surface this. Use 'NKDA' if explicitly confirmed."
                        : "Pharmacy and prescribing screens will warn until this is confirmed (NKDA, or specific drug + reaction)."
                    }
                  />
                );
              }}
            />
          </FormRow>
        </FormSection>

        {!quickMode && (
          <>
            <FormSection num="07" name="Family & background">
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

            <FormSection num="08" name="Address">
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

            <FormSection num="09" name="Next of kin & emergency contact">
              <FormRow label="Next of kin">
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 5 }}>
                    <TextInput placeholder="Full name" {...register("next_of_kin_name")} />
                  </Grid.Col>
                  <Grid.Col span={{ base: 6, sm: 3 }}>
                    <TextInput placeholder="Relation" {...register("next_of_kin_relation")} />
                  </Grid.Col>
                  <Grid.Col span={{ base: 6, sm: 4 }}>
                    <TextInput placeholder="Phone" {...register("next_of_kin_phone")} />
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
                    <TextInput placeholder="Phone" {...register("emergency_contact_phone")} />
                  </Grid.Col>
                </Grid>
              </FormRow>
            </FormSection>

            <FormSection num="10" name="Preferences & care continuity">
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

            <FormSection num="11" name="Insurance & visitor pass">
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
                  {...register("attendant_passes_count")}
                />
              </FormRow>
            </FormSection>

            <FormSection num="12" name="Registration">
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
          </>
        )}
      </ClinicalForm>
    </Box>
  );
}
