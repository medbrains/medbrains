-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- A service account must hold the service role, and only that.
--
-- The value itself was added in 0972; it could not be referenced there because
-- a new enum value is unusable until the transaction that added it commits.
--
-- ## What this closes
--
-- `is_bypass_role` in `middleware/authorization.rs` returns true for
-- `super_admin` and `hospital_admin`, and `require_permission` then returns
-- `Ok(())` for every permission without consulting the list. An API key whose
-- identity held either role would therefore hold *everything*, no matter what
-- its `permissions` column said.
--
-- Pinning to exactly `service_account` — rather than only excluding the two
-- bypass roles — also keeps a key from quietly inheriting the scope rules that
-- attach to clinical roles elsewhere, and keeps machines out of any report
-- that counts staff by role.
--
-- Enforced in the database because the alternative is trusting that every
-- future path which sets `users.role` remembers. A privilege escalation that
-- needs one forgotten UPDATE is not a risk worth carrying in code alone.

DO $$ BEGIN
    ALTER TABLE public.users
        ADD CONSTRAINT users_service_accounts_hold_the_service_role
        CHECK (is_service_account = (role = 'service_account'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON CONSTRAINT users_service_accounts_hold_the_service_role ON public.users IS
    'A service account holds the service role and nothing else: a bypass role here would defeat its API key''s permission list.';
