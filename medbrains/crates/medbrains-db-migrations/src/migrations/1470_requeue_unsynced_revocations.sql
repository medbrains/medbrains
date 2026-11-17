-- ====================================================================
-- Migration: 1470_requeue_unsynced_revocations.sql
-- RLS-Posture: tenant-scoped (existing table; policies unchanged)
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Queue for SpiceDB every revocation that never reached it (#6028).
--
-- Two paths revoked a tuple in relation_tuples without queueing the matching
-- delete in SpiceDB: ending a break-glass session, and any revocation of a raw
-- schema relation (dept_member, ward_member, ...), which the outbox marked
-- 'skipped'. SpiceDB kept answering yes for those grants. Re-queue them; the
-- outbox now deletes raw relations by name, and a SpiceDB delete of a
-- relationship that is already gone is a no-op, so this is safe to replay.
-- Role subjects are never written to SpiceDB and stay skipped.

UPDATE relation_tuples
   SET spicedb_sync_status = 'pending',
       spicedb_next_attempt_at = now(),
       spicedb_last_error = NULL
 WHERE status = 'revoked'
   AND subject_type <> 'role'
   AND (
        spicedb_sync_status = 'skipped'
        OR (spicedb_sync_status = 'applied'
            AND (spicedb_synced_at IS NULL OR spicedb_synced_at < revoked_at))
   );
