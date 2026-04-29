import { test } from "@playwright/test";
import { navigateTo, routeApiDirect } from "../helpers";
import {
  assertRequiredValidation,
  assertSubmitSuccess,
} from "../helpers/form-runner";
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
    await assertRequiredValidation(page, patientRegisterSchema);
  });

  test("submits successfully when all fields are filled", async ({ page }) => {
    await assertSubmitSuccess(page, patientRegisterSchema);
  });
});
