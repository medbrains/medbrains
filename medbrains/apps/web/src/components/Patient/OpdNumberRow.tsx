// OpdNumberRow — the hospital OPD number at registration, with its register date.

import { Grid, TextInput } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import type { PatientRegistrationFormInput } from "@medbrains/schemas";
import { isoDay } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { OpdNumberView } from "@medbrains/types";
import { P } from "@medbrains/types";
import { type QueryClient, useQuery } from "@tanstack/react-query";
import { Controller, useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { FormRow } from "@/components/ClinicalForm";
import { patientsService } from "@/services/patients.service";

/** The query key every OPD number reader shares, so a refusal can refresh it. */
export const OPD_NUMBER_QUERY_KEY = ["registration-opd-number"];

/**
 * What registration sends for the OPD number: in manual mode what the field
 * shows (the typed number, else the pre-filled next one), so an untouched
 * field saves the number the desk saw; in auto mode nothing (the server picks).
 * The date only where the number is per patient.
 */
export function opdNumberFields(
  client: QueryClient,
  values: { opd_number?: string; opd_date?: string },
): { opd_number?: string; opd_date?: string } {
  const view = client.getQueryData<OpdNumberView>(OPD_NUMBER_QUERY_KEY);
  if (!view || view.mode === "off") return {};
  const typed = values.opd_number ?? view.next;
  return {
    opd_number: view.mode === "manual" ? typed.trim() || undefined : undefined,
    opd_date: view.scope === "patient" ? values.opd_date : undefined,
  };
}

/**
 * The OPD number row of the registration form, hidden when the hospital keeps
 * none. Manual: the next free number is filled in with Previous/Next beside it
 * and the desk may type any unused one. Auto: read-only, given on save. Per
 * patient it carries the OPD date, earlier than today only where the hospital
 * allows it and the desk may backdate. Per visit it is saved with the visit.
 */
export function OpdNumberRow() {
  const { t } = useTranslation("patients");
  const canRegister = useHasPermission(P.PATIENTS.CREATE);
  const canBackdate = useHasPermission(P.PATIENTS.OPD_NUMBER.BACKDATE);
  const { control, formState } = useFormContext<PatientRegistrationFormInput>();
  const { data, isError } = useQuery({
    queryKey: OPD_NUMBER_QUERY_KEY,
    queryFn: () => patientsService.getOpdNumber(),
    enabled: canRegister,
  });
  if (isError) {
    return (
      <FormRow label={t("registrationForm.row.opdNumber", "OPD number")}>
        <TextInput
          aria-label={t("registrationForm.row.opdNumber", "OPD number")}
          disabled
          error={t("opdNumber.loadFailed", "Could not load the next OPD number. Try again.")}
        />
      </FormRow>
    );
  }
  if (!data || data.mode === "off") return null;
  const isManual = data.mode === "manual";
  const helper = t("opdNumber.helper", {
    previous: data.previous ?? "none",
    next: data.next,
    defaultValue: "Previous: {{previous}} · Next: {{next}}",
  });
  return (
    <FormRow label={t("registrationForm.row.opdNumber", "OPD number")} required={isManual}>
      <Grid>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <Controller
            control={control}
            name="opd_number"
            render={({ field }) => (
              <TextInput
                label={t("opdNumber.label", "OPD number")}
                data-testid="field-opd_number"
                description={isManual ? helper : t("opdNumber.auto", "Given when you save")}
                readOnly={!isManual}
                inputMode="numeric"
                value={isManual ? (field.value ?? data.next) : data.next}
                onChange={(event) => field.onChange(event.currentTarget.value)}
                error={formState.errors.opd_number?.message}
              />
            )}
          />
        </Grid.Col>
        {data.scope === "patient" && (
          <OpdDateCol mayBackdate={data.allow_backdate && canBackdate} />
        )}
      </Grid>
    </FormRow>
  );
}

/**
 * The OPD date beside a per-patient number: today, or the day in the paper
 * register when the hospital allows an earlier date and the desk may backdate.
 * Never after today.
 */
function OpdDateCol({ mayBackdate }: { mayBackdate: boolean }) {
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
            label={t("opdNumber.dateLabel", "OPD date")}
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
