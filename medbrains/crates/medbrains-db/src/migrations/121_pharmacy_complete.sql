-- 121: Pharmacy Complete — Safety, Payments, Operations for Medical College Hospital

-- ══════════════════════════════════════════════════════════
--  1. NDPS DUAL-SIGN ENFORCEMENT
-- ══════════════════════════════════════════════════════════

ALTER TABLE pharmacy_ndps_register ADD COLUMN IF NOT EXISTS second_witness_id UUID REFERENCES users(id);
ALTER TABLE pharmacy_ndps_register ADD COLUMN IF NOT EXISTS second_witness_at TIMESTAMPTZ;
ALTER TABLE pharmacy_ndps_register ADD COLUMN IF NOT EXISTS requires_dual_sign BOOLEAN DEFAULT false;

-- ══════════════════════════════════════════════════════════
--  2. DRUG RECALL REGISTRY
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pharmacy_drug_recalls (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),
    recall_number           TEXT NOT NULL,
    drug_id                 UUID REFERENCES pharmacy_catalog(id),
    drug_name               TEXT,
    batch_numbers           TEXT[] NOT NULL DEFAULT '{}',
    reason                  TEXT NOT NULL,
    severity                TEXT CHECK (severity IN ('class_i', 'class_ii', 'class_iii')),
    manufacturer_ref        TEXT,
    fda_ref                 TEXT,
    status                  TEXT NOT NULL DEFAULT 'initiated'
        CHECK (status IN ('initiated', 'in_progress', 'completed', 'cancelled')),
    affected_patients_count INT DEFAULT 0,
    recalled_quantity       INT DEFAULT 0,
    action_taken            TEXT,
    initiated_by            UUID REFERENCES users(id),
    completed_at            TIMESTAMPTZ,
    notes                   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE pharmacy_drug_recalls ENABLE ROW LEVEL SECURITY;
CREATE POLICY recall_tenant ON pharmacy_drug_recalls
    USING (tenant_id::text = current_setting('app.tenant_id', true));
CREATE INDEX idx_recall_tenant ON pharmacy_drug_recalls(tenant_id, status);
CREATE INDEX idx_recall_drug ON pharmacy_drug_recalls(drug_id);

CREATE TRIGGER trg_recalls_updated_at BEFORE UPDATE ON pharmacy_drug_recalls
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════════════════════════
--  3. DESTRUCTION REGISTER — expired/damaged drug destruction log
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pharmacy_destruction_log (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    certificate_number  TEXT NOT NULL,
    destruction_date    DATE NOT NULL,
    method              TEXT NOT NULL
        CHECK (method IN ('incineration', 'chemical', 'landfill', 'return_to_manufacturer', 'other')),
    items               JSONB NOT NULL DEFAULT '[]',
    total_quantity      INT NOT NULL DEFAULT 0,
    total_value         NUMERIC(12,2) NOT NULL DEFAULT 0,
    reason              TEXT NOT NULL
        CHECK (reason IN ('expired', 'damaged', 'recalled', 'contaminated', 'other')),
    witnessed_by        UUID REFERENCES users(id),
    witness_name        TEXT NOT NULL,
    authorized_by       UUID REFERENCES users(id),
    authorization_date  DATE,
    certificate_url     TEXT,
    notes               TEXT,
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE pharmacy_destruction_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY destruction_tenant ON pharmacy_destruction_log
    USING (tenant_id::text = current_setting('app.tenant_id', true));
CREATE INDEX idx_destruction_tenant ON pharmacy_destruction_log(tenant_id, destruction_date);

-- ══════════════════════════════════════════════════════════
--  4. GENERIC SUBSTITUTION — brand ↔ generic equivalents
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pharmacy_substitutes (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id),
    brand_drug_id               UUID NOT NULL REFERENCES pharmacy_catalog(id),
    generic_drug_id             UUID NOT NULL REFERENCES pharmacy_catalog(id),
    is_therapeutic_equivalent   BOOLEAN DEFAULT true,
    is_bioequivalent            BOOLEAN DEFAULT false,
    price_difference            NUMERIC(12,2),
    notes                       TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, brand_drug_id, generic_drug_id)
);

ALTER TABLE pharmacy_substitutes ENABLE ROW LEVEL SECURITY;
CREATE POLICY subs_tenant ON pharmacy_substitutes
    USING (tenant_id::text = current_setting('app.tenant_id', true));

