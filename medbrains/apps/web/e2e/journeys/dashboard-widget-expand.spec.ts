/**
 * Every data widget on the dashboard opens at full size: a chart with its
 * figures and the numbers behind it, a table with all its rows. Keyboard
 * first — the dialog is named, and Escape closes it.
 */
import { expect, test } from "./support/world";

test("a dashboard widget expands to its figures and data, and Escape closes it", async ({
  hospital,
}) => {
  const page = await hospital.asAdmin();
  await page.goto("/dashboard");
  const expanders = page.getByRole("button", { name: /^Expand / });
  await expect(expanders.first()).toBeVisible({ timeout: 15_000 });

  const chart = page.getByRole("button", { name: "Expand Revenue, last 30 days" });
  await chart.click();
  const dialog = page.getByRole("dialog", { name: "Revenue, last 30 days" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Latest", { exact: true })).toBeVisible();
  await expect(dialog.getByText(/from the point before/)).toBeVisible();
  await expect(dialog.getByRole("table")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await page.getByRole("button", { name: "Expand Recent Admissions" }).click();
  const table = page.getByRole("dialog", { name: "Recent Admissions" });
  await expect(table.getByLabel("Search these rows")).toBeVisible();
});
