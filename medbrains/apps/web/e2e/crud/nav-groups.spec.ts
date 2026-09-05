import { expect, test } from "@playwright/test";
import { navigateTo } from "../helpers";

/**
 * The sidebar was 98 entries in 9 groups, badly balanced: Operations 23,
 * Inpatient 19, Finance 2. Worse, things were filed where they are not —
 * Testimonials, Microsite Settings and Health Packages sat under "Inpatient",
 * as did Home Healthcare and Home Visits, which are definitionally not
 * inpatient care.
 *
 * Regrouped by what things are, into eleven groups with no wall of 23.
 */
test.describe("sidebar grouping", () => {
  test("the new groups are rendered", async ({ page }) => {
    await navigateTo(page, "/dashboard");
    // Network and Marketing & Web did not exist before.
    await expect(page.getByText("Network", { exact: true }).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("website content has its own group instead of sitting under Inpatient", async ({ page }) => {
    await navigateTo(page, "/dashboard");
    // "Marketing & Web" did not exist before this change. Asserting that
    // "Inpatient" is still visible would have passed either way, which is no
    // test at all — this one is false unless the group was actually created.
    await expect(page.getByText("Marketing & Web", { exact: true }).first()).toBeVisible({
      timeout: 15000,
    });
  });
});
