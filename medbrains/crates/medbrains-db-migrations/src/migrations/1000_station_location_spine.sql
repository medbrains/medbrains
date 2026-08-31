-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- Bind the queue to a physical place.
--
-- Every piece of this already existed and none of it was joined up. The
-- `locations` tree carries the campus down to the individual room -- OPD
-- Consultation Room 3, the sample collection room, the dispensing counter.
-- The `stations` table carries the service point that calls a patient
-- forward, and `station_type` already allowed `opd_counter`, `lab_counter`,
-- `pharmacy_counter` and `billing_counter`. The `token_scopes` view already
-- unions stations in, and `resolve_scope` in medbrains-tokens already knows
-- how to resolve one.
--
-- What was missing was the edge between them. A station knew which department
-- it belonged to and had a free-text `location_scope->>'label'` for where it
-- was; it could not name a room. So the only thing a token could carry about
-- its destination was `counter_label`, typed by hand at the console, and the
-- TV boards matched patients to rooms by comparing those strings. A typo put
-- a patient in no room at all.
--
-- Three edges, then:
--
--   stations.location_id       which room this counter is in
--   departments.location_id    where a department primarily sits
--   doctor_schedules.station_id  which room a clinic session runs in
--
-- All three are nullable. A camp has no building, and a department that spans
-- two floors should say nothing rather than pick one.

ALTER TABLE public.stations
    ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.locations(id);

ALTER TABLE public.departments
    ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.locations(id);

ALTER TABLE public.doctor_schedules
    ADD COLUMN IF NOT EXISTS station_id uuid REFERENCES public.stations(id);

-- Every one of these is a lookup from the child side -- "which station is in
-- this room", "which sessions run at this station" -- so index the FK, not the
-- target.
CREATE INDEX IF NOT EXISTS idx_stations_location
    ON public.stations (tenant_id, location_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_departments_location
    ON public.departments (tenant_id, location_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_doctor_schedules_station
    ON public.doctor_schedules (tenant_id, station_id)
    WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.stations.location_id IS
    'The room this service point occupies. Null for a station with no fixed '
    'room -- a camp counter under a tent, or a mobile trolley.';

COMMENT ON COLUMN public.departments.location_id IS
    'Where the department primarily sits. Null when it spans several places; '
    'naming one would be a guess the wayfinding directory would repeat.';

COMMENT ON COLUMN public.doctor_schedules.station_id IS
    'The service point this clinic session runs at, and through it the room. '
    'Null for a session whose room is decided on the day.';

-- The view's station branch reported `location_scope->>'label'`, a free-text
-- field nothing populated. Prefer the real room now that a station can name
-- one, and keep the old label as the fallback so a station without a room
-- still reports whatever it used to.
--
-- Column names and types are unchanged, which is what CREATE OR REPLACE
-- requires; only the station branch's `location_label` expression differs.
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
  WHERE (s.deleted_at IS NULL);
