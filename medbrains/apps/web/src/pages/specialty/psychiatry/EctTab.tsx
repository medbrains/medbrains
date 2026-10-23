import { zodResolver } from "@hookform/resolvers/zod";
import { SimpleGrid, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P, type PsychEctRegister } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import type { Column } from "@/components/DataTable";
import { DoctorSearchSelect } from "@/components/DoctorSearchSelect";
import {
  Alert,
  Badge,
  Checkbox,
  Input,
  Modal,
  NumberField,
  Select,
  TextArea,
} from "@/components/ui";
import { psychiatryService } from "@/services/psychiatry.service";
import { blankToUndefined, ECT_LATERALITY, formatDate, labelOf } from "./labels";
import { RecordListFrame, usePsychList } from "./RecordListFrame";

const schema = z.object({
  session_number: z.number().int().min(1, "Session numbers start at 1"),
  consent_obtained: z.boolean(),
  laterality: z.enum(["bilateral", "right_unilateral", "left_unilateral"]),
  stimulus_dose: z.number().min(0).optional(),
  seizure_duration_sec: z.number().int().min(0).max(600).optional(),
  anesthetic: z.string().max(200),
  muscle_relaxant: z.string().max(200),
  anesthetist_id: z.string(),
  complications: z.string().max(2000),
  notes: z.string().max(5000),
  board_permission_ref: z.string().max(200),
});
type Form = z.infer<typeof schema>;

const EMPTY: Omit<Form, "session_number"> = {
  consent_obtained: false,
  laterality: "right_unilateral",
  anesthetic: "",
  muscle_relaxant: "",
  anesthetist_id: "",
  complications: "",
  notes: "",
  board_permission_ref: "",
};

const COLUMNS: Column<PsychEctRegister>[] = [
  { key: "n", label: "Session", render: (r) => <Text size="sm">#{r.session_number}</Text> },
  {
    key: "date",
    label: "Date",
    render: (r) => <Text size="sm">{formatDate(r.session_date)}</Text>,
  },
  {
    key: "laterality",
    label: "Laterality",
    render: (r) => <Badge tone="neutral">{labelOf(ECT_LATERALITY, r.laterality)}</Badge>,
  },
  {
    key: "consent",
    label: "Consent",
    render: (r) =>
      r.consent_obtained ? (
        <Badge tone="success">Consent on file</Badge>
      ) : (
        <Badge tone="danger">No consent recorded</Badge>
      ),
  },
  {
    key: "dose",
    label: "Stimulus",
    render: (r) => <Text size="sm">{r.stimulus_dose ?? "—"}</Text>,
  },
  {
    key: "seizure",
    label: "Seizure (s)",
    render: (r) => <Text size="sm">{r.seizure_duration_sec ?? "—"}</Text>,
  },
  {
    key: "complications",
    label: "Complications",
    render: (r) => <Text size="sm">{r.complications ?? "None recorded"}</Text>,
  },
];

export function EctTab({ psychPatientId }: { psychPatientId: string }) {
  const qc = useQueryClient();
  const canList = useHasPermission(P.SPECIALTY.PSYCHIATRY.ECT_LIST);
  const canAdd = useHasPermission(P.SPECIALTY.PSYCHIATRY.ECT_CREATE);
  const query = usePsychList("psych-ect", psychPatientId, psychiatryService.listEct, canList);
  const nextSession = (query.data?.reduce((m, r) => Math.max(m, r.session_number), 0) ?? 0) + 1;
  const [open, setOpen] = useState(false);
  const { control, handleSubmit, reset } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { ...EMPTY, session_number: 1 },
  });
  const openForm = () => {
    reset({ ...EMPTY, session_number: nextSession });
    setOpen(true);
  };
  const create = useMutation({
    mutationFn: (v: Form) =>
      psychiatryService.createEct(psychPatientId, {
        ...v,
        anesthetic: blankToUndefined(v.anesthetic),
        muscle_relaxant: blankToUndefined(v.muscle_relaxant),
        anesthetist_id: blankToUndefined(v.anesthetist_id),
        complications: blankToUndefined(v.complications),
        notes: blankToUndefined(v.notes),
        board_permission_ref: blankToUndefined(v.board_permission_ref),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["psych-ect", psychPatientId] });
      setOpen(false);
    },
  });
  const num = (
    name: "session_number" | "stimulus_dose" | "seizure_duration_sec",
    label: string,
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <NumberField
          label={label}
          value={field.value ?? ""}
          onChange={(v) => field.onChange(typeof v === "number" ? v : undefined)}
          error={fieldState.error?.message}
        />
      )}
    />
  );
  const text = (name: "anesthetic" | "muscle_relaxant" | "board_permission_ref", label: string) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => <Input label={label} {...field} />}
    />
  );

  return (
    <RecordListFrame
      description="Electroconvulsive therapy register. Consent can only be marked when a signed consent is on file. Never during emergency treatment (s.94); for a minor only with the Board's permission (s.95)."
      addLabel="Record ECT session"
      canAdd={canAdd}
      onAdd={openForm}
      columns={COLUMNS}
      query={query}
      emptyTitle="No ECT sessions recorded"
    >
      <Modal
        opened={open}
        onClose={() => setOpen(false)}
        title="Record ECT session"
        size="lg"
        primaryAction={{
          label: "Save session",
          onClick: () => void handleSubmit((v) => create.mutate(v))(),
          loading: create.isPending,
        }}
        secondaryAction={{ label: "Cancel", onClick: () => setOpen(false) }}
      >
        <Stack gap="sm">
          <SimpleGrid cols={2}>
            {num("session_number", "Session number")}
            <Controller
              control={control}
              name="laterality"
              render={({ field }) => (
                <Select
                  label="Laterality"
                  data={ECT_LATERALITY}
                  value={field.value}
                  onChange={(v) => v && field.onChange(v)}
                  allowDeselect={false}
                />
              )}
            />
            {num("stimulus_dose", "Stimulus dose")}
            {num("seizure_duration_sec", "Seizure duration (seconds)")}
            {text("anesthetic", "Anaesthetic")}
            {text("muscle_relaxant", "Muscle relaxant")}
          </SimpleGrid>
          {text(
            "board_permission_ref",
            "Board permission reference (required for a minor, s.95(2))",
          )}
          <Controller
            control={control}
            name="anesthetist_id"
            render={({ field }) => (
              <DoctorSearchSelect
                label="Anaesthetist"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <Controller
            control={control}
            name="consent_obtained"
            render={({ field }) => (
              <Checkbox
                label="Informed consent obtained (a signed consent must be on file)"
                checked={field.value}
                onChange={(e) => field.onChange(e.currentTarget.checked)}
              />
            )}
          />
          <Controller
            control={control}
            name="complications"
            render={({ field }) => (
              <TextArea label="Complications" autosize minRows={2} {...field} />
            )}
          />
          <Controller
            control={control}
            name="notes"
            render={({ field }) => <TextArea label="Notes" autosize minRows={2} {...field} />}
          />
          {create.isError && <Alert tone="danger">{create.error.message}</Alert>}
        </Stack>
      </Modal>
    </RecordListFrame>
  );
}
