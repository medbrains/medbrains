import { expect, test } from "@playwright/test";
import { navigateTo } from "../helpers";

/**
 * The camp board is built entirely from counters.
 *
 * `camp_board` selects FROM camp_department_counters JOIN departments, so a
 * camp with no counters yields an empty board however complete the TV screen
 * reading it is. That was the state for the life of the feature: a finished
 * board and no way for anyone to give it a row.
 *
 * These drive the maker through the screen, because a passing query is not
 * evidence the feature exists.
 */
test.describe("camp counters", () => {
  test("a camp offers a way to add the rooms its board will show", async ({ page }) => {
    await navigateTo(page, "/camp");
    const firstCamp = page.getByRole("row").nth(1).getByRole("link").first();
    await firstCamp.click();

    await expect(
      page.getByRole("button", { name: /add counter/i }),
      "a board built from counters needs somewhere to create one",
    ).toBeVisible();
  });

  test("a counter added on the screen reaches the board API", async ({ page, request }) => {
    await navigateTo(page, "/camp");
    await page.getByRole("row").nth(1).getByRole("link").first().click();
    await page.waitForURL(/\/camp\//);
    const campId = page.url().split("/camp/")[1]?.split(/[/?#]/)[0] ?? "";
    expect(campId, "could not read a camp id from the url").toMatch(/[0-9a-f-]{36}/);

    const name = `Consultation room ${Date.now() % 100000}`;
    await page.getByLabel("Counter", { exact: true }).fill(name);
    await page.getByLabel(/serves department/i).click();
    await page.getByRole("option").first().click();
    await page.getByLabel("Where").fill("School block A");
    await page.getByRole("button", { name: /add counter/i }).click();

    // On the screen first...
    await expect(page.getByText(name)).toBeVisible();

    // ...then the thing the TV actually reads. A row in the table that never
    // reaches the board is the exact failure this work exists to fix.
    const board = await request.get(`/api/tokens/camp-board?camp_id=${campId}`);
    expect(board.ok(), "the camp board must answer").toBe(true);
    const rows = (await board.json()) as Array<{ counter_name: string | null }>;
    expect(
      rows.some((row) => row.counter_name?.includes(name)),
      "a counter created on the screen must appear on the board",
    ).toBe(true);
  });

  test("an unmapped counter is called out rather than hidden", async ({ page }) => {
    // A counter with no department cannot reach the board. Hiding it would
    // leave someone building the same room a second time.
    await navigateTo(page, "/camp");
    await page.getByRole("row").nth(1).getByRole("link").first().click();
    await expect(page.getByText(/the camp board shows one card per counter/i)).toBeVisible();
  });
});
