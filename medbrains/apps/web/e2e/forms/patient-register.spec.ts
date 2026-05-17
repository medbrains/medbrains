import { expect, test } from "@playwright/test";
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

});
