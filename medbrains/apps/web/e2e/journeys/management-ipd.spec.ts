/**
 * Management reads the wards: length of stay, mortality, readmissions and
 * leaving against advice against the usual day, occupancy as a midnight
 * census over beds in service — and the command centre's occupancy agrees
 * with the bed board instead of reporting an empty hospital.
 */
import { expect, test } from "./support/world";

test("a hospital admin reads the wards against the usual day", async ({ hospital }) => {
  const page = await hospital.as("hospital_admin");
  const batch = page.waitForResponse((r) => r.url().includes("/api/dashboard/widget-data/batch"));
  await page.goto("/dashboard");
  expect((await batch).ok()).toBe(true);

  const tiles: [string, RegExp][] = [
    ["Average length of stay", /^([\d.,]+ days|—)$/],
    ["Mortality", /^([\d.]+%|—)$/],
    ["Readmissions", /^([\d.]+%|—)$/],
    ["Left against advice", /^([\d.]+%|—)$/],
    // A share of the beds, not a count of admitted patients.
    ["Bed Occupancy", /^([\d.,]+%|—)$/],
  ];
  for (const [title, value] of tiles) {
    const tile = page.locator(".stat-card").filter({ hasText: title });
    await expect(tile).toBeVisible();
    await expect(tile.getByText("Couldn't load")).toHaveCount(0);
    await expect(tile.getByText(value)).toBeVisible();
  }
  await expect(page.getByText("Revenue, last 30 days")).toBeVisible();
  await expect(page.getByText("Revenue This Month")).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath("ipd.png"), fullPage: true });

  await page.goto("/command-center");
  const occupancy = page.locator(".stat-card").filter({ hasText: "Bed Occupancy" }).first();
  // Read from the live bed states: some beds are occupied on the dev wards.
  await expect(occupancy.getByText(/^[1-9][\d.]*%$/)).toBeVisible();
});
