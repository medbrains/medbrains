/**
 * Management sees how completely doctors document OPD visits: three rolling
 * 7-day rates against the usual day, and a table by doctor that leads with
 * the least complete — including visits no doctor is recorded on.
 */
import { expect, test } from "./support/world";

test("a hospital admin reads documentation completeness by doctor", async ({ hospital }) => {
  const page = await hospital.as("hospital_admin");
  const batch = page.waitForResponse((r) => r.url().includes("/api/dashboard/widget-data/batch"));
  await page.goto("/dashboard");
  expect((await batch).ok()).toBe(true);

  for (const title of ["Coded diagnosis", "Complete notes", "Visits left open"]) {
    const tile = page.locator(".stat-card").filter({ hasText: title });
    await expect(tile).toBeVisible();
    await expect(tile.getByText("Couldn't load")).toHaveCount(0);
    // A rate, or a dash when the week has no visits — never a bare count.
    await expect(tile.getByText(/^(\d+(\.\d)?%|—)$/)).toBeVisible();
  }

  const table = page.locator(".mantine-Card-root").filter({ hasText: "Documentation by doctor" });
  for (const header of ["Doctor", "Visits", "Coded diagnosis %", "Complete note %", "Left open"]) {
    await expect(table.getByRole("columnheader", { name: header, exact: true })).toBeVisible();
  }
  await expect(table.getByText("Couldn't load")).toHaveCount(0);
  await expect(table.getByRole("row").nth(1)).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("documentation.png"), fullPage: true });
});
