-- Public list of active SSO providers for the login page.
--
-- The login page is pre-auth (no tenant RLS context), so it cannot read
-- identity_providers directly. This SECURITY DEFINER function exposes only the
-- non-sensitive fields (id, display name, protocol) of active providers — no
-- secrets, URLs or config. The `id` is the capability used by the authorize route.
CREATE OR REPLACE FUNCTION public.sso_active_providers()
RETURNS TABLE(id uuid, name text, protocol text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id, name, protocol
    FROM public.identity_providers
    WHERE is_active = true
    ORDER BY name;
$$;
