-- ====================================================================
-- Migration: 1380_flow_zones.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: flow_zone_config, flow_zone_sources
-- Drops: none
-- ====================================================================
-- MedBrains Flow, Phase 0 (#4901; docs/research-crowd-flow-2026-10.md).
--
-- A crowd and wait view of the building, estimated from data the hospital
-- already records. Zones are the `zone` level of the location hierarchy; this
-- adds what the hierarchy does not hold: the limits the facility admin sets,
-- the attendant factor, the team's wait goal, where the zone sits on the
-- schematic floor grid, and which departments and token queues feed it.
--
-- Flow is a licensed add-on. `require_module_enabled` refuses only an explicit
-- `disabled` row today (an absent row means enabled), so every tenant gets a
-- `disabled` row here, the way 0974 did for the companion: nobody gets Flow
-- free. An operator switches it on in Admin -> Modules.

INSERT INTO module_config (tenant_id, code, name, description, status, depends_on)
SELECT
    t.id,
    'flow',
    'MedBrains Flow',
    'Live crowd and wait view of the building, estimated from queues, check-ins, visitor passes and rosters',
    'disabled'::module_status,
    ARRAY['opd']
FROM tenants t
ON CONFLICT (tenant_id, code) DO NOTHING;

CREATE TABLE public.flow_zone_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    location_id uuid NOT NULL REFERENCES public.locations(id),
    -- People the space holds safely. Over it raises a capacity alert.
    capacity integer CHECK (capacity IS NULL OR capacity > 0),
    -- Crowded but safe. Over it raises a comfort alert.
    comfort_limit integer CHECK (comfort_limit IS NULL OR comfort_limit > 0),
    -- People per patient (family, attendants). 1.8 is the brief's estimate
    -- for Indian OPDs, calibrated by one manual headcount at peak.
    attendant_factor numeric(3,2) NOT NULL DEFAULT 1.80
        CHECK (attendant_factor >= 1 AND attendant_factor <= 5),
    -- Opt-in team goal: the zone's wait target. NULL = no goal shown.
    goal_wait_minutes integer CHECK (goal_wait_minutes IS NULL OR goal_wait_minutes BETWEEN 1 AND 240),
    -- Place on the schematic floor grid (1-based). NULL = laid out by name.
    grid_row smallint CHECK (grid_row IS NULL OR grid_row BETWEEN 1 AND 12),
    grid_col smallint CHECK (grid_col IS NULL OR grid_col BETWEEN 1 AND 12),
    updated_by uuid REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT flow_zone_comfort_within_capacity
        CHECK (comfort_limit IS NULL OR capacity IS NULL OR comfort_limit <= capacity)
);

CREATE UNIQUE INDEX uq_flow_zone_config_location ON public.flow_zone_config (tenant_id, location_id)
    WHERE deleted_at IS NULL;

ALTER TABLE public.flow_zone_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_zone_config FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_flow_zone_config ON public.flow_zone_config
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE TRIGGER set_updated_at_flow_zone_config BEFORE UPDATE ON public.flow_zone_config
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_flow_zone_config_soft_delete BEFORE DELETE ON public.flow_zone_config
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- What feeds a zone. A department brings its checked-in patients, its staff
-- on duty and its department-scoped tokens; a token queue (a module, and
-- optionally one counter) routes that queue to this zone even when its
-- department sits elsewhere, e.g. pharmacy window 2 on another floor.
CREATE TABLE public.flow_zone_sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    zone_location_id uuid NOT NULL REFERENCES public.locations(id),
    kind text NOT NULL CHECK (kind IN ('department', 'token_queue')),
    department_id uuid REFERENCES public.departments(id),
    token_module text CHECK (token_module IS NULL OR token_module ~ '^[a-z_]{2,40}$'),
    counter_label text CHECK (counter_label IS NULL OR length(counter_label) BETWEEN 1 AND 60),
    created_by uuid REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT flow_zone_sources_shape CHECK (
        (kind = 'department' AND department_id IS NOT NULL
            AND token_module IS NULL AND counter_label IS NULL)
        OR (kind = 'token_queue' AND token_module IS NOT NULL AND department_id IS NULL)
    )
);

-- A department or a queue is in one zone at a time; counting it twice would
-- put the same patient in two places.
CREATE UNIQUE INDEX uq_flow_zone_sources_department ON public.flow_zone_sources (tenant_id, department_id)
    WHERE deleted_at IS NULL AND kind = 'department';
CREATE UNIQUE INDEX uq_flow_zone_sources_queue
    ON public.flow_zone_sources (tenant_id, token_module, (COALESCE(counter_label, '')))
    WHERE deleted_at IS NULL AND kind = 'token_queue';
CREATE INDEX idx_flow_zone_sources_zone ON public.flow_zone_sources (tenant_id, zone_location_id)
    WHERE deleted_at IS NULL;

ALTER TABLE public.flow_zone_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_zone_sources FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_flow_zone_sources ON public.flow_zone_sources
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE TRIGGER set_updated_at_flow_zone_sources BEFORE UPDATE ON public.flow_zone_sources
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_flow_zone_sources_soft_delete BEFORE DELETE ON public.flow_zone_sources
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
