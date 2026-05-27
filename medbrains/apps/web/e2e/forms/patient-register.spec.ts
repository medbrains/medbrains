import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { navigateTo, routeApiDirect } from "../helpers";
import { patientRegisterSchema } from "./schemas/patient-register";

test.describe("PatientRegisterForm field validation", () => {
  test.beforeEach(async ({ page }) => {
    await routeApiDirect(page);
    await navigateTo(page, patientRegisterSchema.navigatePath);
    await expect(page.getByText("Patient registration")).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });

  test("required fields reject blank submission", async ({ page }) => {
    await page.getByRole("button", { name: /Save now/i }).click();

    await expect(page.getByText("First name is required")).toBeVisible();
    await expect(page.getByText("Last name is required")).toBeVisible();
    await expect(page.getByText("Phone is required")).toBeVisible();
  });

  test("registration context exposes all canonical patient types and sources", async ({ page }) => {
    await expectSelectOptions(page, page.getByRole("combobox", { name: "Registration type" }), [
      "New",
      "Revisit",
      "Transfer in",
      "Referral",
      "Emergency",
      "Camp",
      "Telemedicine",
      "Pre-registration",
    ]);

    await expectSelectOptions(page, page.getByRole("combobox", { name: "Registration source" }), [
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

  test("DOB, age hint, calendar popover, and phone prefix stay usable", async ({ page }) => {
    await expect(page.locator('input[aria-label="Primary phone country"]')).toHaveValue(/\+\d+/);
    await expect(page.locator('input[aria-label="Phone (primary) Phone Primary"]')).toBeVisible();

    await page.locator('input[aria-label="Age years"]').fill("25");
    await expect(page.getByText(/As of today: 25 years/i)).toBeVisible();

    await page.getByLabel("Date of birth").click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});

test.describe("PatientRegisterForm mobile viewport", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test.beforeEach(async ({ page }) => {
    await routeApiDirect(page);
    await navigateTo(page, patientRegisterSchema.navigatePath);
    await expect(page.getByText("Patient registration")).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });

  test("keeps registration context usable on a mobile-sized device", async ({ page }) => {
    await expect(page.getByLabel("Registration type")).toBeVisible();
    await expect(page.getByLabel("Registration source")).toBeVisible();
    await expect(page.getByLabel("Camp reference")).toBeVisible();
    await expect(page.locator('input[aria-label="Primary phone country"]')).toBeVisible();
    await expect(page.locator('input[aria-label="Phone (primary) Phone Primary"]')).toBeVisible();
  });
});

async function expectSelectOptions(page: Page, trigger: Locator, labels: string[]) {
  await trigger.click();
  for (const label of labels) {
    await expect(page.getByRole("option", { name: label, exact: true })).toBeVisible();
  }
  await page.keyboard.press("Escape");
}
