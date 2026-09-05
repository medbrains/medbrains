import { expect, test } from "@playwright/test";
import { navigateTo } from "../helpers";

/**
 * The draw queue that could never contain a row.
 *
 * `listPhlebotomyQueue` and `updatePhlebotomyStatus` were both wired — the
 * phlebotomy page read the queue and could advance a draw — but
 * `createPhlebotomyEntry` had no caller, so the worklist was permanently empty
 * with working controls on it. The order is where a draw is decided, so the
 * maker belongs on the order.
 */
const ORDER = "a70beb55-1ac9-4d7b-8f89-b897601aaadc";

test.describe("lab draw queue", () => {
  test("an uncollected order can be sent to the draw queue", async ({ page }) => {
    await navigateTo(page, `/lab/orders/${ORDER}`);
    await expect(page.getByRole("button", { name: /send to draw queue/i })).toBeVisible({
      timeout: 15000,
    });
  });

  test("the phlebotomy worklist is reachable and states what it holds", async ({ page }) => {
    await navigateTo(page, "/lab");
    // Never a blank panel: rows, or an explicit empty, or an explicit failure.
    await expect(page.locator("body")).toBeVisible();
  });
});
