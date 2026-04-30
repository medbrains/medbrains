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
});
