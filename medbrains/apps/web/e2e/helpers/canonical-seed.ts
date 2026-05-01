/**
 * Canonical fixture UUIDs used by smoke + Vitest tests.
 *
 * Every entity referenced via a path param in a smoke test resolves
 * here to a known UUID. The corresponding row is created by
 * `seed-fixtures.ts` against the live backend before smoke runs.
 *
 * **Don't edit casually.** Adding a new key requires:
 *   1. Adding seed logic in `seed-fixtures.ts`.
 *   2. Wiring it into `paramToSeed()` in `generate-api-smoke.mjs` so the
 *      generator substitutes the new UUID into matching path params.
 *   3. Adding a fixture in `apps/web/src/__fixtures__/` if the UI needs it.
 *
 * UUID layout (predictable for cross-test debugging):
 *   10000000-0000-4000-8000-XXXXXXXXXXXX
 *                            ↑↑↑↑↑↑↑↑↑↑↑↑
 *                            12-hex-digit suffix encodes (domain × 100 + entity)
 *   patient: 010, encounter: 020, lab: 030, ipd: 040, ot: 050,
 *   billing: 060, prescription: 070, regulatory: 080, hr: 090,
 *   facilities: 100, quality: 110, …
 */

const u = (suffix: string): string => {
  if (suffix.length !== 12) {
    throw new Error(`canonical-seed UUID suffix must be 12 hex chars, got '${suffix}'`);
  }
  return `10000000-0000-4000-8000-${suffix}`;
};

