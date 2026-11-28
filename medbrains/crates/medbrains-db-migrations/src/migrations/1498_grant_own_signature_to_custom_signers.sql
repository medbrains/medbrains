-- ====================================================================
-- Migration: 1498_grant_own_signature_to_custom_signers.sql
-- RLS-Posture: not-applicable
-- Tenant-Column: N/A
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- An administrator no longer issues signatures (#6228): each signer sets
-- their own, which needs `signatures.own.manage`. The built-in roles that
-- sign get it from code at start-up; a hospital's own (non-system) role
-- that signs today would meet a dead end at its next Sign click. This
-- grants the code, once, to every custom role holding a signing code
-- (`doctor.signature.sign` or `nurse.signature.sign`), and bumps
-- `perm_version` for that role's users so a cached permission set is
-- reloaded.
--
-- Idempotent: a role that already holds the code is skipped, and so is a
-- role whose permissions are not a JSON array. Afterwards the code is an
-- ordinary grant: an administrator adds or removes it per role in the role
-- editor. Built-in roles are left to the code, as always. Runs as the
-- owner, which `roles` RLS (enabled, not forced) does not restrict.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM tenants) THEN
        WITH granted AS (
            UPDATE roles
               SET permissions = permissions || '["signatures.own.manage"]'::jsonb,
                   updated_at = now()
             WHERE NOT is_system
               AND jsonb_typeof(permissions) = 'array'
               AND (permissions ? 'doctor.signature.sign' OR permissions ? 'nurse.signature.sign')
               AND NOT permissions ? 'signatures.own.manage'
         RETURNING tenant_id, code
        )
        UPDATE users u
           SET perm_version = u.perm_version + 1
          FROM granted g
         WHERE u.tenant_id = g.tenant_id
           AND u.role::text = g.code;
    END IF;
END
$$;
