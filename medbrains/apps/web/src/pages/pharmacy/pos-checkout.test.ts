import { describe, expect, it } from "vitest";
import {
  offMrpPercent,
  type PosCheckoutState,
  posCheckoutBlocker,
  posTotals,
  toPayable,
} from "./pos-checkout";

const paracetamol = {
  drugName: "Paracetamol 500",
  quantity: 2,
  unitPrice: 5,
  schedule: "OTC",
  isControlled: false,
  stock: 20,
};

function state(overrides: Partial<PosCheckoutState> = {}): PosCheckoutState {
  return {
    canEditAmounts: true,
    lines: [paracetamol],
    allergyBlocked: false,
    safetyBlocked: false,
    ...overrides,
  };
}

describe("posCheckoutBlocker", () => {
  it("lets a priced, stocked OTC basket go to payment with nothing typed in a tender field", () => {
    // The old counter blocked here: "Received" defaulted to 0 < total.
    expect(posCheckoutBlocker(state())).toBeNull();
  });

  it("asks for a medicine on an empty basket", () => {
    expect(posCheckoutBlocker(state({ lines: [] }))).toMatch(/Add a medicine/);
  });

  it("names the role limit when amounts are not editable", () => {
    expect(posCheckoutBlocker(state({ canEditAmounts: false }))).toMatch(
      /cannot edit sale amounts/,
    );
  });

  it("refuses Schedule H over the counter, as the server does", () => {
    const telmisartan = { ...paracetamol, drugName: "Telmisartan 40", schedule: "H" };
    expect(posCheckoutBlocker(state({ lines: [telmisartan] }))).toMatch(
      /Telmisartan 40 is Schedule H .* Rx queue/,
    );
  });

  it("refuses a controlled drug with no schedule set", () => {
    const morphine = { ...paracetamol, drugName: "Morphine", schedule: null, isControlled: true };
    expect(posCheckoutBlocker(state({ lines: [morphine] }))).toMatch(/controlled drug/);
  });

  it("says how much is in stock when the quantity exceeds it", () => {
    const line = { ...paracetamol, quantity: 21 };
    expect(posCheckoutBlocker(state({ lines: [line] }))).toMatch(/Only 20 of Paracetamol 500/);
  });

  it("allows exactly the stock on hand", () => {
    expect(posCheckoutBlocker(state({ lines: [{ ...paracetamol, quantity: 20 }] }))).toBeNull();
  });

  it("asks for a quantity of at least one", () => {
    expect(posCheckoutBlocker(state({ lines: [{ ...paracetamol, quantity: 0 }] }))).toMatch(
      /at least 1/,
    );
  });

  it("asks for a price when the catalogue has none", () => {
    expect(posCheckoutBlocker(state({ lines: [{ ...paracetamol, unitPrice: 0 }] }))).toMatch(
      /no selling price/,
    );
  });

  it("holds the sale for an allergy reason, then a safety stop", () => {
    expect(posCheckoutBlocker(state({ allergyBlocked: true }))).toMatch(/allergy override/);
    expect(posCheckoutBlocker(state({ safetyBlocked: true }))).toMatch(/safety stop/);
  });
});

describe("toPayable", () => {
  it("rounds a fractional-paisa total up so the server never sees a short payment", () => {
    // 1 × ₹3.33 + 5% GST = 3.4965 exactly on the server.
    expect(toPayable(3.33 * 1.05)).toBe(3.5);
    expect(toPayable(10.5)).toBe(10.5);
    expect(toPayable(3 * 3.3)).toBe(9.9);
  });
});

describe("posTotals", () => {
  it("charges the price on the strip — GST is inside MRP, not added on top", () => {
    const totals = posTotals([{ quantity: 3, unitPrice: 12, gstRate: 5 }], 0);
    expect(totals.total).toBe(36);
    expect(totals.gst).toBeCloseTo(1.714, 3);
  });

  it("uses each drug's own GST rate, never a flat 5%", () => {
    const totals = posTotals(
      [
        { quantity: 1, unitPrice: 112, gstRate: 12 },
        { quantity: 1, unitPrice: 100, gstRate: 0 },
      ],
      0,
    );
    expect(totals.gst).toBeCloseTo(12);
    expect(totals.total).toBe(212);
  });

  it("works GST out on the value after discount", () => {
    const totals = posTotals([{ quantity: 1, unitPrice: 112, gstRate: 12 }], 10);
    expect(totals.discount).toBeCloseTo(11.2);
    expect(totals.total).toBe(100.8);
    expect(totals.gst).toBeCloseTo(10.8);
  });
});

describe("discount approval and MRP", () => {
  const discount = { offMrpPercent: 15, limitPercent: 10, canApprove: true, reason: "" };

  it("refuses a price above MRP", () => {
    expect(posCheckoutBlocker(state({ lines: [{ ...paracetamol, mrp: 4 }] }))).toMatch(
      /above its MRP/,
    );
  });

  it("lets a discount within the limit through", () => {
    expect(posCheckoutBlocker(state({ discount: { ...discount, offMrpPercent: 10 } }))).toBeNull();
  });

  it("needs an approver over the limit, then a reason", () => {
    expect(posCheckoutBlocker(state({ discount: { ...discount, canApprove: false } }))).toMatch(
      /supervisor with discount approval/,
    );
    expect(posCheckoutBlocker(state({ discount }))).toMatch(/give the reason/);
    expect(
      posCheckoutBlocker(state({ discount: { ...discount, reason: "Staff family" } })),
    ).toBeNull();
  });

  it("holds any discount when the limit is unknown, never assumes one", () => {
    expect(posCheckoutBlocker(state({ discount: { ...discount, limitPercent: null } }))).toMatch(
      /could not be checked/,
    );
  });

  it("measures the discount off MRP", () => {
    expect(offMrpPercent(100, 85)).toBe(15);
    expect(offMrpPercent(0, 10)).toBe(0);
  });
});
