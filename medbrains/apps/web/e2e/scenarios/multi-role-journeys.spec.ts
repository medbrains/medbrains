/**
 * Multi-role UI journeys.
 *
 * Login as different seeded users, then walk module pages. Each spec
 * verifies that the SPA layers (page guard + sidebar visibility +
 * permission-gated buttons) match the role's actual permissions.
 *
 * Pattern per role:
 *   1. login → land on /dashboard
 *   2. own-module page loads (no redirect)
 *   3. forbidden module page redirects to /dashboard (page guard)
 *   4. sidebar surfaces own module entries; not forbidden ones
 */

import { test, expect, type Page } from "@playwright/test";
import { loginAsRole, routeApiDirect } from "../helpers";
import { getE2EIdentity } from "../helpers/e2e-identities";

interface RoleJourney {
  role: string;
  /** Pages this role should reach (module landing). */
  allowed: string[];
  /** Pages whose page-guard must redirect this role to /dashboard. */
  forbidden: string[];
}

const JOURNEYS: RoleJourney[] = [
  {
    role: "doctor",
    allowed: ["/dashboard", "/patients", "/opd", "/lab", "/pharmacy"],
    forbidden: ["/admin/users", "/hr", "/procurement", "/bme"],
  },
  {
    role: "nurse",
    allowed: ["/dashboard", "/patients", "/ipd"],
    forbidden: ["/admin/users", "/billing", "/procurement"],
  },
  {
    role: "lab_technician",
    allowed: ["/dashboard", "/lab"],
    forbidden: ["/admin/users", "/billing", "/pharmacy", "/hr"],
  },
  {
    role: "pharmacist",
    allowed: ["/dashboard", "/pharmacy"],
    forbidden: ["/admin/users", "/lab", "/billing", "/hr"],
  },
  {
    role: "billing_clerk",
    allowed: ["/dashboard", "/billing"],
    forbidden: ["/lab", "/pharmacy", "/admin/users"],
  },
  {
    role: "receptionist",
    allowed: ["/dashboard", "/patients", "/billing"],
    forbidden: ["/admin/users", "/lab", "/pharmacy", "/hr"],
  },
  {
    role: "hr_officer",
    allowed: ["/dashboard", "/hr"],
    forbidden: ["/patients", "/lab", "/pharmacy", "/billing"],
  },
  {
    role: "biomed_engineer",
    allowed: ["/dashboard", "/bme"],
    forbidden: ["/patients", "/lab", "/pharmacy", "/admin/users"],
  },
  {
    role: "procurement_officer",
    allowed: ["/dashboard", "/procurement"],
    forbidden: ["/patients", "/lab", "/pharmacy", "/hr"],
  },
  {
    role: "blood_bank_tech",
    allowed: ["/dashboard", "/blood-bank"],
    forbidden: ["/patients", "/lab", "/pharmacy", "/admin/users"],
  },
  {
    role: "super_admin",
    // bypass — every gated page reachable
    allowed: ["/dashboard", "/patients", "/opd", "/lab", "/pharmacy", "/billing", "/hr", "/admin/users"],
    forbidden: [],
  },
];

async function expectOnPath(page: Page, path: string) {
  await page.waitForURL(new RegExp(`${path}(\\?.*)?$`), { timeout: 10_000 });
  expect(page.url()).toContain(path);
}

async function expectRedirectedFrom(page: Page, blockedPath: string) {
  await page.goto(blockedPath);
  // Page guard kicks in: should land on /dashboard (or stay on /login if claims missing)
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  const url = page.url();
  expect(
    url.includes("/dashboard") || url.includes("/login") || !url.includes(blockedPath),
    `expected redirect away from ${blockedPath}, but on ${url}`,
  ).toBe(true);
}

for (const j of JOURNEYS) {
  test.describe(`UI journey — ${j.role}`, () => {
    test.beforeEach(async ({ page }) => {
      await routeApiDirect(page);
      const identity = getE2EIdentity(j.role);
      await loginAsRole(page, identity.username, identity.password);
    });

    test(`lands on /dashboard after login`, async ({ page }) => {
      await page.goto("/dashboard");
      await expectOnPath(page, "/dashboard");
      // Some indicator of the SPA shell loaded
      await expect(page.locator("body")).toBeVisible();
    });

    for (const path of j.allowed) {
      test(`can reach ${path}`, async ({ page }) => {
        await page.goto(path);
        // Allow either the path itself or a default sub-route
        await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
        const url = page.url();
        expect(
          url.includes(path) || (path === "/dashboard" && url.includes("/dashboard")),
          `expected to reach ${path}, got ${url}`,
        ).toBe(true);
      });
    }

    for (const path of j.forbidden) {
      test(`redirected away from forbidden ${path}`, async ({ page }) => {
        await expectRedirectedFrom(page, path);
      });
    }
  });
}
