import { request as playwrightRequest } from "@playwright/test";
import { cleanupStoredE2EIdentities } from "./helpers/e2e-identities";

export default async function globalTeardown() {
  const request = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    await cleanupStoredE2EIdentities(request);
  } finally {
    await request.dispose();
  }
}
