import type { PortalDelivery, PortalDeliveryOffer } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import {
  defaultChoice,
  deliverySteps,
  NEW_ADDRESS,
  PAYMENT_LABEL,
  refillBody,
  refillChoiceSchema,
  STAGE_VIEW,
} from "./portal-delivery";

const offer: PortalDeliveryOffer = {
  available: true,
  reason: null,
  payments: ["prepaid"],
  addresses: [{ label: "Home", address: "12 Lake Road, Karaikudi", pincode: "630001" }],
  contact_phone: "9000000001",
  delivery_fee: "30.00",
  slots: ["morning", "afternoon", "evening"],
};

describe("the patient's refill choice", () => {
  it("starts at pickup with their saved address, phone and the first way to pay", () => {
    const start = defaultChoice(offer);
    expect(start).toMatchObject({ fulfilment: "pickup", addressKey: "0", payment: "prepaid" });
    expect(start.phone).toBe("9000000001");
    expect(defaultChoice({ ...offer, addresses: [] }).addressKey).toBe(NEW_ADDRESS);
  });

  it("sends nothing extra for pickup", () => {
    expect(refillBody(defaultChoice(offer), offer)).toEqual({});
  });

  it("sends the saved address and its pincode for delivery", () => {
    const body = refillBody(
      { ...defaultChoice(offer), fulfilment: "delivery", slot: "evening" },
      offer,
    );
    expect(body.delivery).toEqual({
      address: "12 Lake Road, Karaikudi",
      pincode: "630001",
      contact_phone: "9000000001",
      preferred_slot: "evening",
      payment: "prepaid",
    });
  });

  it("sends a new address as typed", () => {
    const body = refillBody(
      {
        ...defaultChoice(offer),
        fulfilment: "delivery",
        addressKey: NEW_ADDRESS,
        newAddress: "  4 Temple Street ",
        landmark: "Near the tank",
      },
      offer,
    );
    expect(body.delivery?.address).toBe("4 Temple Street");
    expect(body.delivery?.landmark).toBe("Near the tank");
    expect(body.delivery?.pincode).toBeUndefined();
  });

  it("never sends a delivery the server did not offer", () => {
    const refused = { ...offer, available: false, reason: "Tramadol is a controlled medicine" };
    expect(refillBody({ ...defaultChoice(offer), fulfilment: "delivery" }, refused)).toEqual({});
  });

  it("asks for an address, a phone and a way to pay only for delivery", () => {
    const pickup = { ...defaultChoice(), phone: "" };
    expect(refillChoiceSchema.safeParse(pickup).success).toBe(true);
    const result = refillChoiceSchema.safeParse({ ...pickup, fulfilment: "delivery" });
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["newAddress", "phone", "payment"]));
  });
});

describe("how a delivery reads", () => {
  it("names every stage and every way to pay", () => {
    expect(STAGE_VIEW.out_for_delivery.label).toBe("Out for delivery");
    expect(STAGE_VIEW.not_deliverable.label).toMatch(/pharmacy/);
    expect(PAYMENT_LABEL.cash_on_delivery).toBe("Pay on delivery");
  });
});

describe("a delivery's steps", () => {
  it("lists only the steps it has reached", () => {
    const d = {
      requested_at: "2026-10-19T04:00:00Z",
      prepared_at: "2026-10-19T06:00:00Z",
      dispatched_at: null,
      delivered_at: null,
    } as PortalDelivery;
    expect(deliverySteps(d).map((s) => s.label)).toEqual(["Requested", "Being prepared"]);
  });
});
