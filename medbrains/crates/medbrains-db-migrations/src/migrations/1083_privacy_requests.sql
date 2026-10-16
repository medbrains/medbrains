-- ====================================================================
-- Migration: 1083_privacy_requests.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: privacy_requests
-- Drops: none
-- ====================================================================
-- DPDP Act 2023 s.11-14 and Rules 2025 r.14: a patient may ask what the
-- hospital holds about them, have it corrected or erased, name a nominee,
-- and complain; the hospital answers within 90 days. One row per request,
-- with the date it arrived and the date it is due. Erasure is limited by the
-- law that keeps medical records, so a refusal must say why.

CREATE TABLE public.privacy_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    patient_id uuid NOT NULL REFERENCES public.patients(id),
    request_type text NOT NULL
        CHECK (request_type IN ('access', 'correction', 'erasure', 'nominee', 'grievance')),
    details text NOT NULL,
    received_via text NOT NULL DEFAULT 'desk'
        CHECK (received_via IN ('desk', 'email', 'phone', 'letter', 'portal')),
    received_at timestamptz NOT NULL DEFAULT now(),
    due_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
    status text NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'completed', 'refused')),
    nominee_name text,
    nominee_relation text,
    nominee_contact text,
    decision text,
    decided_by uuid REFERENCES public.users(id),
    decided_at timestamptz,
    recorded_by uuid NOT NULL REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT privacy_requests_nominee_named
        CHECK (request_type <> 'nominee' OR nominee_name IS NOT NULL),
    CONSTRAINT privacy_requests_decided
        CHECK (status = 'open' OR (decision IS NOT NULL AND decided_by IS NOT NULL AND decided_at IS NOT NULL))
);

CREATE INDEX idx_privacy_requests_open ON public.privacy_requests (tenant_id, due_at)
    WHERE status = 'open' AND deleted_at IS NULL;
CREATE INDEX idx_privacy_requests_patient ON public.privacy_requests (tenant_id, patient_id, received_at DESC);

ALTER TABLE public.privacy_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_privacy_requests ON public.privacy_requests
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE TRIGGER set_updated_at_privacy_requests BEFORE UPDATE ON public.privacy_requests
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_privacy_requests_soft_delete BEFORE DELETE ON public.privacy_requests
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
