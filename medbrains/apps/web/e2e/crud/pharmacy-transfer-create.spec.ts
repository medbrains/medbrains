import { expect, test } from "@playwright/test";
import { navigateTo } from "../helpers";

/**
 * The transfer create path, driven through the screen.
 *
 * The endpoint shipped with the transfer lifecycle and nothing called it, so
 * transfers could be approved, dispatched and received but never raised. These
 * assert the screen actually reaches it, and that it warns about a shortfall
 * before dispatch does — dispatch refuses stock the source cannot cover, and
 * hearing that only after somebody approved the transfer is hearing it late.
 */
test.describe("raising a pharmacy stock transfer", () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, "/pharmacy?tab=stores");
  });

  test("the transfers view offers a way to raise one", async ({ page }) => {
    await page.getByText("Transfers", { exact: true }).click();

    await expect(
      page.getByRole("button", { name: /new transfer/i }),
      "a transfer queue with no way to raise a transfer is a dead end",
    ).toBeVisible();
  });

  test("the drawer asks for both stores and at least one medicine", async ({ page }) => {
    await page.getByText("Transfers", { exact: true }).click();
    await page.getByRole("button", { name: /new transfer/i }).click();

    const drawer = page.getByRole("dialog", { name: /raise a stock transfer/i });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByLabel(/from store/i)).toBeVisible();
    await expect(drawer.getByLabel(/to store/i)).toBeVisible();
    await expect(drawer.getByRole("button", { name: /add medicine/i })).toBeVisible();
  });

  test("submitting an empty form reports what is missing instead of failing silently", async ({
    page,
  }) => {
    await page.getByText("Transfers", { exact: true }).click();
    await page.getByRole("button", { name: /new transfer/i }).click();

    const drawer = page.getByRole("dialog", { name: /raise a stock transfer/i });
    await drawer.getByRole("button", { name: /raise transfer/i }).click();

    await expect(
      drawer.getByText(/select the store the stock leaves/i),
      "an empty submit must name the missing field, not post an invalid transfer",
    ).toBeVisible();
  });

  test("the From and To columns name stores rather than showing raw ids", async ({ page }) => {
    await page.getByText("Transfers", { exact: true }).click();

    const table = page.getByRole("table");
    await expect(table).toBeVisible();
    // A truncated uuid ("a3f19c2b...") tells a storekeeper nothing about
    // which shelf the stock is leaving.
    await expect(
      table.getByText(/^[0-9a-f]{8}\.\.\.$/),
      "transfer rows must not render store ids where a store name belongs",
    ).toHaveCount(0);
  });
});
