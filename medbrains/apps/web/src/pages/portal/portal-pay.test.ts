import type { PortalInvoice } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { canPayOnline } from "./portal-pay";

const bill = (status: string, balance: string): PortalInvoice => ({
  id: "i1",
  invoice_number: "INV-1",
  status,
  total_amount: "1000.00",
  paid_amount: "0.00",
  balance_due: balance,
  created_at: "2026-10-20T00:00:00Z",
});

describe("which portal bills offer Pay now", () => {
  it("an issued or part-paid bill with a balance; never a draft, a paid or a cancelled one", () => {
    expect(canPayOnline(bill("issued", "1000.00"))).toBe(true);
    expect(canPayOnline(bill("partially_paid", "400.00"))).toBe(true);
    expect(canPayOnline(bill("draft", "1000.00"))).toBe(false);
    expect(canPayOnline(bill("paid", "0.00"))).toBe(false);
    expect(canPayOnline(bill("cancelled", "1000.00"))).toBe(false);
  });
});
