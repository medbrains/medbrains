/** The request: dataset, period, purpose and IEC approval. */
import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import type { NewResearchExport } from "@medbrains/types";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Input, Select, TextArea } from "@/components/ui";
import { DATASET_LABEL } from "./labels";

const schema = z
  .object({
    dataset: z.enum(["visits", "diagnoses", "admissions", "labs", "medicines", "vitals", "omop"]),
    period_from: z.string().min(1, "Choose the first day"),
    period_to: z.string().min(1, "Choose the last day"),
    purpose: z.string().trim().min(20, "Describe the study in at least 20 characters"),
    iec_reference: z.string().trim().min(3, "Give the IEC approval reference"),
  })
  .refine((v) => v.period_from <= v.period_to, {
    path: ["period_to"],
    message: "The last day must be on or after the first",
  });

interface RequestFormProps {
  submitting: boolean;
  onSubmit: (values: NewResearchExport) => void;
  onCancel: () => void;
}

const DATASETS = Object.entries(DATASET_LABEL).map(([value, label]) => ({ value, label }));

export function RequestForm({ submitting, onSubmit, onCancel }: RequestFormProps) {
  const { control, handleSubmit, formState } = useForm<NewResearchExport>({
    resolver: zodResolver(schema),
    defaultValues: {
      dataset: "diagnoses",
      period_from: "",
      period_to: "",
      purpose: "",
      iec_reference: "",
    },
  });
  const err = formState.errors;
  return (
    <Stack component="form" gap="sm" onSubmit={handleSubmit(onSubmit)}>
      <Controller
        name="dataset"
        control={control}
        render={({ field }) => (
          <Select label="Dataset" data={DATASETS} required {...field} allowDeselect={false} />
        )}
      />
      <Group grow>
        <Controller
          name="period_from"
          control={control}
          render={({ field }) => (
            <DateInput
              label="From"
              required
              valueFormat="DD MMM YYYY"
              maxDate={new Date()}
              value={field.value || null}
              onChange={(v) => field.onChange(v ?? "")}
              error={err.period_from?.message}
            />
          )}
        />
        <Controller
          name="period_to"
          control={control}
          render={({ field }) => (
            <DateInput
              label="To"
              required
              valueFormat="DD MMM YYYY"
              maxDate={new Date()}
              value={field.value || null}
              onChange={(v) => field.onChange(v ?? "")}
              error={err.period_to?.message}
            />
          )}
        />
      </Group>
      <Controller
        name="purpose"
        control={control}
        render={({ field }) => (
          <TextArea
            label="Purpose of the study"
            required
            autosize
            minRows={3}
            error={err.purpose?.message}
            {...field}
          />
        )}
      />
      <Controller
        name="iec_reference"
        control={control}
        render={({ field }) => (
          <Input
            label="IEC approval reference"
            placeholder="e.g. IEC/2026/041"
            required
            error={err.iec_reference?.message}
            {...field}
          />
        )}
      />
      <Group justify="flex-end">
        <Button tone="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button tone="primary" type="submit" loading={submitting}>
          Request export
        </Button>
      </Group>
    </Stack>
  );
}
