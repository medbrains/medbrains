-- RLS-Posture: tenant-scoped (per table)
-- Tenant-Column: tenant_id
-- New-Tables: 0
-- Drops: none
-- Fill lab_results.numeric_value, which has never had a writer.
--
-- Four modules read this column as their only numeric feed from the
-- laboratory, and it has been NULL on every row since it was added:
--
--   * prescribing renal-dose CDS -- so no renal dose-adjustment alert has
--     ever fired, for any drug, silently
--   * radiology contrast screening -- so every patient screens as
--     "No recent eGFR on record", minutes after a renal panel is released
--   * chronic-care disease targets and the lab timeline -- never evaluated
--
-- Three separate handlers insert results and the next one would forget again,
-- exactly as `is_stat` was forgotten by six, so the rule lives with the data.
-- This also covers the seed fixtures and the device-ingest paths without
-- touching them.
--
-- The regex, not a bare cast: `value` is free text and holds things that are
-- not numbers -- "Reactive", "MRSA isolated", "<0.01" below a detection limit.
-- Those must stay NULL rather than fail the insert. Integer digits are capped
-- at 10 because the column is numeric(14,4); more than that would raise on
-- cast and turn a working result entry into an error. Extra decimal places
-- round, which is Postgres' own behaviour and is what a scale of 4 means.

CREATE OR REPLACE FUNCTION public.lab_results_sync_numeric_value()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
    NEW.numeric_value := CASE
        WHEN btrim(COALESCE(NEW.value, '')) ~ '^-?[0-9]{1,10}(\.[0-9]+)?$'
            THEN btrim(NEW.value)::numeric
        ELSE NULL
    END;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lab_results_sync_numeric_value
    BEFORE INSERT OR UPDATE OF value ON public.lab_results
    FOR EACH ROW
    EXECUTE FUNCTION public.lab_results_sync_numeric_value();

-- Backfill. Derived from `value` in the same row, which is what the
-- technologist actually typed -- a restatement, not a reconstruction.
UPDATE lab_results
   SET numeric_value = btrim(value)::numeric
 WHERE numeric_value IS NULL
   AND btrim(COALESCE(value, '')) ~ '^-?[0-9]{1,10}(\.[0-9]+)?$';
