-- 120: Pharmacy Enhancement — Pharmacology depth, Credit Notes, Store Indents, Billing Integration

-- ══════════════════════════════════════════════════════════
--  1. PHARMACOLOGY DEPTH — Add clinical fields to drug catalog
-- ══════════════════════════════════════════════════════════

-- Pharmacology & clinical
ALTER TABLE pharmacy_catalog ADD COLUMN IF NOT EXISTS mechanism_of_action TEXT;
ALTER TABLE pharmacy_catalog ADD COLUMN IF NOT EXISTS contraindications TEXT;
ALTER TABLE pharmacy_catalog ADD COLUMN IF NOT EXISTS indications TEXT;
ALTER TABLE pharmacy_catalog ADD COLUMN IF NOT EXISTS side_effects TEXT;
ALTER TABLE pharmacy_catalog ADD COLUMN IF NOT EXISTS drug_class TEXT;

-- Dosage forms
ALTER TABLE pharmacy_catalog ADD COLUMN IF NOT EXISTS dosage_form TEXT;           -- tablet, capsule, syrup, injection, cream, drops
ALTER TABLE pharmacy_catalog ADD COLUMN IF NOT EXISTS strength TEXT;              -- 500mg, 10mg/5ml
ALTER TABLE pharmacy_catalog ADD COLUMN IF NOT EXISTS pack_size INT;              -- 10 tabs, 100ml
ALTER TABLE pharmacy_catalog ADD COLUMN IF NOT EXISTS route_of_admin TEXT;        -- oral, iv, im, topical, sublingual
ALTER TABLE pharmacy_catalog ADD COLUMN IF NOT EXISTS frequency_default TEXT;     -- OD, BD, TDS, QDS, SOS
ALTER TABLE pharmacy_catalog ADD COLUMN IF NOT EXISTS pregnancy_category TEXT     -- A, B, C, D, X
    CHECK (pregnancy_category IS NULL OR pregnancy_category IN ('A', 'B', 'C', 'D', 'X'));

-- Supplier & pricing
ALTER TABLE pharmacy_catalog ADD COLUMN IF NOT EXISTS preferred_supplier_id UUID REFERENCES vendors(id);
ALTER TABLE pharmacy_catalog ADD COLUMN IF NOT EXISTS supplier_code TEXT;         -- vendor's internal code for this drug
ALTER TABLE pharmacy_catalog ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(12,2);
ALTER TABLE pharmacy_catalog ADD COLUMN IF NOT EXISTS markup_percent NUMERIC(5,2) DEFAULT 0;
ALTER TABLE pharmacy_catalog ADD COLUMN IF NOT EXISTS discount_allowed NUMERIC(5,2) DEFAULT 0;
ALTER TABLE pharmacy_catalog ADD COLUMN IF NOT EXISTS max_order_qty INT;

-- Regulatory
ALTER TABLE pharmacy_catalog ADD COLUMN IF NOT EXISTS drug_license_required BOOLEAN DEFAULT false;
ALTER TABLE pharmacy_catalog ADD COLUMN IF NOT EXISTS prescription_only BOOLEAN DEFAULT true;
ALTER TABLE pharmacy_catalog ADD COLUMN IF NOT EXISTS narcotic_class TEXT;        -- NDPS schedule I/II/III
ALTER TABLE pharmacy_catalog ADD COLUMN IF NOT EXISTS poison_schedule TEXT;       -- schedule H, H1, X, G
ALTER TABLE pharmacy_catalog ADD COLUMN IF NOT EXISTS interactions_count INT DEFAULT 0;

