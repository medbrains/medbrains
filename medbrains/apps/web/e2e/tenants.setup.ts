import { test as setup } from "@playwright/test";
import {
  BOOTSTRAP_ADMIN_PASSWORD,
  BOOTSTRAP_ADMIN_USERNAME,
  ensureE2EIdentities,
  loginForSession,
} from "./helpers/e2e-identities";
import { allSlots, provisionWorkerTenant } from "./helpers/worker-tenant";

const backendUrl = process.env.E2E_BACKEND_URL ?? "http://127.0.0.1:3000";

/**
 * Give every worker slot its own hospital and one temp user per role. API only, so the
 * `api` project can depend on it without a browser; `setup` adds the browser sessions.
 */
setup("provision a hospital and role users per worker", async ({ request }, testInfo) => {
  // Each hospital is seeded with the first one's masters; four take well over the default 30s.
  setup.setTimeout(300_000);
  const runId = process.env.E2E_RUN_ID ?? Date.now().toString(36);
  const bootstrap = await loginForSession(request, BOOTSTRAP_ADMIN_USERNAME, BOOTSTRAP_ADMIN_PASSWORD);
  const headers = { cookie: bootstrap.cookieHeader, "x-csrf-token": bootstrap.csrf };
  const slots = allSlots(testInfo.config.workers);
  // One hospital at a time: each is a burst of seed writes that would otherwise contend.
  for (const slot of slots) {
    await provisionWorkerTenant(request, backendUrl, headers, slot, runId);
  }
  // The users side by side: creating 27 per hospital is password hashing the server spreads.
  await Promise.all(
    slots.map(async (slot) => {
      const identities = await ensureE2EIdentities(request, slot);
      // eslint-disable-next-line no-console
      console.log(`[slot ${slot}] E2E temp users: ${identities.users.length} run=${identities.runId}`);
    }),
  );
});
