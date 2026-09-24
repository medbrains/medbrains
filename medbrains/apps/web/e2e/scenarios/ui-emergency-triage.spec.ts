/**
 * UI tests — SOP ref: docs/sops/06-emergency-casualty.md
 * Scenario S1: Nurse registers ER visit and assigns triage severity
 * Scenario S2: Emergency doctor sees visit in ER queue
 * Scenario S4: MLC flag visible on visit row
 */

import { test, expect } from "@playwright/test";
import { loginAsRole, navigateTo, routeApiDirect } from "../helpers";
import { getE2EIdentity } from "../helpers/e2e-identities";
import { getAuthContextFromCookies, loginAsRoleApi } from "../helpers/api";
import {
  createPatientApi,
  createEmergencyVisit,
  createMlcCase,
} from "../helpers/journey-steps";

test.describe("Emergency Triage — UI", () => {
  test.beforeEach(async ({ page }) => {
    await routeApiDirect(page);
  });

  test("nurse sees Emergency Department page with Register ER Visit button", async ({
    page,
  }) => {
    const identity = getE2EIdentity("nurse");
    await loginAsRole(page, identity.username, identity.password);
    await navigateTo(page, "/emergency");

    await expect(
      page.getByRole("heading", { name: /Emergency/i }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole("button", { name: /Register ER Visit/i }),
    ).toBeVisible();
  });

  test("Register ER Visit opens the registration form with patient and chief complaint fields", async ({
    page,
  }) => {
    const identity = getE2EIdentity("nurse");
    await loginAsRole(page, identity.username, identity.password);
    await navigateTo(page, "/emergency");

    await page
      .getByRole("button", { name: /Register ER Visit/i })
      .first()
      .click();

    await expect(page.getByRole("heading", { name: /Register ER Visit/i })).toBeVisible({ timeout: 8_000 });
    // Must have patient selection and chief complaint
    await expect(page.getByRole("textbox", { name: /Patient/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /Chief Complaint/i })).toBeVisible();
  });

  test("created ER visit appears in emergency queue", async ({
    page,
    request,
  }) => {
    const nurseIdentity = getE2EIdentity("nurse");
    const nurseCtx = await loginAsRoleApi(request, "nurse");

    const patient = await createPatientApi(await getAuthContextFromCookies(request));
    await createEmergencyVisit(nurseCtx, patient.id, {
      chiefComplaint: "Chest pain with shortness of breath",
    });

    await loginAsRole(page, nurseIdentity.username, nurseIdentity.password);
    await navigateTo(page, "/emergency");

    // Patient should appear somewhere on the ER page
    await expect(
      page.getByText(new RegExp(patient.first_name, "i")),
    ).toBeVisible({ timeout: 12_000 });
  });

  test("MLC visit row has MLC indicator visible in ER queue", async ({
    page,
    request,
  }) => {
    const nurseCtx = await loginAsRoleApi(request, "nurse");
    const nurseIdentity = getE2EIdentity("nurse");

    const patient = await createPatientApi(await getAuthContextFromCookies(request));
    // The nurse registers the arrival; marking it medico-legal is the
    // doctor's decision (and the doctor's permission).
    const visit = await createEmergencyVisit(nurseCtx, patient.id, {
      chiefComplaint: "Multiple fractures, polytrauma",
    });
    await createMlcCase(await loginAsRoleApi(request, "doctor"), { patientId: patient.id, visitId: visit.id });

    await loginAsRole(page, nurseIdentity.username, nurseIdentity.password);
    await navigateTo(page, "/emergency");

    // MLC tag should surface somewhere in the visit list
    await expect(page.getByText(/MLC/i).first()).toBeVisible({ timeout: 12_000 });
  });
});
