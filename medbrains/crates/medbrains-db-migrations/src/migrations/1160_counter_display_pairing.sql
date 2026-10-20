-- ====================================================================
-- Migration: 1160_counter_display_pairing.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- The customer display (#4883): a screen at a billing or pharmacy counter
-- that shows the patient what they are paying. It pairs by the same
-- device-code flow as a waiting-room board, but it belongs to a counter, not
-- a department, so the approval has to carry the counter through to the
-- paired device. `paired_devices.station_id` already exists.

ALTER TABLE public.device_pairing_requests
    ADD COLUMN station_id uuid REFERENCES public.stations(id);

-- "Which screens show this counter" — the settings card and the cashier's
-- "display connected" check both ask it.
CREATE INDEX idx_paired_devices_counter_display
    ON public.paired_devices (tenant_id, station_id)
    WHERE board_module = 'counter_display' AND revoked_at IS NULL AND deleted_at IS NULL;
