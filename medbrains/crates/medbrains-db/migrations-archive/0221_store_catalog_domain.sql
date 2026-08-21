-- Migration: 0221_store_catalog_domain.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Alters store_catalog, which carries tenant_id and the tenant policy
-- despite its name.
-- Stationery is the one product category the store catalog didn't cover. Rather
-- than a separate table (which would fork the indent/transfer/inventory flows),
-- tag store_catalog rows with a `domain`: clinical consumables vs office
-- stationery. Same table, same everything — just filterable.
ALTER TABLE public.store_catalog
    ADD COLUMN IF NOT EXISTS domain text NOT NULL DEFAULT 'consumable';

DO $$ BEGIN
    ALTER TABLE public.store_catalog
        ADD CONSTRAINT chk_store_catalog_domain CHECK (domain IN ('consumable', 'stationery'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_store_catalog_domain ON public.store_catalog (tenant_id, domain);
