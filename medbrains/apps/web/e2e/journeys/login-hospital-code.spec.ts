/**
 * Sign-in starts with the hospital. Its code names it — a wrong one is
 * refused before anything else is asked — and the hospital's own sign-in
 * methods are offered: its identity provider ("Sign in with Microsoft"),
 * username and password, or both. The code is remembered on this browser,
 * so the next visit starts at the hospital's own sign-in, with a way back.
 */
import { api } from "../helpers/api";
import { getE2EIdentity } from "../helpers/e2e-identities";
import { expect, test } from "./support/world";

test.use({ storageState: { cookies: [], origins: [] } });

const HOSPITAL = "default";

test("a nurse names her hospital first, then signs in with its password", async ({
  hospital,
}) => {
  const nurse = getE2EIdentity("nurse");
  const page = await hospital.asPublic();
  await page.goto("/login");

  const code = page.getByTestId("login-hospital-code");
  await code.fill("NO-SUCH-HOSPITAL");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText('No hospital uses the code "NO-SUCH-HOSPITAL"')).toBeVisible();
  await expect(page.getByLabel("Username")).toHaveCount(0);

  await code.fill(HOSPITAL);
  await page.getByRole("button", { name: "Continue" }).click();
  const options = await api<{ name: string; code: string }>(hospital.admin, "GET", `/api/auth/sign-in-options?code=${HOSPITAL}`);
  await expect(page.getByTestId("login-hospital-name")).toHaveText(options.name);
  await page.getByLabel("Username").fill(nurse.username);
  await page.getByRole("textbox", { name: "Password" }).fill(nurse.password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  // Remembered as the hospital's own code, however it was typed.
  expect(await page.evaluate(() => localStorage.getItem("medbrains.hospital_code"))).toBe(
    options.code,
  );
});

test("a hospital that signs in with Microsoft only offers Microsoft, with a way back", async ({
  hospital,
}) => {
  const suffix = crypto.randomUUID().slice(0, 6);
  const provider = await api<{ id: string }>(hospital.admin, "POST", "/api/admin/sso/providers", {
    code: `ms-${suffix}`,
    name: `Microsoft ${suffix}`,
    protocol: "oidc",
    discovery_url: "https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration",
    client_id: `e2e-${suffix}`,
    is_active: true,
  });
  await hospital.setting("auth", "password_login_disabled", true);
  try {
    const page = await hospital.asPublic();
    // Returning on this browser: the hospital is remembered, step 1 is skipped.
    await page.goto("/login");
    await page.evaluate((c) => localStorage.setItem("medbrains.hospital_code", c), HOSPITAL);
    await page.reload();

    await expect(page.getByRole("button", { name: `Sign in with Microsoft ${suffix}` })).toBeVisible();
    await expect(page.getByLabel("Username")).toHaveCount(0);
    // The break-glass administrator can still reach a password.
    await page.getByRole("button", { name: "Administrator? Use a password" }).click();
    await expect(page.getByLabel("Username")).toBeVisible();

    await page.getByTestId("login-change-hospital").click();
    await expect(page.getByTestId("login-hospital-code")).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("medbrains.hospital_code"))).toBeNull();
  } finally {
    await api(hospital.admin, "DELETE", `/api/admin/sso/providers/${provider.id}`);
  }
});
