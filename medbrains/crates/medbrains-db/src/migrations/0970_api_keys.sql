-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: api_keys, api_key_usage
-- Drops: none
-- Machine credentials for the API.
--
-- Until now the only way for a program to call this API was to hold a human's
-- session — an integration running as a named clinician, with that
-- clinician's full authority, and no way to tell the two apart in the audit
-- log. A key is a separate kind of identity: narrower than any person, and
-- attributable.
--
-- ## Why a key is not a user
--
-- The temptation is to let a key impersonate a service account, because it is
-- less code. That inherits the account's whole permission set, which for an
-- integration is almost always far more than it needs — and when the key
-- leaks, what leaks is a user.
--
-- So a key carries an **explicit permission list** and nothing else. It has no
-- role, and therefore cannot benefit from a role gaining permissions later. A
-- key granted `lab.results.create` in January still has exactly that in
-- December, whatever happened to the role its creator held.
--
-- ## Why the prefix is stored in the clear
--
-- `key_prefix` holds the first characters — `mb_live_a3f2` — so a console can
-- show which key is which without holding the secret. It also makes a leaked
-- key identifiable in a log or a repository at a glance, and lets GitHub's
-- secret scanning recognise the format.
--
-- ## Why SHA-256 and not Argon2
--
-- Passwords are low-entropy and need a slow hash to survive being guessed. A
-- generated key is 256 bits of randomness — there is nothing to guess — and it
-- is verified on *every request*, where a deliberately slow hash would be a
-- denial-of-service on ourselves. Same reasoning as `bridge_agents`.

CREATE TABLE IF NOT EXISTS public.api_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    -- What this key is for, in words. Required: an unnamed key is one nobody
    -- dares revoke, because nobody knows what it runs.
    name text NOT NULL,
    description text,
    -- `mb_live_a3f2` — enough to identify, not enough to use.
    key_prefix text NOT NULL,
    key_hash text NOT NULL,
    -- The explicit allowlist. Never a role, never inherited.
    permissions jsonb DEFAULT '[]'::jsonb NOT NULL,
    -- Mandatory. A credential with no expiry is one nobody rotates, and the
    -- integration that used it three years ago is long gone.
    expires_at timestamp with time zone NOT NULL,
    -- Set on use rather than per call: an exact count is a write on every
    -- request, and "when did this last run" answers the question that matters
    -- — which keys are dead and can be revoked.
    last_used_at timestamp with time zone,
    last_used_ip inet,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    revoke_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid NOT NULL,
    CONSTRAINT api_keys_pkey PRIMARY KEY (id),
    CONSTRAINT api_keys_name_present CHECK (length(btrim(name)) > 0),
    -- A key that grants nothing is a mistake, not a safe default: it will be
    -- widened in a hurry by somebody debugging why their integration 403s.
    CONSTRAINT api_keys_has_permissions CHECK (jsonb_array_length(permissions) > 0),
    CONSTRAINT api_keys_expiry_future CHECK (expires_at > created_at)
);

-- The verification lookup, on every authenticated machine request. Hash first
-- because that is what is being matched; the partial index keeps revoked and
-- expired keys out of the index entirely rather than filtering them after.
CREATE UNIQUE INDEX IF NOT EXISTS uq_api_keys_hash
    ON public.api_keys (key_hash);

CREATE INDEX IF NOT EXISTS idx_api_keys_live
    ON public.api_keys (key_hash)
    WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_api_keys_tenant
    ON public.api_keys (tenant_id, created_at DESC);

-- A separate, append-only record of what a key actually did.
--
-- `last_used_at` on the key answers "is this still in use". It cannot answer
-- "what did this key do on the fourteenth", which is the question asked after
-- a leak — and that is the question that decides whether patient data left.
CREATE TABLE IF NOT EXISTS public.api_key_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    api_key_id uuid NOT NULL,
    method text NOT NULL,
    path text NOT NULL,
    status_code integer NOT NULL,
    ip inet,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT api_key_usage_pkey PRIMARY KEY (id),
    CONSTRAINT api_key_usage_key_fkey
        FOREIGN KEY (api_key_id) REFERENCES public.api_keys (id) ON DELETE CASCADE
);

-- The forensic query: everything one key did, most recent first.
CREATE INDEX IF NOT EXISTS idx_api_key_usage_key
    ON public.api_key_usage (api_key_id, occurred_at DESC);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_key_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS api_keys_tenant_isolation ON public.api_keys;
CREATE POLICY api_keys_tenant_isolation ON public.api_keys
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS api_key_usage_tenant_isolation ON public.api_key_usage;
CREATE POLICY api_key_usage_tenant_isolation ON public.api_key_usage
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP TRIGGER IF EXISTS trg_api_keys_updated_at ON public.api_keys;
CREATE TRIGGER trg_api_keys_updated_at BEFORE UPDATE ON public.api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE public.api_keys IS
    'Machine credentials. A key carries an explicit permission list, never a role, so it cannot widen when a role does.';
COMMENT ON COLUMN public.api_keys.key_prefix IS
    'The visible leading characters, so a console can identify a key without holding it.';
COMMENT ON TABLE public.api_key_usage IS
    'Append-only record of what each key did. last_used_at says whether a key is alive; this says what it touched.';
