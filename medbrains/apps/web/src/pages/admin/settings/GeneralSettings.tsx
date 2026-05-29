import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Group, Loader, Select, Stack, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { type GeneralSettingsFormInput, generalSettingsFormSchema } from "@medbrains/schemas";
import type { TenantSummary } from "@medbrains/types";
import { IconCheck, IconDeviceFloppy } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { tenantSettingsService } from "@/services/tenantSettings.service";

const TIMEZONE_OPTIONS = [
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST, UTC+5:30)" },
  { value: "Asia/Dhaka", label: "Asia/Dhaka (BST, UTC+6:00)" },
  { value: "Asia/Karachi", label: "Asia/Karachi (PKT, UTC+5:00)" },
  { value: "Asia/Colombo", label: "Asia/Colombo (IST, UTC+5:30)" },
  { value: "Asia/Kathmandu", label: "Asia/Kathmandu (NPT, UTC+5:45)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GST, UTC+4:00)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT, UTC+8:00)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (JST, UTC+9:00)" },
  { value: "Asia/Shanghai", label: "Asia/Shanghai (CST, UTC+8:00)" },
  { value: "Europe/London", label: "Europe/London (GMT/BST, UTC+0/+1)" },
  { value: "Europe/Berlin", label: "Europe/Berlin (CET, UTC+1:00)" },
  { value: "America/New_York", label: "America/New_York (EST, UTC-5:00)" },
  { value: "America/Chicago", label: "America/Chicago (CST, UTC-6:00)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (PST, UTC-8:00)" },
  { value: "Africa/Nairobi", label: "Africa/Nairobi (EAT, UTC+3:00)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (AEST, UTC+10:00)" },
  { value: "Pacific/Auckland", label: "Pacific/Auckland (NZST, UTC+12:00)" },
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
];

const CURRENCY_OPTIONS = [
  { value: "INR", label: "INR - Indian Rupee" },
  { value: "USD", label: "USD - US Dollar" },
  { value: "GBP", label: "GBP - British Pound" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "AED", label: "AED - UAE Dirham" },
  { value: "BDT", label: "BDT - Bangladeshi Taka" },
  { value: "PKR", label: "PKR - Pakistani Rupee" },
  { value: "LKR", label: "LKR - Sri Lankan Rupee" },
  { value: "NPR", label: "NPR - Nepalese Rupee" },
  { value: "SGD", label: "SGD - Singapore Dollar" },
  { value: "AUD", label: "AUD - Australian Dollar" },
];

const MONTH_OPTIONS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const EMPTY_FORM: GeneralSettingsFormInput = {
  address_line1: "",
  address_line2: "",
  city: "",
  pincode: "",
  phone: "",
  email: "",
  website: "",
  registration_no: "",
  accreditation: "",
  timezone: "Asia/Kolkata",
  currency: "INR",
  fy_start_month: "4",
};

function tenantToFormState(tenant: TenantSummary): GeneralSettingsFormInput {
  return {
    address_line1: tenant.address_line1 ?? "",
    address_line2: tenant.address_line2 ?? "",
    city: tenant.city ?? "",
    pincode: tenant.pincode ?? "",
    phone: tenant.phone ?? "",
    email: tenant.email ?? "",
    website: tenant.website ?? "",
    registration_no: tenant.registration_no ?? "",
    accreditation: tenant.accreditation ?? "",
    timezone: tenant.timezone,
    currency: tenant.currency,
    fy_start_month: String(tenant.fy_start_month),
  };
}

function formStateToPayload(form: GeneralSettingsFormInput): Partial<TenantSummary> {
  return {
    address_line1: form.address_line1.trim() || null,
    address_line2: form.address_line2.trim() || null,
    city: form.city.trim() || null,
    pincode: form.pincode.trim() || null,
    phone: form.phone.trim() || null,
    email: form.email?.trim() || null,
    website: form.website.trim() || null,
    registration_no: form.registration_no.trim() || null,
    accreditation: form.accreditation.trim() || null,
    timezone: form.timezone,
    currency: form.currency,
    fy_start_month: Number(form.fy_start_month),
  };
}

