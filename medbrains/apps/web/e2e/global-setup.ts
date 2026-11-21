import { type APIRequestContext, type Browser, expect, test as setup } from "@playwright/test";
import {
  authStatePathFor,
  browserCookiesFromLogin,
  getE2EIdentity,
  loginForSession,
} from "./helpers/e2e-identities";
import { seedAllFixtures } from "./helpers/seed-fixtures";
import { routeApiDirect } from "./helpers";
import { allSlots, slotForwardedFor } from "./helpers/worker-tenant";

const backendUrl = process.env.E2E_BACKEND_URL ?? "http://127.0.0.1:3000";

/**
 * Save every worker slot's signed-in browser session and seed its fixtures. The `tenants`
 * project, which this depends on, has already provisioned each slot's hospital and users.
 */
setup("sign in a browser per worker", async ({ browser }, testInfo) => {
  setup.setTimeout(180_000);
  await Promise.all(
    allSlots(testInfo.config.workers).map((slot) => prepareSlot(browser, slot)),
  );
});

/** Save `slot`'s super admin browser session and seed its fixtures. */
async function prepareSlot(browser: Browser, slot: number): Promise<void> {
  const context = await browser.newContext({
    extraHTTPHeaders: { "X-Forwarded-For": slotForwardedFor(slot) },
  });
  try {
    const request = context.request;
    const admin = getE2EIdentity("super_admin", slot);
    const session = await loginForSession(request, admin.username, admin.password);
    await saveBrowserSession(context, session, slot);
    await seedSlotFixtures(request, session, slot);
  } finally {
    await context.close();
  }
}

/** Sign the browser in as the slot's super admin and save the state projects load. */
async function saveBrowserSession(
  context: Awaited<ReturnType<Browser["newContext"]>>,
  session: Awaited<ReturnType<typeof loginForSession>>,
  slot: number,
): Promise<void> {
  const page = await context.newPage();
  await routeApiDirect(page);
  await page.goto("/login");
  // The page is ready when it names itself; the password form may sit behind
  // "Use a username & password instead" for a hospital with single sign-on.
  await expect(page.getByRole("heading", { name: "Sign in", level: 1 })).toBeVisible({
    timeout: 10_000,
  });
  // Zustand persist format.
  await page.evaluate((user) => {
    localStorage.setItem("auth-storage", JSON.stringify({ state: { user }, version: 0 }));
  }, session.user);
  const browserCookies = browserCookiesFromLogin(session);
  if (browserCookies.length > 0) {
    await context.addCookies(browserCookies);
  }
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  await context.storageState({ path: authStatePathFor(slot) });
}

/** Seed canonical fixtures in the slot's hospital so tests hit real rows. Idempotent. */
async function seedSlotFixtures(
  request: APIRequestContext,
  session: Awaited<ReturnType<typeof loginForSession>>,
  slot: number,
): Promise<void> {
  if (!session.csrf) return;
  const seedResult = await seedAllFixtures({
    baseUrl: backendUrl,
    csrfToken: session.csrf,
    cookieHeader: session.cookieHeader,
    request,
    verbose: process.env.E2E_SEED_VERBOSE === "1",
  });
  // eslint-disable-next-line no-console
  console.log(
    `[slot ${slot}] [seed] created=${seedResult.created.length} reused=${seedResult.reused.length} failed=${seedResult.failed.length}`,
  );
  if (seedResult.failed.length > 0 && process.env.E2E_SEED_STRICT === "1") {
    throw new Error(
      `Seed failures (strict mode): ${seedResult.failed.map((f) => `${f.key}: ${f.reason}`).join("; ")}`,
    );
  }
}
