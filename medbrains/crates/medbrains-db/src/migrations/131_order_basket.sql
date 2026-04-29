-- ====================================================================
-- Migration: 131_order_basket.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: order_basket_drafts, order_basket_signatures
-- Drops: none
-- ====================================================================
-- Order basket — atomic cross-module order signing per
-- RFCs/sprints/SPRINT-order-basket.md.
--
-- Two tables:
--   1. order_basket_drafts     — optional cross-device hand-off, keyed by
--                                (tenant_id, encounter_id, owner_user_id).
--   2. order_basket_signatures — audit anchor for every successful sign.
--                                Captures full snapshot, warnings shown,
--                                overrides, created order IDs.
--                                NABH/JCI evidence trail.
--
-- The basket itself lives in client-side Zustand (sessionStorage); only
-- drafts and post-sign audit hit the DB. See SPRINT-order-basket.md §3.
-- ====================================================================

-- ── 1. order_basket_drafts ──────────────────────────────────────────

CREATE TABLE order_basket_drafts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    encounter_id    UUID NOT NULL,
    owner_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    items           JSONB NOT NULL,                 -- BasketItem[]
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, encounter_id, owner_user_id)
);

CREATE INDEX order_basket_drafts_encounter_idx
    ON order_basket_drafts (tenant_id, encounter_id);

CREATE INDEX order_basket_drafts_owner_idx
    ON order_basket_drafts (tenant_id, owner_user_id);

CREATE TRIGGER order_basket_drafts_updated
    BEFORE UPDATE ON order_basket_drafts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

ALTER TABLE order_basket_drafts FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('order_basket_drafts');

COMMENT ON TABLE order_basket_drafts IS
    'Optional cross-device basket hand-off. Keyed by (tenant_id, encounter_id, owner_user_id) — one draft per clinician per encounter. Cleared on encounter close or sign. SPRINT-order-basket.md §3.';

-- ── 2. order_basket_signatures ──────────────────────────────────────

CREATE TABLE order_basket_signatures (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    encounter_id             UUID NOT NULL,
    patient_id               UUID,                       -- denormalized for fast audit query
    signed_by                UUID NOT NULL REFERENCES users(id),
    signed_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    items_count              INT NOT NULL CHECK (items_count > 0),
    items_snapshot           JSONB NOT NULL,             -- frozen BasketItem[] at sign time
    warnings_returned        JSONB NOT NULL DEFAULT '[]'::jsonb,
    warnings_acknowledged    JSONB NOT NULL DEFAULT '[]'::jsonb,
    override_reasons         JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_order_ids        JSONB NOT NULL,             -- [{order_type, order_id}]
    client_session_id        TEXT,                       -- client correlation (mobile offline)
    device_id                TEXT
);

CREATE INDEX order_basket_signatures_encounter_idx
    ON order_basket_signatures (tenant_id, encounter_id, signed_at DESC);

CREATE INDEX order_basket_signatures_signed_by_idx
    ON order_basket_signatures (tenant_id, signed_by, signed_at DESC);

CREATE INDEX order_basket_signatures_patient_idx
    ON order_basket_signatures (tenant_id, patient_id, signed_at DESC)
    WHERE patient_id IS NOT NULL;

ALTER TABLE order_basket_signatures FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('order_basket_signatures');

COMMENT ON TABLE order_basket_signatures IS
    'Audit anchor for every successful basket sign. Captures full snapshot, warnings shown, overrides, created order IDs. NABH/JCI evidence trail. SPRINT-order-basket.md §3.';

-- ── 3. Worker grants ────────────────────────────────────────────────
-- The outbox worker (BYPASSRLS) needs to read these tables when handling
-- post-sign side-effects (sms.prescription_to_patient etc).

GRANT SELECT ON order_basket_signatures TO medbrains_outbox_worker;
