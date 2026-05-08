import { Button, Group, Loader, Select, Stack, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { api } from "@medbrains/api";
import type { TenantSummary } from "@medbrains/types";
import { IconCheck, IconDeviceFloppy } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

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

type FormState = {
  address_line1: string;
  address_line2: string;
  city: string;
  pincode: string;
  phone: string;
  email: string;
  website: string;
  registration_no: string;
  accreditation: string;
  timezone: string;
  currency: string;
  fy_start_month: number;
};

function tenantToFormState(tenant: TenantSummary): FormState {
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
    fy_start_month: tenant.fy_start_month,
  };
}

function formStateToPayload(form: FormState): Partial<TenantSummary> {
  return {
    address_line1: form.address_line1 || null,
    address_line2: form.address_line2 || null,
    city: form.city || null,
    pincode: form.pincode || null,
    phone: form.phone || null,
    email: form.email || null,
    website: form.website || null,
    registration_no: form.registration_no || null,
    accreditation: form.accreditation || null,
    timezone: form.timezone,
    currency: form.currency,
    fy_start_month: form.fy_start_month,
  };
}

export function GeneralSettings() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);

  const {
    data: tenant,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["tenant"],
    queryFn: () => api.getTenant(),
    select: (data) => {
      // Initialize form state from fetched data on first load
      if (form === null) {
        setForm(tenantToFormState(data));
      }
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: (data: Partial<TenantSummary>) => api.updateTenant(data),
    onSuccess: (updated) => {
      queryClient.setQueryData(["tenant"], updated);
      setForm(tenantToFormState(updated));
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

  const handleSave = () => {
    if (!form) return;
    mutation.mutate(formStateToPayload(form));
  };

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

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

  if (!tenant || !form) {
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
          value={form.address_line1}
          onChange={(e) => updateField("address_line1", e.currentTarget.value)}
        />
        <TextInput
          label="Address Line 2"
          placeholder="Building, floor, etc."
          value={form.address_line2}
          onChange={(e) => updateField("address_line2", e.currentTarget.value)}
        />
      </Group>

      <Group grow align="flex-start">
        <TextInput
          label="City"
          placeholder="City name"
          value={form.city}
          onChange={(e) => updateField("city", e.currentTarget.value)}
        />
        <TextInput
          label="Pincode"
          placeholder="Postal code"
          value={form.pincode}
          onChange={(e) => updateField("pincode", e.currentTarget.value)}
        />
      </Group>

      <Group grow align="flex-start">
        <TextInput
          label="Phone"
          placeholder="+91 XXXXXXXXXX"
          value={form.phone}
          onChange={(e) => updateField("phone", e.currentTarget.value)}
        />
        <TextInput
          label="Email"
          placeholder="hospital@example.com"
          value={form.email}
          onChange={(e) => updateField("email", e.currentTarget.value)}
        />
      </Group>

      <Group grow align="flex-start">
        <TextInput
          label="Website"
          placeholder="https://www.hospital.com"
          value={form.website}
          onChange={(e) => updateField("website", e.currentTarget.value)}
        />
        <TextInput
          label="Registration No."
          placeholder="Hospital registration number"
          value={form.registration_no}
          onChange={(e) => updateField("registration_no", e.currentTarget.value)}
        />
      </Group>

      <TextInput
        label="Accreditation"
        placeholder="NABH, JCI, etc."
        value={form.accreditation}
        onChange={(e) => updateField("accreditation", e.currentTarget.value)}
      />

      <Text fw={600} size="lg" mt="md">
        Regional & Financial
      </Text>

      <Group grow align="flex-start">
        <Select
          label="Timezone"
          data={TIMEZONE_OPTIONS}
          value={form.timezone}
          onChange={(value) => updateField("timezone", value ?? "UTC")}
          searchable
          allowDeselect={false}
        />
        <Select
          label="Currency"
          data={CURRENCY_OPTIONS}
          value={form.currency}
          onChange={(value) => updateField("currency", value ?? "INR")}
          searchable
          allowDeselect={false}
        />
      </Group>

      <Select
        label="Financial Year Start Month"
        description="The month when your hospital's financial year begins."
        data={MONTH_OPTIONS}
        value={String(form.fy_start_month)}
        onChange={(value) => updateField("fy_start_month", Number(value ?? "4"))}
        allowDeselect={false}
        maw={300}
      />

      <Group mt="md">
        <Button
          leftSection={<IconDeviceFloppy size={16} />}
          onClick={handleSave}
          loading={mutation.isPending}
        >
          Save Settings
        </Button>
      </Group>
    </Stack>
  );
}
