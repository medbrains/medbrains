/**
 * Every role sees what its permissions allow — no more, no less (#4804).
 *
 * For each built-in role (administrators bypass every check, so they are left
 * out): a new member of staff in that role signs in; the sidebar must list
 * exactly the screens the menu config opens for their permissions (the
 * permissions come from the server, the menu from docs/testing/nav-menu.json,
 * exported from NAV_GROUPS); each of those screens must open without a
 * refusal or a crash; and typing the address of a sensitive screen they may
 * not use must be refused.
 *
 *   npx playwright test e2e/journeys/role-access.spec.ts --workers=4
 *   ROLE=nurse npx playwright test e2e/journeys/role-access.spec.ts
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ROLE_TEMPLATES } from "@medbrains/types";
import type { Page } from "@playwright/test";
import { expect, test } from "./support/world";

interface MenuItem {
  group: string;
  label: string;
  path: string;
  one: string | null;
  any: string[];
  module: string | null;
  parent: string | null;
}

const MENU: MenuItem[] = JSON.parse(
  readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), "../../../../docs/testing/nav-menu.json"),
    "utf8",
  ),
);
/** The screens a leak would hurt most, probed by address when not allowed. */
const SENSITIVE = ["/admin/users", "/audit", "/billing", "/mrd", "/pharmacy", "/lab", "/ipd", "/hr/payroll"];
const ADMINS = new Set(["super_admin", "hospital_admin"]);
const ROLES = Object.keys(ROLE_TEMPLATES).filter(
  (role) => !ADMINS.has(role) && (!process.env.ROLE || process.env.ROLE === role),
);

/** The sidebar's rule (AppLayout): the single code, and any one of the list. */
function opens(item: MenuItem, granted: Set<string>, off: Set<string>): boolean {
  if (item.module && off.has(item.module)) return false;
  return (!item.one || granted.has(item.one)) && (item.any.length === 0 || item.any.some((p) => granted.has(p)));
}

async function sidebarPaths(page: Page, parents: string[]): Promise<Set<string>> {
  const known = new Set(MENU.map((m) => m.path));
  const nav = page.locator("nav").first();
  await expect(nav.locator("a[href^='/']").first()).toBeVisible();
  // Children (Administration → Admin → Users) render once their parent is opened.
  for (const parent of parents) {
    const toggle = nav.getByRole("button", { name: parent, exact: true });
    if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  }
  const hrefs = await nav
    .locator("a[href^='/']")
    .evaluateAll((links) => links.map((a) => a.getAttribute("href") ?? ""));
  return new Set(hrefs.filter((h) => known.has(h)));
}

/** Move inside the app (as a user does) rather than reloading it per screen. */
async function visit(page: Page, path: string): Promise<void> {
  await page.evaluate((to) => {
    window.history.pushState({}, "", to);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
  await page.waitForTimeout(600);
}

test.describe.configure({ mode: "parallel" });

for (const role of ROLES) {
  test(`${role}: the menu, its screens and its refusals match its permissions`, async ({ hospital }) => {
    test.setTimeout(600_000);
    const { page } = await hospital.newStaff(role, `Role check ${ROLE_TEMPLATES[role].label}`);
    const me = await (await page.request.get("/api/auth/me")).json();
    const granted = new Set<string>(me.permissions ?? []);
    const off = new Set<string>(me.disabled_modules ?? []);
    const allowed = MENU.filter((m) => opens(m, granted, off));
    const expected = new Set(allowed.map((m) => m.path));
    const parents = [...new Set(allowed.flatMap((m) => (m.parent ? [m.parent] : [])))];

    // The menu: exactly the screens the role opens.
    await page.goto("/dashboard");
    const shown = await sidebarPaths(page, parents);
    const missing = [...expected].filter((p) => !shown.has(p));
    const extra = [...shown].filter((p) => !expected.has(p));
    expect({ missing, extra }, `${role}'s menu`).toEqual({ missing: [], extra: [] });

    // Each of its screens opens: no refusal, no crash.
    const broken: string[] = [];
    for (const path of expected) {
      await visit(page, path);
      if (/\/forbidden/.test(page.url())) broken.push(`${path} refused`);
      else if (await page.getByText("Screen unavailable").isVisible()) broken.push(`${path} crashed`);
    }
    expect(broken, `${role}'s screens that should open`).toEqual([]);

    // Sensitive screens it may not use are refused even by address.
    const leaked: string[] = [];
    for (const path of SENSITIVE.filter((p) => MENU.some((m) => m.path === p) && !expected.has(p))) {
      await page.goto(path); // a typed address: a full load
      const refused = await page
        .waitForURL(/\/forbidden/, { timeout: 10_000 })
        .then(() => true)
        .catch(() => false);
      if (!refused) leaked.push(path);
    }
    expect(leaked, `${role} reached screens by address`).toEqual([]);
  });
}
