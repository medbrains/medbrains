// The figure at the top of the queue: how much open work is worth in rupees,
// and, for whoever may, a "Check now" for orders done but never billed. A
// total that could not be read says so; it is never shown as ₹0.

import { Group, Stack, Text, Title } from "@mantine/core";
import type { ChargeAttentionKind, ChargeAttentionSummary } from "@medbrains/types";
import { IconRefresh } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, toast } from "@/components/ui";
import { billingService } from "@/services/billing.service";
import { rupees } from "./charge-attention-labels";

interface ChargeAttentionTotalProps {
  kind: ChargeAttentionKind | null;
  /** The open rows' count and total; undefined while loading. */
  summary: ChargeAttentionSummary | undefined;
  error: Error | null;
  onRetry: () => void;
  /** May run the unbilled-orders check now. */
  canScan: boolean;
}

/** "3 open", "1 open · 2 without a tariff, not in the total". */
function countLine(open: number, unpriced: number): string {
  const base = `${open} open`;
  return unpriced > 0 ? `${base} · ${unpriced} without a tariff, not in the total` : base;
}

/** Open count and ₹ total of the rows the viewer may see, with the scan button. */
export function ChargeAttentionTotal(props: ChargeAttentionTotalProps) {
  const { kind, summary: data, error, onRetry, canScan } = props;
  const queryClient = useQueryClient();
  const scan = useMutation({
    mutationFn: () => billingService.scanUnbilledOrders(),
    onSuccess: ({ queued }) => {
      void queryClient.invalidateQueries({ queryKey: ["billing", "charge-attention"] });
      toast.success(
        queued === 0 ? "No new unbilled orders" : `${queued} unbilled order(s) added to the queue`,
      );
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (error) {
    return (
      <Alert tone="danger" title="The total could not be loaded">
        <Group justify="space-between" wrap="wrap">
          <Text size="sm">This is not ₹0. The queue may still hold charges.</Text>
          <Button tone="tertiary" onClick={onRetry}>
            Try again
          </Button>
        </Group>
      </Alert>
    );
  }

  return (
    <Card pattern={false}>
      <Group justify="space-between" wrap="wrap" align="flex-end">
        <Stack gap={4}>
          <Text size="sm" c="dimmed">
            {kind === "unbilled" ? "Done, not billed" : "Needs attention"}
          </Text>
          <Title order={3} aria-live="polite">
            {data ? (data.open_amount === null ? "Amounts hidden" : rupees(data.open_amount)) : "…"}
          </Title>
          {data && (
            <Text size="sm" c="dimmed">
              {countLine(data.open_count, data.unpriced_count)}
            </Text>
          )}
        </Stack>
        {canScan && (
          <Button
            tone="secondary"
            leftSection={<IconRefresh size={16} />}
            loading={scan.isPending}
            onClick={() => scan.mutate()}
          >
            Check for unbilled orders
          </Button>
        )}
      </Group>
    </Card>
  );
}
