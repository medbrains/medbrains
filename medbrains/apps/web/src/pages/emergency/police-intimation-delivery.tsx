/**
 * What happened to a police intimation's SMS and email, read back from the
 * outbox by the server. Nothing sent is said in words — a blank cell would
 * read as "sent".
 */
import { Stack, Text } from "@mantine/core";
import type { MlcIntimationDelivery } from "@medbrains/types";
import type { BadgeTone } from "@/components/ui";
import { Badge } from "@/components/ui";

const STATUS: Record<MlcIntimationDelivery["status"], { tone: BadgeTone; label: string }> = {
  queued: { tone: "warning", label: "Queued" },
  sent: { tone: "success", label: "Sent" },
  failed: { tone: "danger", label: "Failed" },
  not_configured: { tone: "danger", label: "Not sent" },
};

/** "SMS · Not sent — SMS not configured": a stubbed send never reads as sent. */
export function deliveryLabel(d: Pick<MlcIntimationDelivery, "channel" | "status">): string {
  const channel = d.channel === "sms" ? "SMS" : "Email";
  const base = `${channel} · ${STATUS[d.status].label}`;
  return d.status === "not_configured" ? `${base} — ${channel} not configured` : base;
}

export function PoliceIntimationDelivery({
  delivery,
}: {
  delivery: MlcIntimationDelivery[] | null;
}) {
  if (!delivery || delivery.length === 0) {
    return (
      <Text size="xs" c="dimmed">
        Not sent — no police contact is configured. Inform the station by phone or in person, or ask
        an administrator to set the contact on the MLC register.
      </Text>
    );
  }
  return (
    <Stack gap={2}>
      {delivery.map((d) => (
        <Stack key={`${d.channel}:${d.to}`} gap={0}>
          <Badge tone={STATUS[d.status].tone} size="sm">
            {deliveryLabel(d)}
          </Badge>
          <Text size="xs" c="dimmed">
            {d.to ?? "---"}
            {d.status === "failed" && d.last_error ? ` — ${d.last_error}` : ""}
          </Text>
        </Stack>
      ))}
    </Stack>
  );
}
