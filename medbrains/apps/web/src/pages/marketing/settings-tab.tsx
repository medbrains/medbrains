import { Group, NumberInput, Stack, Text, TextInput } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { MarketingSendPolicy } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Button, Card, toast } from "@/components/ui";
import { marketingService } from "@/services/marketing.service";

/**
 * How often the hospital is willing to message somebody, and when it will not.
 *
 * `mkt_send_policy` and `marketing.settings.manage` both existed with no
 * handler between them, so the consent gate carried an `over_cap` refusal it
 * could never emit — nothing counted sends and nothing read a limit. This is
 * the screen that makes the cap real.
 *
 * The caps apply to promotional traffic only. An appointment reminder is not
 * an offer, and a patient who has had three offers this week must still be
 * told when to come in.
 */
export function MarketingSettingsTab() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(P.MARKETING.SETTINGS_MANAGE);
  const [draft, setDraft] = useState<MarketingSendPolicy | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["marketing", "send-policy"],
    queryFn: () => marketingService.sendPolicy(),
  });

  // The server returns the defaults it actually enforces when a tenant has
  // never saved one, so the form shows what is in force rather than blanks
  // implying nothing is.
  const policy = draft ?? data ?? null;

  const save = useMutation({
    mutationFn: (values: MarketingSendPolicy) => marketingService.updateSendPolicy(values),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ["marketing", "send-policy"] });
      setDraft(null);
      toast.success(`At most ${saved.max_per_day} a day and ${saved.max_per_week} a week`, {
        title: "Sending limits saved",
      });
    },
    onError: (error: Error) => toast.error(error.message, { title: "Could not save the limits" }),
  });

  const patch = (change: Partial<MarketingSendPolicy>) => {
    if (!policy) return;
    setDraft({ ...policy, ...change });
  };

  if (isError) {
    return (
      <Alert tone="danger" title="The sending limits could not be loaded">
        This is not a statement that no limits apply — the setting failed to load, and the server
        keeps enforcing whatever is saved.
      </Alert>
    );
  }

  return (
    <Stack>
      <Card>
        <Stack gap="md">
          <Stack gap={2}>
            <Text fw={600} size="sm">
              Sending limits
            </Text>
            <Text size="xs" c="dimmed">
              Applied to offers and campaigns only. Appointment reminders, reports and bills are
              never held back by these — somebody who has had three offers this week must still be
              told when to come in.
            </Text>
          </Stack>

          <Group grow>
            <NumberInput
              label="Most messages per day"
              description="Zero stops promotional sending entirely."
              min={0}
              disabled={!canManage || isLoading}
              value={policy?.max_per_day ?? ""}
              onChange={(v) => patch({ max_per_day: Number(v) || 0 })}
            />
            <NumberInput
              label="Most messages per week"
              min={0}
              disabled={!canManage || isLoading}
              value={policy?.max_per_week ?? ""}
              onChange={(v) => patch({ max_per_week: Number(v) || 0 })}
            />
          </Group>

          <Stack gap={2}>
            <Text fw={600} size="sm">
              Quiet hours
            </Text>
            <Text size="xs" c="dimmed">
              A promotional run started inside this window is refused rather than queued — it stays
              approved and can be sent once the window ends.
            </Text>
          </Stack>

          <Group grow>
            <TextInput
              label="Quiet from"
              type="time"
              disabled={!canManage || isLoading}
              value={policy?.quiet_from?.slice(0, 5) ?? ""}
              onChange={(e) => patch({ quiet_from: `${e.currentTarget.value}:00` })}
            />
            <TextInput
              label="Quiet until"
              type="time"
              disabled={!canManage || isLoading}
              value={policy?.quiet_to?.slice(0, 5) ?? ""}
              onChange={(e) => patch({ quiet_to: `${e.currentTarget.value}:00` })}
            />
            <TextInput
              label="Timezone"
              description="The recipient's evening, not the server's"
              disabled={!canManage || isLoading}
              value={policy?.timezone ?? ""}
              onChange={(e) => patch({ timezone: e.currentTarget.value })}
            />
          </Group>

          {canManage && (
            <Group justify="flex-end">
              <Button tone="ghost" disabled={draft === null} onClick={() => setDraft(null)}>
                Discard
              </Button>
              <Button
                tone="primary"
                disabled={draft === null}
                loading={save.isPending}
                onClick={() => draft && save.mutate(draft)}
              >
                Save limits
              </Button>
            </Group>
          )}

          {!canManage && (
            <Text size="xs" c="dimmed">
              You can see the limits in force but not change them.
            </Text>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}
