-- Migration 100: Multi-Hospital Management
-- Hospital groups, regions, inter-hospital transfers, consolidated reporting

-- ── Hospital Groups (Chain Level) ─────────────────────────────────

CREATE TABLE hospital_groups (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    display_name    TEXT,
    -- Contact
    headquarters_address TEXT,
    phone           TEXT,
    email           TEXT,
    website         TEXT,
    -- Branding
    logo_url        TEXT,
    primary_color   TEXT DEFAULT '#228be6',
    -- Config
    config          JSONB DEFAULT '{}'::jsonb,
    default_currency TEXT DEFAULT 'INR',
    timezone        TEXT DEFAULT 'Asia/Kolkata',
    -- Status
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_hospital_groups_code ON hospital_groups(code);

-- ── Regions (Geographic Groupings) ────────────────────────────────

CREATE TABLE hospital_regions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id        UUID NOT NULL REFERENCES hospital_groups(id),
    code            TEXT NOT NULL,
    name            TEXT NOT NULL,
    country         TEXT DEFAULT 'India',
    states          TEXT[],
    -- Regional head
    regional_head_name TEXT,
    regional_head_email TEXT,
    regional_head_phone TEXT,
    -- Config
    config          JSONB DEFAULT '{}'::jsonb,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(group_id, code)
);

CREATE INDEX idx_hospital_regions_group ON hospital_regions(group_id);

-- ── Hospital Group Membership ─────────────────────────────────────

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES hospital_groups(id);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES hospital_regions(id);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS branch_code TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_headquarters BOOLEAN DEFAULT FALSE;

CREATE INDEX idx_tenants_group ON tenants(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX idx_tenants_region ON tenants(region_id) WHERE region_id IS NOT NULL;

-- ── Centralized Master Data ───────────────────────────────────────

-- Group-level drug master (shared across all hospitals)
CREATE TABLE group_drug_master (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id        UUID NOT NULL REFERENCES hospital_groups(id),
    code            TEXT NOT NULL,
    name            TEXT NOT NULL,
    generic_name    TEXT,
    manufacturer    TEXT,
    drug_schedule   TEXT,
    atc_code        TEXT,
    formulation     TEXT,
    strength        TEXT,
    unit            TEXT,
    hsn_code        TEXT,
    gst_rate        NUMERIC(5,2) DEFAULT 12.00,
    is_controlled   BOOLEAN DEFAULT FALSE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(group_id, code)
);

CREATE INDEX idx_group_drug_master ON group_drug_master(group_id);

-- Group-level test master (shared across all hospitals)
CREATE TABLE group_test_master (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id        UUID NOT NULL REFERENCES hospital_groups(id),
    code            TEXT NOT NULL,
    name            TEXT NOT NULL,
    category        TEXT,
    department      TEXT,
    loinc_code      TEXT,
    sample_type     TEXT,
    container_type  TEXT,
    volume_required TEXT,
    tat_hours       INT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(group_id, code)
);

CREATE INDEX idx_group_test_master ON group_test_master(group_id);

-- Group-level tariff master (base prices)
CREATE TABLE group_tariff_master (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id        UUID NOT NULL REFERENCES hospital_groups(id),
    service_code    TEXT NOT NULL,
    service_name    TEXT NOT NULL,
    category        TEXT,
    base_price      NUMERIC(14,2) NOT NULL,
    gst_applicable  BOOLEAN DEFAULT TRUE,
    gst_rate        NUMERIC(5,2) DEFAULT 18.00,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(group_id, service_code)
);

CREATE INDEX idx_group_tariff_master ON group_tariff_master(group_id);

-- Hospital-level price overrides
CREATE TABLE hospital_price_overrides (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    group_tariff_id UUID NOT NULL REFERENCES group_tariff_master(id),
    override_price  NUMERIC(14,2) NOT NULL,
    effective_from  DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to    DATE,
    reason          TEXT,
    approved_by     UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, group_tariff_id, effective_from)
);

ALTER TABLE hospital_price_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY hospital_price_overrides_tenant ON hospital_price_overrides
    USING (tenant_id::text = current_setting('app.tenant_id', true));

-- ── Cross-Hospital User Management ────────────────────────────────

-- Users who can access multiple hospitals
CREATE TABLE user_hospital_assignments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    role            TEXT NOT NULL,
    permissions     JSONB DEFAULT '[]'::jsonb,
    is_primary      BOOLEAN DEFAULT FALSE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    valid_from      DATE DEFAULT CURRENT_DATE,
    valid_to        DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, tenant_id)
);

CREATE INDEX idx_user_hospital_assignments_user ON user_hospital_assignments(user_id);
CREATE INDEX idx_user_hospital_assignments_tenant ON user_hospital_assignments(tenant_id);

