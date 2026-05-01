import {
  Button,
  Checkbox,
  Divider,
  Grid,
  Group,
  Select,
  Stack,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
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
import { AllergyField } from "./inputs";

interface PatientRegistrationFormProps {
  quickMode?: boolean;
  isSubmitting?: boolean;
  onSubmit: (req: CreatePatientRequest) => void;
  onCancel: () => void;
  submitLabel?: string;
}

interface FormShape {
  prefix: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  suffix: string;
  date_of_birth: Date | null;
  gender: Gender;
  marital_status: MaritalStatus | "";
  religion: string;
  blood_group: BloodGroup | "";
  occupation: string;
  phone: string;
  phone_secondary: string;
  email: string;
  father_name: string;
  guardian_name: string;
  guardian_relation: string;
  category: PatientCategory | "";
  registration_type: RegistrationType | "";
  registration_source: RegistrationSource | "";
  financial_class: FinancialClass | "";
  is_medico_legal: boolean;
  mlc_number: string;
  is_vip: boolean;
  address_line: string;
  city: string;
  state: string;
  pincode: string;
  known_allergies: string;
}

const DEFAULTS: FormShape = {
  prefix: "",
  first_name: "",
  middle_name: "",
  last_name: "",
  suffix: "",
  date_of_birth: null,
  gender: "unknown",
  marital_status: "",
  religion: "",
  blood_group: "",
  occupation: "",
  phone: "",
  phone_secondary: "",
  email: "",
  father_name: "",
  guardian_name: "",
  guardian_relation: "",
  category: "general",
  registration_type: "new",
  registration_source: "walk_in",
  financial_class: "",
  is_medico_legal: false,
  mlc_number: "",
  is_vip: false,
  address_line: "",
  city: "",
  state: "",
  pincode: "",
  known_allergies: "",
};

const PREFIX_OPTIONS = ["Mr.", "Mrs.", "Ms.", "Dr.", "Prof.", "Master", "Miss"];

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "unknown", label: "Unknown" },
];

const MARITAL_OPTIONS: { value: MaritalStatus; label: string }[] = [
  { value: "single", label: "Single" },
  { value: "married", label: "Married" },
  { value: "divorced", label: "Divorced" },
  { value: "widowed", label: "Widowed" },
  { value: "separated", label: "Separated" },
  { value: "domestic_partner", label: "Domestic Partner" },
  { value: "unknown", label: "Unknown" },
];

