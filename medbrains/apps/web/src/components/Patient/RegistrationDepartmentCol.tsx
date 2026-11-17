import { Grid, Select } from "@mantine/core";
import type { PatientRegistrationFormInput } from "@medbrains/schemas";
import { type Control, Controller, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { soleOption } from "@/lib/sole-option";

interface RegistrationDepartmentColProps {
  control: Control<PatientRegistrationFormInput>;
  options: { value: string; label: string }[];
  error?: string;
}

/**
 * The registration department picker. Renders nothing when the hospital has one
 * department: the form submits that one, so the desk is not asked.
 */
export function RegistrationDepartmentCol({
  control,
  options,
  error,
}: RegistrationDepartmentColProps) {
  const { t } = useTranslation("patients");
  const current = useWatch({ control, name: "department_id" });
  if (soleOption(options, current)) return null;
  return (
    <Grid.Col span={{ base: 12, sm: 5 }}>
      <Controller
        control={control}
        name="department_id"
        render={({ field }) => (
          <Select
            aria-label={t("registrationForm.aria.department")}
            placeholder={t("registrationForm.placeholder.department")}
            data-testid="picker-department"
            data={options}
            value={field.value ?? null}
            onChange={(v) => field.onChange(v ?? undefined)}
            error={error}
            searchable
            clearable
          />
        )}
      />
    </Grid.Col>
  );
}
