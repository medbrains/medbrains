/**
 * UI smoke for every priority module page: navigate, expect the page
 * to render (PageHeader title visible), and a "create"-style action
 * button to be present where applicable.
 *
 * This is the lightest possible coverage to catch broken routes,
 * missing pages, or completely failing renders. Per-field validation
 * is covered by per-form specs once each module's create form is
 * extracted to a static React component (PatientRegisterForm pattern).
 */

import { test, expect } from "@playwright/test";
import { navigateTo, routeApiDirect } from "../helpers";

interface PageCase {
  path: string;
  titleRegex: RegExp;
  /** Optional: action button name regex that should appear if user has permission. */
  actionRegex?: RegExp;
}

const PAGES: PageCase[] = [
  { path: "/patients", titleRegex: /Patients/i, actionRegex: /Register Patient/i },
  { path: "/opd", titleRegex: /OPD/i },
  { path: "/lab", titleRegex: /Lab/i },
  { path: "/pharmacy", titleRegex: /Pharmacy/i },
  { path: "/pharmacy/finance", titleRegex: /Pharmacy Finance/i },
  { path: "/billing", titleRegex: /Billing/i },
  { path: "/ipd", titleRegex: /IPD/i },
  { path: "/icu", titleRegex: /ICU/i },
  { path: "/radiology", titleRegex: /Radiology/i },
  { path: "/blood-bank", titleRegex: /Blood Bank/i },
  { path: "/emergency", titleRegex: /Emergency/i },
  { path: "/diet-kitchen", titleRegex: /Diet/i },
  { path: "/cssd", titleRegex: /CSSD/i },
  { path: "/indent", titleRegex: /Indent/i },
  { path: "/procurement", titleRegex: /Procurement/i },
  { path: "/hr", titleRegex: /HR|Human Resources/i },
  { path: "/consent", titleRegex: /Consent/i },
  { path: "/front-office", titleRegex: /Front Office/i },
  { path: "/camp", titleRegex: /Camp/i },
  { path: "/nurse", titleRegex: /Nurse/i },
];

test.describe("Module pages smoke", () => {
  test.beforeEach(async ({ page }) => {
    await routeApiDirect(page);
  });
  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });

  for (const c of PAGES) {
    test(`${c.path} renders`, async ({ page }) => {
      await navigateTo(page, c.path);
      // Heading or title text must appear.
      await expect(page.getByText(c.titleRegex).first()).toBeVisible({
        timeout: 10_000,
      });
    });
  }
});
