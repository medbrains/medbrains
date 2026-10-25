-- ====================================================================
-- Migration: 1221_research_exports.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: research_exports, research_export_downloads
-- Drops: none
-- ====================================================================
-- De-identified research datasets, released under maker-checker.
--
-- A holder of `research.dataset.export` asks for a dataset, naming the
-- purpose and the Institutional Ethics Committee (IEC) approval that covers
-- it. A different holder approves or rejects it; the requester never can.
-- On approval the server builds the extract (medbrains-research):
--   * patients appear only as a key made with this export's own salt, so two
--     exports cannot be joined on it;
--   * no name, phone, address, UHID, ABHA, Aadhaar or free text;
--   * ages in 5-year bands with 90+ grouped, dates truncated to the month;
--   * categories held by fewer than 5 patients become "Other";
--   * rows whose age band, sex and pincode prefix are shared by fewer than 5
--     patients are suppressed (k = 5), counted in the suppression report;
--   * restricted clinical classes and medico-legal records are left out.
-- The files are kept here, in the hospital's own database, for 24 hours
-- after they are ready; each download is recorded with the file's hash.
--
-- The salt never leaves the server and is cleared, with the files, once the
-- export expires (medbrains-research `purge_expired`).

CREATE TABLE public.research_exports (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    dataset text NOT NULL CHECK (dataset IN ('visits', 'diagnoses', 'admissions')),
    period_from date NOT NULL,
    period_to date NOT NULL,
    purpose text NOT NULL CHECK (length(btrim(purpose)) BETWEEN 20 AND 2000),
    iec_reference text NOT NULL CHECK (length(btrim(iec_reference)) BETWEEN 3 AND 120),
    status text NOT NULL DEFAULT 'requested'
        CHECK (status IN ('requested', 'rejected', 'ready', 'failed')),
    requested_by uuid NOT NULL REFERENCES public.users(id),
    requested_via text NOT NULL DEFAULT 'screen' CHECK (requested_via IN ('screen', 'assistant')),
    decided_by uuid REFERENCES public.users(id),
    decided_at timestamptz,
    decision_note text,
    salt bytea,
    data_csv bytea,
    dictionary_csv bytea,
    data_sha256 text,
    row_count integer CHECK (row_count >= 0),
    suppressed_rows integer CHECK (suppressed_rows >= 0),
    suppression_report jsonb,
    ready_at timestamptz,
    expires_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CHECK (period_from <= period_to),
    CHECK (decided_by IS NULL OR decided_by <> requested_by)
);
CREATE INDEX idx_research_exports_tenant_created
    ON public.research_exports (tenant_id, created_at DESC);
CREATE INDEX idx_research_exports_requested_by ON public.research_exports (requested_by);
CREATE INDEX idx_research_exports_decided_by ON public.research_exports (decided_by);

CREATE TABLE public.research_export_downloads (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    export_id uuid NOT NULL REFERENCES public.research_exports(id),
    user_id uuid NOT NULL REFERENCES public.users(id),
    file text NOT NULL CHECK (file IN ('data', 'dictionary')),
    sha256 text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text
);
CREATE INDEX idx_research_export_downloads_export ON public.research_export_downloads (export_id);
CREATE INDEX idx_research_export_downloads_user ON public.research_export_downloads (user_id);

ALTER TABLE public.research_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_exports FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_research_exports ON public.research_exports
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
CREATE TRIGGER set_updated_at_research_exports BEFORE UPDATE ON public.research_exports
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_research_exports_soft_delete BEFORE DELETE ON public.research_exports
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

ALTER TABLE public.research_export_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_export_downloads FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_research_export_downloads ON public.research_export_downloads
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
CREATE TRIGGER set_updated_at_research_export_downloads BEFORE UPDATE ON public.research_export_downloads
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_research_export_downloads_soft_delete BEFORE DELETE ON public.research_export_downloads
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
