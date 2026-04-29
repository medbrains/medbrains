import { test, expect } from "@playwright/test";
import { loginAsAdmin, api } from "../helpers/api";
import {
  createPatientApi,
  createEncounter,
  createPrescription,
  createPharmacyOrder,
  dispensePharmacyOrder,
  createPharmacyReturn,
  processPharmacyReturn,
} from "../helpers/journey-steps";

test.describe("Pharmacy dispense journey", () => {
  test("Rx → order → dispense → partial return + restock", async ({ request }) => {
    test.info().annotations.push({
      type: "tcms",
      description: "Pharmacy::Order + dispense + partial return",
    });

    const ctx = await loginAsAdmin(request);
    const patient = await createPatientApi(ctx);
    const encounterId = await createEncounter(ctx, patient.id);
    const rxId = await createPrescription(ctx, encounterId);

    const { id: orderId, itemId } = await createPharmacyOrder(ctx, {
      patientId: patient.id,
      prescriptionId: rxId,
      encounterId,
      quantity: 10,
    });
    await dispensePharmacyOrder(ctx, orderId);

    const detail = await api<{ order: { status: string } }>(
      ctx,
      "GET",
      `/api/pharmacy/orders/${orderId}`,
    );
    expect(detail.order.status).toMatch(/dispensed/i);

    const ret = await createPharmacyReturn(ctx, {
      orderItemId: itemId,
      patientId: patient.id,
      quantity: 3,
      reason: "spec partial return",
    });
    await processPharmacyReturn(ctx, ret, "restock");

    // Verify the return appears in the patient's return ledger.
    const returnsList = await api<Array<{ id: string }>>(
      ctx,
      "GET",
      "/api/pharmacy/returns",
    );
    expect(returnsList.some((r) => r.id === ret)).toBe(true);
  });
});
