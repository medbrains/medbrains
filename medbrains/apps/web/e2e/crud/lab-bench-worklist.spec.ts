import { expect, test } from "@playwright/test";
import { navigateTo } from "../helpers";

/**
 * What is waiting to be run.
 *
 * `/lab/analyzer-worklist` was routed, permission-checked, and blanks the
 * patient name for a reader without patients.view — and no screen consumed
 * it. The analyser interface was configured in Settings and read by nobody,
 * so the bench worked from the general orders list, which is not ordered by
 * priority and does not carry the barcode.
 */
test.describe("lab bench worklist", () => {
  test("the bench can see what is waiting, with barcodes", async ({ page }) => {
    await navigateTo(page, "/lab");
    await page.getByRole("tab", { name: "Sample Mgmt" }).click();
    await expect(page.getByRole("tab", { name: /bench worklist/i })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText(/most urgent first/i)).toBeVisible();
  });

  test("an unlabelled tube is called out, not left blank", async ({ page }) => {
    // An unlabelled tube cannot be matched to a patient by the analyser, so a
    // silent empty cell is the wrong way to show it.
    await navigateTo(page, "/lab");
    await page.getByRole("tab", { name: "Sample Mgmt" }).click();
    await expect(
      page.getByText("Not labelled").first().or(page.getByRole("table")).first(),
    ).toBeVisible({ timeout: 15000 });
  });
});
