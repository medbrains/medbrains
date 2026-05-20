import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { navigateTo, routeApiDirect } from "../helpers";
import { patientRegisterSchema } from "./schemas/patient-register";

test.describe("PatientRegisterForm field validation", () => {
  test.beforeEach(async ({ page }) => {
    await routeApiDirect(page);
    await navigateTo(page, patientRegisterSchema.navigatePath);
  });

  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });

  test("required fields reject blank submission", async ({ page }) => {
    await page.getByRole("button", { name: /Register Patient/i }).click();
    const root = page.getByRole("dialog");
    await expect(root).toBeVisible();

    await root.getByRole("button", { name: /Register/ }).click();

    await expect(root.getByText("First name required")).toBeVisible();
    await expect(root.getByText("Last name required")).toBeVisible();
    await expect(root.getByText("Phone required")).toBeVisible();
  });

  test("registration context exposes all canonical patient types and sources", async ({ page }) => {
    await page.getByRole("button", { name: /Register Patient/i }).click();
    const root = page.getByRole("dialog");
    await expect(root).toBeVisible();

    await expectSelectOptions(page, root.getByLabel("Registration type"), [
      "New",
      "Revisit",
      "Transfer in",
      "Referral",
      "Emergency",
      "Camp",
      "Telemedicine",
      "Pre-registration",
    ]);

    await expectSelectOptions(page, root.getByLabel("Registration source"), [
      "Walk-in",
      "Phone",
      "Online portal",
      "Mobile app",
      "Kiosk",
      "Referral",
      "Ambulance",
      "Camp",
      "Telemedicine",
    ]);
  });

});

test.describe("PatientRegisterForm mobile viewport", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test.beforeEach(async ({ page }) => {
    await routeApiDirect(page);
    await navigateTo(page, patientRegisterSchema.navigatePath);
  });

  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });

  test("keeps registration context usable on a mobile-sized device", async ({ page }) => {
    await page.getByRole("button", { name: /Register Patient/i }).click();
    const root = page.getByRole("dialog");
    await expect(root).toBeVisible();
    await expect(root.getByLabel("Registration type")).toBeVisible();
    await expect(root.getByLabel("Registration source")).toBeVisible();
    await expect(root.getByLabel("Camp reference")).toBeVisible();
    await expect(root.getByLabel("Referral type")).toBeVisible();
  });
});

async function expectSelectOptions(page: Page, trigger: Locator, labels: string[]) {
  await trigger.click();
  for (const label of labels) {
    await expect(page.getByRole("option", { name: label, exact: true })).toBeVisible();
  }
  await page.keyboard.press("Escape");
}
