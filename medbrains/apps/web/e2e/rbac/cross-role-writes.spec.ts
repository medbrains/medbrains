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

const BASE = process.env.E2E_BACKEND_URL ?? "http://127.0.0.1:3000";
const NIL_UUID = "00000000-0000-0000-0000-000000000000";

interface RoleUser {
  username: string;
  password: string;
  role: string;
  bypass?: boolean;
}

const PASS_DOC = "doctor123";
const PASS_ROLE = "test123";

const ROLE_USERS: RoleUser[] = [
  { username: "admin", password: "admin123", role: "super_admin", bypass: true },
  { username: "hosp_admin_demo", password: PASS_ROLE, role: "hospital_admin", bypass: true },
  { username: "dr_priya", password: PASS_DOC, role: "doctor" },
  { username: "nurse_anita", password: PASS_ROLE, role: "nurse" },
  { username: "lab_suresh", password: PASS_ROLE, role: "lab_technician" },
  { username: "pharm_kavita", password: PASS_ROLE, role: "pharmacist" },
  { username: "billing_raj", password: PASS_ROLE, role: "billing_clerk" },
  { username: "recept_meera", password: PASS_ROLE, role: "receptionist" },
  { username: "audit_neha", password: PASS_ROLE, role: "audit_officer" },
  { username: "mrd_sanjay", password: PASS_ROLE, role: "mrd_officer" },
  { username: "biomed_arvind", password: PASS_ROLE, role: "biomed_engineer" },
  { username: "amb_gopal", password: PASS_ROLE, role: "ambulance_driver" },
  { username: "radio_tech_sita", password: PASS_ROLE, role: "radiology_tech" },
  { username: "cssd_ramesh", password: PASS_ROLE, role: "cssd_technician" },
  { username: "bb_tech_divya", password: PASS_ROLE, role: "blood_bank_tech" },
  { username: "fo_priti", password: PASS_ROLE, role: "front_office_staff" },
  { username: "ic_dr_kavya", password: PASS_ROLE, role: "infection_control_officer" },
  { username: "proc_amit", password: PASS_ROLE, role: "procurement_officer" },
  { username: "store_naveen", password: PASS_ROLE, role: "store_keeper" },
  { username: "hr_deepika", password: PASS_ROLE, role: "hr_officer" },
  { username: "camp_rohit", password: PASS_ROLE, role: "camp_coordinator" },
  { username: "ins_nidhi", password: PASS_ROLE, role: "insurance_officer" },
  { username: "ot_staff_jaya", password: PASS_ROLE, role: "ot_staff" },
];

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
  const adminSession = await login(request, "admin", "admin123");
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
  test.describe(`DELETE matrix — ${user.role} (${user.username})`, () => {
    let session: AuthSession;

    test.beforeAll(async ({ request }) => {
      session = await login(request, user.username, user.password);
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
