-- 104_device_instances.sql — Per-tenant device instances, bridge agents, message log
-- All tables use RLS for tenant isolation

-- ══════════════════════════════════════════════════════════
--  1. Device Instance Status Enum
-- ══════════════════════════════════════════════════════════

CREATE TYPE device_instance_status AS ENUM (
    'pending_setup',
    'configuring',
    'testing',
    'active',
    'degraded',
    'disconnected',
    'maintenance',
    'decommissioned'
);

-- ══════════════════════════════════════════════════════════
--  2. Bridge Agents — registered bridge runtime instances
-- ══════════════════════════════════════════════════════════

CREATE TABLE bridge_agents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID REFERENCES tenants(id),     -- NULL = multi-tenant cloud agent
    name            TEXT NOT NULL,
    agent_key_hash  TEXT NOT NULL,                   -- SHA-256 of API key
    deployment_mode TEXT NOT NULL DEFAULT 'on_premise'
        CHECK (deployment_mode IN ('on_premise', 'cloud_sidecar', 'embedded')),
    version         TEXT,
    hostname        TEXT,
    capabilities    TEXT[] NOT NULL DEFAULT '{}',     -- e.g. {"hl7_v2","astm","serial"}
    status          TEXT NOT NULL DEFAULT 'offline'
        CHECK (status IN ('online', 'offline', 'degraded')),
    last_heartbeat  TIMESTAMPTZ,
    devices_connected INTEGER NOT NULL DEFAULT 0,
    buffer_depth    INTEGER NOT NULL DEFAULT 0,
    metadata        JSONB NOT NULL DEFAULT '{}',
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE bridge_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY bridge_agents_tenant ON bridge_agents
    USING (
        tenant_id IS NULL
        OR tenant_id::text = current_setting('app.tenant_id', true)
    );

CREATE INDEX idx_bridge_agents_tenant ON bridge_agents(tenant_id);
CREATE INDEX idx_bridge_agents_status ON bridge_agents(status) WHERE is_active;

CREATE TRIGGER trg_bridge_agents_updated_at BEFORE UPDATE ON bridge_agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════════════════════════
--  3. Device Instances — per-tenant installed devices
-- ══════════════════════════════════════════════════════════

CREATE TABLE device_instances (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),

    -- Adapter reference (from global catalog)
    adapter_code        TEXT NOT NULL,

    -- Physical location
    facility_id         UUID REFERENCES facilities(id),
    department_id       UUID REFERENCES departments(id),

    -- Identity
    name                TEXT NOT NULL,
    code                TEXT NOT NULL,
    serial_number       TEXT,
    asset_tag           TEXT,
    bme_equipment_id    UUID,

    -- Connection (human-provided)
    hostname            TEXT,
    port                INTEGER,
    connection_string   TEXT,
    credentials         JSONB NOT NULL DEFAULT '{}',

    -- Protocol config (adapter defaults merged with human overrides)
    protocol_config     JSONB NOT NULL DEFAULT '{}',
    field_mappings      JSONB NOT NULL DEFAULT '[]',
    data_transforms     JSONB NOT NULL DEFAULT '[]',
    qc_config           JSONB NOT NULL DEFAULT '{}',
    message_filters     JSONB NOT NULL DEFAULT '{}',

    -- AI auto-config metadata
    ai_config_version   INTEGER NOT NULL DEFAULT 0,
    ai_confidence       REAL,
    human_overrides     JSONB NOT NULL DEFAULT '{}',
    config_source       TEXT NOT NULL DEFAULT 'manual'
        CHECK (config_source IN ('ai_auto', 'ai_assisted', 'manual', 'imported')),

    -- Operational state
    status              device_instance_status NOT NULL DEFAULT 'pending_setup',
    last_heartbeat      TIMESTAMPTZ,
    last_message_at     TIMESTAMPTZ,
    last_error          TEXT,
    error_count_24h     INTEGER NOT NULL DEFAULT 0,
    message_count_24h   INTEGER NOT NULL DEFAULT 0,

    -- Bridge assignment
    bridge_agent_id     UUID REFERENCES bridge_agents(id),

    -- Meta
    notes               TEXT,
    tags                TEXT[] NOT NULL DEFAULT '{}',
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_by          UUID REFERENCES users(id),
    updated_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, code)
);

ALTER TABLE device_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY device_instances_tenant ON device_instances
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX idx_device_instances_tenant ON device_instances(tenant_id);
CREATE INDEX idx_device_instances_adapter ON device_instances(adapter_code);
CREATE INDEX idx_device_instances_status ON device_instances(tenant_id, status);
CREATE INDEX idx_device_instances_bridge ON device_instances(bridge_agent_id);
CREATE INDEX idx_device_instances_dept ON device_instances(department_id);

CREATE TRIGGER trg_device_instances_updated_at BEFORE UPDATE ON device_instances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════════════════════════
--  4. Device Messages — raw inbound/outbound message log
-- ══════════════════════════════════════════════════════════

