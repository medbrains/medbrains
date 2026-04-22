-- 099_consent_templates.sql — Consent form tracking and MRD form support
-- Tracks signed consents with witness information, signature data, and revocation

-- ── Consent Records ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS consent_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    patient_id      UUID NOT NULL REFERENCES patients(id),
    admission_id    UUID REFERENCES admissions(id),
    encounter_id    UUID REFERENCES encounters(id),
    booking_id      UUID REFERENCES ot_bookings(id),
    consent_type    VARCHAR(50) NOT NULL
        CHECK (consent_type IN (
            'general_admission', 'surgical', 'anesthesia', 'blood_transfusion',
            'hiv_testing', 'ama', 'photography', 'teaching', 'research',
            'dnr', 'organ_donation', 'abdm', 'refusal_treatment'
        )),
    template_id     UUID REFERENCES document_templates(id),
    procedure_name  TEXT,
    risks_explained TEXT,
    alternatives_discussed TEXT,
    language        VARCHAR(10) NOT NULL DEFAULT 'en',

    -- Patient signature
    signed_by_patient       BOOLEAN DEFAULT false,
    patient_signature_data  TEXT,  -- Base64 encoded signature image
    patient_signed_at       TIMESTAMPTZ,
    patient_capacity_confirmed BOOLEAN DEFAULT true,

    -- Legal guardian (if patient is minor or incapacitated)
    guardian_name           VARCHAR(200),
    guardian_relation       VARCHAR(100),
    guardian_signature_data TEXT,
    guardian_signed_at      TIMESTAMPTZ,

    -- Witness
    witness_name            VARCHAR(200),
    witness_designation     VARCHAR(100),
    witness_signature_data  TEXT,
    witness_signed_at       TIMESTAMPTZ,

    -- Doctor/Staff who obtained consent
    obtained_by             UUID REFERENCES users(id),
    obtained_at             TIMESTAMPTZ,

    -- Document storage
    pdf_url                 TEXT,

    -- Revocation
    is_revoked              BOOLEAN DEFAULT false,
    revoked_at              TIMESTAMPTZ,
    revoked_by              UUID REFERENCES users(id),
    revocation_reason       TEXT,

    -- Audit
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL REFERENCES users(id),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_consent_records_tenant ON consent_records(tenant_id);
CREATE INDEX idx_consent_records_patient ON consent_records(patient_id);
CREATE INDEX idx_consent_records_admission ON consent_records(admission_id) WHERE admission_id IS NOT NULL;
CREATE INDEX idx_consent_records_type ON consent_records(consent_type);
CREATE INDEX idx_consent_records_active ON consent_records(patient_id, consent_type) WHERE NOT is_revoked;

ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY consent_records_tenant ON consent_records
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE TRIGGER trg_consent_records_updated_at BEFORE UPDATE ON consent_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── MRD Form Records ────────────────────────────────────────────
-- Tracks filled MRD forms (progress notes, assessments, etc.)

CREATE TABLE IF NOT EXISTS mrd_form_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    admission_id    UUID NOT NULL REFERENCES admissions(id),
    form_type       VARCHAR(50) NOT NULL
        CHECK (form_type IN (
            'progress_note', 'nursing_assessment', 'mar', 'vitals_chart',
            'io_chart', 'discharge_checklist', 'pain_assessment', 'fall_risk',
            'pressure_ulcer_risk', 'gcs', 'restraint_doc', 'preop_checklist',
            'who_surgical_safety', 'anesthesia_record', 'operation_notes',
            'postop_orders', 'blood_requisition', 'transfusion_monitoring',
            'wound_assessment', 'nutrition_screening'
        )),
    template_id     UUID REFERENCES document_templates(id),
    form_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    form_time       TIME,
    shift           VARCHAR(20) CHECK (shift IN ('morning', 'afternoon', 'night')),

    -- Form data (JSONB for flexibility)
    form_data       JSONB NOT NULL DEFAULT '{}',

    -- Signatures
    completed_by    UUID REFERENCES users(id),
    completed_at    TIMESTAMPTZ,
    verified_by     UUID REFERENCES users(id),
    verified_at     TIMESTAMPTZ,

    -- Document storage
    pdf_url         TEXT,

    -- Audit
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      UUID NOT NULL REFERENCES users(id),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mrd_form_records_tenant ON mrd_form_records(tenant_id);
CREATE INDEX idx_mrd_form_records_admission ON mrd_form_records(admission_id);
CREATE INDEX idx_mrd_form_records_type ON mrd_form_records(form_type);
CREATE INDEX idx_mrd_form_records_date ON mrd_form_records(admission_id, form_date);

ALTER TABLE mrd_form_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY mrd_form_records_tenant ON mrd_form_records
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE TRIGGER trg_mrd_form_records_updated_at BEFORE UPDATE ON mrd_form_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- print_jobs already exists from migration 071_documents.sql — skipped

-- ── Seed Consent Form Templates ────────────────────────────────
-- Uses existing enum values: consent_form, visitor_pass (from 071/089)
-- Uses print_format column (not paper_size/orientation)

