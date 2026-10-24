-- ====================================================================
-- Migration: 1209_partition_maintenance_definer.sql
-- RLS-Posture: not-applicable
-- Tenant-Column: N/A
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- The daily partition job runs as the owner, whoever calls it.
--
-- The retention service calls `ensure_partitions_with_rls()` on the request
-- pool. Since that pool connects as `medbrains_app`, which owns nothing and
-- may not create tables, every call failed with "permission denied for
-- schema public": no month made ahead, none retired, and once audit_log's
-- premade months ran out every audit row would have fallen into its default
-- partition.
--
-- Creating and dropping partitions is the owner's work, so the wrapper now
-- runs as its owner. That is safe because it takes no arguments and does one
-- fixed thing: every name it builds comes from `partition_config` and the
-- catalogue, quoted with %I/%L. Two things keep a caller from steering it:
--
-- 1. search_path is pinned, with pg_temp last, so a temporary table called
--    `partition_config` cannot stand in for the real one.
-- 2. `partition_config` is read-only to both login roles. 1200 already took
--    write away from `medbrains_app`; `medbrains_outbox_worker` was given
--    write on every table by 0984 and keeps only read here. Otherwise a role
--    that could add a row could have the owner drop another table's months.
--
-- `ensure_partitions()` and `apply_partition_rls()` stay as they were: the
-- wrapper calls them under its own identity, and called directly they run
-- as the caller, who cannot do DDL.

CREATE OR REPLACE FUNCTION public.ensure_partitions_with_rls() RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    PERFORM public.ensure_partitions();
    PERFORM public.apply_partition_rls();
END $$;

REVOKE ALL ON FUNCTION public.ensure_partitions_with_rls() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_partitions_with_rls() TO medbrains_app;
GRANT EXECUTE ON FUNCTION public.ensure_partitions_with_rls() TO medbrains_outbox_worker;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.partition_config FROM medbrains_outbox_worker;
