import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P, type PsychPatient } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { DoctorSearchSelect } from "@/components/DoctorSearchSelect";
import { Alert, Badge, Button, Switch, TextArea } from "@/components/ui";
import { psychiatryService } from "@/services/psychiatry.service";
import { admissionCategoryLabel, formatDateTime } from "./labels";

const schema = z.object({
  treating_psychiatrist_id: z.string(),
  is_restricted: z.boolean(),
  substance_abuse_flag: z.boolean(),
  notes: z.string().max(5000),
});
type Form = z.infer<typeof schema>;

function toForm(r: PsychPatient): Form {
  return {
    treating_psychiatrist_id: r.treating_psychiatrist_id ?? "",
    is_restricted: r.is_restricted,
    substance_abuse_flag: r.substance_abuse_flag,
    notes: r.notes ?? "",
  };
}

function AbdmConsent({ record }: { record: PsychPatient }) {
  const qc = useQueryClient();
  const canManage = useHasPermission(P.SPECIALTY.PSYCHIATRY.ABDM_CONSENT_MANAGE);
  const set = useMutation({
    mutationFn: (consented: boolean) => psychiatryService.setAbdmConsent(record.id, consented),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["psych-patients"] }),
  });
  const consented = record.abdm_mh_share_consented_at !== null;
  return (
    <Stack gap={4}>
      <Switch
        label="Patient consents to share mental-health records through ABDM"
        description={
          consented
            ? `Consent recorded ${formatDateTime(record.abdm_mh_share_consented_at)}. Shared only if the hospital also allows it in ABDM settings.`
            : "Off: psychiatric visits are never offered, linked or sent to other providers through ABDM."
        }
        checked={consented}
        disabled={!canManage || set.isPending}
        onChange={(e) => set.mutate(e.currentTarget.checked)}
      />
      {set.isError && <Alert tone="danger">{set.error.message}</Alert>}
    </Stack>
  );
}

interface PsychOverviewTabProps {
  record: PsychPatient;
}

/** The enrolment itself: legal status, restriction, treating psychiatrist. */
export function PsychOverviewTab({ record }: PsychOverviewTabProps) {
  const qc = useQueryClient();
  const canUpdate = useHasPermission(P.SPECIALTY.PSYCHIATRY.PATIENTS_UPDATE);
  const { control, handleSubmit, watch, reset } = useForm<Form>({
    resolver: zodResolver(schema),
    values: toForm(record),
  });
  const save = useMutation({
    mutationFn: (v: Form) =>
      psychiatryService.updatePatient(record.id, {
        ...v,
        treating_psychiatrist_id: v.treating_psychiatrist_id || undefined,
      }),
    onSuccess: (row) => {
      reset(toForm(row));
      void qc.invalidateQueries({ queryKey: ["psych-patients"] });
    },
  });
  const lifting = record.is_restricted && !watch("is_restricted");

  return (
    <Stack gap="sm">
      <Group gap="xs">
        <Text size="sm">Current legal status:</Text>
        <Badge tone="neutral">{admissionCategoryLabel(record.admission_category)}</Badge>
        <Text size="xs" c="dimmed">
          Set by the latest admission.
        </Text>
      </Group>
      <Controller
        control={control}
        name="treating_psychiatrist_id"
        render={({ field }) => (
          <DoctorSearchSelect
            label="Treating psychiatrist"
            value={field.value}
            onChange={field.onChange}
            disabled={!canUpdate}
          />
        )}
      />
      <Controller
        control={control}
        name="is_restricted"
        render={({ field }) => (
          <Switch
            label="Restricted record"
            description="Restricted: only the treating psychiatrist, authorised roles and an emergency session can open it. Lifting it lets the patient's care team see it."
            checked={field.value}
            onChange={(e) => field.onChange(e.currentTarget.checked)}
            disabled={!canUpdate}
          />
        )}
      />
      {lifting && (
        <Alert tone="warning">
          Lifting the restriction shows this record, and the patient's mental-health diagnoses, to
          everyone on the patient's care team. Do this only with the patient's agreement, or where
          the Mental Healthcare Act allows sharing for their care.
        </Alert>
      )}
      <Controller
        control={control}
        name="substance_abuse_flag"
        render={({ field }) => (
          <Switch
            label="Substance use disorder"
            checked={field.value}
            onChange={(e) => field.onChange(e.currentTarget.checked)}
            disabled={!canUpdate}
          />
        )}
      />
      <Controller
        control={control}
        name="notes"
        render={({ field }) => (
          <TextArea label="Notes" autosize minRows={2} disabled={!canUpdate} {...field} />
        )}
      />
      {save.isError && <Alert tone="danger">{save.error.message}</Alert>}
      {canUpdate ? (
        <Group>
          <Button
            tone="primary"
            loading={save.isPending}
            onClick={() => void handleSubmit((v) => save.mutate(v))()}
          >
            Save changes
          </Button>
        </Group>
      ) : (
        <Text size="sm" c="dimmed">
          You can view this record but not change it.
        </Text>
      )}
      <AbdmConsent record={record} />
    </Stack>
  );
}