const BLOOD_OPTIONS: { value: BloodGroup; label: string }[] = [
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

const CATEGORY_OPTIONS: { value: PatientCategory; label: string }[] = [
  { value: "general", label: "General" },
  { value: "private", label: "Private" },
  { value: "insurance", label: "Insurance" },
  { value: "pmjay", label: "PMJAY" },
  { value: "cghs", label: "CGHS" },
  { value: "staff", label: "Staff" },
  { value: "vip", label: "VIP" },
  { value: "mlc", label: "MLC" },
  { value: "esi", label: "ESI" },
  { value: "corporate", label: "Corporate" },
  { value: "free", label: "Free" },
  { value: "charity", label: "Charity" },
  { value: "research_subject", label: "Research Subject" },
  { value: "staff_dependent", label: "Staff Dependent" },
];

const REG_TYPE_OPTIONS: { value: RegistrationType; label: string }[] = [
  { value: "new", label: "New" },
  { value: "revisit", label: "Revisit" },
  { value: "transfer_in", label: "Transfer In" },
  { value: "referral", label: "Referral" },
  { value: "emergency", label: "Emergency" },
  { value: "camp", label: "Camp" },
  { value: "telemedicine", label: "Telemedicine" },
  { value: "pre_registration", label: "Pre-Registration" },
];

const REG_SOURCE_OPTIONS: { value: RegistrationSource; label: string }[] = [
  { value: "walk_in", label: "Walk-in" },
  { value: "phone", label: "Phone" },
  { value: "online_portal", label: "Online Portal" },
  { value: "mobile_app", label: "Mobile App" },
  { value: "kiosk", label: "Kiosk" },
  { value: "referral", label: "Referral" },
  { value: "ambulance", label: "Ambulance" },
  { value: "camp", label: "Camp" },
  { value: "telemedicine", label: "Telemedicine" },
];

const FINANCIAL_OPTIONS: { value: FinancialClass; label: string }[] = [
  { value: "self_pay", label: "Self Pay" },
  { value: "insurance", label: "Insurance" },
  { value: "government_scheme", label: "Government Scheme" },
  { value: "corporate", label: "Corporate" },
  { value: "charity", label: "Charity" },
  { value: "research", label: "Research" },
];

function toIsoDate(d: Date | null): string | null {
  if (!d) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function buildRequest(values: FormShape): CreatePatientRequest {
  const address: Record<string, unknown> = {};
  if (values.address_line) address.line = values.address_line;
  if (values.city) address.city = values.city;
  if (values.state) address.state = values.state;
  if (values.pincode) address.pincode = values.pincode;

  const attributes: Record<string, unknown> = {};
  const allergies = values.known_allergies.trim();
  if (allergies) attributes.known_allergies = allergies;

  return {
    prefix: values.prefix || undefined,
    first_name: values.first_name.trim(),
    middle_name: values.middle_name || undefined,
    last_name: values.last_name.trim(),
    suffix: values.suffix || undefined,
    father_name: values.father_name || undefined,
    guardian_name: values.guardian_name || undefined,
    guardian_relation: values.guardian_relation || undefined,
    date_of_birth: toIsoDate(values.date_of_birth),
    gender: values.gender,
    marital_status: values.marital_status || undefined,
    religion: values.religion || undefined,
    blood_group: values.blood_group || undefined,
    occupation: values.occupation || undefined,
    phone: values.phone.trim(),
    phone_secondary: values.phone_secondary || undefined,
    email: values.email || null,
    address: Object.keys(address).length > 0 ? address : null,
    category: values.category || undefined,
    registration_type: values.registration_type || undefined,
    registration_source: values.registration_source || undefined,
    financial_class: values.financial_class || undefined,
    is_medico_legal: values.is_medico_legal || undefined,
    mlc_number: values.mlc_number || undefined,
    is_vip: values.is_vip || undefined,
    attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
  };
}

export function PatientRegistrationForm({
  quickMode = false,
  isSubmitting = false,
  onSubmit,
  onCancel,
  submitLabel = "Register",
}: PatientRegistrationFormProps) {
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormShape>({
    defaultValues: DEFAULTS,
  });

  const isMlc = watch("is_medico_legal");

  const submit = handleSubmit((values) => onSubmit(buildRequest(values)));

  return (
    <form onSubmit={submit} noValidate>
      <Stack gap="lg">
        <div>
          <Title order={5} mb="xs">
            Identity
          </Title>
          <Grid>
            <Grid.Col span={{ base: 12, sm: 2 }}>
              <Controller
                name="prefix"
                control={control}
                render={({ field }) => (
                  <Select
                    label="Prefix"
                    data={PREFIX_OPTIONS}
                    value={field.value || null}
                    onChange={(v) => field.onChange(v ?? "")}
                    clearable
                  />
                )}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <Controller
                name="first_name"
                control={control}
                rules={{
                  required: "First name required",
                  minLength: { value: 1, message: "First name required" },
                }}
                render={({ field }) => (
                  <TextInput
                    label="First Name"
                    required
                    {...field}
                    error={errors.first_name?.message}
                  />
                )}
              />
            </Grid.Col>
            {!quickMode && (
              <Grid.Col span={{ base: 12, sm: 3 }}>
                <Controller
                  name="middle_name"
                  control={control}
                  render={({ field }) => <TextInput label="Middle Name" {...field} />}
                />
              </Grid.Col>
            )}
            <Grid.Col span={{ base: 12, sm: 3 }}>
              <Controller
                name="last_name"
                control={control}
                rules={{ required: "Last name required" }}
                render={({ field }) => (
                  <TextInput
                    label="Last Name"
                    required
                    {...field}
                    error={errors.last_name?.message}
                  />
                )}
              />
            </Grid.Col>
            {!quickMode && (
              <Grid.Col span={{ base: 12, sm: 2 }}>
                <Controller
                  name="suffix"
                  control={control}
                  render={({ field }) => <TextInput label="Suffix" {...field} />}
                />
              </Grid.Col>
            )}
          </Grid>
        </div>

        <div>
          <Title order={5} mb="xs">
            Demographics
          </Title>
          <Grid>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <Controller
                name="date_of_birth"
                control={control}
                render={({ field }) => (
                  <DateInput
                    label="Date of Birth"
                    value={field.value}
                    onChange={(v) => field.onChange(v as unknown as Date | null)}
                    maxDate={new Date()}
                    clearable
                  />
                )}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <Controller
                name="gender"
                control={control}
                render={({ field }) => (
                  <Select
                    label="Gender"
                    required
                    data={GENDER_OPTIONS}
                    value={field.value}
                    onChange={(v) => field.onChange(v as Gender)}
                  />
                )}
              />
            </Grid.Col>
            {!quickMode && (
              <>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <Controller
                    name="marital_status"
                    control={control}
                    render={({ field }) => (
                      <Select
                        label="Marital Status"
                        data={MARITAL_OPTIONS}
                        value={field.value || null}
                        onChange={(v) => field.onChange((v as MaritalStatus | null) ?? "")}
                        clearable
                      />
                    )}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <Controller
                    name="religion"
                    control={control}
                    render={({ field }) => <TextInput label="Religion" {...field} />}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <Controller
                    name="blood_group"
                    control={control}
                    render={({ field }) => (
                      <Select
                        label="Blood Group"
                        data={BLOOD_OPTIONS}
                        value={field.value || null}
                        onChange={(v) => field.onChange((v as BloodGroup | null) ?? "")}
                        clearable
                      />
                    )}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <Controller
                    name="occupation"
                    control={control}
                    render={({ field }) => <TextInput label="Occupation" {...field} />}
                  />
                </Grid.Col>
              </>
            )}
          </Grid>
        </div>

        <div>
          <Title order={5} mb="xs">
            Contact
          </Title>
          <Grid>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Controller
                name="phone"
                control={control}
                rules={{
                  required: "Phone required",
                  pattern: { value: /^[+\d][\d\s-]{6,}$/, message: "Invalid phone" },
                }}
                render={({ field }) => (
                  <TextInput label="Phone" required {...field} error={errors.phone?.message} />
                )}
              />
            </Grid.Col>
            {!quickMode && (
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Controller
                  name="phone_secondary"
                  control={control}
                  render={({ field }) => <TextInput label="Secondary Phone" {...field} />}
                />
              </Grid.Col>
            )}
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Controller
                name="email"
                control={control}
                rules={{
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Invalid email" },
                }}
                render={({ field }) => (
                  <TextInput label="Email" type="email" {...field} error={errors.email?.message} />
                )}
              />
            </Grid.Col>
          </Grid>
        </div>

        <div>
          <Title order={5} mb="xs">
            Known allergies <span style={{ color: "var(--code-red)" }}>*</span>
          </Title>
          <Controller
            name="known_allergies"
            control={control}
            render={({ field }) => {
              const hasValue = field.value.trim().length > 0;
              const isNkda = field.value.trim().toLowerCase() === "nkda";
              return (
                <AllergyField
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Type known allergies, or 'NKDA' for no known drug allergies"
                  severity={hasValue ? "watch" : "blocking"}
                  badgeLabel={hasValue ? (isNkda ? "NKDA" : "Logged") : "Required"}
                  hint={
                    hasValue
                      ? undefined
                      : "Code-Red pulse: blocking field — required before any prescription can be issued"
                  }
                />
              );
            }}
          />
        </div>

        {!quickMode && (
          <>
            <div>
              <Title order={5} mb="xs">
                Family
              </Title>
              <Grid>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <Controller
                    name="father_name"
                    control={control}
                    render={({ field }) => <TextInput label="Father's Name" {...field} />}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <Controller
                    name="guardian_name"
                    control={control}
                    render={({ field }) => <TextInput label="Guardian Name" {...field} />}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <Controller
                    name="guardian_relation"
                    control={control}
                    render={({ field }) => <TextInput label="Guardian Relation" {...field} />}
                  />
                </Grid.Col>
              </Grid>
            </div>

            <div>
              <Title order={5} mb="xs">
                Address
              </Title>
              <Grid>
                <Grid.Col span={12}>
                  <Controller
                    name="address_line"
                    control={control}
                    render={({ field }) => (
                      <Textarea label="Address" autosize minRows={2} {...field} />
                    )}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <Controller
                    name="city"
                    control={control}
                    render={({ field }) => <TextInput label="City" {...field} />}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <Controller
                    name="state"
                    control={control}
                    render={({ field }) => <TextInput label="State" {...field} />}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <Controller
                    name="pincode"
                    control={control}
                    render={({ field }) => <TextInput label="Pincode" {...field} />}
                  />
                </Grid.Col>
              </Grid>
            </div>
          </>
        )}

        <div>
          <Title order={5} mb="xs">
            Registration
          </Title>
          <Grid>
            <Grid.Col span={{ base: 12, sm: 3 }}>
              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <Select
                    label="Category"
                    data={CATEGORY_OPTIONS}
                    value={field.value || null}
                    onChange={(v) => field.onChange((v as PatientCategory | null) ?? "")}
                  />
                )}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 3 }}>
              <Controller
                name="registration_type"
                control={control}
                render={({ field }) => (
                  <Select
                    label="Type"
                    data={REG_TYPE_OPTIONS}
                    value={field.value || null}
                    onChange={(v) => field.onChange((v as RegistrationType | null) ?? "")}
                  />
                )}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 3 }}>
              <Controller
                name="registration_source"
                control={control}
                render={({ field }) => (
                  <Select
                    label="Source"
                    data={REG_SOURCE_OPTIONS}
                    value={field.value || null}
                    onChange={(v) => field.onChange((v as RegistrationSource | null) ?? "")}
                  />
                )}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 3 }}>
              <Controller
                name="financial_class"
                control={control}
                render={({ field }) => (
                  <Select
                    label="Financial Class"
                    data={FINANCIAL_OPTIONS}
                    value={field.value || null}
                    onChange={(v) => field.onChange((v as FinancialClass | null) ?? "")}
                    clearable
                  />
                )}
              />
            </Grid.Col>
          </Grid>
        </div>

        {!quickMode && (
          <div>
            <Title order={5} mb="xs">
              Flags
            </Title>
            <Group>
              <Controller
                name="is_vip"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    label="VIP patient"
                    checked={field.value}
                    onChange={(e) => field.onChange(e.currentTarget.checked)}
                  />
                )}
              />
              <Controller
                name="is_medico_legal"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    label="Medico-Legal Case (MLC)"
                    checked={field.value}
                    onChange={(e) => field.onChange(e.currentTarget.checked)}
                  />
                )}
              />
              {isMlc && (
                <Controller
                  name="mlc_number"
                  control={control}
                  render={({ field }) => <TextInput label="MLC Number" {...field} />}
                />
              )}
            </Group>
          </div>
        )}

        <Divider />

        <Group justify="flex-end">
          <Button variant="subtle" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {submitLabel}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
