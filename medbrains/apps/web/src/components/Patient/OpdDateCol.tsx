// OpdDateCol — the paper register's date beside the number typed at registration.

import { Grid } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import type { PatientRegistrationFormInput } from "@medbrains/schemas";
import { isoDay } from "@medbrains/schemas";
import { Controller, useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";

/**
 * The register date beside a per-patient OPD number or a typed UHID: today, or the day in the paper
 * register when the hospital allows an earlier date and the desk may backdate.
 * Never after today.
 */
export function OpdDateCol({ label, mayBackdate }: { label: string; mayBackdate: boolean }) {
  const { t } = useTranslation("patients");
  const { control } = useFormContext<PatientRegistrationFormInput>();
  const today = new Date();
  return (
    <Grid.Col span={{ base: 12, sm: 6 }}>
      <Controller
        control={control}
        name="opd_date"
        render={({ field }) => (
          <DatePickerInput
            label={label}
            data-testid="field-opd_date"
            description={
              mayBackdate
                ? t("opdNumber.dateHelp", "The date in the paper register. Today if new.")
                : t("opdNumber.dateToday", "Today")
            }
            value={field.value ? new Date(field.value) : today}
            onChange={(value) => field.onChange(value ? isoDay(new Date(value)) : undefined)}
            maxDate={today}
            readOnly={!mayBackdate}
            valueFormat="DD MMM YYYY"
          />
        )}
      />
    </Grid.Col>
  );
}
