-- Migration: 0220_perm_version_triggers.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Triggers on roles and access_group tables, already tenant-policied.
-- Auto-bump users.perm_version when the permission model changes underneath a
-- live session, so grants/revokes take effect on the NEXT request instead of
-- lingering until the 15-min access token expires. Catch-all DB triggers beat
-- per-handler bumps (which today miss role/access-group permission edits and
-- group-membership changes entirely).
--
-- SECURITY DEFINER: the bump is a system-level token invalidation, not a
-- tenant-scoped user action, so run as owner and never let RLS on `users` block
-- it. Every UPDATE is still explicitly tenant/user-scoped.

-- 1. A role's permissions changed → bump everyone assigned that role.
CREATE OR REPLACE FUNCTION bump_perm_version_on_role_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NEW.permissions IS DISTINCT FROM OLD.permissions THEN
        UPDATE users SET perm_version = perm_version + 1
        WHERE tenant_id = NEW.tenant_id AND role::text = NEW.code;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_perm_version_role ON roles;
CREATE TRIGGER trg_bump_perm_version_role
    AFTER UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION bump_perm_version_on_role_change();

-- 2. An access group's permissions changed → bump all its members.
CREATE OR REPLACE FUNCTION bump_perm_version_on_group_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NEW.permissions IS DISTINCT FROM OLD.permissions THEN
        UPDATE users SET perm_version = perm_version + 1
        WHERE id IN (SELECT user_id FROM access_group_members WHERE group_id = NEW.id);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_perm_version_group ON access_groups;
CREATE TRIGGER trg_bump_perm_version_group
    AFTER UPDATE ON access_groups
    FOR EACH ROW EXECUTE FUNCTION bump_perm_version_on_group_change();

-- 3. Group membership added / removed / expiry-changed → bump the affected user.
-- Removal is a SOFT delete: a global BEFORE-DELETE guardrail rewrites DELETE into
-- UPDATE deleted_at=now() (physical DELETE only when app.allow_physical_delete).
-- So we must catch the soft-delete UPDATE (deleted_at flip) and restore, plus the
-- rare physical DELETE and the INSERT (add). A revoked membership must invalidate
-- the session, so branch on TG_OP to read the right row.
CREATE OR REPLACE FUNCTION bump_perm_version_on_membership() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE users SET perm_version = perm_version + 1 WHERE id = OLD.user_id;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Only when the row's effective membership changed (soft-delete/restore or
        -- expiry) — not on unrelated column touches.
        IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
            OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
            UPDATE users SET perm_version = perm_version + 1 WHERE id = NEW.user_id;
        END IF;
        RETURN NEW;
    END IF;
    UPDATE users SET perm_version = perm_version + 1 WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_perm_version_membership ON access_group_members;
CREATE TRIGGER trg_bump_perm_version_membership
    AFTER INSERT OR UPDATE OR DELETE ON access_group_members
    FOR EACH ROW EXECUTE FUNCTION bump_perm_version_on_membership();
