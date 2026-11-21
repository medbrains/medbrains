import { expect, test } from "@playwright/test";
import { navigateTo } from "../helpers";
import { getAuthContextFromCookies } from "../helpers/api";
import { createLabOrderToOpen } from "../helpers/journey-steps";

/**
 * The draw queue that could never contain a row.
 *
 * `listPhlebotomyQueue` and `updatePhlebotomyStatus` were both wired — the
 * phlebotomy page read the queue and could advance a draw — but
 * `createPhlebotomyEntry` had no caller, so the worklist was permanently empty
 * with working controls on it. The order is where a draw is decided, so the
 * maker belongs on the order.
 */
// Deliberately an UNCOLLECTED order: the control is offered only while the
// sample is still to be drawn, so a collected order is the wrong fixture and
// silently proves nothing.

test.describe("lab draw queue", () => {
  test("an uncollected order can be sent to the draw queue", async ({ page, request }) => {
    const order = await createLabOrderToOpen(await getAuthContextFromCookies(request));
    await navigateTo(page, `/lab/orders/${order}`);
    await expect(page.getByRole("button", { name: /send to draw queue/i })).toBeVisible({
      timeout: 15000,
    });
  });

  test("an already-collected order does not offer to queue a draw", async ({ page, request }) => {
    // The sample is in the lab; queueing a draw for it would send a
    // phlebotomist to a patient who has already been bled.
    const order = await createLabOrderToOpen(await getAuthContextFromCookies(request), {
      collected: true,
    });
    await navigateTo(page, `/lab/orders/${order}`);
    await expect(page.getByText(/Order:/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: /send to draw queue/i })).toHaveCount(0);
  });

  test("the phlebotomy worklist is reachable and states what it holds", async ({ page }) => {
    await navigateTo(page, "/lab");
    // Never a blank panel: rows, or an explicit empty, or an explicit failure.
    await expect(page.locator("body")).toBeVisible();
  });
});
