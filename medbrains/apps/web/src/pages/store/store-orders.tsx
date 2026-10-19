import { Group, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Alert, Badge, Card } from "@/components/ui";
import { portalService } from "@/services/portal.service";
import { ORDER_STATUS_VIEW, rejectReasonLabel } from "./storefront";

/** Where each online order stands, with the pharmacist's answer per medicine. */
export function StoreOrders({ token }: { token: string }) {
  const orders = useQuery({
    queryKey: ["store-orders"],
    queryFn: () => portalService.getStoreOrders(token),
    refetchInterval: 60_000,
  });
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
                <Text
                  key={l.catalog_item_id}
                  size="sm"
                  td={l.status === "rejected" ? "line-through" : undefined}
                >
                  {l.drug_name} × {l.approved_quantity ?? l.quantity}
                  {l.status === "rejected"
                    ? ` — not approved: ${rejectReasonLabel(l.reject_reason) ?? ""}`
                    : ""}
                </Text>
              ))}
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
            </Stack>
          </Card>
        );
      })}
    </Stack>
  );
}
