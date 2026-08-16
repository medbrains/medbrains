-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: prescription_verify_links
-- Drops: none
-- Verification links for printed prescriptions.
--
-- The QR on a printed prescription encoded the raw encounter id at a route that
-- was never registered — so it promised "scan to verify" and did nothing. A raw
-- entity id is also the wrong thing to print: it never expires, cannot be
-- revoked, and identifies the encounter to anyone who photographs the paper.
--
-- This follows radiology_share_links, which already solved the same problem:
-- a random token in its own table, with an expiry and an access count, so a
-- link can be aged out and its use can be seen.

CREATE TABLE IF NOT EXISTS public.prescription_verify_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    encounter_id uuid NOT NULL,
    token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    -- A verification page that is being scanned hundreds of times is either a
    -- forged script in circulation or a leaked link. Counting makes that visible.
    accessed_count integer DEFAULT 0 NOT NULL,
    last_accessed timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT prescription_verify_links_pkey PRIMARY KEY (id)
);

-- The public lookup is by token alone — it is the only thing the scanner knows,
-- and it must be unguessable rather than merely unique.
CREATE UNIQUE INDEX IF NOT EXISTS uq_prescription_verify_links_token
    ON public.prescription_verify_links (token);

-- Reprinting the same prescription reuses its live link rather than minting a
-- second one, so the count stays meaningful.
CREATE INDEX IF NOT EXISTS idx_prescription_verify_links_encounter
    ON public.prescription_verify_links (tenant_id, encounter_id, expires_at);

ALTER TABLE public.prescription_verify_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS prescription_verify_links_tenant_isolation
    ON public.prescription_verify_links;
CREATE POLICY prescription_verify_links_tenant_isolation
    ON public.prescription_verify_links
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

COMMENT ON TABLE public.prescription_verify_links IS
    'Expiring tokens behind the QR on a printed prescription. Never print a raw entity id — it cannot expire or be revoked.';
