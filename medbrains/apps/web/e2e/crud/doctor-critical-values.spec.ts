import { expect, test } from "@playwright/test";
import { navigateTo } from "../helpers";

/**
 * The doctor's own critical values, on the doctor's own surface.
 *
 * `listDoctorCriticalAlerts` filters to the encounters this doctor owns and
 * refuses any other id. It had no caller: the only place a panic value showed
 * was the laboratory's chase list, which is every doctor's at once.
 */
test.describe("doctor critical value inbox", () => {
  test("the sign-off queue offers the doctor their own critical values", async ({ page }) => {
    await navigateTo(page, "/doctor/signoffs");
    await expect(page.getByRole("tab", { name: /critical values/i })).toBeVisible();
  });

  test("opening it reports a state, never a blank panel", async ({ page }) => {
    await navigateTo(page, "/doctor/signoffs");
    await page.getByRole("tab", { name: /critical values/i }).click();

    // Either outstanding values, or an explicit "none", or an explicit read
    // failure — but never nothing at all, which would read as "none".
    await expect(
      page
        .getByText(/No outstanding critical values|could not be read|Checking for critical values/i)
        .or(page.getByRole("table"))
        .first(),
    ).toBeVisible();
  });
});
