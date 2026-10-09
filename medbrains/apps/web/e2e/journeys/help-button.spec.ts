/**
 * Help opens the user guide at the page for the screen you are on, and at its
 * front page where the screen has none.
 */
import { expect, test } from "./support/world";

test("Help opens the guide at this screen's page", async ({ hospital }) => {
  const page = await hospital.asAdmin();
  await page.goto("/home-visits");
  const [guide] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("button", { name: "Help" }).click(),
  ]);
  await expect(guide).toHaveURL(/\/help\/clinical\/home-visit-case-sheet\/$/);

  await page.goto("/dashboard");
  const [front] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("button", { name: "Help" }).click(),
  ]);
  await expect(front).toHaveURL(/\/help\/$/);
});
