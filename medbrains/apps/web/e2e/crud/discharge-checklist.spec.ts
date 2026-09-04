import { expect, test } from "@playwright/test";
import { navigateTo } from "../helpers";

/**
 * The discharge checklist, which nothing could ever create.
 *
 * `initDischargeChecklist` posts no body; the handler demanded one, so the
 * pair had never been exercised and the table could not gain a row. The tab
 * hid its block behind `items.length > 0`, and the checkbox was readOnly — so
 * even a populated checklist could not be worked through. An MRD deficiency
 * metric counted the permanently empty table.
 */
const ADMISSION = "b052afe0-bc1c-48e2-9260-a7ead7a48ab0";

test.describe("IPD discharge checklist", () => {
  test("the tab offers a way to start one, or shows the items", async ({ page }) => {
    // The workspace addresses its sections by hash, which is steadier than
    // clicking through an action rail whose labels carry readiness counts.
    await navigateTo(page, `/ipd/admissions/${ADMISSION}#discharge`);

    // Either the maker (none started) or the checklist itself — never a blank
    // panel, which was the old behaviour and read as "nothing to do".
    await expect(
      page
        .getByRole("button", { name: /start checklist/i })
        .or(page.getByText(/Discharge Checklist/i))
        .first(),
    ).toBeVisible({ timeout: 15000 });
  });

  test("a started checklist shows its items as tickable", async ({ page }) => {
    // The workspace addresses its sections by hash, which is steadier than
    // clicking through an action rail whose labels carry readiness counts.
    await navigateTo(page, `/ipd/admissions/${ADMISSION}#discharge`);

    const box = page.getByRole("checkbox", { name: /Discharge summary prepared/i });
    await expect(box).toBeVisible({ timeout: 15000 });
    await expect(box).toBeEnabled();
  });
});
