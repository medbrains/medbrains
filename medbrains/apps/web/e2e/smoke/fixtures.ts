/**
 * Minimum-valid request bodies for API smoke tests.
 *
 * Keys are `METHOD path-pattern` where path-pattern matches the route
 * declaration in `crates/medbrains-server/src/routes/mod.rs` (with
 * `{name}` placeholders, NOT substituted UUIDs).
 *
 * The smoke generator uses this map to populate POST/PUT/PATCH bodies.
 * If a key is missing, the generator falls back to `{}` — which often
 * causes a 422 (correct backend validation behavior, but reportable
 * noise). Adding a body here turns a 422 into a 2xx (or a real
 * validation error worth investigating).
 *
 * Add bodies for endpoints listed in latency-report.jsonl with status
 * 422 to drive that count down.
 *
 * UUIDs in bodies should reference `SEED.<key>` from
 * `helpers/canonical-seed.ts` once the seeder runs in CI; for now,
 * placeholder UUIDs are acceptable (still validates the JSON shape).
 */

import { SEED } from "../helpers/canonical-seed";

export const SMOKE_BODIES: Record<string, Record<string, unknown>> = {
  // ── Patients ────────────────────────────────────────────────
  "POST /api/patients": {
    first_name: "SmokeFirst",
    last_name: "SmokeLast",
    gender: "male",
    phone: "9999900001",
  },

  // ── OPD ─────────────────────────────────────────────────────
  "POST /api/opd/encounters": {
    patient_id: SEED.patient,
    department_id: SEED.department,
    visit_type: "new",
  },
  "POST /api/opd/appointments": {
    patient_id: SEED.patient,
    doctor_id: SEED.doctor,
    department_id: SEED.department,
    scheduled_at: "2099-01-01T09:00:00Z",
  },

  // ── Lab ─────────────────────────────────────────────────────
  "POST /api/lab/orders": {
    patient_id: SEED.patient,
    encounter_id: SEED.encounter,
    test_ids: [],
  },
  "POST /api/lab/results": {
    order_id: SEED.lab_order,
    test_id: SEED.lab_test,
    value: "Normal",
  },

  // ── Pharmacy ────────────────────────────────────────────────
  "POST /api/pharmacy/orders": {
    patient_id: SEED.patient,
    encounter_id: SEED.encounter,
    items: [],
  },
  "POST /api/pharmacy/substitutions": {
    original_drug_id: SEED.drug,
    substitute_drug_id: SEED.drug,
    reason: "smoke",
  },

  // ── Billing ─────────────────────────────────────────────────
  "POST /api/billing/invoices": {
    patient_id: SEED.patient,
    items: [],
  },
  "POST /api/billing/payments": {
    invoice_id: SEED.invoice,
    amount: 0,
    method: "cash",
  },

  // ── IPD ─────────────────────────────────────────────────────
  "POST /api/ipd/admissions": {
    patient_id: SEED.patient,
    admitting_doctor_id: SEED.doctor,
    department_id: SEED.department,
    admission_type: "elective",
  },
  "PUT /api/ipd/admissions/{id}/transfer": {
    target_ward_id: SEED.ward,
    target_bed_id: SEED.bed,
    reason: "smoke",
  },

  // ── Emergency ───────────────────────────────────────────────
  "POST /api/emergency/cases": {
    patient_id: SEED.patient,
    chief_complaint: "Smoke test",
    triage_level: "green",
  },

  // ── ICU / OT / CSSD ─────────────────────────────────────────
  "PUT /api/cssd/loads/{id}/status": { status: "issued" },

  // ── HR ──────────────────────────────────────────────────────
  "POST /api/admin/signature-credentials/{id}/revoke": { reason: "smoke" },
  "POST /api/admin/doctor-packages/{id}/inclusions": {
    service_id: SEED.service,
    quantity: 1,
  },

  // ── Camp ────────────────────────────────────────────────────
  "PUT /api/camp/lab-samples/{id}/link": {
    lab_order_id: SEED.lab_order,
  },

  // ── CDS ─────────────────────────────────────────────────────
  "PUT /api/cds/co-signatures/{id}": { signed: true },
  "PUT /api/cds/restricted-drug-approvals/{id}": { decision: "approved" },

  // ── Chronic care ────────────────────────────────────────────
  "PUT /api/chronic-care/enrollments/{id}/status": { status: "active" },
  "POST /api/chronic-care/targets": {
    enrollment_id: SEED.enrollment,
    metric: "hba1c",
    target_value: 7,
  },

  // ── CMS / Bridge / Bulk ─────────────────────────────────────
  "POST /api/bridge/register": {
    name: "smoke-bridge",
    endpoint: "https://example.invalid/bridge",
  },
  "POST /api/cms/posts/{id}/medical-review": { status: "approved" },
  "POST /api/cms/posts/{id}/schedule": { publish_at: "2099-01-01T00:00:00Z" },
  "POST /api/cms/tags/bulk-delete": { ids: [] },

  // ── Consent ─────────────────────────────────────────────────
  "POST /api/consent/revoke": { consent_id: SEED.consent, reason: "smoke" },
  "POST /api/consent/verify": { consent_id: SEED.consent },

  // ── Dashboards ──────────────────────────────────────────────
  "POST /api/dashboards/my/personalize": { layout: [] },

  // ── Setup / Admin ───────────────────────────────────────────
  "POST /api/setup/departments": {
    name: "Smoke Dept",
    code: "SMOKE",
  },
};

/**
 * Endpoints that the smoke generator should NOT exercise — typically
 * because they have side-effects we don't want in a smoke run, or
 * because they're streaming/auth flows.
 */
export const SKIP_ENDPOINTS: string[] = [
  "POST /api/auth/logout",
  "POST /api/auth/login",
  "POST /api/auth/refresh",
  "POST /api/onboarding/init",
  "POST /api/setup/seed",
  "DELETE /api/admin/tenants/{id}", // destructive
];
