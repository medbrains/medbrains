import { expect, test } from "@playwright/test";
import { navigateTo } from "../helpers";

/**
 * The bed board could not see the hospital's beds.
 *
 * `bed_states` is derived — one row per `locations` row at level 'bed'. Two
 * of the three code paths that create bed locations remembered to derive it;
 * the CSV bulk import did not. This database had 28 bed locations, 0
 * bed_states, 8 admitted patients, and a board that answered `[]`.
 *
 * An empty board reads as "this hospital has no beds", not as "the beds were
 * never registered", so nobody looking at it would know to go and fix it.
 *
 * The emptiness was also hiding a second defect: the list query selected the
 * `bed_status` enum into a Rust `String`, which runtime sqlx cannot check at
 * compile time. With no rows it never decoded one, so it never failed. The
 * first bed to exist turned the blank board into a 500.
 */
test.describe("IPD bed board", () => {
  test("the board shows the beds the hospital owns", async ({ page }) => {
    await navigateTo(page, "/ipd");
    await page.getByRole("tab", { name: "Bed Dashboard" }).click();

    // Fails on the old behaviour twice over: blank when bed_states was empty,
    // and a 500 once it was not.
    await expect(page.getByText("No beds found.")).toHaveCount(0, { timeout: 15000 });
    await expect(page.getByText(/bed/i).first()).toBeVisible({ timeout: 15000 });
  });

  test("a bed carries a status, not an empty cell", async ({ page }) => {
    // The status is what makes a bed actionable — vacant, occupied, blocked.
    // Decoding it was the defect the empty table concealed.
    await navigateTo(page, "/ipd");
    await page.getByRole("tab", { name: "Bed Dashboard" }).click();
    await expect(page.getByText(/vacant|occupied|blocked|maintenance/i).first()).toBeVisible({
      timeout: 15000,
    });
  });
});
