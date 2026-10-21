import { CopyButton, Group, Stack, Text } from "@mantine/core";
import type { PaymentLinkView } from "@medbrains/types";
import { IconCheck, IconCopy, IconSend, IconX } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Card } from "@/components/ui";
import { paymentsService } from "@/services/payments.service";
import { isLive, linkBadge, linkEnding, linkProgress } from "./link-status";

interface LinkStatusCardProps {
  link: PaymentLinkView;
  /** May resend and cancel: the desk collects this link's bills. */
  canAct: boolean;
  stationId?: string | null;
}

/** One link: its state, its URL, and resend / cancel while it is live. */
export function LinkStatusCard({ link, canAct, stationId }: LinkStatusCardProps) {
  const queryClient = useQueryClient();
  const refresh = (next: PaymentLinkView) => {
    queryClient.setQueryData(["payment-link", next.id], next);
    void queryClient.invalidateQueries({ queryKey: ["payment-links"] });
  };
  const resend = useMutation({
    mutationFn: () =>
      paymentsService.resendPaymentLink(link.id, {
        channel: link.channel === "whatsapp" ? "whatsapp" : "sms",
        station_id: stationId ?? undefined,
      }),
    onSuccess: refresh,
  });
  const cancel = useMutation({
    mutationFn: () => paymentsService.cancelPaymentLink(link.id),
    onSuccess: refresh,
  });
  const badge = linkBadge(link);
  const ending = linkEnding(link);
  const live = isLive(link);
  const error = resend.error ?? cancel.error;
  return (
    <Card data-testid="payment-link-card">
      <Stack gap="xs" p="sm">
        <Group justify="space-between" wrap="nowrap">
          <Badge tone={badge.tone} data-testid="payment-link-status">
            {badge.label}
          </Badge>
          <Text size="sm" ff="monospace" data-testid="payment-link-progress">
            {linkProgress(link)}
          </Text>
        </Group>
        {link.short_url && live && (
          <Group gap="xs" wrap="nowrap">
            <Text size="sm" ff="monospace" truncate data-testid="payment-link-url">
              {link.short_url}
            </Text>
            <CopyButton value={link.short_url}>
              {({ copied, copy }) => (
                <Button tone="ghost" size="compact-xs" onClick={copy} aria-label="Copy the link">
                  {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                </Button>
              )}
            </CopyButton>
          </Group>
        )}
        <Text size="xs" c="dimmed">
          {live
            ? `Open till ${new Date(link.expires_at).toLocaleString("en-IN")}`
            : `Made ${new Date(link.created_at).toLocaleString("en-IN")}`}
          {link.sent_count > 0 ? ` · sent ${link.sent_count}× by ${link.channel}` : ""}
          {link.accept_partial ? " · part payments allowed" : ""}
        </Text>
        {ending && (
          <Text size="xs" c="dimmed">
            {ending}
          </Text>
        )}
        {error && (
          <Alert tone="danger" title="Not done">
            {error.message}
          </Alert>
        )}
        {canAct && live && (
          <Group gap="xs">
            <Button
              tone="tertiary"
              size="xs"
              leftSection={<IconSend size={16} />}
              loading={resend.isPending}
              onClick={() => resend.mutate()}
            >
              {link.sent_count > 0 ? "Resend" : "Send by SMS"}
            </Button>
            <Button
              tone="danger-ghost"
              size="xs"
              leftSection={<IconX size={16} />}
              loading={cancel.isPending}
              onClick={() => cancel.mutate()}
            >
              Cancel link
            </Button>
          </Group>
        )}
      </Stack>
    </Card>
  );
}