-- ══════════════════════════════════════════════════════════
--  2. CREDIT NOTES — Customer returns, supplier returns, write-offs
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pharmacy_credit_notes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    credit_note_number  TEXT NOT NULL,
    note_type           TEXT NOT NULL
        CHECK (note_type IN ('customer_return', 'supplier_return', 'expiry_write_off', 'damage')),
    reference_type      TEXT
        CHECK (reference_type IN ('pharmacy_order', 'pharmacy_return', 'grn', 'batch')),
    reference_id        UUID,
    patient_id          UUID REFERENCES patients(id),
    vendor_id           UUID REFERENCES vendors(id),
    items               JSONB NOT NULL DEFAULT '[]',
    total_amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
    gst_amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
    net_amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
    status              TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'approved', 'settled', 'cancelled')),
    approved_by         UUID REFERENCES users(id),
    approved_at         TIMESTAMPTZ,
    settled_at          TIMESTAMPTZ,
    notes               TEXT,
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE pharmacy_credit_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY pharmacy_credit_notes_tenant ON pharmacy_credit_notes
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX idx_pharmacy_credit_notes_tenant ON pharmacy_credit_notes(tenant_id, status);
CREATE INDEX idx_pharmacy_credit_notes_vendor ON pharmacy_credit_notes(vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX idx_pharmacy_credit_notes_patient ON pharmacy_credit_notes(patient_id) WHERE patient_id IS NOT NULL;

CREATE TRIGGER trg_pharmacy_credit_notes_updated_at BEFORE UPDATE ON pharmacy_credit_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════════════════════════
--  3. STORE INDENTS — Pharmacy requests non-drug items from stores
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pharmacy_store_indents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    indent_number       TEXT NOT NULL,
    from_store_id       UUID REFERENCES store_locations(id),
    to_store_id         UUID REFERENCES store_locations(id),
    status              TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'issued', 'received', 'rejected', 'cancelled')),
    items               JSONB NOT NULL DEFAULT '[]',
    total_items         INT NOT NULL DEFAULT 0,
    notes               TEXT,
    requested_by        UUID REFERENCES users(id),
    approved_by         UUID REFERENCES users(id),
    approved_at         TIMESTAMPTZ,
    issued_by           UUID REFERENCES users(id),
    issued_at           TIMESTAMPTZ,
    received_by         UUID REFERENCES users(id),
    received_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE pharmacy_store_indents ENABLE ROW LEVEL SECURITY;
CREATE POLICY pharmacy_store_indents_tenant ON pharmacy_store_indents
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX idx_pharmacy_store_indents_tenant ON pharmacy_store_indents(tenant_id, status);

CREATE TRIGGER trg_pharmacy_store_indents_updated_at BEFORE UPDATE ON pharmacy_store_indents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════════════════════════
--  4. BATCH/STOCK ENHANCEMENTS — Procurement, financial, location, quality
-- ══════════════════════════════════════════════════════════

-- Procurement link
ALTER TABLE pharmacy_batches ADD COLUMN IF NOT EXISTS purchase_order_id UUID REFERENCES purchase_orders(id);
ALTER TABLE pharmacy_batches ADD COLUMN IF NOT EXISTS grn_id UUID REFERENCES goods_receipt_notes(id);
ALTER TABLE pharmacy_batches ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE pharmacy_batches ADD COLUMN IF NOT EXISTS supplier_batch_number TEXT;

-- Financial
ALTER TABLE pharmacy_batches ADD COLUMN IF NOT EXISTS purchase_rate NUMERIC(12,2);
ALTER TABLE pharmacy_batches ADD COLUMN IF NOT EXISTS selling_rate NUMERIC(12,2);
ALTER TABLE pharmacy_batches ADD COLUMN IF NOT EXISTS margin_percent NUMERIC(5,2);
ALTER TABLE pharmacy_batches ADD COLUMN IF NOT EXISTS last_purchase_date DATE;
ALTER TABLE pharmacy_batches ADD COLUMN IF NOT EXISTS last_purchase_rate NUMERIC(12,2);

-- Physical location
ALTER TABLE pharmacy_batches ADD COLUMN IF NOT EXISTS rack_number TEXT;
ALTER TABLE pharmacy_batches ADD COLUMN IF NOT EXISTS shelf_number TEXT;
ALTER TABLE pharmacy_batches ADD COLUMN IF NOT EXISTS bin_number TEXT;

-- Quality
ALTER TABLE pharmacy_batches ADD COLUMN IF NOT EXISTS quarantine_status TEXT DEFAULT 'cleared'
    CHECK (quarantine_status IN ('quarantine', 'cleared', 'rejected', 'pending'));
ALTER TABLE pharmacy_batches ADD COLUMN IF NOT EXISTS quality_check_date TIMESTAMPTZ;
ALTER TABLE pharmacy_batches ADD COLUMN IF NOT EXISTS quality_check_by UUID REFERENCES users(id);
ALTER TABLE pharmacy_batches ADD COLUMN IF NOT EXISTS sample_tested BOOLEAN DEFAULT false;

-- ══════════════════════════════════════════════════════════
--  5. PHARMACY → BILLING LINK — Track which invoice items came from pharmacy
-- ══════════════════════════════════════════════════════════

ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS pharmacy_order_id UUID REFERENCES pharmacy_orders(id);
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS pharmacy_batch_id UUID REFERENCES pharmacy_batches(id);
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS source_module TEXT DEFAULT 'manual';