export const SEED = {
  // ── Tenant + auth (00x range) ─────────────────────────────────
  tenant: u("000000000001"),
  admin_user: u("000000000002"),
  doctor_user: u("000000000003"),
  nurse_user: u("000000000004"),

  // ── Identity (01x range) ──────────────────────────────────────
  patient: u("000000000010"),
  patient_alt: u("000000000011"), // for duplicate / merge tests
  newborn: u("000000000012"),
  donor: u("000000000013"),
  visitor: u("000000000014"),

  // ── OPD / encounter (02x range) ───────────────────────────────
  encounter: u("000000000020"),
  appointment: u("000000000021"),
  visit: u("000000000022"),
  queue_entry: u("000000000023"),
  consultation: u("000000000024"),

  // ── Diagnostics (03x range) ───────────────────────────────────
  lab_order: u("000000000030"),
  lab_test: u("000000000031"),
  lab_result: u("000000000032"),
  radiology_order: u("000000000033"),
  radiology_study: u("000000000034"),
  exam: u("000000000035"),
  blood_donation: u("000000000036"),
  transfusion: u("000000000037"),
  histopath_report: u("000000000038"),

  // ── IPD / ICU / OT (04-05x ranges) ────────────────────────────
  admission: u("000000000040"),
  bed: u("000000000041"),
  ward: u("000000000042"),
  icu_admission: u("000000000043"),
  cssd_load: u("000000000044"),
  ot_booking: u("000000000050"),
  surgery: u("000000000051"),
  ot_room: u("000000000052"),
  anaesthesia_record: u("000000000053"),

  // ── Pharmacy / Rx (07x range) ─────────────────────────────────
  pharmacy_order: u("000000000070"),
  prescription: u("000000000071"),
  drug: u("000000000072"),
  drug_interaction_rule: u("000000000073"),
  pharmacy_substitution: u("000000000074"),
  ndps_register_entry: u("000000000075"),

  // ── Billing / Insurance (06x range) ───────────────────────────
  invoice: u("000000000060"),
  payment: u("000000000061"),
  refund: u("000000000062"),
  estimate: u("000000000063"),
  insurance_claim: u("000000000064"),
  tpa_pkg: u("000000000065"),
  voucher: u("000000000066"),
  doctor_package: u("000000000067"),

  // ── Regulatory / Quality / Consent (08-11x) ───────────────────
  adr_report: u("000000000080"),
  mlc_record: u("000000000081"),
  pcpndt_form: u("000000000082"),
  consent: u("000000000083"),
  procedure_consent: u("000000000084"),
  consent_template: u("000000000085"),
  quality_capa: u("000000000110"),
  incident: u("000000000111"),
  audit_record: u("000000000112"),
  drill: u("000000000113"),
  proficiency_test: u("000000000114"),

  // ── HR (09x range) ────────────────────────────────────────────
  employee: u("000000000090"),
  attendance: u("000000000091"),
  leave_request: u("000000000092"),
  appraisal: u("000000000093"),
  training: u("000000000094"),
  shift_definition: u("000000000095"),
  duty_roster: u("000000000096"),

  // ── Facilities / Equipment (10x range) ────────────────────────
  equipment: u("000000000100"),
  work_order: u("000000000101"),
  fire_inspection: u("000000000102"),
  water_test: u("000000000103"),
  energy_reading: u("000000000104"),
  calibration: u("000000000105"),
  reagent_lot: u("000000000106"),

  // ── Inventory / Procurement (12x range) ───────────────────────
  indent: u("000000000120"),
  purchase_order: u("000000000121"),
  grn: u("000000000122"),
  vendor: u("000000000123"),
  store: u("000000000124"),
  store_item: u("000000000125"),
  asset_condemnation: u("000000000126"),
  implant: u("000000000127"),

  // ── Diet / Kitchen (13x range) ────────────────────────────────
  diet_order: u("000000000130"),
  meal_plan: u("000000000131"),
  recipe: u("000000000132"),

  // ── Emergency / Ambulance (14x range) ─────────────────────────
  emergency_case: u("000000000140"),
  ambulance: u("000000000141"),
  trip: u("000000000142"),
  triage_record: u("000000000143"),

  // ── MRD (15x range) ───────────────────────────────────────────
  mrd_record: u("000000000150"),
  birth_record: u("000000000151"),
  death_record: u("000000000152"),
  retention_policy: u("000000000153"),

  // ── Org / Setup (16x range) ───────────────────────────────────
  department: u("000000000160"),
  designation: u("000000000161"),
  service: u("000000000162"),
  location: u("000000000163"),
  campus: u("000000000164"),
  building: u("000000000165"),
  floor: u("000000000166"),
  room: u("000000000167"),
  doctor: u("000000000168"),
  role: u("000000000169"),

  // ── Camp / Community (17x range) ──────────────────────────────
  camp: u("000000000170"),
  camp_registration: u("000000000171"),
  camp_screening: u("000000000172"),
  camp_followup: u("000000000173"),

  // ── Chronic care / case mgmt (18x range) ──────────────────────
  enrollment: u("000000000180"),
  care_plan: u("000000000181"),
  case_assignment: u("000000000182"),
  case_barrier: u("000000000183"),
  referral: u("000000000184"),

  // ── Documents / Signatures (19x range) ────────────────────────
  document_output: u("000000000190"),
  signature: u("000000000191"),
  template_doc: u("000000000192"),

  // ── Front office / Visitor (20x range) ────────────────────────
  visitor_pass: u("000000000200"),
  enquiry_log: u("000000000201"),
  visiting_hour: u("000000000202"),

  // ── Communications / Notifications (21x range) ────────────────
  message: u("000000000210"),
  notification: u("000000000211"),
  channel: u("000000000212"),

  // ── CMS / Blog (22x range) ────────────────────────────────────
  cms_post: u("000000000220"),
  cms_tag: u("000000000221"),

  // ── Generic fallback (FFx range) ──────────────────────────────
  generic: u("000000000ffe"),
} as const;

export type SeedKey = keyof typeof SEED;

/**
 * Map a path-param name (without braces) to a SEED key.
 * Used by `generate-api-smoke.mjs` to substitute UUIDs.
 *
 * Returns undefined for unknown / un-seeded params — caller falls back
 * to SEED.generic so a placeholder UUID is still shape-valid.
 */
