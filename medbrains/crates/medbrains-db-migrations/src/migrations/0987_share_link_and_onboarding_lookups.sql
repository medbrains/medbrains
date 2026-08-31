-- Two more lookups that happen before there is a tenant, answered the way
-- 0986 answered the first two.
--
-- A radiology share link is a URL sent to a referring doctor or a patient.
-- Whoever opens it has no session and no hospital: the token is the whole
-- credential, and the row it names is how the study — and its tenant — are
-- found. Under row level security the lookup returns nothing and every share
-- link 404s.
--
-- The onboarding count is a public endpoint by design; its own comment says
-- so. It counts completed onboardings across every tenant to tell a brand new
-- organisation the product is alive. Scoped it would read zero forever.

-- Resolve a share link, if it exists and has not expired.
--
-- Expiry is checked here rather than after the fact. The previous code read
-- the row, then compared `expires_at` in Rust, which means an expired link was
-- still fetched and its access count still incremented — a link that has been
-- revoked by time should not leave a trace of having been opened.
--
-- Returns `tenant_id` so the caller can scope everything it does next.
CREATE OR REPLACE FUNCTION public.app_share_link_by_token(p_token TEXT)
RETURNS TABLE (
    id         UUID,
    tenant_id  UUID,
    study_id   UUID,
    expires_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT sl.id, sl.tenant_id, sl.study_id, sl.expires_at
      FROM public.radiology_share_links sl
     WHERE sl.token = p_token
       AND sl.expires_at > now()
       AND sl.deleted_at IS NULL;
$$;

COMMENT ON FUNCTION public.app_share_link_by_token(TEXT) IS
    'Pre-auth lookup: a radiology share link by its token. Runs without a '
    'tenant because the token is how the tenant is found, and returns nothing '
    'for a link that has expired or been deleted.';

-- Record that a share link was opened.
--
-- Separate from the lookup so the read stays a read. Takes the tenant the
-- lookup returned, so it cannot touch a link belonging to anybody else.
CREATE OR REPLACE FUNCTION public.app_share_link_touch(p_id UUID, p_tenant_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
    UPDATE public.radiology_share_links
       SET accessed_count = accessed_count + 1, last_accessed = now()
     WHERE id = p_id AND tenant_id = p_tenant_id;
$$;

-- How many organisations have finished onboarding.
--
-- Deliberately across every tenant: it is shown to somebody who does not have
-- one yet. A count and nothing else — no names, no addresses, no way to ask
-- about a particular organisation.
CREATE OR REPLACE FUNCTION public.app_completed_onboardings()
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT count(*) FROM public.onboarding_progress WHERE is_complete = true;
$$;

GRANT EXECUTE ON FUNCTION public.app_share_link_by_token(TEXT) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_share_link_touch(UUID, UUID) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_completed_onboardings() TO PUBLIC;
