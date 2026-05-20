import { test as setup, expect } from "@playwright/test";
import {
  authStatePath,
  browserCookiesFromLogin,
  ensureE2EIdentities,
  loginForSession,
} from "./helpers/e2e-identities";
import { seedAllFixtures } from "./helpers/seed-fixtures";
import { routeApiDirect } from "./helpers";

const backendUrl = process.env.E2E_BACKEND_URL ?? "http://127.0.0.1:3000";

/**
 * Authenticate once and save browser storage state for reuse by all tests.
 * Runs as a project dependency before the main test suite.
 */
setup("authenticate as admin", async ({ page, request }) => {
  await routeApiDirect(page);

  const identities = await ensureE2EIdentities(request);
  const adminIdentity = identities.users.find((user) => user.role === "super_admin");
  if (!adminIdentity) {
    throw new Error("E2E super_admin temp credential was not created");
  }
  const session = await loginForSession(request, adminIdentity.username, adminIdentity.password);

  // Navigate to the app and inject auth state
  await page.goto("/login");
  await expect(page.getByLabel("Username")).toBeVisible({ timeout: 10_000 });

  // Set localStorage auth state (Zustand persist format)
  await page.evaluate(
    (user) => {
      localStorage.setItem(
        "auth-storage",
        JSON.stringify({ state: { user }, version: 0 }),
      );
    },
    session.user,
  );

  // eslint-disable-next-line no-console
  console.log(`Created E2E temp users: ${identities.users.length} run=${identities.runId}`);

  const browserCookies = browserCookiesFromLogin(session);
  if (browserCookies.length > 0) {
    await page.context().addCookies(browserCookies);
  }

  // Navigate to dashboard — app reads localStorage and renders authenticated state
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

  // Persist authenticated state
  await page.context().storageState({ path: authStatePath });

  // Seed canonical fixtures so smoke + e2e tests hit real rows.
  // Idempotent — skips entities that already exist.
  const csrfToken = session.csrf;
  if (csrfToken) {
    const seedResult = await seedAllFixtures({
      baseUrl: backendUrl,
      csrfToken,
      cookieHeader: session.cookieHeader,
      request,
      verbose: process.env.E2E_SEED_VERBOSE === "1",
    });
    // eslint-disable-next-line no-console
    console.log(
      `[seed] created=${seedResult.created.length} reused=${seedResult.reused.length} failed=${seedResult.failed.length}`,
    );
    if (seedResult.failed.length > 0 && process.env.E2E_SEED_STRICT === "1") {
      throw new Error(
        `Seed failures (strict mode): ${seedResult.failed.map((f) => `${f.key}: ${f.reason}`).join("; ")}`,
      );
    }
  }
});
