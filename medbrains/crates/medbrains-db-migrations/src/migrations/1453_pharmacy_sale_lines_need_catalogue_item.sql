-- ====================================================================
-- Migration: 1453_pharmacy_sale_lines_need_catalogue_item.sql
-- RLS-Posture: not-applicable
-- Tenant-Column: N/A
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- No free text at OTC or POS (owner, 2026-11-09).
--
-- Every line sold or dispensed is a catalogue item: an OTC or POS sale line,
-- and every dispense, pick or camp dispense line. The server refuses a line
-- without one (`schedule_gate::require_catalogue_items`); this is the
-- database's backstop for any path that forgets.
--
-- Triggers, not CHECK ... NOT VALID: a NOT VALID check still runs on every
-- UPDATE of an old row, so cancelling, returning or soft-deleting a historic
-- free-text line would fail. These fire only when a new line is written or a
-- line's dispensed quantity goes up; history is read and corrected as before.
--
-- An order line may still be free text while it is only an order (a doctor's
-- off-formulary drug, a discharge summary's list): it is mapped to the
-- catalogue before anything leaves the shelf.

CREATE OR REPLACE FUNCTION public.pharmacy_line_requires_catalogue_item() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    sold boolean;
BEGIN
    IF NEW.catalog_item_id IS NOT NULL THEN
        RETURN NEW;
    END IF;
    -- Separate statements: a sale line has no quantity_dispensed to read.
    IF TG_TABLE_NAME = 'pharmacy_pos_sale_items' THEN
        sold := true;
    ELSIF TG_OP = 'UPDATE' THEN
        sold := NEW.quantity_dispensed > OLD.quantity_dispensed;
    ELSE
        sold := NEW.quantity_dispensed > 0 OR EXISTS (
            SELECT 1 FROM pharmacy_orders o
             WHERE o.id = NEW.order_id AND o.status = 'dispensed');
    END IF;
    IF sold THEN
        RAISE EXCEPTION 'Pick the item from the catalogue. If it is not there, ask a pharmacist to add it with its schedule.'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pos_sale_item_requires_catalogue ON pharmacy_pos_sale_items;
CREATE TRIGGER trg_pos_sale_item_requires_catalogue
    BEFORE INSERT ON pharmacy_pos_sale_items
    FOR EACH ROW EXECUTE FUNCTION public.pharmacy_line_requires_catalogue_item();

DROP TRIGGER IF EXISTS trg_order_item_dispensed_requires_catalogue ON pharmacy_order_items;
CREATE TRIGGER trg_order_item_dispensed_requires_catalogue
    BEFORE INSERT OR UPDATE OF quantity_dispensed ON pharmacy_order_items
    FOR EACH ROW EXECUTE FUNCTION public.pharmacy_line_requires_catalogue_item();
