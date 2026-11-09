-- ====================================================================
-- Migration: 1450_pharmacy_controlled_and_schedule_x_duplicate.sql
-- RLS-Posture: not-applicable
-- Tenant-Column: N/A
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- One meaning of "controlled", and the retained Schedule X duplicate.
--
-- 1. "Controlled" had three definitions: `is_controlled` alone (the dispense
--    witness gate, the pack-and-collect counter rule, the register posting at
--    dispense), `is_controlled OR schedule X/NDPS` (receipts, manual register
--    entries) and, on the dispense screen, `is_controlled OR X OR H1`. A
--    Schedule X drug entered without the flag was received onto the NDPS
--    register but dispensed without a witness and without a register entry.
--    The flag now follows from the schedule: a Schedule X or NDPS drug is
--    always controlled, so `is_controlled` alone is the one predicate.
--
-- 2. Drugs Rules 65(11): a Schedule X prescription is issued in duplicate and
--    the pharmacy retains one copy for two years. The dispense now records the
--    reference (scan id or serial, 6 to 120 characters) of the copy the
--    pharmacy kept.

UPDATE pharmacy_catalog
   SET is_controlled = true
 WHERE drug_schedule IN ('X', 'NDPS') AND NOT is_controlled;

CREATE OR REPLACE FUNCTION public.pharmacy_catalog_derive_controlled() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.drug_schedule IN ('X', 'NDPS') THEN
        NEW.is_controlled := true;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pharmacy_catalog_derive_controlled ON public.pharmacy_catalog;
CREATE TRIGGER trg_pharmacy_catalog_derive_controlled
    BEFORE INSERT OR UPDATE OF drug_schedule, is_controlled ON public.pharmacy_catalog
    FOR EACH ROW EXECUTE FUNCTION public.pharmacy_catalog_derive_controlled();

ALTER TABLE public.pharmacy_catalog
    DROP CONSTRAINT IF EXISTS pharmacy_catalog_schedule_x_ndps_controlled;
ALTER TABLE public.pharmacy_catalog
    ADD CONSTRAINT pharmacy_catalog_schedule_x_ndps_controlled
    CHECK (is_controlled OR drug_schedule IS NULL OR drug_schedule NOT IN ('X', 'NDPS'));

ALTER TABLE public.pharmacy_orders
    ADD COLUMN IF NOT EXISTS schedule_x_duplicate_ref text;
ALTER TABLE public.pharmacy_orders
    DROP CONSTRAINT IF EXISTS pharmacy_orders_schedule_x_duplicate_ref_check;
ALTER TABLE public.pharmacy_orders
    ADD CONSTRAINT pharmacy_orders_schedule_x_duplicate_ref_check
    CHECK (schedule_x_duplicate_ref IS NULL
           OR length(btrim(schedule_x_duplicate_ref)) BETWEEN 6 AND 120);