CREATE TYPE device_message_status AS ENUM (
    'received',
    'parsed',
    'mapped',
    'validated',
    'delivered',
    'failed',
    'rejected',
    'dead_letter'
);

CREATE TABLE device_messages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    device_instance_id  UUID NOT NULL REFERENCES device_instances(id),
    direction           TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    protocol            TEXT NOT NULL,

    -- Payloads
    raw_payload         BYTEA,
    parsed_payload      JSONB,
    mapped_data         JSONB,

    -- Processing
    processing_status   device_message_status NOT NULL DEFAULT 'received',
    target_module       TEXT,
    target_entity_id    UUID,
    error_message       TEXT,
    retry_count         INTEGER NOT NULL DEFAULT 0,
    max_retries         INTEGER NOT NULL DEFAULT 100,
    next_retry_at       TIMESTAMPTZ,
    processing_duration_ms INTEGER,

    -- Meta
    bridge_agent_id     UUID REFERENCES bridge_agents(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE device_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY device_messages_tenant ON device_messages
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX idx_device_messages_device ON device_messages(device_instance_id, created_at DESC);
CREATE INDEX idx_device_messages_status ON device_messages(processing_status)
    WHERE processing_status IN ('received', 'parsed', 'mapped', 'failed');
CREATE INDEX idx_device_messages_retry ON device_messages(next_retry_at)
    WHERE processing_status = 'failed' AND next_retry_at IS NOT NULL;

-- ══════════════════════════════════════════════════════════
--  5. Device Config History — audit trail for config changes
-- ══════════════════════════════════════════════════════════

CREATE TABLE device_config_history (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    device_instance_id  UUID NOT NULL REFERENCES device_instances(id),
    change_type         TEXT NOT NULL
        CHECK (change_type IN ('ai_auto_config', 'human_override', 'firmware_update', 'recalibration', 'adapter_upgrade', 'initial_setup')),
    previous_config     JSONB NOT NULL DEFAULT '{}',
    new_config          JSONB NOT NULL DEFAULT '{}',
    changed_fields      TEXT[] NOT NULL DEFAULT '{}',
    changed_by          UUID REFERENCES users(id),
    change_reason       TEXT,
    ai_confidence       REAL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE device_config_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY device_config_history_tenant ON device_config_history
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX idx_device_config_history_device ON device_config_history(device_instance_id, created_at DESC);

-- ══════════════════════════════════════════════════════════
--  6. Device Routing Rules — how incoming data maps to modules
-- ══════════════════════════════════════════════════════════
-- Configurable per-device or per-adapter-type.
-- When device data arrives, the server evaluates matching rules
-- to find the target record and create/update entities.

CREATE TABLE device_routing_rules (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    device_instance_id  UUID REFERENCES device_instances(id),  -- NULL = applies to all devices with this adapter
    adapter_code        TEXT,                                   -- match by adapter type (when device_instance_id is NULL)
    name                TEXT NOT NULL,
    description         TEXT,
    target_module       TEXT NOT NULL
        CHECK (target_module IN ('lab', 'radiology', 'vitals', 'pharmacy', 'blood_bank', 'icu', 'generic')),

    -- Matching: how to find the target record in MedBrains
    match_strategy      TEXT NOT NULL DEFAULT 'order_id'
        CHECK (match_strategy IN ('order_id', 'sample_barcode', 'patient_id', 'accession_number', 'uhid', 'custom')),
    match_field         TEXT NOT NULL,                          -- JSON path in parsed_payload to extract match value

    -- Target: what entity to create/update
    target_entity       TEXT NOT NULL,                          -- lab_results, icu_flowsheets, radiology_orders, vitals, etc.
    field_mappings      JSONB NOT NULL DEFAULT '[]',            -- parsed fields → entity fields (overrides adapter defaults)
    transform_rules     JSONB NOT NULL DEFAULT '[]',            -- unit conversions, code lookups

    -- Behavior
    auto_verify         BOOLEAN NOT NULL DEFAULT false,         -- auto-verify results (requires explicit opt-in)
    notify_on_critical  BOOLEAN NOT NULL DEFAULT true,          -- send alert when critical value detected
    trigger_pipeline    UUID,                                   -- integration_pipeline to trigger after successful ingest
    reject_duplicates   BOOLEAN NOT NULL DEFAULT true,          -- reject if same order+test already has result

    priority            INTEGER NOT NULL DEFAULT 0,             -- higher = evaluated first
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE device_routing_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY device_routing_rules_tenant ON device_routing_rules
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX idx_device_routing_rules_tenant ON device_routing_rules(tenant_id);
CREATE INDEX idx_device_routing_rules_device ON device_routing_rules(device_instance_id);
CREATE INDEX idx_device_routing_rules_adapter ON device_routing_rules(adapter_code);
CREATE INDEX idx_device_routing_rules_active ON device_routing_rules(tenant_id, target_module)
    WHERE is_active;

CREATE TRIGGER trg_device_routing_rules_updated_at BEFORE UPDATE ON device_routing_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
