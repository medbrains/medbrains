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

  // ── Auth ────────────────────────────────────────────────────
  "POST /api/auth/change-password": {
    current_password: "current-password",
    new_password: "Smoke!Password2026",
  },

  // ── Billing extra ───────────────────────────────────────────
  "POST /api/billing/advances/{id}/adjust": {
    invoice_id: SEED.invoice,
    amount: 0,
  },
  "POST /api/billing/copay/calculate": {
    invoice_id: SEED.invoice,
  },
  "POST /api/billing/credit-notes/{id}/apply": {
    invoice_id: SEED.invoice,
  },
  "POST /api/billing/erp/export": {
    target_system: "tally",
    export_type: "journal",
  },
  "POST /api/billing/insurance-claims/{id}/reimbursement-docs": {
    documents: {},
  },
  "POST /api/billing/invoices/interim": {
    encounter_id: SEED.encounter,
    patient_id: SEED.patient,
  },
  "POST /api/billing/invoices/{id}/items": {
    charge_code: "SMOKE",
    description: "Smoke item",
    source: "manual",
    quantity: 1,
    unit_price: 0,
  },
  "POST /api/billing/tds/{id}/deposit": {
    challan_number: "SMOKE-CHL-1",
    challan_date: "2099-01-01",
  },
  "POST /api/billing/write-offs/{id}/approve": {
    approved: true,
  },
  "POST /api/billing/auto-charge": {
    encounter_id: SEED.encounter,
    source: "manual",
    source_id: SEED.encounter,
    items: [],
  },
  "POST /api/billing/bank-transactions/import": {
    transactions: [],
  },

  // ── Pharmacy extra ──────────────────────────────────────────
  "POST /api/pharmacy/formulary/check": { drug_id: SEED.drug },
  "POST /api/pharmacy/safety/allergy-check": {
    patient_id: SEED.patient,
    drug_ids: [],
  },
  "POST /api/pharmacy/otc-sale": { items: [] },
  "POST /api/pharmacy/interactions/check": {
    patient_id: SEED.patient,
    drug_ids: [],
  },
  "POST /api/pharmacy/coverage-checks": {
    patient_id: SEED.patient,
    drug_ids: [],
  },
  "POST /api/pharmacy/counseling": {
    patient_id: SEED.patient,
    notes: "smoke",
  },
  "POST /api/pharmacy/stock/transactions": {
    drug_id: SEED.drug,
    transaction_type: "adjustment",
    quantity: 0,
  },
  "POST /api/pharmacy/substitutes": {
    drug_id: SEED.drug,
  },

  // ── Lab extra ───────────────────────────────────────────────
  "POST /api/lab/orders/{id}/add-on": { test_id: SEED.lab_test },
  "POST /api/lab/orders/{id}/results/amend": {
    parameter_name: "smoke",
    value: "0",
    reason: "smoke",
  },
  "POST /api/lab/reports/bulk-print": { order_ids: [] },
  "POST /api/lab/home-collections/{id}/status": { status: "scheduled" },

  // ── Nurse ───────────────────────────────────────────────────
  "POST /api/nurse/fall-risk": {
    encounter_id: SEED.encounter,
    scale: "morse",
    score: 0,
    risk_level: "low",
  },
  "POST /api/nurse/handoffs": {
    encounter_id: SEED.encounter,
    incoming_nurse_id: SEED.nurse_user,
  },
  "POST /api/nurse/pain-entries": {
    encounter_id: SEED.encounter,
    scale: "nrs",
    score: 0,
  },
  "POST /api/nurse/wounds": {
    encounter_id: SEED.encounter,
    body_site: "smoke",
  },

  // ── OPD extra ───────────────────────────────────────────────
  "POST /api/opd/procedure-orders": {
    patient_id: SEED.patient,
    encounter_id: SEED.encounter,
    procedure_id: SEED.service,
  },
  "POST /api/opd/appointment-groups": {
    name: "Smoke group",
  },
  "POST /api/opd/certificates": {
    patient_id: SEED.patient,
    certificate_type: "fitness",
  },

  // ── Documents ───────────────────────────────────────────────
  "POST /api/documents/generate": {
    template_id: SEED.template_doc,
    entity_id: SEED.patient,
  },
  "POST /api/documents/generate/batch": {
    template_id: SEED.template_doc,
    entity_ids: [],
  },
  "POST /api/documents/outputs/{id}/void": { reason: "smoke" },

  // ── Indent ──────────────────────────────────────────────────
  "POST /api/indent/department-issues": {
    indent_id: SEED.indent,
    items: [],
  },
  "POST /api/indent/returns": {
    indent_id: SEED.indent,
    items: [],
  },
  "POST /api/indent/consignment-usage": {
    catalog_item_id: SEED.drug,
    quantity: 0,
  },

  // ── Infection control ───────────────────────────────────────
  "POST /api/infection-control/exposures": {
    exposure_type: "needle_stick",
    exposure_date: "2099-01-01",
  },
  "PATCH /api/infection-control/stewardship/{id}": {
    decision: "approved",
  },

  // ── Quality ─────────────────────────────────────────────────
  "POST /api/quality/audits/schedule": {
    audit_type: "internal",
    scheduled_date: "2099-01-01",
  },
  "POST /api/quality/mortality-reviews": {
    patient_id: SEED.patient,
    review_date: "2099-01-01",
  },

  // ── HR ──────────────────────────────────────────────────────
  "POST /api/hr/statutory-records": {
    employee_id: SEED.employee,
    record_type: "pf",
  },
  "POST /api/hr/training-records": {
    employee_id: SEED.employee,
    program_id: SEED.training,
  },

  // ── IT onboarding ───────────────────────────────────────────
  "POST /api/it-onboarding/complete-step": {
    step_id: "smoke-step",
  },
  "POST /api/onboarding/setup": {
    tenant_name: "Smoke Tenant",
  },

  // ── Procurement ─────────────────────────────────────────────
  "POST /api/procurement/emergency-purchase": {
    vendor_id: SEED.vendor,
    items: [],
    justification: "smoke",
  },

  // ── Public kiosk ────────────────────────────────────────────
  "POST /api/public/kiosk/checkin": { qr_data: "smoke" },

  // ── Bridge ──────────────────────────────────────────────────
  "POST /api/bridge/register": {
    name: "smoke-bridge",
    endpoint: "https://example.invalid/bridge",
  },

  // ── Order sets / packages ───────────────────────────────────
  "POST /api/order-sets/activate": {
    template_id: SEED.template_doc,
    encounter_id: SEED.encounter,
  },
  "POST /api/order-sets/templates/{id}/items": {
    item_type: "lab",
    item_id: SEED.lab_test,
  },
  "POST /api/orders/basket/check": {
    encounter_id: SEED.encounter,
    items: [],
  },
  "POST /api/patient-packages/subscribe": {
    patient_id: SEED.patient,
    package_id: SEED.tpa_pkg,
  },
  "POST /api/patient-packages/{id}/consume": {
    quantity: 1,
  },

  // ── Payments ────────────────────────────────────────────────
  "POST /api/payments/create-order": {
    invoice_id: SEED.invoice,
    amount: 0,
  },
  "POST /api/payments/refund": {
    payment_id: SEED.payment,
    amount: 0,
  },

  // ── Radiology ───────────────────────────────────────────────
  "POST /api/radiology/orders/{id}/dose": {
    dose_value: 0,
    dose_unit: "mGy",
  },

  // ── Regulatory ──────────────────────────────────────────────
  "POST /api/regulatory/checklists/{id}/items": {
    requirement: "smoke",
    status: "pending",
  },

  // ── Retrospective ───────────────────────────────────────────
  "POST /api/retrospective/encounters": {
    patient_id: SEED.patient,
    department_id: SEED.department,
    encounter_date: "2099-01-01",
  },

  // ── LMS ─────────────────────────────────────────────────────
  "POST /api/lms/courses/ai-generate": { topic: "smoke" },
  "POST /api/lms/courses/{id}/modules": {
    title: "Smoke module",
    order_index: 0,
  },
  "POST /api/lms/enrollments/bulk-role": {
    role: "doctor",
    course_ids: [],
  },
  "POST /api/lms/paths/{id}/courses": {
    course_id: SEED.template_doc,
  },

  // ── CMS ─────────────────────────────────────────────────────
  "POST /api/cms/posts/{id}/medical-review": { status: "approved" },
  "POST /api/cms/posts/{id}/schedule": { publish_at: "2099-01-01T00:00:00Z" },
  "POST /api/cms/tags/bulk-delete": { ids: [] },

  // ── Multi-hospital ──────────────────────────────────────────
  "POST /api/multi-hospital/transfers/stock": {
    source_hospital_id: SEED.tenant,
    target_hospital_id: SEED.tenant,
    items: [],
  },

  // ── Integration ─────────────────────────────────────────────
  "POST /api/integration/code-snippets/test": { code: "console.log('smoke')" },
  "POST /api/integration/code/ai-generate": { prompt: "smoke" },

  // ── Bedside ─────────────────────────────────────────────────
  "POST /api/bedside/{id}/feedback": {
    rating: 5,
    comment: "smoke",
  },
  "POST /api/bedside/{id}/nurse-request": {
    request_type: "general",
    priority: "low",
  },
  "PUT /api/bedside/nurse-requests/{id}/status": { status: "acknowledged" },

  // ── BME / Ambulance ─────────────────────────────────────────
  "PUT /api/bme/breakdowns/{id}/status": { status: "resolved" },
  "PUT /api/ambulance/fleet/{id}/location": {
    latitude: 0,
    longitude: 0,
  },
  "PUT /api/ambulance/trips/{id}/status": { status: "completed" },

  // ── Blood bank extra ────────────────────────────────────────
  "POST /api/blood-bank/returns": {
    component_id: SEED.transfusion,
    return_reason: "smoke",
  },
  "PUT /api/blood-bank/components/{id}/status": { status: "available" },
  "PUT /api/blood-bank/transfusions/{id}/reaction": {
    reaction_type: "none",
    severity: "mild",
  },

  // ── CSSD / Diet ─────────────────────────────────────────────
  "PUT /api/diet/meal-preps/{id}/status": { status: "ready" },
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
