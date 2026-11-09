-- ====================================================================
-- Migration: 1451_sso_link_vetting.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Who linked an account to a Kanidm person, and whether they were an
-- administrator; and a non-administrator's link dropped when the account's
-- access changes.
--
-- A non-administrator (IT with admin.users.link_identity) may link only an
-- account that holds nothing they do not. That was checked once, at link time:
-- a role, a permission override, an access group or a department given to the
-- account afterwards flowed straight to whoever controls the Kanidm person. So
-- a link made by a non-administrator is dropped the moment any of those
-- change, its sessions are ended, and an administrator links it again.
--
-- Links made before this migration, by kanidm-setup, or through a provider's
-- own sign-in have sso_linked_by_admin NULL and are left alone: only a link
-- this server recorded as a non-administrator's is dropped. Directory-group
-- grants (source 'sso') are exempt: on the OS's Kanidm only an administrator
-- may map a group.

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS sso_linked_by uuid REFERENCES public.users(id),
    ADD COLUMN IF NOT EXISTS sso_linked_by_admin boolean;

COMMENT ON COLUMN public.users.sso_linked_by IS
    'Who linked this account to its sign-in person (Admin, Users, Link to sign-in).';
COMMENT ON COLUMN public.users.sso_linked_by_admin IS
    'Whether that was an administrator. False: the link is dropped when the account''s access changes.';

-- Ends every session of an account whose link was dropped.
CREATE OR REPLACE FUNCTION public.end_unvetted_link_sessions(p_user uuid)
RETURNS void LANGUAGE sql AS $$
    UPDATE public.refresh_tokens SET revoked = true WHERE user_id = p_user AND revoked = false;
$$;

-- Drops a non-administrator's link on one account (role, override or department change on the row itself).
CREATE OR REPLACE FUNCTION public.users_drop_unvetted_link() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.sso_linked_by_admin IS FALSE
       AND NEW.external_subject IS NOT DISTINCT FROM OLD.external_subject
       AND (NEW.role IS DISTINCT FROM OLD.role
            OR NEW.access_matrix IS DISTINCT FROM OLD.access_matrix
            OR NEW.department_ids IS DISTINCT FROM OLD.department_ids) THEN
        NEW.idp_id := NULL;
        NEW.external_subject := NULL;
        NEW.sso_linked_by := NULL;
        NEW.sso_linked_by_admin := NULL;
        NEW.perm_version := NEW.perm_version + 1;
        PERFORM public.end_unvetted_link_sessions(NEW.id);
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_users_drop_unvetted_link ON public.users;
CREATE TRIGGER trg_users_drop_unvetted_link
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.users_drop_unvetted_link();

-- Drops the non-administrator links of these accounts (a role's or group's codes, or a new membership).
CREATE OR REPLACE FUNCTION public.drop_unvetted_links(p_users uuid[]) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
    dropped uuid;
BEGIN
    FOR dropped IN
        UPDATE public.users SET idp_id = NULL, external_subject = NULL, sso_linked_by = NULL,
               sso_linked_by_admin = NULL, perm_version = perm_version + 1, updated_at = now()
         WHERE id = ANY(p_users) AND sso_linked_by_admin IS FALSE
        RETURNING id
    LOOP
        PERFORM public.end_unvetted_link_sessions(dropped);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.roles_drop_unvetted_links() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    PERFORM public.drop_unvetted_links(ARRAY(
        SELECT id FROM public.users
         WHERE tenant_id = NEW.tenant_id AND role::text = NEW.code AND sso_linked_by_admin IS FALSE));
    RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_roles_drop_unvetted_links ON public.roles;
CREATE TRIGGER trg_roles_drop_unvetted_links
    AFTER UPDATE OF permissions ON public.roles
    FOR EACH ROW WHEN (OLD.permissions IS DISTINCT FROM NEW.permissions)
    EXECUTE FUNCTION public.roles_drop_unvetted_links();

CREATE OR REPLACE FUNCTION public.access_groups_drop_unvetted_links() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    PERFORM public.drop_unvetted_links(ARRAY(
        SELECT user_id FROM public.access_group_members
         WHERE group_id = NEW.id AND deleted_at IS NULL));
    RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_access_groups_drop_unvetted_links ON public.access_groups;
CREATE TRIGGER trg_access_groups_drop_unvetted_links
    AFTER UPDATE OF permissions ON public.access_groups
    FOR EACH ROW WHEN (OLD.permissions IS DISTINCT FROM NEW.permissions)
    EXECUTE FUNCTION public.access_groups_drop_unvetted_links();

CREATE OR REPLACE FUNCTION public.access_group_members_drop_unvetted_link() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.deleted_at IS NULL AND NEW.source IS DISTINCT FROM 'sso'
       AND (TG_OP = 'INSERT' OR OLD.deleted_at IS NOT NULL OR NEW.group_id <> OLD.group_id
            OR NEW.expires_at IS DISTINCT FROM OLD.expires_at) THEN
        PERFORM public.drop_unvetted_links(ARRAY[NEW.user_id]);
    END IF;
    RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_access_group_members_drop_unvetted_link ON public.access_group_members;
CREATE TRIGGER trg_access_group_members_drop_unvetted_link
    AFTER INSERT OR UPDATE ON public.access_group_members
    FOR EACH ROW EXECUTE FUNCTION public.access_group_members_drop_unvetted_link();
