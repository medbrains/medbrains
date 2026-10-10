/**
 * An OPD tile narrows to one department from its own footer, the reading
 * comes back narrowed, and the choice is the reader's and survives a reload.
 */
import { expect, test } from "./support/world";

test("an OPD tile narrows to one department", async ({ hospital }) => {
  const page = await hospital.asAdmin();
  await page.goto("/dashboard");
  const dept = page.getByRole("button", { name: /^Department for Today.s OPD:/ });
  await expect(dept).toHaveAccessibleName(/All departments$/, { timeout: 15_000 });

  await dept.click();
  const narrowed = page.waitForRequest(
    (r) => r.url().endsWith("/api/dashboard/widget-data/batch") && Boolean(r.postDataJSON()?.filters),
  );
  await page.getByRole("menuitem", { name: "General Medicine", exact: true }).click();
  const body = (await narrowed).postDataJSON() as { filters: Record<string, { department_id?: string }> };
  expect(Object.values(body.filters).some((f) => Boolean(f.department_id))).toBe(true);
  await expect(dept).toHaveAccessibleName(/General Medicine$/);

  await page.reload();
  await expect(dept).toHaveAccessibleName(/General Medicine$/, { timeout: 15_000 });
  await dept.click();
  await page.getByRole("menuitem", { name: "All departments" }).click();
  await expect(dept).toHaveAccessibleName(/All departments$/);
});
