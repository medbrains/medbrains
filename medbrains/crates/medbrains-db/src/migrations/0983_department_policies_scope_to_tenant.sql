-- Tables whose only access rule was the department, and the audit log's was
-- nothing at all.
--
-- Six tables — encounters among them — carried exactly one policy:
--
--     check_department_access(department_id)
--
-- and no tenant check whatsoever, despite every one of them having a
-- `tenant_id` column. That function returns TRUE when `app.user_department_ids`
-- is unset, which is the ordinary case for anybody not restricted to a
-- department. So the rule those tables were enforcing was, in practice, "allow
-- everything" — including rows belonging to other locations.
--
-- This has not been leaking, for a reason that is not reassuring: the
-- application connects as a superuser, so no policy on any table has been
-- enforced, and isolation has come entirely from `WHERE tenant_id` in the
-- queries themselves. The moment the application stops being a superuser,
-- every other table starts being protected and these six do not.
--
-- Department scoping is a narrowing *within* a hospital. It was never a
-- substitute for knowing which hospital, and here it is put back in its place.

DO $$
DECLARE
    r        RECORD;
    visible  TEXT := 'tenant_id = ANY (public.app_visible_tenants())';
    scoped   TEXT;
    fixed    INT := 0;
BEGIN
    FOR r IN
        SELECT p.polname, c.relname, p.polcmd,
               regexp_replace(pg_get_expr(p.polqual, p.polrelid), '\s+', ' ', 'g') AS expr
          FROM pg_policy p
          JOIN pg_class c ON c.oid = p.polrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'
           AND pg_get_expr(p.polqual, p.polrelid) = 'check_department_access(department_id)'
    LOOP
        scoped := format('(%s AND check_department_access(department_id))', visible);

        IF r.polcmd IN ('r', 'd') THEN
            EXECUTE format('ALTER POLICY %I ON public.%I USING (%s)',
                           r.polname, r.relname, scoped);
        ELSIF r.polcmd = 'a' THEN
            EXECUTE format('ALTER POLICY %I ON public.%I WITH CHECK (%s)',
                           r.polname, r.relname, scoped);
        ELSE
            EXECUTE format('ALTER POLICY %I ON public.%I USING (%s) WITH CHECK (%s)',
                           r.polname, r.relname, scoped, scoped);
        END IF;

        fixed := fixed + 1;
    END LOOP;

    RAISE NOTICE 'department-scoped policies now also check the tenant: %', fixed;
END $$;

-- The audit log read `USING (true)`: every hospital could read every other
-- hospital's audit trail, which is a record of who looked at which patient.
--
-- Reads are scoped. Writes deliberately are not: 45 triggers write here, and a
-- policy that can refuse an audit insert would fail the clinical operation
-- underneath it. An audit log that accepts a row it should not is a problem to
-- investigate; an audit log that can block a discharge is a problem in the
-- ward. All 12,348 existing rows already carry a tenant, so this narrows reads
-- without hiding anything that is there.
DO $$
DECLARE
    r        RECORD;
    visible  TEXT := 'tenant_id = ANY (public.app_visible_tenants())';
BEGIN
    FOR r IN
        SELECT p.polname, c.relname, p.polcmd
          FROM pg_policy p
          JOIN pg_class c ON c.oid = p.polrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'
           AND c.relname IN ('audit_log', 'audit_log_legacy', 'processed_webhooks')
           AND COALESCE(pg_get_expr(p.polqual, p.polrelid),
                        pg_get_expr(p.polwithcheck, p.polrelid)) = 'true'
    LOOP
        -- SELECT and DELETE take only USING; INSERT only WITH CHECK. An audit
        -- log's read half and write half genuinely differ, so each policy is
        -- given whichever halves it has.
        IF r.polcmd IN ('r', 'd') THEN
            EXECUTE format('ALTER POLICY %I ON public.%I USING (%s)',
                           r.polname, r.relname, visible);

        ELSIF r.polcmd = 'a' THEN
            -- Writes to the audit log are never refused: 45 triggers write
            -- there, and a policy that can block an audit insert would fail
            -- the clinical operation underneath it.
            IF r.relname LIKE 'audit_log%' THEN
                EXECUTE format('ALTER POLICY %I ON public.%I WITH CHECK (true)',
                               r.polname, r.relname);
            ELSE
                EXECUTE format('ALTER POLICY %I ON public.%I WITH CHECK (%s)',
                               r.polname, r.relname, visible);
            END IF;

        ELSE
            IF r.relname LIKE 'audit_log%' THEN
                EXECUTE format('ALTER POLICY %I ON public.%I USING (%s) WITH CHECK (true)',
                               r.polname, r.relname, visible);
            ELSE
                EXECUTE format('ALTER POLICY %I ON public.%I USING (%s) WITH CHECK (%s)',
                               r.polname, r.relname, visible, visible);
            END IF;
        END IF;
    END LOOP;
END $$;
