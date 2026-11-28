import { expect, test } from "@playwright/test";
import { navigateTo } from "../helpers";
import { getAuthContextFromCookies } from "../helpers/api";
import { admitPatientToOpen } from "../helpers/journey-steps";

/**
 * A score that belongs to the patient.
 *
 * Care View carries twenty of these as ward-level calculators: pick five
 * values, read a number, keep nothing. An Aldrete IS the record that a
 * patient was fit to leave recovery, and NEWS2 exists to show deterioration —
 * neither survives being arithmetic.
 */
test.describe("patient assessment scores", () => {
  test("a patient's recorded scores are on their admission", async ({ page, request }) => {
    const { admissionId } = await admitPatientToOpen(await getAuthContextFromCookies(request));
    await navigateTo(page, `/ipd/admissions/${admissionId}#scores`);
    await expect(page.getByText("Aldrete recovery score")).toBeVisible({ timeout: 15000 });
    // The history is listed with the form, which is the whole difference from a calculator.
    await expect(page.getByText("Recorded scores")).toBeVisible();
  });

  test("the discharge threshold is stated, not left to memory", async ({ page, request }) => {
    const { admissionId } = await admitPatientToOpen(await getAuthContextFromCookies(request));
    await navigateTo(page, `/ipd/admissions/${admissionId}#scores`);
    // Defaults are 2 across five parameters, so the total is 10 — at or above
    // the threshold of 9.
    await expect(page.getByText(/Total 10 of 10/)).toBeVisible({ timeout: 15000 });
  });
});
