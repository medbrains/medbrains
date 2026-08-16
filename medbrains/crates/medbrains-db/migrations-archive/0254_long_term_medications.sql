-- Migration: 0254_long_term_medications.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Long-term medication management (ticket #2962): a long-stay resident's chronic medications on an
-- extended (e.g. 90-day) supply cycle with optional auto-refill. Each refill advances the next
-- refill date by the supply period. Tenant RLS.

CREATE TABLE IF NOT EXISTS long_term_medications (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id       uuid NOT NULL,
    drug_name        text NOT NULL,
    dosage           text,
    frequency        text,
    supply_days      integer NOT NULL DEFAULT 90,
    auto_refill      boolean NOT NULL DEFAULT true,
    start_date       date NOT NULL DEFAULT CURRENT_DATE,
    next_refill_date date,
    last_refilled_at timestamptz,
    refill_count     integer NOT NULL DEFAULT 0,
    status           text NOT NULL DEFAULT 'active',
    prescriber       uuid,
    notes            text,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ltc_med_status_check CHECK (status = ANY (ARRAY[
        'active'::text, 'paused'::text, 'discontinued'::text
    ])),
    CONSTRAINT ltc_med_supply_check CHECK (supply_days > 0)
);

CREATE INDEX IF NOT EXISTS idx_ltc_medications_patient
    ON long_term_medications (tenant_id, patient_id, status);
CREATE INDEX IF NOT EXISTS idx_ltc_medications_due
    ON long_term_medications (tenant_id, next_refill_date)
    WHERE status = 'active' AND auto_refill = true;

ALTER TABLE long_term_medications ENABLE ROW LEVEL SECURITY;
CREATE POLICY long_term_medications_tenant_isolation ON long_term_medications
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE TRIGGER long_term_medications_updated_at BEFORE UPDATE ON long_term_medications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
