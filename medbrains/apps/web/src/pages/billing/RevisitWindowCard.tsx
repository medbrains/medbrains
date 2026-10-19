/**
 * The free-revisit rule (#296): a patient who comes back within N days of a
 * paid consultation is seen free, with the same doctor or anyone in the
 * department. The bill applies it, so the counter never has to remember.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text } from "@mantine/core";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Card, NumberField, Switch } from "@/components/ui";

const schema = z.object({
  days: z.number({ error: "Enter the number of days (0 switches it off)" }).int().min(0).max(90),
  same_doctor: z.boolean(),
});
type Policy = z.infer<typeof schema>;

interface RevisitWindowCardProps {
  value: unknown;
  canManage: boolean;
  saving: boolean;
  onSave: (policy: Policy) => void;
}

function current(value: unknown): Policy {
  const v = (value ?? {}) as Partial<Policy>;
  return { days: typeof v.days === "number" ? v.days : 0, same_doctor: v.same_doctor ?? true };
}

export function RevisitWindowCard({ value, canManage, saving, onSave }: RevisitWindowCardProps) {
  const form = useForm<Policy>({ resolver: zodResolver(schema), values: current(value) });
  return (
    <Card withBorder padding="md">
      <form aria-label="Free revisit window" noValidate onSubmit={form.handleSubmit(onSave)}>
        <Stack gap="sm">
          <Text fw={600}>Free revisit window</Text>
          <Text size="sm" c="dimmed">
            A repeat OPD consultation within this many days of a paid one is billed at zero and
            marked &quot;Free revisit (day N of M)&quot;. A doctor&apos;s own fee (Admin → Users) is
            used for paid consultations. 0 switches the window off.
          </Text>
          <Group align="flex-end">
            <Controller
              control={form.control}
              name="days"
              render={({ field, fieldState }) => (
                <NumberField
                  label="Days"
                  min={0}
                  max={90}
                  w={120}
                  readOnly={!canManage}
                  value={field.value}
                  onChange={(v) => field.onChange(typeof v === "number" ? v : 0)}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={form.control}
              name="same_doctor"
              render={({ field }) => (
                <Switch
                  label="Only with the same doctor"
                  disabled={!canManage}
                  checked={field.value}
                  onChange={(e) => field.onChange(e.currentTarget.checked)}
                />
              )}
            />
            {canManage && (
              <Button tone="primary" type="submit" loading={saving}>
                Save
              </Button>
            )}
          </Group>
        </Stack>
      </form>
    </Card>
  );
}
