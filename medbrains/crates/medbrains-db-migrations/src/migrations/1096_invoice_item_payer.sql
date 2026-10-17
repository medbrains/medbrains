-- Who pays each bill line (#294). NULL = decided automatically: a line on the
-- hospital's non-payables list is the patient's, anything else goes to the
-- bill's insurer, scheme or corporate when it has one. A desk override is
-- stored with its reason.
ALTER TABLE invoice_items
    ADD COLUMN IF NOT EXISTS payer text,
    ADD COLUMN IF NOT EXISTS payer_reason text;

DO $$ BEGIN
    ALTER TABLE invoice_items ADD CONSTRAINT invoice_items_payer_check
        CHECK (payer IS NULL OR payer IN ('third_party', 'patient'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
