/**
 * The app-scoped side panel against a mocked API: inside an app the panel lists that app's
 * screens only, names the app and leads back to every app; a core screen gets the core panel.
 * Screenshots land in APP_PANEL_SHOTS_DIR when set (the PR's pictures), light and dark.
 */
import { expect, type Page, test } from "@playwright/test";
import { installMockApi, seedMockSession } from "./mockApi";

interface Viewer {
  role: string;
  permissions: string[];
}

const PHARMACIST: Viewer = {
  role: "pharmacist",
  permissions: [
    "dashboard.view",
    "pharmacy.prescriptions.list",
    "pharmacy.h1_register.view",
    "pharmacy.quarantine.manage",
    "pharmacy.fulfilment.pick",
    "pharmacy.deliveries.view",
    "pharmacy_finance.cash_drawer.view",
  ],
};
const LAB_TECH: Viewer = {
  role: "lab_technician",
  permissions: ["dashboard.view", "lab.orders.list", "lab.reports.view"],
};
const DOCTOR: Viewer = {
  role: "doctor",
  permissions: [
    "dashboard.view",
    "patients.list",
    "opd.queue.list",
    "opd.appointment.list",
    "doctor.signoffs.view_own",
    "doctor_payouts.self.view",
  ],
};
const ADMIN: Viewer = { role: "super_admin", permissions: [] };

/** Mocks the API, signs `viewer` in, and opens `path` in the `scheme` colour scheme. */
async function openAs(page: Page, viewer: Viewer, path: string, scheme: "light" | "dark") {
  const user = {
    id: "11111111-1111-1111-1111-111111111111",
    tenant_id: "22222222-2222-2222-2222-222222222222",
    username: `mock.${viewer.role}`,
    email: `mock.${viewer.role}@medbrains.local`,
    full_name: `Mock ${viewer.role.replace("_", " ")}`,
    ...viewer,
    field_access: {},
    disabled_modules: [],
  };
  await installMockApi(page);
  await page.route("**/api/auth/me", (route) => route.fulfill({ json: user }));
  await page.route("**/api/users/me/launcher", (route) =>
    route.fulfill({
      json: {
        favourites: ["/opd/appointments"],
        bricks: [
          { id: "billing", name: "Billing & Finance" },
          { id: "opd", name: "OPD / Outpatient" },
          { id: "registration", name: "Patient Registration" },
        ],
      },
    }),
  );
  await page.route("**/api/users/me/work", (route) => route.fulfill({ json: { items: [] } }));
  await page.addInitScript((value) => localStorage.setItem("mantine-color-scheme-value", value), scheme);
  await seedMockSession(page);
  await page.evaluate(
    (u) => localStorage.setItem("auth-storage", JSON.stringify({ state: { user: u }, version: 0 })),
    user,
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(path);
}

/** Saves the viewport when APP_PANEL_SHOTS_DIR is set. */
async function shot(page: Page, name: string) {
  const dir = process.env.APP_PANEL_SHOTS_DIR;
  if (!dir) return;
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${dir}/${name}.png`, animations: "disabled" });
}

for (const scheme of ["light", "dark"] as const) {
  test(`inside Pharmacy the panel lists Pharmacy only (${scheme})`, async ({ page }) => {
    await openAs(page, PHARMACIST, "/pharmacy", scheme);
    const panel = page.getByTestId("app-sidebar");
    await expect(panel.getByRole("heading", { name: "Pharmacy" })).toBeVisible();
    await expect(panel.getByRole("link", { name: "All apps" })).toHaveAttribute("href", "/home");
    await expect(panel.getByRole("link", { name: "H1 register" })).toBeVisible();
    await expect(panel.getByRole("link", { name: "Dashboard" })).toHaveCount(0);
    await expect(panel.getByRole("link", { name: "NPPA ceilings" })).toHaveCount(0);
    await shot(page, `pharmacy-${scheme}`);
  });

  test(`inside Lab the panel lists Lab only (${scheme})`, async ({ page }) => {
    await openAs(page, LAB_TECH, "/lab", scheme);
    const panel = page.getByTestId("app-sidebar");
    await expect(panel.getByRole("heading", { name: "Laboratory (LIS)" })).toBeVisible();
    await expect(panel.getByRole("link", { name: "Pharmacy" })).toHaveCount(0);
    await shot(page, `lab-${scheme}`);
  });

  test(`a core admin screen gets the core panel (${scheme})`, async ({ page }) => {
    await openAs(page, ADMIN, "/admin/users", scheme);
    const panel = page.getByTestId("app-sidebar");
    await expect(panel.getByRole("heading", { name: "Core" })).toBeVisible();
    await expect(panel.locator("a[href=\"/dashboard\"]")).toBeVisible();
    await expect(panel.getByRole("link", { name: "Pharmacy" })).toHaveCount(0);
    await shot(page, `core-admin-${scheme}`);
  });

  test(`a doctor with few apps sees OPD's panel, and the launcher (${scheme})`, async ({ page }) => {
    await openAs(page, DOCTOR, "/opd", scheme);
    const panel = page.getByTestId("app-sidebar");
    await expect(panel.getByRole("heading", { name: "OPD / Outpatient" })).toBeVisible();
    await expect(panel.getByRole("link", { name: "Patients" })).toHaveCount(0);
    await shot(page, `doctor-opd-${scheme}`);
    await panel.getByRole("link", { name: "All apps" }).click();
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByTestId("app-sidebar")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Your apps" })).toContainText("OPD / Outpatient");
    await shot(page, `doctor-launcher-${scheme}`);
  });
}
