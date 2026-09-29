/**
 * UI tests — SOP ref: docs/sops/01-patient-registration.md
 * Scenario S1: Patient self-registers at kiosk (public form)
 * Scenario S2: Receptionist registers walk-in patient via UI form
 * Scenario S4: Pre-registration search finds existing patient
 */

import { test, expect } from "@playwright/test";
import { loginAsRole, navigateTo, routeApiDirect } from "../helpers";
import { getE2EIdentity } from "../helpers/e2e-identities";
import { registerPatientUI } from "../helpers/journey-steps";
import { loginAsRoleApi } from "../helpers/api";

test.describe("Patient Registration — UI", () => {
  test.beforeEach(async ({ page }) => {
    await routeApiDirect(page);
  });

  test("receptionist navigates to patients page and sees Register Patient button", async ({
    page,
  }) => {
    const identity = getE2EIdentity("receptionist");
    await loginAsRole(page, identity.username, identity.password);
    await navigateTo(page, "/patients");

    await expect(
      page.getByRole("button", { name: /Register Patient/i }).first(),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "Patients", exact: true })).toBeVisible();
  });

  test("receptionist fills and submits registration form; UHID appears in patient list", async ({
    page,
    request,
  }) => {
    const identity = getE2EIdentity("receptionist");
    await loginAsRole(page, identity.username, identity.password);

    const ctx = await loginAsRoleApi(request, "receptionist");
    await navigateTo(page, "/patients");

    const patient = await registerPatientUI(ctx, page);
    await navigateTo(page, "/patients");

    // Patient list should now show the new patient
    await page.getByPlaceholder(/Search/i).fill(patient.first_name);
    await expect(page.getByRole("row", { name: new RegExp(patient.uhid) })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("patient detail page opens after clicking a patient row", async ({
    page,
    request,
  }) => {
    const identity = getE2EIdentity("receptionist");
    await loginAsRole(page, identity.username, identity.password);

    const ctx = await loginAsRoleApi(request, "receptionist");
    await navigateTo(page, "/patients");
    const patient = await registerPatientUI(ctx, page);
    await navigateTo(page, "/patients");

    // Search for the newly registered patient and click their row
    await page.getByPlaceholder(/Search/i).fill(patient.first_name);
    // By UHID: a name can be part of another patient's name.
    const row = page.getByRole("row", { name: new RegExp(patient.uhid) });
    await expect(row).toBeVisible({ timeout: 10_000 });
    // The row's profile button opens the record (the row itself does not).
    await row.getByRole("button", { name: "Full profile" }).click();

    // Should land on patient detail page
    await expect(page).toHaveURL(
      /\/patients\/[0-9a-f-]{36}/,
      { timeout: 10_000 },
    );
    await expect(
      page.getByText(new RegExp(patient.first_name, "i")),
    ).toBeVisible();
  });
});
