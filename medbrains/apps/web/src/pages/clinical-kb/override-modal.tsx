// Add a disease the hospital's state notifies, or change one on the list.

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, SegmentedControl, Stack, Switch } from "@mantine/core";
import type { NotifiableOverride } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Input, Modal, toast } from "@/components/ui";
import { ckbService } from "@/services/ckb.service";

const overrideSchema = z.object({
  icd10_code: z
    .string()
    .trim()
    .min(3, "Give the disease's ICD-10 code")
    .regex(/^[A-Za-z][0-9]{2}(\.[0-9A-Za-z]{1,4})?$/, "An ICD-10 code looks like A75.3"),
  icd11_code: z.string().trim().max(12),
  disease_name: z.string().trim().max(120),
  is_notifiable: z.boolean(),
  reporting_body: z.string().trim().max(60),
  report_timeframe: z.enum(["24h", "weekly"]),
  notes: z.string().trim().max(500),
});
type OverrideForm = z.infer<typeof overrideSchema>;

interface OverrideModalProps {
  existing: NotifiableOverride | null;
  onClose: () => void;
  onSaved: () => void;
}

const orNull = (v: string) => v.trim() || null;

export function OverrideModal({ existing, onClose, onSaved }: OverrideModalProps) {
  const { control, handleSubmit, register, formState } = useForm<OverrideForm>({
    resolver: zodResolver(overrideSchema),
    defaultValues: {
      icd10_code: existing?.icd10_code ?? "",
      icd11_code: existing?.icd11_code ?? "",
      disease_name: existing?.disease_name ?? "",
      is_notifiable: existing?.is_notifiable ?? true,
      reporting_body: existing?.reporting_body ?? "",
      report_timeframe: existing?.report_timeframe === "weekly" ? "weekly" : "24h",
      notes: existing?.notes ?? "",
    },
  });
  const save = useMutation({
    mutationFn: (f: OverrideForm) =>
      ckbService.upsertNotifiableOverride({
        icd10_code: f.icd10_code,
        icd11_code: orNull(f.icd11_code),
        disease_name: orNull(f.disease_name),
        is_notifiable: f.is_notifiable,
        reporting_body: orNull(f.reporting_body),
        report_timeframe: f.report_timeframe,
        notes: orNull(f.notes),
      }),
    onSuccess: onSaved,
    onError: (e: Error) => toast.error(e.message, { title: "Not saved" }),
  });
  const errors = formState.errors;

  return (
    <Modal opened onClose={onClose} title="Notifiable disease for this hospital" size="lg">
      <Stack gap="sm">
        <Group grow>
          <Input
            label="ICD-10 code"
            placeholder="A75.3"
            required
            readOnly={existing !== null}
            error={errors.icd10_code?.message}
            {...register("icd10_code")}
          />
          <Input
            label="ICD-11 code"
            placeholder="1C30"
            error={errors.icd11_code?.message}
            {...register("icd11_code")}
          />
        </Group>
        <Input
          label="Disease"
          description="Needed when the code is not on the national list."
          placeholder="Scrub typhus"
          error={errors.disease_name?.message}
          {...register("disease_name")}
        />
        <Controller
          control={control}
          name="is_notifiable"
          render={({ field }) => (
            <Switch
              label="Notified in this hospital's state"
              checked={field.value}
              onChange={(e) => field.onChange(e.currentTarget.checked)}
            />
          )}
        />
        <Group grow align="flex-end">
          <Input
            label="Report to"
            placeholder="IDSP / IHIP"
            error={errors.reporting_body?.message}
            {...register("reporting_body")}
          />
          <Controller
            control={control}
            name="report_timeframe"
            render={({ field }) => (
              <SegmentedControl
                aria-label="Reporting timeframe"
                data={[
                  { value: "24h", label: "Within 24 hours" },
                  { value: "weekly", label: "Weekly" },
                ]}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </Group>
        <Input
          label="Why (notification or order)"
          placeholder="State Epidemic Diseases notification, 2024"
          error={errors.notes?.message}
          {...register("notes")}
        />
        <Group justify="flex-end">
          <Button tone="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            tone="primary"
            loading={save.isPending}
            onClick={() => void handleSubmit((f) => save.mutate(f))()}
          >
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
