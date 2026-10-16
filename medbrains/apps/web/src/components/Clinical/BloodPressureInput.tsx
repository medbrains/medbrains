import { Group, Stack, Text } from "@mantine/core";
import {
  type BloodPressureErrors,
  DIASTOLIC_RANGE,
  SYSTOLIC_RANGE,
  validateBloodPressure,
} from "@medbrains/schemas";
import { useState } from "react";
import { NumberField } from "@/components/ui";

export interface BloodPressureValue {
  systolic?: number;
  diastolic?: number;
}

interface BloodPressureInputProps {
  value: BloodPressureValue;
  onChange: (next: BloodPressureValue) => void;
  /** Errors from the surrounding form (e.g. a zod refine) — shown over the field's own. */
  errors?: BloodPressureErrors;
  /** Show every error now, not only on fields already left — set after a failed submit. */
  showErrors?: boolean;
  label?: string;
  disabled?: boolean;
  size?: "xs" | "sm" | "md";
}

function toValue(v: string | number): number | undefined {
  return typeof v === "number" ? v : undefined;
}

/**
 * One blood-pressure reading as two numbers, side by side: systolic (high)
 * then diastolic (low), in mmHg. Tab moves from one to the other.
 */
export function BloodPressureInput({
  value,
  onChange,
  errors,
  showErrors = false,
  label = "Blood pressure",
  disabled,
  size = "sm",
}: BloodPressureInputProps) {
  const [left, setLeft] = useState({ systolic: false, diastolic: false });
  const own = validateBloodPressure(value.systolic, value.diastolic);
  const shown = (key: keyof BloodPressureErrors) =>
    errors?.[key] ?? (showErrors || left[key] ? own[key] : undefined);

  const field = (
    key: keyof BloodPressureValue,
    fieldLabel: string,
    range: typeof SYSTOLIC_RANGE | typeof DIASTOLIC_RANGE,
  ) => (
    <NumberField
      label={fieldLabel}
      value={value[key] ?? ""}
      onChange={(v) => onChange({ ...value, [key]: toValue(v) })}
      onBlur={() => setLeft((prev) => ({ ...prev, [key]: true }))}
      min={range.min}
      max={range.max}
      clampBehavior="none"
      allowDecimal={false}
      allowNegative={false}
      hideControls
      rightSection={
        <Text size="xs" c="dimmed">
          mmHg
        </Text>
      }
      rightSectionWidth={48}
      error={shown(key)}
      disabled={disabled}
      size={size}
      data-testid={`bp-${key}`}
    />
  );

  return (
    <Stack gap={4} role="group" aria-label={label}>
      <Text size="sm" fw={500}>
        {label}
      </Text>
      <Group grow gap="xs" align="flex-start" wrap="nowrap">
        {field("systolic", "Systolic (high)", SYSTOLIC_RANGE)}
        {field("diastolic", "Diastolic (low)", DIASTOLIC_RANGE)}
      </Group>
    </Stack>
  );
}