INSERT INTO document_templates (
    tenant_id, category, code, name, description,
    header_layout, body_layout, footer_layout,
    print_format, is_active
)
SELECT
    t.id,
    'consent_form',
    'consent_general_admission',
    'General Admission Consent Form',
    'Standard consent for hospital admission',
    '{"logo": true, "hospital_name": true, "address": true}'::jsonb,
    '{
        "sections": [
            {"type": "heading", "text": "CONSENT FOR ADMISSION AND TREATMENT"},
            {"type": "patient_info", "fields": ["name", "uhid", "age", "gender", "address"]},
            {"type": "paragraph", "text": "I, the undersigned patient/guardian, hereby consent to admission and treatment at this hospital."},
            {"type": "paragraph", "text": "I understand that:\\n1. The nature of my illness has been explained to me\\n2. I consent to all necessary investigations and treatments\\n3. I authorize the hospital staff to provide appropriate care\\n4. I understand the hospital rules and regulations"},
            {"type": "risks_section", "heading": "Risks Explained"},
            {"type": "alternatives_section", "heading": "Alternatives Discussed"},
            {"type": "signature_block", "signatures": ["patient", "guardian", "witness", "doctor"]}
        ]
    }'::jsonb,
    '{"page_number": true, "printed_date": true, "form_id": true}'::jsonb,
    'a4_portrait',
    true
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM document_templates dt
    WHERE dt.tenant_id = t.id AND dt.code = 'consent_general_admission'
);

INSERT INTO document_templates (
    tenant_id, category, code, name, description,
    header_layout, body_layout, footer_layout,
    print_format, is_active
)
SELECT
    t.id,
    'consent_form',
    'consent_surgical_procedure',
    'Surgical Procedure Consent Form',
    'Informed consent for surgical procedures',
    '{"logo": true, "hospital_name": true, "department": "Surgery"}'::jsonb,
    '{
        "sections": [
            {"type": "heading", "text": "INFORMED CONSENT FOR SURGERY"},
            {"type": "patient_info", "fields": ["name", "uhid", "age", "gender", "bed"]},
            {"type": "procedure_info", "fields": ["procedure_name", "surgeon", "date", "time"]},
            {"type": "paragraph", "text": "I hereby authorize the surgeon and medical team to perform the above procedure."},
            {"type": "risks_list", "heading": "Potential Risks and Complications"},
            {"type": "alternatives_list", "heading": "Alternative Treatment Options"},
            {"type": "paragraph", "text": "I confirm that:\\n1. The procedure has been explained in a language I understand\\n2. I have had the opportunity to ask questions\\n3. I understand the risks, benefits, and alternatives\\n4. I consent voluntarily without coercion"},
            {"type": "signature_block", "signatures": ["patient", "guardian", "witness", "surgeon"]}
        ]
    }'::jsonb,
    '{"page_number": true, "printed_date": true, "form_id": true}'::jsonb,
    'a4_portrait',
    true
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM document_templates dt
    WHERE dt.tenant_id = t.id AND dt.code = 'consent_surgical_procedure'
);

INSERT INTO document_templates (
    tenant_id, category, code, name, description,
    header_layout, body_layout, footer_layout,
    print_format, is_active
)
SELECT
    t.id,
    'consent_form',
    'consent_discharge_ama',
    'Discharge Against Medical Advice',
    'AMA/LAMA discharge form',
    '{"logo": true, "hospital_name": true, "warning_banner": "DISCHARGE AGAINST MEDICAL ADVICE"}'::jsonb,
    '{
        "sections": [
            {"type": "heading", "text": "DISCHARGE AGAINST MEDICAL ADVICE (AMA/LAMA)"},
            {"type": "patient_info", "fields": ["name", "uhid", "age", "gender", "admission_date", "bed"]},
            {"type": "paragraph", "text": "I, the undersigned, hereby request discharge from the hospital against the advice of my treating physicians."},
            {"type": "paragraph", "text": "I acknowledge that:\\n1. I have been informed of my diagnosis and medical condition\\n2. The doctors have advised me to continue treatment\\n3. Leaving against medical advice may result in serious harm or death\\n4. I take full responsibility for this decision\\n5. I release the hospital and medical staff from liability"},
            {"type": "reason_section", "heading": "Reason for AMA Discharge"},
            {"type": "advice_given", "heading": "Medical Advice Given at Discharge"},
            {"type": "signature_block", "signatures": ["patient", "guardian", "witness", "doctor"]}
        ]
    }'::jsonb,
    '{"page_number": true, "printed_date": true, "form_id": true, "warning": "This document must be retained permanently"}'::jsonb,
    'a4_portrait',
    true
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM document_templates dt
    WHERE dt.tenant_id = t.id AND dt.code = 'consent_discharge_ama'
);

-- ── Token Slip Template ────────────────────────────────────────

INSERT INTO document_templates (
    tenant_id, category, code, name, description,
    header_layout, body_layout, footer_layout,
    print_format, is_active
)
SELECT
    t.id,
    'custom',
    'queue_token_slip',
    'Queue Token Slip',
    'OPD queue token for patients',
    '{"logo": true, "hospital_name": true, "compact": true}'::jsonb,
    '{
        "sections": [
            {"type": "token_number", "size": "large"},
            {"type": "department", "label": "Department"},
            {"type": "doctor_name", "label": "Doctor"},
            {"type": "patient_name", "label": "Patient", "privacy": "configurable"},
            {"type": "estimated_wait", "label": "Est. Wait"},
            {"type": "qr_code", "data": "token_id"},
            {"type": "instructions", "text": "Please wait for your token to be called. Listen for announcements."}
        ]
    }'::jsonb,
    '{"printed_time": true}'::jsonb,
    'thermal_80mm',
    true
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM document_templates dt
    WHERE dt.tenant_id = t.id AND dt.code = 'queue_token_slip'
);
