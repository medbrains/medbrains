-- NHCX payer directory. The payer/TPA participants known to NHCX, keyed by their HCX
-- participant code (= the `recipient_code` for claim submission). Populated by the
-- fetch/participants/list sync (or maintained manually); the claim-submit flow resolves
-- recipient_code from here instead of taking it as a per-submit manual field. Tenant RLS.

CREATE TABLE IF NOT EXISTS nhcx_participants (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    participant_code  text NOT NULL,
    participant_name  text NOT NULL,
    role              text NOT NULL DEFAULT 'PAYER',
    is_active         boolean NOT NULL DEFAULT true,
    raw               jsonb,
    synced_at         timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, participant_code)
);

CREATE INDEX IF NOT EXISTS idx_nhcx_participants_tenant
    ON nhcx_participants (tenant_id, role);

ALTER TABLE nhcx_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY nhcx_participants_tenant_isolation ON nhcx_participants
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE TRIGGER nhcx_participants_updated_at BEFORE UPDATE ON nhcx_participants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
