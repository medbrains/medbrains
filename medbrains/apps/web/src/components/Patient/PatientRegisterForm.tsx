import { Box, Button, Grid, Group, Paper, Select, Stack, Text, TextInput, Textarea } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useForm, Controller } from "react-hook-form";
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

function SectionHeader({ eyebrow, title, hint }: { eyebrow: string; title: string; hint?: string }) {
  return (
    <Stack gap={2} mb="xs">
      <Text
        size="xs"
        fw={500}
        tt="uppercase"
        ff="JetBrains Mono, monospace"
        c="dimmed"
        style={{ letterSpacing: "0.14em" }}
      >
        {eyebrow}
      </Text>
      <Text fw={600} size="md">
        {title}
      </Text>
      {hint && (
        <Text size="xs" c="dimmed">
          {hint}
        </Text>
      )}
    </Stack>
  );
}

export function PatientRegisterForm({
  quickMode = false,
  isSubmitting,
  submitLabel = "Register",
  onSubmit,
  onCancel,
  initialValues,
}: PatientRegisterFormProps) {
  const { register, control, handleSubmit, formState: { errors } } = useForm<FormValues>({
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
    },
  });

  const submit = (values: FormValues) => {
    const address: Record<string, unknown> = {};
    if (values.line1) address.line1 = values.line1;
    if (values.city) address.city = values.city;
    if (values.state) address.state = values.state;
    if (values.postal_code) address.postal_code = values.postal_code;
    if (values.country) address.country = values.country;

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
    };
    void onSubmit(req);
  };

  return (
    <Box maw={960} mx="auto">
      <form onSubmit={handleSubmit(submit)}>
        <Stack gap="lg">
          <Paper p="lg" radius="md" withBorder>
            <SectionHeader eyebrow="Section 01" title="Identity" />
            <Grid>
              <Grid.Col span={{ base: 12, sm: 2 }}>
                <TextInput label="Prefix" placeholder="Mr / Ms / Dr" {...register("prefix")} />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <TextInput
                  label="First name"
                  required
                  placeholder="Given name"
                  error={errors.first_name?.message}
                  {...register("first_name", { required: "First name required" })}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 3 }}>
                <TextInput label="Middle name" {...register("middle_name")} />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 3 }}>
                <TextInput
                  label="Last name"
                  required
                  placeholder="Family name"
                  error={errors.last_name?.message}
                  {...register("last_name", { required: "Last name required" })}
                />
              </Grid.Col>

              <Grid.Col span={{ base: 12, sm: 4 }}>
                <Controller
                  control={control}
                  name="date_of_birth"
                  render={({ field }) => (
                    <DateInput
                      label="Date of birth"
                      placeholder="Select date"
                      value={field.value ?? null}
                      onChange={(v) => field.onChange(v ? new Date(v) : null)}
                      clearable
                      maxDate={new Date()}
                    />
                  )}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <Controller
                  control={control}
                  name="gender"
                  rules={{ required: "Gender required" }}
                  render={({ field }) => (
                    <Select
                      label="Gender"
                      required
                      data={genderOptions}
                      value={field.value}
                      onChange={(v) => v && field.onChange(v)}
                      error={errors.gender?.message}
                    />
                  )}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <Controller
                  control={control}
                  name="blood_group"
                  render={({ field }) => (
                    <Select
                      label="Blood group"
                      placeholder="Select"
                      data={bloodGroupOptions}
                      value={field.value ?? null}
                      onChange={(v) => field.onChange(v ?? undefined)}
                      clearable
                    />
                  )}
                />
              </Grid.Col>
            </Grid>
          </Paper>

          <Paper p="lg" radius="md" withBorder>
            <SectionHeader eyebrow="Section 02" title="Contact" />
            <Grid>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="Phone (primary)"
                  required
                  placeholder="+91 xxxxxxxxxx"
                  error={errors.phone?.message}
                  {...register("phone", { required: "Phone required" })}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput label="Phone (alternate)" {...register("phone_secondary")} />
              </Grid.Col>
              <Grid.Col span={12}>
                <TextInput label="Email" type="email" placeholder="patient@example.com" {...register("email")} />
              </Grid.Col>
            </Grid>
          </Paper>

          {!quickMode && (
            <>
              <Paper p="lg" radius="md" withBorder>
                <SectionHeader
                  eyebrow="Section 03"
                  title="Family & Background"
                  hint="Optional — helps with kin-of-record, religious dietary, and follow-up"
                />
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <TextInput label="Father's name" {...register("father_name")} />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <TextInput label="Guardian name" {...register("guardian_name")} />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <TextInput label="Guardian relation" {...register("guardian_relation")} />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <Controller
                      control={control}
                      name="marital_status"
                      render={({ field }) => (
                        <Select
                          label="Marital status"
                          data={maritalStatusOptions}
                          value={field.value ?? null}
                          onChange={(v) => field.onChange(v ?? undefined)}
                          clearable
                        />
                      )}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <TextInput label="Religion" {...register("religion")} />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <TextInput label="Occupation" {...register("occupation")} />
                  </Grid.Col>
                </Grid>
              </Paper>

              <Paper p="lg" radius="md" withBorder>
                <SectionHeader eyebrow="Section 04" title="Address" />
                <Grid>
                  <Grid.Col span={12}>
                    <Textarea
                      label="Address line"
                      placeholder="House / street / locality"
                      autosize
                      minRows={2}
                      {...register("line1")}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <TextInput label="City" {...register("city")} />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <TextInput label="State" {...register("state")} />
                  </Grid.Col>
                  <Grid.Col span={{ base: 6, sm: 2 }}>
                    <TextInput label="Postal code" {...register("postal_code")} />
                  </Grid.Col>
                  <Grid.Col span={{ base: 6, sm: 2 }}>
                    <TextInput label="Country" defaultValue="India" {...register("country")} />
                  </Grid.Col>
                </Grid>
              </Paper>

              <Paper p="lg" radius="md" withBorder>
                <SectionHeader
                  eyebrow="Section 05"
                  title="Registration"
                  hint="Determines billing scheme and queue routing"
                />
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <Controller
                      control={control}
                      name="category"
                      render={({ field }) => (
                        <Select
                          label="Patient category"
                          placeholder="General"
                          data={categoryOptions}
                          value={field.value ?? null}
                          onChange={(v) => field.onChange(v ?? undefined)}
                          clearable
                        />
                      )}
                    />
                  </Grid.Col>
                </Grid>
              </Paper>
            </>
          )}

          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={onCancel} type="button" size="md">
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting} size="md">
              {submitLabel}
            </Button>
          </Group>
        </Stack>
      </form>
    </Box>
  );
}
