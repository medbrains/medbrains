/**
 * Per-test identity fixture.
 *
 * `asRole("nurse")` provisions a nurse that exists only for the life of one
 * test, and retires it afterwards. Tests never share a login, so one test
 * cannot pass because another already created the record it needed, and a
 * permission change cannot leak between them through a reused session.
 */

import { request as newRequest, test as base } from "@playwright/test";
import {
  type Identity,
  provisionIdentity,
  retireIdentity,
  retireRunAdmin,
} from "../helpers/identities";

export interface IdentityFixtures {
  /** A freshly created user in `role`, unique to this test. */
  asRole: (role: string) => Promise<Identity>;
}

interface IdentityWorkerFixtures {
  retireWorkerAdmin: void;
}

export const test = base.extend<IdentityFixtures, IdentityWorkerFixtures>({
  // Closes out the super admin this worker created, so a run leaves no active
  // account behind. Auto-runs so no test has to remember it.
  retireWorkerAdmin: [
    async ({}, use) => {
      await use();
      const context = await newRequest.newContext({ ignoreHTTPSErrors: true });
      try {
        await retireRunAdmin(context);
      } finally {
        await context.dispose();
      }
    },
    { scope: "worker", auto: true },
  ],

  asRole: async ({ request }, use) => {
    const provisioned: Identity[] = [];
    const byRole = new Map<string, Promise<Identity>>();

    await use((role: string) => {
      // One per role per test: asking twice in the same test means "the nurse",
      // not "another nurse".
      let pending = byRole.get(role);
      if (!pending) {
        pending = provisionIdentity(request, role).then((identity) => {
          provisioned.push(identity);
          return identity;
        });
        byRole.set(role, pending);
      }
      return pending;
    });

    for (const identity of provisioned) {
      await retireIdentity(request, identity).catch(() => {
        // A retirement failure must not turn a passing test red; the account is
        // inert either way and the run's accounts are uniquely named.
      });
    }
  },
});

export { expect } from "@playwright/test";
