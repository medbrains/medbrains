import { Stack, Text } from "@mantine/core";
import type { UhiRequest } from "@medbrains/types";
import { Badge } from "@/components/ui";

interface UhiPaymentCellProps {
  request: UhiRequest;
}

const LET_GO = new Set(["cancelled", "expired", "declined"]);

/**
 * How a UHI booking is paid: online when booked (ON-ORDER) or at the
 * hospital (ON-FULFILLMENT). Money taken for a booking that no longer
 * stands is a refund the desk must make — said in words, not colour alone.
 */
export function UhiPaymentCell({ request: r }: UhiPaymentCellProps) {
  if (!r.payment_type) {
    return (
      <Text size="xs" c="dimmed">
        —
      </Text>
    );
  }
  const paid = r.payment_status === "PAID";
  const online = r.payment_type === "ON-ORDER";
  const refund = paid && LET_GO.has(r.state);
  return (
    <Stack gap={2}>
      {refund ? (
        <Badge tone="danger">Paid — refund due</Badge>
      ) : (
        <Badge tone={paid ? "success" : online ? "warning" : "neutral"}>
          {paid ? "Paid online" : online ? "Not paid yet" : "Pay at the hospital"}
        </Badge>
      )}
      <Text size="xs" c="dimmed">
        {r.amount ? `₹${r.amount}` : "Fee set at the hospital"}
      </Text>
    </Stack>
  );
}
