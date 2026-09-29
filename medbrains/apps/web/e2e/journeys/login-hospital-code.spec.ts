/**
 * Staff who work in more than one hospital name theirs at sign-in. A code that
 * names no hospital is refused; the right one signs in and is remembered on
 * this browser for next time. (A username two hospitals share, which makes the
 * server ask, is proven in login_hospital_scope_test.)
 */
import { expect, test } from "@playwright/test";
import { getE2EIdentity } from "../helpers/e2e-identities";

test.use({ storageState: { cookies: [], origins: [] } });

test("a nurse names her hospital at sign-in, and a wrong code is refused", async ({ page }) => {
  const nurse = getE2EIdentity("nurse");
  await page.goto("/login");
  // A hospital with single sign-on leads with it; staff can still use a password.
  const usePassword = page.getByText("Use a username & password instead");
  const enterCode = page.getByTestId("login-enter-hospital-code");
  await expect(usePassword.or(enterCode)).toBeVisible();
  if (await usePassword.isVisible()) await usePassword.click();
  await enterCode.click();
  await page.getByLabel("Username").fill(nurse.username);
  await page.getByRole("textbox", { name: "Password" }).fill(nurse.password);
  const code = page.getByTestId("login-hospital-code");
  await code.fill("NO-SUCH-HOSPITAL");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.getByTestId("login-error")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);

  await code.fill("default");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  expect(await page.evaluate(() => localStorage.getItem("medbrains.hospital_code"))).toBe("default");
});
