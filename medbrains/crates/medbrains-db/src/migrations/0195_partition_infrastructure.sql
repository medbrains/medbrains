-- Partition infrastructure — app-managed declarative partitioning.
--
-- PostgreSQL is the single source of truth (YottaDB removed). High-volume,
-- append-mostly tables (audit/*_log, vitals, eMAR, lab results, notifications,
-- queue tokens, encounters) are RANGE-partitioned by a timestamp column so a
-- hospital can run for decades without a billion-row monolith.
--
-- Partitions are created + retired by `ensure_partitions()`, called on a daily
-- tick by the server's maintenance worker. No pg_partman / pg_cron extension is
-- required, so this runs on ANY PostgreSQL (managed RDS/Aurora/Cloud SQL or a
-- locked-down on-prem box) — portable by design.
--
-- To onboard a table: create it `PARTITION BY RANGE (<ts_col>)`, then INSERT a
-- row into `partition_config`. The worker pre-creates partitions and (optionally)
-- retires old ones. See RFC-DATA-INFRASTRUCTURE.md.

-- ── Registry of partitioned tables and their rules ──────────────────────────
-- Global infra config (not tenant-scoped, no RLS) — like reference tables.
CREATE TABLE IF NOT EXISTS partition_config (
    table_name         text PRIMARY KEY,
    -- The RANGE partition key column on the table (e.g. 'created_at').
    partition_column   text NOT NULL,
    -- Partition granularity.
    partition_interval text NOT NULL DEFAULT 'month'
        CHECK (partition_interval IN ('month', 'year')),
    -- How many future partitions to keep pre-created ahead of "now".
    premake            integer NOT NULL DEFAULT 3
        CHECK (premake BETWEEN 1 AND 24),
    -- NULL = keep forever. Else partitions whose range ends before
    -- (now - retention_months) are retired.
    retention_months   integer
        CHECK (retention_months IS NULL OR retention_months > 0),
    -- 'detach' keeps the data as a standalone table for archival/legal hold;
    -- 'drop' deletes it. Regulated clinical data should use 'detach'.
    retention_action   text NOT NULL DEFAULT 'detach'
        CHECK (retention_action IN ('detach', 'drop')),
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS partition_config_set_updated_at ON partition_config;
CREATE TRIGGER partition_config_set_updated_at
    BEFORE UPDATE ON partition_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── The partition manager ───────────────────────────────────────────────────
-- Idempotent: pre-creates current + `premake` future partitions for every
-- registered parent, plus a DEFAULT safety-net partition, then retires old ones
-- per the retention policy. Safe to call repeatedly (every CREATE is IF NOT
-- EXISTS). Skips any registered table that isn't actually a partitioned parent.
CREATE OR REPLACE FUNCTION ensure_partitions() RETURNS void
LANGUAGE plpgsql AS $$
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
        -- Only operate on genuine partitioned parents (relkind 'p').
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

        -- DEFAULT safety net so an insert never fails for an un-created range.
        child := format('%s_default', cfg.table_name);
        EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF %I DEFAULT',
                       child, cfg.table_name);

        -- Current + premake future partitions.
        FOR i IN 0 .. cfg.premake LOOP
            p_start := base + (step * i);
            p_end   := p_start + step;
            child   := format('%s_p%s', cfg.table_name, to_char(p_start, name_fmt));
            EXECUTE format(
                'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
                child, cfg.table_name, p_start::text, p_end::text);
        END LOOP;

        -- Retention: retire partitions whose range ends before the cutoff.
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
                    CONTINUE;  -- name didn't parse as a period; leave it alone
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
$$;

COMMENT ON FUNCTION ensure_partitions() IS
    'Pre-creates current + premake future partitions and retires old ones for '
    'every table in partition_config. Called daily by the maintenance worker.';
