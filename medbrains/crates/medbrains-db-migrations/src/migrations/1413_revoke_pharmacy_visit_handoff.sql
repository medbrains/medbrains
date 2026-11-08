-- ====================================================================
-- Migration: 1413_revoke_pharmacy_visit_handoff.sql
-- RLS-Posture: not-applicable
-- Tenant-Column: N/A
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Take back the visits handed to the Pharmacy department.
--
-- An OPD prescription reaching the Rx queue, and a prescription from the order
-- basket, wrote a `handoff:PHARMACY` tuple on the whole ENCOUNTER. It had no
-- expiry, and through the encounter edge it opened the patient's full record
-- (notes, diagnoses, documents) to everyone in the Pharmacy department, for
-- ever. The code no longer writes it: the Rx queue is scoped by the pharmacy's
-- own permission, and dispensing reads go through the narrow pharmacy gate
-- (`require_patient_pharmacy_access`: an open Rx-queue entry or a recent
-- pharmacy order). Handoffs on `pharmacy_order` stay: they are that gate.
--
-- Revoked, not deleted, so the grant history stays; marked pending so the
-- SpiceDB outbox removes the same relationships there.

UPDATE relation_tuples
   SET status = 'revoked',
       revoked_at = now(),
       spicedb_sync_status = 'pending',
       spicedb_next_attempt_at = now(),
       spicedb_last_error = NULL
 WHERE object_type = 'encounter'
   AND relation = 'dept_member'
   AND granted_reason = 'handoff:PHARMACY'
   AND status = 'active';
