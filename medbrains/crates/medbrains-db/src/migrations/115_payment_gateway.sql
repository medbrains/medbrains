-- 115: Payment Gateway Integration
-- Tracks Razorpay/UPI/Card transactions with real-time status

-- ══════════════════════════════════════════════════════════
--  PAYMENT GATEWAY TRANSACTIONS
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS payment_gateway_transactions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    invoice_id          UUID REFERENCES invoices(id),
    pharmacy_pos_sale_id UUID REFERENCES pharmacy_pos_sales(id),
    gateway             TEXT NOT NULL DEFAULT 'razorpay',
    gateway_order_id    TEXT NOT NULL,
    gateway_payment_id  TEXT,
    gateway_signature   TEXT,
    amount              NUMERIC(12,2) NOT NULL,
    currency            TEXT NOT NULL DEFAULT 'INR',
    status              TEXT NOT NULL DEFAULT 'created'
        CHECK (status IN ('created', 'authorized', 'captured', 'failed', 'refunded', 'expired')),
    payment_method      TEXT,
    upi_vpa             TEXT,
    card_last4          TEXT,
    card_network        TEXT,
    bank_name           TEXT,
    wallet              TEXT,
    error_code          TEXT,
    error_description   TEXT,
    refund_id           TEXT,
    refund_amount       NUMERIC(12,2),
    notes               JSONB NOT NULL DEFAULT '{}',
    webhook_payload     JSONB,
    verified_at         TIMESTAMPTZ,
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE payment_gateway_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY pgt_tenant ON payment_gateway_transactions
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX idx_pgt_invoice ON payment_gateway_transactions(invoice_id);
CREATE INDEX idx_pgt_pos_sale ON payment_gateway_transactions(pharmacy_pos_sale_id) WHERE pharmacy_pos_sale_id IS NOT NULL;
CREATE INDEX idx_pgt_gateway_order ON payment_gateway_transactions(gateway_order_id);
CREATE INDEX idx_pgt_status ON payment_gateway_transactions(tenant_id, status);

CREATE TRIGGER trg_pgt_updated_at BEFORE UPDATE ON payment_gateway_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════════════════════════
--  UPI CONFIG (per tenant)
-- ══════════════════════════════════════════════════════════

-- Store in tenant_settings: category='payments', key='razorpay_config'
-- Value: { "key_id": "rzp_test_...", "key_secret": "...", "webhook_secret": "..." }
-- Store in tenant_settings: category='payments', key='upi_vpa'
-- Value: "hospital@upi"
