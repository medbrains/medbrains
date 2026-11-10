-- ====================================================================
-- Migration: 1225_attendance_lateness.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Late arrivals are marked late.
--
-- attendance_records has had is_late and late_minutes since it was created,
-- and the HR attendance tab shows them, but no path ever wrote them: the HR
-- desk's manual entry and the staff "start shift" punch both inserted
-- check_in and left the flag false, so nobody was ever late.
--
-- Lateness is now worked out where every path meets, a trigger on the row:
-- the shift is the one on the record, else the employee's roster shift for
-- that day; the shift starts at its start time on the attendance date in the
-- hospital's timezone; a check-in more than 10 minutes after it is late.
-- No shift known means no judgement, never a guess.

CREATE OR REPLACE FUNCTION attendance_set_lateness() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    -- ponytail: fixed 10-minute grace for every hospital; make it a setting
    -- with a screen when a hospital asks for its own.
    grace CONSTANT integer := 10;
    shift_start time;
    tz text;
    minutes_late integer;
BEGIN
    NEW.is_late := false;
    NEW.late_minutes := 0;
    IF NEW.check_in IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT sd.start_time INTO shift_start
      FROM shift_definitions sd
     WHERE sd.id = NEW.shift_id AND sd.tenant_id = NEW.tenant_id;
    IF shift_start IS NULL THEN
        SELECT sd.start_time INTO shift_start
          FROM duty_rosters dr
          JOIN shift_definitions sd ON sd.id = dr.shift_id AND sd.tenant_id = dr.tenant_id
         WHERE dr.tenant_id = NEW.tenant_id AND dr.employee_id = NEW.employee_id
           AND dr.roster_date = NEW.attendance_date AND dr.deleted_at IS NULL
         ORDER BY sd.start_time
         LIMIT 1;
    END IF;
    IF shift_start IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(timezone, 'UTC') INTO tz FROM tenants WHERE id = NEW.tenant_id;
    minutes_late := floor(
        EXTRACT(EPOCH FROM (NEW.check_in AT TIME ZONE COALESCE(tz, 'UTC'))
                           - (NEW.attendance_date + shift_start)) / 60
    )::integer;
    IF minutes_late > grace THEN
        NEW.is_late := true;
        NEW.late_minutes := minutes_late;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attendance_lateness ON attendance_records;
CREATE TRIGGER trg_attendance_lateness
    BEFORE INSERT OR UPDATE OF check_in, shift_id, attendance_date ON attendance_records
    FOR EACH ROW EXECUTE FUNCTION attendance_set_lateness();

-- Judge the records already kept.
UPDATE attendance_records SET check_in = check_in WHERE check_in IS NOT NULL;