-- ══════════════════════════════════════════════════════════
--  5. PAYMENT TRANSACTIONS — multi-mode with reconciliation
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pharmacy_payment_transactions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),
    pos_sale_id             UUID REFERENCES pharmacy_pos_sales(id),
    order_id                UUID REFERENCES pharmacy_orders(id),
    invoice_id              UUID REFERENCES invoices(id),
    payment_mode            TEXT NOT NULL
        CHECK (payment_mode IN (
            'cash', 'card', 'upi', 'gpay', 'phonepe', 'paytm',
            'netbanking', 'insurance', 'credit', 'wallet', 'mixed'
        )),
    amount                  NUMERIC(12,2) NOT NULL,
    reference_number        TEXT,
    device_terminal_id      TEXT,
    upi_transaction_id      TEXT,
    card_last_four          TEXT,
    card_network            TEXT,
    card_approval_code      TEXT,
    bank_name               TEXT,
    reconciliation_status   TEXT NOT NULL DEFAULT 'pending'
        CHECK (reconciliation_status IN ('pending', 'matched', 'mismatch', 'manual_verified')),
    reconciled_at           TIMESTAMPTZ,
    reconciled_by           UUID REFERENCES users(id),
    gateway_response        JSONB,
    shift_id                TEXT,
    counter_id              TEXT,
    created_by              UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE pharmacy_payment_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY payments_tenant ON pharmacy_payment_transactions
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX idx_pharma_pay_recon ON pharmacy_payment_transactions(tenant_id, reconciliation_status, created_at);
CREATE INDEX idx_pharma_pay_upi ON pharmacy_payment_transactions(upi_transaction_id)
    WHERE upi_transaction_id IS NOT NULL;
CREATE INDEX idx_pharma_pay_pos ON pharmacy_payment_transactions(pos_sale_id)
    WHERE pos_sale_id IS NOT NULL;
CREATE INDEX idx_pharma_pay_date ON pharmacy_payment_transactions(tenant_id, created_at);

-- ══════════════════════════════════════════════════════════
--  6. EMERGENCY DRUG KIT (Crash Cart / Resuscitation)
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pharmacy_emergency_kits (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    kit_code            TEXT NOT NULL,
    kit_type            TEXT NOT NULL
        CHECK (kit_type IN ('crash_cart', 'emergency_tray', 'anaphylaxis_kit', 'ot_emergency', 'icu_tray')),
    location_id         UUID REFERENCES locations(id),
    location_description TEXT,
    department_id       UUID REFERENCES departments(id),
    items               JSONB NOT NULL DEFAULT '[]',
    last_checked_at     TIMESTAMPTZ,
    last_checked_by     UUID REFERENCES users(id),
    next_check_due      DATE,
    check_interval_days INT DEFAULT 7,
    status              TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'needs_restock', 'expired_items', 'inactive')),
    notes               TEXT,
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE pharmacy_emergency_kits ENABLE ROW LEVEL SECURITY;
CREATE POLICY kits_tenant ON pharmacy_emergency_kits
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX idx_kits_check ON pharmacy_emergency_kits(next_check_due)
    WHERE status = 'active';

CREATE TRIGGER trg_kits_updated_at BEFORE UPDATE ON pharmacy_emergency_kits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════════════════════════
--  7. PHARMACY DAY-END SETTLEMENT
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pharmacy_day_settlements (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    settlement_date     DATE NOT NULL,
    counter_id          TEXT,
    shift_id            TEXT,
    cash_system         NUMERIC(12,2) DEFAULT 0,
    cash_counted        NUMERIC(12,2) DEFAULT 0,
    cash_difference     NUMERIC(12,2) DEFAULT 0,
    card_system         NUMERIC(12,2) DEFAULT 0,
    card_settled        NUMERIC(12,2) DEFAULT 0,
    upi_system          NUMERIC(12,2) DEFAULT 0,
    upi_matched         NUMERIC(12,2) DEFAULT 0,
    upi_unmatched       NUMERIC(12,2) DEFAULT 0,
    insurance_system    NUMERIC(12,2) DEFAULT 0,
    credit_system       NUMERIC(12,2) DEFAULT 0,
    total_sales         NUMERIC(12,2) DEFAULT 0,
    total_returns       NUMERIC(12,2) DEFAULT 0,
    net_collection      NUMERIC(12,2) DEFAULT 0,
    transactions_count  INT DEFAULT 0,
    returns_count       INT DEFAULT 0,
    status              TEXT DEFAULT 'open'
        CHECK (status IN ('open', 'closed', 'verified')),
    closed_by           UUID REFERENCES users(id),
    closed_at           TIMESTAMPTZ,
    verified_by         UUID REFERENCES users(id),
    verified_at         TIMESTAMPTZ,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE pharmacy_day_settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY settlements_tenant ON pharmacy_day_settlements
    USING (tenant_id::text = current_setting('app.tenant_id', true));
CREATE UNIQUE INDEX idx_settlements_date ON pharmacy_day_settlements(tenant_id, settlement_date, counter_id);
