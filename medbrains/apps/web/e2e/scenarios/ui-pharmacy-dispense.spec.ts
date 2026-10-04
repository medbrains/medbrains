/**
 * UI tests — SOP ref: docs/sops/04-pharmacy-dispensing.md
 * Scenario S1: Doctor writes prescription — prescription appears in Rx Queue
 * Scenario S2: Pharmacist views Rx Queue tab
 * Scenario S3: NDPS register tab visible to pharmacist
 */

import { test, expect } from "@playwright/test";
import { loginAsRole, navigateTo, routeApiDirect } from "../helpers";
import { getE2EIdentity } from "../helpers/e2e-identities";
import { getAuthContextFromCookies, loginAsRoleApi } from "../helpers/api";
import {
  createPatientApi,
  createEncounter,
  createPrescription,
  createPharmacyOrder,
} from "../helpers/journey-steps";
import { getFirstDrug, getOpdDept } from "../helpers/seed-resolvers";

test.describe("Pharmacy Dispensing — UI", () => {
  test.beforeEach(async ({ page }) => {
    await routeApiDirect(page);
  });

  test("pharmacist sees Pharmacy page with Rx Queue tab", async ({ page }) => {
    const identity = getE2EIdentity("pharmacist");
    await loginAsRole(page, identity.username, identity.password);
    await navigateTo(page, "/pharmacy");

    await expect(
      page.getByRole("heading", { name: /Pharmacy/i }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole("tab", { name: /Rx Queue/i }),
    ).toBeVisible();
  });

  test("NDPS register tab is accessible to pharmacist", async ({ page }) => {
    const identity = getE2EIdentity("pharmacist");
    await loginAsRole(page, identity.username, identity.password);
    await navigateTo(page, "/pharmacy");

    await expect(
      page.getByRole("tab", { name: /NDPS/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("prescription created by doctor appears in Rx Queue", async ({
    page,
    request,
  }) => {
    const pharmacistIdentity = getE2EIdentity("pharmacist");
    const doctorCtx = await loginAsRoleApi(request, "doctor");

    const patient = await createPatientApi(doctorCtx);
    const opdDept = await getOpdDept(doctorCtx);
    const encounterId = await createEncounter(doctorCtx, patient.id, {
      departmentId: opdDept.id,
    });
    // The drug is picked by someone who manages stock; a doctor cannot see it.
    const drug = await getFirstDrug(await getAuthContextFromCookies(request));
    await createPrescription(doctorCtx, encounterId, { drugId: drug.id });

    await loginAsRole(page, pharmacistIdentity.username, pharmacistIdentity.password);
    // The queue shows the 50 oldest; a pharmacist reaches one patient's
    // prescriptions from that patient (search is the queued "search by" work).
    await navigateTo(page, `/pharmacy?patient_id=${patient.id}`);

    // Click Rx Queue tab
    await page.getByRole("tab", { name: /Rx Queue/i }).click();
    const rxPanel = page.getByRole("tabpanel");
    await expect(rxPanel).toBeVisible({ timeout: 8_000 });

    // Patient should surface in the prescription queue
    await expect(
      rxPanel.getByText(new RegExp(patient.first_name, "i")),
    ).toBeVisible({ timeout: 12_000 });
  });

  test("pharmacist dispenses a pending order from the Orders tab", async ({
    page,
    request,
  }) => {
    const pharmacistIdentity = getE2EIdentity("pharmacist");
    const pharmacistCtx = await loginAsRoleApi(request, "pharmacist");
    const doctorCtx = await loginAsRoleApi(request, "doctor");

    const patient = await createPatientApi(doctorCtx);
    const opdDept = await getOpdDept(doctorCtx);
    const encounterId = await createEncounter(doctorCtx, patient.id, {
      departmentId: opdDept.id,
    });
    const drug = await getFirstDrug(await getAuthContextFromCookies(request));
    const prescriptionId = await createPrescription(doctorCtx, encounterId, { drugId: drug.id });

    // Create a pharmacy order so it shows in the UI queue
    await createPharmacyOrder(pharmacistCtx, {
      patientId: patient.id,
      prescriptionId,
    });

    await loginAsRole(page, pharmacistIdentity.username, pharmacistIdentity.password);
    // The list itself names the patient: a pharmacist off the care team is
    // refused the patient's record, so a row that fetched it read "Unresolved".
    const recordFetches: string[] = [];
    page.on("request", (req) => {
      if (new URL(req.url()).pathname === `/api/patients/${patient.id}`) {
        recordFetches.push(req.url());
      }
    });
    // The queue shows the 50 oldest; a pharmacist reaches one patient's
    // prescriptions from that patient (search is the queued "search by" work).
    await navigateTo(page, `/pharmacy?patient_id=${patient.id}`);
    // An order made from the reviewed prescription waits on Orders.
    await page.getByRole("tab", { name: "Orders" }).click();
    const row = page.getByRole("row", { name: new RegExp(patient.first_name, "i") });
    await expect(row).toBeVisible({ timeout: 12_000 });
    await expect(row).toContainText(patient.uhid);
    expect(recordFetches, "the Orders row fetched the patient record").toEqual([]);

    await row.getByRole("button", { name: "Dispense pharmacy order" }).click();
    // The order's bill is unpaid: the pharmacist says why, rather than being
    // turned away or dispensing silently.
    const unpaid = page.getByRole("dialog", { name: "Dispense unpaid?" });
    await expect(unpaid).toContainText("outstanding balance");
    await unpaid.getByLabel("Why dispense before payment").fill("Credit patient — billed on account");
    await unpaid.getByRole("button", { name: "Dispense unpaid" }).click();
    await expect(unpaid).toBeHidden();
    await expect(row.getByRole("button", { name: "Dispense pharmacy order" })).toHaveCount(0, {
      timeout: 10_000,
    });
  });
});
