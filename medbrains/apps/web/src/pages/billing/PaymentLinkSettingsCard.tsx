/**
 * Payment-link terms (#4871): whether a patient may pay a link in parts, the
 * least part, how long a link stays open, and whether the provider reminds
 * the payer. Stored as `payments` / `balance_link`; the server's defaults
 * (parts allowed, ₹100, 7 days, no reminders) apply until it is saved.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { Box, Group, Stack, Text } from "@mantine/core";
import type { PaymentLinkSettings } from "@medbrains/types";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Card, NumberField, Switch } from "@/components/ui";

const schema = z.object({
  accept_partial: z.boolean(),
  min_part_amount: z.number({ error: "Enter the least part in rupees" }).min(0).max(100_000),
  expiry_days: z.number({ error: "Enter 1 to 90 days" }).int().min(1).max(90),
  reminders: z.boolean(),
});

export const DEFAULT_LINK_SETTINGS: PaymentLinkSettings = {
  accept_partial: true,
  min_part_amount: 100,
  expiry_days: 7,
  reminders: false,
};

function current(value: unknown): PaymentLinkSettings {
  const parsed = schema.partial().safeParse(value ?? {});
  return { ...DEFAULT_LINK_SETTINGS, ...(parsed.success ? parsed.data : {}) };
}

interface PaymentLinkSettingsCardProps {
  value: unknown;
  canManage: boolean;
  saving: boolean;
  onSave: (settings: PaymentLinkSettings) => void;
}

export function PaymentLinkSettingsCard({
  value,
  canManage,
  saving,
  onSave,
}: PaymentLinkSettingsCardProps) {
  const form = useForm<PaymentLinkSettings>({
    resolver: zodResolver(schema),
    values: current(value),
  });
  const number = (name: "min_part_amount" | "expiry_days", label: string, max: number) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <NumberField
          label={label}
          min={name === "expiry_days" ? 1 : 0}
          max={max}
          w={160}
          readOnly={!canManage}
          value={field.value}
          onChange={(v) => field.onChange(typeof v === "number" ? v : 0)}
          error={fieldState.error?.message}
        />
      )}
    />
  );
  const toggle = (name: "accept_partial" | "reminders", label: string) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <Switch
          label={label}
          disabled={!canManage}
          checked={field.value}
          onChange={(e) => field.onChange(e.currentTarget.checked)}
        />
      )}
    />
  );
  return (
    <Card withBorder padding="md">
      <Box
        component="form"
        aria-label="Payment links"
        noValidate
        onSubmit={form.handleSubmit(onSave)}
      >
        <Stack gap="sm">
          <Text fw={600}>Payment links</Text>
          <Text size="sm" c="dimmed">
            A link sent from the Collect drawer or opened in the patient portal. A patient may pay
            all of it or part, and the rest at the counter in any way.
          </Text>
          {toggle("accept_partial", "Patients may pay a link in parts")}
          <Group align="flex-end">
            {number("min_part_amount", "Least part (₹)", 100_000)}
            {number("expiry_days", "Open for (days)", 90)}
          </Group>
          {toggle("reminders", "The payment provider reminds the patient until it is paid")}
          {canManage && (
            <Group>
              <Button tone="primary" type="submit" loading={saving}>
                Save
              </Button>
            </Group>
          )}
        </Stack>
      </Box>
    </Card>
  );
}
