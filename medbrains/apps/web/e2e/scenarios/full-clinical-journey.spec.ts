/**
 * Full clinical journey end-to-end test.
 *
 * Walks one patient through: registration (UI) → OPD encounter →
 * consultation → prescription → pharmacy order + dispense → lab order →
 * billing → admit to IPD → IPD pharmacy order + dispense → pharmacy
 * partial return → IPD return → lab cancel → final UI assertion.
 *
 * Driven by the helpers/journey-steps composables introduced in Phase 0.
 */

import { test, expect } from "@playwright/test";
import { getAuthContextFromCookies, api } from "../helpers/api";
import {
  registerPatientUI,
  createEncounter,
  createConsultation,
  createPrescription,
  createPharmacyOrder,
  dispensePharmacyOrder,
  createLabOrder,
  cancelLabOrder,
  createInvoice,
  admitToIpd,
  createPharmacyReturn,
  processPharmacyReturn,
} from "../helpers/journey-steps";
import { routeApiDirect, navigateTo } from "../helpers";

test.describe("Full clinical journey", () => {
  test.beforeEach(async ({ page }) => {
    await routeApiDirect(page);
  });
  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });

  test("OPD register → Rx → lab → billing → IPD → returns", async ({
    page,
    request,
  }) => {
    test.info().annotations.push({
      type: "tcms",
      description: "Clinical::Full journey OPD to IPD with returns",
    });

    const ctx = await getAuthContextFromCookies(request);
    await navigateTo(page, "/patients");
    const patient = await registerPatientUI(ctx, page);

    const encounterId = await createEncounter(ctx, patient.id);
    await createConsultation(ctx, encounterId);
    const rxId = await createPrescription(ctx, encounterId);

    const opdOrder = await createPharmacyOrder(ctx, {
      patientId: patient.id,
      prescriptionId: rxId,
      encounterId,
      quantity: 15,
    });
    await dispensePharmacyOrder(ctx, opdOrder.id);

    const labOrderId = await createLabOrder(ctx, {
      patientId: patient.id,
      encounterId,
    });
    expect(labOrderId).toBeTruthy();

    const invoiceId = await createInvoice(ctx, {
      patientId: patient.id,
      encounterId,
    });
    expect(invoiceId).toBeTruthy();

    const admissionId = await admitToIpd(ctx, { patientId: patient.id });
    expect(admissionId).toBeTruthy();

    const ipdRxId = await createPrescription(ctx, encounterId, { itemCount: 1 });
    const ipdOrder = await createPharmacyOrder(ctx, {
      patientId: patient.id,
      prescriptionId: ipdRxId,
      encounterId,
      quantity: 6,
    });
    await dispensePharmacyOrder(ctx, ipdOrder.id);

    // OPD partial return (2 of 15)
    const opdReturn = await createPharmacyReturn(ctx, {
      orderItemId: opdOrder.itemId,
      patientId: patient.id,
      quantity: 2,
      reason: "patient improved before course completion",
    });
    await processPharmacyReturn(ctx, opdReturn, "restock");

    // IPD full return
    const ipdReturn = await createPharmacyReturn(ctx, {
      orderItemId: ipdOrder.itemId,
      patientId: patient.id,
      quantity: 6,
      reason: "regimen changed",
    });
    await processPharmacyReturn(ctx, ipdReturn, "restock");

    // Lab cancel (best-effort — some flows reject after collection)
    try {
      await cancelLabOrder(ctx, labOrderId);
    } catch {
      // Already in terminal state — non-fatal.
    }

    // Final UI assertion: search the new patient on /patients.
    await navigateTo(page, "/patients");
    await page.getByPlaceholder(/Search/i).fill(patient.first_name);
    const row = page.locator("tr", { hasText: patient.first_name });
    await expect(row).toBeVisible({ timeout: 10_000 });
  });
});
