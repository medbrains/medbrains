// Add / edit one radiology exam. Prices are not set here: an exam names the
// charge-master code it bills under, and the price lives with that code.

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, TagsInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { RadiologyContrast, RadiologyExamListItem, RadiologyModality } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import type { BodySite } from "@/components/BodySite/anatomy-atlas";
import { BodySitePicker } from "@/components/BodySite/BodySitePicker";
import { Button, Drawer, Input, Select, Switch, TextArea } from "@/components/ui";
import { CONTRAST_OPTIONS } from "@/lib/radiology-exams";
import { radiologyService } from "@/services/radiology.service";

export const EXAMS_QUERY_KEY = ["radiology-exams"];

const contrastValues = ["none", "with", "without", "with_and_without"] as const;

const examFormSchema = z.object({
  modality_id: z.string().min(1, "Pick the modality"),
  code: z.string().trim().min(1, "Enter a code, e.g. CT-BRAIN-P").max(40),
  name: z.string().trim().min(1, "Enter the exam name, e.g. CT Brain Plain").max(200),
  laterality_required: z.boolean(),
  contrast: z.enum(contrastValues),
  synonyms: z.array(z.string()),
  charge_code: z.string().trim().max(50),
  preparation: z.string().trim(),
  is_active: z.boolean(),
});
type ExamFormValues = z.infer<typeof examFormSchema>;

interface ExamFormDrawerProps {
  /** null = closed; "new" = adding; an exam = editing it. */
  editing: RadiologyExamListItem | "new" | null;
  modalities: RadiologyModality[];
  onClose: () => void;
}

function toFormValues(exam: RadiologyExamListItem | null): ExamFormValues {
  return {
    modality_id: exam?.modality_id ?? "",
    code: exam?.code ?? "",
    name: exam?.name ?? "",
    laterality_required: exam?.laterality_required ?? false,
    contrast: exam?.contrast ?? "none",
    synonyms: exam?.synonyms ?? [],
    charge_code: exam?.charge_code ?? "",
    preparation: exam?.preparation ?? "",
    is_active: exam?.is_active ?? true,
  };
}

export function ExamFormDrawer({ editing, modalities, onClose }: ExamFormDrawerProps) {
  const exam = editing === "new" ? null : editing;
  // Keyed on the exam by the caller, so this initial state is per exam.
  const [site, setSite] = useState<BodySite | null>(
    exam?.body_part ? { label: exam.body_part, code: exam.body_part_code, laterality: null } : null,
  );
  const qc = useQueryClient();
  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ExamFormValues>({
    resolver: zodResolver(examFormSchema),
    defaultValues: toFormValues(exam),
  });
  const modalityCode = modalities.find((m) => m.id === watch("modality_id"))?.code;

  const saveMutation = useMutation({
    mutationFn: (values: ExamFormValues) => {
      const body = {
        ...values,
        body_part: site?.label ?? "",
        body_part_code: site?.code ?? "",
      };
      return exam
        ? radiologyService.updateRadiologyExam(exam.id, body)
        : radiologyService.createRadiologyExam(body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: EXAMS_QUERY_KEY });
      notifications.show({ title: "Exam saved", message: "", color: "success" });
      onClose();
    },
    onError: (error: Error) =>
      notifications.show({ title: "Could not save exam", message: error.message, color: "danger" }),
  });

  return (
    <Drawer
      opened={editing !== null}
      onClose={onClose}
      title={exam ? "Edit exam" : "Add exam"}
      size="lg"
    >
      <Stack component="form" onSubmit={handleSubmit((v) => saveMutation.mutate(v))}>
        <Controller
          control={control}
          name="modality_id"
          render={({ field }) => (
            <Select
              label="Modality"
              required
              data={modalities
                .filter((m) => m.is_active || m.id === field.value)
                .map((m) => ({ value: m.id, label: `${m.code} — ${m.name}` }))}
              value={field.value || null}
              onChange={(value) => field.onChange(value ?? "")}
              error={errors.modality_id?.message}
              searchable
            />
          )}
        />
        <Group grow align="flex-start">
          <Input
            label="Code"
            required
            placeholder="CT-BRAIN-P"
            disabled={Boolean(exam)}
            error={errors.code?.message}
            {...register("code")}
          />
          <Input
            label="Name"
            required
            placeholder="CT Brain Plain"
            error={errors.name?.message}
            {...register("name")}
          />
        </Group>
        <BodySitePicker label="Body part" value={site} onChange={setSite} placeholder="e.g. Head" />
        <Controller
          control={control}
          name="laterality_required"
          render={({ field }) => (
            <Switch
              label="Side must be stated when ordering (left / right)"
              checked={field.value}
              onChange={(e) => field.onChange(e.currentTarget.checked)}
            />
          )}
        />
        <Controller
          control={control}
          name="contrast"
          render={({ field }) => (
            <Select
              label="Contrast"
              data={CONTRAST_OPTIONS}
              value={field.value}
              onChange={(value) => field.onChange((value ?? "none") as RadiologyContrast)}
              allowDeselect={false}
            />
          )}
        />
        <Controller
          control={control}
          name="synonyms"
          render={({ field }) => (
            <TagsInput
              label="Short names"
              description="What people type to find it — press Enter after each (NCCT head, CT head)"
              value={field.value}
              onChange={field.onChange}
              maxTags={20}
              clearable
            />
          )}
        />
        <Input
          label="Charge code"
          description="The charge-master code this exam bills under. Empty bills under the modality's code."
          placeholder={modalityCode ? `RAD-${modalityCode}` : "RAD-<modality code>"}
          error={errors.charge_code?.message}
          {...register("charge_code")}
        />
        <TextArea
          label="Patient preparation"
          placeholder="e.g. Fasting 4 hours; bring previous reports"
          autosize
          minRows={2}
          {...register("preparation")}
        />
        <Controller
          control={control}
          name="is_active"
          render={({ field }) => (
            <Switch
              label="Can be ordered"
              checked={field.value}
              onChange={(e) => field.onChange(e.currentTarget.checked)}
            />
          )}
        />
        <Group>
          <Button tone="primary" type="submit" loading={saveMutation.isPending}>
            Save
          </Button>
          <Button tone="ghost" onClick={onClose}>
            Cancel
          </Button>
        </Group>
      </Stack>
    </Drawer>
  );
}
