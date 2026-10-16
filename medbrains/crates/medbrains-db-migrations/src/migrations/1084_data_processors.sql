-- ====================================================================
-- Migration: 1084_data_processors.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: data_processors
-- Drops: none
-- ====================================================================
-- DPDP Act s.8(2): a hospital may use a processor only under a contract, and
-- stays answerable for what it does; s.16: personal data sent abroad goes
-- only where it is allowed. The register names every outside service that
-- handles patient data, what it receives, the country it keeps it in, and
-- the agreement that binds it — including the processors' own sub-processors.

CREATE TABLE public.data_processors (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    name text NOT NULL,
    service text NOT NULL,
    data_categories text[] NOT NULL DEFAULT '{}'
        CHECK (data_categories <@ ARRAY['identity', 'contact', 'clinical', 'billing', 'images', 'staff']::text[]),
    country text NOT NULL DEFAULT 'IN',
    sub_processor_of uuid REFERENCES public.data_processors(id),
    dpa_reference text,
    dpa_signed_on date,
    dpa_expires_on date,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired')),
    notes text,
    created_by uuid NOT NULL REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT data_processors_country_code CHECK (country ~ '^[A-Z]{2}$'),
    CONSTRAINT data_processors_dpa_dates CHECK (dpa_expires_on IS NULL OR dpa_signed_on IS NULL OR dpa_expires_on >= dpa_signed_on)
);

CREATE UNIQUE INDEX uq_data_processors_name ON public.data_processors (tenant_id, lower(name))
    WHERE deleted_at IS NULL;

ALTER TABLE public.data_processors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_processors FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_data_processors ON public.data_processors
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE TRIGGER set_updated_at_data_processors BEFORE UPDATE ON public.data_processors
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_data_processors_soft_delete BEFORE DELETE ON public.data_processors
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
