-- 113: Pharmacy Phase 3 — Rx Queue, POS, Pricing, Safety, Stock Reconciliation
-- Adds pharmacist prescription review workflow, counter sales with GST,
-- multi-level pricing, allergy check audit trail, stock reconciliation.

-- ══════════════════════════════════════════════════════════
--  ENUMS
-- ══════════════════════════════════════════════════════════

CREATE TYPE pharmacy_rx_status AS ENUM (
    'pending_review', 'approved', 'rejected', 'on_hold',
    'dispensing', 'dispensed', 'partially_dispensed', 'cancelled'
);

CREATE TYPE pharmacy_payment_mode AS ENUM (
    'cash', 'card', 'upi', 'insurance', 'credit', 'mixed'
);

-- ══════════════════════════════════════════════════════════
--  1. PHARMACY PRESCRIPTIONS (Rx Queue)
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pharmacy_prescriptions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),
    prescription_id         UUID NOT NULL REFERENCES prescriptions(id),
    patient_id              UUID NOT NULL REFERENCES patients(id),
    encounter_id            UUID NOT NULL REFERENCES encounters(id),
    doctor_id               UUID NOT NULL REFERENCES users(id),
    source                  TEXT NOT NULL DEFAULT 'opd'
        CHECK (source IN ('opd', 'ipd', 'emergency', 'discharge', 'external')),
    status                  pharmacy_rx_status NOT NULL DEFAULT 'pending_review',
    priority                TEXT NOT NULL DEFAULT 'normal'
        CHECK (priority IN ('normal', 'urgent', 'stat')),
    pharmacy_order_id       UUID REFERENCES pharmacy_orders(id),
    reviewed_by             UUID REFERENCES users(id),
    reviewed_at             TIMESTAMPTZ,
    review_notes            TEXT,
    rejection_reason        TEXT,
    allergy_check_done      BOOLEAN NOT NULL DEFAULT false,
    interaction_check_done  BOOLEAN NOT NULL DEFAULT false,
    interaction_check_result JSONB,
    store_location_id       UUID,
    received_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE pharmacy_prescriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY pharmacy_prescriptions_tenant ON pharmacy_prescriptions
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX idx_pharmacy_rx_status ON pharmacy_prescriptions(tenant_id, status);
CREATE INDEX idx_pharmacy_rx_patient ON pharmacy_prescriptions(tenant_id, patient_id);
CREATE INDEX idx_pharmacy_rx_prescription ON pharmacy_prescriptions(prescription_id);

CREATE TRIGGER trg_pharmacy_rx_updated_at BEFORE UPDATE ON pharmacy_prescriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════════════════════════
--  2. POS SALES
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pharmacy_pos_sales (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    sale_number         TEXT NOT NULL,
    pharmacy_order_id   UUID REFERENCES pharmacy_orders(id),
    patient_id          UUID REFERENCES patients(id),
    patient_name        TEXT,
    patient_phone       TEXT,
    subtotal            NUMERIC(12,2) NOT NULL,
    discount_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
    discount_percent    NUMERIC(5,2),
    gst_amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_amount        NUMERIC(12,2) NOT NULL,
    payment_mode        pharmacy_payment_mode NOT NULL DEFAULT 'cash',
    payment_reference   TEXT,
    amount_received     NUMERIC(12,2) NOT NULL DEFAULT 0,
    change_due          NUMERIC(12,2) NOT NULL DEFAULT 0,
    receipt_number      TEXT,
    receipt_printed     BOOLEAN NOT NULL DEFAULT false,
    pricing_tier        TEXT NOT NULL DEFAULT 'mrp'
        CHECK (pricing_tier IN ('mrp', 'hospital_rate', 'insurance_rate', 'staff_rate', 'discounted_rate')),
    sold_by             UUID NOT NULL REFERENCES users(id),
    store_location_id   UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, sale_number)
);

ALTER TABLE pharmacy_pos_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY pharmacy_pos_sales_tenant ON pharmacy_pos_sales
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX idx_pos_sales_date ON pharmacy_pos_sales(tenant_id, created_at);
CREATE INDEX idx_pos_sales_patient ON pharmacy_pos_sales(patient_id) WHERE patient_id IS NOT NULL;

