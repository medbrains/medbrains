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

const BASE = process.env.E2E_BACKEND_URL ?? "http://127.0.0.1:3000";

interface RoleUser {
  username: string;
  password: string;
  role: string;
  bypass?: boolean;
}

const PASS_DOC = "doctor123";
const PASS_ROLE = "test123";
const PASS_ADMIN = "admin123";

const ROLE_USERS: RoleUser[] = [
  { username: "admin", password: PASS_ADMIN, role: "super_admin", bypass: true },
  { username: "hosp_admin_demo", password: PASS_ROLE, role: "hospital_admin", bypass: true },
  { username: "dr_priya", password: PASS_DOC, role: "doctor" },
  { username: "nurse_anita", password: PASS_ROLE, role: "nurse" },
  { username: "lab_suresh", password: PASS_ROLE, role: "lab_technician" },
  { username: "pharm_kavita", password: PASS_ROLE, role: "pharmacist" },
  { username: "billing_raj", password: PASS_ROLE, role: "billing_clerk" },
  { username: "recept_meera", password: PASS_ROLE, role: "receptionist" },
  { username: "audit_neha", password: PASS_ROLE, role: "audit_officer" },
  { username: "mrd_sanjay", password: PASS_ROLE, role: "mrd_officer" },
  { username: "canteen_lata", password: PASS_ROLE, role: "canteen_staff" },
  { username: "dietitian_anu", password: PASS_ROLE, role: "dietitian" },
  { username: "security_pradeep", password: PASS_ROLE, role: "security_guard" },
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
  const adminSession = await login(request, "admin", PASS_ADMIN);
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
  test.describe(`RBAC role=${user.role} (${user.username})`, () => {
    let session: AuthSession;

    test.beforeAll(async ({ request }) => {
      session = await login(request, user.username, user.password);
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
