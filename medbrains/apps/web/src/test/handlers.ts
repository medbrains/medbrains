/**
 * Default MSW request handlers for Vitest UI tests.
 *
 * Each handler returns the canonical fixture from `src/__fixtures__/`.
 * Tests that need different shapes call `server.use(...)` to override
 * a specific handler for that test.
 */

import { HttpResponse, http } from "msw";
import { authMeFixture } from "../__fixtures__/auth";
import { patientFixture } from "../__fixtures__/patient";
import { SEED } from "../__fixtures__/seed";

const API = "*/api";

export const handlers = [
  // ── Auth ─────────────────────────────────────────────────────
  http.get(`${API}/auth/me`, () => HttpResponse.json(authMeFixture)),
  http.post(`${API}/auth/refresh`, () =>
    HttpResponse.json({ csrf_token: authMeFixture.csrf_token }),
  ),

  // ── Patients ─────────────────────────────────────────────────
  http.get(`${API}/patients/${SEED.patient}`, () => HttpResponse.json(patientFixture)),
  http.get(`${API}/patients`, () =>
    HttpResponse.json({ data: [patientFixture], meta: { total: 1, page: 1, per_page: 20 } }),
  ),

  // ── Tenant config ────────────────────────────────────────────
  http.get(`${API}/tenant-settings`, () =>
    HttpResponse.json({
      tenant_id: SEED.tenant,
      tenant_name: "Smoke Hospital",
      country_code: "IN",
      default_locale: "en-IN",
      timezone: "Asia/Kolkata",
      date_format: "DD/MM/YYYY",
      measurement_system: "metric",
    }),
  ),

  // ── Health ───────────────────────────────────────────────────
  http.get(`${API}/health`, () =>
    HttpResponse.json({ status: "healthy", postgres: "ok", yottadb: "deferred" }),
  ),

  // ── Catch-all GETs return empty list — keeps pages from
  //    crashing on unmocked endpoints during tests.
  http.get(`${API}/*`, () =>
    HttpResponse.json({ data: [], meta: { total: 0, page: 1, per_page: 20 } }),
  ),
];
