-- ====================================================================
-- Migration: 1405_machine_join.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- A machine asks to join this hospital over iroh (OS-SETUP-AND-TRUST §8).
--
-- A request is a pending row of device_pairing_requests, as a TV's is, and an
-- approved machine is a paired_devices row with a device_node_keys row, as a
-- phone's sync key is; so no new tables. The differences are a key instead of
-- a pairing token, and a code both screens show that a person retypes.
-- Machine requests are never reachable by the TV path: their user_code holds a
-- `machine:` value that its code normalisation cannot produce, and its list
-- filters them out.
--
-- `source_address` is where the request came from, so one address cannot crowd
-- out the others; `drop_reason` says why a newer request pushed this one out,
-- which the Machines screen shows.

ALTER TABLE device_pairing_requests
    ADD COLUMN IF NOT EXISTS node_id text,
    ADD COLUMN IF NOT EXISTS join_code text,
    ADD COLUMN IF NOT EXISTS code_attempts integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS source_address text,
    ADD COLUMN IF NOT EXISTS drop_reason text;

ALTER TABLE device_pairing_requests
    DROP CONSTRAINT IF EXISTS device_pairing_requests_app_variant_check,
    ADD CONSTRAINT device_pairing_requests_app_variant_check CHECK (
        app_variant = ANY (ARRAY['staff', 'tv', 'vendor', 'Desktop-Workstation', 'Desktop-Display'])
    );

-- One live request per key; a machine that asks again replaces its own.
CREATE UNIQUE INDEX IF NOT EXISTS uq_device_pairing_requests_pending_node
    ON device_pairing_requests (node_id)
    WHERE node_id IS NOT NULL AND status = 'pending';

CREATE INDEX IF NOT EXISTS idx_device_pairing_requests_node
    ON device_pairing_requests (node_id, created_at DESC)
    WHERE node_id IS NOT NULL;
