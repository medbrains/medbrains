-- ====================================================================
-- Migration: 136_pharmacy_finance.sql
-- RLS-Posture: tenant-scoped
-- New-Tables: pharmacy_cash_drawers, pharmacy_petty_cash_vouchers,
--             pharmacy_cash_float_movements, pharmacy_free_dispensings,
--             pharmacy_cashier_overrides, pharmacy_supplier_payments,
--             pharmacy_drug_margin_daily
-- ====================================================================
-- Per RFCs/sprints/SPRINT-pharmacy-finance.md.
-- Day-end close, petty cash, free dispensing, cashier audit, supplier
-- payments, drug margin snapshots.
-- ====================================================================

-- ── 1. pharmacy_cash_drawers ────────────────────────────────────────

CREATE TABLE pharmacy_cash_drawers (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    pharmacy_location_id        UUID NOT NULL,
    cashier_user_id             UUID NOT NULL REFERENCES users(id),
    opened_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
    opening_float               NUMERIC(12,2) NOT NULL CHECK (opening_float >= 0),
    closed_at                   TIMESTAMPTZ,
    expected_close_amount       NUMERIC(12,2),
    actual_close_amount         NUMERIC(12,2),
    variance                    NUMERIC(12,2) GENERATED ALWAYS AS
        (actual_close_amount - expected_close_amount) STORED,
    variance_reason             TEXT,
    variance_signed_record_id   UUID,
    status                      TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'closed', 'variance_pending_signoff', 'reopened')),
    notes                       TEXT,
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX pharmacy_cash_drawers_open_idx
    ON pharmacy_cash_drawers (tenant_id, pharmacy_location_id)
    WHERE status = 'open';
CREATE INDEX pharmacy_cash_drawers_cashier_idx
    ON pharmacy_cash_drawers (tenant_id, cashier_user_id, opened_at DESC);

CREATE TRIGGER pharmacy_cash_drawers_updated
    BEFORE UPDATE ON pharmacy_cash_drawers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE pharmacy_cash_drawers FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('pharmacy_cash_drawers');

-- ── 2. pharmacy_petty_cash_vouchers ─────────────────────────────────

CREATE TABLE pharmacy_petty_cash_vouchers (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    cash_drawer_id          UUID REFERENCES pharmacy_cash_drawers(id),
    category                TEXT NOT NULL CHECK (category IN (
        'supplies', 'stationery', 'refreshment', 'transport',
        'repairs', 'medical_consumable', 'other'
    )),
    amount                  NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    paid_to                 TEXT NOT NULL,
    supporting_bill_url     TEXT,
    approved_by             UUID REFERENCES users(id),
    approved_at             TIMESTAMPTZ,
    status                  TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'reimbursed')),
    notes                   TEXT,
    created_by              UUID NOT NULL REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX pharmacy_petty_cash_drawer_idx
    ON pharmacy_petty_cash_vouchers (tenant_id, cash_drawer_id, status);

ALTER TABLE pharmacy_petty_cash_vouchers FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('pharmacy_petty_cash_vouchers');

-- ── 3. pharmacy_cash_float_movements ────────────────────────────────

CREATE TABLE pharmacy_cash_float_movements (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    movement_type           TEXT NOT NULL CHECK (movement_type IN (
        'topup_from_main', 'return_to_main',
        'transfer_between_counters', 'correction'
    )),
    source_drawer_id        UUID REFERENCES pharmacy_cash_drawers(id),
    destination_drawer_id   UUID REFERENCES pharmacy_cash_drawers(id),
    amount                  NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    reason                  TEXT NOT NULL,
    approved_by             UUID REFERENCES users(id),
    moved_by                UUID NOT NULL REFERENCES users(id),
    moved_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (source_drawer_id IS NOT NULL OR destination_drawer_id IS NOT NULL)
);

ALTER TABLE pharmacy_cash_float_movements FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('pharmacy_cash_float_movements');

-- ── 4. pharmacy_free_dispensings ────────────────────────────────────

CREATE TABLE pharmacy_free_dispensings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    pharmacy_order_id   UUID NOT NULL,
    category            TEXT NOT NULL CHECK (category IN (
        'charity', 'hospital_sample', 'government_program',
        'staff', 'approved_writeoff'
    )),
    scheme_code         TEXT,
    approving_user_id   UUID NOT NULL REFERENCES users(id),
    cost_value          NUMERIC(12,2) NOT NULL CHECK (cost_value >= 0),
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX pharmacy_free_dispensings_idx
    ON pharmacy_free_dispensings (tenant_id, category, created_at DESC);

