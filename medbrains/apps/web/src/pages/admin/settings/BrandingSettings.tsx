import { zodResolver } from "@hookform/resolvers/zod";
import { ColorInput, Group, Loader, Stack, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { type BrandingSettingsFormInput, brandingSettingsFormSchema } from "@medbrains/schemas";
import type { TenantSettingsRow } from "@medbrains/types";
import { IconCheck, IconDeviceFloppy } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui";
import { tenantSettingsService } from "@/services/tenantSettings.service";

// ── Constants ──────────────────────────────────────────────

const COLOR_SWATCHES = [
  "#0D9488", // Teal 600
  "#0F766E", // Teal 700
  "#14B8A6", // Teal 500
  "#2563EB", // Blue 600
  "#1D4ED8", // Blue 700
  "#3B82F6", // Blue 500
  "#059669", // Emerald 600
  "#047857", // Emerald 700
  "#10B981", // Emerald 500
  "#7C3AED", // Violet 600
  "#6D28D9", // Violet 700
  "#8B5CF6", // Violet 500
  "#DC2626", // Red 600
  "#EA580C", // Orange 600
  "#1E293B", // Slate 800
  "#334155", // Slate 700
];

const DEFAULT_PRIMARY = "#0D9488";
const DEFAULT_SECONDARY = "#1E293B";

const EMPTY_FORM: BrandingSettingsFormInput = {
  display_name: "",
  primary_color: DEFAULT_PRIMARY,
  secondary_color: DEFAULT_SECONDARY,
  logo_url: "",
};

// ── Helpers ────────────────────────────────────────────────

function parseBrandingSettings(rows: TenantSettingsRow[]): BrandingSettingsFormInput {
  const find = (key: string): string => {
    const row = rows.find((r) => r.key === key);
    return typeof row?.value === "string" ? row.value : "";
  };

  return {
    display_name: find("display_name"),
    primary_color: find("primary_color") || DEFAULT_PRIMARY,
    secondary_color: find("secondary_color") || DEFAULT_SECONDARY,
    logo_url: find("logo_url"),
  };
}

// ── Component ──────────────────────────────────────────────

export function BrandingSettings() {
  const queryClient = useQueryClient();

  const {
    data: settings,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["setup-branding"],
    queryFn: () => tenantSettingsService.getBranding(),
  });
  const formValues = useMemo(
    () => (settings ? parseBrandingSettings(settings) : EMPTY_FORM),
    [settings],
  );
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    watch,
  } = useForm<BrandingSettingsFormInput>({
    resolver: zodResolver(brandingSettingsFormSchema),
    defaultValues: EMPTY_FORM,
    values: formValues,
  });

  const mutation = useMutation({
    mutationFn: async (formData: BrandingSettingsFormInput) => {
      const original = parseBrandingSettings(settings ?? []);
      const entries: { key: string; value: string }[] = [];

      if (formData.display_name !== original.display_name) {
        entries.push({ key: "display_name", value: formData.display_name });
      }
      if (formData.primary_color !== original.primary_color) {
        entries.push({ key: "primary_color", value: formData.primary_color });
      }
      if (formData.secondary_color !== original.secondary_color) {
        entries.push({
          key: "secondary_color",
          value: formData.secondary_color,
        });
      }
      if (formData.logo_url !== original.logo_url) {
        entries.push({ key: "logo_url", value: formData.logo_url });
      }

      for (const entry of entries) {
        await tenantSettingsService.updateBranding(entry);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["setup-branding"] });
      notifications.show({
        title: "Branding saved",
        message: "Your branding settings have been updated successfully.",
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

  const submitBranding = handleSubmit((form) => {
    mutation.mutate({
      display_name: form.display_name.trim(),
      primary_color: form.primary_color.trim(),
      secondary_color: form.secondary_color.trim(),
      logo_url: form.logo_url.trim(),
    });
  });
  const primaryColor = watch("primary_color");
  const secondaryColor = watch("secondary_color");

  // ── Loading / Error states ─────────────────────────────

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="lg" />
        <Text c="dimmed">Loading branding settings...</Text>
      </Stack>
    );
  }

  if (isError) {
    return (
      <Stack align="center" py="xl">
        <Text c="danger">
          Failed to load branding settings:{" "}
          {error instanceof Error ? error.message : "Unknown error"}
        </Text>
      </Stack>
    );
  }

  if (!settings) {
    return null;
  }

  // ── Render ─────────────────────────────────────────────

  return (
    <Stack gap="lg">
      <TextInput
        label="Hospital display name"
        description="Shown in the app header as the brand (e.g. 'City General Hospital'). Falls back to MedBrains HMS when empty."
        placeholder="City General Hospital"
        error={errors.display_name?.message}
        {...register("display_name")}
      />

      <Text fw={600} size="lg">
        Branding Colors
      </Text>

      <Group grow align="flex-start">
        <Controller
          control={control}
          name="primary_color"
          render={({ field }) => (
            <ColorInput
              label="Primary Color"
              description="Main brand color used for headers, buttons, and accents."
              format="hex"
              swatches={COLOR_SWATCHES}
              value={field.value}
              onChange={field.onChange}
              error={errors.primary_color?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="secondary_color"
          render={({ field }) => (
            <ColorInput
              label="Secondary Color"
              description="Secondary color used for text, borders, and supporting elements."
              format="hex"
              swatches={COLOR_SWATCHES}
              value={field.value}
              onChange={field.onChange}
              error={errors.secondary_color?.message}
            />
          )}
        />
      </Group>

      <Text fw={600} size="lg" mt="md">
        Logo
      </Text>

      <TextInput
        label="Logo URL"
        description="URL to your hospital logo image. Leave empty to use the default."
        placeholder="https://..."
        error={errors.logo_url?.message}
        {...register("logo_url")}
        maw={480}
      />

      <Text fw={600} size="lg" mt="md">
        Preview
      </Text>

      <div
        style={{
          backgroundColor: primaryColor,
          color: secondaryColor,
          padding: "24px 32px",
          borderRadius: 8,
          maxWidth: 480,
        }}
      >
        <Text fw={700} size="xl" c="inherit">
          Hospital Name
        </Text>
        <Text size="sm" c="inherit" mt={4}>
          This is a preview of how your primary and secondary colors look together.
        </Text>
      </div>

      <Group mt="md">
        <Button
          tone="primary"
          leftSection={<IconDeviceFloppy size={16} />}
          onClick={() => void submitBranding()}
          loading={mutation.isPending}
        >
          Save Branding
        </Button>
      </Group>
    </Stack>
  );
}
