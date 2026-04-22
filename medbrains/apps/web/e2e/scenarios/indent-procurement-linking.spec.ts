import { test, expect, type Page } from "@playwright/test";
import { navigateTo, routeApiDirect } from "../helpers";

function uniqueSuffix(): string {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

async function waitForApiResponse<T>(
  page: Page,
  path: string,
  method: string,
  action: () => Promise<void>,
): Promise<T> {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes(path) &&
      response.request().method() === method,
  );

  await action();

  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as T;
}

async function createDepartment(page: Page, code: string, name: string) {
  await navigateTo(page, "/admin/settings#departments");
  await page.getByRole("button", { name: "Add Department" }).click();

  const dialog = page.getByRole("dialog").filter({ hasText: "Add Department" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Code").fill(code);
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByRole("button", { name: "Create" }).click();

  await expect(page.locator("tr", { hasText: code })).toContainText(name, {
    timeout: 10_000,
  });
}

async function createCatalogItem(page: Page, code: string, name: string) {
  await navigateTo(page, "/indent");
  await page.getByRole("tab", { name: "Store Catalog" }).click();
  await page.getByRole("button", { name: "Add Item" }).click();

  const drawer = page.getByRole("dialog").filter({ hasText: "Add Catalog Item" });
  await expect(drawer).toBeVisible();
  await drawer.getByLabel("Code").fill(code);
  await drawer.getByLabel("Name").fill(name);
  await drawer.getByLabel("Category").fill("E2E");
  await drawer.getByLabel("Unit").fill("unit");
  await drawer.getByLabel("Base Price").fill("250");
  await drawer.getByLabel("Reorder Level").fill("5");
  await drawer.getByRole("button", { name: "Create" }).click();

  await expect(page.locator("tr", { hasText: code })).toContainText(name, {
    timeout: 10_000,
  });
}

async function createVendor(page: Page, code: string, name: string) {
  await navigateTo(page, "/procurement");
  await page.getByRole("button", { name: "Add Vendor" }).click();

  const drawer = page.getByRole("dialog").filter({ hasText: "Register New Vendor" });
  await expect(drawer).toBeVisible();
  await drawer.getByLabel("Vendor Code").fill(code);
  await drawer.getByLabel("Name").fill(name);
  await drawer.getByRole("button", { name: "Register Vendor" }).click();

  await expect(page.locator("tr", { hasText: code })).toContainText(name, {
    timeout: 10_000,
  });
}

test.describe("Indent Workflow and Procurement Sidecar", () => {
  test.beforeEach(async ({ page }) => {
    await routeApiDirect(page);
  });

  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });

  test("should link an approved indent into procurement and surface it in the flow sidecar", async ({ page }) => {
    const suffix = uniqueSuffix();
    const departmentCode = `IND${suffix.slice(-6)}`;
    const departmentName = `Indent E2E Department ${suffix}`;
    const catalogCode = `CAT${suffix.slice(-6)}`;
    const catalogName = `Indent Linked Item ${suffix}`;
    const vendorCode = `VEN${suffix.slice(-6)}`;
    const vendorName = `Indent Linked Vendor ${suffix}`;

    await createDepartment(page, departmentCode, departmentName);
    await createCatalogItem(page, catalogCode, catalogName);
    await createVendor(page, vendorCode, vendorName);

    await navigateTo(page, "/indent");
    await page.getByRole("button", { name: "New Indent" }).click();
    await expect(page.getByText("Create New Indent")).toBeVisible();

    await page.getByLabel("Department").click();
    await page.getByRole("option", { name: departmentName }).click();
    await page.getByLabel("Priority").click();
    await page.getByRole("option", { name: "Urgent" }).click();
    await page.getByPlaceholder("From catalog").click();
    await page.getByRole("option", { name: new RegExp(catalogCode) }).click();

    const createdIndent = await waitForApiResponse<{
      requisition: { id: string; indent_number: string };
    }>(page, "/api/indent/requisitions", "POST", async () => {
      await page.getByRole("button", { name: "Create Indent" }).click();
    });

    const indentId = createdIndent.requisition.id;
    const indentNumber = createdIndent.requisition.indent_number;
    const indentRow = page.locator("tr", { hasText: indentNumber });

    await expect(indentRow).toBeVisible({ timeout: 10_000 });
    await indentRow.locator("button").first().click();

    const indentDrawer = page.getByRole("dialog").filter({ hasText: "Indent Details" });
    await expect(indentDrawer).toBeVisible();
    await expect(indentDrawer).toContainText(catalogName);

    await waitForApiResponse(page, `/api/indent/requisitions/${indentId}/submit`, "PUT", async () => {
      await indentDrawer.getByRole("button", { name: "Submit" }).click();
    });

    await expect(indentDrawer.getByText(/submitted/i)).toBeVisible({ timeout: 10_000 });
    await expect(indentDrawer.getByRole("button", { name: "Approve" })).toBeVisible({
      timeout: 10_000,
    });

    await indentDrawer.getByRole("button", { name: "Approve" }).click();
    const approveDrawer = page
      .getByRole("dialog")
      .filter({ hasText: "Approve Indent Items" });
    await expect(approveDrawer).toBeVisible();

    await waitForApiResponse(page, `/api/indent/requisitions/${indentId}/approve`, "PUT", async () => {
      await approveDrawer.getByRole("button", { name: "Confirm Approval" }).click();
    });

    await expect(indentDrawer.getByText(/approved/i)).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press("Escape");

    await navigateTo(page, "/procurement");
    await page.getByRole("tab", { name: "Purchase Orders" }).click();
    await page.getByRole("button", { name: "New PO" }).click();

    const poDrawer = page
      .getByRole("dialog")
      .filter({ hasText: "Create Purchase Order" });
    await expect(poDrawer).toBeVisible();

    await poDrawer.getByLabel("Vendor").click();
    await page.getByRole("option", { name: new RegExp(vendorCode) }).click();
    await poDrawer.getByLabel("Linked Indent").click();
    await page.getByRole("option", { name: new RegExp(indentNumber) }).click();

    await expect(poDrawer.getByText(/linked back to the indent requisition/i)).toBeVisible({
      timeout: 10_000,
    });
    await expect(poDrawer.locator("table")).toContainText(catalogName);

    const createdPo = await waitForApiResponse<{
      purchase_order: { id: string; po_number: string };
    }>(page, "/api/procurement/purchase-orders", "POST", async () => {
      await poDrawer.getByRole("button", { name: "Create PO" }).click();
    });

    const poNumber = createdPo.purchase_order.po_number;
    const poRow = page.locator("tr", { hasText: poNumber });
    await expect(poRow).toBeVisible({ timeout: 10_000 });
    await poRow.locator("button").first().click();

    const poDetailDrawer = page
      .getByRole("dialog")
      .filter({ hasText: "Purchase Order Details" });
    await expect(poDetailDrawer).toBeVisible();
    await expect(poDetailDrawer).toContainText("Linked Indent:");
    await expect(poDetailDrawer).toContainText(indentNumber);

    await page.keyboard.press("Escape");

    await navigateTo(page, "/indent");
    await page.getByRole("tab", { name: "Flow Tracker" }).click();
    await page
      .getByPlaceholder("Search by indent number...")
      .fill(indentNumber);
    await page.locator("tr", { hasText: indentNumber }).click();

    await expect(page.getByText("Workflow Sidecar")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Downstream Procurement")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(poNumber)).toBeVisible({ timeout: 10_000 });
  });
});
