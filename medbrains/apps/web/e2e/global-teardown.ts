import { request as playwrightRequest } from "@playwright/test";
import { writeCoverageReport } from "./helpers/coverage";
import { cleanupStoredE2EIdentities } from "./helpers/e2e-identities";

/** Removes the run's temporary staff and, with E2E_COVERAGE=1, writes the browser coverage. */
export default async function globalTeardown() {
  await writeCoverageReport();
  const request = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    await cleanupStoredE2EIdentities(request);
  } finally {
    await request.dispose();
  }
}
