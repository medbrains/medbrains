/**
 * Give a MedBrains person time-limited access: who, why, which modules,
 * masked or not, and for how long. Masked and four hours unless changed.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { Stack, Text } from "@mantine/core";
import type { CreateVendorAccessGrant } from "@medbrains/types";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, Input, MultiSelect, NumberField, Switch, TextArea } from "@/components/ui";
import { scopeOptions } from "./access-view";

const MAX_HOURS = 72;

const schema = z.object({
  grantee_email: z.string().trim().email("Enter the MedBrains person's email"),
  reason: z.string().trim().min(10, "Say why, in at least 10 characters"),
  scope: z.array(z.string()).min(1, "Choose at least one module, or configuration only"),
  is_masked: z.boolean(),
  hours: z
    .number({ message: "Enter the number of hours" })
    .int("Whole hours")
    .min(1, "At least 1 hour")
    .max(MAX_HOURS, "At most 72 hours"),
});
type Values = z.infer<typeof schema>;

interface GrantFormProps {
  saving: boolean;
  error: Error | null;
  onSave: (input: CreateVendorAccessGrant) => void;
}

/** The form inside the "Give access" dialog. */
export function GrantForm({ saving, error, onSave }: GrantFormProps) {
  const options = useMemo(scopeOptions, []);
  const { control, handleSubmit, watch } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { grantee_email: "", reason: "", scope: [], is_masked: true, hours: 4 },
  });
  const isMasked = watch("is_masked");
  return (
    <Stack
      component="form"
      gap="sm"
      aria-label="Give MedBrains access"
      onSubmit={handleSubmit(onSave)}
    >
      <Controller
        control={control}
        name="grantee_email"
        render={({ field, fieldState }) => (
          <Input
            {...field}
            type="email"
            label="MedBrains person's email"
            description="Their account at this hospital. Add it under Admin → Users first."
            withAsterisk
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="reason"
        render={({ field, fieldState }) => (
          <TextArea
            {...field}
            label="Reason"
            description="The ticket or problem. It stays on the record."
            withAsterisk
            autosize
            minRows={2}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="scope"
        render={({ field, fieldState }) => (
          <MultiSelect
            label="What they may reach"
            description="Account, role and access settings are never included."
            data={options}
            searchable
            value={field.value}
            onChange={field.onChange}
            withAsterisk
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="hours"
        render={({ field, fieldState }) => (
          <NumberField
            label="Hours"
            description="Access ends by itself. At most 72 hours."
            min={1}
            max={MAX_HOURS}
            allowDecimal={false}
            value={field.value}
            onChange={(v) => field.onChange(typeof v === "number" ? v : Number.NaN)}
            withAsterisk
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="is_masked"
        render={({ field }) => (
          <Switch
            label="Mask patient data"
            description="Names, contacts, IDs and clinical notes are hidden on the server."
            checked={field.value}
            onChange={(e) => field.onChange(e.currentTarget.checked)}
          />
        )}
      />
      {!isMasked && (
        <Alert tone="warning" title="A second person must approve">
          Unmasked access opens only after someone else with the approve permission agrees.
        </Alert>
      )}
      {error && (
        <Alert tone="danger" title="Access not given">
          {error.message}
        </Alert>
      )}
      <Text size="xs" c="dimmed">
        Every request they make is recorded and shown on this screen.
      </Text>
      <Button type="submit" tone="primary" loading={saving}>
        Give access
      </Button>
    </Stack>
  );
}
