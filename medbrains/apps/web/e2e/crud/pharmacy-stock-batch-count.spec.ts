import { expect, test } from "@playwright/test";
import { navigateTo } from "../helpers";

/**
 * The batch count a storekeeper reads on the stock screen.
 *
 * Guards the screen half of the defect journey 21 guards on the API: the count
 * used to be derived in the browser from a 500-row batch window ordered by
 * expiry, so a pharmacy past that cap showed "0 batches" — and a drawer saying
 * no batch stock was recorded — against stock it was holding. The count and
 * FEFO date now ride on the stock row itself, aggregated in SQL.
 */
test.describe("pharmacy stock — batch count on screen", () => {
  test("an item holding stock shows its count and FEFO date, and its batches open", async ({
    page,
  }) => {
    await navigateTo(page, "/pharmacy");
    await page.getByRole("tab", { name: /stock/i }).first().click();

    // Most of the catalogue holds nothing; search down to an item that does.
    await page.getByPlaceholder("Search stock").fill("FEFO");

    const counted = page
      .getByRole("button", { name: /[1-9]\d* batch(es)? · FEFO \d{4}-\d{2}-\d{2}/ })
      .first();
    await expect(counted).toBeVisible();

    // The drawer must agree with the number on the row — it reads the same
    // item's batches directly rather than filtering a shared window.
    await counted.click();
    await expect(page.getByText(/No active batch stock recorded/i)).toHaveCount(0);
  });
});
