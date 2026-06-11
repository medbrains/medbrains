import { expect, test, type Page } from "@playwright/test";
import { getAuthContextFromCookies } from "../helpers/api";
import { getE2EIdentity } from "../helpers/e2e-identities";
import { getOpdDept } from "../helpers/seed-resolvers";
import { loginAsRole, navigateTo, routeApiDirect } from "../helpers";
import { uniquePatient } from "../fixtures/patients";
import { expectKeyboardFocusable } from "../helpers/wcag";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface RuntimeMonitorOptions {
  ignoredApiFailures?: RegExp[];
}

function monitorRuntimeFailures(page: Page, options: RuntimeMonitorOptions = {}): string[] {
  const failures: string[] = [];

  page.on("pageerror", (error) => {
    if (!/WebSocket closed without opened|vite-hmr/i.test(error.message)) {
      failures.push(`pageerror: ${error.message}`);
    }
  });
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !/favicon|Failed to load resource|vite-hmr|\[vite\]|WebSocket closed without opened/i.test(
        message.text(),
      )
    ) {
      failures.push(`console: ${message.text()}`);
    }
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    const apiPath = `${url.pathname}${url.search}`;
    if (
      url.pathname.startsWith("/api/") &&
      response.status() >= 400 &&
      !options.ignoredApiFailures?.some((pattern) => pattern.test(apiPath))
    ) {
      failures.push(`${response.status()} ${url.pathname}${url.search}`);
    }
  });

  return failures;
}

async function chooseOption(page: Page, label: string | RegExp, option: string | RegExp) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option }).click();
}

async function loginAndNavigate(page: Page, role: string, path: string) {
  const identity = getE2EIdentity(role);
  await loginAsRole(page, identity.username, identity.password);
  await navigateTo(page, path);
}

async function expectSidebarEntry(page: Page, label: string) {
  const sidebar = page.locator('[data-testid="app-sidebar"]');
  await expect(sidebar.getByText(label, { exact: true }).first()).toBeVisible({ timeout: 10_000 });
}

async function expectNoSidebarEntry(page: Page, label: string) {
  const sidebar = page.locator('[data-testid="app-sidebar"]');
  await expect(sidebar.getByText(label, { exact: true })).toHaveCount(0);
}

