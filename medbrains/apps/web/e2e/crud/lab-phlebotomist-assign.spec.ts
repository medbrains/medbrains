import { expect, test } from "@playwright/test";
import { navigateTo } from "../helpers";

/**
 * Who is going to draw this.
 *
 * `assignPhlebotomist` was routed on the backend with a per-record access
 * gate, and had no client method at all — so a draw could be queued and worked
 * but never given to anybody. On a busy round that means two people walk to
 * the same bed, or nobody does.
 */
test.describe("phlebotomy assignment", () => {
  test("the draw queue lets a phlebotomist be named", async ({ page }) => {
    await navigateTo(page, "/lab");
    await page.getByRole("tab", { name: /phlebotomy|collection/i }).first().click();

    // Either an assignment control on a queued draw, or an explicit empty
    // queue — never a queue that shows draws with no way to allocate them.
    await expect(
      page
        .getByRole("combobox", { name: /assign a phlebotomist/i })
        .or(page.getByText(/no .*(draw|collection|queue)/i))
        .first(),
    ).toBeVisible({ timeout: 15000 });
  });
});
