-- ====================================================================
-- Migration: 0215_asset_movements.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: asset_movements
-- Drops: none
-- ====================================================================
-- The asset register (bme_equipment + equipment, unified) was read-only:
-- an asset's department/location could only be changed by editing the
-- source row directly, with no record of who moved what, when, or why, and
-- no way for one department to request an asset from another and have the
-- custodian satisfy/complete that request. This adds an asset-movement
-- ledger that doubles as an inter-department request workflow:
--   requested -> completed (custodian relocates the asset) | rejected.
-- On completion the asset's source row is repointed to the destination
-- department (and location, for bme_equipment which carries free text).

CREATE TABLE IF NOT EXISTS public.asset_movements (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          uuid NOT NULL,
    -- Which unified-register row this movement is for.
    source_type        text NOT NULL CHECK (source_type IN ('bme_equipment', 'equipment')),
    source_id          uuid NOT NULL,
    movement_type      text NOT NULL DEFAULT 'transfer'
                       CHECK (movement_type IN ('transfer', 'issue', 'return', 'repair', 'disposal')),
    status             text NOT NULL DEFAULT 'requested'
                       CHECK (status IN ('requested', 'completed', 'rejected', 'cancelled')),
    from_department_id uuid,
    to_department_id   uuid,
    from_location      text,
    to_location        text,
    reason             text,
    requested_by       uuid,
    completed_by       uuid,
    completed_at       timestamptz,
    rejection_reason   text,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.asset_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS asset_movements_tenant ON public.asset_movements;
CREATE POLICY asset_movements_tenant ON public.asset_movements
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

-- Per-asset history lookup and the open-request worklist (status = 'requested').
CREATE INDEX IF NOT EXISTS idx_asset_movements_asset
    ON public.asset_movements (tenant_id, source_type, source_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_asset_movements_open
    ON public.asset_movements (tenant_id, status)
    WHERE status = 'requested';

CREATE TRIGGER set_asset_movements_updated_at
    BEFORE UPDATE ON public.asset_movements
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
