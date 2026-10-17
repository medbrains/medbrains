-- Convert the PHI-access and security audit tables to monthly partitions (#302).
--
-- RUN IN A MAINTENANCE WINDOW. Each table is rebuilt under an exclusive lock:
-- while access_log converts, every audited request waits for it (writes are
-- logged per request). Take a backup first; the whole script is one
-- transaction, so a failure changes nothing.
--
--   make partition-audit-tables DATABASE_URL=postgres://owner@host/db
--
-- Safe to re-run: a table already partitioned is reported and left alone.

\set ON_ERROR_STOP on
BEGIN;
-- Give up rather than queue behind a long transaction holding the table.
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60min';

SELECT partition_table_monthly('break_glass_events', 'created_at');
SELECT partition_table_monthly('security_access_logs', 'accessed_at');
SELECT partition_table_monthly('access_log', 'created_at');
-- Default partitions + a year of months ahead, with RLS, from here on daily.
SELECT ensure_partitions_with_rls();

SELECT c.relname AS parent, count(i.inhrelid) AS partitions
  FROM pg_class c LEFT JOIN pg_inherits i ON i.inhparent = c.oid
 WHERE c.relname IN ('access_log', 'security_access_logs', 'break_glass_events')
 GROUP BY c.relname ORDER BY 1;
COMMIT;
