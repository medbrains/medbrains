/**
 * Every navigable screen, as a role that may see it and as one that may not.
 *
 * `forms/module-pages-smoke.spec.ts` renders every nav route as the admin.
 * That proves the page exists; it proves nothing about the gate. This does
 * the other half: for each nav route with a permission, a role that HOLDS
 * the permission must land on the page — sidebar, main landmark, content,
 * no API 5xx, no uncaught page error — and a role that LACKS it must be
 * sent to the dashboard rather than shown a screen the server will refuse.
 *
 * The role→permission map is read from `/api/setup/roles` at setup, exactly
 * as `rbac/role-blocking.spec.ts` does, so a role change rebalances the
 * expectations on the next run rather than silently going stale. Roles
 * are the temporary identities global-setup provisions; bypass roles are
 * never used as the "lacks it" side.
 *
 * Nothing here is generated to disk. The nav config and the role table are
 * the matrix; a test per cell is built at load time.
 */

import { existsSync, readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { NAV_GROUPS, type NavItemConfig } from "@/config/navigation";
import { loginAsRole, routeApiDirect } from "../helpers";
import { E2E_ROLE_DEFINITIONS, getE2EIdentity, loginForSession } from "../helpers/e2e-identities";

const BASE = process.env.E2E_BACKEND_URL ?? "http://127.0.0.1:3000";

/**
 * The page's own gate, per route, written by
 * `scripts/coverage_ledger.py --emit-page-gates` (run by `make e2e-generate`).
 * The nav item's permission is what shows the link; the page's
 * `useRequirePermission` is what decides who may stay, and they differ
 * wherever a page accepts any of several codes. Judge by the page's side
 * when it is known; fall back to the nav's when it is not.
 */
const PAGE_GATES_FILE = new URL("../generated/page-gates.json", import.meta.url);
interface PageGatesFile {
  gates: Record<string, string[]>;
  /** Redirect routes (`<Navigate to>`) → the screen they land on. */
  aliases: Record<string, string>;
}
const { gates: PAGE_GATES, aliases: ALIASES }: PageGatesFile = existsSync(PAGE_GATES_FILE)
  ? (JSON.parse(readFileSync(PAGE_GATES_FILE, "utf8")) as PageGatesFile)
  : { gates: {}, aliases: {} };

interface Screen {
  path: string;
  label: string;
  /** Any one of these opens the screen. */
  permissions: string[];
}

function collect(items: NavItemConfig[], out: Screen[]) {
  for (const item of items) {
    const fromNav = [
      ...(item.requiredPermission ? [item.requiredPermission] : []),
      ...(item.requiredPermissions ?? []),
    ];
    const permissions = PAGE_GATES[item.path] ?? fromNav;
    out.push({ path: item.path, label: item.i18nKey, permissions });
    if (item.children) collect(item.children, out);
  }
}

function screens(): Screen[] {
  const all: Screen[] = [];
  for (const group of NAV_GROUPS) collect(group.items, all);
  const seen = new Set<string>();
  return all
    .filter((s) => !s.path.includes(":"))
    .filter((s) => (seen.has(s.path) ? false : (seen.add(s.path), true)))
    .sort((a, b) => a.path.localeCompare(b.path));
}

const SCREENS = screens();
const GATED = SCREENS.filter((s) => s.permissions.length > 0);
const UNGATED = SCREENS.filter((s) => s.permissions.length === 0);
const NON_BYPASS_ROLES = E2E_ROLE_DEFINITIONS.filter((r) => !r.bypass).map((r) => r.role);

let ROLE_PERMS = new Map<string, Set<string>>();

test.beforeAll(async ({ request }) => {
  const admin = getE2EIdentity("super_admin");
  const session = await loginForSession(request, admin.username, admin.password);
  const resp = await request.fetch(`${BASE}/api/setup/roles`, {
    headers: { cookie: session.cookieHeader, "x-csrf-token": session.csrf },
  });
  expect(resp.status(), "fetch roles").toBe(200);
  const roles: Array<{ code: string; permissions: string[] }> = await resp.json();
  ROLE_PERMS = new Map(roles.map((r) => [r.code, new Set(r.permissions)]));
});

function roleHolding(perms: string[]): string | undefined {
  return NON_BYPASS_ROLES.find((role) => perms.some((p) => ROLE_PERMS.get(role)?.has(p)));
}
function roleLacking(perms: string[]): string | undefined {
  return NON_BYPASS_ROLES.find((role) => !perms.some((p) => ROLE_PERMS.get(role)?.has(p)));
}

async function signInAs(page: Page, role: string) {
  const identity = getE2EIdentity(role);
  await loginAsRole(page, identity.username, identity.password);
}

function pathRegex(path: string): RegExp {
  return new RegExp(`${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[?#].*)?$`);
}

test.describe(`Screens by role (${GATED.length} gated, ${UNGATED.length} ungated)`, () => {
  test.beforeEach(async ({ page }) => {
    await routeApiDirect(page);
  });
  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });

  for (const screen of GATED) {
    test(`${screen.path} renders for a role holding ${screen.permissions[0]}`, async ({ page }) => {
      const role = roleHolding(screen.permissions);
      test.skip(!role, `no non-bypass role holds ${screen.permissions.join(" | ")}`);
      const serverFailures: string[] = [];
      const pageErrors: string[] = [];
      page.on("response", (r) => {
        if (new URL(r.url()).pathname.startsWith("/api/") && r.status() >= 500) {
          serverFailures.push(`${r.status()} ${r.url()}`);
        }
      });
      // The notifications socket cannot be proxied by route interception and
      // closes with "WebSocket closed without opened" on every screen. That is
      // the harness, not the page.
      page.on("pageerror", (e) => {
        if (!/WebSocket closed/.test(e.message)) pageErrors.push(e.message);
      });

      await signInAs(page, role ?? "");
      await page.goto(screen.path);
      await expect(page).toHaveURL(pathRegex(ALIASES[screen.path] ?? screen.path));
      await expect(page.locator('[data-testid="app-sidebar"]')).toBeVisible();
      await expect(page.locator("main")).toBeVisible();
      await expect(page.locator(".page-content")).not.toBeEmpty({ timeout: 10_000 });
      expect(serverFailures, "no API 5xx behind the screen").toEqual([]);
      expect(pageErrors, "no uncaught error on the screen").toEqual([]);
    });

    test(`${screen.path} redirects a role lacking ${screen.permissions[0]}`, async ({ page }) => {
      const role = roleLacking(screen.permissions);
      test.skip(!role, `every non-bypass role holds ${screen.permissions.join(" | ")}`);
      await signInAs(page, role ?? "");
      await page.goto(screen.path);
      // The gate sends the user to the dashboard. Landing anywhere else is
      // a screen offered to someone the server will refuse.
      await expect(page).toHaveURL(/\/dashboard(?:[?#].*)?$/, { timeout: 15_000 });
    });
  }

  for (const screen of UNGATED) {
    test(`${screen.path} is reachable by nav but declares no permission`, async () => {
      // Recorded, not hidden: a nav entry without a permission is a screen
      // this matrix cannot judge. The link check owns the page's own gate.
      test.info().annotations.push({ type: "ungated", description: screen.path });
      expect(screen.permissions).toEqual([]);
    });
  }
});
