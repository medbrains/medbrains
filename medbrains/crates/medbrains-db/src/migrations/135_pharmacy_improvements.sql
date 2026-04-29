-- ====================================================================
-- Migration: 135_pharmacy_improvements.sql
-- RLS-Posture: tenant-scoped
-- New-Tables: pharmacy_repeats, pharmacy_substitutions,
--             pharmacy_counseling, pharmacy_coverage_checks
-- Alters: prescriptions (+repeats_allowed, repeat_interval_days, repeats_used)
-- ====================================================================
-- Per RFCs/sprints/SPRINT-pharmacy-improvements.md.
-- Covers: refill / repeat Rx, generic substitution audit,
-- counseling notes, POS insurance/package coverage check audit.
-- ====================================================================

-- ── Prescriptions ALTER for repeats ─────────────────────────────────

ALTER TABLE prescriptions
    ADD COLUMN IF NOT EXISTS repeats_allowed INT NOT NULL DEFAULT 0
        CHECK (repeats_allowed >= 0 AND repeats_allowed <= 12),
    ADD COLUMN IF NOT EXISTS repeat_interval_days INT
        CHECK (repeat_interval_days IS NULL OR repeat_interval_days BETWEEN 1 AND 365),
    ADD COLUMN IF NOT EXISTS repeats_used INT NOT NULL DEFAULT 0;

-- ── 1. pharmacy_repeats ─────────────────────────────────────────────

CREATE TABLE pharmacy_repeats (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    prescription_id     UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
    pharmacy_order_id   UUID NOT NULL,
    repeat_index        INT NOT NULL CHECK (repeat_index > 0),
    dispensed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    dispensed_by        UUID NOT NULL REFERENCES users(id),
    notes               TEXT,
    UNIQUE (tenant_id, prescription_id, repeat_index)
);
CREATE INDEX pharmacy_repeats_rx_idx
    ON pharmacy_repeats (tenant_id, prescription_id, dispensed_at DESC);

ALTER TABLE pharmacy_repeats FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('pharmacy_repeats');

COMMENT ON TABLE pharmacy_repeats IS
    'Audit of each repeat dispensing of a prescription marked repeats_allowed > 0. SPRINT-pharmacy-improvements.md item #4.';

-- ── 2. pharmacy_substitutions ───────────────────────────────────────

CREATE TABLE pharmacy_substitutions (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    pharmacy_order_item_id      UUID NOT NULL,
    original_drug_id            UUID NOT NULL,
    substituted_drug_id         UUID NOT NULL,
    reason                      TEXT NOT NULL,
    inn_match                   BOOLEAN NOT NULL,
    patient_consent_obtained    BOOLEAN NOT NULL DEFAULT FALSE,
    substituted_by              UUID NOT NULL REFERENCES users(id),
    substituted_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX pharmacy_substitutions_item_idx
    ON pharmacy_substitutions (tenant_id, pharmacy_order_item_id);

ALTER TABLE pharmacy_substitutions FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('pharmacy_substitutions');

COMMENT ON TABLE pharmacy_substitutions IS
    'Generic substitution audit — when a branded drug is replaced with INN-equivalent. Tracks reason + patient consent. SPRINT-pharmacy-improvements.md item #3.';

-- ── 3. pharmacy_counseling ──────────────────────────────────────────

CREATE TABLE pharmacy_counseling (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    pharmacy_order_id           UUID NOT NULL,
    food_timing_explained       BOOLEAN NOT NULL DEFAULT FALSE,
    dose_timing_explained       BOOLEAN NOT NULL DEFAULT FALSE,
    side_effects_explained      BOOLEAN NOT NULL DEFAULT FALSE,
    missed_dose_explained       BOOLEAN NOT NULL DEFAULT FALSE,
    storage_explained           BOOLEAN NOT NULL DEFAULT FALSE,
    notes                       TEXT,
    counselled_by               UUID NOT NULL REFERENCES users(id),
    counselled_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, pharmacy_order_id, counselled_by)
);
CREATE INDEX pharmacy_counseling_order_idx
    ON pharmacy_counseling (tenant_id, pharmacy_order_id);

ALTER TABLE pharmacy_counseling FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('pharmacy_counseling');

COMMENT ON TABLE pharmacy_counseling IS
    'Pharmacist counseling notes captured at dispense — checklist of what was explained + free-text notes. Prints on dispense slip. SPRINT-pharmacy-improvements.md item #5.';

-- ── 4. pharmacy_coverage_checks ─────────────────────────────────────

CREATE TABLE pharmacy_coverage_checks (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    pharmacy_order_id           UUID NOT NULL,
    insurance_subscription_id   UUID,
    package_subscription_id     UUID,
    covered_amount              NUMERIC(12,2) NOT NULL DEFAULT 0,
    cash_amount                 NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_amount                NUMERIC(12,2) NOT NULL,
    decision                    TEXT NOT NULL CHECK (decision IN
        ('covered', 'partial', 'not_covered', 'overridden')),
    decided_by                  UUID REFERENCES users(id),
    checked_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX pharmacy_coverage_checks_order_idx
    ON pharmacy_coverage_checks (tenant_id, pharmacy_order_id);

ALTER TABLE pharmacy_coverage_checks FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('pharmacy_coverage_checks');

COMMENT ON TABLE pharmacy_coverage_checks IS
    'POS-time insurance + package coverage decision audit. SPRINT-pharmacy-improvements.md item #7.';

-- ── Worker grants ───────────────────────────────────────────────────

GRANT SELECT ON pharmacy_repeats, pharmacy_substitutions,
                pharmacy_counseling, pharmacy_coverage_checks
                TO medbrains_outbox_worker;
