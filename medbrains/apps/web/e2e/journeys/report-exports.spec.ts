/**
 * A report's export menu does what it says: CSV and Excel files of the rows
 * on screen, named for the report and the day. Items that would only pretend
 * — scheduling, email — are not offered.
 */
import { readFileSync } from "node:fs";
import { expect, test } from "./support/world";

const REPORT = "Occupancy and queue pressure";

test("a report exports its rows as CSV and Excel", async ({ hospital }) => {
  const page = await hospital.asAdmin();
  await page.goto("/reports");
  const actions = page.getByRole("button", { name: `${REPORT} actions` });
  await expect(actions).toBeVisible({ timeout: 20_000 });

  await actions.click();
  await expect(page.getByRole("menuitem", { name: "Email now" })).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: "Schedule report" })).toHaveCount(0);
  const csvDownload = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Download CSV" }).click();
  const csv = await csvDownload;
  expect(csv.suggestedFilename()).toMatch(/^occupancy-and-queue-pressure-\d{4}-\d{2}-\d{2}\.csv$/);
  const body = readFileSync(await csv.path(), "utf8");
  expect(body.split("\r\n")[0]).toMatch(/Ward/);
  expect(body.split("\r\n").length).toBeGreaterThan(2);

  await actions.click();
  const xlsxDownload = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Download Excel" }).click();
  const xlsx = await xlsxDownload;
  expect(xlsx.suggestedFilename()).toMatch(/\.xlsx$/);
  // An .xlsx is a zip: it starts "PK".
  expect(readFileSync(await xlsx.path()).subarray(0, 2).toString()).toBe("PK");

  await actions.click();
  const pngDownload = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Save chart image" }).click();
  const png = await pngDownload;
  expect(png.suggestedFilename()).toMatch(/\.png$/);
  expect(readFileSync(await png.path()).subarray(1, 4).toString()).toBe("PNG");
});
