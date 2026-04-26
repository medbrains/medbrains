-- Migration 116: Billing concessions & auto-billing wiring
-- Adds concession tracking, auto-concession rules, and extends charge_source

-- 1. Extend charge_source enum for ambulance module
ALTER TYPE charge_source ADD VALUE IF NOT EXISTS 'ambulance';

-- 2. Concession status enum
CREATE TYPE concession_status AS ENUM ('pending', 'approved', 'rejected', 'auto_applied');

-- 3. Billing concessions table
CREATE TABLE billing_concessions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL REFERENCES tenants(id),
    invoice_id        UUID REFERENCES invoices(id),
    invoice_item_id   UUID,
    patient_id        UUID NOT NULL REFERENCES patients(id),
    concession_type   TEXT NOT NULL,
    original_amount   NUMERIC(12,2) NOT NULL,
    concession_percent NUMERIC(5,2),
    concession_amount NUMERIC(12,2) NOT NULL,
    final_amount      NUMERIC(12,2) NOT NULL,
    reason            TEXT,
    status            concession_status NOT NULL DEFAULT 'pending',
    requested_by      UUID NOT NULL REFERENCES users(id),
    approved_by       UUID REFERENCES users(id),
    approved_at       TIMESTAMPTZ,
    auto_rule         TEXT,
    source_module     TEXT,
    source_entity_id  UUID,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. RLS
ALTER TABLE billing_concessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON billing_concessions
    USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- 5. Indexes
CREATE INDEX idx_billing_concessions_tenant ON billing_concessions(tenant_id);
CREATE INDEX idx_billing_concessions_patient ON billing_concessions(tenant_id, patient_id);
CREATE INDEX idx_billing_concessions_invoice ON billing_concessions(tenant_id, invoice_id);
CREATE INDEX idx_billing_concessions_status ON billing_concessions(tenant_id, status);
