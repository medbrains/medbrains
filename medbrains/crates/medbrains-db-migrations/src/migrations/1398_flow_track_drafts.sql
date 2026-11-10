-- ====================================================================
-- Migration: 1398_flow_track_drafts.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: flow_track_drafts
-- Drops: none
-- ====================================================================
-- SOP flows, phase 1b (RFCs/RFC-SOP-FLOWS.md §11): the track builder.
--
-- flow_track_drafts: a flow designer's working copy of a flow's track (its
-- stations, as JSON validated against the registered building blocks). One
-- open draft per flow per hospital. Drafts never affect patients: only a
-- published workflow_templates row does, and a draft reaches one only
-- through a knowledge change set approved by the quality officer and the
-- medical superintendent.
--
-- revision counts saves, so a save from a stale screen is refused and an
-- approved change set applies only the exact revision that was checked.
-- dry_run_revision is the revision the server last dry-ran; proposing needs
-- it to equal revision. base_template_id is the published version the draft
-- started from; if another change publishes first, the draft is stale.
--
-- No runtime DDL: data a designer adds to a station lives in versioned form
-- templates and workflow_instances.state (§11.3a).

CREATE TABLE public.flow_track_drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    flow_code text NOT NULL CHECK (length(btrim(flow_code)) BETWEEN 1 AND 80),
    base_template_id uuid REFERENCES public.workflow_templates(id),
    stations jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(stations) = 'array'),
    revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
    dry_run_revision integer,
    dry_run_at timestamptz,
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'discarded')),
    published_template_id uuid REFERENCES public.workflow_templates(id),
    created_by uuid REFERENCES public.users(id),
    updated_by uuid REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT flow_track_drafts_dry_run_shape
        CHECK ((dry_run_revision IS NULL) = (dry_run_at IS NULL)
               AND (dry_run_revision IS NULL OR dry_run_revision <= revision))
);
CREATE UNIQUE INDEX uq_flow_track_drafts_open
    ON public.flow_track_drafts (tenant_id, flow_code)
    WHERE status = 'draft' AND deleted_at IS NULL;
CREATE INDEX idx_flow_track_drafts_base_template ON public.flow_track_drafts (base_template_id);
CREATE INDEX idx_flow_track_drafts_published_template
    ON public.flow_track_drafts (published_template_id);
CREATE INDEX idx_flow_track_drafts_created_by ON public.flow_track_drafts (created_by);
CREATE INDEX idx_flow_track_drafts_updated_by ON public.flow_track_drafts (updated_by);

ALTER TABLE public.flow_track_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_track_drafts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_flow_track_drafts ON public.flow_track_drafts
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
CREATE TRIGGER set_updated_at_flow_track_drafts BEFORE UPDATE ON public.flow_track_drafts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_flow_track_drafts_soft_delete BEFORE DELETE ON public.flow_track_drafts
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
