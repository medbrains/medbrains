#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { spawnSync } from "node:child_process";

const DEFAULT_CONFIG = {
  profile: "dev_stream",
  profile_type: "demo",
  tenant_code: "DEFAULT",
  run_id: "",
  tick_seconds: 5,
  patients_per_tick: 2,
  total_patients: 20,
  batch_size: 20,
  seed: 7,
  modules: {
    opd: true,
    vitals: true,
    lab: true,
    radiology: true,
    pharmacy: true,
  },
  probabilities: {
    lab_order: 0.65,
    lab_result: 0.9,
    radiology_order: 0.25,
    pharmacy_order: 0.35,
    queue_completed: 0.55,
  },
  departments: ["GEN-MEDICINE", "PEDIATRICS", "ORTHOPEDICS", "ENT"],
  villages: [
    { name: "Demo Village", pincode: "600001", district: "Chennai", state: "Tamil Nadu" },
  ],
};

const FIRST_NAMES = [
  "Aarav",
  "Ananya",
  "Arun",
  "Divya",
  "Kavin",
  "Lakshmi",
  "Meena",
  "Prakash",
  "Ravi",
  "Sahana",
  "Selvi",
  "Vikram",
];
const LAST_NAMES = [
  "Kumar",
  "Raman",
  "Devi",
  "Natarajan",
  "Murugan",
  "Patel",
  "Sharma",
  "Iyer",
  "Das",
  "Balan",
];
const LAB_RESULT_SETS = [
  [
    ["Hemoglobin", "13.8", "g/dL", "13.0-17.0", "normal"],
    ["WBC", "8.1", "10^3/uL", "4.0-11.0", "normal"],
    ["Platelets", "256", "10^3/uL", "150-450", "normal"],
  ],
  [
    ["Fasting Glucose", "168", "mg/dL", "70-110", "high"],
    ["HbA1c", "8.1", "%", "4.0-5.6", "high"],
  ],
  [
    ["Creatinine", "1.1", "mg/dL", "0.6-1.3", "normal"],
    ["Urea", "32", "mg/dL", "15-40", "normal"],
  ],
];
const RADIOLOGY_FIXTURES = [
  ["CT", "CT Brain Plain", "Headache with dizziness", "/demo/dicom/ct-brain-plain-demo.dcm"],
  ["US", "US Abdomen", "Abdominal pain", "/demo/dicom/us-abdomen-demo.dcm"],
  ["CR", "Chest X-Ray PA", "Cough and fever", "/demo/dicom/chest-xray-pa-demo.dcm"],
  ["MR", "MRI Right Knee", "Knee pain", "/demo/dicom/mri-right-knee-demo.dcm"],
  ["DX", "Left Hand X-Ray", "Fall injury", "/demo/dicom/left-hand-xray-demo.dcm"],
];

function parseArgs(argv) {
  const args = {
    command: "run",
    config: "configs/simulators/hospital-stream.demo.json",
    mode: "stream",
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "cleanup") args.command = "cleanup";
    else if (arg === "--config" && next) args.config = next, i += 1;
    else if (arg === "--run-id" && next) args.run_id = next, i += 1;
    else if (arg === "--patients" && next) args.total_patients = Number(next), i += 1;
    else if (arg === "--rate" && next) args.patients_per_tick = Number(next), i += 1;
    else if (arg === "--tick-seconds" && next) args.tick_seconds = Number(next), i += 1;
    else if (arg === "--batch") args.mode = "batch";
    else if (arg === "--stream") args.mode = "stream";
    else if (arg === "--allow-non-local") args.allow_non_local = true;
    else if (arg === "--reset") args.reset = true;
    else if (arg === "--help" || arg === "-h") args.command = "help";
  }
  return args;
}

