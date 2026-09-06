import { expect, test } from "@playwright/test";
import { navigateTo } from "../helpers";

/**
 * Which build is this?
 *
 * The sidebar carried a hardcoded "v0.1" — the same string on every deploy
 * since it was written, which is worse than showing nothing: it answers the
 * support question confidently and wrongly. The SPA is cached hard, so a
 * browser running last week's bundle looks identical to a current one, and
 * "have you reloaded?" is unanswerable without a real version on screen.
 */
test.describe("build version", () => {
  test("the sidebar shows a real version, commit and date", async ({ page }) => {
    await navigateTo(page, "/dashboard");
    // A 7-char commit and a date — neither can be the old hardcoded "v0.1".
    await expect(page.getByText(/v\d+\.\d+\.\d+\s*·\s*[0-9a-f]{7}/)).toBeVisible({
      timeout: 15000,
    });
  });
});
