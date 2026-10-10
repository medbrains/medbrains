/**
 * One chart, two places: a report's chart goes onto the reader's dashboard
 * from the reports page, draws there from the report's own data, opens to
 * every row, and comes off again the same way.
 */
import { expect, test } from "./support/world";

const REPORT = "Occupancy and queue pressure";

test("a report chart goes onto the dashboard and comes off again", async ({ hospital }) => {
  const page = await hospital.asAdmin();
  await page.goto("/reports");
  const actions = page.getByRole("button", { name: `${REPORT} actions` });
  await expect(actions).toBeVisible({ timeout: 20_000 });
  await actions.click();
  await page.getByRole("menuitem", { name: "Add to my dashboard" }).click();
  await expect(page.getByText("Added to your dashboard")).toBeVisible();

  await page.goto("/dashboard");
  const expand = page.getByRole("button", { name: `Expand ${REPORT}` });
  await expect(expand).toBeVisible({ timeout: 15_000 });
  await expand.click();
  const dialog = page.getByRole("dialog", { name: REPORT });
  await expect(dialog.getByRole("table")).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press("Escape");

  await page.goto("/reports");
  await actions.click();
  await page.getByRole("menuitem", { name: "Remove from my dashboard" }).click();
  await expect(page.getByText("Removed from your dashboard")).toBeVisible();
  await page.goto("/dashboard");
  await expect(page.getByRole("button", { name: /^Expand / }).first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("button", { name: `Expand ${REPORT}` })).toHaveCount(0);
});
