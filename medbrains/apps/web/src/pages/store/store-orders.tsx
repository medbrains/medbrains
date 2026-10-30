import { Group, Stack, Text } from "@mantine/core";
import type { OutsidePrint, StoreOrder } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { OutsidePrintSheet } from "@/components/Pharmacy/OutsidePrintSheet";
import { Alert, Badge, Card } from "@/components/ui";
import { portalService } from "@/services/portal.service";
import { StoreOrderActions } from "./store-order-actions";
import { StoreReturnForm } from "./store-return-form";
import { StoreSubstituteConsent } from "./store-substitute-consent";
import { ORDER_STATUS_VIEW, rejectReasonLabel } from "./storefront";

const RETURN_VIEW: Record<string, string> = {
  requested: "Return asked for: the pharmacy replies within 48 hours",
  acknowledged: "Return being looked at",
  received: "Return received: refund on its way",
  refused: "Return not accepted",
};

/** Where each online order stands, with the pharmacist's answer per medicine. */
export function StoreOrders({ token }: { token: string }) {
  const orders = useQuery({
    queryKey: ["store-orders"],
    queryFn: () => portalService.getStoreOrders(token),
    refetchInterval: 60_000,
  });
  const [returning, setReturning] = useState<StoreOrder | null>(null);
  const [printed, setPrinted] = useState<OutsidePrint | null>(null);
  if (orders.isError) {
    return (
      <Alert tone="warning" title="Couldn't load your orders">
        Try again in a moment.
      </Alert>
    );
  }
  if (orders.data?.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No orders yet.
      </Text>
    );
  }
  return (
    <Stack gap="sm">
      {(orders.data ?? []).map((o) => {
        const view = ORDER_STATUS_VIEW[o.status];
        return (
          <Card key={o.id} padding="sm">
            <Stack gap={4}>
              <Group justify="space-between">
                <Text size="sm" fw={600}>
                  {o.placed_at ? new Date(o.placed_at).toLocaleString() : "Order"}
                </Text>
                <Badge size="sm" tone={view.tone}>
                  {view.label}
                </Badge>
              </Group>
              {o.lines.map((l) => (
                <Stack key={l.line_id} gap={2}>
                  <Text
                    size="sm"
                    td={
                      l.status === "rejected" || l.status === "outside_pharmacy"
                        ? "line-through"
                        : undefined
                    }
                  >
                    {l.substitute_name ?? l.drug_name} × {l.approved_quantity ?? l.quantity}
                    {l.status === "rejected"
                      ? ` — not approved: ${rejectReasonLabel(l.reject_reason) ?? ""}`
                      : ""}
                    {l.status === "outside_pharmacy" ? " — printed for another pharmacy" : ""}
                  </Text>
                  <StoreSubstituteConsent token={token} orderId={o.id} line={l} />
                </Stack>
              ))}
              {o.return_status && (
                <Text size="xs">{RETURN_VIEW[o.return_status] ?? o.return_status}</Text>
              )}
              {o.decision_note && <Text size="xs">Pharmacist: {o.decision_note}</Text>}
              <Text size="sm">
                Total ₹{o.total} ·{" "}
                {o.fulfilment === "delivery" ? "home delivery" : "collect at the pharmacy"}
              </Text>
              {o.fulfilment === "delivery" && o.status === "released" && (
                <Text size="xs" c="dimmed">
                  Follow the delivery under Medicines → Deliveries.
                </Text>
              )}
              <StoreOrderActions
                token={token}
                order={o}
                onReturn={setReturning}
                onPrinted={setPrinted}
              />
            </Stack>
          </Card>
        );
      })}
      <StoreReturnForm token={token} order={returning} onClose={() => setReturning(null)} />
      <OutsidePrintSheet print={printed} onClose={() => setPrinted(null)} />
    </Stack>
  );
}
