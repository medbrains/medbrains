// RegisterUhidRow — one number: the paper register's number typed as the UHID.

import { Grid, TextInput } from "@mantine/core";
import type { PatientRegistrationFormInput } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { OpdNumberView } from "@medbrains/types";
import { P } from "@medbrains/types";
import { Controller, useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { FormRow } from "@/components/ClinicalForm";
import { OpdDateCol } from "./OpdDateCol";

/** Digits only, or nothing yet: the server refuses anything else too. */
export function isRegisterNumber(value: string): boolean {
  return /^\d*$/.test(value.trim());
}

/**
 * The single "UHID / register no." field of a hospital that keeps a paper
 * register: the UHID series' next number filled in with Previous/Next beside
 * it, any other unused number typeable (an old record), and the register
 * date, earlier than today only where the hospital allows it and the desk may
 * backdate. No separate OPD number is asked.
 */
export function RegisterUhidRow({ view }: { view: OpdNumberView }) {
  const { t } = useTranslation("patients");
  const canBackdate = useHasPermission(P.PATIENTS.OPD_NUMBER.BACKDATE);
  const { control } = useFormContext<PatientRegistrationFormInput>();
  const label = t("registerUhid.label", "UHID / register no.");
  const helper = t("opdNumber.helper", {
    previous: view.previous ?? "none",
    next: view.next,
    defaultValue: "Previous: {{previous}} · Next: {{next}}",
  });
  return (
    <FormRow label={label} required>
      <Grid>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <Controller
            control={control}
            name="uhid"
            render={({ field }) => {
              const value = field.value ?? view.next;
              return (
                <TextInput
                  label={label}
                  data-testid="field-register_uhid"
                  description={helper}
                  inputMode="numeric"
                  value={value}
                  onChange={(event) => field.onChange(event.currentTarget.value)}
                  error={
                    isRegisterNumber(value)
                      ? undefined
                      : t("registerUhid.digitsOnly", "Digits only, like 1043")
                  }
                />
              );
            }}
          />
        </Grid.Col>
        <OpdDateCol
          label={t("registerUhid.dateLabel", "Register date")}
          mayBackdate={view.allow_backdate && canBackdate}
        />
      </Grid>
    </FormRow>
  );
}
