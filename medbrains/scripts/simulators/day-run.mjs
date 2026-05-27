#!/usr/bin/env node
// Internal training-data simulator. Drives the live MedBrains HTTP API to
// generate one day's worth of OPD / IPD / ER activity against real
// registered patients. Every POST sets `is_dummy: true` so seeded rows are
// excluded from regulator-facing reports.
//
// Usage:
//   MEDBRAINS_API_BASE=http://localhost:8080 \
//   MEDBRAINS_TOKEN=<super_admin_jwt> \
//   node scripts/simulators/day-run.mjs \
//       --patients 20 --date 2026-05-24
//
// Required env:
//   MEDBRAINS_API_BASE  e.g. http://localhost:8080
//   MEDBRAINS_TOKEN     super_admin or hospital_admin JWT (Bearer)
//
// Optional flags:
//   --patients N        how many real patients to drive (default 10)
//   --date YYYY-MM-DD   simulated day (informational; record dates default to today on the server)
//   --opd-only          skip ER track
//   --er-only           skip OPD track
//   --dry-run           log requests but don't send

import process from "node:process";

const API_BASE = process.env.MEDBRAINS_API_BASE;
const TOKEN = process.env.MEDBRAINS_TOKEN;

if (!API_BASE || !TOKEN) {
  console.error(
    "MEDBRAINS_API_BASE and MEDBRAINS_TOKEN env vars are required (super_admin or hospital_admin JWT).",
  );
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));
const PATIENT_COUNT = Number(args.patients ?? 10);
const SIM_DATE = args.date ?? new Date().toISOString().slice(0, 10);
const SKIP_ER = Boolean(args["opd-only"]);
const SKIP_OPD = Boolean(args["er-only"]);
const DRY_RUN = Boolean(args["dry-run"]);

