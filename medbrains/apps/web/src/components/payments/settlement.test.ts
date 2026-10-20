import type { PaymentGatewayTransaction } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { capturedSettlement, posTendersOf } from "./settlement";

const QR_PAID = {
  id: "txn-qr",
  amount: "205.00",
  payment_method: "upi",
  gateway_payment_id: "pay_77",
} as PaymentGatewayTransaction;

describe("a captured UPI QR at the pharmacy counter (#4885)", () => {
  it("names the captured payment, so the sale claims it", () => {
    expect(capturedSettlement(QR_PAID)).toEqual({
      source: "gateway",
      mode: "upi",
      amount: 205,
      reference_number: "pay_77",
      gateway_transaction_id: "txn-qr",
    });
  });

  it("reaches the sale's tenders with the link intact", () => {
    expect(posTendersOf(capturedSettlement(QR_PAID))).toEqual([
      { mode: "upi", amount: 205, reference: "pay_77", gateway_transaction_id: "txn-qr" },
    ]);
  });
});