async function expectDirectRouteDenied(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await expect(page).toHaveURL(/\/apps(?:[?#].*)?$/, { timeout: 10_000 });
}

async function selectWorkspace(page: Page, label: string) {
  await page.getByRole("button", { name: "Select app" }).click();
  await page.getByRole("menuitem", { name: new RegExp(`^${escapeRegExp(label)}\\b`) }).click();
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
}

test.describe("UI journeys and action surfaces", () => {
  test.beforeEach(async ({ page }) => {
    await routeApiDirect(page);
  });

  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });

  test("front office registers a patient from the directory into the profile workspace", async ({
    page,
    request,
  }) => {
    const runtimeFailures = monitorRuntimeFailures(page);
    const ctx = await getAuthContextFromCookies(request);
    const department = await getOpdDept(ctx);
    const patient = uniquePatient({
      firstName: `UiFirst${Date.now()}`,
      lastName: "Journey",
    });

    await navigateTo(page, "/patients");
    await expect(page.locator('[data-testid="app-sidebar"]')).toBeVisible();
    await expect(page.getByRole("heading", { name: "Patients" })).toBeVisible();
    await expect(page.getByPlaceholder("Search by UHID, name, or phone...")).toBeVisible();

    const registerButton = page.getByRole("button", { name: "Register Patient" }).first();
    await expectKeyboardFocusable(registerButton, "Register Patient");
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/patients\/register(?:[?#].*)?$/);
    await expect(page.getByRole("heading", { name: "Register Patient" })).toBeVisible();
    await expect(page.getByText("Intake checklist")).toBeVisible();

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
    const duplicateDialog = page.getByRole("dialog", { name: "Potential Duplicates Found" });
    if (
      await duplicateDialog
        .waitFor({ state: "visible", timeout: 5_000 })
        .then(() => true)
        .catch(() => false)
    ) {
      await duplicateDialog.getByRole("button", { name: "Create Anyway" }).click();
      await expect(duplicateDialog).toBeHidden({ timeout: 10_000 });
    }
    await expect(page).toHaveURL(/\/patients\/[0-9a-f-]{36}(?:[?#].*)?$/, {
      timeout: 15_000,
    });
    await expect(page.getByRole("tab", { name: "Overview" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: `${patient.firstName} ${patient.lastName}` }),
    ).toBeVisible();
    expect(runtimeFailures, "journey must not trigger console errors or API 4xx/5xx").toEqual([]);
  });

  test("procurement officer reaches vendor and purchase-order action drawers", async ({ page }) => {
    const runtimeFailures = monitorRuntimeFailures(page);
    const stamp = String(Date.now()).slice(-9);
    const vendorCode = `UIV${stamp.slice(-6)}`;
    const vendorName = `UI Journey Vendor ${stamp}`;

    await loginAndNavigate(page, "procurement_officer", "/procurement");
    await expect(page.getByRole("heading", { name: "Procurement" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Vendors" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Purchase Orders" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "GRN" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Supplier Payments" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Vendor Performance" })).toBeVisible();

    const addVendorButton = page.getByRole("button", { name: "Add Vendor" });
    await expectKeyboardFocusable(addVendorButton, "Add Vendor");
    await page.keyboard.press("Enter");

    const vendorDrawer = page.getByRole("dialog").filter({ hasText: "Register New Vendor" });
    await expect(vendorDrawer).toBeVisible();
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
    expect(runtimeFailures, "journey must not trigger console errors or API 4xx/5xx").toEqual([]);
  });

  test("store keeper uses the same procurement screen for receiving and stock review only", async ({
    page,
  }) => {
    const runtimeFailures = monitorRuntimeFailures(page);

    await loginAndNavigate(page, "store_keeper", "/dashboard");
    await selectWorkspace(page, "Operations");
    await expectSidebarEntry(page, "Procurement");
    await navigateTo(page, "/procurement");

    await expect(page.getByRole("heading", { name: "Procurement" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Purchase Orders" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "GRN" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Batch Stock" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Store Locations" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Vendors" })).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "Supplier Payments" })).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "Vendor Performance" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add Vendor" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "New PO" })).toHaveCount(0);

    await page.getByRole("tab", { name: "GRN" }).click();
    const newGrnButton = page.getByRole("button", { name: "New GRN" });
    await expectKeyboardFocusable(newGrnButton, "New GRN");
    await page.keyboard.press("Enter");
    const grnDrawer = page.getByRole("dialog").filter({ hasText: "Create GRN" });
    await expect(grnDrawer).toBeVisible();
    await grnDrawer.getByRole("button", { name: "Create GRN", exact: true }).click();
    await expect(grnDrawer.getByRole("combobox", { name: "Purchase Order" })).toBeVisible();
    await grnDrawer.getByRole("button", { name: "Close Create GRN" }).click();
    await expect(grnDrawer).toBeHidden();

    await page.getByRole("tab", { name: "Store Locations" }).click();
    await expect(page.getByRole("button", { name: "Add Location" })).toHaveCount(0);
    expect(runtimeFailures, "store keeper procurement journey must not trigger API 4xx/5xx").toEqual(
      [],
    );
  });

  test("lab technician is blocked from the procurement screen and navigation", async ({ page }) => {
    await loginAndNavigate(page, "lab_technician", "/dashboard");
    await expectNoSidebarEntry(page, "Procurement");
    await expectDirectRouteDenied(page, "/procurement");
  });

  const patientDirectoryCases = [
    { role: "receptionist", canRegister: true },
    { role: "doctor", canRegister: true },
    { role: "nurse", canRegister: false },
    { role: "audit_officer", canRegister: false },
    { role: "mrd_officer", canRegister: false },
  ];

  for (const c of patientDirectoryCases) {
    test(`${c.role} patient directory journey reflects registration permission`, async ({ page }) => {
      const runtimeFailures = monitorRuntimeFailures(page);

      await loginAndNavigate(page, c.role, "/patients");
      await expect(page.getByRole("heading", { name: "Patients", exact: true })).toBeVisible();
      await expect(page.getByPlaceholder("Search by UHID, name, or phone...")).toBeVisible();

      const registerButton = page.getByRole("button", { name: "Register Patient" }).first();
      if (c.canRegister) {
        await expectKeyboardFocusable(registerButton, "Register Patient");
      } else {
        await expect(registerButton).toHaveCount(0);
      }
      expect(runtimeFailures, `${c.role} patient directory must not trigger API 4xx/5xx`).toEqual(
        [],
      );
    });
  }

  test("security guard uses the same front-office screen for visitor/pass review only", async ({
    page,
  }) => {
    const runtimeFailures = monitorRuntimeFailures(page);

    await loginAndNavigate(page, "security_guard", "/dashboard");
    await selectWorkspace(page, "Operations");
    await expectSidebarEntry(page, "Front Office");
    await navigateTo(page, "/front-office");

    await expect(page.getByRole("heading", { name: "Front Office" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Visitor Management" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Visitor Analytics" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Patient Flow" })).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "Queue Dashboard" })).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "Queue Configuration" })).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "Queue Metrics" })).toHaveCount(0);
    await page.getByRole("tab", { name: "Visitor Management" }).click();
    await expect(page.getByText("Visitor Registrations")).toBeVisible();
    await expect(page.getByText(/Visitor Passes/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Register Visitor" })).toHaveCount(0);
    expect(runtimeFailures, "security front-office journey must not trigger API 4xx/5xx").toEqual(
      [],
    );
  });

  test("front office staff can open visitor registration on the shared front-office screen", async ({
    page,
  }) => {
    const runtimeFailures = monitorRuntimeFailures(page);

    await loginAndNavigate(page, "front_office_staff", "/front-office");
    await expect(page.getByRole("heading", { name: "Front Office" })).toBeVisible();
    await page.getByRole("tab", { name: "Visitor Management" }).click();
    const registerVisitor = page.getByRole("button", { name: "Register Visitor" });
    await expectKeyboardFocusable(registerVisitor, "Register Visitor");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog").filter({ hasText: "Register Visitor" })).toBeVisible();
    expect(runtimeFailures, "front-office staff journey must not trigger API 4xx/5xx").toEqual([]);
  });

  const roleWorkspaceCases = [
    { role: "lab_technician", workspace: "LIMS", navLabel: "Lab", path: "/lab" },
    { role: "pharmacist", workspace: "Pharmacy", navLabel: "Pharmacy", path: "/pharmacy" },
    { role: "billing_clerk", workspace: "Finance", navLabel: "Billing", path: "/billing" },
    {
      role: "procurement_officer",
      workspace: "Operations",
      navLabel: "Procurement",
      path: "/procurement",
    },
    { role: "store_keeper", workspace: "Operations", navLabel: "Indent & Store", path: "/indent" },
    { role: "nurse", workspace: "HIMS", navLabel: "Nurse Activities", path: "/nurse" },
    {
      role: "front_office_staff",
      workspace: "Operations",
      navLabel: "Front Office",
      path: "/front-office",
    },
    { role: "security_guard", workspace: "Operations", navLabel: "Security", path: "/security" },
    {
      role: "canteen_staff",
      workspace: "HIMS",
      navLabel: "Diet & Kitchen",
      path: "/diet-kitchen",
    },
    { role: "dietitian", workspace: "HIMS", navLabel: "Diet & Kitchen", path: "/diet-kitchen" },
    {
      role: "ambulance_driver",
      workspace: "Operations",
      navLabel: "Ambulance",
      path: "/ambulance",
    },
    { role: "radiology_tech", workspace: "PACS", navLabel: "Radiology", path: "/radiology" },
    { role: "cssd_technician", workspace: "Operations", navLabel: "CSSD", path: "/cssd" },
    { role: "blood_bank_tech", workspace: "LIMS", navLabel: "Blood Bank", path: "/blood-bank" },
    {
      role: "mrd_officer",
      workspace: "Operations",
      navLabel: "Medical Records",
      path: "/mrd",
    },
    { role: "audit_officer", workspace: "Compliance", navLabel: "Audit Trail", path: "/audit" },
    {
      role: "infection_control_officer",
      workspace: "Compliance",
      navLabel: "Infection Control",
      path: "/infection-control",
    },
    {
      role: "biomed_engineer",
      workspace: "Operations",
      navLabel: "Biomedical Engineering",
      path: "/bme",
    },
    { role: "hr_officer", workspace: "Operations", navLabel: "HR & Staffing", path: "/hr" },
    {
      role: "camp_coordinator",
      workspace: "Operations",
      navLabel: "Camp Management",
      path: "/camp",
    },
    {
      role: "insurance_officer",
      workspace: "Finance",
      navLabel: "Insurance & TPA",
      path: "/insurance",
    },
    { role: "ot_staff", workspace: "HIMS", navLabel: "Operation Theatre", path: "/ot" },
  ];

  for (const c of roleWorkspaceCases) {
    test(`${c.role} can reach ${c.navLabel} workspace and see actionable UI`, async ({ page }) => {
      const runtimeFailures = monitorRuntimeFailures(page, {
        ignoredApiFailures: [/^\/api\/patients\/[0-9a-f-]{36}$/],
      });
      await loginAndNavigate(page, c.role, "/dashboard");
      await selectWorkspace(page, c.workspace);

      const sidebar = page.locator('[data-testid="app-sidebar"]');
      const link = sidebar.getByText(c.navLabel, { exact: true }).first();
      await expect(link).toBeVisible({ timeout: 10_000 });
      await link.click();

      await expect(page).toHaveURL(new RegExp(`${escapeRegExp(c.path)}(?:[?#].*)?$`));
      const pageContent = page.locator(".page-content");
      await expect(pageContent).toBeVisible();
      await expect(pageContent).not.toBeEmpty({ timeout: 10_000 });

      const actionCount =
        (await page.locator("main").getByRole("button").count()) +
        (await page.locator("main").getByRole("tab").count());
      expect(actionCount, `${c.navLabel} workspace should expose buttons or tabs`).toBeGreaterThan(0);
      expect(runtimeFailures, "workspace must not trigger console errors or API 4xx/5xx").toEqual([]);
    });
  }
});
