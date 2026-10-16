/**
 * Assessing one criterion: how it was found, the evidence, and — when it is
 * not compliant — the gap and what will be done about it by when. A
 * surveyor asks for the corrective action of every gap, so a non-compliant
 * finding is not saved without one.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { Select, Stack, Text, Textarea } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import type { ComplianceChecklistItem, ComplianceChecklistStatus } from "@medbrains/types";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, Modal } from "@/components/ui";
import { CRITERION_STATUSES } from "./shared";

const schema = z
  .object({
    status: z.string(),
    evidence_summary: z.string(),
    gap_description: z.string(),
    corrective_action: z.string(),
    target_date: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.status !== "non_compliant") return;
    if (!v.gap_description.trim()) {
      ctx.addIssue({ code: "custom", path: ["gap_description"], message: "Describe the gap" });
    }
    if (!v.corrective_action.trim()) {
      ctx.addIssue({ code: "custom", path: ["corrective_action"], message: "What will close it?" });
    }
  });
export type CriterionAssessment = z.infer<typeof schema>;

interface ChecklistItemModalProps {
  item: ComplianceChecklistItem | null;
  /** The status chosen in the list, when that is what opened the form. */
  status?: ComplianceChecklistStatus;
  saving: boolean;
  error: Error | null;
  onSave: (values: CriterionAssessment) => void;
  onClose: () => void;
}

export function ChecklistItemModal({
  item,
  status,
  saving,
  error,
  onSave,
  onClose,
}: ChecklistItemModalProps) {
  const { control, handleSubmit } = useForm<CriterionAssessment>({
    resolver: zodResolver(schema),
    values: item
      ? {
          status: status ?? item.status,
          evidence_summary: item.evidence_summary ?? "",
          gap_description: item.gap_description ?? "",
          corrective_action: item.corrective_action ?? "",
          target_date: item.target_date ?? "",
        }
      : undefined,
  });
  const text = (
    name: "evidence_summary" | "gap_description" | "corrective_action",
    label: string,
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Textarea {...field} label={label} autosize minRows={2} error={fieldState.error?.message} />
      )}
    />
  );

  return (
    <Modal
      opened={Boolean(item)}
      onClose={onClose}
      title={`Criterion ${item?.item_number ?? ""}`}
      size="lg"
    >
      <Stack
        component="form"
        gap="sm"
        aria-label="Assess criterion"
        onSubmit={handleSubmit(onSave)}
      >
        <Text size="sm">{item?.criterion}</Text>
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <Select
              label="Finding"
              data={CRITERION_STATUSES}
              value={field.value}
              onChange={(v) => field.onChange(v ?? "not_started")}
              allowDeselect={false}
            />
          )}
        />
        {text("evidence_summary", "Evidence")}
        {text("gap_description", "Gap")}
        {text("corrective_action", "Corrective action")}
        <Controller
          control={control}
          name="target_date"
          render={({ field }) => (
            <DateInput
              label="To be closed by"
              clearable
              value={field.value ? new Date(field.value) : null}
              onChange={(d) => field.onChange(d ? new Date(d).toISOString().slice(0, 10) : "")}
            />
          )}
        />
        {error && <Alert tone="danger">{error.message}</Alert>}
        <Button tone="primary" type="submit" loading={saving}>
          Save finding
        </Button>
      </Stack>
    </Modal>
  );
}
