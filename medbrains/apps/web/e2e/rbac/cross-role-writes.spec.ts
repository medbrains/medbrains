/**
 * Cross-role WRITE matrix.
 *
 * Asserts the perm gate fires correctly on **DELETE** by bogus UUID.
 *
 * Why DELETE-by-id and not POST/PUT? Axum's `Json<Body>` extractor runs
 * BEFORE the handler's `require_permission(...)` call. An empty `{}`
 * body fails deserialization → 422 returned for *every* role,
 * regardless of permission. DELETE has no body, so the extractor
 * pipeline finishes cleanly and the perm check is the first gate.
 *
 * Outcomes:
 *   - role has the perm → handler runs → resource not found → 404 (or 200 no-op)
 *   - role lacks the perm → require_permission returns 403
 *
 * Map derived from `/api/setup/roles` at setup so role-permission
 * edits auto-rebalance expectations.
 */

import { expect, test, type APIRequestContext } from "@playwright/test";
import { E2E_ROLE_DEFINITIONS, getE2EIdentity } from "../helpers/e2e-identities";

const BASE = process.env.E2E_BACKEND_URL ?? "http://127.0.0.1:3000";
const NIL_UUID = "00000000-0000-0000-0000-000000000000";

const ROLE_USERS = E2E_ROLE_DEFINITIONS;

interface DeleteEntry {
  path: string;
  perm: string;
}

const DELETES: DeleteEntry[] = [
  { path: `/api/billing/charge-master/${NIL_UUID}`, perm: "billing.invoices.create" },
  { path: `/api/lab/panels/${NIL_UUID}`, perm: "lab.orders.create" },
  { path: `/api/radiology/modalities/${NIL_UUID}`, perm: "radiology.modalities.manage" },
  { path: `/api/ot/surgeon-preferences/${NIL_UUID}`, perm: "ot.preferences.manage" },
  { path: `/api/opd/prescription-templates/${NIL_UUID}`, perm: "opd.visit.update" },
  { path: `/api/consent/templates/${NIL_UUID}`, perm: "consent.templates.delete" },
  { path: `/api/integration/pipelines/${NIL_UUID}`, perm: "integration.delete" },
];

interface AuthSession {
  csrf: string;
  cookieHeader: string;
}

async function login(
  request: APIRequestContext,
  username: string,
  password: string,
): Promise<AuthSession> {
  const resp = await request.post(`${BASE}/api/auth/login`, {
    data: { username, password },
  });
  expect(resp.status(), `login ${username}`).toBe(200);
  const body = await resp.json();
  const cookieHeader = resp
    .headersArray()
    .filter((h) => h.name.toLowerCase() === "set-cookie")
    .map((h) => h.value.split(";")[0])
    .join("; ");
  return { csrf: body.csrf_token ?? "", cookieHeader };
}

async function del(
  request: APIRequestContext,
  s: AuthSession,
  path: string,
): Promise<number> {
  const resp = await request.fetch(`${BASE}${path}`, {
    method: "DELETE",
    headers: { cookie: s.cookieHeader, "x-csrf-token": s.csrf },
  });
  return resp.status();
}

interface RoleSummary {
  code: string;
  permissions: string[];
}

async function fetchRolesPermMap(
  request: APIRequestContext,
): Promise<Map<string, Set<string>>> {
  const admin = getE2EIdentity("super_admin");
  const adminSession = await login(request, admin.username, admin.password);
  const resp = await request.fetch(`${BASE}/api/setup/roles`, {
    method: "GET",
    headers: { cookie: adminSession.cookieHeader, "x-csrf-token": adminSession.csrf },
  });
  expect(resp.status(), "fetch roles").toBe(200);
  const roles: RoleSummary[] = await resp.json();
  const map = new Map<string, Set<string>>();
  for (const r of roles) {
    map.set(r.code, new Set(r.permissions));
  }
  return map;
}

let ROLE_PERMS: Map<string, Set<string>> = new Map();

test.beforeAll(async ({ request }) => {
  ROLE_PERMS = await fetchRolesPermMap(request);
});

for (const user of ROLE_USERS) {
  test.describe(`DELETE matrix — ${user.role}`, () => {
    let session: AuthSession;

    test.beforeAll(async ({ request }) => {
      const identity = getE2EIdentity(user.role);
      session = await login(request, identity.username, identity.password);
    });

    for (const entry of DELETES) {
      test(`DELETE ${entry.path} (perm=${entry.perm})`, async ({ request }) => {
        const perms = ROLE_PERMS.get(user.role) ?? new Set();
        const allowed = !!user.bypass || perms.has(entry.perm);
        const status = await del(request, session, entry.path);

        if (allowed) {
          // Permission accepted — handler runs. Resource doesn't exist
          // → 404, or 200/204 if delete is a no-op.
          expect(
            [200, 204, 404, 400, 422].includes(status),
            `${entry.path} role=${user.role} expected handler-reached (200/204/404), got ${status}`,
          ).toBe(true);
        } else {
          expect(
            status,
            `${entry.path} role=${user.role} expected DENY (403), got ${status}`,
          ).toBe(403);
        }
      });
    }
  });
}
