-- ====================================================================
-- Migration: 1025_display_pairing_binding.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Which board a paired screen shows (RFCs/modules/RFC-MODULE-token-queues.md,
-- P3b).
--
-- A TV paired by code knew nothing about where it hung: approval recorded who
-- approved it and whom it acts as, and no place. So a waiting-room screen had
-- to be told which department to show by somebody standing at it with a
-- keyboard — on a device nobody touches. Approval now records the board
-- (module) and the department, and the paired device carries them.

ALTER TABLE device_pairing_requests
    ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id),
    ADD COLUMN IF NOT EXISTS board_module text;

ALTER TABLE paired_devices
    ADD COLUMN IF NOT EXISTS board_module text;
