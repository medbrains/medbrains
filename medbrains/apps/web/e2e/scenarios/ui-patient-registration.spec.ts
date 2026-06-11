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
      page.getByRole("button", { name: /Register Patient/i }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("heading", { name: /Patients/i })).toBeVisible();
  });

  test("receptionist opens registration drawer and fields are present", async ({
    page,
  }) => {
    const identity = getE2EIdentity("receptionist");
    await loginAsRole(page, identity.username, identity.password);
    await navigateTo(page, "/patients");

    await page.getByRole("button", { name: /Register Patient/i }).first().click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible({ timeout: 8_000 });

    // Mandatory fields must be present
    await expect(drawer.getByLabel(/First name/i)).toBeVisible();
    await expect(drawer.getByLabel(/Last name/i)).toBeVisible();
    await expect(drawer.getByLabel(/Phone/i)).toBeVisible();
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

    // Patient list should now show the new patient
    await page.getByPlaceholder(/Search/i).fill(patient.first_name);
    await expect(
      page.getByRole("row", { name: new RegExp(patient.first_name, "i") }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole("row", { name: new RegExp(patient.uhid, "i") }),
    ).toBeVisible();
  });

  test("blank registration form shows required field errors", async ({
    page,
  }) => {
    const identity = getE2EIdentity("receptionist");
    await loginAsRole(page, identity.username, identity.password);
    await navigateTo(page, "/patients");

    await page.getByRole("button", { name: /Register Patient/i }).first().click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();

    // Submit empty
    await drawer.getByRole("button", { name: /Register/i }).click();

    await expect(
      drawer.getByText(/First name is required|required/i),
    ).toBeVisible({ timeout: 5_000 });
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

    // Search for the newly registered patient and click their row
    await page.getByPlaceholder(/Search/i).fill(patient.first_name);
    const row = page.getByRole("row", {
      name: new RegExp(patient.first_name, "i"),
    });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.click();

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
