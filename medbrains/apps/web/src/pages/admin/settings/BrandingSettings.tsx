import { useState } from "react";
import {
  Button,
  ColorInput,
  Group,
  Loader,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCheck, IconDeviceFloppy } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type { TenantSettingsRow } from "@medbrains/types";

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

// ── Types ──────────────────────────────────────────────────

type BrandingForm = {
  primary_color: string;
  secondary_color: string;
  logo_url: string;
};

// ── Helpers ────────────────────────────────────────────────

function parseBrandingSettings(rows: TenantSettingsRow[]): BrandingForm {
  const find = (key: string): string => {
    const row = rows.find((r) => r.key === key);
    return typeof row?.value === "string" ? row.value : "";
  };

  return {
    primary_color: find("primary_color") || DEFAULT_PRIMARY,
    secondary_color: find("secondary_color") || DEFAULT_SECONDARY,
    logo_url: find("logo_url"),
  };
}

// ── Component ──────────────────────────────────────────────

export function BrandingSettings() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<BrandingForm | null>(null);

  const {
    data: settings,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["setup-branding"],
    queryFn: () => api.getBranding(),
    select: (data: TenantSettingsRow[]) => {
      if (form === null) {
        setForm(parseBrandingSettings(data));
      }
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: async (formData: BrandingForm) => {
      const original = parseBrandingSettings(settings ?? []);
      const entries: { key: string; value: string }[] = [];

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
        await api.updateBranding(entry);
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

  const handleSave = () => {
    if (!form) return;
    mutation.mutate(form);
  };

  const updateField = <K extends keyof BrandingForm>(
    key: K,
    value: BrandingForm[K],
  ) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

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

  if (!form) {
    return null;
  }

  // ── Render ─────────────────────────────────────────────

  return (
    <Stack gap="lg">
      <Text fw={600} size="lg">
        Branding Colors
      </Text>

      <Group grow align="flex-start">
        <ColorInput
          label="Primary Color"
          description="Main brand color used for headers, buttons, and accents."
          format="hex"
          swatches={COLOR_SWATCHES}
          value={form.primary_color}
          onChange={(value) => updateField("primary_color", value)}
        />
        <ColorInput
          label="Secondary Color"
          description="Secondary color used for text, borders, and supporting elements."
          format="hex"
          swatches={COLOR_SWATCHES}
          value={form.secondary_color}
          onChange={(value) => updateField("secondary_color", value)}
        />
      </Group>

      <Text fw={600} size="lg" mt="md">
        Logo
      </Text>

      <TextInput
        label="Logo URL"
        description="URL to your hospital logo image. Leave empty to use the default."
        placeholder="https://..."
        value={form.logo_url}
        onChange={(e) => updateField("logo_url", e.currentTarget.value)}
        maw={480}
      />

      <Text fw={600} size="lg" mt="md">
        Preview
      </Text>

      <div
        style={{
          backgroundColor: form.primary_color,
          color: form.secondary_color,
          padding: "24px 32px",
          borderRadius: 8,
          maxWidth: 480,
        }}
      >
        <Text fw={700} size="xl" c="inherit">
          Hospital Name
        </Text>
        <Text size="sm" c="inherit" mt={4}>
          This is a preview of how your primary and secondary colors look
          together.
        </Text>
      </div>

      <Group mt="md">
        <Button
          leftSection={<IconDeviceFloppy size={16} />}
          onClick={handleSave}
          loading={mutation.isPending}
        >
          Save Branding
        </Button>
      </Group>
    </Stack>
  );
}
