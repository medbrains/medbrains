-- Migration: 0266_device_location_scope.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Alters paired_devices and device_pairing_tokens, already tenant-policied.
-- Multi-app device targeting: the location axis. A paired device already carries form-factor
-- (app_variant, e.g. 'TV-Ward') + user (issued_to_user_id); this adds WHICH location it serves so
-- one app codebase can run many location-scoped instances (the Reception TV vs the Ward-3B TV).
-- Additive + nullable → existing rows and RETURNING * handlers are unaffected.

ALTER TABLE device_pairing_tokens
    ADD COLUMN IF NOT EXISTS department_id  uuid REFERENCES departments(id),
    ADD COLUMN IF NOT EXISTS location_label text,
    ADD COLUMN IF NOT EXISTS location_scope jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE paired_devices
    ADD COLUMN IF NOT EXISTS department_id  uuid REFERENCES departments(id),
    ADD COLUMN IF NOT EXISTS location_label text,
    ADD COLUMN IF NOT EXISTS location_scope jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Drop the coarse staff/tv/vendor CHECK: app_variant is now a fine surface code (TV-Ward,
-- Mobile-Doctor, …) validated at the app layer against the 34-surface catalog, not a fixed enum.
ALTER TABLE device_pairing_tokens DROP CONSTRAINT IF EXISTS device_pairing_tokens_intended_app_variant_check;
ALTER TABLE paired_devices DROP CONSTRAINT IF EXISTS paired_devices_app_variant_check;
