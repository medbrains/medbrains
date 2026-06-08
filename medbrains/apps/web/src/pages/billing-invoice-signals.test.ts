// @vitest-environment node

import {
  activeBillingInvoiceIdForJourney,
  BILLING_INVOICE_STATUS_VALUES,
  billingInvoiceBalance,
  billingInvoiceBalanceSignal,
  billingInvoiceBalanceSignalLabel,
  billingInvoiceBalanceSignalLabelKey,
  billingInvoiceDisplayStatus,
  billingInvoiceHasReceivedPayment,
  billingInvoiceIsFinalized,
  billingInvoiceIsPayable,
  billingInvoiceRequiresFollowUp,
  billingInvoiceStatusLabel,
  billingInvoiceStatusLabelKey,
  billingInvoiceStatusSignal,
} from "@medbrains/types";
import { describe, expect, it } from "vitest";

describe("billing invoice operational signals", () => {
  it("keeps invoice statuses complete for cashier and discharge handoffs", () => {
    expect(BILLING_INVOICE_STATUS_VALUES).toEqual([
      "draft",
      "issued",
      "partially_paid",
      "paid",
      "cancelled",
      "refunded",
    ]);
  });

  it("derives patient-facing billing states from amount collection", () => {
    expect(billingInvoiceBalance("1000", "250")).toBe(750);
    expect(billingInvoiceDisplayStatus("issued", "1000", "250")).toBe("partially_paid");
    expect(billingInvoiceDisplayStatus("issued", "1000", "1000")).toBe("paid");
    expect(billingInvoiceDisplayStatus("refunded", "1000", "1000")).toBe("refunded");
    expect(billingInvoiceIsPayable("issued", "1000", "0")).toBe(true);
    expect(billingInvoiceIsPayable("paid", "1000", "1000")).toBe(false);
    expect(billingInvoiceIsFinalized("issued", "1000", "0")).toBe(true);
    expect(billingInvoiceIsFinalized("draft", "1000", "0")).toBe(false);
    expect(billingInvoiceHasReceivedPayment("issued", "1000", "250")).toBe(true);
    expect(billingInvoiceRequiresFollowUp("draft", "0", "0")).toBe(true);
    expect(billingInvoiceRequiresFollowUp("paid", "1000", "1000")).toBe(false);
  });

  it("selects the best active invoice for patient journey handoffs", () => {
    expect(
      activeBillingInvoiceIdForJourney([
        { id: "paid", paid_amount: "1000", status: "paid", total_amount: "1000" },
        { id: "draft", paid_amount: "0", status: "draft", total_amount: "500" },
        { id: "due", paid_amount: "100", status: "issued", total_amount: "500" },
      ]),
    ).toBe("due");
    expect(
      activeBillingInvoiceIdForJourney([
        { id: "refunded", paid_amount: "1000", status: "refunded", total_amount: "1000" },
        { id: "draft", paid_amount: "0", status: "draft", total_amount: "0" },
      ]),
    ).toBe("draft");
  });

  it("maps invoice status to scannable billing workflow shapes", () => {
    expect(billingInvoiceStatusSignal("draft")).toEqual({
      phase: "draft",
      shape: "token",
      tone: "blocked",
    });
    expect(billingInvoiceStatusSignal("issued")).toEqual({
      phase: "payable",
      shape: "token",
      tone: "active",
    });
    expect(billingInvoiceStatusSignal("partially_paid")).toEqual({
      phase: "partially_paid",
      shape: "diamond",
      tone: "blocked",
    });
    expect(billingInvoiceStatusSignal("paid")).toEqual({
      phase: "settled",
      shape: "pill",
      tone: "ready",
    });
    expect(billingInvoiceStatusSignal("cancelled")).toEqual({
      phase: "cancelled",
      shape: "diamond",
      tone: "risk",
    });
  });

  it("uses a separate balance signal for amount visibility and dues", () => {
    expect(billingInvoiceBalanceSignal(500, true)).toEqual({
      phase: "payable",
      shape: "diamond",
      tone: "risk",
    });
    expect(billingInvoiceBalanceSignal(0, true)).toEqual({
      phase: "settled",
      shape: "pill",
      tone: "ready",
    });
    expect(billingInvoiceBalanceSignal(500, false)).toEqual({
      phase: "restricted",
      shape: "diamond",
      tone: "blocked",
    });
  });

  it("keeps invoice status and balance signal labels on the shared billing contract", () => {
    expect(billingInvoiceStatusLabelKey("partially_paid")).toBe("invoiceStatus.partially_paid");
    expect(billingInvoiceStatusLabel("partially_paid")).toBe("Partially paid");
    expect(billingInvoiceStatusLabel("custom_status")).toBe("custom status");
    expect(billingInvoiceStatusLabelKey("custom_status")).toBeNull();

    const dueSignal = billingInvoiceBalanceSignal(500, true);
    const settledSignal = billingInvoiceBalanceSignal(0, true);
    const restrictedSignal = billingInvoiceBalanceSignal(500, false);

    expect(billingInvoiceBalanceSignalLabelKey(dueSignal)).toBe("billingSignals.balanceDue");
    expect(billingInvoiceBalanceSignalLabel(dueSignal)).toBe("Balance due");
    expect(billingInvoiceBalanceSignalLabelKey(settledSignal)).toBe("billingSignals.settled");
    expect(billingInvoiceBalanceSignalLabel(settledSignal)).toBe("Settled");
    expect(billingInvoiceBalanceSignalLabelKey(restrictedSignal)).toBe(
      "billingSignals.amountRestricted",
    );
    expect(billingInvoiceBalanceSignalLabel(restrictedSignal)).toBe("Amount restricted");
  });
});
