-- ====================================================================
-- Migration: 1085_portal_privacy_requests.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- A patient may make a DPDP request from the portal or the patient apps
-- themselves; no member of staff takes it down. Such a request has no
-- recorder, and only such a request may lack one.

ALTER TABLE public.privacy_requests ALTER COLUMN recorded_by DROP NOT NULL;
ALTER TABLE public.privacy_requests DROP CONSTRAINT IF EXISTS privacy_requests_recorded;
ALTER TABLE public.privacy_requests ADD CONSTRAINT privacy_requests_recorded
    CHECK (recorded_by IS NOT NULL OR received_via = 'portal');
