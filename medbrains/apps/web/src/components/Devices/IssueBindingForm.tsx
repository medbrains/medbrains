import { zodResolver } from "@hookform/resolvers/zod";
import { Stack } from "@mantine/core";
import type { IssueDeviceBindingCodeInput } from "@medbrains/types";
import { Controller, useForm } from "react-hook-form";
import { Button, Input, NumberField, Select } from "@/components/ui";
import {
  BINDING_MAX_USES,
  DEFAULT_ISSUE_BINDING,
  type IssueBindingForm as FormValues,
  issueBindingSchema,
  LIFETIME_OPTIONS,
} from "@/lib/binding-code";

interface IssueBindingFormProps {
  submitting: boolean;
  onSubmit: (input: IssueDeviceBindingCodeInput) => void;
}

/** Label, lifetime and how many devices one printed code may bind. */
export function IssueBindingForm({ submitting, onSubmit }: IssueBindingFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(issueBindingSchema),
    defaultValues: DEFAULT_ISSUE_BINDING,
  });
  const submit = form.handleSubmit((values) => onSubmit(issueBindingSchema.parse(values)));

  return (
    <Stack component="form" gap="md" onSubmit={submit}>
      <Controller
        control={form.control}
        name="label"
        render={({ field, fieldState }) => (
          <Input
            label="Label"
            description="Who or what it is for, e.g. “Ward 3 nurse phones”."
            required
            error={fieldState.error?.message}
            {...field}
          />
        )}
      />
      <Controller
        control={form.control}
        name="expires_in_hours"
        render={({ field }) => (
          <Select
            label="Valid for"
            data={LIFETIME_OPTIONS}
            value={String(field.value)}
            onChange={(v) => field.onChange(v ?? String(DEFAULT_ISSUE_BINDING.expires_in_hours))}
            allowDeselect={false}
          />
        )}
      />
      <Controller
        control={form.control}
        name="max_uses"
        render={({ field, fieldState }) => (
          <NumberField
            label="Devices it may bind"
            description="1 for a single phone. More for a ward's shared devices."
            min={1}
            max={BINDING_MAX_USES}
            value={Number(field.value)}
            onChange={(v) => field.onChange(v)}
            error={fieldState.error?.message}
          />
        )}
      />
      <Button tone="primary" type="submit" loading={submitting}>
        Generate QR
      </Button>
    </Stack>
  );
}
