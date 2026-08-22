-- The application's own database role, which row level security applies to.
--
-- Every tenant-scoped table in this schema carries a policy saying "only rows
-- belonging to the hospital this session claims to be". None of them were
-- doing anything: the application connects as a superuser, and Postgres skips
-- row level security for superusers entirely. The policies were correct and
-- inert, which is the worst combination — the protection reads as present in
-- the schema and is absent at runtime.
--
-- What that meant in practice: isolation between hospitals rested on every one
-- of ~2,500 queries remembering its own `WHERE tenant_id = $1`. One that
-- forgot returned every hospital's rows, with no error and nothing in a log.
--
-- This role is not a superuser and does not bypass row level security, so the
-- policies apply to it. It owns nothing and cannot change the schema; it can
-- only read and write rows, and only the rows its session is entitled to.
--
-- Migrations continue to run as the owner. Only the running application uses
-- this role.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'medbrains_app') THEN
        -- No password here: it is set per environment, by whoever deploys.
        CREATE ROLE medbrains_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
            NOINHERIT NOREPLICATION NOBYPASSRLS;
    ELSE
        -- Idempotent, and a repair: a role that has drifted into bypassing row
        -- level security is the exact problem this migration exists to fix.
        ALTER ROLE medbrains_app NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    END IF;
END $$;

GRANT USAGE ON SCHEMA public TO medbrains_app;

-- Rows only. No DDL, no ownership: an application that cannot drop a policy
-- cannot turn its own isolation off.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO medbrains_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO medbrains_app;

-- Some policies call helper functions — `check_department_access`, for one —
-- and a policy the role cannot execute is a policy that refuses every row.
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO medbrains_app;

-- Tables added by later migrations, so a new table is not silently unreadable
-- until somebody notices. Attached to the role that runs migrations.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO medbrains_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO medbrains_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO medbrains_app;