// ─── HTTP helper ─────────────────────────────────────────────
async function api(method, path, body) {
  const url = `${API_BASE}${path}`;
  if (DRY_RUN) {
    console.log(`[dry-run] ${method} ${path}`, body ? JSON.stringify(body).slice(0, 200) : "");
    // Fake-list responses for GETs so the workflow can be exercised end-to-end.
    if (method === "GET") {
      if (path.startsWith("/api/patients")) {
        return Array.from({ length: 5 }, (_, i) => ({ id: `dry-patient-${i + 1}` }));
      }
      if (path.startsWith("/api/admin/doctors")) {
        return [{ id: "dry-doctor-1", department_ids: ["dry-dept-1"] }];
      }
      if (path.startsWith("/api/admin/departments")) {
        return [{ id: "dry-dept-1" }];
      }
      if (path.startsWith("/api/lab/test-catalog")) {
        return [{ id: "dry-test-1" }];
      }
      if (path.startsWith("/api/radiology/modalities")) {
        return [{ id: "dry-modality-1" }];
      }
    }
    return { id: "dry-encounter-id" };
  }
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randDecimal = (min, max, decimals = 1) =>
  Number((Math.random() * (max - min) + min).toFixed(decimals));

// ─── Reference data (small fixed pools) ──────────────────────
const ICD10_OPD = [
  { code: "J00", desc: "Acute nasopharyngitis [common cold]" },
  { code: "J06.9", desc: "Acute upper respiratory infection" },
  { code: "R50.9", desc: "Fever, unspecified" },
  { code: "K30", desc: "Functional dyspepsia" },
  { code: "M54.5", desc: "Low back pain" },
  { code: "R51", desc: "Headache" },
  { code: "I10", desc: "Essential hypertension" },
  { code: "E11.9", desc: "Type 2 diabetes mellitus" },
  { code: "K59.0", desc: "Constipation" },
];

const CHIEF_COMPLAINTS = [
  "Fever for 2 days",
  "Cough and cold",
  "Headache since morning",
  "Body ache and weakness",
  "Stomach pain",
  "Sore throat",
  "Back pain",
  "Burning urination",
];

const ER_COMPLAINTS = [
  "Chest pain",
  "Road traffic accident",
  "Fall from height",
  "Acute abdominal pain",
  "Breathlessness",
  "Snake bite",
  "Seizure",
  "Loss of consciousness",
];

const RX_DRUGS = [
  { name: "Paracetamol 500mg", dosage: "1 tab", frequency: "TDS", duration: "3 days" },
  { name: "Amoxicillin 500mg", dosage: "1 cap", frequency: "TDS", duration: "5 days" },
  { name: "Pantoprazole 40mg", dosage: "1 tab", frequency: "OD", duration: "7 days" },
  { name: "Ibuprofen 400mg", dosage: "1 tab", frequency: "BD", duration: "3 days" },
  { name: "Cetirizine 10mg", dosage: "1 tab", frequency: "HS", duration: "5 days" },
];

const IPD_CONSUMABLES = [
  { name: "Gloves (sterile, pair)", qty: 4 },
  { name: "IV cannula 20G", qty: 2 },
  { name: "IV set", qty: 2 },
  { name: "Disposable syringe 5ml", qty: 6 },
  { name: "Cotton roll", qty: 1 },
];

// ─── Workflows ───────────────────────────────────────────────
async function listPatients() {
  const res = await api("GET", "/api/patients?per_page=200");
  return Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
}

async function listDoctors() {
  const res = await api("GET", "/api/admin/doctors?per_page=200");
  return Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
}

async function listDepartments() {
  // The system has setup-departments via patients service; if unavailable
  // we fall back to letting the encounter handler pick from doctor.department_ids.
  try {
    const res = await api("GET", "/api/admin/departments");
    return Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
  } catch {
    return [];
  }
}

async function listLabTests() {
  try {
    const res = await api("GET", "/api/lab/test-catalog");
    return Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
  } catch {
    return [];
  }
}

async function listRadiologyModalities() {
  try {
    const res = await api("GET", "/api/radiology/modalities");
    return Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
  } catch {
    return [];
  }
}

async function runOpdEpisode(patient, doctor, department, labs, modalities) {
  // 1) Create encounter (is_dummy flagged)
  const encounter = await api("POST", "/api/opd/encounters", {
    patient_id: patient.id,
    department_id: department?.id ?? doctor?.department_ids?.[0],
    doctor_id: doctor?.id,
    visit_type: "walk_in",
    notes: pick(CHIEF_COMPLAINTS),
    is_dummy: true,
  });

  const encId = encounter?.encounter?.id ?? encounter?.id;
  if (!encId) {
    console.warn("  · encounter id missing in response, skipping chain");
    return;
  }

  // 2) Vitals
  await api("POST", `/api/opd/encounters/${encId}/vitals`, {
    temperature: randDecimal(96.5, 99.8, 1),
    pulse: randInt(60, 95),
    systolic_bp: randInt(105, 135),
    diastolic_bp: randInt(65, 88),
    respiratory_rate: randInt(12, 20),
    spo2: randInt(96, 100),
    weight_kg: randDecimal(50, 90, 1),
    height_cm: randDecimal(150, 185, 1),
  });

  // 3) Diagnosis
  const dx = pick(ICD10_OPD);
  await api("POST", `/api/opd/encounters/${encId}/diagnoses`, {
    icd_code: dx.code,
    description: dx.desc,
    is_primary: true,
    certainty: "confirmed",
  });

  // 4) Prescription
  const items = Array.from({ length: randInt(1, 3) }, () => pick(RX_DRUGS));
  await api("POST", `/api/opd/encounters/${encId}/prescriptions`, {
    items: items.map((d) => ({
      drug_name: d.name,
      dosage: d.dosage,
      frequency: d.frequency,
      duration: d.duration,
    })),
  });

  // 5) ~25% lab order
  if (chance(0.25) && labs.length > 0) {
    const test = pick(labs);
    await api("POST", "/api/lab/orders", {
      encounter_id: encId,
      patient_id: patient.id,
      test_id: test.id,
      priority: "routine",
      is_dummy: true,
    });
  }

  // 6) ~15% radiology order
  if (chance(0.15) && modalities.length > 0) {
    const mod = pick(modalities);
    await api("POST", "/api/radiology/orders", {
      patient_id: patient.id,
      encounter_id: encId,
      modality_id: mod.id,
      clinical_indication: "Routine evaluation",
      priority: "routine",
      is_dummy: true,
    });
  }

  // 7) ~10% IPD admission escalated from OPD
  if (chance(0.1)) {
    await api("POST", "/api/ipd/admissions", {
      patient_id: patient.id,
      department_id: department?.id ?? doctor?.department_ids?.[0],
      doctor_id: doctor?.id,
      notes: "OPD-escalated admission",
      admission_source: "opd",
      is_dummy: true,
    });
  }

  return encId;
}

async function runErEpisode(patient, doctor) {
  const triageLevel = pick(["red", "yellow", "green"]);
  const visit = await api("POST", "/api/emergency/visits", {
    patient_id: patient.id,
    arrival_mode: pick(["walk_in", "ambulance", "police"]),
    chief_complaint: pick(ER_COMPLAINTS),
    is_dummy: true,
  });
  const visitId = visit?.id ?? visit?.visit?.id;
  if (!visitId) return;

  await api("POST", `/api/emergency/visits/${visitId}/triage`, {
    triage_level: triageLevel,
    score: randInt(1, 5),
    respiratory_rate: randInt(12, 22),
    pulse_rate: randInt(60, 110),
    blood_pressure_systolic: randInt(100, 150),
    blood_pressure_diastolic: randInt(60, 95),
    spo2: randInt(92, 100),
    chief_complaint: pick(ER_COMPLAINTS),
  });

  // ~40% of red/yellow → direct admission
  if (triageLevel !== "green" && chance(0.4)) {
    await api("POST", `/api/emergency/visits/${visitId}/admit`, {
      admitting_doctor_id: doctor?.id,
    });
  }
}

// ─── Main ─────────────────────────────────────────────────────
async function main() {
  console.log(`Day-run simulator → ${API_BASE}`);
  console.log(`  date=${SIM_DATE} patients=${PATIENT_COUNT} dry=${DRY_RUN}`);

  const [patients, doctors, departments, labs, modalities] = await Promise.all([
    listPatients(),
    listDoctors(),
    listDepartments(),
    listLabTests(),
    listRadiologyModalities(),
  ]);

  if (patients.length === 0) {
    throw new Error("No patients found. Register at least one real patient first.");
  }
  if (doctors.length === 0) {
    console.warn("No doctors found via /api/admin/doctors — encounters may fail without a doctor.");
  }
  console.log(
    `  pool: patients=${patients.length} doctors=${doctors.length} departments=${departments.length} labs=${labs.length} modalities=${modalities.length}`,
  );

  const selected = shuffle(patients).slice(0, PATIENT_COUNT);
  let opdDone = 0;
  let erDone = 0;
  for (const p of selected) {
    const doctor = doctors.length > 0 ? pick(doctors) : null;
    const department = departments.length > 0 ? pick(departments) : null;
    const goEr = !SKIP_ER && (SKIP_OPD || chance(0.1));
    try {
      if (goEr) {
        await runErEpisode(p, doctor);
        erDone += 1;
      } else if (!SKIP_OPD) {
        await runOpdEpisode(p, doctor, department, labs, modalities);
        opdDone += 1;
      }
    } catch (err) {
      console.warn(`  · ${p.id} failed:`, err.message);
    }
  }

  console.log(`\nDone. OPD episodes: ${opdDone}. ER episodes: ${erDone}.`);
  console.log(
    `Verify in psql: SELECT count(*) FROM encounters WHERE is_dummy = true AND encounter_date = '${SIM_DATE}';`,
  );
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const tok = argv[i];
    if (!tok.startsWith("--")) continue;
    const key = tok.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
