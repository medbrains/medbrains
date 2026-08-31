-- RLS-Posture: tenant-scoped (per table)
-- Tenant-Column: tenant_id
-- New-Tables: 0
-- Drops: none
-- Make lab_orders.is_stat true, and keep it true, for STAT orders.
--
-- `is_stat` has readers on four surfaces -- the doctor sign workspace, the
-- telehealth pending-signoff list, and two mobile lab screens -- and no writer
-- anywhere. It has been false on every row since the column was added, so a
-- STAT investigation has never once been labelled STAT to the clinician
-- triaging the list.
--
-- Setting it in the create-order handler would fix only the two paths that go
-- through it. Four more insert lab_orders directly -- camp, order sets, the
-- simulator and the seed fixtures -- and the next one written will forget
-- again, because the column duplicates a fact `priority` already holds. So the
-- rule lives with the data instead of in each caller.
--
-- The backfill invents nothing: unlike a verification signature or a sample
-- barcode, a redundant boolean restated from an authoritative column in the
-- same row is a restatement, not a reconstruction.

CREATE OR REPLACE FUNCTION public.lab_orders_sync_is_stat()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
    NEW.is_stat := (NEW.priority = 'stat'::lab_priority);
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lab_orders_sync_is_stat
    BEFORE INSERT OR UPDATE OF priority ON public.lab_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.lab_orders_sync_is_stat();

UPDATE lab_orders
   SET is_stat = (priority = 'stat'::lab_priority)
 WHERE is_stat IS DISTINCT FROM (priority = 'stat'::lab_priority);
