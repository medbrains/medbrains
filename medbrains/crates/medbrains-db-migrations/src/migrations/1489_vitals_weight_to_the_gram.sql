-- ====================================================================
-- Migration: 1489_vitals_weight_to_the_gram.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- A preterm baby is dosed per kilogram, so its weight is kept to the gram.
-- vitals.weight_kg was numeric(5,2): 10 g steps, and the recorder rounded to
-- 100 g before that (8% of a 1.2 kg baby). Dropping the typmod is a catalogue
-- change in PostgreSQL, not a table rewrite: every stored value is already a
-- valid unconstrained numeric. patients.weight_kg is already unconstrained.
--
-- The sign-every-record guard (1418) is a trigger "BEFORE UPDATE OF ...,
-- weight_kg", which blocks a type change. It is dropped and put back from its
-- own definition, read from the catalogue, so it returns exactly as it was.

DO $$
DECLARE
    guard text;
BEGIN
    SELECT pg_get_triggerdef(oid) INTO guard FROM pg_trigger
     WHERE tgrelid = 'public.vitals'::regclass AND tgname = 'trg_vitals_signable_edit';
    IF guard IS NOT NULL THEN
        DROP TRIGGER trg_vitals_signable_edit ON public.vitals;
    END IF;
    ALTER TABLE public.vitals ALTER COLUMN weight_kg TYPE numeric;
    IF guard IS NOT NULL THEN
        EXECUTE guard;
    END IF;
END
$$;
