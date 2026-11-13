-- ====================================================================
-- Migration: 1457_screen_pairing_per_hospital.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: function app_open_device_pairing_request
-- ====================================================================
-- A screen now names its hospital when it asks to be paired, and the person
-- approving it types the code the screen shows. So a request belongs to one
-- hospital from the moment it exists, and nothing needs a request with no
-- hospital any more:
--
--   * requests with no hospital were never approved (approving set one), so
--     they are deleted; a screen still polling one is told "expired" and asks
--     again by itself. Deleted rather than refused: the poll counts before it
--     reads the status, so a row left without a hospital would fail the
--     column below on every poll;
--   * a phone or tablet approved through this flow but not yet collected is
--     refused: only screens pair this way now;
--   * `tenant_id` becomes NOT NULL, and the policy no longer lets a row with
--     no hospital be seen;
--   * the function that opened a request with no hospital goes, since the
--     server now opens it under the hospital's own context.
--
-- Screens already paired are untouched: their `paired_devices` rows and
-- tokens do not depend on this table. Re-runnable, which the migration test
-- relies on.

DELETE FROM public.device_pairing_requests WHERE tenant_id IS NULL;

UPDATE public.device_pairing_requests
   SET status = 'denied'
 WHERE node_id IS NULL AND status = 'approved' AND app_variant <> 'tv';

ALTER TABLE public.device_pairing_requests ALTER COLUMN tenant_id SET NOT NULL;

DROP POLICY IF EXISTS tenant_isolation_device_pairing_requests ON public.device_pairing_requests;
CREATE POLICY tenant_isolation_device_pairing_requests ON public.device_pairing_requests
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));

DROP FUNCTION IF EXISTS public.app_open_device_pairing_request(TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ);
