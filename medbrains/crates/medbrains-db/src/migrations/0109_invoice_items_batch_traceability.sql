-- ════════════════════════════════════════════════════════════════
--  0109_invoice_items_batch_traceability.sql — NABH 27 traceability
-- ════════════════════════════════════════════════════════════════
--
-- Pharmacy dispense → billing auto-charge currently posts the drug
-- name + price but NOT the batch number / expiry. NABH indicator 27
-- (drug recall preparedness) requires invoice line items for dispensed
-- drugs to carry the actual batch dispensed so a recall can trace
-- patients in scope from the invoice side.
--
-- Both columns are nullable — only pharmacy line items will populate
-- them; lab / radiology / room charges leave them blank.

ALTER TABLE invoice_items
    ADD COLUMN IF NOT EXISTS batch_number TEXT,
    ADD COLUMN IF NOT EXISTS expiry_date  DATE;

CREATE INDEX IF NOT EXISTS idx_invoice_items_batch
    ON invoice_items (batch_number)
    WHERE batch_number IS NOT NULL;
