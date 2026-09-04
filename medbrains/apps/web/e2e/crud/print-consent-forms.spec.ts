import { expect, test } from "@playwright/test";
import { navigateTo } from "../helpers";

/**
 * The statutory consent forms, reachable at last.
 *
 * Fourteen of these had a print-data endpoint and no renderer of any kind —
 * for a consent form that means the paper a hospital is required to hold
 * could not be produced by the system holding the consent.
 */
test.describe("consent forms print from the admission", () => {
  test("the admission offers its statutory consent forms", async ({ page }) => {
    await navigateTo(page, "/ipd/admissions/b052afe0-bc1c-48e2-9260-a7ead7a48ab0");
    await expect(page.getByRole("button", { name: /general consent/i })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole("button", { name: /blood transfusion consent/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /DNR/i })).toBeVisible();
  });
});
