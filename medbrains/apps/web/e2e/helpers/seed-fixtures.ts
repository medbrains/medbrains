/**
 * Idempotent fixture seeder.
 *
 * Walks the canonical `SEED` UUID map and creates the corresponding row
 * in the live backend if it doesn't already exist. Used by smoke +
 * e2e tests to guarantee every path-param UUID resolves to a real row.
 *
 * Strategy:
 *   - For each entity, attempt `GET /api/<resource>/<uuid>` first.
 *   - If 200, skip (already seeded).
 *   - If 404, issue `POST /api/<resource>` with a minimal-valid body
 *     that includes `id: <canonical-uuid>` if the API allows
 *     client-supplied IDs; otherwise create + capture returned ID into
 *     a runtime override map.
 *
 * Returns a `SeedResult` summarising what was created vs reused, for
 * diagnostics in CI logs.
 *
 * **Run order matters.** Parents (tenant, department, doctor, patient)
 * must exist before children (encounter, lab_order, …). The
 * `seedAllFixtures` function enforces this order.
 *
 * Backend prerequisites:
 *   - Tenant + admin user already exist (seeded by `seed.rs` on start-up).
 *   - At least one `department` and `doctor` exist (seeded via `demo_patients.rs`).
 */

import type { APIRequestContext } from "@playwright/test";
import { SEED, type SeedKey } from "./canonical-seed";

export interface SeedResult {
  created: SeedKey[];
  reused: SeedKey[];
  failed: Array<{ key: SeedKey; reason: string }>;
}

interface SeedDef {
  /** GET path used to check existence. {id} is replaced with the SEED UUID. */
  checkPath: string;
  /** POST path used to create. */
  createPath: string;
  /** Body builder. Should include `id` field if the backend respects it. */
  body: () => Record<string, unknown>;
  /** Optional: dependencies that must be seeded first. */
  dependsOn?: SeedKey[];
}

/**
 * Per-entity seed definitions. Only the subset of SEED keys that have
 * a stable creation API are listed here; others are placeholder-only
 * (smoke tests will get 404 on those, which is acceptable).
 *
 * Add an entry whenever you discover a smoke endpoint that returns a
 * 500 because of a missing FK — making sure the parent entity is
 * seeded fixes the 500 cascade.
 */
const SEED_DEFS: Partial<Record<SeedKey, SeedDef>> = {
  patient: {
    checkPath: "/api/patients/{id}",
    createPath: "/api/patients",
    body: () => ({
      id: SEED.patient,
      first_name: "Smoke",
      last_name: "Patient",
      gender: "male",
      phone: "9000000010",
      date_of_birth: "1990-01-01",
    }),
  },
  encounter: {
    checkPath: "/api/opd/encounters/{id}",
    createPath: "/api/opd/encounters",
    body: () => ({
      id: SEED.encounter,
      patient_id: SEED.patient,
      department_id: SEED.department,
      visit_type: "new",
    }),
    dependsOn: ["patient", "department"],
  },
  appointment: {
    checkPath: "/api/opd/appointments/{id}",
    createPath: "/api/opd/appointments",
    body: () => ({
      id: SEED.appointment,
      patient_id: SEED.patient,
      doctor_id: SEED.doctor,
      department_id: SEED.department,
      scheduled_at: new Date(Date.now() + 86400_000).toISOString(),
    }),
    dependsOn: ["patient", "doctor", "department"],
  },
  lab_order: {
    checkPath: "/api/lab/orders/{id}",
    createPath: "/api/lab/orders",
    body: () => ({
      id: SEED.lab_order,
      patient_id: SEED.patient,
      encounter_id: SEED.encounter,
      test_ids: [],
    }),
    dependsOn: ["patient", "encounter"],
  },
  pharmacy_order: {
    checkPath: "/api/pharmacy/orders/{id}",
    createPath: "/api/pharmacy/orders",
    body: () => ({
      id: SEED.pharmacy_order,
      patient_id: SEED.patient,
      encounter_id: SEED.encounter,
      items: [],
    }),
    dependsOn: ["patient", "encounter"],
  },
  invoice: {
    checkPath: "/api/billing/invoices/{id}",
    createPath: "/api/billing/invoices",
    body: () => ({
      id: SEED.invoice,
      patient_id: SEED.patient,
      items: [],
    }),
    dependsOn: ["patient"],
  },
  admission: {
    checkPath: "/api/ipd/admissions/{id}",
    createPath: "/api/ipd/admissions",
    body: () => ({
      id: SEED.admission,
      patient_id: SEED.patient,
      admitting_doctor_id: SEED.doctor,
      department_id: SEED.department,
      admission_type: "elective",
    }),
    dependsOn: ["patient", "doctor", "department"],
  },
  emergency_case: {
    checkPath: "/api/emergency/cases/{id}",
    createPath: "/api/emergency/cases",
    body: () => ({
      id: SEED.emergency_case,
      patient_id: SEED.patient,
      chief_complaint: "Smoke seed",
      triage_level: "green",
    }),
    dependsOn: ["patient"],
  },
};

const SEED_ORDER: SeedKey[] = [
  // Identity layer first
  "patient",
  // OPD/visit
  "encounter",
  "appointment",
  // Diagnostics + Rx
  "lab_order",
  "pharmacy_order",
  // Billing
  "invoice",
  // IPD/Emergency
  "admission",
  "emergency_case",
];

interface SeedRunOpts {
  baseUrl: string;
  csrfToken: string;
  request: APIRequestContext;
  /** When true, log progress per entity. Off by default to keep CI tidy. */
  verbose?: boolean;
}

export async function seedAllFixtures(opts: SeedRunOpts): Promise<SeedResult> {
  const result: SeedResult = { created: [], reused: [], failed: [] };

  for (const key of SEED_ORDER) {
    const def = SEED_DEFS[key];
    if (!def) continue;

    try {
      const checkUrl = `${opts.baseUrl}${def.checkPath.replace("{id}", SEED[key])}`;
      const checkResp = await opts.request.fetch(checkUrl, {
        headers: { "x-csrf-token": opts.csrfToken },
      });
      if (checkResp.status() === 200) {
        result.reused.push(key);
        if (opts.verbose) console.log(`[seed] reused ${key}`);
        continue;
      }

      const createResp = await opts.request.fetch(`${opts.baseUrl}${def.createPath}`, {
        method: "POST",
        headers: {
          "x-csrf-token": opts.csrfToken,
          "content-type": "application/json",
        },
        data: JSON.stringify(def.body()),
      });

      if (createResp.status() >= 200 && createResp.status() < 300) {
        result.created.push(key);
        if (opts.verbose) console.log(`[seed] created ${key}`);
      } else {
        const body = await createResp.text();
        result.failed.push({
          key,
          reason: `POST ${def.createPath} → ${createResp.status()}: ${body.slice(0, 200)}`,
        });
      }
    } catch (e) {
      result.failed.push({ key, reason: e instanceof Error ? e.message : String(e) });
    }
  }

  return result;
}
