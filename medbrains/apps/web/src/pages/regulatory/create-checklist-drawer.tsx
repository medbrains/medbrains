/**
 * A new accreditation checklist: what is assessed (body, standard, the
 * department it belongs to) and for which period. A hospital assessing the
 * same standard again starts from an earlier checklist's criteria, each
 * unassessed.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { Select, Stack, Textarea, TextInput } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import type { ComplianceChecklist } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { DepartmentSelect } from "@/components/DepartmentSelect";
import { Alert, Button, Modal, toast } from "@/components/ui";
import { regulatoryService } from "@/services/regulatory.service";
import { ACCREDITATION_BODIES } from "./shared";

const isoDate = (d: unknown) => (d ? new Date(d as string).toISOString().slice(0, 10) : "");

const schema = z
  .object({
    name: z.string().trim().min(3, "Name the checklist"),
    accreditation_body: z.string(),
    standard_code: z.string().trim().min(1, "Which standard or chapter, e.g. COP"),
    department_id: z.string(),
    description: z.string(),
    assessment_period_start: z.string().min(1, "When the period starts"),
    assessment_period_end: z.string().min(1, "When the period ends"),
    copy_criteria_from: z.string(),
  })
  .refine((v) => v.assessment_period_end >= v.assessment_period_start, {
    path: ["assessment_period_end"],
    message: "The period ends after it starts",
  });
type Values = z.infer<typeof schema>;

interface CreateChecklistDrawerProps {
  opened: boolean;
  onClose: () => void;
  /** Earlier checklists, any of which may seed this one's criteria. */
  checklists: ComplianceChecklist[];
}

export function CreateChecklistDrawer({ opened, onClose, checklists }: CreateChecklistDrawerProps) {
  const qc = useQueryClient();
  const { control, handleSubmit, reset } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      accreditation_body: "nabh",
      standard_code: "",
      department_id: "",
      description: "",
      assessment_period_start: "",
      assessment_period_end: "",
      copy_criteria_from: "",
    },
  });
  const create = useMutation({
    mutationFn: (v: Values) =>
      regulatoryService.createChecklist({
        ...v,
        department_id: v.department_id || undefined,
        description: v.description || undefined,
        copy_criteria_from: v.copy_criteria_from || undefined,
      }),
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: ["regulatory-checklists"] });
      toast.success(`${row.total_items} criteria to assess`, { title: "Checklist created" });
      reset();
      onClose();
    },
  });

  return (
    <Modal opened={opened} onClose={onClose} title="New checklist" fullScreen>
      <Stack
        component="form"
        gap="sm"
        aria-label="New checklist"
        onSubmit={handleSubmit((v) => create.mutate(v))}
      >
        <Controller
          control={control}
          name="name"
          render={({ field, fieldState }) => (
            <TextInput {...field} label="Name" withAsterisk error={fieldState.error?.message} />
          )}
        />
        <Controller
          control={control}
          name="accreditation_body"
          render={({ field }) => (
            <Select
              label="Accreditation body"
              data={ACCREDITATION_BODIES}
              value={field.value}
              onChange={(v) => field.onChange(v ?? "nabh")}
              allowDeselect={false}
            />
          )}
        />
        <Controller
          control={control}
          name="standard_code"
          render={({ field, fieldState }) => (
            <TextInput
              {...field}
              label="Standard or chapter"
              withAsterisk
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="department_id"
          render={({ field }) => (
            <DepartmentSelect
              label="Department"
              placeholder="Whole hospital"
              clearable
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <Controller
          control={control}
          name="description"
          render={({ field }) => <Textarea {...field} label="Description" autosize minRows={2} />}
        />
        <Controller
          control={control}
          name="assessment_period_start"
          render={({ field, fieldState }) => (
            <DateInput
              label="Period starts"
              withAsterisk
              value={field.value ? new Date(field.value) : null}
              onChange={(d) => field.onChange(isoDate(d))}
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="assessment_period_end"
          render={({ field, fieldState }) => (
            <DateInput
              label="Period ends"
              withAsterisk
              value={field.value ? new Date(field.value) : null}
              onChange={(d) => field.onChange(isoDate(d))}
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="copy_criteria_from"
          render={({ field }) => (
            <Select
              label="Start from the criteria of"
              description="The same criteria, none of them assessed yet"
              placeholder="No — I'll enter the criteria"
              clearable
              searchable
              data={checklists
                .filter((c) => c.total_items > 0)
                .map((c) => ({
                  value: c.id,
                  label: `${c.name} · ${c.assessment_period_start} — ${c.assessment_period_end}`,
                }))}
              value={field.value || null}
              onChange={(v) => field.onChange(v ?? "")}
            />
          )}
        />
        {create.isError && <Alert tone="danger">{create.error.message}</Alert>}
        <Button tone="primary" type="submit" loading={create.isPending}>
          Create checklist
        </Button>
      </Stack>
    </Modal>
  );
}
