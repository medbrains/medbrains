import { Group, Stack, Text } from "@mantine/core";
import type { CreateLinkRequest } from "@medbrains/types";
import { IconLink } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { LinkStatusCard } from "@/components/payments/links/LinkStatusCard";
import { isLive } from "@/components/payments/links/link-status";
import { Alert, Button, NumberField, SegmentedControl } from "@/components/ui";
import { paymentsService } from "@/services/payments.service";
import { rupees } from "./collect-math";
import type { TenderBodyProps } from "./TenderBody";

/** How often a live link is re-read while the drawer is open. */
const LINK_POLL_MS = 5_000;

type Channel = CreateLinkRequest["channel"];

/**
 * Send the patient a link for the amount above (the whole due, or the part
 * typed in). They may pay all or part of it; the rest is taken here in any
 * way. The link's state shows live; a part paid refreshes the dues.
 */
export function LinkTender(props: TenderBodyProps) {
  const { amount, patientId, bills, stationId, onMoneyPosted } = props;
  const [channel, setChannel] = useState<Channel>("sms");
  const [days, setDays] = useState<number | string>("");
  const [linkId, setLinkId] = useState<string | null>(null);
  const paidSeen = useRef(0);
  const send = useMutation({
    mutationFn: () =>
      paymentsService.createPaymentLink({
        patient_id: patientId ?? "",
        scope: "all",
        invoice_ids: bills.map((b) => b.invoice_id),
        amount,
        channel,
        station_id: stationId ?? undefined,
        expiry_days: Number(days) > 0 ? Number(days) : undefined,
      }),
    onSuccess: (link) => setLinkId(link.id),
  });
  const link = useQuery({
    queryKey: ["payment-link", linkId],
    queryFn: async () => {
      const read = await paymentsService.getPaymentLink(linkId ?? "");
      if (Number(read.amount_paid) > paidSeen.current) {
        paidSeen.current = Number(read.amount_paid);
        onMoneyPosted();
      }
      return read;
    },
    enabled: Boolean(linkId),
    refetchInterval: (q) => (q.state.data && !isLive(q.state.data) ? false : LINK_POLL_MS),
  });
  if (link.data) {
    return (
      <Stack gap="xs" aria-live="polite">
        <LinkStatusCard link={link.data} canAct stationId={stationId} />
        <Text size="xs" c="dimmed">
          Take the rest here in any way — the link closes itself once the bill is paid.
        </Text>
      </Stack>
    );
  }
  return (
    <Stack gap="sm">
      <SegmentedControl
        aria-label="Send the link by"
        fullWidth
        value={channel}
        onChange={(v) => setChannel(v as Channel)}
        data={[
          { value: "sms", label: "SMS" },
          { value: "whatsapp", label: "WhatsApp" },
          { value: "copy", label: "Copy" },
        ]}
      />
      <Group grow align="flex-end">
        <NumberField
          label="Open for (days)"
          description="Blank: the hospital's setting"
          value={days}
          onChange={setDays}
          min={1}
          max={90}
          allowDecimal={false}
        />
        <Button
          tone="secondary"
          leftSection={<IconLink size={16} />}
          loading={send.isPending || (Boolean(linkId) && link.isPending)}
          disabled={amount <= 0 || !patientId || bills.length === 0}
          onClick={() => send.mutate()}
        >
          Send link for {rupees(amount)}
        </Button>
      </Group>
      {send.isError && (
        <Alert tone="warning" title="No link was sent" data-testid="alert-link-error">
          {send.error.message}
        </Alert>
      )}
      {link.isError && (
        <Alert tone="danger" title="The link's state could not be read">
          {link.error.message}
        </Alert>
      )}
    </Stack>
  );
}
