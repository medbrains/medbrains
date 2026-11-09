/**
 * Each front-line role's main screens still draw after a load-time change.
 *
 * Lazy boundaries move code between chunks; a wrong one shows up as a blank
 * screen or the error boundary only in a production build. This signs in
 * through the real form as a fresh user of each role (made by the run's
 * super admin through `POST /api/setup/users`), opens that role's screens
 * inside the app, and fails on the error boundary or an uncaught page error.
 * Screenshots go to PERF_SHOTS_DIR when it is set.
 *
 * Run with the perf harness: `PERF_PROJECT=perf make perf-web` runs every
 * `*.perf.spec.ts`, this one included.
 */

import { type Page, expect } from "@playwright/test";
import { test } from "../fixtures/identity";
import { authHeaders, BACKEND_URL, type Identity, runAdmin } from "../helpers/identities";

const ROLE_SCREENS: Record<string, string[]> = {
  receptionist: ["/patients", "/opd", "/appointments"],
  doctor: ["/opd", "/patients"],
  nurse: ["/nurse", "/ipd"],
  pharmacist: ["/pharmacy"],
  billing_clerk: ["/billing", "/billing-counter"],
};
const SETTLE_MS = 2_000;

/** A quarter of the server's one-minute sign-in window (see e2e/helpers.ts). */
const LOGIN_LIMIT_WAIT_MS = 15_000;
const LOGIN_ATTEMPTS = 5;

/**
 * Signs in through the hospital's own sign-in form. The server allows five
 * sign-in calls a minute from one address, and a run signs in several staff,
 * so a refused hospital lookup is waited out and retried a few times.
 */
async function signIn(page: Page, user: Identity, hospitalCode: string): Promise<void> {
  const username = page.getByRole("textbox", { name: "Username", exact: true });
  for (let attempt = 1; attempt <= LOGIN_ATTEMPTS; attempt += 1) {
    await page.goto(`/login?hospital=${encodeURIComponent(hospitalCode)}`);
    if (await username.isVisible({ timeout: 10_000 }).catch(() => false)) break;
    await page.waitForTimeout(LOGIN_LIMIT_WAIT_MS);
  }
  await username.fill(user.username);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
}

/** Opens a screen the way a sidebar link does, without a reload. */
async function openInApp(page: Page, path: string): Promise<void> {
  await page.evaluate((to) => {
    window.history.pushState({}, "", to);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(SETTLE_MS);
}

for (const [role, screens] of Object.entries(ROLE_SCREENS)) {
  test(`${role}: main screens draw`, async ({ page, asRole }) => {
    test.setTimeout(240_000);
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const user = await asRole(role);
    const admin = await runAdmin(page.request);
    const tenant = await (
      await page.request.get(`${BACKEND_URL}/api/setup/tenant`, {
        headers: authHeaders(admin.session),
      })
    ).json();
    await signIn(page, user, tenant.code ?? "");
    for (const path of screens) {
      await openInApp(page, path);
      await expect(page.getByText("Screen unavailable"), `${role} ${path}`).toHaveCount(0);
      await expect(page.getByRole("main"), `${role} ${path}`).toBeVisible();
      const dir = process.env.PERF_SHOTS_DIR;
      if (dir) await page.screenshot({ path: `${dir}/${role}${path.replaceAll("/", "_")}.png` });
    }
    expect(pageErrors, `${role}: uncaught page errors`).toEqual([]);
  });
}
