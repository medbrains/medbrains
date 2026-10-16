import { describe, expect, it } from "vitest";
import {
  describeShapeDrift,
  invoiceDetailResponseSchema,
  pharmacyOrderDetailResponseSchema,
} from "./responses.js";

const ID = "7f1c8a52-3b8e-4f6a-9d21-0c5e2b7a4d10";
const money = {
  subtotal: "100.00",
  tax_amount: "0",
  discount_amount: "0",
  total_amount: "100.00",
  paid_amount: "0",
  cgst_amount: "0",
  sgst_amount: "0",
  igst_amount: "0",
  cess_amount: "0",
};
const invoice = {
  id: ID,
  invoice_number: "INV-1",
  patient_id: ID,
  status: "issued",
  ...money,
  notes: null,
};

describe("response shapes", () => {
  it("accepts a conforming invoice, extra fields included", () => {
    expect(
      describeShapeDrift(invoiceDetailResponseSchema, { invoice, items: [], payments: [] }),
    ).toBeNull();
  });

  it("names a total that arrived as a float, without echoing the value", () => {
    const drift = describeShapeDrift(invoiceDetailResponseSchema, {
      invoice: { ...invoice, total_amount: 100.1 },
      items: [],
      payments: [],
    });
    expect(drift).toContain("invoice.total_amount");
    expect(drift).not.toContain("100.1");
  });

  it("refuses a dispensed quantity sent as a string", () => {
    const item = {
      id: ID,
      order_id: ID,
      drug_name: "Paracetamol 500",
      quantity: 10,
      unit_price: "1.20",
      total_price: "12.00",
      quantity_dispensed: "10",
      quantity_returned: 0,
      expiry_date: null,
    };
    const drift = describeShapeDrift(pharmacyOrderDetailResponseSchema, {
      order: { id: ID, patient_id: null, status: "dispensed", dispensing_type: "otc" },
      items: [item],
    });
    expect(drift).toContain("items.0.quantity_dispensed");
  });
});
