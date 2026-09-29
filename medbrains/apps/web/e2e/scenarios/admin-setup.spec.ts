import { test, expect, type Page } from "@playwright/test";
import { routeApiDirect, navigateTo } from "../helpers";

function uniqueSuffix(): string {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

async function createDepartment(page: Page, code: string, name: string) {
  await navigateTo(page, "/admin/settings#departments");
  await page.getByRole("button", { name: "Add Department" }).click();

  const createDialog = page.getByRole("dialog").filter({ hasText: "Add Department" });
  await expect(createDialog).toBeVisible();
  await createDialog.getByLabel("Code").fill(code);
  await createDialog.getByLabel("Name").fill(name);
  await createDialog.getByRole("button", { name: "Create" }).click();

  const row = page.locator("tr", { hasText: code });
  await expect(row).toBeVisible({ timeout: 10_000 });
  await expect(row).toContainText(name);
}

async function deleteDepartment(page: Page, code: string) {
  await navigateTo(page, "/admin/settings#departments");

  const row = page.locator("tr", { hasText: code });
  await expect(row).toBeVisible({ timeout: 10_000 });
  await row.locator("button").nth(1).click();

  const deleteDialog = page.getByRole("dialog").filter({ hasText: "Delete Department" });
  await expect(deleteDialog).toBeVisible();
  await deleteDialog.getByRole("button", { name: "Delete" }).click();

  await expect(page.locator("tr", { hasText: code })).toHaveCount(0, {
    timeout: 10_000,
  });
}

test.describe("Admin Setup Flow", () => {
  // Each walks several admin screens end to end (create → edit → delete).
  test.describe.configure({ timeout: 90_000 });

  test.beforeEach(async ({ page }) => {
    await routeApiDirect(page);
  });

  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });

  test("should create, update, and delete a department", async ({ page }) => {
    const suffix = uniqueSuffix();
    const code = `E2E${suffix.slice(-6)}`;
    const name = `E2E Department ${suffix}`;
    const updatedName = `${name} Updated`;

    await createDepartment(page, code, name);

    const row = page.locator("tr", { hasText: code });

    await row.locator("button").nth(0).click();

    const editDialog = page.getByRole("dialog").filter({ hasText: "Edit Department" });
    await expect(editDialog).toBeVisible();
    await expect(editDialog.getByLabel("Code")).toHaveValue(code);
    await editDialog.getByLabel("Name").fill(updatedName);
    await editDialog.getByRole("button", { name: "Save" }).click();

    await expect(row).toContainText(updatedName, { timeout: 10_000 });

    await deleteDepartment(page, code);
  });

  test("should create, update, and delete a doctor user with department assignment", async ({ page }) => {
    const suffix = uniqueSuffix();
    const departmentCode = `DOC${suffix.slice(-6)}`;
    const departmentName = `E2E Doctor Department ${suffix}`;
    const username = `e2e_${suffix}`;
    const fullName = `Dr. E2E User ${suffix}`;
    const updatedName = `${fullName} Updated`;
    const email = `${username}@example.com`;
    const password = `E2eUser#${suffix}Aa9`;

    await createDepartment(page, departmentCode, departmentName);

    await navigateTo(page, "/admin/users");

    await page.getByRole("button", { name: "Add User" }).click();

    const createDialog = page.getByRole("dialog").filter({ hasText: "Create user" });
    await expect(createDialog).toBeVisible();
    await createDialog.getByLabel("Username").fill(username);
    await createDialog.getByLabel("Full name").fill(fullName);
    await createDialog.getByLabel("Email").fill(email);
    await createDialog.getByRole("textbox", { name: "Password" }).fill(password);
    await createDialog.getByRole("button", { name: "Next" }).click();

    await createDialog.getByLabel("Role").click();
    await page.getByRole("option", { name: "Doctor" }).click();
    await expect(createDialog.getByLabel("Departments")).toBeVisible();
    await createDialog.getByLabel("Departments").fill(departmentName);
    await page.getByRole("option", { name: new RegExp(departmentName) }).click();
    // A multi-select may stay open for the next pick; click away to close it
    // (Escape would close the whole dialog if it already had).
    await createDialog.getByRole("heading", { name: "Create user" }).first().click();
    await createDialog.getByRole("button", { name: "Next" }).click();
    await createDialog.getByRole("button", { name: "Next" }).click();
    await createDialog.getByRole("button", { name: "Review" }).click();
    await createDialog.getByRole("button", { name: "Create user" }).click();

    await page.getByPlaceholder("Search name, username, email or role").fill(username);
    const row = page.locator("tr", { hasText: username });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row).toContainText(fullName);
    await expect(row).toContainText("doctor");

    await row.getByRole("button", { name: "Edit" }).click();

    const editDialog = page.getByRole("dialog").filter({ hasText: "Edit User" });
    await expect(editDialog).toBeVisible();
    await expect(editDialog.getByLabel("Username")).toHaveValue(username);
    await expect(editDialog.getByText(departmentName)).toBeVisible({ timeout: 10_000 });
    await editDialog.getByLabel("Full Name").fill(updatedName);
    await editDialog.getByRole("button", { name: "Save" }).click();

    await expect(row).toContainText(updatedName, { timeout: 10_000 });

    await row.getByRole("button", { name: "Delete" }).click();

    const deleteDialog = page.getByRole("dialog").filter({ hasText: "Delete User" });
    await expect(deleteDialog).toBeVisible();
    await deleteDialog.getByRole("button", { name: "Delete" }).click();

    await expect(page.locator("tr", { hasText: username })).toHaveCount(0, {
      timeout: 10_000,
    });

    await deleteDepartment(page, departmentCode);
  });

  test("should create a role, save permissions, and delete it", async ({ page }) => {
    const suffix = uniqueSuffix();
    const code = `e2e_role_${suffix}`;
    const name = `E2E Role ${suffix}`;

    await navigateTo(page, "/admin/roles");

    await page.getByRole("button", { name: "Add Role" }).click();

    const createDialog = page.getByRole("dialog").filter({ hasText: "Create Role" });
    await expect(createDialog).toBeVisible();
    await createDialog.getByLabel("Role Code").fill(code);
    await createDialog.getByLabel("Role Name").fill(name);
    await createDialog.getByLabel("Description").fill("E2E CRUD role");
    await createDialog.getByRole("button", { name: "Create" }).click();

    const row = page.locator("tr", { hasText: code });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row).toContainText(name);

    await row.locator("button").first().click();
    await page.getByRole("menuitem", { name: "Permissions" }).click();

    // Permissions are edited on the role's Access Matrix: Grant or Deny per
    // permission, saved as a whole.
    const listUsers = page.getByRole("radiogroup", { name: "List Users" });
    await expect(listUsers).toBeVisible({ timeout: 10_000 });
    await listUsers.getByText("Grant", { exact: true }).click();
    await page.getByRole("button", { name: "Save Matrix" }).click();
    await expect(listUsers.getByRole("radio", { name: "Grant" })).toBeChecked();

    // It held: a fresh load of the role shows the grant.
    await page.reload();
    await expect(page.getByRole("radiogroup", { name: "List Users" }).getByRole("radio", { name: "Grant" })).toBeChecked({
      timeout: 10_000,
    });

    await navigateTo(page, "/admin/roles");
    await row.locator("button").first().click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete role" }).click();

    await expect(page.locator("tr", { hasText: code })).toHaveCount(0, {
      timeout: 10_000,
    });
  });
});
