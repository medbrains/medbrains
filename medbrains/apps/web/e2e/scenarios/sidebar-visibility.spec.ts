/**
 * Sidebar visibility per role.
 *
 * Login as each role → load /dashboard → assert the rendered sidebar
 * contains the labels of allowed nav entries and does NOT contain
 * forbidden ones.
 *
 * Mantine's `NavLink` renders the label as visible text inside an
 * anchor with `role="link"`, so we locate via `getByRole("link",
 * { name: label, exact: true })`.
 *
 * Labels come from `apps/web/public/locales/en/nav.json` — i18n keys
 * resolved client-side. Tests assume default locale (en).
 */

import { test, expect, type Page } from "@playwright/test";
import { loginAsRole, routeApiDirect } from "../helpers";
import { getE2EIdentity } from "../helpers/e2e-identities";

// We keep the journeys-project storageState (admin's auth-storage)
// because Zustand persist hydrates from localStorage at *first* read.
// With empty storage the SPA boots into /login and stays there.
// Instead, after `loginAsRole`, the new role's cookies + ProtectedRoute's
// `api.me()` call repopulate `permissionStore`, which is what the
// sidebar filter actually reads. The auth-store role stays as admin
// for header display, but UI gating is permission-store driven.

interface SidebarCase {
  role: string;
  /** Labels expected to be rendered in the sidebar. */
  visible: string[];
  /** Labels that must NOT appear in the sidebar. */
  hidden: string[];
}

const CASES: SidebarCase[] = [
  {
    role: "doctor",
    visible: ["Dashboard", "Patients", "OPD Queue"],
    hidden: ["Procurement", "Biomedical Engineering"],
  },
  {
    role: "lab_technician",
    visible: ["Dashboard", "Lab"],
    hidden: ["Pharmacy", "Billing", "Procurement"],
  },
  {
    role: "pharmacist",
    visible: ["Dashboard", "Pharmacy"],
    hidden: ["Lab", "Billing", "Procurement"],
  },
  {
    role: "billing_clerk",
    visible: ["Dashboard", "Billing"],
    hidden: ["Lab", "Pharmacy", "Procurement"],
  },
  {
    role: "biomed_engineer",
    visible: ["Dashboard", "Biomedical Engineering"],
    hidden: ["Lab", "Pharmacy", "Billing"],
  },
  {
    role: "procurement_officer",
    visible: ["Dashboard", "Procurement"],
    hidden: ["Lab", "Pharmacy", "Billing"],
  },
  {
    role: "blood_bank_tech",
    visible: ["Dashboard", "Blood Bank"],
    hidden: ["Lab", "Pharmacy", "Billing"],
  },
  {
    role: "super_admin",
    // bypass — every nav surfaces. Pick a sample of every-section labels.
    visible: ["Dashboard", "Patients", "Lab", "Pharmacy", "Billing"],
    hidden: [],
  },
];

async function expectLink(page: Page, label: string, present: boolean) {
  // Scope strictly to the sidebar Navbar so we don't pick up
  // page-content or Spotlight-search matches of the same text.
  const sidebar = page.locator('[data-testid="app-sidebar"]');
  const link = sidebar.getByText(label, { exact: true });
  if (present) {
    await expect(link.first()).toBeVisible({ timeout: 10_000 });
  } else {
    await expect(link).toHaveCount(0, { timeout: 5_000 });
  }
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

    for (const label of c.visible) {
      test(`shows "${label}"`, async ({ page }) => {
        await expectLink(page, label, true);
      });
    }

    for (const label of c.hidden) {
      test(`hides "${label}"`, async ({ page }) => {
        await expectLink(page, label, false);
      });
    }
  });
}
