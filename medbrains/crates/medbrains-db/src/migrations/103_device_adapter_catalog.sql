-- 103_device_adapter_catalog.sql — Global device adapter registry
-- Each adapter = a .wasm plugin with baked-in protocol + field mappings + quirks
-- Global table (NO RLS) — shared across all tenants

-- ══════════════════════════════════════════════════════════
--  Device Adapter Catalog
-- ══════════════════════════════════════════════════════════

CREATE TABLE device_adapter_catalog (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identity
    adapter_code        TEXT NOT NULL UNIQUE,
    manufacturer        TEXT NOT NULL,
    manufacturer_code   TEXT NOT NULL,
    model               TEXT NOT NULL,
    model_code          TEXT NOT NULL,

    -- Classification
    device_category     TEXT NOT NULL
        CHECK (device_category IN (
            'lab_analyzer', 'lab_hematology', 'lab_chemistry', 'lab_immunoassay',
            'lab_coagulation', 'lab_urinalysis', 'lab_blood_gas', 'lab_microbiology',
            'patient_monitor', 'ventilator', 'infusion_pump', 'syringe_pump',
            'ct_scanner', 'mri_scanner', 'xray', 'ultrasound', 'mammography',
            'ecg_machine', 'defibrillator', 'pulse_oximeter', 'glucometer',
            'blood_bank_analyzer', 'blood_gas_analyzer',
            'barcode_scanner', 'rfid_reader', 'label_printer', 'wristband_printer',
            'cold_chain_sensor', 'environment_sensor', 'weighing_scale',
            'biometric_reader', 'access_control',
            'pacs_server', 'ris_server', 'lis_server',
            'bedside_tablet', 'queue_display', 'nurse_station', 'digital_signage',
            'self_checkin_kiosk', 'wayfinding_kiosk', 'pharmacy_display',
            'mobile_nurse', 'mobile_doctor',
            'generic', 'other'
        )),
    device_subcategory  TEXT,

    -- Data direction
    data_direction      TEXT NOT NULL DEFAULT 'producer'
        CHECK (data_direction IN ('producer', 'consumer', 'bidirectional')),

    -- Protocol
    protocol            TEXT NOT NULL
        CHECK (protocol IN ('hl7_v2', 'astm_e1381', 'dicom', 'serial_rs232', 'rest_json', 'mqtt', 'tcp_raw', 'file_drop', 'usb_hid', 'websocket', 'http_api', 'browser_app')),
    transport           TEXT NOT NULL DEFAULT 'tcp'
        CHECK (transport IN ('tcp', 'serial', 'usb', 'http', 'mqtt', 'file')),

    -- Defaults (baked into .wasm manifest, cached here for UI)
    default_port        INTEGER,
    default_baud_rate   INTEGER,
    default_data_bits   INTEGER DEFAULT 8,
    default_parity      TEXT DEFAULT 'none' CHECK (default_parity IN ('none', 'even', 'odd')),
    default_stop_bits   INTEGER DEFAULT 1,
    default_ae_title    TEXT,

    -- Configuration templates (cached from adapter manifest)
    default_config      JSONB NOT NULL DEFAULT '{}',
    field_mappings      JSONB NOT NULL DEFAULT '[]',
    data_transforms     JSONB NOT NULL DEFAULT '[]',
    qc_recommendations  JSONB NOT NULL DEFAULT '[]',
    known_quirks        JSONB NOT NULL DEFAULT '[]',
    supported_tests     JSONB NOT NULL DEFAULT '[]',

    -- Adapter binary metadata
    adapter_version     TEXT NOT NULL DEFAULT '0.0.0',
    sdk_version         TEXT NOT NULL DEFAULT '0.1.0',
    wasm_hash           TEXT,
    wasm_size_bytes     INTEGER,

    -- Trust & provenance
    is_verified         BOOLEAN NOT NULL DEFAULT false,
    contributed_by      TEXT NOT NULL DEFAULT 'medbrains'
        CHECK (contributed_by IN ('medbrains', 'community', 'tenant', 'manufacturer')),
    documentation_url   TEXT,

    -- Stats
    download_count      INTEGER NOT NULL DEFAULT 0,
    install_count       INTEGER NOT NULL DEFAULT 0,

    -- Meta
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_adapter_catalog_manufacturer ON device_adapter_catalog(manufacturer_code);
CREATE INDEX idx_adapter_catalog_category ON device_adapter_catalog(device_category);
CREATE INDEX idx_adapter_catalog_protocol ON device_adapter_catalog(protocol);
CREATE INDEX idx_adapter_catalog_search ON device_adapter_catalog
    USING gin (to_tsvector('english', manufacturer || ' ' || model || ' ' || COALESCE(device_subcategory, '')));

CREATE TRIGGER trg_adapter_catalog_updated_at BEFORE UPDATE ON device_adapter_catalog
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════════════════════════
--  Seed: Common Indian Hospital Device Adapters
-- ══════════════════════════════════════════════════════════

INSERT INTO device_adapter_catalog (
    adapter_code, manufacturer, manufacturer_code, model, model_code,
    device_category, device_subcategory, protocol, transport,
    default_port, default_baud_rate, is_verified, contributed_by,
    field_mappings, known_quirks
) VALUES
-- ── Lab Analyzers (Chemistry) ──
('roche_cobas_6000', 'Roche Diagnostics', 'roche', 'cobas 6000', 'cobas_6000',
 'lab_chemistry', 'clinical chemistry', 'hl7_v2', 'tcp', 2575, NULL, true, 'medbrains',
 '[{"device_field":"OBX.5","target":"lab_results.value","type":"numeric"},{"device_field":"OBX.6","target":"lab_results.unit","type":"string"},{"device_field":"OBX.7","target":"lab_results.reference_range","type":"string"},{"device_field":"OBX.3","target":"lab_results.test_code","type":"string"}]',
 '[{"id":"cobas_crlf","description":"May send CR instead of CRLF as segment terminator","auto_fix":true,"config":{"segment_terminator":"\\r"}}]'),

('roche_cobas_8000', 'Roche Diagnostics', 'roche', 'cobas 8000', 'cobas_8000',
 'lab_chemistry', 'modular analytics', 'hl7_v2', 'tcp', 2575, NULL, true, 'medbrains',
 '[{"device_field":"OBX.5","target":"lab_results.value","type":"numeric"},{"device_field":"OBX.6","target":"lab_results.unit","type":"string"},{"device_field":"OBX.7","target":"lab_results.reference_range","type":"string"}]',
 '[]'),

('beckman_au5800', 'Beckman Coulter', 'beckman_coulter', 'AU5800', 'au5800',
 'lab_chemistry', 'clinical chemistry', 'hl7_v2', 'tcp', 2575, NULL, true, 'medbrains',
 '[{"device_field":"OBX.5","target":"lab_results.value","type":"numeric"},{"device_field":"OBX.6","target":"lab_results.unit","type":"string"}]',
 '[]'),

('siemens_atellica_ch', 'Siemens Healthineers', 'siemens', 'Atellica CH 930', 'atellica_ch930',
 'lab_chemistry', 'clinical chemistry', 'hl7_v2', 'tcp', 2575, NULL, true, 'medbrains',
 '[{"device_field":"OBX.5","target":"lab_results.value","type":"numeric"},{"device_field":"OBX.6","target":"lab_results.unit","type":"string"}]',
 '[]'),

('erba_xl_640', 'Erba Mannheim', 'erba', 'XL 640', 'xl_640',
 'lab_chemistry', 'clinical chemistry', 'astm_e1381', 'serial', NULL, 9600, true, 'medbrains',
 '[{"device_field":"R.4","target":"lab_results.value","type":"numeric"},{"device_field":"R.5","target":"lab_results.unit","type":"string"}]',
 '[{"id":"erba_enq_retry","description":"Requires 3 ENQ retries before timeout","auto_fix":true,"config":{"enq_retries":3}}]'),

('transasia_erba_em200', 'TransAsia / Erba', 'transasia', 'EM 200', 'em_200',
 'lab_chemistry', 'semi-auto analyzer', 'astm_e1381', 'serial', NULL, 9600, true, 'medbrains',
 '[{"device_field":"R.4","target":"lab_results.value","type":"numeric"}]',
 '[]'),

-- ── Lab Analyzers (Hematology) ──
('sysmex_xn1000', 'Sysmex Corporation', 'sysmex', 'XN-1000', 'xn_1000',
 'lab_hematology', 'hematology analyzer', 'hl7_v2', 'tcp', 2575, NULL, true, 'medbrains',
 '[{"device_field":"OBX.5","target":"lab_results.value","type":"numeric"},{"device_field":"OBX.6","target":"lab_results.unit","type":"string"},{"device_field":"OBX.8","target":"lab_results.abnormal_flag","type":"string"}]',
 '[]'),

('sysmex_xn3000', 'Sysmex Corporation', 'sysmex', 'XN-3000', 'xn_3000',
 'lab_hematology', 'hematology analyzer', 'hl7_v2', 'tcp', 2575, NULL, true, 'medbrains',
 '[{"device_field":"OBX.5","target":"lab_results.value","type":"numeric"},{"device_field":"OBX.6","target":"lab_results.unit","type":"string"}]',
 '[]'),

('mindray_bc6800', 'Mindray', 'mindray', 'BC-6800 Plus', 'bc_6800',
 'lab_hematology', 'hematology analyzer', 'hl7_v2', 'tcp', 2575, NULL, true, 'medbrains',
 '[{"device_field":"OBX.5","target":"lab_results.value","type":"numeric"},{"device_field":"OBX.6","target":"lab_results.unit","type":"string"}]',
 '[]'),

('beckman_dxh900', 'Beckman Coulter', 'beckman_coulter', 'DxH 900', 'dxh_900',
 'lab_hematology', 'hematology analyzer', 'hl7_v2', 'tcp', 2575, NULL, true, 'medbrains',
 '[{"device_field":"OBX.5","target":"lab_results.value","type":"numeric"}]',
 '[]'),

-- ── Lab Analyzers (Immunoassay) ──
('roche_cobas_e801', 'Roche Diagnostics', 'roche', 'cobas e 801', 'cobas_e801',
 'lab_immunoassay', 'immunoassay', 'hl7_v2', 'tcp', 2575, NULL, true, 'medbrains',
 '[{"device_field":"OBX.5","target":"lab_results.value","type":"numeric"},{"device_field":"OBX.6","target":"lab_results.unit","type":"string"}]',
 '[]'),

('siemens_advia_centaur', 'Siemens Healthineers', 'siemens', 'ADVIA Centaur XPT', 'advia_centaur_xpt',
 'lab_immunoassay', 'immunoassay', 'hl7_v2', 'tcp', 2575, NULL, true, 'medbrains',
 '[{"device_field":"OBX.5","target":"lab_results.value","type":"numeric"}]',
 '[]'),

-- ── Lab Analyzers (Coagulation) ──
('stago_sta_compact', 'Stago', 'stago', 'STA Compact Max', 'sta_compact_max',
 'lab_coagulation', 'coagulation analyzer', 'hl7_v2', 'tcp', 2575, NULL, true, 'medbrains',
 '[{"device_field":"OBX.5","target":"lab_results.value","type":"numeric"}]',
 '[]'),

-- ── Lab Analyzers (Blood Gas) ──
('radiometer_abl90', 'Radiometer', 'radiometer', 'ABL90 FLEX PLUS', 'abl90_flex',
 'lab_blood_gas', 'blood gas analyzer', 'hl7_v2', 'tcp', 2575, NULL, true, 'medbrains',
 '[{"device_field":"OBX.5","target":"lab_results.value","type":"numeric"},{"device_field":"OBX.6","target":"lab_results.unit","type":"string"}]',
 '[]'),

('siemens_rapidpoint', 'Siemens Healthineers', 'siemens', 'RAPIDPoint 500e', 'rapidpoint_500e',
 'lab_blood_gas', 'blood gas analyzer', 'hl7_v2', 'tcp', 2575, NULL, true, 'medbrains',
 '[{"device_field":"OBX.5","target":"lab_results.value","type":"numeric"}]',
 '[]'),

-- ── Lab Analyzers (Urinalysis) ──
('sysmex_uc3500', 'Sysmex Corporation', 'sysmex', 'UC-3500', 'uc_3500',
 'lab_urinalysis', 'urine analyzer', 'hl7_v2', 'tcp', 2575, NULL, true, 'medbrains',
 '[{"device_field":"OBX.5","target":"lab_results.value","type":"string"}]',
 '[]'),

-- ── Patient Monitors ──
('philips_mx800', 'Philips Healthcare', 'philips', 'IntelliVue MX800', 'intellivue_mx800',
 'patient_monitor', 'bedside monitor', 'hl7_v2', 'tcp', 2575, NULL, true, 'medbrains',
 '[{"device_field":"OBX.5","target":"vitals.value","type":"numeric","context":"heart_rate"},{"device_field":"OBX.5","target":"vitals.value","type":"numeric","context":"spo2"}]',
 '[]'),

('ge_carescape_b650', 'GE HealthCare', 'ge', 'CARESCAPE B650', 'carescape_b650',
 'patient_monitor', 'bedside monitor', 'hl7_v2', 'tcp', 2575, NULL, true, 'medbrains',
 '[{"device_field":"OBX.5","target":"vitals.value","type":"numeric"}]',
 '[]'),

('mindray_beneview_t8', 'Mindray', 'mindray', 'BeneView T8', 'beneview_t8',
 'patient_monitor', 'bedside monitor', 'hl7_v2', 'tcp', 2575, NULL, true, 'medbrains',
 '[{"device_field":"OBX.5","target":"vitals.value","type":"numeric"}]',
 '[]'),

-- ── Imaging / DICOM ──
('generic_dicom_ct', 'Generic', 'generic', 'DICOM CT Scanner', 'dicom_ct',
 'ct_scanner', 'computed tomography', 'dicom', 'tcp', 104, NULL, true, 'medbrains',
 '[{"device_field":"PatientID","target":"radiology_orders.patient_uhid","type":"string"},{"device_field":"StudyDescription","target":"radiology_orders.study_name","type":"string"}]',
 '[]'),

('generic_dicom_mri', 'Generic', 'generic', 'DICOM MRI Scanner', 'dicom_mri',
 'mri_scanner', 'magnetic resonance', 'dicom', 'tcp', 104, NULL, true, 'medbrains',
 '[{"device_field":"PatientID","target":"radiology_orders.patient_uhid","type":"string"}]',
 '[]'),

('generic_dicom_xray', 'Generic', 'generic', 'DICOM X-Ray', 'dicom_xray',
 'xray', 'digital radiography', 'dicom', 'tcp', 104, NULL, true, 'medbrains',
 '[{"device_field":"PatientID","target":"radiology_orders.patient_uhid","type":"string"}]',
 '[]'),

('generic_dicom_us', 'Generic', 'generic', 'DICOM Ultrasound', 'dicom_us',
 'ultrasound', 'ultrasonography', 'dicom', 'tcp', 104, NULL, true, 'medbrains',
 '[{"device_field":"PatientID","target":"radiology_orders.patient_uhid","type":"string"}]',
 '[]'),

-- ── Point of Care ──
('generic_glucometer', 'Generic', 'generic', 'Serial Glucometer', 'serial_glucometer',
 'glucometer', 'blood glucose', 'serial_rs232', 'serial', NULL, 9600, false, 'medbrains',
 '[{"device_field":"glucose_value","target":"vitals.blood_glucose","type":"numeric"}]',
 '[]'),

('generic_ecg_12lead', 'Generic', 'generic', 'Digital ECG 12-Lead', 'ecg_12lead',
 'ecg_machine', '12-lead ECG', 'hl7_v2', 'tcp', 2575, NULL, false, 'medbrains',
 '[{"device_field":"OBX.5","target":"vitals.ecg_data","type":"binary"}]',
 '[]'),

-- ── Cold Chain / IoT Sensors ──
('generic_cold_chain', 'Generic', 'generic', 'Temperature/Humidity Sensor', 'cold_chain_sensor',
 'cold_chain_sensor', 'temperature monitoring', 'mqtt', 'mqtt', 1883, NULL, false, 'medbrains',
 '[{"device_field":"temperature","target":"cold_chain_readings.temperature","type":"numeric"},{"device_field":"humidity","target":"cold_chain_readings.humidity","type":"numeric"}]',
 '[]'),

-- ── Blood Bank ──
('ortho_vision', 'Ortho Clinical Diagnostics', 'ortho', 'ORTHO VISION Max', 'vision_max',
 'blood_bank_analyzer', 'blood typing', 'hl7_v2', 'tcp', 2575, NULL, true, 'medbrains',
 '[{"device_field":"OBX.5","target":"blood_bank.result","type":"string"}]',
 '[]'),

-- ── Barcode / RFID ──
('generic_barcode_scanner', 'Generic', 'generic', 'USB Barcode Scanner', 'barcode_scanner',
 'barcode_scanner', 'barcode/QR reader', 'usb_hid', 'usb', NULL, NULL, false, 'medbrains',
 '[{"device_field":"barcode_data","target":"scan_input","type":"string"}]',
 '[]'),

-- ── Ventilators ──
('draeger_savina_300', 'Draeger', 'draeger', 'Savina 300', 'savina_300',
 'ventilator', 'ICU ventilator', 'hl7_v2', 'tcp', 2575, NULL, true, 'medbrains',
 '[{"device_field":"OBX.5","target":"icu_ventilator.tidal_volume","type":"numeric","context":"tidal_volume"},{"device_field":"OBX.5","target":"icu_ventilator.peep","type":"numeric","context":"peep"}]',
 '[]'),

('hamilton_c6', 'Hamilton Medical', 'hamilton', 'HAMILTON-C6', 'hamilton_c6',
 'ventilator', 'ICU ventilator', 'hl7_v2', 'tcp', 2575, NULL, true, 'medbrains',
 '[{"device_field":"OBX.5","target":"icu_ventilator.tidal_volume","type":"numeric","context":"tidal_volume"}]',
 '[]');

-- ══════════════════════════════════════════════════════════
--  Consumer & Bidirectional Devices (displays, tablets, kiosks)
-- ══════════════════════════════════════════════════════════
-- These connect TO MedBrains (via HTTP/WebSocket), not through bridge.
-- The "adapter" here is a configuration profile, not a protocol parser.

INSERT INTO device_adapter_catalog (
    adapter_code, manufacturer, manufacturer_code, model, model_code,
    device_category, device_subcategory, data_direction, protocol, transport,
    default_port, default_baud_rate, is_verified, contributed_by,
    field_mappings, known_quirks, default_config
) VALUES

-- ── Queue & TV Displays (consumers — pull data via WebSocket) ──
('medbrains_queue_display', 'MedBrains', 'medbrains', 'Queue Display Client', 'queue_display',
 'queue_display', 'OPD/lab/pharmacy token display', 'consumer', 'websocket', 'http', 443, NULL, true, 'medbrains',
 '[]', '[]',
 '{"app_url": "/tv/queue", "refresh_interval_ms": 5000, "departments": [], "theme": "dark", "font_size": "large", "show_announcements": true}'),

('medbrains_bed_status_display', 'MedBrains', 'medbrains', 'Bed Status Board', 'bed_status_display',
 'queue_display', 'ward bed status display', 'consumer', 'websocket', 'http', 443, NULL, true, 'medbrains',
 '[]', '[]',
 '{"app_url": "/tv/bed-status", "refresh_interval_ms": 10000, "wards": [], "theme": "dark"}'),

('medbrains_digital_signage', 'MedBrains', 'medbrains', 'Digital Signage', 'digital_signage',
 'digital_signage', 'lobby/hallway info display', 'consumer', 'http_api', 'http', 443, NULL, true, 'medbrains',
 '[]', '[]',
 '{"app_url": "/tv/signage", "playlist": [], "slide_duration_s": 15, "show_emergency_alerts": true}'),

('medbrains_nurse_station', 'MedBrains', 'medbrains', 'Nurse Station Panel', 'nurse_station',
 'nurse_station', 'central ward monitoring', 'consumer', 'websocket', 'http', 443, NULL, true, 'medbrains',
 '[]', '[]',
 '{"app_url": "/tv/nurse-station", "wards": [], "show_vitals_alerts": true, "show_pending_tasks": true, "show_medication_due": true}'),

('medbrains_pharmacy_display', 'MedBrains', 'medbrains', 'Pharmacy Pickup Display', 'pharmacy_display',
 'pharmacy_display', 'pharmacy dispensing queue', 'consumer', 'websocket', 'http', 443, NULL, true, 'medbrains',
 '[]', '[]',
 '{"app_url": "/tv/pharmacy", "refresh_interval_ms": 5000, "theme": "dark"}'),

-- ── Bedside Tablets (bidirectional — read patient data, send orders/inputs) ──
('medbrains_bedside_tablet', 'MedBrains', 'medbrains', 'Bedside Patient Portal', 'bedside_tablet',
 'bedside_tablet', 'patient bedside tablet', 'bidirectional', 'http_api', 'http', 443, NULL, true, 'medbrains',
 '[]', '[]',
 '{"app_url": "/bedside", "features": ["vitals_view", "meal_ordering", "nurse_call", "education", "feedback", "medication_schedule"], "auto_lock_minutes": 10, "language_selector": true}'),

('medbrains_bedside_nurse', 'MedBrains', 'medbrains', 'Bedside Nurse Terminal', 'bedside_nurse',
 'bedside_tablet', 'nurse bedside workflow', 'bidirectional', 'http_api', 'http', 443, NULL, true, 'medbrains',
 '[]', '[]',
 '{"app_url": "/bedside/nurse", "features": ["vitals_entry", "medication_admin", "io_chart", "barcode_scan", "specimen_collect", "assessments"], "barcode_camera": true}'),

-- ── Self-Service Kiosks (bidirectional — read appointments, create tokens/registrations) ──
('medbrains_checkin_kiosk', 'MedBrains', 'medbrains', 'Self Check-In Kiosk', 'checkin_kiosk',
 'self_checkin_kiosk', 'patient self-service', 'bidirectional', 'http_api', 'http', 443, NULL, true, 'medbrains',
 '[]', '[]',
 '{"app_url": "/kiosk/checkin", "features": ["appointment_checkin", "token_generation", "registration_update", "payment", "wayfinding"], "printer": "thermal_80mm", "id_scanner": true, "languages": ["en", "hi", "ta"]}'),

('medbrains_wayfinding_kiosk', 'MedBrains', 'medbrains', 'Wayfinding Kiosk', 'wayfinding_kiosk',
 'wayfinding_kiosk', 'hospital navigation', 'consumer', 'http_api', 'http', 443, NULL, true, 'medbrains',
 '[]', '[]',
 '{"app_url": "/kiosk/wayfinding", "floor_map_url": null, "departments": [], "languages": ["en", "hi"]}'),

-- ── ER Triage Display ──
('medbrains_er_triage_display', 'MedBrains', 'medbrains', 'ER Triage Board', 'er_triage_display',
 'queue_display', 'emergency triage tracking', 'consumer', 'websocket', 'http', 443, NULL, true, 'medbrains',
 '[]', '[]',
 '{"app_url": "/tv/er-triage", "show_triage_levels": true, "show_wait_times": true, "hipaa_mode": true}');
