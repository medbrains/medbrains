-- ====================================================================
-- Migration: 0292_token_scopes_stations.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Let a queue be addressed by station, not only by department or camp counter.
--
-- `stations` (0267) is the master for the physical place an app or device sits
-- — a nurse station, an OPD counter, a lab counter, a kiosk. Devices already
-- pair to it. Nothing in the queue could name one: `token_scopes` (0291)
-- resolved `department` and `counter` only, so a token issued with
-- `scope = 'station'` failed to resolve and was refused.
--
-- That matters most where the queue is not a doctor's room. A vitals counter in
-- a permanent OPD is a `nurse_station` under a department, staffed by nurses;
-- it needs a queue of its own because one counter feeds every consultation room,
-- and a queue per doctor would be the wrong shape.
--
-- `station_type` rides in the `kind` column alongside `department_type` and
-- `counter_type`, so a board can tell a nurse station from a billing counter
-- without another join. Stations carry no capacity or camp: those columns stay
-- null, exactly as they do for departments.
-- ====================================================================

CREATE OR REPLACE VIEW public.token_scopes AS
    SELECT d.tenant_id,
           'department'::text        AS scope,
           d.id                      AS scope_id,
           d.name                    AS label,
           d.department_type::text   AS kind,
           NULL::integer             AS capacity_per_hour,
           NULL::text                AS location_label,
           NULL::uuid                AS camp_id,
           d.is_active               AS is_active
      FROM public.departments d
    UNION ALL
    SELECT c.tenant_id,
           'counter'::text,
           c.id,
           c.counter_name,
           c.counter_type,
           c.capacity_per_hour,
           c.location_label,
           c.camp_id,
           (c.status IN ('ready', 'active')) AS is_active
      FROM public.camp_counters c
     WHERE c.deleted_at IS NULL
    UNION ALL
    SELECT s.tenant_id,
           'station'::text,
           s.id,
           s.name,
           s.station_type,
           NULL::integer,
           -- `location_scope` is free-form jsonb; only lift a plain text label
           -- out of it, never the whole object.
           s.location_scope ->> 'label',
           NULL::uuid,
           s.is_active
      FROM public.stations s
     WHERE s.deleted_at IS NULL;
