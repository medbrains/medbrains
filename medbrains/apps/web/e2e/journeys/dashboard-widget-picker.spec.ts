/**
 * A viewer chooses their dashboard's widgets from a menu of what their
 * access allows: a manager takes the mortality tile off and puts it back; a
 * nurse is never offered management KPIs.
 */
import { expect, test } from "./support/world";

test("a manager hides and restores a widget from the widget menu", async ({ hospital }) => {
  const page = await hospital.as("hospital_admin");
  await page.goto("/dashboard");
  const mortality = page.locator(".stat-card").filter({ hasText: "Mortality" });
  await expect(mortality).toBeVisible();

  await page.getByRole("button", { name: "Choose dashboard widgets" }).click();
  const menu = page.getByRole("dialog", { name: "Widgets" });
  const ipd = menu.getByRole("group", { name: "IPD" });
  const box = ipd.getByRole("checkbox", { name: "Mortality" });
  await expect(box).toBeChecked();

  await box.click();
  await expect(mortality).toHaveCount(0);
  await expect(box).not.toBeChecked();

  await box.click();
  await expect(mortality).toBeVisible();
  await expect(box).toBeChecked();
});

test("a nurse is offered only widgets her access allows", async ({ hospital }) => {
  const page = await hospital.as("nurse");
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Choose dashboard widgets" }).click();
  const menu = page.getByRole("dialog", { name: "Widgets" });
  await expect(menu.getByRole("checkbox").first()).toBeVisible();
  for (const area of ["Doctors' documentation", "Department efficiency"]) {
    await expect(menu.getByRole("group", { name: area })).toHaveCount(0);
  }
  await expect(menu.getByRole("checkbox", { name: "Mortality" })).toHaveCount(0);
});
