-- ====================================================================
-- Migration: 1422_tenant_secret_names_notice.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Tell each hospital whose saved secret name will no longer be used.
--
-- A hospital's email and AI settings name a secret instead of holding it:
-- `email/config.smtp_password_secret` and `ai/config.api_key_secret`. From now
-- on the server accepts only a short name (`[a-z0-9-]{1,40}`) and looks it up
-- inside that hospital's own namespace (`medbrains/<env>/<tenant>/<purpose>-
-- <name>`, see medbrains-core `secrets::tenant_name`). A stored value of any
-- other shape is refused when it is resolved, and the email or AI call that
-- needed it does not go out.
--
-- Stored values are left exactly as they are: rewriting a name silently would
-- point it at a secret nobody put there. Instead, one notification per
-- affected hospital goes to its longest-serving active administrator, asking
-- them to re-enter the setting. Runs tenant by tenant under that tenant's own
-- RLS context, and only once: a hospital already told is not told again.

DO $$
DECLARE
    t record;
BEGIN
    FOR t IN
        SELECT s.tenant_id,
               string_agg(CASE s.category WHEN 'email' THEN 'email (SMTP password)'
                                          ELSE 'AI provider key' END, ' and '
                          ORDER BY s.category) AS what
          FROM public.tenant_settings s
         WHERE s.key = 'config'
           AND s.deleted_at IS NULL
           AND ((s.category = 'email'
                 AND COALESCE(btrim(s.value->>'smtp_password_secret'), '') <> ''
                 AND btrim(s.value->>'smtp_password_secret') !~ '^[a-z0-9-]{1,40}$')
             OR (s.category = 'ai'
                 AND COALESCE(btrim(s.value->>'api_key_secret'), '') <> ''
                 AND btrim(s.value->>'api_key_secret') !~ '^[a-z0-9-]{1,40}$'))
         GROUP BY s.tenant_id
    LOOP
        PERFORM set_config('app.tenant_id', t.tenant_id::text, true);
        INSERT INTO public.notifications
            (tenant_id, user_id, kind, title, body, category, action_url)
        SELECT t.tenant_id, u.id, 'warning', 'Re-enter a secret name',
               'The secret name saved in your ' || t.what || ' settings is no longer '
               || 'accepted, so that setting is not being used. Enter a short name '
               || '(lowercase letters, digits and hyphens) and ask your operator to '
               || 'keep the secret under this hospital''s own name.',
               'security', '/setup/domains-email'
          FROM public.users u
         WHERE u.tenant_id = t.tenant_id
           AND u.is_active
           AND u.role::text IN ('hospital_admin', 'super_admin')
           AND NOT EXISTS (
               SELECT 1 FROM public.notifications n
                WHERE n.tenant_id = t.tenant_id
                  AND n.title = 'Re-enter a secret name')
         ORDER BY (u.role::text = 'hospital_admin') DESC, u.created_at
         LIMIT 1;
    END LOOP;
    PERFORM set_config('app.tenant_id', '', true);
END $$;
