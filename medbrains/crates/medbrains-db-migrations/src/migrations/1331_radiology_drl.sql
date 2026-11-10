-- ====================================================================
-- Migration: 1331_radiology_drl.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: radiology_drls
-- Drops: none
-- ====================================================================
-- Diagnostic reference levels: what a standard adult CT of each region
-- should typically cost in dose, against which the hospital audits the
-- median of its own exams (ICRP 135). India has no national DRL set, so
-- each hospital keeps its own table. Every hospital starts with a published
-- regional survey's values, labelled as regional — not national — and edits
-- them as its physicist advises.
--
-- Seed: CT head, chest and abdomen, adult, South India
-- (Ramanathan et al. 2016, PMC6038221): CTDIvol 47 / 10 / 12 mGy and
-- DLP 1041 / 445 / 550 mGy·cm.

CREATE TABLE IF NOT EXISTS public.radiology_drls (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    region text NOT NULL CHECK (region IN
        ('head', 'head_neck', 'neck', 'chest', 'abdomen_pelvis', 'trunk')),
    metric text NOT NULL CHECK (metric IN ('ctdi_vol', 'dlp')),
    value numeric(10,2) NOT NULL CHECK (value > 0),
    source text NOT NULL,
    created_by uuid REFERENCES public.users(id),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_radiology_drls_level
    ON public.radiology_drls (tenant_id, region, metric) WHERE deleted_at IS NULL;

ALTER TABLE public.radiology_drls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_radiology_drls ON public.radiology_drls;
CREATE POLICY tenant_isolation_radiology_drls ON public.radiology_drls
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));
DROP TRIGGER IF EXISTS set_updated_at_radiology_drls ON public.radiology_drls;
CREATE TRIGGER set_updated_at_radiology_drls BEFORE UPDATE ON public.radiology_drls
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS trg_radiology_drls_soft_delete ON public.radiology_drls;
CREATE TRIGGER trg_radiology_drls_soft_delete BEFORE DELETE ON public.radiology_drls
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
DROP TRIGGER IF EXISTS audit_radiology_drls ON public.radiology_drls;
CREATE TRIGGER audit_radiology_drls
    AFTER INSERT OR DELETE OR UPDATE ON public.radiology_drls
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('radiology');

-- Every hospital's starting table, now and for each new hospital.
-- SECURITY DEFINER because a new tenant's context is not set when its row
-- is inserted; the table enables but does not FORCE row level security, so
-- the owner may write it (the 1208 pattern).
CREATE OR REPLACE FUNCTION public.seed_radiology_drls(p_tenant uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
    INSERT INTO public.radiology_drls (tenant_id, region, metric, value, source)
    SELECT p_tenant, r, m, v,
           'Regional survey, South India 2016 (PMC6038221) — not a national DRL'
      FROM (VALUES ('head', 'ctdi_vol', 47), ('head', 'dlp', 1041),
                   ('chest', 'ctdi_vol', 10), ('chest', 'dlp', 445),
                   ('abdomen_pelvis', 'ctdi_vol', 12), ('abdomen_pelvis', 'dlp', 550))
           AS seed(r, m, v)
    ON CONFLICT (tenant_id, region, metric) WHERE deleted_at IS NULL DO NOTHING;
$$;

REVOKE ALL ON FUNCTION public.seed_radiology_drls(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_radiology_drls(uuid) TO medbrains_app;

CREATE OR REPLACE FUNCTION public.trg_seed_radiology_drls() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    PERFORM public.seed_radiology_drls(NEW.id);
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS seed_radiology_drls ON public.tenants;
CREATE TRIGGER seed_radiology_drls AFTER INSERT ON public.tenants
    FOR EACH ROW EXECUTE FUNCTION public.trg_seed_radiology_drls();

SELECT public.seed_radiology_drls(id) FROM public.tenants;
