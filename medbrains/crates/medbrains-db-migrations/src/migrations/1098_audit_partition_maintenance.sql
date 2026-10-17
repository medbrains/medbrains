-- ====================================================================
-- Migration: 1098_audit_partition_maintenance.sql
-- RLS-Posture: not-applicable
-- Tenant-Column: N/A
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Audit tables are partitioned by month and kept, never purged (#302).
--
-- 1. `partition_config` was empty, so the daily `ensure_partitions()` made
--    nothing. `audit_log`'s months were created once, up to 2027-07; after
--    that every audit row would have fallen into its default partition (the
--    legacy archive), unpruned and unarchivable by month. The audit tables
--    are registered here (no retention — legal hold) and the job runs now.
-- 2. `audit_log`'s existing months are named `audit_log_YYYY_MM`, not the
--    job's `audit_log_pYYYYMM`. Creating a month that an existing partition
--    already covers is now skipped instead of aborting the whole job.
-- 3. `partition_table_monthly()` converts a plain table into a monthly
--    partitioned one. It is defined here but NOT run: converting a busy table
--    rebuilds it under an exclusive lock, so it runs in a maintenance window
--    (scripts/maintenance/partition-audit-tables.sql), not at startup.

CREATE OR REPLACE FUNCTION public.ensure_partitions() RETURNS void
    LANGUAGE plpgsql
    AS $_$
DECLARE
    cfg          record;
    is_parent    boolean;
    step         interval;
    name_fmt     text;
    base         date;
    p_start      date;
    p_end        date;
    child        text;
    i            integer;
    cutoff       date;
    child_rec    record;
    child_period date;
BEGIN
    FOR cfg IN SELECT * FROM partition_config LOOP
        SELECT (c.relkind = 'p') INTO is_parent
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = cfg.table_name AND n.nspname = 'public';
        IF is_parent IS NOT TRUE THEN
            CONTINUE;
        END IF;

        IF cfg.partition_interval = 'year' THEN
            step := interval '1 year';
            name_fmt := 'YYYY';
            base := date_trunc('year', now())::date;
        ELSE
            step := interval '1 month';
            name_fmt := 'YYYYMM';
            base := date_trunc('month', now())::date;
        END IF;

        -- Current + premake future partitions. A range some partition already
        -- covers (whatever it is called) is left alone.
        FOR i IN 0 .. cfg.premake LOOP
            p_start := base + (step * i);
            p_end   := p_start + step;
            child   := format('%s_p%s', cfg.table_name, to_char(p_start, name_fmt));
            BEGIN
                EXECUTE format(
                    'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
                    child, cfg.table_name, p_start::text, p_end::text);
            EXCEPTION
                WHEN invalid_object_definition THEN NULL;  -- overlaps an existing partition
                WHEN check_violation THEN
                    RAISE WARNING 'ensure_partitions: % has rows for % in its default partition; month not created',
                        cfg.table_name, p_start;
            END;
        END LOOP;

        -- DEFAULT safety net so an insert never fails for an un-created range,
        -- unless the table already has one (audit_log's is its legacy archive).
        -- Made after the months, so it never holds rows for a month made above.
        IF (SELECT partdefid FROM pg_partitioned_table
             WHERE partrelid = format('public.%I', cfg.table_name)::regclass) = 0 THEN
            EXECUTE format('CREATE TABLE %I PARTITION OF %I DEFAULT',
                           cfg.table_name || '_default', cfg.table_name);
        END IF;

        IF cfg.retention_months IS NOT NULL THEN
            cutoff := date_trunc('month', now())::date
                      - make_interval(months => cfg.retention_months);
            FOR child_rec IN
                SELECT c.relname
                FROM pg_inherits inh
                JOIN pg_class c ON c.oid = inh.inhrelid
                JOIN pg_class p ON p.oid = inh.inhparent
                JOIN pg_namespace n ON n.oid = p.relnamespace
                WHERE p.relname = cfg.table_name
                  AND n.nspname = 'public'
                  AND c.relname ~ ('^' || cfg.table_name || '_p[0-9]+$')
            LOOP
                BEGIN
                    IF cfg.partition_interval = 'year' THEN
                        child_period := to_date(right(child_rec.relname, 4), 'YYYY');
                    ELSE
                        child_period := to_date(right(child_rec.relname, 6), 'YYYYMM');
                    END IF;
                EXCEPTION WHEN others THEN
                    CONTINUE;
                END;

                IF (child_period + step) <= cutoff THEN
                    IF cfg.retention_action = 'drop' THEN
                        EXECUTE format('DROP TABLE IF EXISTS %I', child_rec.relname);
                    ELSE
                        EXECUTE format('ALTER TABLE %I DETACH PARTITION %I',
                                       cfg.table_name, child_rec.relname);
                    END IF;
                END IF;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;

-- PHI-access and security audit: a year of months made ahead, nothing retired.
INSERT INTO partition_config (table_name, partition_column, partition_interval, premake, retention_months)
VALUES ('audit_log', 'created_at', 'month', 12, NULL),
       ('access_log', 'created_at', 'month', 12, NULL),
       ('break_glass_events', 'created_at', 'month', 12, NULL),
       ('security_access_logs', 'accessed_at', 'month', 12, NULL)
ON CONFLICT (table_name) DO NOTHING;

SELECT ensure_partitions_with_rls();

-- Convert `p_table` to monthly RANGE partitions on `p_column`, keeping every
-- row, index, policy, trigger, grant and comment. The primary key becomes
-- (id, p_column), as partitioning requires. One transaction: on any failure
-- nothing has changed. Idempotent: a table already partitioned is left alone.
CREATE OR REPLACE FUNCTION public.partition_table_monthly(p_table text, p_column text)
    RETURNS text
    LANGUAGE plpgsql
    AS $_$
DECLARE
    old         text := p_table || '_unpartitioned';
    index_defs  text[];
    policy_defs text[];
    trigger_defs text[];
    grants      text[];
    rls         boolean;
    force_rls   boolean;
    tbl_comment text;
    r           record;
    month       date;
    last_month  date;
    n_old       bigint;
    n_new       bigint;
    stmt        text;
BEGIN
    IF to_regclass(p_table) IS NULL THEN
        RAISE EXCEPTION 'partition_table_monthly: no table %', p_table;
    END IF;
    IF (SELECT relkind FROM pg_class WHERE oid = to_regclass(p_table)) = 'p' THEN
        RETURN p_table || ': already partitioned';
    END IF;
    EXECUTE format('LOCK TABLE %I IN ACCESS EXCLUSIVE MODE', p_table);

    -- What the table carries, captured while it still has its own name.
    SELECT array_agg(pg_get_indexdef(i.indexrelid)) INTO index_defs
      FROM pg_index i WHERE i.indrelid = to_regclass(p_table) AND NOT i.indisprimary;
    SELECT array_agg(format('CREATE POLICY %I ON %I AS %s FOR %s TO %s%s%s',
                            policyname, p_table, permissive, cmd, array_to_string(roles, ', '),
                            CASE WHEN qual IS NULL THEN '' ELSE ' USING (' || qual || ')' END,
                            CASE WHEN with_check IS NULL THEN '' ELSE ' WITH CHECK (' || with_check || ')' END))
      INTO policy_defs FROM pg_policies WHERE schemaname = 'public' AND tablename = p_table;
    SELECT array_agg(pg_get_triggerdef(t.oid)) INTO trigger_defs
      FROM pg_trigger t WHERE t.tgrelid = to_regclass(p_table) AND NOT t.tgisinternal;
    SELECT array_agg(format('GRANT %s ON %I TO %I', a.privilege_type, p_table, pg_get_userbyid(a.grantee)))
      INTO grants
      FROM pg_class c, aclexplode(c.relacl) a
     WHERE c.oid = to_regclass(p_table) AND a.grantee <> c.relowner AND a.grantee <> 0;
    SELECT relrowsecurity, relforcerowsecurity INTO rls, force_rls FROM pg_class WHERE oid = to_regclass(p_table);
    tbl_comment := obj_description(to_regclass(p_table), 'pg_class');

    -- Move the old table and its index names out of the way.
    EXECUTE format('ALTER TABLE %I RENAME TO %I', p_table, old);
    FOR r IN SELECT c.relname FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
              WHERE i.indrelid = to_regclass(old) LOOP
        EXECUTE format('ALTER INDEX %I RENAME TO %I', r.relname, left(r.relname, 55) || '_unpart');
    END LOOP;

    EXECUTE format('CREATE TABLE %I (LIKE %I INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING GENERATED '
                   'INCLUDING COMMENTS INCLUDING STORAGE) PARTITION BY RANGE (%I)', p_table, old, p_column);
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I PRIMARY KEY (id, %I)', p_table, p_table || '_pkey', p_column);
    IF tbl_comment IS NOT NULL THEN
        EXECUTE format('COMMENT ON TABLE %I IS %L', p_table, tbl_comment);
    END IF;

    -- A month for every month that has rows, and a year ahead.
    EXECUTE format('SELECT date_trunc(''month'', min(%I))::date FROM %I', p_column, old) INTO month;
    month := least(coalesce(month, date_trunc('month', now())::date), date_trunc('month', now())::date);
    last_month := date_trunc('month', now())::date + interval '12 months';
    WHILE month <= last_month LOOP
        EXECUTE format('CREATE TABLE %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
                       p_table || '_p' || to_char(month, 'YYYYMM'), p_table,
                       month::text, (month + interval '1 month')::date::text);
        month := (month + interval '1 month')::date;
    END LOOP;
    EXECUTE format('CREATE TABLE %I PARTITION OF %I DEFAULT', p_table || '_default', p_table);

    FOREACH stmt IN ARRAY coalesce(index_defs, '{}') LOOP EXECUTE stmt; END LOOP;

    -- Rows before triggers, so copying does not fire them.
    EXECUTE format('INSERT INTO %I SELECT * FROM %I', p_table, old);
    EXECUTE format('SELECT count(*) FROM %I', old) INTO n_old;
    EXECUTE format('SELECT count(*) FROM %I', p_table) INTO n_new;
    IF n_old <> n_new THEN
        RAISE EXCEPTION 'partition_table_monthly: % copied % of % rows', p_table, n_new, n_old;
    END IF;

    FOREACH stmt IN ARRAY coalesce(trigger_defs, '{}') LOOP EXECUTE stmt; END LOOP;
    FOREACH stmt IN ARRAY coalesce(grants, '{}') LOOP EXECUTE stmt; END LOOP;
    IF rls THEN
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', p_table);
    END IF;
    IF force_rls THEN
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', p_table);
    END IF;
    FOREACH stmt IN ARRAY coalesce(policy_defs, '{}') LOOP EXECUTE stmt; END LOOP;
    PERFORM apply_partition_rls();

    EXECUTE format('DROP TABLE %I', old);
    RETURN format('%s: %s rows into monthly partitions on %s', p_table, n_new, p_column);
END;
$_$;

COMMENT ON FUNCTION public.partition_table_monthly(text, text) IS
    'Rebuild a table as monthly RANGE partitions, keeping rows, indexes, policies, triggers, grants. Takes an exclusive lock: run in a maintenance window (scripts/maintenance/partition-audit-tables.sql).';
