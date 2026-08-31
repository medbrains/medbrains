-- Migration: 0989_pharmacy_fulfilment.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: pharmacy_orders_status_check, pharmacy_store_assignments_fulfilment_mode_check, pharmacy_order_items_verify_method_check

-- Pharmacy fulfilment: the life of an order between payment and collection.
--
-- `pharmacy_orders.status` went `ordered → dispensed` and nothing in between,
-- which is exactly right for a pharmacy that hands the medicine across the same
-- counter that took the money. It says nothing at all about a pharmacy where the
-- patient pays, takes a token, and waits while somebody in the back room picks
-- and packs — there, the order has a life of its own, and every step in it can
-- go wrong quietly. No queue for the picker, no record of who checked the pack
-- against the order, no gate stopping an unchecked pack going out, and no way
-- for the patient to know it is ready except by asking.
--
-- One status column, not two, so the two operating models cannot disagree about
-- where an order is. The mode decides which transitions are legal.

-- ── The mode, per store ──────────────────────────────────────────────────
--
-- Default `direct`, so nothing changes for any existing pharmacy until somebody
-- asks for it. A store that never opts in behaves exactly as it does today.
ALTER TABLE public.pharmacy_store_assignments
    ADD COLUMN IF NOT EXISTS fulfilment_mode text DEFAULT 'direct'::text NOT NULL;

ALTER TABLE public.pharmacy_store_assignments
    DROP CONSTRAINT IF EXISTS pharmacy_store_assignments_fulfilment_mode_check;

ALTER TABLE public.pharmacy_store_assignments
    ADD CONSTRAINT pharmacy_store_assignments_fulfilment_mode_check
    CHECK (fulfilment_mode = ANY (ARRAY['direct'::text, 'pack_and_collect'::text]));

-- ── The five new states ──────────────────────────────────────────────────
--
--   direct            ordered ─────────────────────────────► dispensed
--
--   pack_and_collect  ordered → picking → packed → verified → ready → collected
--                        └────────┴─────────┴──────────┴────────┴──► cancelled
--                                                              └──► released
--
-- `released` is a first-class state, not an afterthought: an order nobody comes
-- for is otherwise off the books and still on the shelf, and that is precisely
-- the drift a stock report cannot show you.
ALTER TABLE public.pharmacy_orders
    DROP CONSTRAINT IF EXISTS pharmacy_orders_status_check;

ALTER TABLE public.pharmacy_orders
    ADD CONSTRAINT pharmacy_orders_status_check
    CHECK (status = ANY (ARRAY[
        'ordered'::text,
        'picking'::text,
        'packed'::text,
        'verified'::text,
        'ready'::text,
        'collected'::text,
        'released'::text,
        'dispensed'::text,
        'partially_dispensed'::text,
        'cancelled'::text,
        'returned'::text
    ]));

-- ── Who did what, and when ───────────────────────────────────────────────
--
-- Recorded per stage rather than as one `handled_by`, because the question a
-- pharmacy actually gets asked is "who checked this pack" — and answering it
-- with the name of whoever last touched the row is not an answer.
ALTER TABLE public.pharmacy_orders
    ADD COLUMN IF NOT EXISTS picked_by uuid,
    ADD COLUMN IF NOT EXISTS picked_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS packed_by uuid,
    ADD COLUMN IF NOT EXISTS packed_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS verified_by uuid,
    ADD COLUMN IF NOT EXISTS verified_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS ready_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS collected_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS released_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS released_by uuid,
    ADD COLUMN IF NOT EXISTS release_reason text,
    ADD COLUMN IF NOT EXISTS collection_token_id uuid,
    ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS cancelled_by uuid,
    ADD COLUMN IF NOT EXISTS cancel_reason text;

DO $$
BEGIN
    ALTER TABLE ONLY public.pharmacy_orders
        ADD CONSTRAINT pharmacy_orders_picked_by_fkey
        FOREIGN KEY (picked_by) REFERENCES public.users(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE ONLY public.pharmacy_orders
        ADD CONSTRAINT pharmacy_orders_packed_by_fkey
        FOREIGN KEY (packed_by) REFERENCES public.users(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE ONLY public.pharmacy_orders
        ADD CONSTRAINT pharmacy_orders_verified_by_fkey
        FOREIGN KEY (verified_by) REFERENCES public.users(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE ONLY public.pharmacy_orders
        ADD CONSTRAINT pharmacy_orders_released_by_fkey
        FOREIGN KEY (released_by) REFERENCES public.users(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE ONLY public.pharmacy_orders
        ADD CONSTRAINT pharmacy_orders_cancelled_by_fkey
        FOREIGN KEY (cancelled_by) REFERENCES public.users(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── The check itself, per line ───────────────────────────────────────────
--
-- Storing the check rather than trusting it, the same way `pharmacy_counseling`
-- does. `verify_method` matters because a manual tick and a resolved scan are
-- not the same evidence, and a pharmacy that discovers it is ticking everything
-- manually has learned something about its barcodes.
ALTER TABLE public.pharmacy_order_items
    ADD COLUMN IF NOT EXISTS verified_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS verified_by uuid,
    ADD COLUMN IF NOT EXISTS verify_method text,
    ADD COLUMN IF NOT EXISTS verify_note text;

ALTER TABLE public.pharmacy_order_items
    DROP CONSTRAINT IF EXISTS pharmacy_order_items_verify_method_check;

ALTER TABLE public.pharmacy_order_items
    ADD CONSTRAINT pharmacy_order_items_verify_method_check
    CHECK (verify_method IS NULL OR verify_method = ANY (ARRAY['scan'::text, 'manual'::text]));

DO $$
BEGIN
    ALTER TABLE ONLY public.pharmacy_order_items
        ADD CONSTRAINT pharmacy_order_items_verified_by_fkey
        FOREIGN KEY (verified_by) REFERENCES public.users(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── The picking queue ────────────────────────────────────────────────────
--
-- The queue is read constantly by every picker on shift and asks one question:
-- which orders at my store are still in flight. Partial, because the states it
-- excludes are the overwhelming majority of the table's history.
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_fulfilment_queue
    ON public.pharmacy_orders (tenant_id, store_location_id, status)
    WHERE status IN ('ordered', 'picking', 'packed', 'verified', 'ready')
      AND deleted_at IS NULL;
