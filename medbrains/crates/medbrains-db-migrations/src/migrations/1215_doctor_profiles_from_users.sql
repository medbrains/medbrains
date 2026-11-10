-- ====================================================================
-- Migration: 1215_doctor_profiles_from_users.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Every doctor account is a doctor on the Doctors page.
--
-- Administration -> Doctors reads `doctor_profiles`, and nothing created one
-- except that page's own "Add doctor" form. Doctors created the normal way --
-- Users, onboarding, the seed -- saw patients, prescribed and admitted, and the
-- page said "0 doctors": no registration to check, no credential to issue, no
-- HPR coverage to count.
--
-- So a user who is, or becomes, a doctor gets a profile: their name, and their
-- specialisation as the subspecialty. Registration numbers are left empty, which
-- is what the page reports as missing, for the admin to complete there.
-- ON CONFLICT keeps any profile already written by hand.
--
-- doctor_profiles FORCEs row level security, so even this SECURITY DEFINER
-- function needs the row's tenant as context. It sets it for the insert and
-- puts back whatever the session had, so a platform administrator creating a
-- user in another hospital does not leave the transaction pointed there.

CREATE OR REPLACE FUNCTION ensure_doctor_profile(p_user uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    u record;
    prev text := current_setting('app.tenant_id', true);
BEGIN
    SELECT id, tenant_id, full_name, specialization, is_active
      INTO u
      FROM users
     WHERE id = p_user AND role = 'doctor' AND deleted_at IS NULL;
    IF NOT FOUND THEN
        RETURN;
    END IF;

    PERFORM set_config('app.tenant_id', u.tenant_id::text, true);
    INSERT INTO doctor_profiles (tenant_id, user_id, display_name, subspecialty, is_active)
    VALUES (u.tenant_id, u.id, u.full_name, NULLIF(btrim(u.specialization), ''), u.is_active)
    ON CONFLICT (tenant_id, user_id) DO NOTHING;
    PERFORM set_config('app.tenant_id', COALESCE(prev, ''), true);
END;
$$;

REVOKE ALL ON FUNCTION ensure_doctor_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ensure_doctor_profile(uuid) TO medbrains_app;

CREATE OR REPLACE FUNCTION trg_users_ensure_doctor_profile() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.role = 'doctor' THEN
        PERFORM ensure_doctor_profile(NEW.id);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_doctor_profile ON users;
CREATE TRIGGER trg_users_doctor_profile
    AFTER INSERT OR UPDATE OF role ON users
    FOR EACH ROW EXECUTE FUNCTION trg_users_ensure_doctor_profile();

SELECT ensure_doctor_profile(id) FROM users WHERE role = 'doctor' AND deleted_at IS NULL;
