-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- Give each API key an identity of its own.
--
-- ## The problem this solves
--
-- 99 foreign keys point `created_by` at `users`, and 1,056 places read
-- `claims.sub`. A machine calling the API therefore has to be *somebody*: there
-- is no way to write a row without naming a user.
--
-- The tempting shortcut is to reuse the person who created the key. It
-- satisfies the constraints and it lies — every row an integration writes at
-- 3am is attributed to a clinician who was asleep, and an audit asking "who
-- changed this" gets a name instead of an answer.
--
-- ## What this does instead
--
-- Both, because they answer different questions:
--
--   * **the key acts as itself.** Each key gets a `users` row of its own, so
--     `created_by` resolves and the audit trail says "Lab Integration".
--   * **the key remembers who made it.** `api_keys.created_by` already holds
--     the responsible human, so every machine action still walks back to a
--     person — one step further, and truthfully.
--
-- ## Why a service account must not be able to log in
--
-- A shadow user is a real row in `users`. Left alone it would be a credential
-- with no password — and `password_hash` being NULL currently produces "this
-- account signs in with single sign-on", which for a service account is both
-- untrue and an invitation.
--
-- So the exclusion is positive rather than incidental. `is_service_account`
-- is checked by the login paths, which is a rule somebody can read, rather
-- than resting on a NULL that a future migration might backfill.
--
-- A boolean rather than a `user_role` enum value on purpose: `ALTER TYPE ...
-- ADD VALUE` cannot be used in the same transaction that references it, and
-- sqlx runs each migration in one.

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS is_service_account boolean DEFAULT false NOT NULL;

COMMENT ON COLUMN public.users.is_service_account IS
    'The identity behind an API key. Cannot sign in by any route, and is hidden from user pickers.';

-- Every login path must exclude these, so the partial index both serves the
-- lookup and documents the intent.
CREATE INDEX IF NOT EXISTS idx_users_human
    ON public.users (tenant_id, username)
    WHERE is_service_account = false AND deleted_at IS NULL;

ALTER TABLE public.api_keys
    ADD COLUMN IF NOT EXISTS service_user_id uuid;

DO $$ BEGIN
    ALTER TABLE public.api_keys
        ADD CONSTRAINT api_keys_service_user_fkey
        FOREIGN KEY (service_user_id) REFERENCES public.users (id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- One key, one identity. Sharing a service user between keys would make the
-- audit trail ambiguous about which key acted, which is the whole reason the
-- identity exists.
CREATE UNIQUE INDEX IF NOT EXISTS uq_api_keys_service_user
    ON public.api_keys (service_user_id)
    WHERE service_user_id IS NOT NULL;

COMMENT ON COLUMN public.api_keys.service_user_id IS
    'The users row this key acts as. Writes attribute here; api_keys.created_by names the human responsible.';

-- A service account holds no permissions of its own.
--
-- Its role would otherwise grant whatever that role grants, and the key would
-- silently widen when the role did — which is exactly what carrying an
-- explicit permission list on the key was meant to prevent. The permissions
-- come from `api_keys.permissions` and nowhere else.
--
-- Enforced here rather than only in code: a service account that acquires a
-- permission set is a privilege escalation with no obvious author.
DO $$ BEGIN
    ALTER TABLE public.users
        ADD CONSTRAINT users_service_accounts_hold_no_grants
        CHECK (
            NOT is_service_account
            OR (
                COALESCE(jsonb_array_length(access_matrix -> 'extra'), 0) = 0
                AND password_hash IS NULL
            )
        );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
