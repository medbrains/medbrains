-- ====================================================================
-- Migration: 0127_pharmacy_pos_billing_link.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================

-- Link pharmacy POS/counter sales to the common Billing invoice they post.
-- Pharmacy remains the operational cash-drawer and stock surface; Billing is
-- the hospital finance mirror for patient dues, revenue, receipts, and reports.

ALTER TABLE pharmacy_pos_sales
    ADD COLUMN IF NOT EXISTS billing_invoice_id uuid REFERENCES invoices(id),
    ADD COLUMN IF NOT EXISTS billing_posted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_pharmacy_pos_sales_billing_invoice
    ON pharmacy_pos_sales (tenant_id, billing_invoice_id)
    WHERE billing_invoice_id IS NOT NULL;
