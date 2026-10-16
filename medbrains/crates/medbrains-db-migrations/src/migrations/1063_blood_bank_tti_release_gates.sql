-- ====================================================================
-- Migration: 1063_blood_bank_tti_release_gates.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: blood_tti_results
-- Drops: none
-- ====================================================================
-- Transfusion-transmissible infection screening, one row per marker per
-- donation (D&C Rules Schedule F Part XII-B; NACO/NBTC): HIV 1&2, HBsAg,
-- HCV, syphilis and malaria. A unit is released only when every one of
-- the five is recorded non-reactive. `blood_components.tti_status` stays
-- as the summary the reports read; this table is what the gate reads.

CREATE TABLE IF NOT EXISTS blood_tti_results (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    donation_id   uuid NOT NULL REFERENCES blood_donations(id),
    marker        text NOT NULL
        CHECK (marker IN ('hiv', 'hbsag', 'hcv', 'syphilis', 'malaria')),
    result        text NOT NULL
        CHECK (result IN ('non_reactive', 'reactive', 'indeterminate')),
    method        text,
    kit_lot       text,
    notes         text,
    tested_by     uuid NOT NULL REFERENCES users(id),
    tested_at     timestamptz NOT NULL DEFAULT now(),
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    deleted_at    timestamptz,
    deleted_by    uuid,
    delete_reason text
);
-- One live result per marker per donation. A re-test replaces an
-- indeterminate or non-reactive result; a reactive one is final (enforced
-- in the handler, which only updates rows whose result is not reactive).
CREATE UNIQUE INDEX IF NOT EXISTS idx_blood_tti_results_marker
    ON blood_tti_results (tenant_id, donation_id, marker)
    WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_blood_tti_results_updated_at ON blood_tti_results;
CREATE TRIGGER trg_blood_tti_results_updated_at
    BEFORE UPDATE ON blood_tti_results
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_blood_tti_results_soft_delete ON blood_tti_results;
CREATE TRIGGER trg_blood_tti_results_soft_delete
    BEFORE DELETE ON blood_tti_results
    FOR EACH ROW EXECUTE FUNCTION soft_delete_guardrail();
DROP TRIGGER IF EXISTS audit_blood_tti_results ON blood_tti_results;
CREATE TRIGGER audit_blood_tti_results
    AFTER INSERT OR DELETE OR UPDATE ON blood_tti_results
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func('blood_bank');

ALTER TABLE blood_tti_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE blood_tti_results FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_blood_tti_results ON blood_tti_results;
CREATE POLICY tenant_isolation_blood_tti_results ON blood_tti_results
    USING (tenant_id = ANY (app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (app_visible_tenants()));

-- Emergency uncrossmatched release: who authorised it is `administered_by`
-- (the holder of the override permission); why is mandatory.
ALTER TABLE transfusion_records
    ADD COLUMN IF NOT EXISTS emergency_release boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS emergency_reason text;
ALTER TABLE transfusion_records DROP CONSTRAINT IF EXISTS transfusion_records_emergency_reason;
ALTER TABLE transfusion_records ADD CONSTRAINT transfusion_records_emergency_reason
    CHECK (NOT emergency_release OR length(btrim(coalesce(emergency_reason, ''))) > 0);

-- The wristband the nurse scanned when hanging the unit, as read.
ALTER TABLE transfusions ADD COLUMN IF NOT EXISTS wristband_uhid text;

-- Pre-donation screening as measured at this collection (NBTC / D&C
-- Rules): the eligibility check reads these, not the donor's last record.
ALTER TABLE blood_donations
    ADD COLUMN IF NOT EXISTS weight_kg double precision,
    ADD COLUMN IF NOT EXISTS hemoglobin_g_dl double precision,
    -- Pre-apheresis platelet count, x10^9/L (>= 150 to donate).
    ADD COLUMN IF NOT EXISTS platelet_count double precision;
