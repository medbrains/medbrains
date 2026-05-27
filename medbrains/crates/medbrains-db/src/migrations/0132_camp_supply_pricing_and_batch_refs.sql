-- Camp supply rows need to behave like pharmacy stock rows during outreach
-- planning: catalog-backed medicines, batch/store traceability, and camp-specific
-- patient/cost price tags.

ALTER TABLE public.camp_supply_items
    ADD COLUMN IF NOT EXISTS catalog_item_id uuid,
    ADD COLUMN IF NOT EXISTS batch_stock_id uuid,
    ADD COLUMN IF NOT EXISTS store_location_id uuid,
    ADD COLUMN IF NOT EXISTS charge_mode text DEFAULT 'free' NOT NULL,
    ADD COLUMN IF NOT EXISTS unit_price numeric(12,2) DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS tax_percent numeric(5,2) DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS cost_amount numeric(12,2) DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS sponsor_covered_amount numeric(12,2) DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS concession_percentage numeric(5,2) DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS approval_required boolean DEFAULT false NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'camp_supply_items_charge_mode_check'
    ) THEN
        ALTER TABLE public.camp_supply_items
            ADD CONSTRAINT camp_supply_items_charge_mode_check
            CHECK (charge_mode IN ('free', 'paid', 'mixed', 'sponsor_covered'));
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'camp_supply_items_catalog_item_id_fkey'
    ) THEN
        ALTER TABLE public.camp_supply_items
            ADD CONSTRAINT camp_supply_items_catalog_item_id_fkey
            FOREIGN KEY (catalog_item_id) REFERENCES public.pharmacy_catalog(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'camp_supply_items_batch_stock_id_fkey'
    ) THEN
        ALTER TABLE public.camp_supply_items
            ADD CONSTRAINT camp_supply_items_batch_stock_id_fkey
            FOREIGN KEY (batch_stock_id) REFERENCES public.pharmacy_batches(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'camp_supply_items_store_location_id_fkey'
    ) THEN
        ALTER TABLE public.camp_supply_items
            ADD CONSTRAINT camp_supply_items_store_location_id_fkey
            FOREIGN KEY (store_location_id) REFERENCES public.store_locations(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_camp_supply_items_catalog
    ON public.camp_supply_items (tenant_id, camp_id, catalog_item_id)
    WHERE catalog_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_camp_supply_items_batch
    ON public.camp_supply_items (tenant_id, batch_stock_id)
    WHERE batch_stock_id IS NOT NULL;
