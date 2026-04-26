import { expect, test } from "@playwright/test";
import { NAV_GROUPS } from "../../src/config/navigation";
import { installMockApi, seedMockSession } from "./mockApi";

interface ModuleTarget {
  label: string;
  path: string;
}

function flattenModuleTargets(): ModuleTarget[] {
  const targets: ModuleTarget[] = [];

  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (item.children?.length) {
        for (const child of item.children) {
          targets.push({ label: child.i18nKey, path: child.path });
        }
        continue;
      }

      targets.push({ label: item.i18nKey, path: item.path });
    }
  }

  const seen = new Set<string>();
  return targets.filter((target) => {
    if (seen.has(target.path)) {
      return false;
    }
    seen.add(target.path);
    return true;
  });
}

const moduleTargets = flattenModuleTargets();

test.describe("Module Screen Smoke (mock)", () => {
  test.beforeEach(async ({ page }) => {
    await installMockApi(page);
    await seedMockSession(page);
  });

  for (const moduleTarget of moduleTargets) {
    test(`${moduleTarget.label} screen renders basic module surface`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));

      await page.goto(moduleTarget.path);
      await expect(page).not.toHaveURL(/\/login$/);

      const heading = page.getByRole("heading").first();
      await expect(heading).toBeVisible({ timeout: 15_000 });

      const moduleSurface = page.locator(
        [
          "button:visible",
          "[role='button']:visible",
          "table:visible",
          "[role='table']:visible",
          "input:visible",
          "[role='textbox']:visible",
          "[role='combobox']:visible",
          "[role='tab']:visible",
          "[role='grid']:visible",
          "[role='searchbox']:visible",
        ].join(", "),
      ).first();

      await expect(moduleSurface).toBeVisible({ timeout: 15_000 });
      expect(pageErrors, `page errors for ${moduleTarget.path}`).toEqual([]);
    });
  }
});
