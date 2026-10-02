/**
 * The default dashboard's OPD Queue, Recent Admissions and Revenue tiles load
 * — they were seeded with a source nothing resolved and read "Couldn't load"
 * on every tenant.
 */
import { expect, test } from "./support/world";

test("the default dashboard's queue, admissions and revenue tiles load", async ({ hospital }) => {
  const page = await hospital.asAdmin();
  const batch = page.waitForResponse((r) => r.url().includes("/api/dashboard/widget-data/batch"));
  await page.goto("/dashboard");
  expect((await batch).ok()).toBe(true);

  const tile = (title: string) =>
    page.locator(".mantine-Card-root").filter({ hasText: title }).first();
  for (const title of ["OPD Queue", "Recent Admissions"]) {
    // Either rows or an honest "nothing", never the failure.
    await expect(tile(title).getByRole("table").or(tile(title).getByText("Nothing to show"))).toBeVisible();
    await expect(tile(title).getByText("Couldn't load")).toHaveCount(0);
  }
  // The dev tenant has invoices in the last 30 days: the revenue tile draws bars.
  await expect(tile("Revenue, last 30 days").locator(".recharts-bar-rectangle").first()).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("dashboard.png"), fullPage: true });
});
