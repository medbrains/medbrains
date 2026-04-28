-- 122: Supply Chain Integration — Link Procurement ↔ Pharmacy ↔ Store

-- ══════════════════════════════════════════════════════════
--  1. CROSS-REFERENCE: pharmacy_catalog ↔ store_catalog
-- ══════════════════════════════════════════════════════════

-- Pharmacy items can link to store catalog for procurement flow
ALTER TABLE pharmacy_catalog ADD COLUMN IF NOT EXISTS store_catalog_id UUID REFERENCES store_catalog(id);

-- PO items can reference pharmacy catalog directly
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS pharmacy_catalog_id UUID REFERENCES pharmacy_catalog(id);

-- batch_stock can link to pharmacy_batches when GRN auto-syncs
ALTER TABLE batch_stock ADD COLUMN IF NOT EXISTS pharmacy_batch_id UUID REFERENCES pharmacy_batches(id);

-- pharmacy_batches gets proper vendor FK (not free-text supplier_info)
ALTER TABLE pharmacy_batches ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id);

-- ══════════════════════════════════════════════════════════
--  2. VENDOR SUPPLY CATEGORIES — what they supply
-- ══════════════════════════════════════════════════════════

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS supply_categories TEXT[] DEFAULT '{}';
-- e.g. {'pharmacy', 'surgical', 'general', 'lab', 'radiology', 'dietary'}
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS product_lines TEXT;
-- free text: "Antibiotics, Analgesics, Cardiac drugs"
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS drug_license_number TEXT;
-- required for pharmacy vendors (Drug License No.)
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS fssai_number TEXT;
-- for dietary/food vendors
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS is_pharmacy_vendor BOOLEAN DEFAULT false;

-- ══════════════════════════════════════════════════════════
--  3. POS SALE CANCELLATION SUPPORT
-- ══════════════════════════════════════════════════════════

ALTER TABLE pharmacy_pos_sales ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed'
    CHECK (status IN ('completed', 'partially_cancelled', 'cancelled', 'refunded'));
ALTER TABLE pharmacy_pos_sales ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE pharmacy_pos_sales ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES users(id);
ALTER TABLE pharmacy_pos_sales ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE pharmacy_pos_sales ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(12,2) DEFAULT 0;

ALTER TABLE pharmacy_pos_sale_items ADD COLUMN IF NOT EXISTS is_cancelled BOOLEAN DEFAULT false;
ALTER TABLE pharmacy_pos_sale_items ADD COLUMN IF NOT EXISTS cancelled_qty INT DEFAULT 0;
ALTER TABLE pharmacy_pos_sale_items ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- ══════════════════════════════════════════════════════════
--  4. CREDIT NOTE → BILLING ADJUSTMENT LINK
-- ══════════════════════════════════════════════════════════

ALTER TABLE pharmacy_credit_notes ADD COLUMN IF NOT EXISTS adjustment_type TEXT
    CHECK (adjustment_type IN ('reduce_bill', 'add_credit_balance', 'cash_refund', 'pending'));
ALTER TABLE pharmacy_credit_notes ADD COLUMN IF NOT EXISTS adjusted_invoice_id UUID REFERENCES invoices(id);
ALTER TABLE pharmacy_credit_notes ADD COLUMN IF NOT EXISTS credit_patient_id UUID;
-- links to credit_patients entry if balance added

-- Track original order for auto-price lookup
ALTER TABLE pharmacy_credit_notes ADD COLUMN IF NOT EXISTS original_order_id UUID REFERENCES pharmacy_orders(id);
ALTER TABLE pharmacy_credit_notes ADD COLUMN IF NOT EXISTS original_pos_sale_id UUID REFERENCES pharmacy_pos_sales(id);

-- ══════════════════════════════════════════════════════════
--  5. GRN → PHARMACY AUTO-SYNC FLAG
-- ══════════════════════════════════════════════════════════

-- Mark GRN items that were auto-synced to pharmacy
ALTER TABLE grn_items ADD COLUMN IF NOT EXISTS pharmacy_synced BOOLEAN DEFAULT false;
ALTER TABLE grn_items ADD COLUMN IF NOT EXISTS pharmacy_batch_id UUID REFERENCES pharmacy_batches(id);
