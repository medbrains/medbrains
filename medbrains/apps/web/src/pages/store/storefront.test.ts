import type { StoreCart, StoreItem, StoreOrderLine } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import {
  canAdd,
  checkoutBody,
  clampQuantity,
  decisionProblem,
  defaultDecisions,
  isChoose,
  pickupOnly,
  usablePrescriptions,
} from "./storefront";

const item = (over: Partial<StoreItem> = {}): StoreItem => ({
  id: "i1",
  name: "Paracetamol 500",
  inn: "paracetamol",
  manufacturer: null,
  category: null,
  pack: null,
  schedule: null,
  sale_class: "otc",
  prescription_needed: false,
  note: null,
  pickup_only: false,
  stock: "available",
  mrp: "12.00",
  price: "10.00",
  max_quantity: 10,
  on_sale: true,
  ...over,
});

const cart = (items: StoreItem[]): StoreCart => ({
  lines: items.map((i) => ({
    item: i,
    quantity: 1,
    from_prescription: false,
    line_total: i.price,
  })),
  total: "10.00",
  prescription_needed: items.some((i) => i.prescription_needed),
  prescription_uploaded: false,
  max_lines: 20,
});

describe("what goes in a cart", () => {
  it("never a counter-only, unpriced or out-of-stock item", () => {
    expect(canAdd(item())).toBe(true);
    expect(canAdd(item({ sale_class: "counter_only" }))).toBe(false);
    expect(canAdd(item({ price: null }))).toBe(false);
    expect(canAdd(item({ stock: "out" }))).toBe(false);
  });

  it("holds a quantity inside the item's limit", () => {
    expect(clampQuantity(50, item())).toBe(10);
    expect(clampQuantity(0, item())).toBe(1);
    // One unit of an H1 or habit-forming drug.
    expect(clampQuantity(3, item({ max_quantity: 1 }))).toBe(1);
  });
});

describe("checkout", () => {
  it("needs no prescription for over-the-counter medicines", () => {
    const placed = checkoutBody(cart([item()]), { hospitalId: null, uploaded: false });
    expect(placed).toEqual({ body: { prescription_source: "none" } });
  });

  it("refuses a prescription line until one is chosen or uploaded", () => {
    const rx = cart([item({ prescription_needed: true, sale_class: "prescription" })]);
    expect(checkoutBody(rx, { hospitalId: null, uploaded: false })).toHaveProperty("problem");
    expect(checkoutBody(rx, { hospitalId: null, uploaded: true })).toEqual({
      body: { prescription_source: "upload" },
    });
    // The hospital's own prescription wins over an upload.
    expect(checkoutBody(rx, { hospitalId: "rx1", uploaded: true })).toEqual({
      body: { prescription_source: "hospital", prescription_id: "rx1" },
    });
  });

  it("refuses an empty cart and anything taken off sale", () => {
    expect(checkoutBody(cart([]), { hospitalId: null, uploaded: false })).toHaveProperty("problem");
    expect(
      checkoutBody(cart([item({ on_sale: false })]), { hospitalId: null, uploaded: false }),
    ).toHaveProperty("problem");
  });

  it("names what must be collected", () => {
    expect(pickupOnly(cart([item(), item({ name: "Insulin", pickup_only: true })]))).toEqual([
      "Insulin",
    ]);
  });

  it("offers only prescriptions that haven't expired", () => {
    const base = {
      prescribed_at: "2026-09-01",
      doctor_name: null,
      drugs: [],
      refills_left: 0,
      goes_to: null,
      message: "",
      latest_request: null,
    };
    const rows = [
      { ...base, prescription_id: "a", valid_until: "2026-10-01" },
      { ...base, prescription_id: "b", valid_until: "2026-12-01" },
      { ...base, prescription_id: "c", valid_until: null },
    ];
    expect(usablePrescriptions(rows, "2026-10-19").map((r) => r.prescription_id)).toEqual([
      "b",
      "c",
    ]);
  });
});

describe("signing in on a shared mobile", () => {
  it("asks who is ordering rather than picking", () => {
    expect(isChoose({ choose: [{ id: "p", name: "Arun S", birth_year: 2001 }] })).toBe(true);
    expect(isChoose({ token: "t", patient_id: "p", tenant_id: "t", expires_in_hours: 12 })).toBe(
      false,
    );
  });
});

describe("the pharmacist's review", () => {
  const lines: StoreOrderLine[] = [
    {
      catalog_item_id: "rx",
      drug_name: "Azithromycin",
      quantity: 3,
      unit_price: "10.00",
      status: "pending",
      approved_quantity: null,
      reject_reason: null,
    },
    {
      catalog_item_id: "otc",
      drug_name: "Paracetamol",
      quantity: 1,
      unit_price: "10.00",
      status: "approved",
      approved_quantity: null,
      reject_reason: null,
    },
  ];

  it("decides only the waiting lines, each in full to start", () => {
    expect(defaultDecisions(lines)).toEqual([
      { catalog_item_id: "rx", approve: true, quantity: 3 },
    ]);
  });

  it("needs a reason to refuse and a quantity within what was asked", () => {
    expect(decisionProblem([{ catalog_item_id: "rx", approve: false }], lines)).toMatch(/why/);
    expect(
      decisionProblem([{ catalog_item_id: "rx", approve: false, reason: "illegible" }], lines),
    ).toBeNull();
    expect(decisionProblem([{ catalog_item_id: "rx", approve: true, quantity: 4 }], lines)).toMatch(
      /between 1 and 3/,
    );
  });
});
