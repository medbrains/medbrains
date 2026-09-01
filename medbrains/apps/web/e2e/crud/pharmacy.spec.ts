import { test, expect } from "@playwright/test";
import { getAuthContextFromCookies, api } from "../helpers/api";
import {
  createPatientApi,
  createEncounter,
  createPrescription,
  createPharmacyOrder,
  dispensePharmacyOrder,
  createPharmacyReturn,
  processPharmacyReturn,
} from "../helpers/journey-steps";
import { getFirstDrug } from "../helpers/seed-resolvers";

interface PharmacyPosSaleResponse {
  id: string;
  patient_id: string | null;
  billing_invoice_id?: string | null;
  total_amount: string | number;
  payment_mode: string;
}

interface BillingInvoiceDetailResponse {
  invoice: {
    id: string;
    status: string;
    patient_id: string;
    paid_amount: string | number;
    total_amount: string | number;
  };
  items: Array<{
    source: string;
    source_id: string | null;
    source_module?: string | null;
    pharmacy_order_id?: string | null;
  }>;
  payments: Array<{
    amount: string | number;
    mode: string;
  }>;
}

test.describe("Pharmacy CRUD", () => {
  test("order → dispense → partial return → restock", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);
    const patient = await createPatientApi(ctx);
    const encounterId = await createEncounter(ctx, patient.id);
    const rxId = await createPrescription(ctx, encounterId);

    const { id: orderId, itemId } = await createPharmacyOrder(ctx, {
      patientId: patient.id,
      prescriptionId: rxId,
      encounterId,
      quantity: 12,
    });
    await dispensePharmacyOrder(ctx, orderId);

    const detail = await api<{ order: { status: string } }>(
      ctx,
      "GET",
      `/api/pharmacy/orders/${orderId}`,
    );
    expect(detail.order.status).toMatch(/dispensed|partially_dispensed/);

    const returnId = await createPharmacyReturn(ctx, {
      orderItemId: itemId,
      patientId: patient.id,
      quantity: 3,
      reason: "spec partial return",
    });
    await processPharmacyReturn(ctx, returnId, "restock");
  });

  test("returned medicine cannot go straight back on the shelf", async ({ request }) => {
    // requested → returned_to_stock is refused; it must be approved first, by
    // someone who has checked the medicine is intact, in date and was stored
    // properly. Skipping that would put unchecked stock back into circulation.
    const ctx = await getAuthContextFromCookies(request);
    const patient = await createPatientApi(ctx);
    const encounterId = await createEncounter(ctx, patient.id);
    const rxId = await createPrescription(ctx, encounterId);

    const { id: orderId, itemId } = await createPharmacyOrder(ctx, {
      patientId: patient.id,
      prescriptionId: rxId,
      encounterId,
      quantity: 6,
    });
    await dispensePharmacyOrder(ctx, orderId);

    const returnId = await createPharmacyReturn(ctx, {
      orderItemId: itemId,
      patientId: patient.id,
      quantity: 2,
      reason: "spec — unapproved restock attempt",
    });

    await expect(
      processPharmacyReturn(ctx, returnId, "restock", { skipApproval: true }),
      "restocking an unapproved return must be refused",
    ).rejects.toThrow(/409/);

    // Approved, it proceeds.
    await processPharmacyReturn(ctx, returnId, "restock");
  });

  test("dispensing against an unpaid bill is refused without a reason", async ({
    request,
  }) => {
    // The override exists so a pharmacist can dispense before payment clears
    // and have that decision recorded — the reason is logged with the patient,
    // the dispenser and the outstanding amount. Silently allowing it would let
    // stock leave the counter with nothing tying it to a person who chose.
    const ctx = await getAuthContextFromCookies(request);
    const patient = await createPatientApi(ctx);
    const encounterId = await createEncounter(ctx, patient.id);
    const rxId = await createPrescription(ctx, encounterId);

    const { id: orderId } = await createPharmacyOrder(ctx, {
      patientId: patient.id,
      prescriptionId: rxId,
      encounterId,
      quantity: 4,
    });

    // `null` omits the reason deliberately.
    await expect(
      dispensePharmacyOrder(ctx, orderId, { unpaidOverrideReason: null }),
      "an unpaid dispense with no reason must be refused, not quietly allowed",
    ).rejects.toThrow(/400/);

    // And with one, it proceeds — the control is an override, not a wall.
    const dispensed = await dispensePharmacyOrder(ctx, orderId, {
      unpaidOverrideReason: "patient returning with payment after the clinic closes",
    });
    expect(dispensed.status).toMatch(/dispensed|partially_dispensed/);
  });

  test("catalog + stock + returns lists", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);
    const catalog = await api<unknown[]>(ctx, "GET", "/api/pharmacy/catalog");
    expect(Array.isArray(catalog)).toBe(true);
    expect(catalog.length).toBeGreaterThan(0);

    const stock = await api<unknown[]>(ctx, "GET", "/api/pharmacy/stock");
    expect(Array.isArray(stock)).toBe(true);

    const returns = await api<unknown[]>(ctx, "GET", "/api/pharmacy/returns");
    expect(Array.isArray(returns)).toBe(true);
  });

  test("404 on unknown order", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);
    const fake = "00000000-0000-0000-0000-000000000000";
    await expect(
      api(ctx, "GET", `/api/pharmacy/orders/${fake}`),
    ).rejects.toThrow(/404/);
  });

  test("registered POS sale posts a paid Billing invoice", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);
    const patient = await createPatientApi(ctx);
    const drug = await getFirstDrug(ctx);
    const unitPrice = Number(drug.base_price ?? 5) || 5;
    const quantity = 2;
    const total = unitPrice * quantity;

    const sale = await api<PharmacyPosSaleResponse>(
      ctx,
      "POST",
      "/api/pharmacy/pos/sales",
      {
        patient_id: patient.id,
        patient_name: `${patient.first_name} ${patient.last_name}`.trim(),
        patient_phone: "9800000000",
        payment_mode: "cash",
        amount_received: total,
        discount_percent: 0,
        discount_amount: 0,
        items: [
          {
            catalog_item_id: drug.id,
            drug_name: drug.name,
            quantity,
            mrp: unitPrice,
            selling_price: unitPrice,
            gst_rate: 0,
          },
        ],
      },
    );

    expect(sale.patient_id).toBe(patient.id);
    expect(sale.billing_invoice_id, "patient POS sale should mirror to Billing").toBeTruthy();

    const invoice = await api<BillingInvoiceDetailResponse>(
      ctx,
      "GET",
      `/api/billing/invoices/${sale.billing_invoice_id}`,
    );

    expect(invoice.invoice.patient_id).toBe(patient.id);
    expect(invoice.invoice.status).toBe("paid");
    expect(Number(invoice.invoice.paid_amount)).toBeCloseTo(Number(invoice.invoice.total_amount), 2);
    expect(invoice.payments.some((payment) => payment.mode === "cash")).toBe(true);
    expect(invoice.items.some((item) => item.source === "pharmacy" && item.source_id)).toBe(true);
  });
});
