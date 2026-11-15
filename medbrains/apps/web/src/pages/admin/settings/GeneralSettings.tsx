import { zodResolver } from "@hookform/resolvers/zod";
import { Anchor, Group, Loader, Stack, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { type GeneralSettingsFormInput, generalSettingsFormSchema } from "@medbrains/schemas";
import type { TenantSummary } from "@medbrains/types";
import { IconCheck, IconDeviceFloppy } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router";
import { Button } from "@/components/ui";
import { tenantSettingsService } from "@/services/tenantSettings.service";

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
  custom_domain: "",
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
    custom_domain: tenant.custom_domain ?? "",
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
    // Empty string clears the domain (backend NULLIFs it); a value sets it.
    custom_domain: form.custom_domain.trim(),
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
        Custom Domain
      </Text>
      <TextInput
        label="Domain"
        placeholder="hms.hospital.com"
        description="Serve MedBrains on your hospital's own domain. Point its DNS to the MedBrains edge and have IT add the TLS certificate; the login page then resolves this hospital automatically. Leave blank to use the default address."
        error={errors.custom_domain?.message}
        {...register("custom_domain")}
      />

      <Text fw={600} size="lg" mt="md">
        Regional & Financial
      </Text>
      <Text size="sm">
        Time zone {tenant.timezone}, currency {tenant.currency}, fiscal year from month{" "}
        {tenant.fy_start_month}. These are part of the locale profile and change on{" "}
        <Anchor component={Link} to="/admin/settings#locale-profile">
          Locale profile
        </Anchor>
        , where a second person approves each change.
      </Text>

      <Group mt="md">
        <Button
          tone="primary"
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
