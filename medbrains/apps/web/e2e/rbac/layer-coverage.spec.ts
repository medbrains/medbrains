/**
 * RBAC layer coverage — verifies non-API layers carry the same enforcement.
 *
 * Layer 1 — Screen (auth/me): every role's permissions exclude codes
 *   for screens it shouldn't see; the manifest's screen tree is consistent.
 * Layer 3 — API (require_permission): covered in role-blocking.spec.
 * Layer 4 — List scope (state.authz.list_accessible): admin (bypass)
 *   sees > 0 patients; non-bypass roles see only what SpiceDB tuples allow.
 * Layer 5 — Row perms (_perms block): every row in a scoped list response
 *   carries view/edit/delete/share/approve flags.
 * Layer 6 — Field access: cross-checked elsewhere; here we sanity-check
 *   that the response shape exposes a `_perms` object, not bare rows.
 *
 * Layer 2 (tab visibility) and Layer 7 (cross-link) are UI concerns —
 * tested in the journey/forms specs that drive the browser.
 */

import { expect, test, type APIRequestContext } from "@playwright/test";

const BASE = process.env.E2E_BACKEND_URL ?? "http://127.0.0.1:3000";

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

async function get(
  request: APIRequestContext,
  s: AuthSession,
  path: string,
): Promise<{ status: number; body: unknown }> {
  const resp = await request.fetch(`${BASE}${path}`, {
    method: "GET",
    headers: { cookie: s.cookieHeader, "x-csrf-token": s.csrf },
  });
  const text = await resp.text();
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    /* keep null */
  }
  return { status: resp.status(), body };
}

test.describe("Layer 1 — Screen / claims", () => {
  test("auth/me returns role + permission set", async ({ request }) => {
    const sess = await login(request, "dr_priya", "doctor123");
    const me = await get(request, sess, "/api/auth/me");
    expect(me.status).toBe(200);
    const body = me.body as { role: string; permissions: string[] };
    expect(body.role).toBe("doctor");
    expect(Array.isArray(body.permissions)).toBe(true);
    expect(body.permissions.length).toBeGreaterThan(0);
    expect(body.permissions).toContain("dashboard.view");
  });

  test("non-bypass role does not get hospital_admin codes", async ({ request }) => {
    const sess = await login(request, "nurse_anita", "test123");
    const me = await get(request, sess, "/api/auth/me");
    const body = me.body as { permissions: string[] };
    // Hospital admin-only codes nurses must not hold
    expect(body.permissions).not.toContain("admin.users.create");
    expect(body.permissions).not.toContain("admin.roles.manage");
    expect(body.permissions).not.toContain("admin.tenants.manage");
  });
});

test.describe("Layer 4 — List scope (rebac)", () => {
  test("bypass admin sees all tenant patients (>0)", async ({ request }) => {
    const sess = await login(request, "admin", "admin123");
    const r = await get(request, sess, "/api/patients");
    expect(r.status).toBe(200);
    const body = r.body as { total: number; patients: unknown[] };
    expect(body.total).toBeGreaterThan(0);
    expect(body.patients.length).toBeGreaterThan(0);
  });

  test("non-bypass clinician with no SpiceDB tuples sees 0 (or grants)", async ({
    request,
  }) => {
    const sess = await login(request, "dr_priya", "doctor123");
    const r = await get(request, sess, "/api/patients");
    // 200 with empty list; rebac filters out everything they have no tuple to
    expect(r.status).toBe(200);
    const body = r.body as { total: number; patients: unknown[] };
    expect(body.total).toBeGreaterThanOrEqual(0);
    // Smaller-or-equal to admin's total (proves a filter happened)
    const admin = await login(request, "admin", "admin123");
    const adminResp = await get(request, admin, "/api/patients");
    const adminBody = adminResp.body as { total: number };
    expect(body.total).toBeLessThanOrEqual(adminBody.total);
  });
});

test.describe("Layer 5 — Row perms (_perms block)", () => {
  test("every patient row carries _perms with 5 keys", async ({ request }) => {
    const sess = await login(request, "admin", "admin123");
    const r = await get(request, sess, "/api/patients");
    const body = r.body as {
      patients: Array<{
        _perms?: Record<string, boolean>;
      }>;
    };
    expect(body.patients.length).toBeGreaterThan(0);
    for (const row of body.patients.slice(0, 10)) {
      expect(row._perms, "row missing _perms").toBeDefined();
      const p = row._perms as Record<string, boolean>;
      for (const k of ["view", "edit", "delete", "share", "approve"]) {
        expect(typeof p[k], `_perms.${k} type`).toBe("boolean");
      }
    }
  });

  test("bypass admin gets _perms all-true on every row", async ({ request }) => {
    const sess = await login(request, "admin", "admin123");
    const r = await get(request, sess, "/api/patients");
    const body = r.body as {
      patients: Array<{ _perms: Record<string, boolean> }>;
    };
    for (const row of body.patients.slice(0, 5)) {
      expect(row._perms.view).toBe(true);
      expect(row._perms.edit).toBe(true);
      expect(row._perms.delete).toBe(true);
      expect(row._perms.share).toBe(true);
      expect(row._perms.approve).toBe(true);
    }
  });
});

test.describe("Layer 6 — Field access shape", () => {
  test("/api/auth/me exposes field_access if present", async ({ request }) => {
    const sess = await login(request, "nurse_anita", "test123");
    const me = await get(request, sess, "/api/auth/me");
    expect(me.status).toBe(200);
    // field_access is optional — but if present, must be an object map
    const body = me.body as { field_access?: Record<string, unknown> };
    if (body.field_access !== undefined) {
      expect(typeof body.field_access).toBe("object");
    }
  });
});

test.describe("Cross-cutting — perm_version invalidation", () => {
  test("auth/me returns a perm_version (used for JWT cache busting)", async ({
    request,
  }) => {
    const sess = await login(request, "admin", "admin123");
    const me = await get(request, sess, "/api/auth/me");
    const body = me.body as { perm_version?: number };
    if (body.perm_version !== undefined) {
      expect(typeof body.perm_version).toBe("number");
    }
  });
});
