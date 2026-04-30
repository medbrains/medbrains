import { test, expect, type Locator, type Page } from "@playwright/test";
import { routeApiDirect, navigateTo } from "../helpers";
import { uniquePatient, type PatientFormData } from "../fixtures/patients";

async function openRegisterDrawer(page: Page, quick = false): Promise<Locator> {
  if (quick) {
    await page.getByRole("button", { name: "Quick Register" }).click();
  } else {
    await page.getByRole("button", { name: "Register Patient" }).first().click();
  }

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

async function fillRegistrationForm(dialog: Locator, patient: PatientFormData) {
  await dialog.getByLabel("First name").fill(patient.firstName);
  await dialog.getByLabel("Last name").fill(patient.lastName);
  await dialog.getByLabel("Phone (primary)").fill(patient.phone);
}

test.describe("Patient Registration Flow", () => {
  test.beforeEach(async ({ page }) => {
    await routeApiDirect(page);
  });

  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });

  test("should register a new patient via full form", async ({ page }) => {
    test.info().annotations.push({ type: "tcms", description: "Patients::Register new patient with full demographics" });
    const patient = uniquePatient();

    await navigateTo(page, "/patients");

    const dialog = await openRegisterDrawer(page);
    await fillRegistrationForm(dialog, patient);
    await dialog.getByRole("button", { name: "Register" }).click();

    await expect(dialog).not.toBeVisible({ timeout: 10_000 });

    const row = page.locator("tr", { hasText: patient.firstName });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row).toContainText(patient.lastName);

    await row.locator("button").first().click();

    const detailDialog = page.getByRole("dialog");
    await expect(detailDialog).toBeVisible({ timeout: 10_000 });
    await expect(detailDialog).toContainText(patient.phone);
    await expect(detailDialog.getByRole("tab", { name: "Overview" })).toBeVisible();
  });

  test("should register via quick registration", async ({ page }) => {
    const patient = uniquePatient();

    await navigateTo(page, "/patients");

    const dialog = await openRegisterDrawer(page, true);
    await expect(dialog).toContainText("Quick Registration");
    await fillRegistrationForm(dialog, patient);
    await dialog.getByRole("button", { name: "Register" }).click();

    await expect(dialog).not.toBeVisible({ timeout: 10_000 });
    await expect(page.locator("tr", { hasText: patient.firstName })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("should search for a patient by name", async ({ page }) => {
    const patient = uniquePatient();

    await navigateTo(page, "/patients");

    const dialog = await openRegisterDrawer(page);
    await fillRegistrationForm(dialog, patient);
    await dialog.getByRole("button", { name: "Register" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });

    const searchInput = page.getByPlaceholder("Search by UHID, name, or phone...");
    await searchInput.fill(patient.firstName);

    const row = page.locator("tr", { hasText: patient.firstName });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row).toContainText(patient.lastName);
  });
});
