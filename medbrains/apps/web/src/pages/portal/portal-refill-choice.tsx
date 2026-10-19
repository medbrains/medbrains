/**
 * Asking for a refill: collect it at the pharmacy, or have it brought home.
 * For home delivery the patient picks the address, a phone for the runner,
 * an optional time of day, and how to pay — only from what the hospital
 * offers them. When delivery isn't offered the reason is shown, and pickup
 * still works.
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader, Stack, Text } from "@mantine/core";
import type { PortalDeliveryOffer, PortalRefill } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
import {
  Alert,
  Button,
  Input,
  Modal,
  SegmentedControl,
  Select,
  TextArea,
  toast,
} from "@/components/ui";
import { portalService } from "@/services/portal.service";
import {
  defaultChoice,
  NEW_ADDRESS,
  PAYMENT_LABEL,
  type RefillChoiceValues,
  refillBody,
  refillChoiceSchema,
  SLOT_LABEL,
} from "./portal-delivery";

interface RefillChoiceModalProps {
  token: string;
  row: PortalRefill;
  opened: boolean;
  onClose: () => void;
}

export function RefillChoiceModal({ token, row, opened, onClose }: RefillChoiceModalProps) {
  const options = useQuery({
    queryKey: ["portal-delivery-options", row.prescription_id],
    queryFn: () => portalService.getPortalDeliveryOptions(token, row.prescription_id),
    enabled: opened,
    retry: false,
  });
  return (
    <Modal opened={opened} onClose={onClose} title={`Refill: ${row.drugs.join(", ")}`}>
      {options.isLoading ? (
        <Loader size="sm" />
      ) : (
        <ChoiceForm
          token={token}
          row={row}
          offer={options.data}
          offerFailed={options.isError}
          onDone={onClose}
        />
      )}
    </Modal>
  );
}

interface ChoiceFormProps {
  token: string;
  row: PortalRefill;
  offer: PortalDeliveryOffer | undefined;
  offerFailed: boolean;
  onDone: () => void;
}

function ChoiceForm({ token, row, offer, offerFailed, onDone }: ChoiceFormProps) {
  const queryClient = useQueryClient();
  const { control, handleSubmit } = useForm<RefillChoiceValues>({
    resolver: zodResolver(refillChoiceSchema),
    defaultValues: defaultChoice(offer),
  });
  const fulfilment = useWatch({ control, name: "fulfilment" });
  const ask = useMutation({
    mutationFn: (values: RefillChoiceValues) =>
      portalService.requestPortalRefill(token, row.prescription_id, refillBody(values, offer)),
    onSuccess: (request, values) => {
      toast.success(
        request.status === "with_doctor"
          ? "Your doctor will look at it. We'll show their answer here."
          : values.fulfilment === "delivery"
            ? "Follow it under Deliveries."
            : "The pharmacy will have it ready.",
        { title: "Refill requested" },
      );
      void queryClient.invalidateQueries({ queryKey: ["portal-refills"] });
      void queryClient.invalidateQueries({ queryKey: ["portal-deliveries"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Refill not requested" }),
  });
  const canDeliver = offer?.available === true;

  return (
    <Stack component="form" gap="sm" onSubmit={handleSubmit((v) => ask.mutate(v))}>
      <Text size="sm">{row.message}</Text>
      <Controller
        control={control}
        name="fulfilment"
        render={({ field }) => (
          <SegmentedControl
            aria-label="How you'll get it"
            data={[
              { value: "pickup", label: "Collect at the pharmacy" },
              { value: "delivery", label: "Home delivery", disabled: !canDeliver },
            ]}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />
      {offerFailed && (
        <Alert tone="warning" title="We couldn't check home delivery">
          You can still collect it at the pharmacy, or try again in a moment.
        </Alert>
      )}
      {offer && !offer.available && (
        <Alert tone="info" title="Home delivery isn't available for this">
          {offer.reason}
        </Alert>
      )}
      {canDeliver && fulfilment === "delivery" && (
        <DeliveryFields control={control} offer={offer} />
      )}
      <Button type="submit" tone="primary" loading={ask.isPending}>
        Request refill
      </Button>
    </Stack>
  );
}

function DeliveryFields({
  control,
  offer,
}: {
  control: ReturnType<typeof useForm<RefillChoiceValues>>["control"];
  offer: PortalDeliveryOffer;
}) {
  const addressKey = useWatch({ control, name: "addressKey" });
  const payment = useWatch({ control, name: "payment" });
  const addresses = [
    ...offer.addresses.map((a, i) => ({ value: String(i), label: `${a.label}: ${a.address}` })),
    { value: NEW_ADDRESS, label: "Somewhere else" },
  ];
  const fee = Number(offer.delivery_fee);
  return (
    <Stack gap="sm">
      <Controller
        control={control}
        name="addressKey"
        render={({ field }) => (
          <Select
            label="Deliver to"
            data={addresses}
            value={field.value}
            onChange={(v) => field.onChange(v ?? NEW_ADDRESS)}
            allowDeselect={false}
          />
        )}
      />
      {addressKey === NEW_ADDRESS && (
        <>
          <Controller
            control={control}
            name="newAddress"
            render={({ field, fieldState }) => (
              <TextArea
                label="Address"
                required
                autoComplete="street-address"
                {...field}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="pincode"
            render={({ field }) => (
              <Input
                label="PIN code"
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={6}
                {...field}
              />
            )}
          />
        </>
      )}
      <Controller
        control={control}
        name="landmark"
        render={({ field }) => <Input label="Landmark (optional)" {...field} />}
      />
      <Controller
        control={control}
        name="phone"
        render={({ field, fieldState }) => (
          <Input
            label="Phone for the delivery"
            inputMode="tel"
            autoComplete="tel"
            required
            {...field}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="slot"
        render={({ field }) => (
          <Select
            label="Preferred time (optional)"
            placeholder="Any time"
            clearable
            data={offer.slots.map((s) => ({ value: s, label: SLOT_LABEL[s] }))}
            value={field.value || null}
            onChange={(v) => field.onChange(v ?? "")}
          />
        )}
      />
      <Controller
        control={control}
        name="payment"
        render={({ field }) => (
          <SegmentedControl
            aria-label="How you'll pay"
            data={offer.payments.map((p) => ({ value: p, label: PAYMENT_LABEL[p] }))}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />
      <Text size="xs" c="dimmed">
        {fee > 0 ? `A delivery fee of ₹${offer.delivery_fee} is added to your bill. ` : ""}
        {payment === "prepaid"
          ? "Once the pharmacist approves it, a payment link appears under Deliveries. It goes out once paid."
          : "Pay when it arrives."}
      </Text>
    </Stack>
  );
}
