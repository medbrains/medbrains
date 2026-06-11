import { expect, test, type Page } from "@playwright/test";
import { getE2EIdentity } from "../helpers/e2e-identities";
import { getAuthContextFromCookies } from "../helpers/api";
import { getOpdDept } from "../helpers/seed-resolvers";
import { loginAsRole, navigateTo, routeApiDirect } from "../helpers";
import { uniquePatient } from "../fixtures/patients";
import {
  expectCurrentFocusVisible,
  expectEnhancedTargetSizes,
  expectKeyboardFocusable,
  expectNamedInteractiveControls,
  expectWcag2AaaMachineChecks,
} from "../helpers/wcag";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function monitorCriticalUiFailures(page: Page): string[] {
  const failures: string[] = [];

  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !/favicon|Failed to load resource/i.test(message.text())) {
      failures.push(`console: ${message.text()}`);
    }
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.pathname.startsWith("/api/") && response.status() >= 500) {
      failures.push(`${response.status()} ${url.pathname}${url.search}`);
    }
  });

  return failures;
}

async function chooseOption(page: Page, label: string | RegExp, option: string | RegExp) {
  await page.getByLabel(label).click();
  await page.getByRole("option", { name: option }).click();
}

test.describe("WCAG 2 AAA UI journeys", () => {
  test.beforeEach(async ({ page }) => {
    await routeApiDirect(page);
  });

  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });

  test("front office can register a patient through keyboard-reachable UI", async ({
    page,
    request,
  }) => {
    const runtimeFailures = monitorCriticalUiFailures(page);
    const ctx = await getAuthContextFromCookies(request);
    const department = await getOpdDept(ctx);
    const patient = uniquePatient({
      firstName: `AaaFirst${Date.now()}`,
      lastName: "Keyboard",
    });

    await navigateTo(page, "/patients");
    await expect(page.locator('[data-testid="app-sidebar"]')).toBeVisible();
    await expect(page.locator("main")).toBeVisible();
    await expectNamedInteractiveControls(page);

    const registerButton = page.getByRole("button", { name: "Register Patient" });
    await expectKeyboardFocusable(registerButton, "Register Patient");
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/patients\/register(?:[?#].*)?$/);
    await expect(page.getByRole("heading", { name: "Register Patient" })).toBeVisible();
    await page.keyboard.press("Tab");
    await expectCurrentFocusVisible(page, "registration workspace first tab stop");

    await page.getByLabel("First Name").fill(patient.firstName);
    await page.getByLabel("Last Name").fill(patient.lastName);
    await page.getByLabel("Age years").fill("35");
    await chooseOption(page, "Gender", "Female");
    await page.getByLabel(/Phone \(primary\)/).fill(patient.phone);
    await chooseOption(
      page,
      "Department",
      new RegExp(`${escapeRegExp(department.name)}.*${escapeRegExp(department.code)}`),
    );

    const sendToOpd = page.getByLabel("Send to OPD queue");
    if (await sendToOpd.isChecked().catch(() => false)) {
      await sendToOpd.uncheck();
    }

    await chooseOption(page, "Allergy status", "No known allergies");
    await page.getByRole("button", { name: "Save now" }).click();

    await expect(page).toHaveURL(/\/patients\/[0-9a-f-]{36}(?:[?#].*)?$/, {
      timeout: 15_000,
    });
    await expect(page.getByRole("tab", { name: "Overview" })).toBeVisible();
    expect(runtimeFailures, "journey must not trigger console errors or API 5xx").toEqual([]);
  });

  test("patient directory and registration surfaces pass WCAG 2 AAA machine gates", async ({
    page,
  }) => {
    await navigateTo(page, "/patients");
    await expect(page.locator("main")).toBeVisible();
    await expectWcag2AaaMachineChecks(page, { include: "main" });
    await expectNamedInteractiveControls(page);
    await expectEnhancedTargetSizes(page);

    await page.getByRole("button", { name: "Register Patient" }).click();
    await expect(page).toHaveURL(/\/patients\/register(?:[?#].*)?$/);
    await expectWcag2AaaMachineChecks(page, { include: "main" });
    await expectNamedInteractiveControls(page);
    await expectEnhancedTargetSizes(page);
  });

  test("procurement vendor and purchase-order action surfaces pass WCAG 2 AAA gates", async ({
    page,
  }) => {
    const runtimeFailures = monitorCriticalUiFailures(page);
    const identity = getE2EIdentity("procurement_officer");
    const stamp = String(Date.now()).slice(-9);
    const vendorCode = `AAAV${stamp.slice(-6)}`;
    const vendorName = `AAA UI Vendor ${stamp}`;

    await loginAsRole(page, identity.username, identity.password);
    await navigateTo(page, "/procurement");
    await expect(page.getByRole("heading", { name: "Procurement" })).toBeVisible();
    await expectWcag2AaaMachineChecks(page, { include: "main" });
    await expectNamedInteractiveControls(page);
    await expectEnhancedTargetSizes(page);

    const addVendorButton = page.getByRole("button", { name: "Add Vendor" });
    await expectKeyboardFocusable(addVendorButton, "Add Vendor");
    await page.keyboard.press("Enter");

    const vendorDrawer = page.getByRole("dialog").filter({ hasText: "Register New Vendor" });
    await expect(vendorDrawer).toBeVisible();
    await expectNamedInteractiveControls(page, '[role="dialog"]');
    await vendorDrawer.getByLabel("Vendor Code").fill(vendorCode);
    await vendorDrawer.getByLabel("Name").fill(vendorName);
    await vendorDrawer.getByRole("button", { name: "Register Vendor" }).click();

    const vendorRow = page.locator("tr", { hasText: vendorCode });
    await expect(vendorRow).toContainText(vendorName, { timeout: 10_000 });
    await vendorRow.getByRole("button", { name: "View details" }).click();
    await expect(page.getByRole("dialog").filter({ hasText: "Vendor Details" })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("tab", { name: "Purchase Orders" }).click();
    const newPoButton = page.getByRole("button", { name: "New PO" });
    await expectKeyboardFocusable(newPoButton, "New PO");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog").filter({ hasText: "Create Purchase Order" })).toBeVisible();
    await expectNamedInteractiveControls(page, '[role="dialog"]');
    await expectEnhancedTargetSizes(page, '[role="dialog"]');
    expect(runtimeFailures, "journey must not trigger console errors or API 5xx").toEqual([]);
  });
});
