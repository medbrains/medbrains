-- 0113_billing_reversal_action_keys.sql
-- Reversals can be partial and can happen more than once against the
-- same original line. Idempotency therefore belongs to the triggering
-- action, not only to the original invoice item.

ALTER TABLE invoice_items
    ADD COLUMN IF NOT EXISTS reversal_source_module TEXT,
    ADD COLUMN IF NOT EXISTS reversal_source_id UUID;

DROP INDEX IF EXISTS idx_invoice_items_one_reversal_per_item;

CREATE INDEX IF NOT EXISTS idx_invoice_items_reversal_of
    ON invoice_items (tenant_id, reversal_of_id)
    WHERE reversal_of_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_items_reversal_action_key
    ON invoice_items (tenant_id, reversal_source_module, reversal_source_id)
    WHERE reversal_source_module IS NOT NULL AND reversal_source_id IS NOT NULL;
