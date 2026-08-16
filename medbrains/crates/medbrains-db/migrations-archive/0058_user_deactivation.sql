-- Phase A.1 — user-level JWT revocation primitive.
--
-- When admin disables a user (compromised credentials, employment
-- ended, role permanently removed) the existing is_active flag flips
-- to false but we have no timestamp recording WHEN. Mobile + TV
-- devices that pull revocation lists need that timestamp to compare
-- against jwt.iat — every JWT issued before deactivated_at is
-- considered revoked.
--
-- Pure additive migration. No data backfill needed; existing rows
-- with is_active=false leave deactivated_at NULL, which means
-- "revoked at <unknown> time" — mobile clients treat NULL as
-- "revoked retroactively from epoch 0", so any JWT under that user
-- fails revocation check.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

COMMENT ON COLUMN users.deactivated_at IS
    'Timestamp the user was disabled. NULL while is_active=true. Used by /api/auth/revocations so offline devices can compare against jwt.iat.';

-- Trigger: keep deactivated_at in sync with is_active flips. Set
-- deactivated_at = now() when is_active goes true → false; clear it
-- when re-activated.
CREATE OR REPLACE FUNCTION users_track_deactivation() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.is_active = TRUE AND NEW.is_active = FALSE THEN
        NEW.deactivated_at = COALESCE(NEW.deactivated_at, now());
    ELSIF OLD.is_active = FALSE AND NEW.is_active = TRUE THEN
        NEW.deactivated_at = NULL;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_track_deactivation ON users;
CREATE TRIGGER trg_users_track_deactivation
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION users_track_deactivation();

-- Index for the /api/auth/revocations cursor query.
CREATE INDEX IF NOT EXISTS idx_users_deactivated_at
    ON users (tenant_id, deactivated_at)
    WHERE deactivated_at IS NOT NULL;
