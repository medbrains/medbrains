/**
 * A stranger who finds /onboarding on a live hospital's server meets a closed
 * door, not a form that mints a new organisation and super admin.
 */
import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("a signed-out visitor to onboarding is told registration is closed", async ({ page }) => {
  await page.goto("/onboarding");
  const closed = page.getByTestId("onboarding-closed");
  await expect(closed).toBeVisible();
  await expect(closed.getByText("Registration is closed")).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await closed.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/login/);
});