-- ── Inter-Hospital Patient Transfers ──────────────────────────────

CREATE TYPE transfer_status AS ENUM (
    'requested',
    'approved',
    'in_transit',
    'received',
    'cancelled',
    'rejected'
);

CREATE TABLE patient_transfers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_tenant_id    UUID NOT NULL REFERENCES tenants(id),
    dest_tenant_id      UUID NOT NULL REFERENCES tenants(id),
    patient_id          UUID NOT NULL REFERENCES patients(id),
    admission_id        UUID,
    -- Transfer details
    transfer_type       TEXT NOT NULL DEFAULT 'clinical',
    reason              TEXT NOT NULL,
    clinical_summary    TEXT,
    priority            TEXT DEFAULT 'routine',
    -- Status
    status              transfer_status NOT NULL DEFAULT 'requested',
    -- Timestamps
    requested_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_at         TIMESTAMPTZ,
    departed_at         TIMESTAMPTZ,
    arrived_at          TIMESTAMPTZ,
    -- People
    requested_by        UUID NOT NULL REFERENCES users(id),
    approved_by         UUID REFERENCES users(id),
    received_by         UUID REFERENCES users(id),
    -- Transport
    transport_mode      TEXT,
    transport_details   JSONB DEFAULT '{}'::jsonb,
    -- Documents
    documents           JSONB DEFAULT '[]'::jsonb,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_patient_transfers_source ON patient_transfers(source_tenant_id);
CREATE INDEX idx_patient_transfers_dest ON patient_transfers(dest_tenant_id);
CREATE INDEX idx_patient_transfers_patient ON patient_transfers(patient_id);
CREATE INDEX idx_patient_transfers_status ON patient_transfers(status);

-- ── Inter-Hospital Stock Transfers ────────────────────────────────

CREATE TYPE stock_transfer_status AS ENUM (
    'requested',
    'approved',
    'dispatched',
    'in_transit',
    'received',
    'cancelled'
);

CREATE TABLE inter_hospital_stock_transfers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_tenant_id    UUID NOT NULL REFERENCES tenants(id),
    dest_tenant_id      UUID NOT NULL REFERENCES tenants(id),
    transfer_number     TEXT NOT NULL,
    -- Status
    status              stock_transfer_status NOT NULL DEFAULT 'requested',
    priority            TEXT DEFAULT 'normal',
    -- Timestamps
    requested_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_at         TIMESTAMPTZ,
    dispatched_at       TIMESTAMPTZ,
    received_at         TIMESTAMPTZ,
    -- People
    requested_by        UUID NOT NULL REFERENCES users(id),
    approved_by         UUID REFERENCES users(id),
    dispatched_by       UUID REFERENCES users(id),
    received_by         UUID REFERENCES users(id),
    -- Notes
    request_reason      TEXT,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_transfers_source ON inter_hospital_stock_transfers(source_tenant_id);
CREATE INDEX idx_stock_transfers_dest ON inter_hospital_stock_transfers(dest_tenant_id);
CREATE INDEX idx_stock_transfers_status ON inter_hospital_stock_transfers(status);

-- Stock transfer items
CREATE TABLE inter_hospital_stock_transfer_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id         UUID NOT NULL REFERENCES inter_hospital_stock_transfers(id) ON DELETE CASCADE,
    item_id             UUID NOT NULL,
    item_type           TEXT NOT NULL DEFAULT 'drug',
    item_code           TEXT NOT NULL,
    item_name           TEXT NOT NULL,
    batch_number        TEXT,
    expiry_date         DATE,
    requested_qty       NUMERIC(14,3) NOT NULL,
    approved_qty        NUMERIC(14,3),
    dispatched_qty      NUMERIC(14,3),
    received_qty        NUMERIC(14,3),
    unit                TEXT NOT NULL,
    unit_price          NUMERIC(14,2),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_transfer_items ON inter_hospital_stock_transfer_items(transfer_id);

-- ── Cross-Hospital Appointments ───────────────────────────────────

CREATE TABLE cross_hospital_appointments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_tenant_id   UUID NOT NULL REFERENCES tenants(id),
    service_tenant_id   UUID NOT NULL REFERENCES tenants(id),
    patient_id          UUID NOT NULL REFERENCES patients(id),
    appointment_id      UUID NOT NULL,
    -- Status
    status              TEXT NOT NULL DEFAULT 'booked',
    -- Metadata
    booked_by           UUID NOT NULL REFERENCES users(id),
    booking_source      TEXT DEFAULT 'direct',
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cross_hospital_appts_booking ON cross_hospital_appointments(booking_tenant_id);
CREATE INDEX idx_cross_hospital_appts_service ON cross_hospital_appointments(service_tenant_id);
CREATE INDEX idx_cross_hospital_appts_patient ON cross_hospital_appointments(patient_id);

