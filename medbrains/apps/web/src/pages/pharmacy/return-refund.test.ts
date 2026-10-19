import { describe, expect, it } from "vitest";
import { lineRefundPaisa, splitRefund } from "./return-refund";

describe("counter refund arithmetic (mirrors return_rules.rs)", () => {
  it("refunds of a line add up to exactly what the line was paid", () => {
    // ₹100.00 for 3 strips: 33.33 + 33.34 + 33.33, never a paisa more or less.
    const one = lineRefundPaisa("100.00", 3, 0, 1);
    const two = lineRefundPaisa("100.00", 3, 1, 1);
    const three = lineRefundPaisa("100.00", 3, 2, 1);
    expect([one, two, three]).toEqual([3333, 3334, 3333]);
    expect(one + two + three).toBe(10000);
    expect(lineRefundPaisa("100.00", 3, 0, 3)).toBe(10000);
  });

  it("rounds a half paisa to even, as rust_decimal does", () => {
    // 0.05 × 1 / 2 = 0.025 → 0.02 (even), not 0.03.
    expect(lineRefundPaisa("0.05", 2, 0, 1)).toBe(2);
    // 0.07 × 1 / 2 = 0.035 → 0.04 (even).
    expect(lineRefundPaisa("0.07", 2, 0, 1)).toBe(4);
  });

  it("splits back to the tenders in proportion, the odd paisa to the largest", () => {
    const split = splitRefund(10001, [
      { mode: "cash", paid: "200.00", refunded: "0" },
      { mode: "upi", paid: "100.00", refunded: "0" },
    ]);
    expect(split).toEqual([
      { mode: "cash", paisa: 6667 },
      { mode: "upi", paisa: 3334 },
    ]);
    expect(split.reduce((a, p) => a + p.paisa, 0)).toBe(10001);
  });

  it("skips a tender already fully refunded and refuses more than is left", () => {
    const tenders = [
      { mode: "cash", paid: "50.00", refunded: "50.00" },
      { mode: "card", paid: "50.00", refunded: "0" },
    ];
    expect(splitRefund(2000, tenders)).toEqual([{ mode: "card", paisa: 2000 }]);
    expect(splitRefund(6000, tenders)).toEqual([]);
  });
});
