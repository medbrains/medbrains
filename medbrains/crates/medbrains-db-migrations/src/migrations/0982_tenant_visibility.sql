-- Who a session may see, decided by the database rather than by the caller.
--
-- Until now every policy said the same flat thing: a row is visible when its
-- `tenant_id` equals the one the session claimed. That cannot express what a
-- hospital group actually is. One organisation runs two locations; whether a
-- clinician at one may see records from the other is a decision management
-- makes, and it differs between groups and changes over time.
--
-- The session still claims exactly one tenant — the location somebody is
-- working at. What that entitles them to see is derived here, from the group
-- the location belongs to and whether that group shares. The caller cannot
-- widen it: claiming a list of tenants would let any query grant itself the
-- whole group, so it claims an identity and the database answers with a scope.
--
-- With no group set, a location sees only itself. That is what every tenant
-- looks like today, so this migration changes no behaviour on the way in.

-- Management's switch. Off by default: sharing records between locations is a
-- decision somebody has to make, not one they inherit by upgrading.
ALTER TABLE public.hospital_groups
    ADD COLUMN IF NOT EXISTS share_across_branches BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.hospital_groups.share_across_branches IS
    'When true, locations in this group see one another''s records. Off by '
    'default; turning it on is a management decision about patient data.';

-- The tenant this session is working as, or NULL when it has not said.
--
-- NULL is the safe answer: it produces an empty visibility set below, so a
-- query that forgot to set the context returns nothing rather than everything.
CREATE OR REPLACE FUNCTION public.app_current_tenant()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid
$$;

-- Every tenant this session may read and write.
--
-- `STABLE` matters: it lets Postgres evaluate this once per statement rather
-- than once per row, which is the difference between a policy that is free and
-- one that makes every sequential scan a nested loop.
CREATE OR REPLACE FUNCTION public.app_visible_tenants()
RETURNS uuid[]
LANGUAGE sql
STABLE
AS $$
    SELECT CASE
        -- A location with no group, or in a group that does not share, sees
        -- only itself. This is the answer for every tenant today.
        WHEN me.group_id IS NULL OR NOT COALESCE(g.share_across_branches, false)
            THEN ARRAY[me.id]
        -- Otherwise: every active location in the same group.
        ELSE ARRAY(
            SELECT t.id FROM public.tenants t
             WHERE t.group_id = me.group_id AND t.is_active
        )
    END
    FROM public.tenants me
    LEFT JOIN public.hospital_groups g ON g.id = me.group_id
    WHERE me.id = public.app_current_tenant()
$$;

COMMENT ON FUNCTION public.app_visible_tenants() IS
    'Tenants the current session may see. Returns NULL when no tenant is set, '
    'which every policy treats as no rows.';

GRANT EXECUTE ON FUNCTION public.app_current_tenant() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_visible_tenants() TO PUBLIC;

-- Point every tenant-scoped policy at the function.
--
-- Only policies whose expression is one of the known flat tenant comparisons
-- are rewritten. Anything else — department checks, deliberate `true` — is
-- left exactly as it was, because this migration is about widening a
-- comparison, not about reviewing everybody's access rules.
--
-- `tenant_id IS NULL OR ...` is preserved where it appears: those tables hold
-- reference rows shared by every hospital, and dropping that half would hide
-- them from all of them.
DO $$
DECLARE
    r            RECORD;
    qual         TEXT;
    allows_null  BOOLEAN;
    visible      TEXT := 'tenant_id = ANY (public.app_visible_tenants())';
    read_expr    TEXT;
    write_expr   TEXT;
    rewritten    INT := 0;
    skipped      INT := 0;
BEGIN
    FOR r IN
        SELECT p.polname, c.relname, p.polcmd,
               pg_get_expr(p.polqual, p.polrelid)      AS using_expr,
               pg_get_expr(p.polwithcheck, p.polrelid) AS check_expr
          FROM pg_policy p
          JOIN pg_class c ON c.oid = p.polrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'
    LOOP
        -- An INSERT policy has no USING half, so read whichever it has.
        qual := regexp_replace(COALESCE(r.using_expr, r.check_expr), '\s+', ' ', 'g');
        allows_null := qual LIKE '%tenant_id IS NULL%';

        -- Every flat shape in this schema, normalised. Matched whole rather
        -- than by substring: a policy that merely mentions tenant_id alongside
        -- something else is not one of these and is left alone.
        IF qual IN (
            '((tenant_id)::text = current_setting(''app.tenant_id''::text, true))',
            '(tenant_id = (current_setting(''app.tenant_id''::text, true))::uuid)',
            '(tenant_id = (current_setting(''app.tenant_id''::text))::uuid)'
        ) THEN
            read_expr  := visible;
            write_expr := visible;
        ELSIF allows_null AND qual IN (
            '((tenant_id IS NULL) OR ((tenant_id)::text = current_setting(''app.tenant_id''::text, true)))',
            '((tenant_id IS NULL) OR (tenant_id = (current_setting(''app.tenant_id''::text))::uuid))',
            '((tenant_id IS NULL) OR (tenant_id = (current_setting(''app.tenant_id''::text, true))::uuid))'
        ) THEN
            -- Reference rows shared by every location stay readable; writing
            -- one is still confined to this session's own scope, so a caller
            -- cannot mint a global row by leaving the tenant off.
            read_expr  := '(tenant_id IS NULL OR ' || visible || ')';
            write_expr := visible;
        ELSE
            skipped := skipped + 1;
            CONTINUE;
        END IF;

        -- SELECT and DELETE take only USING; INSERT takes only WITH CHECK;
        -- UPDATE and ALL take both. Handing Postgres the wrong half is an
        -- error rather than a no-op, which is how this was found.
        IF r.polcmd IN ('r', 'd') THEN
            EXECUTE format('ALTER POLICY %I ON public.%I USING (%s)',
                           r.polname, r.relname, read_expr);
        ELSIF r.polcmd = 'a' THEN
            EXECUTE format('ALTER POLICY %I ON public.%I WITH CHECK (%s)',
                           r.polname, r.relname, write_expr);
        ELSE
            EXECUTE format('ALTER POLICY %I ON public.%I USING (%s) WITH CHECK (%s)',
                           r.polname, r.relname, read_expr, write_expr);
        END IF;

        rewritten := rewritten + 1;
    END LOOP;

    RAISE NOTICE 'tenant visibility: % policies rewritten, % left alone', rewritten, skipped;
END $$;
