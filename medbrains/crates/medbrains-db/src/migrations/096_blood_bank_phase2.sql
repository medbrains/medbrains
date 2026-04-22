-- 092_blood_bank_phase2.sql — Blood Bank Phase 2
-- Recruitment, cold chain, returns, MSBOS, lookback, SBTC, billing

-- ═══════════════════════════════════════════════════════════
--  ENUMS
-- ═══════════════════════════════════════════════════════════

CREATE TYPE bb_return_status AS ENUM ('requested', 'inspecting', 'accepted', 'rejected');
CREATE TYPE bb_lookback_status AS ENUM ('detected', 'investigating', 'notified', 'closed');
CREATE TYPE bb_billing_status AS ENUM ('pending', 'invoiced', 'paid', 'waived');
CREATE TYPE bb_cold_chain_alert_level AS ENUM ('normal', 'warning', 'critical');

-- ═══════════════════════════════════════════════════════════
--  ALTER EXISTING TABLES
-- ═══════════════════════════════════════════════════════════

ALTER TABLE blood_donors
    ADD COLUMN IF NOT EXISTS eligibility_next_date DATE,
    ADD COLUMN IF NOT EXISTS recruitment_status TEXT,
    ADD COLUMN IF NOT EXISTS preferred_contact TEXT;

ALTER TABLE crossmatch_requests
    ADD COLUMN IF NOT EXISTS msbos_limit INTEGER,
    ADD COLUMN IF NOT EXISTS msbos_procedure TEXT;

-- ═══════════════════════════════════════════════════════════
--  TABLE 1: bb_recruitment_campaigns
-- ═══════════════════════════════════════════════════════════

CREATE TABLE bb_recruitment_campaigns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    campaign_name   TEXT NOT NULL,
    campaign_type   TEXT NOT NULL,
    target_blood_groups JSONB,
    target_count    INTEGER,
    actual_count    INTEGER DEFAULT 0,
    start_date      DATE NOT NULL,
    end_date        DATE,
    status          TEXT NOT NULL DEFAULT 'planned',
    notes           TEXT,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE bb_recruitment_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON bb_recruitment_campaigns
    USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE INDEX idx_bb_recruit_tenant ON bb_recruitment_campaigns(tenant_id);
CREATE INDEX idx_bb_recruit_status ON bb_recruitment_campaigns(tenant_id, status);
CREATE TRIGGER trg_bb_recruit_updated_at
    BEFORE UPDATE ON bb_recruitment_campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════
--  TABLE 2: bb_cold_chain_devices
-- ═══════════════════════════════════════════════════════════

CREATE TABLE bb_cold_chain_devices (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),
    device_name             TEXT NOT NULL,
    device_serial           TEXT,
    location                TEXT,
    equipment_type          TEXT NOT NULL,
    min_temp                NUMERIC(5,1),
    max_temp                NUMERIC(5,1),
    alert_threshold_minutes INTEGER DEFAULT 30,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    last_reading_at         TIMESTAMPTZ,
    last_temp               NUMERIC(5,1),
    alert_level             bb_cold_chain_alert_level DEFAULT 'normal',
    notes                   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE bb_cold_chain_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON bb_cold_chain_devices
    USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE INDEX idx_bb_cc_dev_tenant ON bb_cold_chain_devices(tenant_id);
CREATE TRIGGER trg_bb_cc_dev_updated_at
    BEFORE UPDATE ON bb_cold_chain_devices FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════
--  TABLE 3: bb_cold_chain_readings (append-only)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE bb_cold_chain_readings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    device_id   UUID NOT NULL REFERENCES bb_cold_chain_devices(id),
    temperature NUMERIC(5,1) NOT NULL,
    humidity    NUMERIC(5,1),
    alert_level bb_cold_chain_alert_level DEFAULT 'normal',
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE bb_cold_chain_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON bb_cold_chain_readings
    USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE INDEX idx_bb_cc_read_tenant ON bb_cold_chain_readings(tenant_id);
CREATE INDEX idx_bb_cc_read_device ON bb_cold_chain_readings(tenant_id, device_id);
CREATE INDEX idx_bb_cc_read_time   ON bb_cold_chain_readings(tenant_id, recorded_at DESC);

-- ═══════════════════════════════════════════════════════════
--  TABLE 4: bb_blood_returns
-- ═══════════════════════════════════════════════════════════

