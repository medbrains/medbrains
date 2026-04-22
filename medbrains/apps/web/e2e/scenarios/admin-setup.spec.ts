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

    await createDepartment(page, departmentCode, departmentName);

    await navigateTo(page, "/admin/users");

    await page.getByRole("button", { name: "Add User" }).click();

    const createDialog = page.getByRole("dialog").filter({ hasText: "Add User" });
    await expect(createDialog).toBeVisible();
    await createDialog.getByLabel("Full Name").fill(fullName);
    await createDialog.getByLabel("Username").fill(username);
    await createDialog.getByLabel("Email").fill(email);
    await createDialog.getByLabel("Password").fill("admin123");
    await createDialog.getByLabel("Role").click();
    await page.getByRole("option", { name: "Doctor" }).click();
    await expect(createDialog.getByLabel("Departments")).toBeVisible();
    await createDialog.getByLabel("Departments").click();
    await page.getByRole("option", { name: new RegExp(departmentName) }).click();
    await createDialog.getByRole("button", { name: "Create" }).click();

    const row = page.locator("tr", { hasText: username });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row).toContainText(fullName);
    await expect(row).toContainText("doctor");

    await row.locator("button").nth(0).click();

    const editDialog = page.getByRole("dialog").filter({ hasText: "Edit User" });
    await expect(editDialog).toBeVisible();
    await expect(editDialog.getByLabel("Username")).toHaveValue(username);
    await expect(editDialog.getByText(departmentName)).toBeVisible({ timeout: 10_000 });
    await editDialog.getByLabel("Full Name").fill(updatedName);
    await editDialog.getByRole("button", { name: "Save" }).click();

    await expect(row).toContainText(updatedName, { timeout: 10_000 });

    await row.locator("button").nth(2).click();

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

    const permissionCheckbox = page.getByRole("checkbox", { name: /List Users/i });
    await expect(permissionCheckbox).toBeVisible({ timeout: 10_000 });
    await permissionCheckbox.check();

    const saveButton = page.getByRole("button", { name: "Save Permissions" });
    await expect(saveButton).toBeVisible({
      timeout: 10_000,
    });
    await saveButton.click();
    await expect(page.getByText(name)).toBeVisible();

    await row.locator("button").first().click();
    await page.getByRole("menuitem", { name: "Permissions" }).click();
    await expect(permissionCheckbox).toBeChecked({ timeout: 10_000 });
    await page.keyboard.press("Escape");

    await row.locator("button").first().click();
    await page.getByRole("menuitem", { name: "Delete" }).click();

    await expect(page.locator("tr", { hasText: code })).toHaveCount(0, {
      timeout: 10_000,
    });
  });
});
