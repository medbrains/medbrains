import { Box, Button, Grid, Select, Textarea, TextInput } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import type {
  BloodGroup,
  CreatePatientRequest,
  FinancialClass,
  Gender,
  MaritalStatus,
  PatientCategory,
  RegistrationSource,
  RegistrationType,
} from "@medbrains/types";
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
      known_allergies: initialValues?.known_allergies,
    },
  });

  const submit = (values: FormValues) => {
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
      date_of_birth: values.date_of_birth ? values.date_of_birth.toISOString().slice(0, 10) : null,
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
                  placeholder="First name"
                  error={errors.first_name?.message}
                  {...register("first_name", { required: "First name required" })}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 3 }}>
                <TextInput placeholder="Middle" {...register("middle_name")} />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 3 }}>
                <TextInput
                  placeholder="Last name"
                  error={errors.last_name?.message}
                  {...register("last_name", { required: "Last name required" })}
                />
              </Grid.Col>
            </Grid>
          </FormRow>

          <FormRow label="Date of birth · sex" required>
            <Grid>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Controller
                  control={control}
                  name="date_of_birth"
                  render={({ field }) => (
                    <DateInput
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
                  name="gender"
                  rules={{ required: "Gender required" }}
                  render={({ field }) => (
                    <Select
                      data={genderOptions}
                      value={field.value}
                      onChange={(v) => v && field.onChange(v)}
                      error={errors.gender?.message}
                    />
                  )}
                />
              </Grid.Col>
            </Grid>
          </FormRow>

          <FormRow label="Blood group">
            <Controller
              control={control}
              name="blood_group"
              render={({ field }) => (
                <Select
                  placeholder="Unknown"
                  data={bloodGroupOptions}
                  value={field.value ?? null}
                  onChange={(v) => field.onChange(v ?? undefined)}
                  clearable
                />
              )}
            />
          </FormRow>
        </FormSection>

        <FormSection num="02" name="Contact">
          <FormRow label="Phone" required>
            <Grid>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  placeholder="+91 xxxxxxxxxx"
                  error={errors.phone?.message}
                  {...register("phone", { required: "Phone required" })}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput placeholder="Alternate phone" {...register("phone_secondary")} />
              </Grid.Col>
            </Grid>
          </FormRow>

          <FormRow label="Email">
            <TextInput type="email" placeholder="patient@example.com" {...register("email")} />
          </FormRow>
        </FormSection>

        <FormSection num="03" name="Allergies">
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
            <FormSection num="04" name="Family & background">
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

            <FormSection num="05" name="Address">
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

            <FormSection num="06" name="Next of kin & emergency contact">
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

            <FormSection num="07" name="Preferences & care continuity">
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

            <FormSection num="08" name="Insurance & visitor pass">
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

            <FormSection num="09" name="Registration">
              <FormRow label="Patient category">
                <Controller
                  control={control}
                  name="category"
                  render={({ field }) => (
                    <Select
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
