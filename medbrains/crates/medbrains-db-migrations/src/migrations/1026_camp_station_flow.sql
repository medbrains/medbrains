-- ====================================================================
-- Migration: 1026_camp_station_flow.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- A camp patient's route through the stations
-- (RFCs/modules/RFC-MODULE-token-queues.md, P4a).
--
-- A camp runs registration → vitals → doctor → pharmacy, and the patient keeps
-- one number throughout. `flow_position` is a counter's place in that route;
-- completing a patient at one station puts them in the queue of the next, with
-- the same number. A counter with no position is not part of the route.

ALTER TABLE camp_counters ADD COLUMN IF NOT EXISTS flow_position smallint
    CHECK (flow_position BETWEEN 1 AND 20);

CREATE UNIQUE INDEX IF NOT EXISTS uq_camp_counters_flow_position
    ON camp_counters (camp_id, flow_position)
    WHERE flow_position IS NOT NULL AND deleted_at IS NULL;
