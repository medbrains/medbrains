-- A bed the hospital owns but the board cannot see is not a bed.
--
-- `bed_states` is derived: exactly one row per `locations` row at level
-- 'bed'. Three code paths created bed locations and only two of them
-- remembered to derive the state row — `create_location` did, `add ward bed
-- mapping` did, and the CSV bulk import did not. A hospital adding beds one
-- at a time through the UI got a working board; a hospital importing its bed
-- list at go-live, which is what anyone with two hundred beds does, got a
-- board that stayed empty forever.
--
-- This dev database is in exactly that state: 28 bed locations, 0 bed_states,
-- 8 admitted patients and a bed dashboard that answers `[]`. An empty board
-- reads as "this hospital has no beds", not as "the beds were never
-- registered", so nobody looking at it would know to go and fix it.
--
-- The invariant is enforced once, in the database, rather than a fourth
-- reminder to remember it. That also covers the path that actually produced
-- this state: rows inserted directly by a seed, which no handler-side guard
-- can ever reach.

CREATE OR REPLACE FUNCTION public.ensure_bed_state()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.level = 'bed'::public.location_level THEN
        INSERT INTO public.bed_states (tenant_id, location_id)
        VALUES (NEW.tenant_id, NEW.id)
        ON CONFLICT (tenant_id, location_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS locations_ensure_bed_state ON public.locations;

-- INSERT and UPDATE both: a location promoted to 'bed' after the fact needs
-- its state row just as much as one born that way.
CREATE TRIGGER locations_ensure_bed_state
    AFTER INSERT OR UPDATE OF level ON public.locations
    FOR EACH ROW
    EXECUTE FUNCTION public.ensure_bed_state();

-- Backfill every bed location that never got one. Soft-deleted locations are
-- skipped: a retired bed should not reappear on the board.
INSERT INTO public.bed_states (tenant_id, location_id)
SELECT l.tenant_id, l.id
FROM public.locations l
WHERE l.level = 'bed'::public.location_level
  AND l.deleted_at IS NULL
ON CONFLICT (tenant_id, location_id) DO NOTHING;
