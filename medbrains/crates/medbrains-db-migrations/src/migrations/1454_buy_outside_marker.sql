-- ====================================================================
-- Migration: 1454_buy_outside_marker.sql
-- RLS-Posture: not-applicable
-- Tenant-Column: N/A
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- "Buy outside" is chosen, never inferred (owner, 2026-11-09).
--
-- A doctor, or a nurse entering orders for one, marks a prescription line
-- the hospital does not stock as bought outside; a pharmacist may confirm an
-- unmapped line as such at review. The line prints as "Buy from outside the
-- hospital", shows at the pharmacy as "Buy outside, not dispensed here", is
-- never dispensed and never billed.
--
--   prescription_items.buy_outside / buy_outside_by: who chose it.
--   pharmacy_order_items.buy_outside / buy_outside_by: the order's copy, and
--     who confirmed it (the prescriber, or the reviewing pharmacist).
--   ipd_medication_administration.patients_own: the MAR dose is the
--     patient's own medicine, brought from outside, with no batch.
--
-- An order line with no catalogue item (buy outside, or typed by an order
-- raised elsewhere) carries no price: nothing here sells it. A trigger, not a
-- CHECK, so a historic priced typed line can still be cancelled, returned or
-- soft-deleted (the same reasoning as 1453).

ALTER TABLE public.prescription_items
    ADD COLUMN IF NOT EXISTS buy_outside boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS buy_outside_by uuid;

ALTER TABLE public.prescription_items
    DROP CONSTRAINT IF EXISTS prescription_items_buy_outside_no_catalogue;
ALTER TABLE public.prescription_items
    ADD CONSTRAINT prescription_items_buy_outside_no_catalogue
    CHECK (NOT buy_outside OR catalog_item_id IS NULL);

ALTER TABLE public.pharmacy_order_items
    ADD COLUMN IF NOT EXISTS buy_outside boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS buy_outside_by uuid;

ALTER TABLE public.pharmacy_order_items
    DROP CONSTRAINT IF EXISTS pharmacy_order_items_buy_outside_unsold;
ALTER TABLE public.pharmacy_order_items
    ADD CONSTRAINT pharmacy_order_items_buy_outside_unsold
    CHECK (NOT buy_outside OR (catalog_item_id IS NULL AND unit_price = 0
                               AND total_price = 0 AND quantity_dispensed = 0));

ALTER TABLE public.ipd_medication_administration
    ADD COLUMN IF NOT EXISTS patients_own boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.pharmacy_typed_line_is_unpriced() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.catalog_item_id IS NULL
       AND (NEW.unit_price <> 0 OR NEW.total_price <> 0)
       AND (TG_OP = 'INSERT' OR NEW.unit_price > OLD.unit_price
            OR NEW.total_price > OLD.total_price) THEN
        RAISE EXCEPTION 'A medicine not in the catalogue is not sold here, so it carries no price.'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_item_typed_line_unpriced ON pharmacy_order_items;
CREATE TRIGGER trg_order_item_typed_line_unpriced
    BEFORE INSERT OR UPDATE OF unit_price, total_price ON pharmacy_order_items
    FOR EACH ROW EXECUTE FUNCTION public.pharmacy_typed_line_is_unpriced();
