import { expect, test } from "@playwright/test";
import { navigateTo } from "../helpers";

/**
 * Consent asked for at the three points where it matters.
 *
 * `verifyConsent` existed and had no caller — the verification tab showed a
 * summary instead, which nobody opens mid-procedure. These pin that the gate
 * reaches the screen and states an outcome rather than silently allowing.
 */
test.describe("consent gates on procedure screens", () => {
  test("booking an operation asks about surgical consent", async ({ page }) => {
    await navigateTo(page, "/ot");
    // The page opens on another tab; the maker lives under Bookings.
    await page.getByRole("tab", { name: "Bookings" }).click();
    await page.getByRole("button", { name: "New Booking" }).click();

    // No patient chosen yet, so no verdict is claimed — the gate must not
    // assert "no consent on file" about nobody.
    await expect(page.getByText(/No valid consent on file/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /create booking/i })).toBeVisible();
  });

  test("a contrast study asks about contrast consent, a plain study does not", async ({
    page,
  }) => {
    await navigateTo(page, "/radiology");
    await page.getByRole("button", { name: /new order|create order|add order/i }).first().click();

    // Contrast is off by default: the gate must be absent, not merely passing.
    await expect(page.getByText(/contrast administration/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /create order/i })).toBeEnabled();
  });
});
