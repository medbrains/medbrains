import { expect, test } from "@playwright/test";
import { navigateTo } from "../helpers";

/**
 * The laboratory prints more than any other department.
 *
 * Culture sensitivity, histopathology and the investigation requisition each
 * had a print-data endpoint and no renderer of any kind. The menu is driven by
 * the registry's idKind, so an order screen offers every order-scoped document
 * the reader is permitted to print — one mount, not a button per document.
 */
test.describe("lab order print menu", () => {
  test("a lab order offers the documents it can print", async ({ page }) => {
    await navigateTo(page, "/lab/orders/a70beb55-1ac9-4d7b-8f89-b897601aaadc");
    await expect(page.getByText("Print", { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByRole("button", { name: /culture sensitivity/i }),
    ).toBeVisible();
  });

  test("it does not offer radiology documents on a lab order", async ({ page }) => {
    // Both key on an "order" id and neither endpoint accepts the other's, so
    // a radiology button here would fetch the wrong record entirely.
    await navigateTo(page, "/lab/orders/a70beb55-1ac9-4d7b-8f89-b897601aaadc");
    await expect(page.getByText("Print", { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: /radiology report/i })).toHaveCount(0);
  });

  test("it does not duplicate the report this page already prints", async ({ page }) => {
    await navigateTo(page, "/lab/orders/a70beb55-1ac9-4d7b-8f89-b897601aaadc");
    await expect(page.getByText("Print", { exact: true })).toBeVisible({ timeout: 15000 });
    // lab-report / lab-report-full are excluded: this page prints those its own way.
    await expect(page.getByRole("button", { name: /^Lab Report$/i })).toHaveCount(0);
  });
});
