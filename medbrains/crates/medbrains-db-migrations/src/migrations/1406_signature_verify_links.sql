-- ====================================================================
-- Migration: 1406_signature_verify_links.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: signature_verify_links
-- Drops: none
-- ====================================================================
-- The QR on a signed print (RFC-MODULE-paperless-records §4.4).
--
-- An insurer, a court clerk or another hospital scans it and learns who
-- signed the document, when, whether the signing key is still good, and
-- whether the record still matches what was signed. Nothing about the
-- patient. The QR carries a token from this table, never the signed
-- record's id: a token can be withdrawn, and 256 random bits cannot be
-- guessed or walked.
--
-- One live link per signed record, minted when it is signed. Withdrawing
-- one stamps `revoked_at`; the row stays, so the paper carrying it answers
-- "withdrawn on <date>" rather than "unknown". Links do not expire: a
-- discharge summary is checked years later, in court.

CREATE TABLE public.signature_verify_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    signed_record_id uuid NOT NULL REFERENCES public.signed_records(id),
    token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
    created_by uuid REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    revoked_at timestamptz,
    revoked_by uuid REFERENCES public.users(id),
    revoked_reason text,
    accessed_count integer NOT NULL DEFAULT 0,
    last_accessed timestamptz,
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT signature_verify_links_revocation_has_reason
        CHECK (revoked_at IS NULL OR revoked_reason IS NOT NULL)
);

-- At most one live link per signed record; issuing again returns it.
CREATE UNIQUE INDEX uq_signature_verify_links_live
    ON public.signature_verify_links (tenant_id, signed_record_id)
    WHERE revoked_at IS NULL AND deleted_at IS NULL;
CREATE INDEX idx_signature_verify_links_record
    ON public.signature_verify_links (signed_record_id);

-- ENABLE without FORCE, as prescription_verify_links (0400) and api_keys
-- (0970): `app_signature_verify_link` below is SECURITY DEFINER and must find
-- a token before any tenant is known, which only the table owner can do when
-- the policy is not forced on it. FORCE would make every public check answer
-- "not found" wherever the owner is not a superuser. The request role is still
-- held to the tenant policy for every direct read and write.
ALTER TABLE public.signature_verify_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_signature_verify_links ON public.signature_verify_links
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
CREATE TRIGGER trg_signature_verify_links_soft_delete BEFORE DELETE ON public.signature_verify_links
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Every record signed before this migration gets its link, so a reprint
-- carries a QR without anybody having to issue one.
INSERT INTO public.signature_verify_links (tenant_id, signed_record_id)
SELECT sr.tenant_id, sr.id
  FROM public.signed_records sr
 WHERE sr.deleted_at IS NULL;

-- Whoever scans the QR has no hospital yet; the token is how it is found.
-- The least the caller needs: the hospital, the signed record, and whether
-- the link was withdrawn. Executable by the request role only, like
-- app_rx_verify_link (1206).
CREATE OR REPLACE FUNCTION public.app_signature_verify_link(p_token TEXT)
RETURNS TABLE (tenant_id UUID, signed_record_id UUID, revoked_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT l.tenant_id, l.signed_record_id, l.revoked_at
      FROM public.signature_verify_links l
     WHERE l.token = p_token AND l.deleted_at IS NULL
$$;

REVOKE ALL ON FUNCTION public.app_signature_verify_link(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_signature_verify_link(TEXT) TO medbrains_app;
