-- ====================================================================
-- Migration: 1043_patient_department_access.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- A doctor's Patients directory lists the patients they hold a patient
-- tuple for, but a visit only ever linked the ENCOUNTER to its department:
-- the patient tuple the schema describes (patient#dept_member via the
-- patient's encounters) was never written. So the OPD queue showed a
-- department's 214 waiting patients while the same doctor's directory
-- read "No patients found". Each visit now links its patient to the
-- visit's department, once per department, as a derived tuple; the
-- SpiceDB outbox carries it like any other row.

CREATE OR REPLACE FUNCTION trg_encounters_patient_department_access()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_granted_by uuid;
BEGIN
    IF NEW.department_id IS NULL OR NEW.deleted_at IS NOT NULL THEN
        RETURN NULL;
    END IF;
    IF EXISTS (
        SELECT 1 FROM relation_tuples
         WHERE tenant_id = NEW.tenant_id
           AND object_type = 'patient' AND object_id = NEW.patient_id
           AND relation = 'dept_member' AND status = 'active'
           AND subject_type = 'department' AND subject_id = NEW.department_id::text
    ) THEN
        RETURN NULL;
    END IF;
    v_granted_by := coalesce(
        NEW.created_by,
        NEW.doctor_id,
        (SELECT registered_by FROM patients WHERE id = NEW.patient_id)
    );
    IF v_granted_by IS NULL THEN
        RAISE WARNING 'encounter % has no user to attribute its department grant to', NEW.id;
        RETURN NULL;
    END IF;
    INSERT INTO relation_tuples
        (tenant_id, object_type, object_id, relation, subject_type, subject_id,
         granted_by, granted_reason, source, derived_from)
    VALUES
        (NEW.tenant_id, 'patient', NEW.patient_id, 'dept_member', 'department',
         NEW.department_id::text, v_granted_by, 'seen in this department',
         'derived', 'encounters.department_id');
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_encounters_patient_department_access ON encounters;
CREATE TRIGGER trg_encounters_patient_department_access
    AFTER INSERT OR UPDATE OF department_id ON encounters
    FOR EACH ROW EXECUTE FUNCTION trg_encounters_patient_department_access();

-- Backfill: one tuple per (patient, department) the patient was seen in.
INSERT INTO relation_tuples
    (tenant_id, object_type, object_id, relation, subject_type, subject_id,
     granted_by, granted_reason, source, derived_from)
SELECT DISTINCT ON (e.tenant_id, e.patient_id, e.department_id)
       e.tenant_id, 'patient', e.patient_id, 'dept_member', 'department',
       e.department_id::text,
       coalesce(e.created_by, e.doctor_id, p.registered_by),
       'seen in this department', 'derived', 'encounters.department_id'
  FROM encounters e
  JOIN patients p ON p.id = e.patient_id
 WHERE e.department_id IS NOT NULL
   AND e.deleted_at IS NULL
   AND coalesce(e.created_by, e.doctor_id, p.registered_by) IS NOT NULL
   AND NOT EXISTS (
       SELECT 1 FROM relation_tuples t
        WHERE t.tenant_id = e.tenant_id
          AND t.object_type = 'patient' AND t.object_id = e.patient_id
          AND t.relation = 'dept_member' AND t.status = 'active'
          AND t.subject_type = 'department' AND t.subject_id = e.department_id::text
   )
 ORDER BY e.tenant_id, e.patient_id, e.department_id, e.created_at;
