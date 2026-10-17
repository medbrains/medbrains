-- ====================================================================
-- Migration: 1092_webhook_subscriptions.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: webhook_subscriptions, webhook_deliveries
-- Drops: none
-- ====================================================================
-- An integration partner subscribes to events and is told when they happen:
-- an HTTPS POST, signed with a secret only the hospital and the partner
-- hold, retried by the outbox until it lands or is given up on. Every
-- attempt is kept so a partner's "we never got it" has an answer.

CREATE TABLE public.webhook_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    name text NOT NULL CHECK (length(trim(name)) > 0),
    url text NOT NULL CHECK (url ~ '^https://'),
    signing_secret text NOT NULL,
    event_types text[] NOT NULL CHECK (cardinality(event_types) > 0),
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid NOT NULL REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text
);

CREATE INDEX idx_webhook_subscriptions_events ON public.webhook_subscriptions
    USING gin (event_types) WHERE deleted_at IS NULL AND is_active;

CREATE TABLE public.webhook_deliveries (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    subscription_id uuid NOT NULL REFERENCES public.webhook_subscriptions(id),
    outbox_event_id uuid NOT NULL,
    event_type text NOT NULL,
    attempt integer NOT NULL,
    status text NOT NULL CHECK (status IN ('delivered', 'retrying', 'failed')),
    response_status integer,
    error text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_deliveries_subscription ON public.webhook_deliveries
    (tenant_id, subscription_id, created_at DESC);

ALTER TABLE public.webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_subscriptions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_webhook_subscriptions ON public.webhook_subscriptions
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_webhook_deliveries ON public.webhook_deliveries
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE TRIGGER set_updated_at_webhook_subscriptions BEFORE UPDATE ON public.webhook_subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_webhook_subscriptions_soft_delete BEFORE DELETE ON public.webhook_subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
-- The delivery log is evidence of what was sent: it is never edited.
CREATE TRIGGER trg_webhook_deliveries_append_only BEFORE UPDATE OR DELETE ON public.webhook_deliveries
    FOR EACH ROW EXECUTE FUNCTION public.audit_append_only();
