-- ====================================================================
-- Migration: 1027_camp_station_rooms.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Several rooms at one camp station (RFCs/modules/RFC-MODULE-token-queues.md,
-- P4b).
--
-- A camp with two doctors runs one Doctor queue from two rooms: the next
-- patient goes to whichever doctor is free, and the board says which room.
-- So more than one counter may hold the same step on the route; they share
-- the step's queue. 1026 allowed one counter per step.

DROP INDEX IF EXISTS uq_camp_counters_flow_position;

CREATE INDEX IF NOT EXISTS idx_camp_counters_flow
    ON camp_counters (camp_id, flow_position)
    WHERE flow_position IS NOT NULL AND deleted_at IS NULL;
