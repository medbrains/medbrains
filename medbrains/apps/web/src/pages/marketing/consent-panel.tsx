import { Group, Stack, Text, Tooltip } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { MarketingConsentEntry } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconBan, IconCheck } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Badge, Button, toast } from "@/components/ui";
import { marketingService } from "@/services/marketing.service";

/**
 * The channels a desk actually asks about, in the order it asks.
 *
 * Email is deliberately absent: there is no email sender, so a control for it
 * would promise something nothing can honour.
 */
const CHANNELS = [
  { key: "phone", label: "Calls" },
  { key: "sms", label: "SMS" },
  { key: "whatsapp", label: "WhatsApp" },
] as const;

/** What the desk is recording agreement to. */
const PURPOSE = "promotional";

type State = "granted" | "withdrawn" | "unasked";

/**
 * Consent as the desk sees it: three channels, three states.
 *
 * "Never asked" is rendered distinctly from "refused", and that distinction is
 * the point. Under DPDP silence is not consent, so both block a promotional
 * send — but they are different conversations. One means somebody still has to
 * ask; the other means somebody already answered, and asking again is the
 * thing that gets a hospital complained about.
 */
function stateOf(entries: MarketingConsentEntry[], channel: string): State {
  // The ledger is append-only and returned newest first, so the first row for
  // a channel is the current answer.
  const latest = entries.find((e) => e.channel === channel && e.purpose === PURPOSE);
  if (!latest) return "unasked";
  return latest.action === "granted" ? "granted" : "withdrawn";
}

function StateBadge({ state }: { state: State }) {
  // Never colour alone — each state says what it is in words.
  if (state === "granted") {
    return (
      <Badge tone="success" size="sm">
        Agreed
      </Badge>
    );
  }
  if (state === "withdrawn") {
    return (
      <Badge tone="danger" size="sm">
        Said stop
      </Badge>
    );
  }
  return (
    <Badge tone="neutral" size="sm">
      Not asked
    </Badge>
  );
}

/**
 * Record what a patient agreed to, and what they later refused.
 *
 * Before this, `consent_call`, `consent_sms` and `consent_whatsapp` existed on
 * the contact and appeared in the code only inside SELECT lists — never a
 * WHERE, never an UPDATE, with no way to set them. A patient could tell the
 * desk to stop and the desk had nowhere to put it.
 */
export function ConsentPanel({ contactId }: { contactId: string }) {
  const queryClient = useQueryClient();
  const canView = useHasPermission(P.MARKETING.CONSENT_VIEW);
  const canCapture = useHasPermission(P.MARKETING.CONSENT_CAPTURE);
  const canWithdraw = useHasPermission(P.MARKETING.CONSENT_WITHDRAW);

  const {
    data: entries = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["marketing", "contacts", contactId, "consent"],
    queryFn: () => marketingService.listConsent(contactId),
    // Reads gate the query, not only the control: without the permission the
    // fetch is never issued.
    enabled: canView,
  });

  const invalidate = () =>
    void queryClient.invalidateQueries({
      queryKey: ["marketing", "contacts", contactId, "consent"],
    });

  const mutation = useMutation({
    mutationFn: ({ channel, grant }: { channel: string; grant: boolean }) => {
      const body = { channel, purpose: PURPOSE, source: "front_desk" };
      return grant
        ? marketingService.recordConsent(contactId, body)
        : marketingService.withdrawConsent(contactId, body);
    },
    onSuccess: (entry) => {
      invalidate();
      toast.success(
        entry.action === "granted" ? "Agreement recorded" : "Recorded — they will not be contacted",
        { title: "Consent updated" },
      );
    },
    onError: (error: Error) => toast.error(error.message, { title: "Could not record consent" }),
  });

  const states = useMemo(
    () => CHANNELS.map((c) => ({ ...c, state: stateOf(entries, c.key) })),
    [entries],
  );

  if (!canView) return null;

  if (isError) {
    // An empty panel would read as "they never told us anything", which is a
    // claim about the patient rather than about the request.
    return (
      <Text size="xs" c="dimmed">
        Consent could not be loaded. This is not a statement that none was given.
      </Text>
    );
  }

  return (
    <Stack gap={6}>
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        Marketing consent
      </Text>
      {states.map(({ key, label, state }) => (
        <Group key={key} justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            <Text size="sm" w={80}>
              {label}
            </Text>
            <StateBadge state={state} />
          </Group>
          <Group gap={4} wrap="nowrap">
            {canCapture && state !== "granted" && (
              <Tooltip label="They agreed to be contacted about offers">
                <Button
                  tone="ghost"
                  size="xs"
                  leftSection={<IconCheck size={13} />}
                  loading={isLoading}
                  onClick={() => mutation.mutate({ channel: key, grant: true })}
                >
                  Agreed
                </Button>
              </Tooltip>
            )}
            {canWithdraw && state !== "withdrawn" && (
              <Tooltip label="They asked us to stop. Recorded permanently, not deleted.">
                <Button
                  tone="danger-ghost"
                  size="xs"
                  leftSection={<IconBan size={13} />}
                  loading={isLoading}
                  onClick={() => mutation.mutate({ channel: key, grant: false })}
                >
                  Said stop
                </Button>
              </Tooltip>
            )}
          </Group>
        </Group>
      ))}
      <Text size="xs" c="dimmed">
        Appointment reminders and reports are unaffected — this covers offers and campaigns only.
      </Text>
    </Stack>
  );
}
