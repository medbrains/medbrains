-- ====================================================================
-- Migration: 141_clinical_procurement_lab_regulatory_gaps.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: death_records, death_other_conditions, transfusions,
--             surgeries, patient_education, dpdp_consents,
--             restraint_documentation, stores, indents, goods_receipts,
--             stock_transfers, histopath_results, lab_qc_metrics,
--             quality_indicator_data, rca_reports, pcpndt_equipment,
--             aebas_department_attendance, aebas_period_summary,
--             age_estimations, component_issues, beds, tv_displays,
--             form_fields
-- Drops: none
-- ====================================================================
-- Closes the remaining schema gaps from the smoke layer's "relation
-- does not exist" 5xx errors. Column lists derived from the actual
-- SELECT clauses in print_data_*.rs handlers (every column the
-- handler binds is included).
-- ====================================================================

-- ── Clinical / print: death_records + other_conditions ─────────────

CREATE TABLE IF NOT EXISTS death_records (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id),
    patient_id                  UUID NOT NULL,
    certificate_number          TEXT,
    registration_number         TEXT,
    registration_date           DATE,
    place_of_death              TEXT,
    date_of_death               DATE,
    time_of_death               TIME,
    manner_of_death             TEXT,
    cause_immediate             TEXT,
    cause_antecedent            TEXT,
    cause_underlying            TEXT,
    duration_of_illness         TEXT,
    icd_code_immediate          TEXT,
    icd_code_underlying         TEXT,
    attended_by_doctor          BOOLEAN,
    attending_doctor_id         UUID REFERENCES users(id),
    pregnancy_status            TEXT,
    pregnancy_contributed       BOOLEAN,
    mlc_case                    BOOLEAN NOT NULL DEFAULT false,
    mlc_number                  TEXT,
    autopsy_performed           BOOLEAN NOT NULL DEFAULT false,
    autopsy_findings            TEXT,
    informant_name              TEXT,
    informant_relationship      TEXT,
    informant_address           TEXT,
    certified_by_id             UUID REFERENCES users(id),
    certification_date          DATE,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_death_records_patient ON death_records(tenant_id, patient_id, created_at DESC);
ALTER TABLE death_records FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('death_records');

CREATE TABLE IF NOT EXISTS death_other_conditions (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id),
    death_record_id             UUID NOT NULL REFERENCES death_records(id) ON DELETE CASCADE,
    condition_description       TEXT NOT NULL,
    display_order               INT NOT NULL DEFAULT 0,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_death_conditions_record ON death_other_conditions(death_record_id, display_order);
ALTER TABLE death_other_conditions FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('death_other_conditions');

-- ── Clinical: transfusions ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS transfusions (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id),
    admission_id                UUID,
    transfusion_date            DATE,
    product_type                TEXT,
    bag_number                  TEXT,
    blood_group                 TEXT,
    rh_factor                   TEXT,
    volume_ml                   INT,
    expiry_date                 DATE,
    crossmatch_compatible       BOOLEAN,
    patient_verified_by_id      UUID REFERENCES users(id),
    product_verified_by_id      UUID REFERENCES users(id),
    consent_on_file             BOOLEAN,
    transfusion_start_time      TIMESTAMPTZ,
    started_by_id               UUID REFERENCES users(id),
    transfusion_end_time        TIMESTAMPTZ,
    total_volume_infused_ml     INT,
    adverse_reaction            BOOLEAN NOT NULL DEFAULT false,
    reaction_type               TEXT,
    reaction_time               TIMESTAMPTZ,
    action_taken                TEXT,
    completed_by_id             UUID REFERENCES users(id),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transfusions_admission ON transfusions(tenant_id, admission_id, transfusion_date DESC);
ALTER TABLE transfusions FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('transfusions');

-- ── Clinical / OT: surgeries ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS surgeries (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id),
    patient_id                  UUID NOT NULL,
    admission_id                UUID,
    ot_id                       UUID,
    diagnosis                   TEXT,
    procedure_name              TEXT,
    surgery_type                TEXT,
    surgeon_id                  UUID REFERENCES users(id),
    assistant_surgeon_id        UUID REFERENCES users(id),
    anesthesiologist_id         UUID REFERENCES users(id),
    anesthesia_type             TEXT,
    scrub_nurse                 TEXT,
    scrub_nurse_id              UUID REFERENCES users(id),
    circulating_nurse           TEXT,
    circulating_nurse_id        UUID REFERENCES users(id),
    surgery_date                DATE,
    scheduled_time              TIMESTAMPTZ,
    surgery_start_time          TIMESTAMPTZ,
    surgery_end_time            TIMESTAMPTZ,
    actual_start_time           TIMESTAMPTZ,
    actual_end_time             TIMESTAMPTZ,
    outcome                     TEXT,
    complications               TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_surgeries_patient ON surgeries(tenant_id, patient_id, surgery_date DESC);
ALTER TABLE surgeries FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('surgeries');

-- ── Clinical: patient_education ────────────────────────────────────

