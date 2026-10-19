-- ====================================================================
-- Migration: 1128_pharmacy_storefront.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: pharmacy_store_orders, pharmacy_store_order_lines
-- Drops: none
-- ====================================================================
-- The patient storefront (#4849): patients order from the hospital's own
-- pharmacy online, like an e-pharmacy. A pharmacist chooses what is sold
-- online (off by default). A patient's cart is their store order in status
-- 'cart'; checkout moves it on — straight to fulfilment when nothing needs a
-- prescription or a hospital prescription covers it, to a pharmacist when an
-- uploaded prescription must be verified first. Releasing it makes an
-- ordinary pharmacy order, so stock moves only at dispense; delivery and
-- payment are part 3's (pharmacy_deliveries, the payment link).

ALTER TABLE public.pharmacy_catalog
    ADD COLUMN IF NOT EXISTS sold_online boolean NOT NULL DEFAULT false,
    -- Codeine syrups, benzodiazepines, pregabalin and the like: pickup only
    -- and a unit cap online, whatever their schedule.
    ADD COLUMN IF NOT EXISTS habit_forming boolean NOT NULL DEFAULT false,
    -- Units online orders may not take, so the wards and the counter are
    -- never left short; NULL means the item's reorder level.
    ADD COLUMN IF NOT EXISTS online_reserve_floor integer
        CHECK (online_reserve_floor IS NULL OR online_reserve_floor >= 0);

-- The MRP printed on each batch: old and new stock can differ, and nothing
-- is sold above the MRP of the strip handed over.
ALTER TABLE public.pharmacy_batches
    ADD COLUMN IF NOT EXISTS mrp numeric(12,2) CHECK (mrp IS NULL OR mrp >= 0);

-- Patients search by brand or by INN; trigram so a partial word matches.
CREATE INDEX IF NOT EXISTS idx_pharmacy_catalog_online_name_trgm
    ON public.pharmacy_catalog USING gin (lower(name) gin_trgm_ops)
    WHERE sold_online AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pharmacy_catalog_online_inn_trgm
    ON public.pharmacy_catalog USING gin (lower(COALESCE(inn_name, generic_name, '')) gin_trgm_ops)
    WHERE sold_online AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.pharmacy_store_orders (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               uuid NOT NULL REFERENCES public.tenants(id),
    patient_id              uuid NOT NULL REFERENCES public.patients(id),
    status                  text NOT NULL DEFAULT 'cart'
        CHECK (status IN ('cart', 'awaiting_verification', 'released', 'rejected', 'cancelled')),
    rx_source               text NOT NULL DEFAULT 'none'
        CHECK (rx_source IN ('none', 'hospital', 'upload')),
    -- One of the patient's own prescriptions from this hospital.
    prescription_id         uuid REFERENCES public.prescriptions(id),
    -- An uploaded prescription, in the documents store.
    rx_document_key         text,
    rx_document_type        text,
    -- The file's SHA-256: the same prescription uploaded for another
    -- patient is flagged to the pharmacist.
    rx_document_sha256      text,
    -- Pickup or delivery, as on a refill request (part 3).
    fulfilment              text NOT NULL DEFAULT 'pickup'
        CHECK (fulfilment IN ('pickup', 'delivery')),
    delivery_address        text,
    delivery_landmark       text,
    delivery_pincode        text,
    delivery_phone          text,
    delivery_slot           text CHECK (delivery_slot IN ('morning', 'afternoon', 'evening')),
    delivery_payment        text CHECK (delivery_payment IN ('prepaid', 'cash_on_delivery')),
    payment_txn_id          uuid REFERENCES public.payment_gateway_transactions(id),
    delivery_note           text,
    placed_at               timestamptz,
    -- The pharmacist's verdict on an uploaded prescription.
    verified_by             uuid REFERENCES public.users(id),
    verified_at             timestamptz,
    decision_note           text,
    -- Schedule H1 (Rule 65(3A)): who prescribed, and the patient's address.
    prescriber_name         text,
    prescriber_registration text,
    patient_address         text,
    pharmacy_order_id       uuid REFERENCES public.pharmacy_orders(id),
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    deleted_at              timestamptz,
    deleted_by              uuid,
    delete_reason           text,
    CONSTRAINT store_orders_rx_named CHECK (
        (rx_source <> 'hospital' OR prescription_id IS NOT NULL)
        AND (rx_source <> 'upload' OR rx_document_key IS NOT NULL)),
    CONSTRAINT store_orders_delivery_complete CHECK (
        fulfilment = 'pickup'
        OR (delivery_address IS NOT NULL AND delivery_phone IS NOT NULL
            AND delivery_payment IS NOT NULL))
);
-- One cart per patient.
CREATE UNIQUE INDEX IF NOT EXISTS idx_store_orders_cart
    ON public.pharmacy_store_orders (tenant_id, patient_id)
    WHERE status = 'cart' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_store_orders_patient
    ON public.pharmacy_store_orders (tenant_id, patient_id, created_at DESC)
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_store_orders_verify_queue
    ON public.pharmacy_store_orders (tenant_id, placed_at)
    WHERE status = 'awaiting_verification' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_store_orders_rx_hash
    ON public.pharmacy_store_orders (tenant_id, rx_document_sha256)
    WHERE rx_document_sha256 IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_store_orders_payment
    ON public.pharmacy_store_orders (payment_txn_id) WHERE payment_txn_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_store_orders_pharmacy_order
    ON public.pharmacy_store_orders (tenant_id, pharmacy_order_id)
    WHERE pharmacy_order_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.pharmacy_store_order_lines (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        uuid NOT NULL REFERENCES public.tenants(id),
    store_order_id   uuid NOT NULL REFERENCES public.pharmacy_store_orders(id),
    catalog_item_id  uuid NOT NULL REFERENCES public.pharmacy_catalog(id),
    drug_name        text NOT NULL,
    sale_class       text NOT NULL CHECK (sale_class IN ('otc', 'prescription')),
    quantity         integer NOT NULL CHECK (quantity > 0),
    -- Added from the patient's own hospital prescription ("order my
    -- prescription"), so it may be ordered though not listed for browsing.
    via_prescription boolean NOT NULL DEFAULT false,
    -- What that prescription works out to: the most such a line may ask.
    prescribed_quantity integer CHECK (prescribed_quantity IS NULL OR prescribed_quantity > 0),
    -- The pharmacist's verdict on this line: who, when, and why not.
    approved_quantity integer CHECK (approved_quantity IS NULL OR approved_quantity > 0),
    decided_by       uuid REFERENCES public.users(id),
    decided_at       timestamptz,
    reject_reason    text CHECK (reject_reason IN ('expired', 'illegible', 'not_on_prescription',
                                  'quantity_exceeds_prescription', 'needs_consultation', 'other')),
    -- MRP less the online discount, tax-inclusive; fixed at checkout.
    unit_price       numeric(12,2),
    status           text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    deleted_at       timestamptz,
    deleted_by       uuid,
    delete_reason    text
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_store_order_lines_item
    ON public.pharmacy_store_order_lines (store_order_id, catalog_item_id)
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_store_order_lines_order
    ON public.pharmacy_store_order_lines (tenant_id, store_order_id)
    WHERE deleted_at IS NULL;

DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['pharmacy_store_orders', 'pharmacy_store_order_lines'] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON public.%1$I', t);
        EXECUTE format('CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON public.%1$I '
                       'FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t);
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_soft_delete ON public.%1$I', t);
        EXECUTE format('CREATE TRIGGER trg_%1$s_soft_delete BEFORE DELETE ON public.%1$I '
                       'FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail()', t);
        -- The verdict and every line it kept or dropped, in the audit log.
        EXECUTE format('DROP TRIGGER IF EXISTS audit_%1$s ON public.%1$I', t);
        EXECUTE format('CREATE TRIGGER audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$I '
                       'FOR EACH ROW EXECUTE FUNCTION audit_trigger_func(''pharmacy'')', t);
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_%1$s ON public.%1$I', t);
        EXECUTE format('CREATE POLICY tenant_isolation_%1$s ON public.%1$I '
                       'USING (tenant_id = ANY (app_visible_tenants())) '
                       'WITH CHECK (tenant_id = ANY (app_visible_tenants()))', t);
    END LOOP;
END $$;

-- A delivery a patient chose at checkout, as part 3's refill deliveries are.
ALTER TABLE public.pharmacy_deliveries
    ADD COLUMN IF NOT EXISTS store_order_id uuid REFERENCES public.pharmacy_store_orders(id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_deliveries_store_order
    ON public.pharmacy_deliveries (tenant_id, store_order_id)
    WHERE store_order_id IS NOT NULL;

-- An order a patient placed online has no staff author until a pharmacist
-- takes it on: an over-the-counter order goes straight to fulfilment.
ALTER TABLE public.pharmacy_orders ALTER COLUMN ordered_by DROP NOT NULL;
