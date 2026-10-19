-- ====================================================================
-- Migration: 1140_pharmacy_catalog_merge.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: pharmacy_catalog_merges
-- Drops: none
-- ====================================================================
-- Duplicate drugs in the pharmacy catalogue (#4861). The CSV import upserts
-- on code, so two codes for one drug make two items, and stock, orders and
-- prescriptions split between them. A merge moves every reference from the
-- duplicate to the drug that stays, in one transaction, and leaves the
-- duplicate soft-deleted with merged_into_id pointing at the survivor.
--
-- The references are read from the foreign keys themselves, so a table that
-- starts pointing at pharmacy_catalog later is merged too, without anyone
-- remembering to add it here. A unique constraint that the merge would break
-- aborts the whole merge; nothing is half-moved.

ALTER TABLE public.pharmacy_catalog
    ADD COLUMN IF NOT EXISTS merged_into_id uuid REFERENCES public.pharmacy_catalog(id)
        CHECK (merged_into_id IS NULL OR merged_into_id <> id);

CREATE INDEX IF NOT EXISTS idx_pharmacy_catalog_name_trgm
    ON public.pharmacy_catalog USING gin (lower(name) gin_trgm_ops)
    WHERE deleted_at IS NULL;

CREATE TABLE public.pharmacy_catalog_merges (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    survivor_id uuid NOT NULL REFERENCES public.pharmacy_catalog(id),
    merged_id uuid NOT NULL REFERENCES public.pharmacy_catalog(id),
    repointed jsonb NOT NULL DEFAULT '{}'::jsonb,
    stock_moved integer NOT NULL DEFAULT 0,
    reason text NOT NULL CHECK (length(btrim(reason)) >= 5),
    merged_by uuid NOT NULL REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text
);

CREATE INDEX idx_pharmacy_catalog_merges_tenant
    ON public.pharmacy_catalog_merges (tenant_id, created_at DESC);

ALTER TABLE public.pharmacy_catalog_merges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_catalog_merges FORCE ROW LEVEL SECURITY;
CREATE POLICY pharmacy_catalog_merges_tenant ON public.pharmacy_catalog_merges
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));
CREATE TRIGGER trg_pharmacy_catalog_merges_updated_at BEFORE UPDATE ON public.pharmacy_catalog_merges
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_pharmacy_catalog_merges_soft_delete BEFORE DELETE ON public.pharmacy_catalog_merges
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Re-point every single-column foreign key from p_merged to p_survivor and
-- return {"table.column": rows}. SECURITY INVOKER: row-level security of the
-- caller's tenant applies to every UPDATE. The caller has already checked
-- both drugs, their schedules and the permission.
CREATE OR REPLACE FUNCTION public.repoint_pharmacy_catalog_refs(p_merged uuid, p_survivor uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    fk record;
    n bigint;
    moved jsonb := '{}'::jsonb;
BEGIN
    FOR fk IN
        SELECT c.conrelid::regclass AS tbl, a.attname AS col
          FROM pg_constraint c
          JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
         WHERE c.contype = 'f'
           AND c.confrelid = 'public.pharmacy_catalog'::regclass
           AND array_length(c.conkey, 1) = 1
           AND c.conrelid <> 'public.pharmacy_catalog_merges'::regclass
         ORDER BY 1, 2
    LOOP
        EXECUTE format('UPDATE %s SET %I = $1 WHERE %I = $2', fk.tbl, fk.col, fk.col)
            USING p_survivor, p_merged;
        GET DIAGNOSTICS n = ROW_COUNT;
        IF n > 0 THEN
            moved := moved || jsonb_build_object(fk.tbl::text || '.' || fk.col, n);
        END IF;
    END LOOP;
    RETURN moved;
END;
$$;
