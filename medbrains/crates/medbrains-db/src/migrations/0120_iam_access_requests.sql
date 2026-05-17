-- ====================================================================
-- Migration: 0120_iam_access_requests.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: iam_access_requests
-- ====================================================================
-- IAM-style access requests sit above role permissions and below
-- resource-scoped ReBAC sharing. They let staff request temporary
-- module permissions without an administrator editing the user's base
-- role. Approved requests are applied to users.access_matrix as
-- temporary grants and are evaluated at login / token refresh.

CREATE TYPE public.iam_access_request_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'revoked',
    'expired'
);

CREATE TABLE public.iam_access_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL,
    requester_id uuid NOT NULL REFERENCES public.users(id),
    target_user_id uuid NOT NULL REFERENCES public.users(id),
    requested_permissions text[] NOT NULL,
    requested_modules text[] NOT NULL DEFAULT '{}'::text[],
    resource_scope jsonb NOT NULL DEFAULT '{}'::jsonb,
    reason text NOT NULL,
    requested_expires_at timestamp with time zone,
    status public.iam_access_request_status NOT NULL DEFAULT 'pending',
    reviewed_by uuid REFERENCES public.users(id),
    reviewed_at timestamp with time zone,
    review_note text,
    applied_at timestamp with time zone,
    revoked_by uuid REFERENCES public.users(id),
    revoked_at timestamp with time zone,
    revoke_reason text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT iam_access_requests_permissions_nonempty
        CHECK (array_length(requested_permissions, 1) > 0),
    CONSTRAINT iam_access_requests_reason_nonempty
        CHECK (length(btrim(reason)) >= 3),
    CONSTRAINT iam_access_requests_expiry_future_or_null
        CHECK (requested_expires_at IS NULL OR requested_expires_at > created_at)
);

CREATE INDEX idx_iam_access_requests_status
    ON public.iam_access_requests (tenant_id, status, created_at DESC);

CREATE INDEX idx_iam_access_requests_requester
    ON public.iam_access_requests (tenant_id, requester_id, created_at DESC);

CREATE INDEX idx_iam_access_requests_target
    ON public.iam_access_requests (tenant_id, target_user_id, created_at DESC);

DROP TRIGGER IF EXISTS update_iam_access_requests_updated_at ON public.iam_access_requests;
CREATE TRIGGER update_iam_access_requests_updated_at
    BEFORE UPDATE ON public.iam_access_requests
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

SELECT apply_tenant_rls('iam_access_requests');
