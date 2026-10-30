-- ====================================================================
-- Migration: 1382_flow_alerts_recommendations.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: flow_alerts, flow_recommendations
-- Drops: none
-- ====================================================================
-- MedBrains Flow (#4901). A zone over its comfort limit or capacity raises an
-- alert to the supervisors; a queue whose wait is past target gets a
-- recommendation ("Billing: open another counter, est. wait 22 -> 9 min").
--
-- Both are de-duplicated by a partial unique index: one open alert per zone
-- per level, one open recommendation per zone per action. The aggregator
-- inserts with ON CONFLICT DO NOTHING, so a zone that stays red for an hour
-- raises one alert, not sixty.
--
-- A recommendation is advisory. Accepting it records who accepted it and
-- when; the system never opens a counter by itself.

CREATE TABLE public.flow_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    location_id uuid NOT NULL REFERENCES public.locations(id),
    level text NOT NULL CHECK (level IN ('comfort', 'capacity')),
    people_est integer NOT NULL CHECK (people_est >= 0),
    limit_value integer NOT NULL CHECK (limit_value > 0),
    raised_at timestamptz NOT NULL DEFAULT now(),
    acked_by uuid REFERENCES public.users(id),
    acked_at timestamptz,
    resolved_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT flow_alerts_ack_pair CHECK ((acked_by IS NULL) = (acked_at IS NULL))
);

CREATE UNIQUE INDEX uq_flow_alerts_open ON public.flow_alerts (tenant_id, location_id, level)
    WHERE resolved_at IS NULL AND deleted_at IS NULL;
CREATE INDEX idx_flow_alerts_raised ON public.flow_alerts (tenant_id, raised_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE public.flow_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_alerts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_flow_alerts ON public.flow_alerts
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE TRIGGER set_updated_at_flow_alerts BEFORE UPDATE ON public.flow_alerts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_flow_alerts_soft_delete BEFORE DELETE ON public.flow_alerts
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.flow_recommendations (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    location_id uuid NOT NULL REFERENCES public.locations(id),
    action text NOT NULL CHECK (action IN ('open_counter')),
    counters_open integer NOT NULL CHECK (counters_open >= 0),
    counters_suggested integer NOT NULL CHECK (counters_suggested > counters_open),
    waiting integer NOT NULL CHECK (waiting >= 0),
    wait_before_minutes numeric(6,1) NOT NULL CHECK (wait_before_minutes >= 0),
    wait_after_minutes numeric(6,1) NOT NULL CHECK (wait_after_minutes >= 0),
    target_minutes integer NOT NULL CHECK (target_minutes > 0),
    decision text CHECK (decision IN ('accepted', 'snoozed', 'dismissed')),
    decided_by uuid REFERENCES public.users(id),
    decided_at timestamptz,
    snoozed_until timestamptz,
    -- The condition cleared before anyone decided.
    expired_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT flow_recommendations_decision_pair
        CHECK ((decision IS NULL) = (decided_by IS NULL) AND (decision IS NULL) = (decided_at IS NULL)),
    CONSTRAINT flow_recommendations_snooze
        CHECK ((decision = 'snoozed') = (snoozed_until IS NOT NULL))
);

-- Open = undecided and not expired. A snoozed or decided one is closed; the
-- aggregator does not raise the same action again while a snooze runs.
CREATE UNIQUE INDEX uq_flow_recommendations_open
    ON public.flow_recommendations (tenant_id, location_id, action)
    WHERE decision IS NULL AND expired_at IS NULL AND deleted_at IS NULL;
CREATE INDEX idx_flow_recommendations_zone ON public.flow_recommendations (tenant_id, location_id, created_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE public.flow_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_recommendations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_flow_recommendations ON public.flow_recommendations
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE TRIGGER set_updated_at_flow_recommendations BEFORE UPDATE ON public.flow_recommendations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_flow_recommendations_soft_delete BEFORE DELETE ON public.flow_recommendations
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
