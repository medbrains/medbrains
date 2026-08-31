-- RLS-Posture: not-tenant-scoped
-- Tenant-Column: none
-- New-Tables: none
-- Drops: none
-- A token can be tied to a room, a department, a unit or a building.
--
-- `token_scopes` offered three kinds of queue: a department, a camp counter,
-- and a station. Between them they could not express "the queue for X-Ray
-- Room 1", "everyone waiting in the Main Block", or "the ICU as a unit" --
-- which is how a hospital actually talks about where people are waiting.
--
-- The location tree already carries every one of those. A campus, a building,
-- a floor, a wing, a zone and a room are all rows in `locations`, and a token
-- pointed at any of them is a well-formed queue. So the fourth branch is not a
-- new concept, it is the tree that was already there being allowed to answer.
--
-- `kind` carries the level, so a caller can tell a building from a room
-- without a second query, and the board can say "Ground Floor, Wing A" as
-- readily as "OPD Consultation Room 3".
--
-- Beds are excluded deliberately. A bed is where one patient already is, not
-- somewhere a queue of people waits, and offering it as a scope would invite a
-- queue of strangers pointed at an occupied bed.

CREATE OR REPLACE VIEW public.token_scopes AS
 SELECT d.tenant_id,
    'department'::text AS scope,
    d.id AS scope_id,
    d.name AS label,
    (d.department_type)::text AS kind,
    NULL::integer AS capacity_per_hour,
    NULL::text AS location_label,
    NULL::uuid AS camp_id,
    d.is_active
   FROM public.departments d
UNION ALL
 SELECT c.tenant_id,
    'counter'::text AS scope,
    c.id AS scope_id,
    c.counter_name AS label,
    c.counter_type AS kind,
    c.capacity_per_hour,
    c.location_label,
    c.camp_id,
    (c.status = ANY (ARRAY['ready'::text, 'active'::text])) AS is_active
   FROM public.camp_counters c
  WHERE (c.deleted_at IS NULL)
UNION ALL
 SELECT s.tenant_id,
    'station'::text AS scope,
    s.id AS scope_id,
    s.name AS label,
    s.station_type AS kind,
    NULL::integer AS capacity_per_hour,
    COALESCE(l.name, (s.location_scope ->> 'label'::text)) AS location_label,
    NULL::uuid AS camp_id,
    s.is_active
   FROM public.stations s
   LEFT JOIN public.locations l ON l.id = s.location_id
  WHERE (s.deleted_at IS NULL)
UNION ALL
 SELECT loc.tenant_id,
    'location'::text AS scope,
    loc.id AS scope_id,
    loc.name AS label,
    (loc.level)::text AS kind,
    NULL::integer AS capacity_per_hour,
    parent.name AS location_label,
    NULL::uuid AS camp_id,
    loc.is_active
   FROM public.locations loc
   LEFT JOIN public.locations parent ON parent.id = loc.parent_id
  WHERE loc.deleted_at IS NULL
    AND loc.level <> 'bed';

COMMENT ON VIEW public.token_scopes IS
  'Everything a token may be queued against: a department, a camp counter, a '
  'station, or any level of the location tree except a bed. `kind` carries '
  'the specific type so a caller can distinguish a building from a room.';
