import { expect, test } from "@playwright/test";
import { navigateTo } from "../helpers";

/**
 * The sterilisation recall query.
 *
 * When a cycle fails its biological indicator, the only question is which
 * trays were in it and therefore which patients they reached.
 * `cssd_load_items` had an INSERT and no SELECT anywhere in the codebase, so
 * the system held the answer and could not be asked; `addCssdLoadItem` had no
 * caller, so in practice it held nothing.
 */
test.describe("CSSD load contents", () => {
  test("a load offers its contents, which is the recall question", async ({ page }) => {
    await navigateTo(page, "/cssd");
    await page.getByRole("tab", { name: /steril/i }).first().click();

    const view = page.getByRole("button", { name: /view load contents/i }).first();
    await expect(view).toBeVisible({ timeout: 15000 });
    await view.click();

    // Contents, an explicit "nothing recorded", or an explicit read failure —
    // never a blank panel, which during a recall reads as "nothing was in it".
    await expect(
      page
        .getByText(/Nothing has been recorded in this load|could not be read/i)
        .or(page.getByRole("table"))
        .first(),
    ).toBeVisible();
  });
});
