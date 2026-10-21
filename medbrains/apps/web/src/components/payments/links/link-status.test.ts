import type { PaymentLinkView } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { isLive, linkBadge, linkEnding, linkProgress } from "./link-status";

const base: PaymentLinkView = {
  id: "l1",
  patient_id: "p1",
  invoice_ids: ["i1"],
  scope: "all",
  lane: null,
  amount: "1000.00",
  amount_paid: "0.00",
  accept_partial: true,
  min_part_amount: "100.00",
  status: "created",
  provider: "razorpay",
  short_url: "https://rzp.io/l/x",
  expires_at: "2026-10-27T00:00:00Z",
  channel: "sms",
  sent_count: 1,
  last_sent_at: null,
  replaces_id: null,
  end_reason: null,
  error: null,
  created_at: "2026-10-20T00:00:00Z",
};

describe("a payment link's state, in words", () => {
  it("reads sent, then part paid ₹X of ₹Y, then paid", () => {
    expect(linkBadge(base).label).toBe("Sent");
    expect(linkProgress(base)).toBe("Asks for ₹1,000.00");
    const part = { ...base, status: "partially_paid" as const, amount_paid: "300.00" };
    expect(linkBadge(part)).toEqual({ label: "Part paid", tone: "warning" });
    expect(linkProgress(part)).toBe("₹300.00 of ₹1,000.00 paid");
    expect(linkBadge({ ...base, status: "paid", amount_paid: "1000.00" }).label).toBe("Paid");
  });

  it("only a made or part-paid link is live; a closed one says why it closed", () => {
    expect(isLive(base)).toBe(true);
    expect(isLive({ ...base, status: "expired" })).toBe(false);
    const settled = { ...base, status: "cancelled" as const, end_reason: "settled" };
    expect(isLive(settled)).toBe(false);
    expect(linkEnding(settled)).toMatch(/paid at the counter/);
    expect(linkBadge({ ...base, status: "cancelled", end_reason: "replaced" }).label).toBe(
      "Replaced",
    );
    expect(linkEnding({ ...base, status: "failed", error: "keys refused" })).toBe("keys refused");
    expect(linkBadge({ ...base, sent_count: 0 }).label).toBe("Ready");
  });
});
