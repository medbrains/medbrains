-- 117: Automation Hub v2 — Enterprise Orchestration Platform
-- Event Registry, Connector Framework, Job Queue, Scheduler, Custom Code

-- ══════════════════════════════════════════════════════════
--  1. EVENT REGISTRY — Service Catalog
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS event_registry (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module          TEXT NOT NULL,
    entity          TEXT NOT NULL,
    action          TEXT NOT NULL,
    event_code      TEXT NOT NULL,
    description     TEXT,
    payload_schema  JSONB NOT NULL DEFAULT '{}',
    is_system       BOOLEAN NOT NULL DEFAULT true,
    phase           TEXT NOT NULL DEFAULT 'after'
        CHECK (phase IN ('before', 'after')),
    is_blocking     BOOLEAN NOT NULL DEFAULT false,
    category        TEXT NOT NULL DEFAULT 'general',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (event_code)
);

CREATE INDEX idx_event_registry_module ON event_registry(module);
CREATE INDEX idx_event_registry_code ON event_registry(event_code);

-- Seed system events
INSERT INTO event_registry (module, entity, action, event_code, description, phase, is_blocking, category) VALUES
    -- OPD
    ('opd', 'encounter', 'creating', 'opd.encounter.creating', 'Before OPD encounter creation', 'before', true, 'clinical'),
    ('opd', 'encounter', 'created', 'opd.encounter.created', 'After OPD encounter created', 'after', false, 'clinical'),
    ('opd', 'prescription', 'creating', 'opd.prescription.creating', 'Before prescription — validate interactions', 'before', true, 'clinical'),
    ('opd', 'prescription', 'created', 'opd.prescription.created', 'After prescription — forward to pharmacy, bill', 'after', false, 'clinical'),
    ('opd', 'consultation', 'completed', 'opd.consultation.completed', 'After consultation saved', 'after', false, 'clinical'),
    -- Lab
    ('lab', 'order', 'creating', 'lab.order.creating', 'Before lab order — validate stock, eligibility', 'before', true, 'diagnostics'),
    ('lab', 'order', 'created', 'lab.order.created', 'After lab order — bill, notify lab', 'after', false, 'diagnostics'),
    ('lab', 'order', 'completed', 'lab.order.completed', 'After lab results — notify doctor', 'after', false, 'diagnostics'),
    -- Pharmacy
    ('pharmacy', 'order', 'dispensing', 'pharmacy.order.dispensing', 'Before dispense — check NDPS, stock', 'before', true, 'pharmacy'),
    ('pharmacy', 'order', 'dispensed', 'pharmacy.order.dispensed', 'After dispense — bill, update stock', 'after', false, 'pharmacy'),
    -- IPD
    ('ipd', 'admission', 'creating', 'ipd.admission.creating', 'Before admission — check bed availability', 'before', true, 'clinical'),
    ('ipd', 'admission', 'created', 'ipd.admission.created', 'After admission — bill, assign bed, notify nursing', 'after', false, 'clinical'),
    ('ipd', 'admission', 'transferred', 'ipd.admission.transferred', 'After bed transfer', 'after', false, 'clinical'),
    ('ipd', 'discharge', 'initiated', 'ipd.discharge.initiated', 'After discharge — final bill, notify all', 'after', false, 'clinical'),
    -- Billing
    ('billing', 'invoice', 'created', 'billing.invoice.created', 'After invoice created', 'after', false, 'financial'),
    ('billing', 'payment', 'received', 'billing.payment.received', 'After payment — update invoice, receipt', 'after', false, 'financial'),
    ('billing', 'concession', 'requested', 'billing.concession.requested', 'After concession request — notify approver', 'after', false, 'financial'),
    -- OT
    ('ot', 'surgery', 'completed', 'ot.surgery.completed', 'After surgery — bill, notify IPD', 'after', false, 'clinical'),
    -- Emergency
    ('emergency', 'visit', 'created', 'emergency.visit.created', 'After ER visit — bill, triage alert', 'after', false, 'clinical'),
    -- Ambulance
    ('ambulance', 'trip', 'completed', 'ambulance.trip.completed', 'After trip — bill, close case', 'after', false, 'operations'),
    -- Patient
    ('patients', 'patient', 'registered', 'patients.patient.registered', 'After patient registration', 'after', false, 'clinical'),
    -- Indent
    ('indent', 'requisition', 'submitted', 'indent.requisition.submitted', 'After indent submitted', 'after', false, 'operations'),
    ('indent', 'requisition', 'approved', 'indent.requisition.approved', 'After indent approved', 'after', false, 'operations')
ON CONFLICT (event_code) DO NOTHING;

