-- ====================================================================
-- Migration: 1077_tenant_subscriptions.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: tenant_subscriptions
-- Drops: none
-- ====================================================================
-- What a hospital signed up for and where its subscription stands: the
-- 30-day trial a self-serve sign-up starts on, the facility it described,
-- where it chose to run, and the sizing it was quoted. One row per hospital.
-- A hospital created before self-serve sign-up has no row: it is a customer
-- the vendor set up by hand, not a trial.

CREATE TABLE IF NOT EXISTS public.tenant_subscriptions (
    tenant_id      uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    status         text NOT NULL DEFAULT 'trial'
        CHECK (status IN ('trial', 'active', 'grace', 'locked', 'cancelled')),
    placement      text NOT NULL
        CHECK (placement IN ('shared_cloud', 'dedicated_cloud', 'on_prem')),
    beds           integer NOT NULL CHECK (beds BETWEEN 0 AND 5000),
    staff_users    integer NOT NULL CHECK (staff_users BETWEEN 1 AND 20000),
    imaging        boolean NOT NULL DEFAULT false,
    -- The quote shown at sign-up, kept as it was shown.
    sizing         jsonb NOT NULL DEFAULT '{}'::jsonb,
    trial_ends_at  timestamptz,
    -- Where the sign-up came from, to throttle repeat trials. Not shown anywhere.
    signup_ip      text,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    deleted_at     timestamptz,
    deleted_by     uuid,
    delete_reason  text,
    CHECK (status <> 'trial' OR trial_ends_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_signup_ip
    ON public.tenant_subscriptions (signup_ip, created_at) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_tenant_subscriptions_updated_at ON public.tenant_subscriptions;
CREATE TRIGGER trg_tenant_subscriptions_updated_at
    BEFORE UPDATE ON public.tenant_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_tenant_subscriptions_soft_delete ON public.tenant_subscriptions;
CREATE TRIGGER trg_tenant_subscriptions_soft_delete
    BEFORE DELETE ON public.tenant_subscriptions
    FOR EACH ROW EXECUTE FUNCTION soft_delete_guardrail();

ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_subscriptions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_tenant_subscriptions ON public.tenant_subscriptions;
CREATE POLICY tenant_isolation_tenant_subscriptions ON public.tenant_subscriptions
    USING (tenant_id = ANY (app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (app_visible_tenants()));

-- Sign-ups from one address in the last day, across hospitals — the throttle
-- must see other tenants' rows, and a count is all it may return.
CREATE OR REPLACE FUNCTION public.app_recent_trial_signups(p_ip text)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT COUNT(*) FROM public.tenant_subscriptions
     WHERE signup_ip = p_ip AND created_at > now() - interval '1 day' AND deleted_at IS NULL
$$;
