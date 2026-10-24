-- ====================================================================
-- Migration: 1206_request_role_preauth_lookups.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- The lookups that still ran before anybody had a tenant, answered the way
-- 0986, 0987 and 1200 answered theirs.
--
-- Production requests move to `medbrains_app`, which row level security
-- applies to. Each caller below arrives with no hospital: a payment
-- provider's notice, a display asking to be paired, a bridge agent, a public
-- prescription link. The secret it carries is how its hospital is found, so
-- under row level security the lookup found nothing (or a row with no tenant
-- could not be written) and the request failed.
--
-- Each function does one fixed thing, returns the least the caller needs —
-- usually just the tenant, after which the request runs under that tenant —
-- and is executable by `medbrains_app` only.

-- Which hospital a provider's order reference belongs to. `p_gateway` NULL
-- matches any provider (RazorpayX names only the virtual account).
CREATE OR REPLACE FUNCTION public.app_gateway_txn_tenant(p_gateway TEXT, p_order_ref TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT t.tenant_id
      FROM public.payment_gateway_transactions t
     WHERE t.gateway_order_id = p_order_ref
       AND (p_gateway IS NULL OR t.gateway = p_gateway)
     LIMIT 1
$$;

-- File a notice that matched no hospital's payment. It has no tenant, which
-- the table's policy refuses to write; this inserts the four fields and
-- nothing else.
CREATE OR REPLACE FUNCTION public.app_log_unmatched_webhook(
    p_provider TEXT, p_order_ref TEXT, p_reason TEXT, p_payload JSONB
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    INSERT INTO public.payment_webhook_exceptions (provider, order_ref, reason, raw_payload)
    VALUES (p_provider, p_order_ref, p_reason, p_payload)
$$;

-- A display asks to be paired: one pending request, no tenant yet.
CREATE OR REPLACE FUNCTION public.app_open_device_pairing_request(
    p_device_code TEXT, p_user_code TEXT, p_app_variant TEXT, p_label TEXT,
    p_public_key_pem TEXT, p_expires_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    INSERT INTO public.device_pairing_requests
           (device_code, user_code, app_variant, requested_label, public_key_pem, expires_at)
    VALUES (p_device_code, p_user_code, p_app_variant, p_label, p_public_key_pem, p_expires_at)
$$;

-- The display polls with its secret device code. Counts the poll and locks
-- the row for the rest of the caller's transaction (an UPDATE, so as good as
-- FOR UPDATE); returns the count as it was before this poll.
CREATE OR REPLACE FUNCTION public.app_poll_device_pairing_request(p_device_code TEXT)
RETURNS TABLE (
    id UUID, tenant_id UUID, status TEXT, app_variant TEXT, public_key_pem TEXT,
    approved_for_user_id UUID, expires_at TIMESTAMPTZ, poll_count INTEGER
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.device_pairing_requests r
       SET poll_count = r.poll_count + 1, last_polled_at = now()
     WHERE r.device_code = p_device_code
    RETURNING r.id, r.tenant_id, r.status, r.app_variant, r.public_key_pem,
              r.approved_for_user_id, r.expires_at, r.poll_count - 1
$$;

-- Which hospital a pairing token was issued by.
CREATE OR REPLACE FUNCTION public.app_device_pairing_token_tenant(p_token TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT t.tenant_id FROM public.device_pairing_tokens t
     WHERE t.token = p_token AND t.deleted_at IS NULL
$$;

-- A bridge agent registers before it belongs to any hospital.
CREATE OR REPLACE FUNCTION public.app_register_bridge_agent(
    p_name TEXT, p_key_hash TEXT, p_deployment_mode TEXT, p_version TEXT,
    p_hostname TEXT, p_capabilities TEXT[]
)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    INSERT INTO public.bridge_agents
           (name, agent_key_hash, deployment_mode, version, hostname, capabilities, status)
    VALUES (p_name, p_key_hash, p_deployment_mode, p_version, p_hostname, p_capabilities,
            'online')
    RETURNING id
$$;

-- A bridge agent's heartbeat, proven by its key. True when the agent exists.
CREATE OR REPLACE FUNCTION public.app_bridge_heartbeat(
    p_agent_id UUID, p_key_hash TEXT, p_devices_connected INTEGER, p_buffer_depth INTEGER
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    WITH hit AS (
        UPDATE public.bridge_agents
           SET status = 'online', last_heartbeat = now(),
               devices_connected = p_devices_connected, buffer_depth = p_buffer_depth
         WHERE id = p_agent_id AND agent_key_hash = p_key_hash AND is_active
        RETURNING 1
    )
    SELECT EXISTS (SELECT 1 FROM hit)
$$;

-- A public prescription link, if it is still live: the hospital and visit it
-- names, and how often it was checked before.
CREATE OR REPLACE FUNCTION public.app_rx_verify_link(p_token TEXT)
RETURNS TABLE (tenant_id UUID, encounter_id UUID, accessed_count INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT l.tenant_id, l.encounter_id, l.accessed_count
      FROM public.prescription_verify_links l
     WHERE l.token = p_token AND l.expires_at > now()
$$;

DO $$
DECLARE
    fn TEXT;
BEGIN
    FOREACH fn IN ARRAY ARRAY[
        'app_gateway_txn_tenant(TEXT, TEXT)',
        'app_log_unmatched_webhook(TEXT, TEXT, TEXT, JSONB)',
        'app_open_device_pairing_request(TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ)',
        'app_poll_device_pairing_request(TEXT)',
        'app_device_pairing_token_tenant(TEXT)',
        'app_register_bridge_agent(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[])',
        'app_bridge_heartbeat(UUID, TEXT, INTEGER, INTEGER)',
        'app_rx_verify_link(TEXT)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC', fn);
        EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO medbrains_app', fn);
    END LOOP;
END $$;
