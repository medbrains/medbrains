-- Generic location/station handoff (open-pickup model). Distinct from the
-- user-based handoffs (shift_handoffs, ot_*_handoffs) which name an incoming
-- person: a station handoff is keyed to a LOCATION (OT room, ward, bed,
-- pharmacy/billing counter, …) and sits OPEN until whoever staffs that
-- location next acknowledges it. One reusable primitive used everywhere.

CREATE TABLE IF NOT EXISTS public.station_handoffs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    module text NOT NULL,                 -- ot | ipd | pharmacy | billing | ...
    station_type text NOT NULL,           -- ot_room | ward | bed | pharmacy_counter | billing_counter | ...
    station_key text NOT NULL,            -- the location id (uuid-as-text) or a label
    station_label text,                   -- human-readable location name
    title text NOT NULL,
    summary text,                         -- free text / SBAR
    items jsonb NOT NULL DEFAULT '[]'::jsonb,   -- optional pending-task checklist
    status text NOT NULL DEFAULT 'open',
    handed_off_by uuid NOT NULL,
    handed_off_at timestamptz NOT NULL DEFAULT now(),
    acknowledged_by uuid,
    acknowledged_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT station_handoffs_status_check CHECK (status = ANY (ARRAY['open'::text, 'acknowledged'::text]))
);

ALTER TABLE public.station_handoffs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_station_handoffs ON public.station_handoffs;
CREATE POLICY tenant_isolation_station_handoffs ON public.station_handoffs
    USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Fast "open handoffs for this station" lookup.
CREATE INDEX IF NOT EXISTS idx_station_handoffs_lookup
    ON public.station_handoffs USING btree (tenant_id, module, station_type, station_key, status);
