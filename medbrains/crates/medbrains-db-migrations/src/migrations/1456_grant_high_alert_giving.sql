-- ====================================================================
-- Migration: 1456_grant_high_alert_giving.sql
-- RLS-Posture: not-applicable
-- Tenant-Column: N/A
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Giving a high-alert dose now needs `nurse.mar.administer_high_alert`
-- (#5529), on top of `nurse.mar.administer` or `ipd.mar.update`. The built-in
-- nurse role gets it from code at start-up; a custom role, an access group or
-- a user's `access_matrix.extra` that gives doses today would lose insulin and
-- heparin on deploy. This grants the new code wherever either administer code
-- is held by name, once.
--
-- Idempotent: rows that already hold the code are skipped. Only JSON-array
-- grants are touched. A user's `denied` list is left alone, so a nurse denied
-- giving doses stays denied.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM tenants) THEN
        UPDATE roles
           SET permissions = permissions || '["nurse.mar.administer_high_alert"]'::jsonb
         WHERE jsonb_typeof(permissions) = 'array'
           AND (permissions ? 'nurse.mar.administer' OR permissions ? 'ipd.mar.update')
           AND NOT permissions ? 'nurse.mar.administer_high_alert';

        UPDATE access_groups
           SET permissions = permissions || '["nurse.mar.administer_high_alert"]'::jsonb
         WHERE jsonb_typeof(permissions) = 'array'
           AND (permissions ? 'nurse.mar.administer' OR permissions ? 'ipd.mar.update')
           AND NOT permissions ? 'nurse.mar.administer_high_alert';

        UPDATE users
           SET access_matrix = jsonb_set(
                   access_matrix, '{extra}',
                   (access_matrix -> 'extra') || '["nurse.mar.administer_high_alert"]'::jsonb),
               perm_version = perm_version + 1
         WHERE jsonb_typeof(access_matrix -> 'extra') = 'array'
           AND ((access_matrix -> 'extra') ? 'nurse.mar.administer'
                OR (access_matrix -> 'extra') ? 'ipd.mar.update')
           AND NOT (access_matrix -> 'extra') ? 'nurse.mar.administer_high_alert';
    END IF;
END
$$;