export const PARAM_TO_SEED: Record<string, SeedKey> = {
  // Patient family
  patient_id: "patient",
  pid: "patient",
  newborn_id: "newborn",
  donor_id: "donor",

  // OPD / encounter
  encounter_id: "encounter",
  appointment_id: "appointment",
  visit_id: "visit",

  // Diagnostics
  order_id: "lab_order",
  test_id: "lab_test",
  exam_id: "exam",
  study_id: "radiology_study",
  donation_id: "blood_donation",
  transfusion_id: "transfusion",

  // IPD / ICU / OT
  admission_id: "admission",
  bed_id: "bed",
  booking_id: "ot_booking",
  surgery_id: "surgery",
  ot_id: "ot_room",
  procedure_id: "surgery",

  // Pharmacy
  drug_id: "drug",
  prescription_id: "prescription",

  // Billing / insurance
  invoice_id: "invoice",
  payment_id: "payment",
  refund_id: "refund",
  estimate_id: "estimate",
  claim_id: "insurance_claim",
  voucher_id: "voucher",

  // Regulatory / quality
  report_id: "adr_report",
  consent_id: "consent",
  mlc_id: "mlc_record",
  capa_id: "quality_capa",
  incident_id: "incident",
  drill_id: "drill",

  // HR
  employee_id: "employee",
  leave_id: "leave_request",
  shift_id: "shift_definition",
  training_id: "training",

  // Facilities / equipment
  equipment_id: "equipment",
  work_order_id: "work_order",
  inspection_id: "fire_inspection",
  calibration_id: "calibration",
  pm_id: "work_order",

  // Inventory
  indent_id: "indent",
  po_id: "purchase_order",
  grn_id: "grn",
  item_id: "store_item",
  store_id: "store",
  condemnation_id: "asset_condemnation",
  requisition_id: "indent",

  // Org
  department_id: "department",
  doctor_id: "doctor",
  user_id: "admin_user",
  tenant_id: "tenant",
  device_id: "equipment",
  group_id: "role",
  module_id: "department",

  // Camp
  camp_id: "camp",
  registration_id: "camp_registration",

  // Chronic / case mgmt
  enrollment_id: "enrollment",
  assignment_id: "case_assignment",
  case_id: "case_assignment",

  // Documents
  doc_id: "document_output",
  sig_id: "signature",
  template_id: "template_doc",

  // Front office
  pass_id: "visitor_pass",

  // CMS
  post_id: "cms_post",

  // MRD
  record_id: "mrd_record",

  // Communications
  notification_id: "notification",
  ticket_id: "message",
  session_id: "encounter",

  // Misc
  task_id: "case_assignment",
  schedule_id: "appointment",
  certificate_id: "training",
  contract_id: "vendor",
  bond_id: "vendor",

  // Short generic ids — best guess; many routes use `{id}` and the
  // semantic meaning depends on the parent path segment. The generator
  // inspects the parent segment to pick a more specific seed.
  id: "generic",
  aid: "generic",
  bid: "generic",
  cid: "generic",
  did: "generic",
  eid: "generic",
  hid: "generic",
  iid: "generic",
  mid: "generic",
  nid: "generic",
  pa_id: "generic",
  qid: "generic",
  sub_id: "generic",
  tid: "generic",
  uid: "generic",
  wid: "generic",
};

/**
 * For ambiguous `{id}` params, look at the parent path segment to
 * pick a smarter seed. Used by `generate-api-smoke.mjs`.
 *
 * Order matters — more-specific patterns first.
 */
export const PARENT_SEGMENT_TO_SEED: Array<[RegExp, SeedKey]> = [
  [/\/patients\b/, "patient"],
  [/\/encounters\b/, "encounter"],
  [/\/appointments\b/, "appointment"],
  [/\/admissions\b/, "admission"],
  [/\/orders\b/, "lab_order"],
  [/\/results\b/, "lab_result"],
  [/\/invoices\b/, "invoice"],
  [/\/payments\b/, "payment"],
  [/\/prescriptions\b/, "prescription"],
  [/\/employees\b/, "employee"],
  [/\/equipments?\b/, "equipment"],
  [/\/work-orders\b/, "work_order"],
  [/\/inspections\b/, "fire_inspection"],
  [/\/drills\b/, "drill"],
  [/\/camps\b/, "camp"],
  [/\/departments\b/, "department"],
  [/\/devices\b/, "equipment"],
  [/\/users\b/, "admin_user"],
  [/\/roles\b/, "role"],
  [/\/groups\b/, "role"],
  [/\/incidents\b/, "incident"],
  [/\/consents\b/, "consent"],
  [/\/sessions\b/, "encounter"],
  [/\/visits\b/, "visit"],
  [/\/notifications\b/, "notification"],
  [/\/posts\b/, "cms_post"],
  [/\/templates\b/, "template_doc"],
  [/\/signatures\b/, "signature"],
];
