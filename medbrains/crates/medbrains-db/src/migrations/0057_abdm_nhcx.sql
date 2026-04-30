-- ABDM NHCX (National Health Claim Exchange) — facility identifiers
-- and per-claim tracking columns.
--
-- Phase 11. Slots into the in-flight 4-digit renumbering scheme
-- (highest occupied is 0056_clinical_offline_logs from PR #14).
--
-- The actual claim rows live in the existing billing_invoices /
-- insurance_claims tables — this migration only adds:
--   1. Facility identifier on tenants (provided by NHA HFR after
--      registration; required as x-hcx-sender-code on every claim).
--   2. NHCX correlation tracking on insurance_claims so a webhook
--      callback can find its origin row.

-- ── Tenant facility identifier ──────────────────────────────────────
ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS abdm_facility_id     TEXT,
    ADD COLUMN IF NOT EXISTS abdm_hcx_sender_code TEXT,
    ADD COLUMN IF NOT EXISTS abdm_facility_active BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN tenants.abdm_facility_id IS
    'NHA HFR-issued facility ID (FCN/FAC pattern). Set by Admin → ABDM Facility once HFR registration completes.';
COMMENT ON COLUMN tenants.abdm_hcx_sender_code IS
    'HCX participant code issued at NHCX onboarding. Used as x-hcx-sender-code on every claim.';
COMMENT ON COLUMN tenants.abdm_facility_active IS
    'False until both abdm_facility_id and abdm_hcx_sender_code are filled and the gateway smoke-test passes.';

-- ── insurance_claims correlation ────────────────────────────────────
-- The insurance_claims table is created in an earlier migration; we
-- only add NHCX-specific tracking columns here. Wrapped in a guard
-- so the migration is idempotent if the table happens to be missing
-- on a fresh tenant.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_name = 'insurance_claims') THEN

        ALTER TABLE insurance_claims
            ADD COLUMN IF NOT EXISTS nhcx_request_id  TEXT,
            ADD COLUMN IF NOT EXISTS nhcx_correlation UUID,
            ADD COLUMN IF NOT EXISTS nhcx_submitted_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS nhcx_outcome     TEXT,
            ADD COLUMN IF NOT EXISTS nhcx_disposition TEXT;

        CREATE INDEX IF NOT EXISTS idx_insurance_claims_nhcx_correlation
            ON insurance_claims (nhcx_correlation)
            WHERE nhcx_correlation IS NOT NULL;
    END IF;
END $$;

-- ── HFR registration audit ──────────────────────────────────────────
-- One-row-per-attempt log of ABDM HFR (facility registration)
-- exchanges. Distinct from insurance_claims; used by
-- routes/abdm/hfr.rs to retry / surface errors.

CREATE TABLE IF NOT EXISTS abdm_hfr_registrations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    status          TEXT NOT NULL CHECK (status IN ('queued', 'submitted', 'approved', 'rejected', 'failed')),
    nha_facility_id TEXT,
    error_message   TEXT,
    payload         JSONB NOT NULL DEFAULT '{}'::JSONB,
    response        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_abdm_hfr_tenant
    ON abdm_hfr_registrations (tenant_id, submitted_at DESC);

CREATE TRIGGER trg_abdm_hfr_touch
    BEFORE UPDATE ON abdm_hfr_registrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

SELECT apply_tenant_rls('abdm_hfr_registrations');

-- ── HIP-relay callback log ──────────────────────────────────────────
-- The cloud relay records every gateway callback so the on-prem
-- server can pick them up over the tailnet on its next sweep.

CREATE TABLE IF NOT EXISTS abdm_gateway_callbacks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    correlation_id  UUID,
    callback_type   TEXT NOT NULL,
    payload         JSONB NOT NULL,
    forwarded_at    TIMESTAMPTZ,
    forward_attempts INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_abdm_callbacks_tenant_pending
    ON abdm_gateway_callbacks (tenant_id, received_at DESC)
    WHERE forwarded_at IS NULL;

SELECT apply_tenant_rls('abdm_gateway_callbacks');
