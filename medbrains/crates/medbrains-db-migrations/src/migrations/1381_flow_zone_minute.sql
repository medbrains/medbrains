-- ====================================================================
-- Migration: 1381_flow_zone_minute.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: flow_zone_minute
-- Drops: none
-- ====================================================================
-- MedBrains Flow (#4901): one row per zone per minute, written by the Flow
-- aggregator and read by every Flow screen. Counts only; no patient, token
-- number or staff identity is ever stored here.
--
-- A NULL count means the source could not be read that minute (an outage),
-- and `unknown_sources` names which. A screen shows "unknown", never 0: an
-- empty hall and a failed query must not look alike.
--
-- Partitioned by month and registered with `partition_config`, so the daily
-- retention job makes the months ahead and drops a month once the one after
-- it has ended (about 31-62 days kept; the brief asks for 31). No soft-delete:
-- these are derived rows, recomputable and removed only by dropping a month.

CREATE TABLE public.flow_zone_minute (
    tenant_id uuid NOT NULL,
    location_id uuid NOT NULL,
    minute timestamptz NOT NULL,
    -- Estimated people in the zone: patients x attendant factor + visitors + staff.
    people_est integer,
    patients integer,
    waiting integer,
    checked_in integer,
    visitors integer,
    staff integer,
    -- Estimated wait for a token joining now, in minutes.
    wait_minutes numeric(6,1),
    -- Tokens called in the last 30 minutes, and the counters that called them.
    served_30m integer,
    open_counters integer,
    -- Per-counter queue: [{"label": "Counter 1", "waiting": 4}] (labels only).
    counters jsonb NOT NULL DEFAULT '[]'::jsonb,
    unknown_sources text[] NOT NULL DEFAULT '{}'
        CHECK (unknown_sources <@ ARRAY['tokens', 'appointments', 'visitors', 'roster']::text[]),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, location_id, minute)
) PARTITION BY RANGE (minute);

ALTER TABLE public.flow_zone_minute ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_zone_minute FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_flow_zone_minute ON public.flow_zone_minute
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE TRIGGER set_updated_at_flow_zone_minute BEFORE UPDATE ON public.flow_zone_minute
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

INSERT INTO partition_config (table_name, partition_column, partition_interval, premake,
                              retention_months, retention_action)
VALUES ('flow_zone_minute', 'minute', 'month', 2, 1, 'drop')
ON CONFLICT (table_name) DO NOTHING;

SELECT ensure_partitions_with_rls();
