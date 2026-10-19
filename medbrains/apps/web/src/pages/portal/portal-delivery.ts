/**
 * The patient's pickup-or-delivery choice for a refill, and how a delivery's
 * progress reads. Pure, so the form and the tracking card agree with the
 * tests. The server decides what is offered; this only shapes what is sent.
 */

import type {
  DeliveryPayment,
  DeliverySlot,
  PortalDelivery,
  PortalDeliveryChoice,
  PortalDeliveryOffer,
  PortalDeliveryStage,
} from "@medbrains/types";
import { z } from "zod";
import type { BadgeTone } from "@/components/ui";

/** The address picker's value for "somewhere else". */
export const NEW_ADDRESS = "new";
/** Digits in a phone number, at least and at most (as the server checks). */
const PHONE_DIGITS = { min: 10, max: 15 };
/** The shortest address worth sending a runner to. */
const MIN_ADDRESS_LENGTH = 5;

export const PAYMENT_LABEL: Record<DeliveryPayment, string> = {
  cash_on_delivery: "Pay on delivery",
  prepaid: "Pay now",
};

export const SLOT_LABEL: Record<DeliverySlot, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};

export const STAGE_VIEW: Record<PortalDeliveryStage, { label: string; tone: BadgeTone }> = {
  requested: { label: "Requested", tone: "info" },
  awaiting_payment: { label: "Waiting for payment", tone: "warning" },
  being_prepared: { label: "Being prepared", tone: "info" },
  out_for_delivery: { label: "Out for delivery", tone: "warning" },
  delivered: { label: "Delivered", tone: "success" },
  failed: { label: "Not delivered", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  declined: { label: "Declined by your doctor", tone: "neutral" },
  not_deliverable: { label: "Collect at the pharmacy", tone: "warning" },
};

const digits = (phone: string) => phone.replace(/\D/g, "").length;

export const refillChoiceSchema = z
  .object({
    fulfilment: z.enum(["pickup", "delivery"]),
    addressKey: z.string(),
    newAddress: z.string(),
    landmark: z.string(),
    pincode: z.string(),
    phone: z.string(),
    slot: z.string(),
    payment: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.fulfilment === "pickup") return;
    if (v.addressKey === NEW_ADDRESS && v.newAddress.trim().length < MIN_ADDRESS_LENGTH) {
      ctx.addIssue({ code: "custom", path: ["newAddress"], message: "Enter the full address" });
    }
    const n = digits(v.phone);
    if (n < PHONE_DIGITS.min || n > PHONE_DIGITS.max) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter a 10-digit phone number" });
    }
    if (!v.payment) {
      ctx.addIssue({ code: "custom", path: ["payment"], message: "Choose how to pay" });
    }
  });
export type RefillChoiceValues = z.infer<typeof refillChoiceSchema>;

/** Where the form starts: pickup, their first saved address, the first way to pay. */
export function defaultChoice(offer?: PortalDeliveryOffer): RefillChoiceValues {
  return {
    fulfilment: "pickup",
    addressKey: offer?.addresses.length ? "0" : NEW_ADDRESS,
    newAddress: "",
    landmark: "",
    pincode: "",
    phone: offer?.contact_phone ?? "",
    slot: "",
    payment: offer?.payments[0] ?? "",
  };
}

/** The refill request's body: nothing extra for pickup, the delivery otherwise. */
export function refillBody(
  values: RefillChoiceValues,
  offer?: PortalDeliveryOffer,
): { delivery?: PortalDeliveryChoice } {
  if (values.fulfilment === "pickup" || !offer?.available) return {};
  const saved =
    values.addressKey === NEW_ADDRESS ? undefined : offer.addresses[Number(values.addressKey)];
  const pincode = values.pincode.trim() || saved?.pincode || undefined;
  return {
    delivery: {
      address: saved?.address ?? values.newAddress.trim(),
      ...(values.landmark.trim() ? { landmark: values.landmark.trim() } : {}),
      ...(pincode ? { pincode } : {}),
      contact_phone: values.phone.trim(),
      ...(values.slot ? { preferred_slot: values.slot as DeliverySlot } : {}),
      payment: values.payment as DeliveryPayment,
    },
  };
}

/** The steps a delivery has passed, with when, oldest first. */
export function deliverySteps(d: PortalDelivery): { label: string; at: string }[] {
  const steps: [string, string | null][] = [
    ["Requested", d.requested_at],
    ["Being prepared", d.prepared_at],
    ["Out for delivery", d.dispatched_at],
    ["Delivered", d.delivered_at],
  ];
  return steps.flatMap(([label, at]) => (at ? [{ label, at }] : []));
}
