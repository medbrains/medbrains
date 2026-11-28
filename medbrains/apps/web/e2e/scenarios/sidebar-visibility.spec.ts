/**
 * What each role is offered, per role.
 *
 * Login as each role → the side panel on /dashboard lists the core
 * screens (Dashboard), and the launcher (/home) offers a tile for each app
 * the role may open and none for the rest. The launcher replaced the
 * whole-menu sidebar, so "this role sees this module" is the app's tile
 * (owner, 2026-11-23); which screens inside an app a role reaches is
 * journeys/role-access.spec.ts.
 *
 * App names come from BRICK_MANIFESTS; "Dashboard" from
 * `apps/web/public/locales/en/nav.json`. Tests assume default locale (en).
 */
import { test, expect, type Page } from "@playwright/test";
import { loginAsRole, routeApiDirect } from "../helpers";
import { launcherAppNames } from "../helpers/launcher";
import { getE2EIdentity } from "../helpers/e2e-identities";

// Each test stands alone (its own page, sign-in and data), so workers and shards may split them.
test.describe.configure({ mode: "parallel" });

// We keep the journeys-project storageState (admin's auth-storage)
// because Zustand persist hydrates from localStorage at *first* read.
// With empty storage the SPA boots into /login and stays there.
// Instead, after `loginAsRole`, the new role's cookies + ProtectedRoute's
// `api.me()` call repopulate `permissionStore`, which is what the
// sidebar filter actually reads. The auth-store role stays as admin
// for header display, but UI gating is permission-store driven.

interface SidebarCase {
  role: string;
  /** Apps whose launcher tile the role is offered. */
  apps: string[];
  /** Apps the role must not be offered. */
  hiddenApps: string[];
}

const LAB = "Laboratory (LIS)";
const BILLING = "Billing & Finance";
const STORES = "Inventory & Stores";

const CASES: SidebarCase[] = [
  {
    role: "doctor",
    apps: ["Patient Registration", "OPD / Outpatient"],
    hiddenApps: ["Blood Bank", "Diet & Nutrition"],
  },
  { role: "lab_technician", apps: [LAB], hiddenApps: ["Pharmacy", BILLING, STORES] },
  { role: "pharmacist", apps: ["Pharmacy"], hiddenApps: [LAB, BILLING] },
  { role: "billing_clerk", apps: [BILLING], hiddenApps: [LAB, STORES] },
  // Biomedical engineering and procurement are screens of the stores app.
  { role: "biomed_engineer", apps: [STORES], hiddenApps: [LAB, "Pharmacy", BILLING] },
  { role: "procurement_officer", apps: [STORES], hiddenApps: [LAB, "Pharmacy", BILLING] },
  { role: "blood_bank_tech", apps: ["Blood Bank"], hiddenApps: [LAB, "Pharmacy", BILLING] },
  {
    role: "super_admin",
    // bypass — every app is offered. A sample across the board.
    apps: ["Patient Registration", LAB, "Pharmacy", BILLING],
    hiddenApps: [],
  },
];

/** The Dashboard link in the side panel, which lists the core screens on /dashboard. */
async function expectDashboardLink(page: Page) {
  // Scope strictly to the sidebar Navbar so we don't pick up
  // page-content or Spotlight-search matches of the same text.
  const sidebar = page.locator('[data-testid="app-sidebar"]');
  await expect(sidebar.getByText("Dashboard", { exact: true }).first()).toBeVisible({
    timeout: 10_000,
  });
}

for (const c of CASES) {
  test.describe(`Sidebar — ${c.role}`, () => {
    test.beforeEach(async ({ page }) => {
      await routeApiDirect(page);
      const identity = getE2EIdentity(c.role);
      await loginAsRole(page, identity.username, identity.password);
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    });

    test(`shows "Dashboard"`, async ({ page }) => {
      await expectDashboardLink(page);
    });

    for (const app of c.apps) {
      test(`offers the "${app}" app`, async ({ page }) => {
        expect(await launcherAppNames(page)).toContain(app);
      });
    }

    for (const app of c.hiddenApps) {
      test(`does not offer the "${app}" app`, async ({ page }) => {
        expect(await launcherAppNames(page)).not.toContain(app);
      });
    }
  });
}
