/**
 * A deactivated account has no live session.
 *
 * Every request re-checks the token's `perm_version` against the user row, so
 * a permission change signs the phone out on its next request. Deactivating
 * (or deleting, which soft-deletes) changed `is_active` and `deleted_at` but
 * not `perm_version` — so the check kept passing, and an account gone from
 * every admin list kept a ward screen until its token expired. Found by the
 * native Mobile-Nurse sign-in journey; fixed in the check itself so both
 * paths revoke.
 *
 * The assertion is the request after: it must answer 401, not 200.
 */

import { expect, test } from "@playwright/test";
import { BACKEND_URL, authHeaders, provisionIdentity, retireIdentity } from "../helpers/identities";

test.describe("A deactivated account", () => {
  test("is refused on its next request, not at token expiry", async ({ request }) => {
    const nurse = await provisionIdentity(request, "nurse");
    const headers = authHeaders(nurse.session);

    const before = await request.get(`${BACKEND_URL}/api/auth/me`, { headers });
    expect(before.status(), "the account works while it is active").toBe(200);

    await retireIdentity(request, nurse);

    const after = await request.get(`${BACKEND_URL}/api/auth/me`, { headers });
    expect(after.status(), "deactivation revokes the live session").toBe(401);
  });
});
