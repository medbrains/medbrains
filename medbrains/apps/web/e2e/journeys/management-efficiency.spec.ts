/**
 * Management sees how the non-clinical departments run against the usual
 * day: billing (visits never invoiced, billing lag), pharmacy wait, lab
 * turnaround and the share within each test's target, and bed turnaround.
 */
import { expect, test } from "./support/world";

const TILES = [
  "Visits with no bill",
  "Billing lag",
  "Pharmacy wait",
  "Lab turnaround",
  "Lab within target",
  "Bed turnaround",
];

test("a hospital admin reads department efficiency against the usual day", async ({
  hospital,
}) => {
  const page = await hospital.as("hospital_admin");
  const batch = page.waitForResponse((r) => r.url().includes("/api/dashboard/widget-data/batch"));
  await page.goto("/dashboard");
  expect((await batch).ok()).toBe(true);

  for (const title of TILES) {
    const tile = page.locator(".stat-card").filter({ hasText: title });
    await expect(tile).toBeVisible();
    await expect(tile.getByText("Couldn't load")).toHaveCount(0);
    // A measure in its unit, or a dash when there was nothing to measure.
    await expect(tile.getByText(/^([\d.,]+ (min|h)|[\d.]+%|—)$/)).toBeVisible();
  }
  await page.screenshot({ path: test.info().outputPath("efficiency.png"), fullPage: true });
});
