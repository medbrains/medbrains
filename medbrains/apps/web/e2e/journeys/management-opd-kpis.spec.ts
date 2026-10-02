/**
 * Management reads OPD against the usual day: each tile says how today sits
 * against a usual same weekday by this time of day, and the manager can
 * switch the comparison or look at an earlier day.
 */
import { expect, test } from "./support/world";

test("a hospital admin reads today's OPD against the usual day", async ({ hospital }) => {
  const page = await hospital.as("hospital_admin");
  const batch = page.waitForResponse((r) => r.url().includes("/api/dashboard/widget-data/batch"));
  await page.goto("/dashboard");
  expect((await batch).ok()).toBe(true);

  const visits = page.locator(".stat-card").filter({ hasText: "OPD visits" });
  await expect(visits).toBeVisible();
  await expect(visits.getByText("Couldn't load")).toHaveCount(0);
  // Today is compared at the same time of day, never against whole days.
  await expect(visits.getByText(/a usual \w+ by this time/)).toBeVisible();

  await page.getByText("Yesterday", { exact: true }).click(); // the segment's label
  await expect(page.getByRole("radio", { name: "Yesterday" })).toBeChecked();
  await expect(visits.getByText(/yesterday by this time/)).toBeVisible();

  // An earlier day is read whole.
  const earlier = page.waitForResponse((r) => r.url().includes("/api/dashboard/widget-data/batch"));
  await page.getByRole("textbox", { name: "As of" }).fill("1 Sep 2026");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  expect((await earlier).ok()).toBe(true);
  await expect(visits.getByText(/yesterday$/)).toBeVisible();
  await expect(visits.getByText(/by this time/)).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath("management-kpis.png"), fullPage: true });
});
