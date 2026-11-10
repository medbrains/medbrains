-- ====================================================================
-- Migration: 1340_storefront_stores_and_holds.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: pharmacy_online_stores, pharmacy_stock_holds
-- Drops: none
-- ====================================================================
-- Storefront part 2 (#4864). Owner decisions 2026-10-20:
--   * The hospital switches online fulfilment on per pharmacy location, and
--     sets each one's serviceable pincodes. A patient outside them is told
--     "not delivered here" and is still offered pickup.
--   * Stock is held for an online order at checkout and through pharmacist
--     review, for as long as the hospital's hold ladder says — which may be
--     shorter when stock is scarce. Holds come only out of what online may
--     sell (above the online floor); the counter and the wards never see them.
--   * Nothing is sold above the NPPA ceiling price (DPCO 2013), kept on the
--     catalogue with where it came from.
--   * Substitution matches salt, strength, form and release type, and never
--     swaps a narrow-therapeutic-index drug or a biological.

CREATE TABLE IF NOT EXISTS public.pharmacy_online_stores (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            uuid NOT NULL REFERENCES public.tenants(id),
    store_location_id    uuid NOT NULL REFERENCES public.store_locations(id),
    -- Fills online orders. Off until the hospital switches it on.
    enabled              boolean NOT NULL DEFAULT false,
    -- The store's own pincode: nearer stores are chosen first.
    pincode              text CHECK (pincode IS NULL OR pincode ~ '^[1-9][0-9]{5}$'),
    -- Where it delivers. Empty: pickup only.
    serviceable_pincodes text[] NOT NULL DEFAULT '{}',
    created_by           uuid REFERENCES public.users(id),
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),
    deleted_at           timestamptz,
    deleted_by           uuid,
    delete_reason        text
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pharmacy_online_stores_location
    ON public.pharmacy_online_stores (tenant_id, store_location_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pharmacy_online_stores_pincodes
    ON public.pharmacy_online_stores USING gin (serviceable_pincodes)
    WHERE enabled AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.pharmacy_stock_holds (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         uuid NOT NULL REFERENCES public.tenants(id),
    store_order_id    uuid NOT NULL REFERENCES public.pharmacy_store_orders(id),
    catalog_item_id   uuid NOT NULL REFERENCES public.pharmacy_catalog(id),
    -- The fulfilling store; NULL while the hospital runs one pharmacy and
    -- has switched no location on.
    store_location_id uuid REFERENCES public.store_locations(id),
    quantity          integer NOT NULL CHECK (quantity > 0),
    kind              text NOT NULL CHECK (kind IN ('checkout', 'review')),
    expires_at        timestamptz NOT NULL,
    released_at       timestamptz,
    release_reason    text CHECK (release_reason IN
                          ('expired', 'released', 'cancelled', 'rejected', 'replaced')),
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    deleted_at        timestamptz,
    deleted_by        uuid,
    delete_reason     text,
    CONSTRAINT stock_holds_release_named CHECK ((released_at IS NULL) = (release_reason IS NULL))
);
-- Availability reads live holds per item; the sweeper finds expired ones.
CREATE INDEX IF NOT EXISTS idx_stock_holds_live
    ON public.pharmacy_stock_holds (tenant_id, catalog_item_id, expires_at)
    WHERE released_at IS NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_stock_holds_order
    ON public.pharmacy_stock_holds (tenant_id, store_order_id)
    WHERE released_at IS NULL AND deleted_at IS NULL;

-- The store chosen to fill the order, and what the pharmacist should look at
-- (a repeat of the same medicine too soon, say). Flags hold an order for
-- review; they never refuse it.
ALTER TABLE public.pharmacy_store_orders
    ADD COLUMN IF NOT EXISTS store_location_id uuid REFERENCES public.store_locations(id),
    ADD COLUMN IF NOT EXISTS flags text[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
-- 'closed': every line ended up refused or printed for an outside pharmacy.
ALTER TABLE public.pharmacy_store_orders DROP CONSTRAINT IF EXISTS pharmacy_store_orders_status_check;
ALTER TABLE public.pharmacy_store_orders ADD CONSTRAINT pharmacy_store_orders_status_check
    CHECK (status IN ('cart', 'awaiting_verification', 'released', 'rejected', 'cancelled', 'closed'));

ALTER TABLE public.pharmacy_catalog
    -- DPCO 2013 para 13/14: no scheduled formulation above the NPPA ceiling.
    ADD COLUMN IF NOT EXISTS nppa_ceiling_price numeric(12,2)
        CHECK (nppa_ceiling_price IS NULL OR nppa_ceiling_price > 0),
    ADD COLUMN IF NOT EXISTS nppa_notification text,
    -- 'manual' or 'import'. NPPA publishes notifications, not a feed, so
    -- every value is the hospital's transcription.
    ADD COLUMN IF NOT EXISTS nppa_ceiling_source text
        CHECK (nppa_ceiling_source IS NULL OR nppa_ceiling_source IN ('manual', 'import')),
    ADD COLUMN IF NOT EXISTS nppa_updated_at timestamptz,
    ADD COLUMN IF NOT EXISTS release_type text NOT NULL DEFAULT 'immediate'
        CHECK (release_type IN ('immediate', 'modified')),
    ADD COLUMN IF NOT EXISTS narrow_therapeutic_index boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_biological boolean NOT NULL DEFAULT false;

DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['pharmacy_online_stores', 'pharmacy_stock_holds'] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON public.%1$I', t);
        EXECUTE format('CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON public.%1$I '
                       'FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t);
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_soft_delete ON public.%1$I', t);
        EXECUTE format('CREATE TRIGGER trg_%1$s_soft_delete BEFORE DELETE ON public.%1$I '
                       'FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail()', t);
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_%1$s ON public.%1$I', t);
        EXECUTE format('CREATE POLICY tenant_isolation_%1$s ON public.%1$I '
                       'USING (tenant_id = ANY (app_visible_tenants())) '
                       'WITH CHECK (tenant_id = ANY (app_visible_tenants()))', t);
    END LOOP;
END $$;

-- Who switched a store on, and its area, in the audit log.
DROP TRIGGER IF EXISTS audit_pharmacy_online_stores ON public.pharmacy_online_stores;
CREATE TRIGGER audit_pharmacy_online_stores AFTER INSERT OR UPDATE OR DELETE
    ON public.pharmacy_online_stores FOR EACH ROW EXECUTE FUNCTION audit_trigger_func('pharmacy');
