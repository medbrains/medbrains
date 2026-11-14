-- ====================================================================
-- Migration: 1458_form_friction_daily.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: form_friction_daily
-- Drops: none
-- ====================================================================
-- Form friction: how many saves the server refused (400, 422) per screen per
-- day. A refusal usually means the form let a bad entry through, so a ranked
-- count is a list of forms to fix — or of server rules that are wrong.
--
-- Aggregate only. A row names the route template (never a path with ids), the
-- HTTP method, the status, the caller's role and the refusal reason with every
-- value scrubbed out. No patient, no user id, no name, no submitted value.
-- Written once a minute by the server's in-memory counter
-- (medbrains-server-core/src/form_friction.rs), never on the request path.
--
-- Partitioned by month and registered with `partition_config`, so the daily
-- partition job drops a month once it is 13 months old (about 400 days kept).
-- No soft-delete: derived counts, removed only by dropping a month.

CREATE TABLE public.form_friction_daily (
    tenant_id uuid NOT NULL,
    day date NOT NULL,
    method text NOT NULL CHECK (length(method) <= 10),
    route text NOT NULL CHECK (length(route) <= 200),
    status smallint NOT NULL CHECK (status IN (400, 422)),
    role text NOT NULL CHECK (length(role) <= 64),
    message text NOT NULL CHECK (length(message) <= 120),
    count bigint NOT NULL CHECK (count > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    -- The upsert key; tenant and day lead, so it also serves the report's
    -- "this hospital, these days" read.
    PRIMARY KEY (tenant_id, day, method, route, status, role, message)
) PARTITION BY RANGE (day);

ALTER TABLE public.form_friction_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_friction_daily FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_form_friction_daily ON public.form_friction_daily
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE TRIGGER set_updated_at_form_friction_daily BEFORE UPDATE ON public.form_friction_daily
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

INSERT INTO partition_config (table_name, partition_column, partition_interval, premake,
                              retention_months, retention_action)
VALUES ('form_friction_daily', 'day', 'month', 2, 13, 'drop')
ON CONFLICT (table_name) DO NOTHING;

SELECT ensure_partitions_with_rls();
