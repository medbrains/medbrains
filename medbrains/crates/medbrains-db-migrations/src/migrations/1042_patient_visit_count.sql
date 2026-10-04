-- ====================================================================
-- Migration: 1042_patient_visit_count.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- A patient's visit count and last visit were never maintained: the
-- columns kept their registration defaults, so the patient page read
-- "Total visits 0" beside an active OPD visit (2,104 of 3,120 patients on
-- dev). The database keeps them true from the patient's live encounters,
-- whichever screen, import or job creates or retires one.

CREATE OR REPLACE FUNCTION patient_visit_totals_refresh(p_patient_id uuid)
RETURNS void
LANGUAGE sql
AS $$
    UPDATE patients p
       SET total_visits = v.total,
           last_visit_date = v.last_date
      FROM (
          SELECT count(*)::integer AS total, max(e.encounter_date) AS last_date
            FROM encounters e
           WHERE e.patient_id = p_patient_id
             AND e.deleted_at IS NULL
      ) v
     WHERE p.id = p_patient_id
       AND (p.total_visits IS DISTINCT FROM v.total
            OR p.last_visit_date IS DISTINCT FROM v.last_date);
$$;

CREATE OR REPLACE FUNCTION trg_encounters_patient_visit_totals()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.patient_id IS DISTINCT FROM NEW.patient_id THEN
        PERFORM patient_visit_totals_refresh(OLD.patient_id);
    END IF;
    PERFORM patient_visit_totals_refresh(NEW.patient_id);
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_encounters_patient_visit_totals ON encounters;
CREATE TRIGGER trg_encounters_patient_visit_totals
    AFTER INSERT OR UPDATE OF patient_id, deleted_at, encounter_date ON encounters
    FOR EACH ROW EXECUTE FUNCTION trg_encounters_patient_visit_totals();

-- Backfill every patient from the encounters already on file.
UPDATE patients p
   SET total_visits = coalesce(v.total, 0),
       last_visit_date = v.last_date
  FROM patients q
  LEFT JOIN (
      SELECT e.patient_id, count(*)::integer AS total, max(e.encounter_date) AS last_date
        FROM encounters e
       WHERE e.deleted_at IS NULL
       GROUP BY e.patient_id
  ) v ON v.patient_id = q.id
 WHERE p.id = q.id
   AND (p.total_visits IS DISTINCT FROM coalesce(v.total, 0)
        OR p.last_visit_date IS DISTINCT FROM v.last_date);
