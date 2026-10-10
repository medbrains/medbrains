/**
 * A KPI tile is set against what its reader chooses — the usual weekday,
 * yesterday or the last seven days — on the tile itself, and that choice is
 * the tile's alone and survives a reload. Its expanded view follows it.
 */
import { expect, test } from "./support/world";

test("each KPI tile keeps its own comparison", async ({ hospital }) => {
  const page = await hospital.asAdmin();
  await page.goto("/dashboard");
  const opd = page.getByRole("button", { name: /^Compare Today.s OPD with/ });
  const patients = page.getByRole("button", { name: /^Compare New patients with/ });
  await expect(opd).toBeVisible({ timeout: 15_000 });

  await opd.click();
  await page.getByRole("menuitem", { name: "Last 7 days" }).click();
  await expect(opd).toHaveAccessibleName(/Last 7 days$/);
  await expect(patients).toHaveAccessibleName(/Usual weekday$/);

  await page.reload();
  await expect(opd).toHaveAccessibleName(/Last 7 days$/, { timeout: 15_000 });

  await page.getByRole("button", { name: "Expand Today's OPD" }).click();
  const dialog = page.getByRole("dialog", { name: "Today's OPD" });
  await expect(dialog.getByText(/than the last 7 days/)).toBeVisible();
  await dialog.getByRole("radiogroup", { name: "Compare with" }).getByText("Yesterday").click();
  await page.keyboard.press("Escape");
  await expect(opd).toHaveAccessibleName(/Yesterday$/);
});
