import { expect, test } from "@playwright/test";
import { navigateTo } from "../helpers";
import { getAuthContextFromCookies } from "../helpers/api";
import { createLabOrderToOpen } from "../helpers/journey-steps";

/**
 * The way back from a result to the patient waiting on it.
 *
 * The audit's headline gap in the outpatient pipeline: a verified result had
 * no route to the encounter that ordered it, so whoever read it here went and
 * found the patient again in a list they had just come from.
 *
 * `rail` layout, not `inline`: inline collapses into a menu labelled
 * "Actions", and this page already has one from DocumentActions. Two
 * identically-named menus is worse than none — and it is what made me
 * misread the first attempt as broken and revert working code.
 */
test.describe("lab order return leg", () => {
  test("a lab order offers named ways back into the patient's care", async ({ page, request }) => {
    const order = await createLabOrderToOpen(await getAuthContextFromCookies(request), {
      collected: true,
    });
    await navigateTo(page, `/lab/orders/${order}`);
    await expect(page.getByRole("button", { name: /new opd visit|open .*visit/i }).first())
      .toBeVisible({ timeout: 15000 });
  });

  test("it does not offer a route back to the order already open", async ({ page, request }) => {
    const order = await createLabOrderToOpen(await getAuthContextFromCookies(request), {
      collected: true,
    });
    await navigateTo(page, `/lab/orders/${order}`);
    await expect(page.getByRole("button", { name: /^Open lab order$/i })).toHaveCount(0);
  });
});