ALTER TABLE pharmacy_free_dispensings FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('pharmacy_free_dispensings');

-- ── 5. pharmacy_cashier_overrides ───────────────────────────────────

CREATE TABLE pharmacy_cashier_overrides (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    cashier_user_id     UUID NOT NULL REFERENCES users(id),
    cash_drawer_id      UUID REFERENCES pharmacy_cash_drawers(id),
    pharmacy_order_id   UUID,
    override_type       TEXT NOT NULL CHECK (override_type IN (
        'manual_price', 'discount_beyond_policy', 'void_after_settle',
        'schedule_x_paper_missing', 'allergy_block_override',
        'interaction_block_override', 'stock_below_threshold'
    )),
    original_value      JSONB,
    override_value      JSONB,
    reason              TEXT NOT NULL,
    approved_by         UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX pharmacy_cashier_overrides_user_idx
    ON pharmacy_cashier_overrides (tenant_id, cashier_user_id, created_at DESC);
CREATE INDEX pharmacy_cashier_overrides_type_idx
    ON pharmacy_cashier_overrides (tenant_id, override_type, created_at DESC);

ALTER TABLE pharmacy_cashier_overrides FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('pharmacy_cashier_overrides');

-- ── 6. pharmacy_supplier_payments ───────────────────────────────────

CREATE TABLE pharmacy_supplier_payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    supplier_id         UUID NOT NULL,
    purchase_order_id   UUID,
    grn_id              UUID,
    invoice_number      TEXT NOT NULL,
    invoice_date        DATE NOT NULL,
    due_date            DATE NOT NULL,
    gross_amount        NUMERIC(12,2) NOT NULL CHECK (gross_amount > 0),
    tds_amount          NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (tds_amount >= 0),
    tds_section         TEXT,
    net_payable         NUMERIC(12,2) GENERATED ALWAYS AS
        (gross_amount - tds_amount) STORED,
    status              TEXT NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'approved', 'paid', 'disputed', 'cancelled')),
    payment_mode        TEXT,
    paid_at             TIMESTAMPTZ,
    paid_amount         NUMERIC(12,2),
    utr_number          TEXT,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX pharmacy_supplier_payments_due_idx
    ON pharmacy_supplier_payments (tenant_id, due_date)
    WHERE status IN ('scheduled', 'approved');
CREATE INDEX pharmacy_supplier_payments_supplier_idx
    ON pharmacy_supplier_payments (tenant_id, supplier_id, due_date DESC);

CREATE TRIGGER pharmacy_supplier_payments_updated
    BEFORE UPDATE ON pharmacy_supplier_payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE pharmacy_supplier_payments FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('pharmacy_supplier_payments');

-- ── 7. pharmacy_drug_margin_daily ───────────────────────────────────

CREATE TABLE pharmacy_drug_margin_daily (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    drug_id         UUID NOT NULL,
    snapshot_date   DATE NOT NULL,
    avg_cost        NUMERIC(12,4) NOT NULL,
    mrp             NUMERIC(12,4) NOT NULL,
    sale_price      NUMERIC(12,4) NOT NULL,
    margin_pct      NUMERIC(7,2) NOT NULL,
    qty_sold        INT NOT NULL DEFAULT 0,
    revenue         NUMERIC(14,2) NOT NULL DEFAULT 0,
    cost_total      NUMERIC(14,2) NOT NULL DEFAULT 0,
    margin_total    NUMERIC(14,2) NOT NULL DEFAULT 0,
    UNIQUE (tenant_id, drug_id, snapshot_date)
);
CREATE INDEX pharmacy_drug_margin_top_idx
    ON pharmacy_drug_margin_daily (tenant_id, snapshot_date DESC, margin_total DESC);

ALTER TABLE pharmacy_drug_margin_daily FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('pharmacy_drug_margin_daily');

-- ── Worker grants ───────────────────────────────────────────────────

GRANT SELECT ON pharmacy_cash_drawers, pharmacy_petty_cash_vouchers,
                pharmacy_cash_float_movements, pharmacy_free_dispensings,
                pharmacy_cashier_overrides, pharmacy_supplier_payments,
                pharmacy_drug_margin_daily
                TO medbrains_outbox_worker;
