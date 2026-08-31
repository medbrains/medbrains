-- 0112_billing_line_reversal_backbone.sql
-- Source-generated billing lines must never be deleted. Voids create an
-- offsetting reversal row that references the original line, preserving
-- auditability while keeping invoice totals correct.

ALTER TABLE invoice_items
    ADD COLUMN IF NOT EXISTS reversal_of_id UUID,
    ADD COLUMN IF NOT EXISTS is_reversal BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reversed_by UUID,
    ADD COLUMN IF NOT EXISTS reversal_reason TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'invoice_items_reversal_of_id_fkey'
    ) THEN
        ALTER TABLE invoice_items
            ADD CONSTRAINT invoice_items_reversal_of_id_fkey
            FOREIGN KEY (reversal_of_id) REFERENCES invoice_items(id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'invoice_items_reversed_by_fkey'
    ) THEN
        ALTER TABLE invoice_items
            ADD CONSTRAINT invoice_items_reversed_by_fkey
            FOREIGN KEY (reversed_by) REFERENCES users(id);
    END IF;
END $$;

DROP INDEX IF EXISTS idx_invoice_items_source_idempotency;

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_items_source_idempotency
    ON invoice_items (invoice_id, source, source_id)
    WHERE source_id IS NOT NULL AND reversal_of_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_items_one_reversal_per_item
    ON invoice_items (tenant_id, reversal_of_id)
    WHERE reversal_of_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoice_items_source_reversal
    ON invoice_items (tenant_id, source, source_id, is_reversal)
    WHERE source_id IS NOT NULL;
