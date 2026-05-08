/**
 * UI smoke for every navigable module page: navigate, require the
 * authenticated app shell, and require non-empty routed page content.
 *
 * This catches broken routes, pages missing from App.tsx, accidental
 * public-landing redirects, and completely blank renders. Per-tab and
 * per-action behavior is covered by the generated screen checklists and
 * deeper module specs.
 */

import { expect, test } from "@playwright/test";
import { NAV_GROUPS, type NavItemConfig } from "../../src/config/navigation";
import { navigateTo, routeApiDirect } from "../helpers";

interface PageCase {
  path: string;
  label: string;
}

function collectNavItems(items: NavItemConfig[], out: PageCase[]) {
  for (const item of items) {
    out.push({ path: item.path, label: item.i18nKey });
    if (item.children) collectNavItems(item.children, out);
  }
}

function navPages(): PageCase[] {
  const collected: PageCase[] = [];
  for (const group of NAV_GROUPS) {
    collectNavItems(group.items, collected);
  }

  const seen = new Set<string>();
  return collected
    .filter((item) => !item.path.includes(":"))
    .filter((item) => {
      if (seen.has(item.path)) return false;
      seen.add(item.path);
      return true;
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}

const PAGES = navPages();

function pathRegex(path: string): RegExp {
  return new RegExp(`${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[?#].*)?$`);
}

test.describe(`Module pages smoke (${PAGES.length} nav routes)`, () => {
  test.beforeEach(async ({ page }) => {
    await routeApiDirect(page);
  });
  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });

  for (const c of PAGES) {
    test(`${c.path} renders authenticated app content`, async ({ page }) => {
      const serverFailures: string[] = [];
      page.on("response", (response) => {
        const url = new URL(response.url());
        if (url.pathname.startsWith("/api/") && response.status() >= 500) {
          serverFailures.push(`${response.status()} ${url.pathname}${url.search}`);
        }
      });

      await navigateTo(page, c.path);

      await expect(page.getByRole("button", { name: /^sign in$/i })).toHaveCount(0);
      await expect(page).toHaveURL(pathRegex(c.path));
      await expect(page.locator('[data-testid="app-sidebar"]')).toBeVisible();
      await expect(page.locator("main")).toBeVisible();

      const pageContent = page.locator(".page-content");
      await expect(pageContent).toBeVisible();
      await expect(pageContent).not.toBeEmpty({ timeout: 10_000 });
      await expect(pageContent).not.toContainText(/hospital operating system built for everyone/i);
      expect(serverFailures, "page must not trigger API 5xx responses").toEqual([]);
    });
  }
});
