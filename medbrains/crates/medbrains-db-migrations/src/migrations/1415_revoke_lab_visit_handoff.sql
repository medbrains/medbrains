-- ====================================================================
-- Migration: 1415_revoke_lab_visit_handoff.sql
-- RLS-Posture: not-applicable
-- Tenant-Column: N/A
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Take back the visits handed to the laboratory (Pathology department).
--
-- Raising a lab order (from the doctor, the order basket, the lab desk, an
-- add-on or a patient app request) wrote a `handoff:PATHOLOGY` tuple on the
-- whole ENCOUNTER. It had no expiry, and through the encounter edge it opened
-- the patient's full record (notes, diagnoses, documents) to everyone in the
-- laboratory, for ever. The code now hands the lab the ORDER instead
-- (`lab_order#dept_member`), and every lab route checks the order
-- (`links::LAB_ORDER`: the patient's care team, or the order's own holders).
--
-- Orders raised before this change have no order tuple, so they are handed to
-- the laboratory here, one per order whose visit had been handed over, before
-- the visit tuples are revoked. Open work keeps working; nothing else does.
--
-- Revoked, not deleted, so the grant history stays; marked pending so the
-- SpiceDB outbox removes the same relationships there (and writes the new
-- order tuples).

INSERT INTO relation_tuples (
    tuple_id, tenant_id, object_type, object_id, relation,
    subject_type, subject_id, granted_by, granted_reason, source
)
SELECT gen_random_uuid(), lo.tenant_id, 'lab_order', lo.id, 'dept_member',
       'department', h.subject_id, h.granted_by, 'handoff:PATHOLOGY', 'explicit'
  FROM relation_tuples h
  JOIN lab_orders lo
    ON lo.tenant_id = h.tenant_id AND lo.encounter_id = h.object_id
 WHERE h.object_type = 'encounter'
   AND h.relation = 'dept_member'
   AND h.subject_type = 'department'
   AND h.granted_reason = 'handoff:PATHOLOGY'
   AND h.status = 'active'
   AND NOT EXISTS (
       SELECT 1 FROM relation_tuples t
        WHERE t.tenant_id = lo.tenant_id
          AND t.object_type = 'lab_order' AND t.object_id = lo.id
          AND t.relation = 'dept_member' AND t.subject_type = 'department'
          AND t.subject_id = h.subject_id AND t.status = 'active'
   );

UPDATE relation_tuples
   SET status = 'revoked',
       revoked_at = now(),
       spicedb_sync_status = 'pending',
       spicedb_next_attempt_at = now(),
       spicedb_last_error = NULL
 WHERE object_type = 'encounter'
   AND relation = 'dept_member'
   AND granted_reason = 'handoff:PATHOLOGY'
   AND status = 'active';