CREATE TRIGGER trg_pos_sales_updated_at BEFORE UPDATE ON pharmacy_pos_sales
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════════════════════════
--  3. POS SALE LINE ITEMS (GST split)
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pharmacy_pos_sale_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    pos_sale_id         UUID NOT NULL REFERENCES pharmacy_pos_sales(id) ON DELETE CASCADE,
    order_item_id       UUID REFERENCES pharmacy_order_items(id),
    catalog_item_id     UUID REFERENCES pharmacy_catalog(id),
    drug_name           TEXT NOT NULL,
    batch_id            UUID REFERENCES pharmacy_batches(id),
    batch_number        TEXT,
    hsn_code            TEXT,
    quantity            INT NOT NULL,
    mrp                 NUMERIC(12,2) NOT NULL,
    selling_price       NUMERIC(12,2) NOT NULL,
    gst_rate            NUMERIC(5,2) NOT NULL DEFAULT 0,
    cgst_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
    sgst_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
    igst_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
    line_total          NUMERIC(12,2) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pos_sale_items ON pharmacy_pos_sale_items(pos_sale_id);

-- ══════════════════════════════════════════════════════════
--  4. PRICING TIERS
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pharmacy_pricing_tiers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    catalog_item_id     UUID NOT NULL REFERENCES pharmacy_catalog(id),
    tier_name           TEXT NOT NULL
        CHECK (tier_name IN ('mrp', 'hospital_rate', 'insurance_rate', 'staff_rate', 'discounted_rate')),
    price               NUMERIC(12,2) NOT NULL,
    effective_from      DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to        DATE,
    created_by          UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, catalog_item_id, tier_name, effective_from)
);

ALTER TABLE pharmacy_pricing_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY pharmacy_pricing_tiers_tenant ON pharmacy_pricing_tiers
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX idx_pricing_tiers_item ON pharmacy_pricing_tiers(catalog_item_id, tier_name);

-- ══════════════════════════════════════════════════════════
--  5. ALLERGY CHECK AUDIT LOG
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pharmacy_allergy_check_log (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    patient_id          UUID NOT NULL REFERENCES patients(id),
    catalog_item_id     UUID REFERENCES pharmacy_catalog(id),
    drug_name           TEXT NOT NULL,
    allergen_matched    TEXT,
    allergy_type        TEXT,
    severity            TEXT,
    action_taken        TEXT NOT NULL
        CHECK (action_taken IN ('blocked', 'overridden', 'no_match')),
    overridden_by       UUID REFERENCES users(id),
    override_reason     TEXT,
    checked_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    context             TEXT CHECK (context IN ('order_creation', 'dispensing', 'rx_review', 'pos_sale')),
    rx_queue_id         UUID REFERENCES pharmacy_prescriptions(id),
    order_id            UUID REFERENCES pharmacy_orders(id)
);

ALTER TABLE pharmacy_allergy_check_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY pharmacy_allergy_check_tenant ON pharmacy_allergy_check_log
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX idx_allergy_check_patient ON pharmacy_allergy_check_log(patient_id, checked_at DESC);

-- ══════════════════════════════════════════════════════════
--  6. STOCK RECONCILIATION
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pharmacy_stock_reconciliation (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    catalog_item_id     UUID NOT NULL REFERENCES pharmacy_catalog(id),
    batch_id            UUID REFERENCES pharmacy_batches(id),
    system_quantity     INT NOT NULL,
    physical_quantity   INT NOT NULL,
    variance            INT NOT NULL,
    reason              TEXT,
    reconciled_by       UUID NOT NULL REFERENCES users(id),
    store_location_id   UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE pharmacy_stock_reconciliation ENABLE ROW LEVEL SECURITY;
CREATE POLICY pharmacy_stock_recon_tenant ON pharmacy_stock_reconciliation
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX idx_stock_recon_item ON pharmacy_stock_reconciliation(catalog_item_id, created_at DESC);

-- ══════════════════════════════════════════════════════════
--  ALTER EXISTING TABLES
-- ══════════════════════════════════════════════════════════

-- Pharmacy catalog: add pricing + location fields
ALTER TABLE pharmacy_catalog
    ADD COLUMN IF NOT EXISTS mrp NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS hsn_code TEXT,
    ADD COLUMN IF NOT EXISTS shelf_location TEXT,
    ADD COLUMN IF NOT EXISTS min_stock INT,
    ADD COLUMN IF NOT EXISTS max_stock INT;

-- Pharmacy orders: add pharmacist review tracking, make patient_id nullable for OTC
ALTER TABLE pharmacy_orders
    ADD COLUMN IF NOT EXISTS pharmacist_reviewed_by UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS review_notes TEXT,
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
    ADD COLUMN IF NOT EXISTS rx_queue_id UUID;

ALTER TABLE pharmacy_orders ALTER COLUMN patient_id DROP NOT NULL;

-- Prescription items: add catalog linkage for drug resolution
ALTER TABLE prescription_items
    ADD COLUMN IF NOT EXISTS catalog_item_id UUID;
