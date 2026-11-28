import { expect, test } from "@playwright/test";
import { navigateTo } from "../helpers";
import { getAuthContextFromCookies } from "../helpers/api";
import { admitPatientToOpen, createPatientApi } from "../helpers/journey-steps";

/**
 * The statutory consent forms, reachable at last.
 *
 * Fourteen of these had a print-data endpoint and no renderer of any kind —
 * for a consent form that means the paper a hospital is required to hold
 * could not be produced by the system holding the consent.
 */
test.describe("consent forms print from the admission", () => {
  test("the admission offers its statutory consent forms", async ({ page, request }) => {
    const { admissionId } = await admitPatientToOpen(await getAuthContextFromCookies(request));
    await navigateTo(page, `/ipd/admissions/${admissionId}`);
    await expect(page.getByRole("button", { name: /general consent/i })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole("button", { name: /blood transfusion consent/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /DNR/i })).toBeVisible();
  });

  test("the patient chart offers its patient-scoped consents", async ({ page, request }) => {
    const patient = await createPatientApi(await getAuthContextFromCookies(request));
    await navigateTo(page, `/patients/${patient.id}`);
    await page.getByRole("tab", { name: "Documents" }).click();
    await expect(page.getByRole("button", { name: /HIV testing consent/i })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole("button", { name: /organ donation consent/i })).toBeVisible();
  });
});