CREATE TABLE bb_blood_returns (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),
    component_id            UUID NOT NULL REFERENCES blood_components(id),
    return_code             TEXT NOT NULL,
    returned_by             UUID REFERENCES users(id),
    return_reason           TEXT,
    temperature_at_return   NUMERIC(5,1),
    temperature_acceptable  BOOLEAN,
    time_out_minutes        INTEGER,
    status                  bb_return_status NOT NULL DEFAULT 'requested',
    inspection_notes        TEXT,
    inspected_by            UUID REFERENCES users(id),
    inspected_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, return_code)
);

ALTER TABLE bb_blood_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON bb_blood_returns
    USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE INDEX idx_bb_ret_tenant ON bb_blood_returns(tenant_id);
CREATE INDEX idx_bb_ret_status ON bb_blood_returns(tenant_id, status);
CREATE TRIGGER trg_bb_ret_updated_at
    BEFORE UPDATE ON bb_blood_returns FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════
--  TABLE 5: bb_msbos_guidelines
-- ═══════════════════════════════════════════════════════════

CREATE TABLE bb_msbos_guidelines (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id),
    procedure_name              TEXT NOT NULL,
    procedure_code              TEXT NOT NULL,
    blood_group                 TEXT,
    component_type              blood_component_type NOT NULL,
    max_units                   INTEGER NOT NULL,
    crossmatch_to_transfusion_ratio NUMERIC(4,2),
    is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
    notes                       TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, procedure_code, component_type)
);

ALTER TABLE bb_msbos_guidelines ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON bb_msbos_guidelines
    USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE INDEX idx_bb_msbos_tenant ON bb_msbos_guidelines(tenant_id);
CREATE TRIGGER trg_bb_msbos_updated_at
    BEFORE UPDATE ON bb_msbos_guidelines FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════
--  TABLE 6: bb_lookback_events
-- ═══════════════════════════════════════════════════════════

CREATE TABLE bb_lookback_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    event_code          TEXT NOT NULL,
    donation_id         UUID REFERENCES blood_donations(id),
    donor_id            UUID REFERENCES blood_donors(id),
    infection_type      TEXT NOT NULL,
    detection_date      DATE NOT NULL,
    status              bb_lookback_status NOT NULL DEFAULT 'detected',
    affected_components JSONB,
    recipients_notified INTEGER DEFAULT 0,
    investigation_notes TEXT,
    reported_to         TEXT,
    reported_at         TIMESTAMPTZ,
    closed_at           TIMESTAMPTZ,
    closed_by           UUID REFERENCES users(id),
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, event_code)
);

ALTER TABLE bb_lookback_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON bb_lookback_events
    USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE INDEX idx_bb_lookback_tenant ON bb_lookback_events(tenant_id);
CREATE INDEX idx_bb_lookback_status ON bb_lookback_events(tenant_id, status);
CREATE TRIGGER trg_bb_lookback_updated_at
    BEFORE UPDATE ON bb_lookback_events FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════
--  TABLE 7: bb_billing_items
-- ═══════════════════════════════════════════════════════════

CREATE TABLE bb_billing_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    component_id    UUID REFERENCES blood_components(id),
    patient_id      UUID REFERENCES patients(id),
    billing_code    TEXT NOT NULL,
    component_type  blood_component_type,
    blood_group     TEXT,
    processing_fee  NUMERIC(12,2) DEFAULT 0,
    component_cost  NUMERIC(12,2) DEFAULT 0,
    cross_match_fee NUMERIC(12,2) DEFAULT 0,
    total_amount    NUMERIC(12,2) DEFAULT 0,
    status          bb_billing_status NOT NULL DEFAULT 'pending',
    invoice_id      UUID,
    waiver_reason   TEXT,
    billed_by       UUID REFERENCES users(id),
    billed_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, billing_code)
);

ALTER TABLE bb_billing_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON bb_billing_items
    USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE INDEX idx_bb_bill_tenant  ON bb_billing_items(tenant_id);
CREATE INDEX idx_bb_bill_status  ON bb_billing_items(tenant_id, status);
CREATE INDEX idx_bb_bill_patient ON bb_billing_items(tenant_id, patient_id);
CREATE TRIGGER trg_bb_bill_updated_at
    BEFORE UPDATE ON bb_billing_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