-- ── Lab Sample Routing ────────────────────────────────────────────

CREATE TABLE lab_sample_routes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_tenant_id    UUID NOT NULL REFERENCES tenants(id),
    dest_tenant_id      UUID NOT NULL REFERENCES tenants(id),
    lab_order_id        UUID NOT NULL,
    sample_id           UUID,
    -- Test details
    test_code           TEXT NOT NULL,
    test_name           TEXT NOT NULL,
    -- Status
    status              TEXT NOT NULL DEFAULT 'pending_collection',
    -- Timestamps
    collected_at        TIMESTAMPTZ,
    dispatched_at       TIMESTAMPTZ,
    received_at         TIMESTAMPTZ,
    resulted_at         TIMESTAMPTZ,
    -- Transport
    courier_name        TEXT,
    tracking_number     TEXT,
    temperature_log     JSONB DEFAULT '[]'::jsonb,
    -- Notes
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lab_sample_routes_source ON lab_sample_routes(source_tenant_id);
CREATE INDEX idx_lab_sample_routes_dest ON lab_sample_routes(dest_tenant_id);
CREATE INDEX idx_lab_sample_routes_status ON lab_sample_routes(status);

-- ── Consolidated KPIs / Dashboards ────────────────────────────────

CREATE TABLE group_kpi_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id        UUID NOT NULL REFERENCES hospital_groups(id),
    tenant_id       UUID REFERENCES tenants(id),
    snapshot_date   DATE NOT NULL,
    snapshot_type   TEXT NOT NULL DEFAULT 'daily',
    -- Occupancy
    total_beds      INT,
    occupied_beds   INT,
    occupancy_pct   NUMERIC(5,2),
    -- OPD
    opd_visits      INT,
    new_patients    INT,
    -- Admissions
    admissions      INT,
    discharges      INT,
    -- Revenue
    gross_revenue   NUMERIC(14,2),
    net_revenue     NUMERIC(14,2),
    collections     NUMERIC(14,2),
    -- Quality
    avg_los         NUMERIC(5,2),
    mortality_rate  NUMERIC(5,4),
    readmission_rate NUMERIC(5,4),
    infection_rate  NUMERIC(5,4),
    -- Raw data
    metrics         JSONB DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_group_kpi_snapshots_group ON group_kpi_snapshots(group_id, snapshot_date);
CREATE INDEX idx_group_kpi_snapshots_tenant ON group_kpi_snapshots(tenant_id, snapshot_date);
CREATE UNIQUE INDEX idx_group_kpi_unique ON group_kpi_snapshots(group_id, tenant_id, snapshot_date, snapshot_type);

-- ── Doctor Rotation Schedule ──────────────────────────────────────

CREATE TABLE doctor_rotation_schedules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id        UUID NOT NULL REFERENCES hospital_groups(id),
    doctor_id       UUID NOT NULL REFERENCES users(id),
    schedule_date   DATE NOT NULL,
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    department_id   UUID,
    shift           TEXT DEFAULT 'morning',
    start_time      TIME,
    end_time        TIME,
    is_locum        BOOLEAN DEFAULT FALSE,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_doctor_rotation_group ON doctor_rotation_schedules(group_id);
CREATE INDEX idx_doctor_rotation_doctor ON doctor_rotation_schedules(doctor_id, schedule_date);
CREATE INDEX idx_doctor_rotation_tenant ON doctor_rotation_schedules(tenant_id, schedule_date);

-- ── Group Templates ───────────────────────────────────────────────

CREATE TABLE group_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id        UUID NOT NULL REFERENCES hospital_groups(id),
    template_type   TEXT NOT NULL,
    code            TEXT NOT NULL,
    name            TEXT NOT NULL,
    content         JSONB NOT NULL,
    version         INT DEFAULT 1,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(group_id, template_type, code)
);

CREATE INDEX idx_group_templates ON group_templates(group_id, template_type);

-- ── Triggers ──────────────────────────────────────────────────────

CREATE TRIGGER trg_hospital_groups_updated_at BEFORE UPDATE ON hospital_groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_hospital_regions_updated_at BEFORE UPDATE ON hospital_regions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_patient_transfers_updated_at BEFORE UPDATE ON patient_transfers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_stock_transfers_updated_at BEFORE UPDATE ON inter_hospital_stock_transfers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_user_hospital_assignments_updated_at BEFORE UPDATE ON user_hospital_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_doctor_rotation_updated_at BEFORE UPDATE ON doctor_rotation_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