function loadConfig(args) {
  const fileConfig = JSON.parse(readFileSync(args.config, "utf8"));
  const config = mergeConfig(DEFAULT_CONFIG, fileConfig);
  for (const key of ["run_id", "total_patients", "patients_per_tick", "tick_seconds"]) {
    if (args[key] !== undefined) config[key] = args[key];
  }
  if (!config.run_id) {
    config.run_id = `${config.profile}-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
  }
  return config;
}

function mergeConfig(base, override) {
  const out = { ...base, ...override };
  out.modules = { ...base.modules, ...(override.modules ?? {}) };
  out.probabilities = { ...base.probabilities, ...(override.probabilities ?? {}) };
  return out;
}

function assertSafeMode(config, args, databaseUrl) {
  if (config.profile_type === "actual") {
    throw new Error("actual mode cannot synthesize records. Use real bridge/device ingest for actual data.");
  }
  if (args.allow_non_local) return;
  const url = new URL(databaseUrl);
  if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
    throw new Error(
      `Refusing to write simulator data to non-local database ${url.host}. Pass --allow-non-local only for a throwaway test database.`,
    );
  }
}

function psql(databaseUrl, sql, options = {}) {
  const result = spawnSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-At", "-F", "\t", "-c", sql], {
    encoding: "utf8",
    maxBuffer: options.maxBuffer ?? 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "psql failed").trim());
  }
  return result.stdout.trim();
}

function sql(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function jsonSql(value) {
  return `${sql(JSON.stringify(value))}::jsonb`;
}

function num(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "NULL";
  return String(value);
}

function makeRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function pick(rng, items) {
  return items[Math.floor(rng() * items.length)] ?? items[0];
}

function chance(rng, probability) {
  return rng() < probability;
}

function dateOfBirth(index, rng) {
  const age = 1 + Math.floor(rng() * 78);
  const month = 1 + ((index + Math.floor(rng() * 12)) % 12);
  const day = 1 + ((index + Math.floor(rng() * 26)) % 26);
  return `${new Date().getFullYear() - age}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getContext(databaseUrl, tenantCode, departments, validate = true) {
  const departmentList = departments.map(sql).join(",");
  const query = `
    WITH tenant_row AS (
      SELECT id FROM tenants WHERE code = ${sql(tenantCode)} LIMIT 1
    )
    SELECT json_build_object(
      'tenant_id', (SELECT id FROM tenant_row),
      'user_id', (
        SELECT id FROM users
        WHERE tenant_id = (SELECT id FROM tenant_row)
        ORDER BY CASE WHEN role = 'super_admin' THEN 0 ELSE 1 END, created_at
        LIMIT 1
      ),
      'doctor_id', COALESCE(
        (SELECT id FROM users WHERE tenant_id = (SELECT id FROM tenant_row) AND role = 'doctor' ORDER BY created_at LIMIT 1),
        (SELECT id FROM users WHERE tenant_id = (SELECT id FROM tenant_row) ORDER BY created_at LIMIT 1)
      ),
      'departments', COALESCE((
        SELECT json_object_agg(code, id)
        FROM departments
        WHERE tenant_id = (SELECT id FROM tenant_row) AND code IN (${departmentList})
      ), '{}'::json),
      'lab_tests', COALESCE((
        SELECT json_agg(json_build_object('id', id, 'code', code, 'name', name))
        FROM (SELECT id, code, name FROM lab_test_catalog WHERE tenant_id = (SELECT id FROM tenant_row) AND is_active ORDER BY name LIMIT 20) t
      ), '[]'::json),
      'modalities', COALESCE((
        SELECT json_agg(json_build_object('id', id, 'code', code, 'name', name))
        FROM radiology_modalities WHERE tenant_id = (SELECT id FROM tenant_row) AND is_active
      ), '[]'::json),
      'drugs', COALESCE((
        SELECT json_agg(json_build_object('id', id, 'name', name, 'price', base_price))
        FROM (SELECT id, name, base_price FROM pharmacy_catalog WHERE tenant_id = (SELECT id FROM tenant_row) AND is_active ORDER BY name LIMIT 25) d
      ), '[]'::json),
      'lab_device_id', (
        SELECT id FROM device_instances WHERE tenant_id = (SELECT id FROM tenant_row) AND code = 'SIM-LAB-ANALYZER' LIMIT 1
      ),
      'pacs_device_id', (
        SELECT id FROM device_instances WHERE tenant_id = (SELECT id FROM tenant_row) AND code = 'SIM-PACS-GATEWAY' LIMIT 1
      )
    );
  `;
  const output = psql(databaseUrl, query);
  if (!output) throw new Error(`Tenant not found: ${tenantCode}`);
  const context = JSON.parse(output);
  if (!context.tenant_id || !context.user_id) throw new Error("Simulator requires tenant and admin user seed first.");
  if (Object.keys(context.departments ?? {}).length === 0) {
    throw new Error("Simulator requires department masters. Run make dev once to seed masters.");
  }
  if (validate) {
    if ((context.lab_tests ?? []).length === 0) throw new Error("Simulator requires lab test catalog masters.");
    if ((context.modalities ?? []).length === 0) throw new Error("Simulator requires radiology modalities.");
    if ((context.drugs ?? []).length === 0) throw new Error("Simulator requires pharmacy catalog masters.");
  }
  return context;
}

function ensureSimulatorMasters(databaseUrl, tenantId) {
  psql(databaseUrl, `
    WITH dept AS (
      SELECT id, code FROM departments
      WHERE tenant_id = ${sql(tenantId)}
        AND code IN ('PATHOLOGY', 'RADIOLOGY', 'PHARMACY')
    )
    INSERT INTO lab_test_catalog
      (tenant_id, code, name, department_id, sample_type, normal_range, unit, price, tat_hours,
       loinc_code, method, allows_add_on, fallback_analyzer)
    VALUES
      (${sql(tenantId)}, 'SIM-CBC', 'Simulator Complete Blood Count',
       (SELECT id FROM dept WHERE code = 'PATHOLOGY'), 'EDTA Blood', NULL, NULL, 250, 4,
       '57021-8', 'HL7 ORU simulator', true, 'SIM-LAB-ANALYZER'),
      (${sql(tenantId)}, 'SIM-GLU', 'Simulator Glucose Profile',
       (SELECT id FROM dept WHERE code = 'PATHOLOGY'), 'Serum', NULL, NULL, 180, 2,
       '2339-0', 'HL7 ORU simulator', true, 'SIM-LAB-ANALYZER')
    ON CONFLICT (tenant_id, code) DO UPDATE SET
      name = EXCLUDED.name,
      is_active = true;

    INSERT INTO radiology_modalities (tenant_id, code, name, description, is_active)
    VALUES
      (${sql(tenantId)}, 'CT', 'Computed Tomography', 'Simulator CT modality', true),
      (${sql(tenantId)}, 'US', 'Ultrasound', 'Simulator ultrasound modality', true),
      (${sql(tenantId)}, 'CR', 'Computed Radiography', 'Simulator X-Ray modality', true),
      (${sql(tenantId)}, 'MR', 'Magnetic Resonance Imaging', 'Simulator MRI modality', true),
      (${sql(tenantId)}, 'DX', 'Digital X-Ray', 'Simulator DX modality', true)
    ON CONFLICT (tenant_id, code) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      is_active = true;

    INSERT INTO pharmacy_catalog
      (tenant_id, code, name, generic_name, category, unit, base_price, tax_percent, current_stock,
       reorder_level, drug_schedule, inn_name, atc_code, formulary_status, aware_category,
       batch_tracking_required, gst_rate, prescription_only)
    VALUES
      (${sql(tenantId)}, 'SIM-PARA-500', 'Paracetamol 500 mg Tablet', 'Paracetamol',
       'Analgesic', 'tablet', 2.50, 0, 10000, 500, 'OTC', 'Paracetamol', 'N02BE01',
       'approved', 'access', true, 0, false),
      (${sql(tenantId)}, 'SIM-AMOX-500', 'Amoxicillin 500 mg Capsule', 'Amoxicillin',
       'Antibiotic', 'capsule', 8.00, 0, 5000, 300, 'H', 'Amoxicillin', 'J01CA04',
       'approved', 'access', true, 0, true)
    ON CONFLICT (tenant_id, code) DO UPDATE SET
      name = EXCLUDED.name,
      current_stock = GREATEST(pharmacy_catalog.current_stock, EXCLUDED.current_stock),
      is_active = true;
  `);
}

function ensureSimulatorDevices(databaseUrl, tenantId, userId) {
  psql(databaseUrl, `
    INSERT INTO device_instances
      (tenant_id, adapter_code, name, code, hostname, port, protocol_config, field_mappings,
       data_transforms, qc_config, ai_config_version, ai_confidence, config_source, status,
       notes, tags, created_by)
    VALUES
      (${sql(tenantId)}, 'sim_hl7_oru', 'Simulator HL7 Lab Analyzer', 'SIM-LAB-ANALYZER',
       'simulator.local', 2575, '{"protocol":"hl7_v2"}', '[]', '[]', '{}',
       1, 0.99, 'manual', 'active', 'Dev-only hospital stream simulator device.',
       ARRAY['simulator','dev','lab'], ${sql(userId)}),
      (${sql(tenantId)}, 'sim_dicom_pacs', 'Simulator PACS Gateway', 'SIM-PACS-GATEWAY',
       'simulator.local', 104, '{"protocol":"dicomweb"}', '[]', '[]', '{}',
       1, 0.99, 'manual', 'active', 'Dev-only PACS stream simulator device.',
       ARRAY['simulator','dev','radiology'], ${sql(userId)})
    ON CONFLICT (tenant_id, code) DO UPDATE SET
      status = 'active',
      last_heartbeat = now(),
      notes = EXCLUDED.notes,
      tags = EXCLUDED.tags;
  `);
}

function patientFlowSql(config, context, index, rng) {
  const firstName = pick(rng, FIRST_NAMES);
  const lastName = pick(rng, LAST_NAMES);
  const gender = pick(rng, ["male", "female", "other"]);
  const village = pick(rng, config.villages);
  const deptCode = pick(rng, config.departments);
  const departmentId = context.departments[deptCode] ?? Object.values(context.departments)[0];
  const labTest = pick(rng, context.lab_tests);
  const modality = pick(rng, context.modalities);
  const drug = pick(rng, context.drugs);
  const radio = pick(rng, RADIOLOGY_FIXTURES);
  const resultSet = pick(rng, LAB_RESULT_SETS);
  const shouldLab = config.modules.lab && chance(rng, config.probabilities.lab_order);
  const shouldLabResult = shouldLab && chance(rng, config.probabilities.lab_result);
  const shouldRadiology = config.modules.radiology && chance(rng, config.probabilities.radiology_order);
  const shouldPharmacy = config.modules.pharmacy && chance(rng, config.probabilities.pharmacy_order);
  const queueCompleted = chance(rng, config.probabilities.queue_completed);
  const runToken = config.run_id.replace(/[^A-Za-z0-9]/g, "").slice(0, 14).toUpperCase() || "SIM";
  const uhid = `SIM-${runToken}-${String(index).padStart(7, "0")}`;
  const barcode = `SIMLAB-${runToken}-${String(index).padStart(7, "0")}`;
  const accession = `SIMRAD-${runToken}-${String(index).padStart(7, "0")}`;
  const tokenNumber = 500000 + index;
  const dob = dateOfBirth(index, rng);
  const phone = `9000${String(index).padStart(6, "0").slice(-6)}`;
  const attrs = {
    simulated: true,
    sim_run_id: config.run_id,
    sim_profile: config.profile,
    sim_profile_type: config.profile_type,
    village: village.name,
    pincode: village.pincode,
    district: village.district,
    state: village.state,
    disclaimer: "Synthetic test data. Not actual patient activity.",
  };
  const vitals = {
    temperature: 97.4 + rng() * 3.2,
    pulse: 62 + Math.floor(rng() * 44),
    sbp: 104 + Math.floor(rng() * 52),
    dbp: 66 + Math.floor(rng() * 28),
    rr: 14 + Math.floor(rng() * 8),
    spo2: 94 + Math.floor(rng() * 6),
    weight: 42 + rng() * 46,
    height: 145 + rng() * 38,
  };
  const bmi = vitals.weight / ((vitals.height / 100) ** 2);

  return `
    WITH patient AS (
      INSERT INTO patients
        (tenant_id, uhid, first_name, last_name, date_of_birth, gender, phone, address,
         category, registration_type, registration_source, financial_class, attributes,
         source_system, created_by, registered_by)
      VALUES
        (${sql(context.tenant_id)}, ${sql(uhid)}, ${sql(firstName)}, ${sql(lastName)},
         ${sql(dob)}::date, ${sql(gender)}::gender, ${sql(phone)},
         ${jsonSql({ line1: village.name, village: village.name, district: village.district, state: village.state, pincode: village.pincode })},
         'general'::patient_category, 'new'::registration_type, 'walk_in'::registration_source,
         'self_pay'::financial_class, ${jsonSql(attrs)}, 'simulator', ${sql(context.user_id)}, ${sql(context.user_id)})
      RETURNING id
    ),
    encounter AS (
      INSERT INTO encounters
        (tenant_id, patient_id, encounter_type, status, department_id, doctor_id, encounter_date,
         notes, attributes, visit_type, created_by)
      SELECT ${sql(context.tenant_id)}, id, 'opd'::encounter_type, ${sql(queueCompleted ? "open" : "open")}::encounter_status,
             ${sql(departmentId)}, ${sql(context.doctor_id)}, CURRENT_DATE,
             ${sql(`Simulator OPD visit. run_id=${config.run_id}`)}, ${jsonSql(attrs)}, 'walk_in', ${sql(context.user_id)}
      FROM patient
      RETURNING id, patient_id
    ),
    queue_row AS (
      INSERT INTO opd_queues
        (tenant_id, encounter_id, department_id, doctor_id, token_number, status, queue_date,
         called_at, completed_at, created_by)
      SELECT ${sql(context.tenant_id)}, id, ${sql(departmentId)}, ${sql(context.doctor_id)}, ${tokenNumber},
             ${sql(queueCompleted ? "completed" : "waiting")}::queue_status, CURRENT_DATE,
             ${queueCompleted ? "now() - interval '8 minutes'" : "NULL"},
             ${queueCompleted ? "now()" : "NULL"},
             ${sql(context.user_id)}
      FROM encounter
      RETURNING id
    )
    ${config.modules.vitals ? `,
    vital_row AS (
      INSERT INTO vitals
        (tenant_id, encounter_id, recorded_by, temperature, pulse, systolic_bp, diastolic_bp,
         respiratory_rate, spo2, weight_kg, height_cm, bmi, notes)
      SELECT ${sql(context.tenant_id)}, id, ${sql(context.user_id)}, ${num(vitals.temperature.toFixed(1))},
             ${num(vitals.pulse)}, ${num(vitals.sbp)}, ${num(vitals.dbp)}, ${num(vitals.rr)},
             ${num(vitals.spo2)}, ${num(vitals.weight.toFixed(2))}, ${num(vitals.height.toFixed(1))},
             ${num(bmi.toFixed(1))}, ${sql(`Simulator vitals. run_id=${config.run_id}`)}
      FROM encounter
      RETURNING id
    )` : ""}
    ${shouldLab ? `,
    lab_order AS (
      INSERT INTO lab_orders
        (tenant_id, encounter_id, patient_id, test_id, ordered_by, status, priority, notes,
         sample_barcode, collected_at, collected_by, report_status, completed_at)
      SELECT ${sql(context.tenant_id)}, id, patient_id, ${sql(labTest.id)}, ${sql(context.doctor_id)},
             ${sql(shouldLabResult ? "completed" : "sample_collected")}::lab_order_status, 'routine'::lab_priority,
             ${sql(`Simulator lab order for ${labTest.name}. run_id=${config.run_id}`)},
             ${sql(barcode)}, now() - interval '5 minutes', ${sql(context.user_id)},
             ${shouldLabResult ? "'final'::lab_report_status" : "NULL"},
             ${shouldLabResult ? "now()" : "NULL"}
      FROM encounter
      RETURNING id, patient_id
    )` : ""}
    ${shouldLabResult ? `,
    lab_results_insert AS (
      INSERT INTO lab_results (tenant_id, order_id, parameter_name, value, unit, normal_range, flag)
      SELECT ${sql(context.tenant_id)}, lab_order.id, value->>0, value->>1, value->>2, value->>3,
             (value->>4)::lab_result_flag
      FROM lab_order, jsonb_array_elements(${jsonSql(resultSet)}) AS value
      RETURNING id
    ),
    lab_device_message AS (
      INSERT INTO device_messages
        (tenant_id, device_instance_id, direction, protocol, parsed_payload, mapped_data,
         processing_status, target_module, target_entity_id, processing_duration_ms)
      SELECT ${sql(context.tenant_id)}, ${sql(context.lab_device_id)}, 'inbound', 'hl7_v2',
             ${jsonSql({ message_type: "ORU^R01", sample_barcode: barcode, sim_run_id: config.run_id })},
             ${jsonSql({ identifiers: { sample_barcode: barcode, uhid }, results: resultSet })},
             'delivered'::device_message_status, 'lab', lab_order.id, ${10 + Math.floor(rng() * 30)}
      FROM lab_order
      RETURNING id
    )` : ""}
    ${shouldRadiology ? `,
    radiology_order AS (
      INSERT INTO radiology_orders
        (tenant_id, patient_id, encounter_id, modality_id, ordered_by, body_part, clinical_indication,
         priority, status, completed_at, notes, pacs_study_uid, orthanc_id)
      SELECT ${sql(context.tenant_id)}, patient_id, id, ${sql(modality.id)}, ${sql(context.doctor_id)},
             ${sql(radio[1])}, ${sql(radio[2])}, 'routine'::radiology_priority,
             'completed'::radiology_order_status, now(), ${sql(`Simulator radiology order. run_id=${config.run_id}`)},
             ${sql(`1.2.826.0.1.3680043.10.543.${index}`)}, ${sql(`sim-orthanc-${runToken}-${index}`)}
      FROM encounter
      RETURNING id, patient_id
    ),
    dicom_study AS (
      INSERT INTO radiology_dicom_studies
        (tenant_id, order_id, patient_id, study_instance_uid, accession_number, modality, study_date,
         study_description, referring_physician, instance_count, series_count, orthanc_id, pacs_url,
         viewer_url, file_size_bytes, dicom_metadata)
      SELECT ${sql(context.tenant_id)}, id, patient_id, ${sql(`1.2.826.0.1.3680043.10.543.${index}`)},
             ${sql(accession)}, ${sql(radio[0])}, CURRENT_DATE, ${sql(`${radio[1]} - Simulator`)},
             'MedBrains Simulator', ${1 + Math.floor(rng() * 64)}, ${1 + Math.floor(rng() * 5)},
             ${sql(`sim-orthanc-${runToken}-${index}`)}, ${sql(radio[3])},
             ${sql(radio[3].replace(".dcm", ".html"))}, ${200000 + Math.floor(rng() * 1800000)},
             ${jsonSql({ sim_run_id: config.run_id, simulated: true, accession })}
      FROM radiology_order
      RETURNING id
    ),
    pacs_device_message AS (
      INSERT INTO device_messages
        (tenant_id, device_instance_id, direction, protocol, parsed_payload, mapped_data,
         processing_status, target_module, target_entity_id, processing_duration_ms)
      SELECT ${sql(context.tenant_id)}, ${sql(context.pacs_device_id)}, 'inbound', 'dicomweb',
             ${jsonSql({ event: "C_STORE", accession, sim_run_id: config.run_id })},
             ${jsonSql({ accession_number: accession, modality: radio[0], pacs_url: radio[3] })},
             'delivered'::device_message_status, 'radiology', id, ${40 + Math.floor(rng() * 80)}
      FROM dicom_study
      RETURNING id
    )` : ""}
    ${shouldPharmacy ? `,
    pharmacy_order AS (
      INSERT INTO pharmacy_orders
        (tenant_id, patient_id, encounter_id, ordered_by, status, notes, dispensing_type,
         interaction_check_result, pharmacist_reviewed_by, reviewed_at)
      SELECT ${sql(context.tenant_id)}, patient_id, id, ${sql(context.doctor_id)}, 'ordered',
             ${sql(`Simulator pharmacy order. run_id=${config.run_id}`)}, 'prescription'::pharmacy_dispensing_type,
             ${jsonSql({ simulated: true, checks: ["allergy", "interaction"], status: "clear" })},
             ${sql(context.user_id)}, now()
      FROM encounter
      RETURNING id
    ),
    pharmacy_item AS (
      INSERT INTO pharmacy_order_items
        (tenant_id, order_id, catalog_item_id, drug_name, quantity, unit_price, total_price,
         quantity_prescribed)
      SELECT ${sql(context.tenant_id)}, id, ${sql(drug.id)}, ${sql(drug.name)},
             ${1 + Math.floor(rng() * 5)}, ${num(drug.price ?? 0)}, ${num(drug.price ?? 0)}, ${1 + Math.floor(rng() * 5)}
      FROM pharmacy_order
      RETURNING id
    )` : ""}
    SELECT 1;
  `;
}

function buildBatchSql(config, context, startIndex, count, rng) {
  const statements = [];
  for (let i = startIndex; i < startIndex + count; i += 1) {
    statements.push(patientFlowSql(config, context, i, rng));
  }
  return `BEGIN;\nSET LOCAL app.tenant_id = ${sql(context.tenant_id)};\n${statements.join("\n")}\nCOMMIT;`;
}

function cleanupSql(config, tenantCode) {
  const run = config.run_id;
  return `
    BEGIN;
    CREATE TEMP TABLE _sim_tenant ON COMMIT DROP AS
      SELECT id FROM tenants WHERE code = ${sql(tenantCode)} LIMIT 1;
    CREATE TEMP TABLE _sim_encounters ON COMMIT DROP AS
      SELECT id FROM encounters
      WHERE tenant_id = (SELECT id FROM _sim_tenant)
        AND attributes->>'sim_run_id' = ${sql(run)};
    CREATE TEMP TABLE _sim_patients ON COMMIT DROP AS
      SELECT id FROM patients
      WHERE tenant_id = (SELECT id FROM _sim_tenant)
        AND source_system = 'simulator'
        AND attributes->>'sim_run_id' = ${sql(run)};
    CREATE TEMP TABLE _sim_lab_orders ON COMMIT DROP AS
      SELECT id FROM lab_orders
      WHERE tenant_id = (SELECT id FROM _sim_tenant)
        AND notes LIKE ${sql(`%run_id=${run}%`)};
    CREATE TEMP TABLE _sim_rad_orders ON COMMIT DROP AS
      SELECT id FROM radiology_orders
      WHERE tenant_id = (SELECT id FROM _sim_tenant)
        AND notes LIKE ${sql(`%run_id=${run}%`)};
    CREATE TEMP TABLE _sim_pharmacy_orders ON COMMIT DROP AS
      SELECT id FROM pharmacy_orders
      WHERE tenant_id = (SELECT id FROM _sim_tenant)
        AND notes LIKE ${sql(`%run_id=${run}%`)};
    DELETE FROM device_messages
      WHERE tenant_id = (SELECT id FROM _sim_tenant)
        AND (parsed_payload->>'sim_run_id' = ${sql(run)} OR mapped_data::text LIKE ${sql(`%${run}%`)});
    DELETE FROM lab_results WHERE order_id IN (SELECT id FROM _sim_lab_orders);
    DELETE FROM lab_orders WHERE id IN (SELECT id FROM _sim_lab_orders);
    DELETE FROM radiology_dicom_studies WHERE dicom_metadata->>'sim_run_id' = ${sql(run)};
    DELETE FROM radiology_orders WHERE id IN (SELECT id FROM _sim_rad_orders);
    DELETE FROM pharmacy_order_items WHERE order_id IN (SELECT id FROM _sim_pharmacy_orders);
    DELETE FROM pharmacy_orders WHERE id IN (SELECT id FROM _sim_pharmacy_orders);
    DELETE FROM vitals WHERE encounter_id IN (SELECT id FROM _sim_encounters);
    DELETE FROM opd_queues WHERE encounter_id IN (SELECT id FROM _sim_encounters);
    DELETE FROM encounters WHERE id IN (SELECT id FROM _sim_encounters);
    DELETE FROM patients WHERE id IN (SELECT id FROM _sim_patients);
    COMMIT;
  `;
}

function printHelp() {
  console.log(`MedBrains hospital stream simulator

Usage:
  node scripts/simulators/hospital_stream.mjs --config configs/simulators/hospital-stream.demo.json
  node scripts/simulators/hospital_stream.mjs --batch --patients 10000 --rate 1000 --run-id load-10k
  node scripts/simulators/hospital_stream.mjs --reset --batch --patients 500 --run-id nmc-demo
  node scripts/simulators/hospital_stream.mjs cleanup --run-id nmc-demo

Modes:
  --stream          write batches every tick_seconds (default)
  --batch           write as fast as possible in batches
  cleanup           delete only rows tagged with the run_id

Safety:
  Generated records are tagged source_system='simulator' and attributes.sim_run_id.
  The tool refuses non-local DATABASE_URL unless --allow-non-local is provided.`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.command === "help") {
    printHelp();
    return;
  }

  const config = loadConfig(args);
  const databaseUrl =
    process.env.DATABASE_URL ?? "postgres://medbrains:medbrains_dev@localhost:5435/medbrains";
  assertSafeMode(config, args, databaseUrl);

  if (args.command === "cleanup") {
    psql(databaseUrl, cleanupSql(config, config.tenant_code));
    console.log(`Cleaned simulator run_id=${config.run_id}`);
    return;
  }

  if (args.reset) {
    psql(databaseUrl, cleanupSql(config, config.tenant_code));
  }
  let context = getContext(databaseUrl, config.tenant_code, config.departments, false);
  ensureSimulatorMasters(databaseUrl, context.tenant_id);
  ensureSimulatorDevices(databaseUrl, context.tenant_id, context.user_id);
  context = getContext(databaseUrl, config.tenant_code, config.departments);

  const rng = makeRng(config.seed);
  const total = Math.max(0, Number(config.total_patients));
  const perTick = Math.max(1, Number(config.patients_per_tick));
  const batchSize = Math.max(1, Number(config.batch_size));
  let written = 0;

  console.log(
    `Simulator run_id=${config.run_id} profile=${config.profile} type=${config.profile_type} total=${total} mode=${args.mode}`,
  );
  console.log("All generated records are synthetic and tagged source_system=simulator.");

  while (written < total) {
    const tickCount = Math.min(perTick, total - written);
    let tickWritten = 0;
    while (tickWritten < tickCount) {
      const count = Math.min(batchSize, tickCount - tickWritten);
      psql(databaseUrl, buildBatchSql(config, context, written + tickWritten + 1, count, rng));
      tickWritten += count;
    }
    written += tickCount;
    console.log(`simulator progress: ${written}/${total} patients`);
    if (args.mode !== "batch" && written < total) {
      await sleep(Number(config.tick_seconds) * 1000);
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
