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
  // Address
  line1?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
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
    if (values.city) address.city = values.city;
    if (values.state) address.state = values.state;
    if (values.postal_code) address.postal_code = values.postal_code;
    if (values.country) address.country = values.country;

    const attributes: Record<string, unknown> = {};
    const allergies = values.known_allergies?.trim();
    if (allergies) attributes.known_allergies = allergies;

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
                <TextInput placeholder="Prefix" {...register("prefix")} />
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
          <FormRow label="Known allergies" required>
            <Controller
              control={control}
              name="known_allergies"
              render={({ field }) => {
                const v = (field.value ?? "").trim();
                const has = v.length > 0;
                const isNkda = v.toLowerCase() === "nkda";
                return (
                  <AllergyField
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    placeholder="Type known allergies, or 'NKDA' for no known drug allergies"
                    severity={has ? "watch" : "blocking"}
                    badgeLabel={has ? (isNkda ? "NKDA" : "Logged") : "Required"}
                    hint={
                      has
                        ? undefined
                        : "Code-Red pulse: blocking field — required before any prescription can be issued"
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
              <FormRow label="Street">
                <Textarea
                  placeholder="House / street / locality"
                  autosize
                  minRows={2}
                  {...register("line1")}
                />
              </FormRow>
              <FormRow label="City · state · pin">
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <TextInput placeholder="City" {...register("city")} />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
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

            <FormSection num="06" name="Registration">
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
