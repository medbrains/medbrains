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
    ipd: true,
    vitals: true,
    lab: true,
    radiology: true,
    pharmacy: true,
    nabh: true,
  },
  probabilities: {
    ipd_admission: 0.22,
    lab_order: 0.65,
    lab_result: 0.9,
    radiology_order: 0.25,
    pharmacy_order: 0.35,
    queue_completed: 0.55,
    nabh_fall_event: 0.025,
    nabh_pressure_ulcer_assessment: 0.18,
    nabh_sentinel_event: 0.006,
    nabh_code_blue: 0.012,
    nabh_equipment_downtime: 0.015,
    nabh_fire_drill: 0.004,
    nabh_bmw_record: 0.1,
    nabh_bmw_breach: 0.01,
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
  const shouldNabh = config.modules.nabh === true;
  const shouldFall = shouldNabh && chance(rng, config.probabilities.nabh_fall_event);
  const shouldPressureUlcerAssessment =
    shouldNabh && chance(rng, config.probabilities.nabh_pressure_ulcer_assessment);
  const shouldSentinel = shouldNabh && chance(rng, config.probabilities.nabh_sentinel_event);
  const shouldCodeBlue = shouldNabh && chance(rng, config.probabilities.nabh_code_blue);
  const shouldAdmission =
    config.modules.ipd === true &&
    (chance(rng, config.probabilities.ipd_admission) ||
      shouldFall ||
      shouldPressureUlcerAssessment ||
      shouldCodeBlue);
  const shouldEquipmentDowntime =
    shouldNabh && chance(rng, config.probabilities.nabh_equipment_downtime);
  const shouldFireDrill = shouldNabh && chance(rng, config.probabilities.nabh_fire_drill);
  const shouldBmwRecord = shouldNabh && chance(rng, config.probabilities.nabh_bmw_record);
  const shouldBmwBreach = shouldBmwRecord && chance(rng, config.probabilities.nabh_bmw_breach);
  const runToken = config.run_id.replace(/[^A-Za-z0-9]/g, "").slice(0, 14).toUpperCase() || "SIM";
  const runUidComponent = String(
    Array.from(config.run_id).reduce(
      (acc, char) => (acc * 31 + char.charCodeAt(0)) % 1_000_000_000,
      543,
    ),
  );
  const uhid = `SIM-${runToken}-${String(index).padStart(7, "0")}`;
  const barcode = `SIMLAB-${runToken}-${String(index).padStart(7, "0")}`;
  const accession = `SIMRAD-${runToken}-${String(index).padStart(7, "0")}`;
  const studyUid = `1.2.826.0.1.3680043.10.543.${runUidComponent}.${index}`;
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
  const sourceModule = "hospital_stream_simulator";
  const sourceKey = (kind) => `medbrains:${config.run_id}:${kind}:${index}`;
  const queueCreatedMinutes = queueCompleted ? 16 + Math.floor(rng() * 28) : 2 + Math.floor(rng() * 10);
  const queueCalledMinutes = queueCompleted ? 2 + Math.floor(rng() * 12) : null;
  const admissionHoursAgo = 12 + Math.floor(rng() * 96);
  const admissionDischarged = shouldAdmission && chance(rng, 0.65);
  const dischargeType = chance(rng, 0.03) ? "death" : "normal";
  const bradenScores = {
    sensory: 2 + Math.floor(rng() * 3),
    moisture: 2 + Math.floor(rng() * 3),
    activity: 1 + Math.floor(rng() * 4),
    mobility: 2 + Math.floor(rng() * 3),
    nutrition: 2 + Math.floor(rng() * 3),
    friction: 1 + Math.floor(rng() * 3),
  };
  const bradenTotal =
    bradenScores.sensory +
    bradenScores.moisture +
    bradenScores.activity +
    bradenScores.mobility +
    bradenScores.nutrition +
    bradenScores.friction;
  const pressureInjuryPresent = shouldPressureUlcerAssessment && chance(rng, 0.08);
  const pressureHospitalAcquired = pressureInjuryPresent && chance(rng, 0.35);

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
         called_at, completed_at, created_by, created_at)
      SELECT ${sql(context.tenant_id)}, id, ${sql(departmentId)}, ${sql(context.doctor_id)}, ${tokenNumber},
             ${sql(queueCompleted ? "completed" : "waiting")}::queue_status, CURRENT_DATE,
             ${queueCompleted ? `now() - interval '${queueCalledMinutes} minutes'` : "NULL"},
             ${queueCompleted ? "now()" : "NULL"},
             ${sql(context.user_id)},
             now() - interval '${queueCreatedMinutes} minutes'
      FROM encounter
      RETURNING id
    )
    ${shouldAdmission ? `,
    admission AS (
      INSERT INTO admissions
        (tenant_id, encounter_id, patient_id, admitting_doctor, status, admitted_at, discharged_at,
         discharge_type, discharge_summary, created_by, provisional_diagnosis, admission_source,
         admission_weight_kg, admission_height_cm, ip_type)
      SELECT ${sql(context.tenant_id)}, id, patient_id, ${sql(context.doctor_id)},
             ${sql(admissionDischarged ? "discharged" : "admitted")}::admission_status,
             now() - interval '${admissionHoursAgo} hours',
             ${admissionDischarged ? "now() - interval '1 hour'" : "NULL"},
             ${admissionDischarged ? `${sql(dischargeType)}::discharge_type` : "NULL"},
             ${admissionDischarged ? sql(`Simulator discharge summary. run_id=${config.run_id}`) : "NULL"},
             ${sql(context.user_id)}, ${sql("Simulator inpatient observation")},
             'opd'::admission_source, ${num(vitals.weight.toFixed(2))},
             ${num(vitals.height.toFixed(1))}, 'general'::ip_type
      FROM encounter
      RETURNING id, patient_id
    )` : ""}
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
             ${sql(studyUid)}, ${sql(`sim-orthanc-${runToken}-${index}`)}
      FROM encounter
      RETURNING id, patient_id
    ),
    dicom_study AS (
      INSERT INTO radiology_dicom_studies
        (tenant_id, order_id, patient_id, study_instance_uid, accession_number, modality, study_date,
         study_description, referring_physician, instance_count, series_count, orthanc_id, pacs_url,
         viewer_url, file_size_bytes, dicom_metadata)
      SELECT ${sql(context.tenant_id)}, id, patient_id, ${sql(studyUid)},
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
    ${shouldFall ? `,
    nabh_fall AS (
      INSERT INTO nabh_falls_register
        (tenant_id, patient_id, admission_id, fall_at, location, location_detail, fall_type,
         contributing_factors, risk_assessment_done, morse_score, injury_level,
         injury_description, immediate_action, rca_required, reported_by, notes,
         source_module, source_record_id)
      SELECT ${sql(context.tenant_id)}, patient_id, id, now() - interval '${1 + Math.floor(rng() * 240)} minutes',
             ${sql(pick(rng, ["ward", "bathroom", "corridor"]))}, ${sql(`Simulator ${village.name} ward`)},
             ${sql(pick(rng, ["witnessed", "unwitnessed", "assisted"]))},
             ARRAY[${sql(pick(rng, ["wet floor", "sedation", "poor footwear", "unassisted transfer"]))}],
             true, ${35 + Math.floor(rng() * 55)}, ${sql(pick(rng, ["none", "minor", "moderate"]))},
             ${sql("Synthetic fall event for NABH KPI testing")},
             ${sql("Assessed, vitals checked, consultant informed.")},
             false, ${sql(context.user_id)}, ${sql(`Simulator NABH fall evidence. run_id=${config.run_id}`)},
             ${sql(sourceModule)}, uuid_generate_v5(uuid_ns_url(), ${sql(sourceKey("fall"))})
      FROM admission
      ON CONFLICT (tenant_id, source_module, source_record_id)
      WHERE source_module IS NOT NULL AND source_record_id IS NOT NULL
      DO NOTHING
      RETURNING id
    )` : ""}
    ${shouldPressureUlcerAssessment ? `,
    nabh_pressure_ulcer AS (
      INSERT INTO nabh_pressure_ulcer_assessments
        (tenant_id, patient_id, admission_id, assessed_at, assessed_by, sensory_perception,
         moisture, activity, mobility, nutrition, friction_shear, risk_level, injury_present,
         injury_stage, injury_location, injury_acquired, injury_description, repositioning_plan,
         nutritional_plan, skin_care_plan, notes, source_module, source_record_id)
      SELECT ${sql(context.tenant_id)}, patient_id, id, now() - interval '${1 + Math.floor(rng() * 480)} minutes',
             ${sql(context.user_id)}, ${bradenScores.sensory}, ${bradenScores.moisture},
             ${bradenScores.activity}, ${bradenScores.mobility}, ${bradenScores.nutrition},
             ${bradenScores.friction},
             ${sql(bradenTotal <= 12 ? "high" : bradenTotal <= 16 ? "moderate" : "mild")},
             ${pressureInjuryPresent ? "true" : "false"},
             ${pressureInjuryPresent ? sql(pick(rng, ["stage_1", "stage_2"])) : "NULL"},
             ${pressureInjuryPresent ? sql(pick(rng, ["sacrum", "heel", "elbow"])) : "NULL"},
             ${pressureInjuryPresent ? sql(pressureHospitalAcquired ? "hospital_acquired" : "present_on_admission") : "NULL"},
             ${pressureInjuryPresent ? sql("Synthetic pressure injury finding.") : "NULL"},
             ${sql("Two-hourly repositioning chart started.")},
             ${sql("High-protein diet advice recorded where indicated.")},
             ${sql("Skin barrier and moisture care documented.")},
             ${sql(`Simulator Braden assessment. run_id=${config.run_id}`)},
             ${sql(sourceModule)}, uuid_generate_v5(uuid_ns_url(), ${sql(sourceKey("pressure-ulcer"))})
      FROM admission
      ON CONFLICT (tenant_id, source_module, source_record_id)
      WHERE source_module IS NOT NULL AND source_record_id IS NOT NULL
      DO NOTHING
      RETURNING id
    )` : ""}
    ${shouldSentinel ? `,
    nabh_sentinel AS (
      INSERT INTO nabh_sentinel_event_register
        (tenant_id, event_at, event_category, severity, patient_id, admission_id, location,
         description, immediate_actions, reportable_to_authority, reportable_to_nqf,
         rca_required, rca_due_at, review_status, reported_by, notes, source_module, source_record_id)
      SELECT ${sql(context.tenant_id)}, now() - interval '${1 + Math.floor(rng() * 1440)} minutes',
             ${sql(pick(rng, ["medication_error", "wrong_patient_near_miss", "patient_safety_near_miss"]))},
             ${sql(pick(rng, ["no_harm_near_miss", "temporary_harm"]))}, patient.id,
             ${shouldAdmission ? "admission.id" : "NULL"},
             ${sql(pick(rng, ["OPD", "ward", "pharmacy"]))},
             ${sql("Synthetic sentinel/near-miss record for NABH testing.")},
             ${sql("Immediate containment and department briefing completed.")},
             false, true, true, now() + interval '72 hours', 'open',
             ${sql(context.user_id)}, ${sql(`Simulator sentinel evidence. run_id=${config.run_id}`)},
             ${sql(sourceModule)}, uuid_generate_v5(uuid_ns_url(), ${sql(sourceKey("sentinel"))})
      FROM patient
      ${shouldAdmission ? "CROSS JOIN admission" : ""}
      ON CONFLICT (tenant_id, source_module, source_record_id)
      WHERE source_module IS NOT NULL AND source_record_id IS NOT NULL
      DO NOTHING
      RETURNING id
    )` : ""}
    ${shouldCodeBlue ? `,
    nabh_code_blue AS (
      INSERT INTO nabh_code_blue_activations
        (tenant_id, activated_at, activated_by, location, patient_id, admission_id, team_arrived_at,
         reason, initial_rhythm, cpr_started_at, cpr_duration_minutes, defibrillation_count,
         drugs_administered, rosc_achieved, rosc_at, outcome, transferred_to, debrief_completed,
         debrief_at, learning_points, notes, source_module, source_record_id)
      SELECT ${sql(context.tenant_id)}, now() - interval '${20 + Math.floor(rng() * 360)} minutes',
             ${sql(context.user_id)}, ${sql("ward")}, patient_id, id,
             now() - interval '${17 + Math.floor(rng() * 340)} minutes',
             ${sql(pick(rng, ["cardiac_arrest", "respiratory_arrest", "severe_hypotension"]))},
             ${sql(pick(rng, ["vfib", "pea", "asystole", "other"]))},
             now() - interval '${16 + Math.floor(rng() * 330)} minutes',
             ${8 + Math.floor(rng() * 18)}, ${Math.floor(rng() * 3)},
             ${jsonSql([{ drug: "Adrenaline", dose: "1 mg", route: "IV" }])},
             true, now() - interval '${5 + Math.floor(rng() * 120)} minutes',
             ${sql(pick(rng, ["survived_intact", "transferred_icu"]))},
             ${sql("ICU / higher care")}, true, now() - interval '5 minutes',
             ${sql("Response time, crash-cart readiness, and documentation reviewed.")},
             ${sql(`Simulator Code Blue evidence. run_id=${config.run_id}`)},
             ${sql(sourceModule)}, uuid_generate_v5(uuid_ns_url(), ${sql(sourceKey("code-blue"))})
      FROM admission
      ON CONFLICT (tenant_id, source_module, source_record_id)
      WHERE source_module IS NOT NULL AND source_record_id IS NOT NULL
      DO NOTHING
      RETURNING id
    )` : ""}
    ${shouldEquipmentDowntime ? `,
    nabh_equipment_down AS (
      INSERT INTO nabh_equipment_downtime_log
        (tenant_id, equipment_name, equipment_serial, equipment_category, location,
         downtime_start, downtime_end, reason, impact_level, impact_summary, reported_to_bme,
         reported_to_bme_at, resolved_by, resolution_summary, qa_passed_at, notes,
         source_module, source_record_id)
      VALUES
        (${sql(context.tenant_id)}, ${sql(pick(rng, ["Simulator CBC Analyzer", "Simulator PACS Gateway", "Simulator Monitor"]))},
         ${sql(`SIM-EQ-${runToken}-${index}`)}, ${sql(pick(rng, ["lab_analyzer", "imaging", "monitor"]))},
         ${sql(pick(rng, ["Pathology", "Radiology", "Ward"]))},
         now() - interval '${60 + Math.floor(rng() * 720)} minutes',
         ${chance(rng, 0.75) ? "now() - interval '15 minutes'" : "NULL"},
         ${sql(pick(rng, ["breakdown", "calibration", "qa_failure"]))},
         ${sql(pick(rng, ["low", "medium", "high"]))},
         ${sql("Synthetic equipment downtime for NABH FMS testing.")}, true,
         now() - interval '${40 + Math.floor(rng() * 360)} minutes',
         ${sql(context.user_id)}, ${sql("Resolved and QC verified where applicable.")},
         now() - interval '5 minutes', ${sql(`Simulator downtime evidence. run_id=${config.run_id}`)},
         ${sql(sourceModule)}, uuid_generate_v5(uuid_ns_url(), ${sql(sourceKey("equipment"))}))
      ON CONFLICT (tenant_id, source_module, source_record_id)
      WHERE source_module IS NOT NULL AND source_record_id IS NOT NULL
      DO NOTHING
      RETURNING id
    )` : ""}
    ${shouldFireDrill ? `,
    nabh_fire_drill AS (
      INSERT INTO nabh_fire_safety_drills
        (tenant_id, drill_at, drill_type, location, scenario, participants_count,
         participating_departments, incident_commander, alarm_at, evacuation_started_at,
         evacuation_completed_at, issues_observed, corrective_actions, corrective_action_owner,
         corrective_action_due, corrective_actions_done, conducted_by, notes,
         source_module, source_record_id)
      VALUES
        (${sql(context.tenant_id)}, now() - interval '${Math.floor(rng() * 90)} days',
         ${sql(pick(rng, ["announced", "unannounced", "tabletop", "live"]))},
         ${sql("Main block")}, ${sql("Synthetic smoke scenario in outpatient corridor.")},
         ${12 + Math.floor(rng() * 45)}, ARRAY['OPD','Nursing','Security'],
         ${sql(context.user_id)}, now() - interval '25 minutes', now() - interval '23 minutes',
         now() - interval '18 minutes', ARRAY[${sql("minor signage delay")}],
         ${sql("Update evacuation signage and repeat briefing.")}, ${sql(context.user_id)},
         CURRENT_DATE + 14, false, ${sql(context.user_id)},
         ${sql(`Simulator fire drill evidence. run_id=${config.run_id}`)},
         ${sql(sourceModule)}, uuid_generate_v5(uuid_ns_url(), ${sql(sourceKey("fire-drill"))}))
      ON CONFLICT (tenant_id, source_module, source_record_id)
      WHERE source_module IS NOT NULL AND source_record_id IS NOT NULL
      DO NOTHING
      RETURNING id
    )` : ""}
    ${shouldBmwRecord ? `,
    nabh_bmw AS (
      INSERT INTO nabh_bmw_disposal_log
        (tenant_id, disposal_date, waste_category, waste_subtype, quantity_kg, source_department,
         bag_count, barcode_refs, stored_at, handed_over_at, disposal_agency,
         disposal_agency_licence, disposal_method, handed_over_by, received_by_agency, notes,
         source_module, source_record_id)
      VALUES
        (${sql(context.tenant_id)}, CURRENT_DATE,
         ${sql(pick(rng, ["yellow", "red", "blue", "white"]))},
         ${sql(pick(rng, ["contaminated_waste", "sharps", "glassware", "soiled_waste"]))},
         ${num((0.5 + rng() * 8).toFixed(3))}, ${sql(pick(rng, ["OPD", "Pathology", "Radiology", "Ward"]))},
         ${1 + Math.floor(rng() * 6)}, ARRAY[${sql(`BMW-${runToken}-${String(index).padStart(6, "0")}`)}],
         now() - interval '${shouldBmwBreach ? 52 + Math.floor(rng() * 24) : 2 + Math.floor(rng() * 24)} hours',
         now(), ${sql("Simulator CBWTF Agency")}, ${sql("TN-CBWTF-SIM-001")},
         ${sql(pick(rng, ["incineration", "autoclave", "deep_burial"]))},
         ${sql(context.user_id)}, ${sql("Simulator agency operator")},
         ${sql(`Simulator BMW disposal evidence. run_id=${config.run_id}`)},
         ${sql(sourceModule)}, uuid_generate_v5(uuid_ns_url(), ${sql(sourceKey("bmw"))}))
      ON CONFLICT (tenant_id, source_module, source_record_id)
      WHERE source_module IS NOT NULL AND source_record_id IS NOT NULL
      DO NOTHING
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
    DELETE FROM nabh_bmw_disposal_log
      WHERE tenant_id = (SELECT id FROM _sim_tenant)
        AND source_module = 'hospital_stream_simulator'
        AND notes LIKE ${sql(`%run_id=${run}%`)};
    DELETE FROM nabh_fire_safety_drills
      WHERE tenant_id = (SELECT id FROM _sim_tenant)
        AND source_module = 'hospital_stream_simulator'
        AND notes LIKE ${sql(`%run_id=${run}%`)};
    DELETE FROM nabh_equipment_downtime_log
      WHERE tenant_id = (SELECT id FROM _sim_tenant)
        AND source_module = 'hospital_stream_simulator'
        AND notes LIKE ${sql(`%run_id=${run}%`)};
    DELETE FROM nabh_code_blue_activations
      WHERE tenant_id = (SELECT id FROM _sim_tenant)
        AND source_module = 'hospital_stream_simulator'
        AND notes LIKE ${sql(`%run_id=${run}%`)};
    DELETE FROM nabh_sentinel_event_register
      WHERE tenant_id = (SELECT id FROM _sim_tenant)
        AND source_module = 'hospital_stream_simulator'
        AND notes LIKE ${sql(`%run_id=${run}%`)};
    DELETE FROM nabh_pressure_ulcer_assessments
      WHERE tenant_id = (SELECT id FROM _sim_tenant)
        AND source_module = 'hospital_stream_simulator'
        AND notes LIKE ${sql(`%run_id=${run}%`)};
    DELETE FROM nabh_falls_register
      WHERE tenant_id = (SELECT id FROM _sim_tenant)
        AND source_module = 'hospital_stream_simulator'
        AND notes LIKE ${sql(`%run_id=${run}%`)};
    DELETE FROM admissions
      WHERE encounter_id IN (SELECT id FROM _sim_encounters);
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
