import { useMemo } from "react";
import {
  Group,
  Loader,
  Radio,
  Stack,
  Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCheck, IconRuler2 } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useLocaleStore } from "@medbrains/stores";
import type { TenantSettingsRow } from "@medbrains/types";

export function UnitsLocaleSettings() {
  const queryClient = useQueryClient();

  // Load current units settings
  const { data: unitsRows, isLoading: unitsLoading } = useQuery({
    queryKey: ["tenant-settings", "units"],
    queryFn: () => api.getTenantSettings("units"),
    staleTime: 60_000,
  });

  const { data: localeRows, isLoading: localeLoading } = useQuery({
    queryKey: ["tenant-settings", "locale"],
    queryFn: () => api.getTenantSettings("locale"),
    staleTime: 60_000,
  });

  // Extract current values from tenant settings
  const currentValues = useMemo(() => {
    const values: Record<string, string> = {
      measurement_system: "metric",
      temperature_unit: "celsius",
      weight_unit: "kg",
      height_unit: "cm",
      date_format: "DD/MM/YYYY",
    };

    for (const row of unitsRows ?? []) {
      const val = typeof row.value === "string" ? row.value : null;
      if (val && row.key in values) {
        values[row.key] = val;
      }
    }

    for (const row of localeRows ?? []) {
      const val = typeof row.value === "string" ? row.value : null;
      if (val && row.key in values) {
        values[row.key] = val;
      }
    }

    return values;
  }, [unitsRows, localeRows]);

  // Mutation to save a setting
  const saveMutation = useMutation({
    mutationFn: (data: { category: string; key: string; value: string }) =>
      api.updateTenantSetting({
        category: data.category,
        key: data.key,
        value: data.value,
      }),
    onSuccess: (_: TenantSettingsRow, variables: { category: string; key: string; value: string }) => {
      notifications.show({
        title: "Setting saved",
        message: `${variables.key.replace(/_/g, " ")} updated`,
        color: "success",
        icon: <IconCheck size={16} />,
        autoClose: 2000,
      });
      void queryClient.invalidateQueries({ queryKey: ["tenant-settings", variables.category] });

      // Update locale store in real-time
      const allRows = [
        ...(unitsRows ?? []),
        ...(localeRows ?? []),
        { category: variables.category, key: variables.key, value: variables.value },
      ];
      useLocaleStore.getState().setFromTenantSettings(
        allRows.map((r) => ({
          category: r.category,
          key: r.key,
          value: r.value,
        })),
      );
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Save failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const handleChange = (category: string, key: string, value: string) => {
    saveMutation.mutate({ category, key, value });
  };

  // When measurement system changes, also update dependent units
  const handleSystemChange = (value: string) => {
    handleChange("units", "measurement_system", value);
    if (value === "imperial") {
      handleChange("units", "temperature_unit", "fahrenheit");
      handleChange("units", "weight_unit", "lbs");
      handleChange("units", "height_unit", "in");
    } else {
      handleChange("units", "temperature_unit", "celsius");
      handleChange("units", "weight_unit", "kg");
      handleChange("units", "height_unit", "cm");
    }
  };

  if (unitsLoading || localeLoading) {
    return <Loader />;
  }

  return (
    <Stack gap="lg">
      <div>
        <Group gap="xs" mb="xs">
          <IconRuler2 size={20} />
          <Text fw={600} size="lg">
            Units & Locale
          </Text>
        </Group>
        <Text size="sm" c="dimmed" mb="md">
          Configure measurement units and locale preferences. These settings are
          auto-configured when you change the country in Geography settings but
          can be overridden here.
        </Text>
      </div>

      <Stack gap="xl" maw={480}>
        {/* Measurement System */}
        <Radio.Group
          label="Measurement System"
          value={currentValues.measurement_system}
          onChange={handleSystemChange}
        >
          <Stack gap="xs" mt="xs">
            <Radio value="metric" label="Metric (kg, cm, °C)" />
            <Radio value="imperial" label="Imperial (lbs, in, °F)" />
          </Stack>
        </Radio.Group>

        {/* Temperature */}
        <Radio.Group
          label="Temperature Unit"
          value={currentValues.temperature_unit}
          onChange={(v) => handleChange("units", "temperature_unit", v)}
        >
          <Stack gap="xs" mt="xs">
            <Radio value="celsius" label="Celsius (°C)" />
            <Radio value="fahrenheit" label="Fahrenheit (°F)" />
          </Stack>
        </Radio.Group>

        {/* Weight */}
        <Radio.Group
          label="Weight Unit"
          value={currentValues.weight_unit}
          onChange={(v) => handleChange("units", "weight_unit", v)}
        >
          <Stack gap="xs" mt="xs">
            <Radio value="kg" label="Kilograms (kg)" />
            <Radio value="lbs" label="Pounds (lbs)" />
          </Stack>
        </Radio.Group>

        {/* Height */}
        <Radio.Group
          label="Height Unit"
          value={currentValues.height_unit}
          onChange={(v) => handleChange("units", "height_unit", v)}
        >
          <Stack gap="xs" mt="xs">
            <Radio value="cm" label="Centimeters (cm)" />
            <Radio value="in" label="Inches (in)" />
          </Stack>
        </Radio.Group>

        {/* Date Format */}
        <Radio.Group
          label="Date Format"
          value={currentValues.date_format}
          onChange={(v) => handleChange("locale", "date_format", v)}
        >
          <Stack gap="xs" mt="xs">
            <Radio value="DD/MM/YYYY" label="DD/MM/YYYY (31/01/2026)" />
            <Radio value="MM/DD/YYYY" label="MM/DD/YYYY (01/31/2026)" />
            <Radio value="YYYY-MM-DD" label="YYYY-MM-DD (2026-01-31)" />
          </Stack>
        </Radio.Group>
      </Stack>
    </Stack>
  );
}
