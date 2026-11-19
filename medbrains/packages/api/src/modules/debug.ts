/** The `/debug` API area. Moved from `client.ts`; one module per first path segment. */
import { request } from "../client.js";

export const debugApi = {
  debugAuthzProbe: () => request<unknown>("/debug/authz-probe"),
  seedE2eCanonicalFixtures: () =>
    request<unknown>("/debug/e2e/canonical-fixtures", {
      method: "POST",
    }),
};
