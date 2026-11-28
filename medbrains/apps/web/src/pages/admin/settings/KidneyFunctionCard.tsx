import { Group, Stack, Text, Title } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { TenantSettingsRow } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Card, NumberField, Select, toast } from "@/components/ui";
import { tenantSettingsService } from "@/services/tenantSettings.service";

/** The hospital's eGFR rules (`tenant_settings` clinical / kidney_function_checks). */
export interface KidneyFunctionChecks {
  egfr_inpatient_days: number;
  egfr_outpatient_days: number;
  contrast_egfr_threshold: number;
}

/** Shown when nothing is stored; the server's defaults (kidney_settings.rs, migration 1498). */
export const KIDNEY_DEFAULTS: KidneyFunctionChecks = {
  egfr_inpatient_days: 7,
  egfr_outpatient_days: 30,
  contrast_egfr_threshold: 30,
};

const THRESHOLDS = [
  { value: "30", label: "eGFR below 30 (ACR–NKF consensus, 2020)" },
  { value: "45", label: "eGFR below 45 (ESUR / KDIGO)" },
];

const SETTING_KEY = "kidney_function_checks";
const QUERY_KEY = ["tenant-settings", "clinical"];

interface KidneyFunctionFormProps {
  value: KidneyFunctionChecks;
  onSave: (value: KidneyFunctionChecks) => void;
  isPending: boolean;
}

/** A day count a hospital may set: whole days from 1 to 365. */
function isValidDays(days: number): boolean {
  return Number.isInteger(days) && days >= 1 && days <= 365;
}

/**
 * How old an eGFR may be before renal dosing and contrast screening stop
 * using it, by inpatient and outpatient, and the eGFR that holds contrast for
 * review. Older than the window, the screens ask for a new creatinine/eGFR.
 */
export function KidneyFunctionForm({ value, onSave, isPending }: KidneyFunctionFormProps) {
  const canManage = useHasPermission(P.ADMIN.SETTINGS.GENERAL.MANAGE);
  const [local, setLocal] = useState(value);
  const isDirty = JSON.stringify(local) !== JSON.stringify(value);
  const isValid = isValidDays(local.egfr_inpatient_days) && isValidDays(local.egfr_outpatient_days);
  const setDays = (key: "egfr_inpatient_days" | "egfr_outpatient_days") => (v: string | number) =>
    setLocal({ ...local, [key]: Number(v) });
  const daysError = (days: number) => (isValidDays(days) ? undefined : "1 to 365 days");

  return (
    <Card padding="md" withBorder>
      <Title order={5} mb="sm">
        Kidney function (eGFR)
      </Title>
      <Text size="xs" c="dimmed" mb="md">
        Renal dosing and contrast screening use an eGFR only this recent. A clinician must confirm
        these rules for your hospital.
      </Text>
      <Stack gap="sm" maw={420}>
        <NumberField
          label="Inpatients: eGFR no older than (days)"
          value={local.egfr_inpatient_days}
          onChange={setDays("egfr_inpatient_days")}
          error={daysError(local.egfr_inpatient_days)}
          allowDecimal={false}
          disabled={!canManage}
        />
        <NumberField
          label="Outpatients: eGFR no older than (days)"
          value={local.egfr_outpatient_days}
          onChange={setDays("egfr_outpatient_days")}
          error={daysError(local.egfr_outpatient_days)}
          allowDecimal={false}
          disabled={!canManage}
        />
        <Select
          label="Hold contrast for review at"
          data={THRESHOLDS}
          value={String(local.contrast_egfr_threshold)}
          onChange={(v) => setLocal({ ...local, contrast_egfr_threshold: Number(v ?? 30) })}
          allowDeselect={false}
          disabled={!canManage}
        />
      </Stack>
      {canManage && isDirty && (
        <Group justify="flex-end" mt="sm">
          <Button
            tone="primary"
            size="xs"
            onClick={() => onSave(local)}
            loading={isPending}
            disabled={!isValid}
          >
            Save kidney function rules
          </Button>
        </Group>
      )}
    </Card>
  );
}

/** The stored rules over the defaults; a field the hospital never set keeps its default. */
function storedChecks(rows: TenantSettingsRow[] | undefined): KidneyFunctionChecks {
  const stored = rows?.find((r) => r.key === SETTING_KEY)?.value;
  return { ...KIDNEY_DEFAULTS, ...(typeof stored === "object" ? stored : {}) };
}

/** The card on Settings → Clinical configuration: reads and saves the clinical settings row. */
export function KidneyFunctionCard() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => tenantSettingsService.getTenantSettings("clinical"),
    staleTime: 300_000,
  });
  const save = useMutation({
    mutationFn: (value: KidneyFunctionChecks) =>
      tenantSettingsService.updateTenantSetting({ category: "clinical", key: SETTING_KEY, value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Kidney function rules saved");
    },
    onError: () => toast.error("Kidney function rules were not saved. Try again."),
  });
  const value = storedChecks(data);
  return (
    <KidneyFunctionForm
      key={JSON.stringify(value)}
      value={value}
      onSave={save.mutate}
      isPending={save.isPending}
    />
  );
}
