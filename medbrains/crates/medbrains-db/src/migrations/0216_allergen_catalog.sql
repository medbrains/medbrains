-- ====================================================================
-- Migration: 0216_allergen_catalog.sql
-- RLS-Posture: tenant-rls
-- Tenant-Column: tenant_id
-- New-Tables: allergen_catalog
-- Drops: none
-- ====================================================================
-- Non-drug allergens (food / environmental / latex / contrast / biological
-- / chemical) were typed free-hand, so the same allergen got spelled a
-- dozen ways and the allergy cross-checks (which gate prescribing and
-- dispensing) missed matches. A curated frontend preset covers the common
-- ones; this table lets each hospital's list GROW on the go — every new
-- (category, allergen) a clinician records is remembered and offered as a
-- suggestion next time. Category = allergy_type, item = name.

CREATE TABLE IF NOT EXISTS public.allergen_catalog (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     uuid NOT NULL,
    allergy_type  public.allergy_type NOT NULL,
    name          text NOT NULL,
    is_active     boolean NOT NULL DEFAULT true,
    created_by    uuid,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    -- One row per (type, allergen) per tenant, case-insensitive — the upsert
    -- on allergy capture relies on this.
    UNIQUE (tenant_id, allergy_type, lower(name))
);

ALTER TABLE public.allergen_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allergen_catalog_tenant ON public.allergen_catalog;
CREATE POLICY allergen_catalog_tenant ON public.allergen_catalog
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_allergen_catalog_lookup
    ON public.allergen_catalog (tenant_id, allergy_type)
    WHERE is_active;

CREATE TRIGGER set_allergen_catalog_updated_at
    BEFORE UPDATE ON public.allergen_catalog
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