export function GeneralSettings() {
  const queryClient = useQueryClient();
  const {
    data: tenant,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["tenant"],
    queryFn: () => tenantSettingsService.getTenant(),
  });
  const formValues = useMemo(() => (tenant ? tenantToFormState(tenant) : EMPTY_FORM), [tenant]);

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<GeneralSettingsFormInput>({
    resolver: zodResolver(generalSettingsFormSchema),
    defaultValues: EMPTY_FORM,
    values: formValues,
  });

  const mutation = useMutation({
    mutationFn: (data: ReturnType<typeof formStateToPayload>) =>
      tenantSettingsService.updateTenant(data),
    onSuccess: (updated) => {
      queryClient.setQueryData(["tenant"], updated);
      notifications.show({
        title: "Settings saved",
        message: "General settings have been updated successfully.",
        color: "success",
        icon: <IconCheck size={16} />,
      });
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Save failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const submitSettings = handleSubmit((form) => {
    mutation.mutate(formStateToPayload(form));
  });

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="lg" />
        <Text c="dimmed">Loading tenant settings...</Text>
      </Stack>
    );
  }

  if (isError) {
    return (
      <Stack align="center" py="xl">
        <Text c="danger">
          Failed to load settings: {error instanceof Error ? error.message : "Unknown error"}
        </Text>
      </Stack>
    );
  }

  if (!tenant) {
    return null;
  }

  return (
    <Stack gap="lg">
      <Text fw={600} size="lg">
        Hospital Details
      </Text>

      <Group grow align="flex-start">
        <TextInput
          label="Hospital Name"
          value={tenant.name}
          readOnly
          variant="filled"
          description="Hospital name cannot be changed here."
        />
        <TextInput
          label="Hospital Code"
          value={tenant.code}
          readOnly
          variant="filled"
          description="Unique tenant code is set during onboarding."
        />
      </Group>

      <Group grow align="flex-start">
        <TextInput
          label="Address Line 1"
          placeholder="Street address"
          error={errors.address_line1?.message}
          {...register("address_line1")}
        />
        <TextInput
          label="Address Line 2"
          placeholder="Building, floor, etc."
          error={errors.address_line2?.message}
          {...register("address_line2")}
        />
      </Group>

      <Group grow align="flex-start">
        <TextInput
          label="City"
          placeholder="City name"
          error={errors.city?.message}
          {...register("city")}
        />
        <TextInput
          label="Pincode"
          placeholder="Postal code"
          error={errors.pincode?.message}
          {...register("pincode")}
        />
      </Group>

      <Group grow align="flex-start">
        <TextInput
          label="Phone"
          placeholder="+91 XXXXXXXXXX"
          error={errors.phone?.message}
          {...register("phone")}
        />
        <TextInput
          label="Email"
          placeholder="hospital@example.com"
          error={errors.email?.message}
          {...register("email")}
        />
      </Group>

      <Group grow align="flex-start">
        <TextInput
          label="Website"
          placeholder="https://www.hospital.com"
          error={errors.website?.message}
          {...register("website")}
        />
        <TextInput
          label="Registration No."
          placeholder="Hospital registration number"
          error={errors.registration_no?.message}
          {...register("registration_no")}
        />
      </Group>

      <TextInput
        label="Accreditation"
        placeholder="NABH, JCI, etc."
        error={errors.accreditation?.message}
        {...register("accreditation")}
      />

      <Text fw={600} size="lg" mt="md">
        Regional & Financial
      </Text>

      <Group grow align="flex-start">
        <Controller
          control={control}
          name="timezone"
          render={({ field }) => (
            <Select
              label="Timezone"
              data={TIMEZONE_OPTIONS}
              value={field.value}
              onChange={(value) => field.onChange(value ?? "UTC")}
              error={errors.timezone?.message}
              searchable
              allowDeselect={false}
            />
          )}
        />
        <Controller
          control={control}
          name="currency"
          render={({ field }) => (
            <Select
              label="Currency"
              data={CURRENCY_OPTIONS}
              value={field.value}
              onChange={(value) => field.onChange(value ?? "INR")}
              error={errors.currency?.message}
              searchable
              allowDeselect={false}
            />
          )}
        />
      </Group>

      <Controller
        control={control}
        name="fy_start_month"
        render={({ field }) => (
          <Select
            label="Financial Year Start Month"
            description="The month when your hospital's financial year begins."
            data={MONTH_OPTIONS}
            value={field.value}
            onChange={(value) => field.onChange(value ?? "4")}
            error={errors.fy_start_month?.message}
            allowDeselect={false}
            maw={300}
          />
        )}
      />

      <Group mt="md">
        <Button
          leftSection={<IconDeviceFloppy size={16} />}
          onClick={() => void submitSettings()}
          loading={mutation.isPending}
        >
          Save Settings
        </Button>
      </Group>
    </Stack>
  );
}
