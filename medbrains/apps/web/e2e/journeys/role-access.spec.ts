/**
 * Every role sees what its permissions allow — no more, no less (#4804).
 *
 * For each built-in role (administrators bypass every check, so they are left
 * out): a new member of staff in that role signs in; the side panel must list
 * exactly the screens the screen registry opens for their permissions (the
 * permissions come from the server, the screens from APP_SCREENS, which the
 * menu itself is built from); each of those screens must open without a
 * refusal or a crash; and typing the address of a sensitive screen they may
 * not use must be refused.
 *
 * The panel lists one app at a time (the launcher replaced the whole-menu
 * sidebar), so the menu is read panel by panel: the core one, then each app's.
 *
 *   npx playwright test e2e/journeys/role-access.spec.ts --workers=4
 *   ROLE=nurse npx playwright test e2e/journeys/role-access.spec.ts
 */
import { APP_SCREENS, type AppScreen, ROLE_TEMPLATES } from "@medbrains/types";
import type { Page } from "@playwright/test";
import { expect, test } from "./support/world";

/** The menu's screens. Developer screens are listed only by a development build, so they are left out. */
const MENU = APP_SCREENS.filter((s) => s.group !== "dev_only");
/** The screens a leak would hurt most, probed by address when not allowed. */
const SENSITIVE = ["/admin/users", "/audit", "/billing", "/mrd", "/pharmacy", "/lab", "/ipd", "/hr/payroll"];
const ADMINS = new Set(["super_admin", "hospital_admin"]);
const ROLES = Object.keys(ROLE_TEMPLATES).filter(
  (role) => !ADMINS.has(role) && (!process.env.ROLE || process.env.ROLE === role),
);

/** The menu's rule (launcherModel `isItemVisible`): the single code, any one of the list, the app on. */
function opens(screen: AppScreen, granted: Set<string>, off: Set<string>): boolean {
  if (screen.brick && off.has(screen.brick)) return false;
  return (
    (!screen.permission || granted.has(screen.permission)) &&
    (screen.anyOf.length === 0 || screen.anyOf.some((p) => granted.has(p)))
  );
}

/** The menu links in the side panel as it stands, with Administration and Advanced opened. */
async function panelPaths(page: Page): Promise<string[]> {
  const panel = page.getByTestId("app-sidebar");
  if ((await panel.getAttribute("data-mode")) === "rail") {
    await panel.getByRole("button", { name: "Expand" }).click();
  }
  await expect(panel.locator("a[href='/home']")).toBeVisible();
  // Administration holds its pages, and Advanced the rest: two levels, opened outermost first.
  for (let depth = 0; depth < 2; depth += 1) {
    for (const toggle of await panel.locator("button[aria-expanded='false']").all()) await toggle.click();
  }
  return panel.locator("a[href^='/']").evaluateAll((links) => links.map((a) => a.getAttribute("href") ?? ""));
}

/**
 * Every menu screen the person is shown: the core panel (on the dashboard), then the panel of
 * each app they have a screen in, entered at that app's first screen.
 */
async function menuPaths(page: Page, allowed: AppScreen[]): Promise<Set<string>> {
  const known = new Set(MENU.map((s) => s.path));
  const doors = new Map<string | null, string>([[null, "/dashboard"]]);
  for (const s of allowed) if (s.brick && !doors.has(s.brick)) doors.set(s.brick, s.path);
  const shown = new Set<string>();
  for (const door of doors.values()) {
    await visit(page, door);
    for (const href of await panelPaths(page)) if (known.has(href)) shown.add(href);
  }
  return shown;
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

    // The menu: exactly the screens the role opens.
    await page.goto("/dashboard");
    const shown = await menuPaths(page, allowed);
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
