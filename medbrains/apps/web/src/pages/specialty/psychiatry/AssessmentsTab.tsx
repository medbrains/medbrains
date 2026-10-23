import { zodResolver } from "@hookform/resolvers/zod";
import { SimpleGrid, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P, type PsychAssessment } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import type { Column } from "@/components/DataTable";
import { Alert, Badge, Input, Modal, NumberField, TextArea } from "@/components/ui";
import { psychiatryService } from "@/services/psychiatry.service";
import { blankToUndefined, formatDate } from "./labels";
import { RecordListFrame, usePsychList } from "./RecordListFrame";

// HAM-D 17-item 0–52, BPRS 18-item 18–126, GAF 1–100.
const optionalScore = (min: number, max: number) => z.number().int().min(min).max(max).optional();
const schema = z.object({
  assessment_type: z.string().trim().min(1, "Say what kind of assessment this is"),
  ham_d_score: optionalScore(0, 52),
  bprs_score: optionalScore(18, 126),
  gaf_score: optionalScore(1, 100),
  notes: z.string().max(5000),
});
type Form = z.infer<typeof schema>;

const COLUMNS: Column<PsychAssessment>[] = [
  {
    key: "type",
    label: "Type",
    render: (r) => <Badge tone="neutral">{r.assessment_type}</Badge>,
  },
  { key: "ham_d", label: "HAM-D", render: (r) => <Text size="sm">{r.ham_d_score ?? "—"}</Text> },
  { key: "bprs", label: "BPRS", render: (r) => <Text size="sm">{r.bprs_score ?? "—"}</Text> },
  { key: "gaf", label: "GAF", render: (r) => <Text size="sm">{r.gaf_score ?? "—"}</Text> },
  {
    key: "date",
    label: "Assessed",
    render: (r) => <Text size="sm">{formatDate(r.assessed_at)}</Text>,
  },
  {
    key: "notes",
    label: "Notes",
    render: (r) => (
      <Text size="sm" lineClamp={2}>
        {r.notes ?? ""}
      </Text>
    ),
  },
];

export function AssessmentsTab({ psychPatientId }: { psychPatientId: string }) {
  const qc = useQueryClient();
  const canList = useHasPermission(P.SPECIALTY.PSYCHIATRY.ASSESSMENTS_LIST);
  const canAdd = useHasPermission(P.SPECIALTY.PSYCHIATRY.ASSESSMENTS_CREATE);
  const query = usePsychList(
    "psych-assessments",
    psychPatientId,
    psychiatryService.listAssessments,
    canList,
  );
  const [open, setOpen] = useState(false);
  const { control, handleSubmit, reset } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { assessment_type: "", notes: "" },
  });
  const create = useMutation({
    mutationFn: (v: Form) =>
      psychiatryService.createAssessment(psychPatientId, {
        ...v,
        notes: blankToUndefined(v.notes),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["psych-assessments", psychPatientId] });
      reset();
      setOpen(false);
    },
  });
  const score = (name: "ham_d_score" | "bprs_score" | "gaf_score", label: string) => (
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
      description="Rating scales and mental status assessments, newest first."
      addLabel="Add assessment"
      canAdd={canAdd}
      onAdd={() => setOpen(true)}
      columns={COLUMNS}
      query={query}
      emptyTitle="No assessments recorded"
    >
      <Modal
        opened={open}
        onClose={() => setOpen(false)}
        title="Add assessment"
        primaryAction={{
          label: "Save assessment",
          onClick: () => void handleSubmit((v) => create.mutate(v))(),
          loading: create.isPending,
        }}
        secondaryAction={{ label: "Cancel", onClick: () => setOpen(false) }}
      >
        <Stack gap="sm">
          <Controller
            control={control}
            name="assessment_type"
            render={({ field, fieldState }) => (
              <Input
                label="Assessment"
                placeholder="e.g. Initial assessment, Review"
                required
                error={fieldState.error?.message}
                {...field}
              />
            )}
          />
          <SimpleGrid cols={3}>
            {score("ham_d_score", "HAM-D (0–52)")}
            {score("bprs_score", "BPRS (18–126)")}
            {score("gaf_score", "GAF (1–100)")}
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
