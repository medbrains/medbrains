import { zodResolver } from "@hookform/resolvers/zod";
import { FileInput, Group, Stack, Text } from "@mantine/core";
import type { StoreCart as Cart, PortalDeliveryOffer } from "@medbrains/types";
import { IconTrash, IconUpload } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import {
  Alert,
  Button,
  Card,
  IconButton,
  NumberField,
  SegmentedControl,
  Select,
  toast,
} from "@/components/ui";
import { portalService } from "@/services/portal.service";
import {
  defaultChoice,
  type RefillChoiceValues,
  refillBody,
  refillChoiceSchema,
} from "../portal/portal-delivery";
import { DeliveryFields } from "../portal/portal-refill-choice";
import { checkoutBody, clampQuantity, pickupOnly, usablePrescriptions } from "./storefront";

interface StoreCartProps {
  token: string;
  /** Picked when the cart was filled from a prescription. */
  prescriptionId: string | null;
  onPlaced: () => void;
}

/** A file as base64, for the upload. */
function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("That file couldn't be read"));
    reader.readAsDataURL(file);
  });
}

/** The cart: quantities, the prescription it rides on, pickup or delivery, and placing it. */
export function StoreCart({ token, prescriptionId, onPlaced }: StoreCartProps) {
  const queryClient = useQueryClient();
  const cart = useQuery({
    queryKey: ["store-cart"],
    queryFn: () => portalService.getStoreCart(token),
  });
  const set = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) =>
      portalService.setStoreCartQuantity(token, id, quantity),
    onSuccess: (next) => queryClient.setQueryData(["store-cart"], next),
    onError: (e: Error) => toast.error(e.message, { title: "Not changed" }),
  });
  if (cart.isError) {
    return (
      <Alert tone="warning" title="Couldn't load your cart">
        Try again in a moment.
      </Alert>
    );
  }
  if (!cart.data) return null;
  if (cart.data.lines.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Your cart is empty. Search for a medicine, or order a prescription.
      </Text>
    );
  }
  return (
    <Stack gap="md">
      {cart.data.lines.map((l) => (
        <Card key={l.item.id} padding="sm">
          <Group justify="space-between" wrap="nowrap">
            <Stack gap={0}>
              <Text fw={600} size="sm">
                {l.item.name}
              </Text>
              <Text size="xs" c="dimmed">
                {l.item.price ? `₹${l.item.price} each` : "Not priced"}
                {l.from_prescription ? " · from your prescription" : ""}
                {l.item.on_sale ? "" : " · can't be ordered online"}
              </Text>
            </Stack>
            <Group gap="xs" wrap="nowrap">
              <NumberField
                aria-label={`How many ${l.item.name}`}
                w={88}
                min={1}
                max={l.item.max_quantity}
                value={l.quantity}
                onChange={(v) =>
                  set.mutate({ id: l.item.id, quantity: clampQuantity(Number(v), l.item) })
                }
              />
              <IconButton
                aria-label={`Remove ${l.item.name}`}
                onClick={() => set.mutate({ id: l.item.id, quantity: 0 })}
              >
                <IconTrash size={16} />
              </IconButton>
            </Group>
          </Group>
        </Card>
      ))}
      <Text fw={600}>Total ₹{cart.data.total}</Text>
      <PlaceOrder
        token={token}
        cart={cart.data}
        prescriptionId={prescriptionId}
        onPlaced={onPlaced}
      />
    </Stack>
  );
}

function PlaceOrder({ token, cart, prescriptionId, onPlaced }: StoreCartProps & { cart: Cart }) {
  const queryClient = useQueryClient();
  const [hospitalRx, setHospitalRx] = useState<string | null>(prescriptionId);
  const today = new Date().toISOString().slice(0, 10);
  const refills = useQuery({
    queryKey: ["portal-refills"],
    queryFn: () => portalService.getPortalRefills(token),
    enabled: cart.prescription_needed,
  });
  const offer = useQuery({
    queryKey: ["store-delivery-options", cart.lines.length, cart.total],
    queryFn: () => portalService.getStoreDeliveryOptions(token),
    retry: false,
  });
  const upload = useMutation({
    mutationFn: async (file: File) =>
      portalService.uploadStorePrescription(token, await toBase64(file)),
    onSuccess: (next) => {
      queryClient.setQueryData(["store-cart"], next);
      toast.success("Prescription uploaded. A pharmacist will check it.");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not uploaded" }),
  });
  const { control, handleSubmit } = useForm<RefillChoiceValues>({
    resolver: zodResolver(refillChoiceSchema),
    values: defaultChoice(offer.data),
  });
  const fulfilment = useWatch({ control, name: "fulfilment" });
  const place = useMutation({
    mutationFn: (values: RefillChoiceValues) => {
      const built = checkoutBody(
        cart,
        { hospitalId: hospitalRx, uploaded: cart.prescription_uploaded },
        refillBody(values, offer.data).delivery,
      );
      if ("problem" in built) throw new Error(built.problem);
      return portalService.storeCheckout(token, built.body);
    },
    onSuccess: (order) => {
      toast.success(
        order.status === "awaiting_verification"
          ? "A pharmacist will check your prescription. Follow it under Orders."
          : "The pharmacy is preparing it. Follow it under Orders.",
        { title: "Order placed" },
      );
      void queryClient.invalidateQueries({ queryKey: ["store-cart"] });
      void queryClient.invalidateQueries({ queryKey: ["store-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["portal-deliveries"] });
      onPlaced();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not ordered" }),
  });
  const collect = pickupOnly(cart);
  const deliverable: PortalDeliveryOffer | undefined = offer.data?.available
    ? offer.data
    : undefined;

  return (
    <Stack component="form" gap="sm" onSubmit={handleSubmit((v) => place.mutate(v))}>
      {cart.prescription_needed && (
        <Stack gap="xs">
          <Text fw={600} size="sm">
            Prescription
          </Text>
          <Select
            label="One of your prescriptions from this hospital"
            placeholder="Choose, or upload one below"
            clearable
            data={usablePrescriptions(refills.data ?? [], today).map((r) => ({
              value: r.prescription_id,
              label: `${r.prescribed_at.slice(0, 10)} · ${r.drugs.join(", ")}`,
            }))}
            value={hospitalRx}
            onChange={setHospitalRx}
          />
          <FileInput
            label="Or upload a photo or PDF of it"
            accept="image/jpeg,image/png,application/pdf"
            leftSection={<IconUpload size={16} />}
            onChange={(f) => f && upload.mutate(f)}
            description={
              cart.prescription_uploaded ? "Uploaded. A new file replaces it." : undefined
            }
          />
        </Stack>
      )}
      {collect.length > 0 && (
        <Alert tone="info" title="Collect at the pharmacy">
          {collect.join(", ")} can't be delivered.
        </Alert>
      )}
      <Controller
        control={control}
        name="fulfilment"
        render={({ field }) => (
          <SegmentedControl
            aria-label="How you'll get it"
            data={[
              { value: "pickup", label: "Collect at the pharmacy" },
              { value: "delivery", label: "Home delivery", disabled: !deliverable },
            ]}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />
      {offer.data && !offer.data.available && (
        <Text size="xs" c="dimmed">
          {offer.data.reason}
        </Text>
      )}
      {deliverable && fulfilment === "delivery" && (
        <DeliveryFields control={control} offer={deliverable} />
      )}
      <Button type="submit" tone="primary" loading={place.isPending}>
        Place order
      </Button>
    </Stack>
  );
}
