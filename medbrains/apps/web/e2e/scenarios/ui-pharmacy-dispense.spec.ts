/**
 * UI tests — SOP ref: docs/sops/04-pharmacy-dispensing.md
 * Scenario S1: Doctor writes prescription — prescription appears in Rx Queue
 * Scenario S2: Pharmacist views Rx Queue tab
 * Scenario S3: NDPS register tab visible to pharmacist
 */

import { test, expect } from "@playwright/test";
import { loginAsRole, navigateTo, routeApiDirect } from "../helpers";
import { getE2EIdentity } from "../helpers/e2e-identities";
import { loginAsRoleApi } from "../helpers/api";
import {
  createPatientApi,
  createEncounter,
  createPrescription,
  createPharmacyOrder,
} from "../helpers/journey-steps";
import { getOpdDept } from "../helpers/seed-resolvers";

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
    await createPrescription(doctorCtx, encounterId);

    await loginAsRole(page, pharmacistIdentity.username, pharmacistIdentity.password);
    await navigateTo(page, "/pharmacy");

    // Click Rx Queue tab
    await page.getByRole("tab", { name: /Rx Queue/i }).click();
    const rxPanel = page.getByRole("tabpanel");
    await expect(rxPanel).toBeVisible({ timeout: 8_000 });

    // Patient should surface in the prescription queue
    await expect(
      rxPanel.getByText(new RegExp(patient.first_name, "i")),
    ).toBeVisible({ timeout: 12_000 });
  });

  test("Dispense button present on a pending pharmacy order row", async ({
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
    const prescriptionId = await createPrescription(doctorCtx, encounterId);

    // Create a pharmacy order so it shows in the UI queue
    await createPharmacyOrder(pharmacistCtx, {
      patientId: patient.id,
      prescriptionId,
    });

    await loginAsRole(page, pharmacistIdentity.username, pharmacistIdentity.password);
    await navigateTo(page, "/pharmacy");
    await page.getByRole("tab", { name: /Rx Queue/i }).click();

    await expect(
      page.getByText(new RegExp(patient.first_name, "i")),
    ).toBeVisible({ timeout: 12_000 });

    // Dispense action button/label should be visible somewhere in the row
    await expect(page.getByRole("button", { name: /Dispense/i }).first()).toBeVisible({
      timeout: 8_000,
    });
  });
});
