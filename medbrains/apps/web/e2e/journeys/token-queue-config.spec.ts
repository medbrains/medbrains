/**
 * Admin → Queues (RFCs/modules/RFC-MODULE-token-queues.md, P1a).
 *
 * An administrator sets a queue up the way a hospital asks for it — its own
 * prefix, a first number, a daily limit — sees the first slip before saving,
 * and the queue then numbers, fills and pauses as configured. A receptionist
 * can see why a queue is paused or full but cannot change it.
 */
import { expect, test } from "@playwright/test";
import { loginAsRole, navigateTo, routeApiDirect } from "../helpers";
import { type AuthContext, api, getAuthContextFromCookies } from "../helpers/api";
import { getE2EIdentity } from "../helpers/e2e-identities";

async function ownDepartment(ctx: AuthContext): Promise<{ id: string; name: string }> {
  const suffix = crypto.randomUUID().slice(0, 8).toUpperCase();
  const name = `Queue setup ${suffix}`;
  const dept = await api<{ id: string }>(ctx, "POST", "/api/setup/departments", {
    code: `QS${suffix}`,
    name,
    department_type: "clinical",
  });
  return { id: dept.id, name };
}

async function issue(ctx: AuthContext, departmentId: string) {
  return api<{ number: string }>(ctx, "POST", "/api/tokens/issue", {
    module: "opd",
    scope: "department",
    scope_id: departmentId,
  });
}

test("an administrator sets up a queue and it numbers, fills and pauses as set", async ({
  page,
  request,
}) => {
  const ctx = await getAuthContextFromCookies(request);
  const dept = await ownDepartment(ctx);
  const name = `OPD ${dept.name}`;
  await routeApiDirect(page);
  await page.goto("/admin/queues");

  await page.getByRole("button", { name: "New queue" }).click();
  const drawer = page.getByRole("dialog", { name: "New queue" });
  await drawer.getByLabel("Name").fill(name);
  await drawer.getByRole("combobox", { name: "Place it serves" }).click();
  await drawer.getByRole("combobox", { name: "Place it serves" }).fill(dept.name);
  await page.getByRole("option", { name: new RegExp(dept.name) }).click();
  await drawer.getByLabel("Prefix").fill("gen");
  await drawer.getByLabel("First number").fill("100");
  await drawer.getByLabel("Most tokens a day").fill("2");
  // The first slip, before anything is saved.
  await expect(drawer.getByTestId("queue-number-preview")).toHaveText("GEN-100");
  await drawer.getByRole("button", { name: "Create queue" }).click();

  const row = page.getByRole("row", { name: new RegExp(name) });
  await expect(row).toContainText("GEN-100 · restarts daily");
  await expect(row).toContainText("0 of 2");

  // The desk issues as usual; the queue numbers and fills as configured.
  expect((await issue(ctx, dept.id)).number).toBe("GEN-100");
  expect((await issue(ctx, dept.id)).number).toBe("GEN-101");
  await page.reload();
  await expect(page.getByRole("row", { name: new RegExp(name) })).toContainText("2 of 2");

  await page.getByRole("row", { name: new RegExp(name) }).getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("row", { name: new RegExp(name) })).toContainText("Paused");
});

test("a receptionist sees the queues but cannot change them", async ({ page }) => {
  await routeApiDirect(page);
  const receptionist = getE2EIdentity("receptionist");
  await loginAsRole(page, receptionist.username, receptionist.password);
  await navigateTo(page, "/admin/queues");
  await expect(page.getByRole("heading", { name: "Queues" })).toBeVisible();
  await expect(page.getByRole("button", { name: "New queue" })).toHaveCount(0);
  await expect(page.getByText("Only a hospital administrator can change queues.")).toBeVisible();
});

test("an administrator gives a queue its own lanes, and the desk calls by them", async ({
  page,
  request,
}) => {
  const ctx = await getAuthContextFromCookies(request);
  const dept = await ownDepartment(ctx);
  const name = `Lanes ${dept.name}`;
  await api(ctx, "POST", "/api/queues", {
    name, module: "opd", scope: "department", scope_id: dept.id, prefix: "L", start_at: 1,
    pad_width: 3, reset_rule: "daily", max_tokens_per_period: null, lifecycle: "permanent",
    valid_from: null, valid_until: null, status: "active",
  });
  await routeApiDirect(page);
  await page.goto("/admin/queues");
  await page.getByRole("row", { name: new RegExp(name) }).getByRole("button", { name: "Lanes" }).click();
  const drawer = page.getByRole("dialog", { name: new RegExp(`Lanes — ${name}`) });
  await expect(drawer.getByText("always called first")).toBeVisible();
  await drawer.getByRole("button", { name: "Customise" }).click();

  // A senior citizen cannot be put behind ordinary patients.
  await drawer.getByRole("combobox", { name: "Called" }).first().click();
  await page.getByRole("option", { name: "7th" }).click();
  await drawer.getByRole("button", { name: "Save lanes" }).click();
  await expect(page.getByText("cannot be called after ordinary patients")).toBeVisible();
  await drawer.getByRole("combobox", { name: "Called" }).first().click();
  await page.getByRole("option", { name: "1st" }).click();

  // A staff lane, called first.
  await drawer.getByRole("button", { name: "Add lane" }).click();
  await drawer.getByLabel("Name").last().fill("Staff");
  await drawer.getByRole("combobox", { name: "Called" }).last().click();
  await page.getByRole("option", { name: "1st" }).click();
  await drawer.getByRole("button", { name: "Save lanes" }).click();
  await expect(page.getByText("Lanes saved")).toBeVisible();

  // At the desk: an ordinary patient came first, a staff member after.
  for (const priority of ["normal", "staff"]) {
    await api(ctx, "POST", "/api/tokens/issue", {
      module: "opd", scope: "department", scope_id: dept.id, priority,
    });
  }
  await page.goto("/token-console");
  const department = page.getByPlaceholder("All departments");
  await department.click();
  await department.fill(dept.name);
  await page.getByRole("option", { name: dept.name, exact: true }).click();
  await expect(page.getByRole("row", { name: /L-002/ })).toContainText("Staff");
  await page.getByRole("button", { name: "Call next" }).click();
  await expect(page.getByRole("row", { name: /L-002/ })).toContainText("Called");
  await expect(page.getByRole("row", { name: /L-001/ })).toContainText("Waiting");
});