CREATE TABLE IF NOT EXISTS patient_education (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id),
    patient_id                  UUID NOT NULL,
    material_id                 UUID,
    language                    TEXT NOT NULL DEFAULT 'en',
    provided_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    provided_by                 UUID REFERENCES users(id),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_patient_education_patient ON patient_education(tenant_id, patient_id, provided_at DESC);
ALTER TABLE patient_education FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('patient_education');

-- ── Clinical/consent: dpdp_consents ────────────────────────────────

CREATE TABLE IF NOT EXISTS dpdp_consents (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id),
    consent_number              TEXT,
    patient_id                  UUID NOT NULL,
    guardian_name               TEXT,
    retention_period            TEXT NOT NULL DEFAULT '5 years or as per legal requirement',
    consent_given               BOOLEAN NOT NULL DEFAULT false,
    consent_method              TEXT NOT NULL DEFAULT 'Physical',
    witness_name                TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dpdp_consents_patient ON dpdp_consents(tenant_id, patient_id, created_at DESC);
ALTER TABLE dpdp_consents FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('dpdp_consents');

-- ── Clinical: restraint_documentation ──────────────────────────────

CREATE TABLE IF NOT EXISTS restraint_documentation (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                       UUID NOT NULL REFERENCES tenants(id),
    form_number                     TEXT,
    patient_id                      UUID NOT NULL,
    admission_id                    UUID,
    ward_id                         UUID,
    diagnosis                       TEXT,
    restraint_type                  TEXT,
    restraint_device                TEXT,
    indication                      TEXT,
    start_datetime                  TIMESTAMPTZ,
    planned_duration                TEXT,
    actual_end                      TIMESTAMPTZ,
    ordering_physician_id           UUID REFERENCES users(id),
    physician_assessment            TEXT,
    patient_condition_on_release    TEXT,
    family_notified                 BOOLEAN NOT NULL DEFAULT false,
    family_notification_datetime    TIMESTAMPTZ,
    patient_rights_explained        BOOLEAN NOT NULL DEFAULT false,
    consent_obtained                BOOLEAN NOT NULL DEFAULT false,
    consent_from                    TEXT,
    review_by_psychiatrist          BOOLEAN NOT NULL DEFAULT false,
    psychiatrist_id                 UUID REFERENCES users(id),
    mhca_compliance_verified        BOOLEAN NOT NULL DEFAULT false,
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_restraint_doc_patient ON restraint_documentation(tenant_id, patient_id, start_datetime DESC);
ALTER TABLE restraint_documentation FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('restraint_documentation');

-- ── Procurement: stores ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stores (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id),
    name                        TEXT NOT NULL,
    ndps_license_number         TEXT,
    ndps_license_valid_until    DATE,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE stores FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('stores');

-- ── Procurement: indents ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS indents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    indent_number       TEXT,
    indent_date         DATE,
    indent_type         TEXT,
    priority            TEXT,
    department_id       UUID REFERENCES departments(id),
    store_id            UUID REFERENCES stores(id),
    requested_by        UUID REFERENCES users(id),
    estimated_value     NUMERIC(14,2),
    justification       TEXT,
    approved_by         UUID REFERENCES users(id),
    approved_at         TIMESTAMPTZ,
    status              TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_indents_dept ON indents(tenant_id, department_id, created_at DESC);
ALTER TABLE indents FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('indents');

-- ── Procurement: goods_receipts ────────────────────────────────────

CREATE TABLE IF NOT EXISTS goods_receipts (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id),
    grn_number                  TEXT,
    grn_date                    DATE,
    po_id                       UUID,
    vendor_id                   UUID,
    vendor_invoice_number       TEXT,
    vendor_invoice_date         DATE,
    challan_number              TEXT,
    store_id                    UUID REFERENCES stores(id),
    quality_check_done          BOOLEAN NOT NULL DEFAULT false,
    quality_remarks             TEXT,
    received_by                 UUID REFERENCES users(id),
    verified_by                 UUID REFERENCES users(id),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_grn_vendor ON goods_receipts(tenant_id, vendor_id, grn_date DESC);
ALTER TABLE goods_receipts FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('goods_receipts');

-- ── Procurement: stock_transfers ───────────────────────────────────

CREATE TABLE IF NOT EXISTS stock_transfers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    transfer_number     TEXT,
    transfer_date       DATE,
    from_store_id       UUID REFERENCES stores(id),
    to_store_id         UUID REFERENCES stores(id),
    transfer_type       TEXT,
    reason              TEXT,
    initiated_by        UUID REFERENCES users(id),
    dispatched_by       UUID REFERENCES users(id),
    dispatched_at       TIMESTAMPTZ,
    received_by         UUID REFERENCES users(id),
    received_at         TIMESTAMPTZ,
    status              TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_from ON stock_transfers(tenant_id, from_store_id, transfer_date DESC);
ALTER TABLE stock_transfers FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('stock_transfers');

-- ── Lab/Quality: histopath_results ─────────────────────────────────

CREATE TABLE IF NOT EXISTS histopath_results (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id),
    order_id                    UUID,
    gross_description           TEXT,
    microscopic_description     TEXT,
    diagnosis                   TEXT,
    icd_o_morphology            TEXT,
    icd_o_topography            TEXT,
    staging                     TEXT,
    grade                       TEXT,
    margin_status               TEXT,
    lymph_node_status           TEXT,
    comments                    TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_histopath_order ON histopath_results(tenant_id, order_id);
ALTER TABLE histopath_results FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('histopath_results');

-- ── Lab QC: lab_qc_metrics ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lab_qc_metrics (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    period              TEXT,
    analyte             TEXT,
    mean                NUMERIC(14,4),
    sd                  NUMERIC(14,4),
    cv                  NUMERIC(7,2),
    westgard_violations TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lab_qc_period ON lab_qc_metrics(tenant_id, period, analyte);
ALTER TABLE lab_qc_metrics FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('lab_qc_metrics');

-- ── Quality: quality_indicator_data ────────────────────────────────

CREATE TABLE IF NOT EXISTS quality_indicator_data (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    indicator_id        UUID,
    numerator           INT,
    denominator         INT,
    rate                NUMERIC(7,2),
    status              TEXT,
    trend               TEXT,
    period              TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_qid_period ON quality_indicator_data(tenant_id, indicator_id, period DESC);
ALTER TABLE quality_indicator_data FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('quality_indicator_data');

-- ── Quality: rca_reports ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rca_reports (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id),
    rca_number                  TEXT,
    incident_id                 UUID,
    rca_start_date              DATE,
    rca_completion_date         DATE,
    problem_statement           TEXT,
    analysis_method             TEXT,
    prepared_by                 UUID REFERENCES users(id),
    reviewed_by                 UUID REFERENCES users(id),
    approved_by                 UUID REFERENCES users(id),
    status                      TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE rca_reports FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('rca_reports');

-- ── Regulatory: pcpndt_equipment ───────────────────────────────────

CREATE TABLE IF NOT EXISTS pcpndt_equipment (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    equipment_name      TEXT NOT NULL,
    registration_number TEXT,
    location            TEXT,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE pcpndt_equipment FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('pcpndt_equipment');

-- ── Regulatory: aebas_department_attendance + period_summary ───────

CREATE TABLE IF NOT EXISTS aebas_department_attendance (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id),
    period                      TEXT NOT NULL,
    department_name             TEXT NOT NULL,
    total_employees             INT NOT NULL DEFAULT 0,
    average_present             INT NOT NULL DEFAULT 0,
    average_absent              INT NOT NULL DEFAULT 0,
    average_leave               INT NOT NULL DEFAULT 0,
    attendance_percentage       NUMERIC(5,2),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE aebas_department_attendance FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('aebas_department_attendance');

CREATE TABLE IF NOT EXISTS aebas_period_summary (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                       UUID NOT NULL REFERENCES tenants(id),
    period                          TEXT NOT NULL,
    total_employees                 INT NOT NULL DEFAULT 0,
    average_attendance_percentage   NUMERIC(5,2),
    total_working_days              INT NOT NULL DEFAULT 0,
    holidays                        INT NOT NULL DEFAULT 0,
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, period)
);
ALTER TABLE aebas_period_summary FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('aebas_period_summary');

-- ── Regulatory: age_estimations ────────────────────────────────────

CREATE TABLE IF NOT EXISTS age_estimations (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id),
    case_id                     UUID,
    voice_change                BOOLEAN,
    other_findings              TEXT,
    dental_formula              TEXT,
    third_molars_status         TEXT,
    teeth_wear                  TEXT,
    xray_wrist_findings         TEXT,
    xray_elbow_findings         TEXT,
    xray_shoulder_findings      TEXT,
    estimated_age_years         INT,
    age_range_min               INT,
    age_range_max               INT,
    opinion_basis               TEXT,
    examining_doctor_id         UUID REFERENCES users(id),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE age_estimations FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('age_estimations');

-- ── Other: component_issues ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS component_issues (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id),
    blood_bag_unit_id           UUID,
    special_instructions        TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE component_issues FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('component_issues');

-- ── Other: beds (lightweight, used by dashboard COUNT) ─────────────

CREATE TABLE IF NOT EXISTS beds (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    bed_number          TEXT,
    ward_id             UUID,
    is_occupied         BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_beds_ward ON beds(tenant_id, ward_id);
ALTER TABLE beds FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('beds');

-- ── Other: tv_displays ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tv_displays (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    department_id       UUID REFERENCES departments(id),
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE tv_displays FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('tv_displays');

-- ── Other: form_fields (form-builder eradicated; stub for legacy queries) ─

CREATE TABLE IF NOT EXISTS form_fields (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id             UUID,
    field_master_id     UUID,
    section_id          UUID,
    sort_order          INT NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_form_fields_form ON form_fields(form_id, sort_order);
