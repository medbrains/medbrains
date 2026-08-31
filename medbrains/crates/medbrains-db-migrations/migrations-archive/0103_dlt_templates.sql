-- DLT (Distributed Ledger Technology) SMS template registry — India.
--
-- Indian telcos require every commercial / transactional SMS to use a
-- pre-registered DLT template. Untemplated traffic is dropped at the
-- carrier gateway. This table maps our internal "template_scope"
-- (e.g. "sms.appointment_confirmation") to the DLT-issued template_id
-- so the SMS dispatcher can attach it on every send.
--
-- Reference: TRAI TCCCPR, 2018 — telco-managed DLT registry.

CREATE TABLE IF NOT EXISTS dlt_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    template_id TEXT NOT NULL,           -- DLT-issued template id
    template_name TEXT NOT NULL,
    category TEXT NOT NULL,              -- transactional / service_implicit / service_explicit / promotional
    sender_id TEXT NOT NULL,             -- 6-char DLT header (header_id)
    entity_id TEXT NOT NULL,             -- principal entity (PE) DLT id
    body_pattern TEXT NOT NULL,          -- pattern with {#var#} placeholders
    variable_count INT NOT NULL DEFAULT 0,
    scope TEXT,                          -- internal event_scope e.g. "sms.appointment_confirmation"
    language CHAR(2) NOT NULL DEFAULT 'en',
    is_active BOOLEAN NOT NULL DEFAULT true,
    registered_at DATE,
    expires_at DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, template_id)
);

CREATE INDEX IF NOT EXISTS idx_dlt_templates_scope
    ON dlt_templates (tenant_id, scope, language)
    WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_dlt_templates_tenant
    ON dlt_templates (tenant_id);

ALTER TABLE dlt_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY dlt_templates_tenant_isolation ON dlt_templates
    USING (tenant_id = current_setting('app.tenant_id', true)::UUID);

CREATE TRIGGER dlt_templates_updated_at
    BEFORE UPDATE ON dlt_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