-- ══════════════════════════════════════════════════════════
--  2. CONNECTOR REGISTRY — External System Adapters
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS connectors (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID REFERENCES tenants(id),
    connector_type      TEXT NOT NULL,
    name                TEXT NOT NULL,
    description         TEXT,
    config              JSONB NOT NULL DEFAULT '{}',
    status              TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive', 'error')),
    health_check_url    TEXT,
    last_health_check   TIMESTAMPTZ,
    is_healthy          BOOLEAN DEFAULT true,
    retry_config        JSONB NOT NULL DEFAULT '{"max_retries": 3, "backoff_ms": 1000, "backoff_multiplier": 2}',
    rate_limit          JSONB NOT NULL DEFAULT '{"requests_per_minute": 60}',
    stats               JSONB NOT NULL DEFAULT '{"total_calls": 0, "success": 0, "failures": 0}',
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE connectors ENABLE ROW LEVEL SECURITY;
CREATE POLICY connectors_tenant ON connectors
    USING (tenant_id IS NULL OR tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX idx_connectors_tenant ON connectors(tenant_id);
CREATE INDEX idx_connectors_type ON connectors(connector_type);

CREATE TRIGGER trg_connectors_updated_at BEFORE UPDATE ON connectors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed system connector types (no tenant = global templates)
INSERT INTO connectors (tenant_id, connector_type, name, description, config, status) VALUES
    (NULL, 'razorpay', 'Razorpay Payment Gateway', 'UPI, Cards, Netbanking, Wallets', '{"key_id": "", "key_secret": ""}', 'inactive'),
    (NULL, 'twilio_sms', 'Twilio SMS', 'SMS notifications via Twilio', '{"account_sid": "", "auth_token": "", "from_number": ""}', 'inactive'),
    (NULL, 'smtp_email', 'SMTP Email', 'Email via SMTP server', '{"host": "", "port": 587, "username": "", "password": "", "from_email": ""}', 'inactive'),
    (NULL, 'whatsapp_business', 'WhatsApp Business', 'WhatsApp messages via Cloud API', '{"phone_id": "", "api_token": ""}', 'inactive'),
    (NULL, 'abdm', 'ABDM (Ayushman Bharat)', 'Health ID, health records exchange', '{"client_id": "", "client_secret": "", "environment": "sandbox"}', 'inactive'),
    (NULL, 'tally_erp', 'Tally ERP', 'Push vouchers and invoices to Tally', '{"server_url": "", "company_name": ""}', 'inactive'),
    (NULL, 'custom_http', 'Custom HTTP API', 'Generic REST API connector', '{"base_url": "", "auth_type": "none", "auth_header": ""}', 'inactive')
ON CONFLICT DO NOTHING;

-- ══════════════════════════════════════════════════════════
--  3. JOB QUEUE — Async Execution
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS job_queue (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    job_type        TEXT NOT NULL,
    pipeline_id     UUID REFERENCES integration_pipelines(id),
    execution_id    UUID REFERENCES integration_executions(id),
    connector_id    UUID REFERENCES connectors(id),
    payload         JSONB NOT NULL DEFAULT '{}',
    status          TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'completed', 'failed', 'dead_letter')),
    priority        INT NOT NULL DEFAULT 5,
    max_retries     INT NOT NULL DEFAULT 3,
    retry_count     INT NOT NULL DEFAULT 0,
    next_retry_at   TIMESTAMPTZ,
    locked_by       TEXT,
    locked_at       TIMESTAMPTZ,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    error           TEXT,
    correlation_id  UUID DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_queue_pending ON job_queue(status, priority, created_at)
    WHERE status = 'pending';
CREATE INDEX idx_job_queue_retry ON job_queue(next_retry_at)
    WHERE status = 'failed' AND retry_count < max_retries;
CREATE INDEX idx_job_queue_tenant ON job_queue(tenant_id, status);
CREATE INDEX idx_job_queue_correlation ON job_queue(correlation_id);

-- ══════════════════════════════════════════════════════════
--  4. SCHEDULED JOBS — Cron Triggers
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS scheduled_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    pipeline_id     UUID NOT NULL REFERENCES integration_pipelines(id),
    name            TEXT NOT NULL,
    cron_expression TEXT NOT NULL,
    timezone        TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    input_data      JSONB NOT NULL DEFAULT '{}',
    next_run_at     TIMESTAMPTZ NOT NULL,
    last_run_at     TIMESTAMPTZ,
    last_status     TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE scheduled_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY scheduled_jobs_tenant ON scheduled_jobs
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX idx_scheduled_jobs_next ON scheduled_jobs(next_run_at)
    WHERE is_active = true;

CREATE TRIGGER trg_scheduled_jobs_updated_at BEFORE UPDATE ON scheduled_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════════════════════════
--  5. CUSTOM CODE SNIPPETS — User-defined logic
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS custom_code_snippets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    name            TEXT NOT NULL,
    description     TEXT,
    language        TEXT NOT NULL DEFAULT 'expression'
        CHECK (language IN ('expression', 'json_logic', 'lua')),
    code            TEXT NOT NULL,
    input_schema    JSONB NOT NULL DEFAULT '{}',
    output_schema   JSONB NOT NULL DEFAULT '{}',
    is_active       BOOLEAN NOT NULL DEFAULT true,
    version         INT NOT NULL DEFAULT 1,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, name)
);

ALTER TABLE custom_code_snippets ENABLE ROW LEVEL SECURITY;
CREATE POLICY custom_code_tenant ON custom_code_snippets
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE TRIGGER trg_custom_code_updated_at BEFORE UPDATE ON custom_code_snippets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
