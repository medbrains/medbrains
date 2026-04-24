-- 106_lab_phase4.sql — Lab Phase 4: Analyzer worklist, referral doctors, B2B credit, report QR

-- ══════════════════════════════════════════════════════════
--  Analyzer & Sample Enhancements
-- ══════════════════════════════════════════════════════════

-- Fallback analyzer for multi-analyzer support
ALTER TABLE lab_test_catalog ADD COLUMN IF NOT EXISTS fallback_analyzer TEXT;

-- Camp linkage for camp-based collection
ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS camp_id UUID;

-- Walk-in flag + phlebotomist assignment
ALTER TABLE lab_phlebotomy_queue ADD COLUMN IF NOT EXISTS is_walk_in BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE lab_phlebotomy_queue ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id);

-- QR verification URL on dispatches
ALTER TABLE lab_report_dispatches ADD COLUMN IF NOT EXISTS qr_verification_url TEXT;

-- ══════════════════════════════════════════════════════════
--  Referral Doctors
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS lab_referral_doctors (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    name            TEXT NOT NULL,
    phone           VARCHAR(20),
    email           VARCHAR(200),
    specialization  TEXT,
    hospital_name   TEXT,
    registration_no TEXT,
    commission_pct  NUMERIC(5,2) DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE lab_referral_doctors ENABLE ROW LEVEL SECURITY;
CREATE POLICY lab_referral_doctors_tenant ON lab_referral_doctors
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX idx_lab_referral_doctors_tenant ON lab_referral_doctors(tenant_id);
CREATE INDEX idx_lab_referral_doctors_phone ON lab_referral_doctors(phone);

CREATE TRIGGER trg_lab_referral_doctors_updated_at BEFORE UPDATE ON lab_referral_doctors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Link orders to referral doctors
ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS referral_doctor_id UUID REFERENCES lab_referral_doctors(id);

-- ══════════════════════════════════════════════════════════
--  Referral Payouts
-- ══════════════════════════════════════════════════════════

CREATE TYPE lab_payout_status AS ENUM ('pending', 'approved', 'paid', 'cancelled');

CREATE TABLE IF NOT EXISTS lab_referral_payouts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    referral_doctor_id  UUID NOT NULL REFERENCES lab_referral_doctors(id),
    period_start        DATE NOT NULL,
    period_end          DATE NOT NULL,
    order_count         INTEGER NOT NULL DEFAULT 0,
    total_revenue       NUMERIC(12,2) NOT NULL DEFAULT 0,
    commission_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
    status              lab_payout_status NOT NULL DEFAULT 'pending',
    paid_at             TIMESTAMPTZ,
    paid_by             UUID REFERENCES users(id),
    payment_reference   TEXT,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE lab_referral_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY lab_referral_payouts_tenant ON lab_referral_payouts
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX idx_lab_referral_payouts_doctor ON lab_referral_payouts(referral_doctor_id);
CREATE INDEX idx_lab_referral_payouts_period ON lab_referral_payouts(period_start, period_end);

CREATE TRIGGER trg_lab_referral_payouts_updated_at BEFORE UPDATE ON lab_referral_payouts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════════════════════════
--  B2B Credit Management
-- ══════════════════════════════════════════════════════════

ALTER TABLE lab_b2b_clients ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(12,2) DEFAULT 0;
ALTER TABLE lab_b2b_clients ADD COLUMN IF NOT EXISTS credit_used NUMERIC(12,2) DEFAULT 0;
ALTER TABLE lab_b2b_clients ADD COLUMN IF NOT EXISTS payment_terms_days INTEGER DEFAULT 30;
ALTER TABLE lab_b2b_clients ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'monthly'
    CHECK (billing_cycle IS NULL OR billing_cycle IN ('weekly', 'biweekly', 'monthly', 'quarterly'));
