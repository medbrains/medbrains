-- The background worker's role, which is allowed to cross tenants.
--
-- `medbrains-outbox` already checks for this at boot and refuses to start
-- without it:
--
--     "connected as a non-BYPASSRLS role. Worker must connect as
--      medbrains_outbox_worker (see migration 130).
--      Refusing to start to prevent silent tenant filtering."
--
-- That role was never created. Migration 130 is about devices, and no
-- migration in this schema has ever created a role — so the check has been
-- passing only because everything connects as a superuser, which bypasses row
-- level security for a different reason than the one intended.
--
-- The worker genuinely needs to cross tenants: it drains one queue on behalf
-- of every hospital, and has no request to take a tenant from. That is a
-- deliberate exception, and this is what makes it an exception rather than the
-- rule. Everything else uses `medbrains_app`, which row level security applies
-- to.
--
-- The worker is confined in the other direction instead: it may read and write
-- rows, and nothing else. It cannot change the schema, cannot alter a policy,
-- and cannot create another role that bypasses anything.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'medbrains_outbox_worker') THEN
        CREATE ROLE medbrains_outbox_worker LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
            NOINHERIT NOREPLICATION BYPASSRLS;
    ELSE
        ALTER ROLE medbrains_outbox_worker NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS;
    END IF;
END $$;

GRANT USAGE ON SCHEMA public TO medbrains_outbox_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO medbrains_outbox_worker;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO medbrains_outbox_worker;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO medbrains_outbox_worker;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO medbrains_outbox_worker;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO medbrains_outbox_worker;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO medbrains_outbox_worker;
