// @vitest-environment node

import {
  BILLING_INVOICE_STATUS_VALUES,
  billingInvoiceBalance,
  billingInvoiceBalanceSignal,
  billingInvoiceDisplayStatus,
  billingInvoiceIsPayable,
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
});
