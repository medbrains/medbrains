import { zodResolver } from "@hookform/resolvers/zod";
import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P, type PsychPatient } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { DoctorSearchSelect } from "@/components/DoctorSearchSelect";
import { Alert, Button, Input, Select, Switch, TextArea } from "@/components/ui";
import { psychiatryService } from "@/services/psychiatry.service";
import { ADMISSION_CATEGORIES } from "./labels";

const schema = z.object({
  admission_category: z.enum(["independent", "supported", "minor_supported", "emergency"]),
  treating_psychiatrist_id: z.string(),
  is_restricted: z.boolean(),
  nominated_rep_name: z.string().max(200),
  nominated_rep_relation: z.string().max(100),
  nominated_rep_contact: z.string().max(100),
  advance_directive_text: z.string().max(5000),
  substance_abuse_flag: z.boolean(),
  notes: z.string().max(5000),
});
type Form = z.infer<typeof schema>;

function toForm(r: PsychPatient): Form {
  return {
    admission_category: r.admission_category,
    treating_psychiatrist_id: r.treating_psychiatrist_id ?? "",
    is_restricted: r.is_restricted,
    nominated_rep_name: r.nominated_rep_name ?? "",
    nominated_rep_relation: r.nominated_rep_relation ?? "",
    nominated_rep_contact: r.nominated_rep_contact ?? "",
    advance_directive_text: r.advance_directive_text ?? "",
    substance_abuse_flag: r.substance_abuse_flag,
    notes: r.notes ?? "",
  };
}

interface PsychOverviewTabProps {
  record: PsychPatient;
}

/** The enrolment itself: legal category, restriction, representative. */
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
      void qc.invalidateQueries({ queryKey: ["psych-patient", record.id] });
    },
  });
  const lifting = record.is_restricted && !watch("is_restricted");

  return (
    <Stack gap="sm">
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <Controller
          control={control}
          name="admission_category"
          render={({ field }) => (
            <Select
              label="Admission category"
              data={ADMISSION_CATEGORIES}
              value={field.value}
              onChange={(v) => v && field.onChange(v)}
              allowDeselect={false}
              disabled={!canUpdate}
            />
          )}
        />
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
      </SimpleGrid>
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
          Lifting the restriction shows this record — and the patient's mental-health diagnoses — to
          everyone on the patient's care team. Do this only with the patient's agreement, or where
          the Mental Healthcare Act allows sharing for their care.
        </Alert>
      )}
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Controller
          control={control}
          name="nominated_rep_name"
          render={({ field }) => (
            <Input label="Nominated representative" disabled={!canUpdate} {...field} />
          )}
        />
        <Controller
          control={control}
          name="nominated_rep_relation"
          render={({ field }) => <Input label="Relationship" disabled={!canUpdate} {...field} />}
        />
        <Controller
          control={control}
          name="nominated_rep_contact"
          render={({ field }) => <Input label="Contact" disabled={!canUpdate} {...field} />}
        />
      </SimpleGrid>
      <Controller
        control={control}
        name="advance_directive_text"
        render={({ field }) => (
          <TextArea
            label="Advance directive"
            autosize
            minRows={2}
            disabled={!canUpdate}
            {...field}
          />
        )}
      />
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
    </Stack>
  );
}
