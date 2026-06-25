-- ====================================================================
-- Migration: 0212_er_bays.sql
-- RLS-Posture: tenant-rls
-- Tenant-Column: tenant_id
-- New-Tables: er_bays
-- Drops: none
-- ====================================================================
-- ER bays were a free-text `er_visits.bay_number` string — no per-hospital
-- configuration and no bay board, so a charge nurse couldn't see which
-- bays are occupied or filter/KPI by bay. Add a configurable ER bay master
-- (name, code, type, active). Visits reference a bay by its code; the
-- occupancy board is computed from active visits. Free-text stays valid
-- for legacy rows.

CREATE TABLE IF NOT EXISTS public.er_bays (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid NOT NULL,
    code        text NOT NULL,
    name        text NOT NULL,
    bay_type    text,
    is_active   boolean NOT NULL DEFAULT true,
    sort_order  integer NOT NULL DEFAULT 0,
    notes       text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, code)
);

ALTER TABLE public.er_bays ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS er_bays_tenant ON public.er_bays;
CREATE POLICY er_bays_tenant ON public.er_bays
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_er_bays_tenant ON public.er_bays (tenant_id);

CREATE TRIGGER set_er_bays_updated_at
    BEFORE UPDATE ON public.er_bays
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
