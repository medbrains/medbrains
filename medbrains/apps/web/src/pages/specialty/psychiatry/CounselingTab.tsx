import { zodResolver } from "@hookform/resolvers/zod";
import { SimpleGrid, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P, type PsychCounselingSession } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import type { Column } from "@/components/DataTable";
import { DoctorSearchSelect } from "@/components/DoctorSearchSelect";
import { Alert, Badge, Input, Modal, NumberField, TextArea } from "@/components/ui";
import { psychiatryService } from "@/services/psychiatry.service";
import { blankToUndefined, formatDate } from "./labels";
import { RecordListFrame, usePsychList } from "./RecordListFrame";

const schema = z.object({
  session_type: z.string().trim().min(1, "Say what kind of session this was"),
  therapist_id: z.string().min(1, "Choose the therapist"),
  modality: z.string().max(200),
  duration_minutes: z.number().int().min(1).max(600).optional(),
  outcome_rating: z.number().int().min(1).max(10).optional(),
  notes: z.string().max(5000),
});
type Form = z.infer<typeof schema>;

const COLUMNS: Column<PsychCounselingSession>[] = [
  { key: "type", label: "Session", render: (r) => <Badge tone="neutral">{r.session_type}</Badge> },
  { key: "modality", label: "Modality", render: (r) => <Text size="sm">{r.modality ?? "—"}</Text> },
  {
    key: "duration",
    label: "Minutes",
    render: (r) => <Text size="sm">{r.duration_minutes ?? "—"}</Text>,
  },
  {
    key: "outcome",
    label: "Outcome (1–10)",
    render: (r) => <Text size="sm">{r.outcome_rating ?? "—"}</Text>,
  },
  {
    key: "date",
    label: "Date",
    render: (r) => <Text size="sm">{formatDate(r.session_date)}</Text>,
  },
];

export function CounselingTab({ psychPatientId }: { psychPatientId: string }) {
  const qc = useQueryClient();
  const canList = useHasPermission(P.SPECIALTY.PSYCHIATRY.ASSESSMENTS_LIST);
  const canAdd = useHasPermission(P.SPECIALTY.PSYCHIATRY.ASSESSMENTS_CREATE);
  const query = usePsychList(
    "psych-counseling",
    psychPatientId,
    psychiatryService.listCounseling,
    canList,
  );
  const [open, setOpen] = useState(false);
  const { control, handleSubmit, reset } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { session_type: "", therapist_id: "", modality: "", notes: "" },
  });
  const create = useMutation({
    mutationFn: (v: Form) =>
      psychiatryService.createCounseling(psychPatientId, {
        ...v,
        modality: blankToUndefined(v.modality),
        notes: blankToUndefined(v.notes),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["psych-counseling", psychPatientId] });
      reset();
      setOpen(false);
    },
  });
  const count = (name: "duration_minutes" | "outcome_rating", label: string) => (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <NumberField
          label={label}
          value={field.value ?? ""}
          onChange={(v) => field.onChange(typeof v === "number" ? v : undefined)}
          error={fieldState.error?.message}
          allowDecimal={false}
        />
      )}
    />
  );

  return (
    <RecordListFrame
      description="Counselling and psychotherapy sessions."
      addLabel="Add session"
      canAdd={canAdd}
      onAdd={() => setOpen(true)}
      columns={COLUMNS}
      query={query}
      emptyTitle="No sessions recorded"
    >
      <Modal
        opened={open}
        onClose={() => setOpen(false)}
        title="Add counselling session"
        primaryAction={{
          label: "Save session",
          onClick: () => void handleSubmit((v) => create.mutate(v))(),
          loading: create.isPending,
        }}
        secondaryAction={{ label: "Cancel", onClick: () => setOpen(false) }}
      >
        <Stack gap="sm">
          <Controller
            control={control}
            name="session_type"
            render={({ field, fieldState }) => (
              <Input
                label="Session"
                placeholder="e.g. Individual, Family"
                required
                error={fieldState.error?.message}
                {...field}
              />
            )}
          />
          <Controller
            control={control}
            name="therapist_id"
            render={({ field, fieldState }) => (
              <DoctorSearchSelect
                label="Therapist"
                value={field.value}
                onChange={field.onChange}
                required
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="modality"
            render={({ field }) => (
              <Input label="Modality" placeholder="e.g. CBT, supportive" {...field} />
            )}
          />
          <SimpleGrid cols={2}>
            {count("duration_minutes", "Duration (minutes)")}
            {count("outcome_rating", "Outcome rating (1–10)")}
          </SimpleGrid>
          <Controller
            control={control}
            name="notes"
            render={({ field }) => <TextArea label="Notes" autosize minRows={3} {...field} />}
          />
          {create.isError && <Alert tone="danger">{create.error.message}</Alert>}
        </Stack>
      </Modal>
    </RecordListFrame>
  );
}
