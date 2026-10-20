import { describe, expect, it } from "vitest";
import { gatewayRefundSchema, isOnlinePayment } from "./gateway-refund-modal";

describe("gateway refund", () => {
  it("refunds at most what is left, in whole paise, with a reason", () => {
    const schema = gatewayRefundSchema(500);
    expect(schema.safeParse({ amount: 200, reason: "Duplicate charge" }).success).toBe(true);
    expect(schema.safeParse({ amount: 500.01, reason: "Duplicate charge" }).success).toBe(false);
    expect(schema.safeParse({ amount: 0, reason: "Duplicate charge" }).success).toBe(false);
    expect(schema.safeParse({ amount: 10.005, reason: "Duplicate charge" }).success).toBe(false);
    expect(schema.safeParse({ amount: 100, reason: "  " }).success).toBe(false);
  });

  it("offers a refund only on payments an online gateway posted", () => {
    expect(isOnlinePayment("Online payment (razorpay)")).toBe(true);
    expect(isOnlinePayment("Paid at counter")).toBe(false);
    expect(isOnlinePayment(null)).toBe(false);
  });
});
