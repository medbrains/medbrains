/**
 * Role-based access control matrix — strict.
 *
 * For every (seeded user × endpoint) cell, assert the backend either:
 *   - 200/204 if the user's role carries the endpoint's required permission
 *     (or the role is a bypass: super_admin / hospital_admin)
 *   - 403 otherwise.
 *
 * The allow-map is *derived* from `/api/setup/roles` at test setup —
 * not hand-curated — so a role permission change auto-rebalances
 * expectations on next run.
 *
 * If the backend handler doesn't gate with `require_permission(...)`
 * for a given endpoint, this spec FAILS with 200-instead-of-403.
 * That failure is intentional: it surfaces an unenforced route.
 */

import { expect, test, type APIRequestContext } from "@playwright/test";
import { E2E_ROLE_DEFINITIONS, getE2EIdentity } from "../helpers/e2e-identities";

const BASE = process.env.E2E_BACKEND_URL ?? "http://127.0.0.1:3000";

const ROLE_USERS = E2E_ROLE_DEFINITIONS;

interface MatrixEntry {
  path: string;
  /** Permission code the backend handler enforces via `require_permission`. */
  perm: string;
}

const MATRIX: MatrixEntry[] = [
  { path: "/api/patients", perm: "patients.list" },
  { path: "/api/opd/encounters", perm: "opd.queue.list" },
  { path: "/api/lab/orders", perm: "lab.orders.list" },
  { path: "/api/pharmacy/orders", perm: "pharmacy.prescriptions.list" },
  { path: "/api/radiology/orders", perm: "radiology.orders.list" },
  { path: "/api/billing/invoices", perm: "billing.invoices.list" },
  { path: "/api/procurement/vendors", perm: "procurement.vendors.list" },
  { path: "/api/hr/employees", perm: "hr.employees.list" },
  { path: "/api/bme/equipment", perm: "bme.equipment.list" },
  { path: "/api/ambulance/trips", perm: "ambulance.trips.list" },
  { path: "/api/cssd/loads", perm: "cssd.sterilization.list" },
  { path: "/api/blood-bank/donors", perm: "blood_bank.donors.list" },
  { path: "/api/diet/orders", perm: "diet.orders.list" },
  { path: "/api/mrd/records", perm: "mrd.records.list" },
  { path: "/api/infection-control/surveillance", perm: "infection_control.surveillance.list" },
  { path: "/api/camp/camps", perm: "camp.list" },
  { path: "/api/insurance/prior-auths", perm: "insurance.prior_auth.list" },
  { path: "/api/ot/bookings", perm: "ot.bookings.list" },
  { path: "/api/front-office/visitors", perm: "front_office.visitors.list" },
  { path: "/api/indent/requisitions", perm: "indent.list" },
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
  const headers = resp.headersArray();
  const cookieHeader = headers
    .filter((h) => h.name.toLowerCase() === "set-cookie")
    .map((h) => h.value.split(";")[0])
    .join("; ");
  return { csrf: body.csrf_token ?? "", cookieHeader };
}

async function callApi(
  request: APIRequestContext,
  s: AuthSession,
  path: string,
): Promise<number> {
  const resp = await request.fetch(`${BASE}${path}`, {
    method: "GET",
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
  test.describe(`RBAC role=${user.role}`, () => {
    let session: AuthSession;

    test.beforeAll(async ({ request }) => {
      const identity = getE2EIdentity(user.role);
      session = await login(request, identity.username, identity.password);
    });

    for (const entry of MATRIX) {
      test(`${entry.path} (perm=${entry.perm})`, async ({ request }) => {
        const perms = ROLE_PERMS.get(user.role) ?? new Set();
        const allowed = !!user.bypass || perms.has(entry.perm);
        const status = await callApi(request, session, entry.path);

        if (allowed) {
          expect(
            [200, 204].includes(status),
            `${entry.path} role=${user.role} expected ALLOW (200/204), got ${status}`,
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
