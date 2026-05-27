-- Global soft-delete guardrails.
--
-- This converts accidental application-level DELETE statements into
-- soft-delete updates for existing public tables. Controlled physical
-- deletion remains possible only when a maintenance session explicitly sets:
--   SET LOCAL app.allow_physical_delete = 'true';

CREATE OR REPLACE FUNCTION public.soft_delete_guardrail()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    user_uuid uuid;
    set_clause text;
BEGIN
    IF current_setting('app.allow_physical_delete', true) = 'true' THEN
        RETURN OLD;
    END IF;

    user_uuid := NULLIF(current_setting('app.user_id', true), '')::uuid;
    set_clause :=
        'deleted_at = COALESCE(deleted_at, now()), ' ||
        'deleted_by = COALESCE(deleted_by, $1), ' ||
        'delete_reason = COALESCE(delete_reason, $2)';

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = TG_TABLE_SCHEMA
          AND table_name = TG_TABLE_NAME
          AND column_name = 'updated_at'
    ) THEN
        set_clause := set_clause || ', updated_at = now()';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = TG_TABLE_SCHEMA
          AND table_name = TG_TABLE_NAME
          AND column_name = 'is_active'
    ) THEN
        set_clause := set_clause || ', is_active = false';
    END IF;

    EXECUTE format(
        'UPDATE %I.%I SET %s WHERE ctid = $3 AND deleted_at IS NULL',
        TG_TABLE_SCHEMA,
        TG_TABLE_NAME,
        set_clause
    )
    USING user_uuid, 'Soft deleted by database guardrail', OLD.ctid;

    RETURN NULL;
END;
$$;

DO $$
DECLARE
    row record;
    trigger_name text;
    legacy_trigger_name text;
BEGIN
    FOR row IN
        SELECT c.relname AS table_name
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r', 'p')
          AND c.relname NOT IN ('_sqlx_migrations', 'spatial_ref_sys')
          AND NOT EXISTS (
              SELECT 1
              FROM pg_inherits i
              WHERE i.inhrelid = c.oid
          )
        ORDER BY c.relname
    LOOP
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_at timestamptz', row.table_name);
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_by uuid', row.table_name);
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS delete_reason text', row.table_name);
        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS %I ON public.%I (deleted_at)',
            left('idx_' || row.table_name || '_deleted_at_' || substr(md5(row.table_name), 1, 8), 63),
            row.table_name
        );

        legacy_trigger_name := 'trg_' || row.table_name || '_prevent_delete';
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', legacy_trigger_name, row.table_name);

        trigger_name := left(
            'trg_' || row.table_name || '_soft_delete_' || substr(md5(row.table_name), 1, 8),
            63
        );
        IF NOT EXISTS (
            SELECT 1
            FROM pg_trigger
            WHERE tgname = trigger_name
        ) THEN
            EXECUTE format(
                'CREATE TRIGGER %I BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail()',
                trigger_name,
                row.table_name
            );
        END IF;
    END LOOP;
END $$;
