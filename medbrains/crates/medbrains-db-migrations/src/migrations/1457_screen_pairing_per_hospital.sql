-- ====================================================================
-- Migration: 1457_screen_pairing_per_hospital.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: function app_open_device_pairing_request
-- ====================================================================
-- A screen now names its hospital when it asks to be paired, and the person
-- approving it types the code the screen shows. So a request belongs to one
-- hospital from the moment it exists, and nothing needs to see a request with
-- no hospital any more:
--
--   * requests still waiting from before carry no hospital and were approved
--     by a code anyone could read off the list, so they are refused; a screen
--     that was waiting asks again by itself and shows a new code;
--   * a phone or tablet approved through this flow but not yet collected is
--     refused too: only screens pair this way now;
--   * the policy no longer lets a row with no hospital be seen, and new rows
--     must carry one (NOT VALID: old refused and collected rows keep theirs);
--   * the function that opened a request with no hospital goes, since the
--     server now opens it under the hospital's own context.
--
-- Screens already paired are untouched: their `paired_devices` rows and
-- tokens do not depend on this table.

UPDATE public.device_pairing_requests
   SET status = 'denied'
 WHERE node_id IS NULL
   AND (status = 'pending' OR (status = 'approved' AND app_variant <> 'tv'));

DROP POLICY IF EXISTS tenant_isolation_device_pairing_requests ON public.device_pairing_requests;
CREATE POLICY tenant_isolation_device_pairing_requests ON public.device_pairing_requests
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));

ALTER TABLE public.device_pairing_requests
    DROP CONSTRAINT IF EXISTS device_pairing_requests_has_tenant,
    ADD CONSTRAINT device_pairing_requests_has_tenant CHECK (tenant_id IS NOT NULL) NOT VALID;

DROP FUNCTION IF EXISTS public.app_open_device_pairing_request(TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ);
