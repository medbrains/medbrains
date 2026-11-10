import { Stack, Text } from "@mantine/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, Button, Select, toast } from "@/components/ui";
import { portalService } from "@/services/portal.service";

interface StoreCheckoutHoldProps {
  token: string;
  fulfilment: "pickup" | "delivery";
  /** The delivery pincode typed or saved, when delivering. */
  pincode: string | undefined;
  pickupStore: string | null;
  onPickupStore: (id: string | null) => void;
  returnPolicy: string;
}

/**
 * Checkout's stock hold and where the order comes from: whether the
 * hospital delivers to the pincode (pickup is always offered), which
 * pharmacy to collect from, holding the medicines while the patient
 * finishes, and the return policy before they place the order.
 */
export function StoreCheckoutHold(props: StoreCheckoutHoldProps) {
  const { token, fulfilment, pincode, pickupStore, onPickupStore, returnPolicy } = props;
  const where = useQuery({
    queryKey: ["store-serviceability", fulfilment === "delivery" ? (pincode ?? "") : ""],
    queryFn: () =>
      portalService.getStoreServiceability(token, fulfilment === "delivery" ? pincode : undefined),
  });
  const hold = useMutation({
    mutationFn: () =>
      portalService.holdStoreCart(token, {
        ...(fulfilment === "delivery" && pincode ? { pincode } : {}),
        ...(fulfilment === "pickup" && pickupStore ? { pickup_store_id: pickupStore } : {}),
      }),
    onError: (e: Error) => toast.error(e.message, { title: "Couldn't hold your medicines" }),
  });
  const stores = where.data?.pickup_stores ?? [];
  return (
    <Stack gap="xs">
      {where.isError && (
        <Alert tone="warning" title="We couldn't check where we deliver">
          Try again in a moment.
        </Alert>
      )}
      {fulfilment === "delivery" && where.data && !where.data.delivers && (
        <Alert tone="warning" title={`We don't deliver to ${pincode ?? "that pincode"} yet`}>
          Choose to collect it at the pharmacy instead.
        </Alert>
      )}
      {fulfilment === "pickup" && where.data?.multi_store && (
        <Select
          label="Collect from"
          placeholder="The nearest pharmacy that has everything"
          clearable
          data={stores.map((s) => ({
            value: s.id,
            label: s.address ? `${s.name} · ${s.address}` : s.name,
          }))}
          value={pickupStore}
          onChange={onPickupStore}
        />
      )}
      <Button tone="secondary" size="xs" loading={hold.isPending} onClick={() => hold.mutate()}>
        Hold my medicines while I check out
      </Button>
      {hold.data?.held_until && (
        <Text size="xs">
          Held for you until{" "}
          {new Date(hold.data.held_until).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
          .
        </Text>
      )}
      <Text size="xs" c="dimmed">
        {returnPolicy}
      </Text>
    </Stack>
  );
}
