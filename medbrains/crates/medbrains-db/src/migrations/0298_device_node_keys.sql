-- Peer identities for direct device-to-device sync.
--
-- A peer-to-peer transport identifies a peer by its own public key. That key
-- proves the far end holds a private key; it proves nothing about whether the
-- device is one this hospital has admitted. Those are different questions, and
-- conflating them is how a transport becomes an authorisation system by
-- accident.
--
-- So a node key is never an identity on its own. It is a claim that must
-- already be bound to a paired `device_instances` row — which carries the
-- tenant, the app variant, and a status that an administrator can revoke. A key
-- with no binding here is refused before a single frame is read.
--
-- One key per device and one device per key: a device that rotates its key
-- replaces the row, and a key cannot be claimed by two devices.

CREATE TABLE IF NOT EXISTS public.device_node_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    device_instance_id uuid NOT NULL,
    -- The peer's public key, as the transport presents it.
    node_id text NOT NULL,
    -- Set when a key is retired. Rows are kept rather than deleted: an audit
    -- asking which device held a key at a point in time needs the history.
    revoked_at timestamp with time zone,
    revoked_by uuid,
    last_seen_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    CONSTRAINT device_node_keys_pkey PRIMARY KEY (id),
    CONSTRAINT device_node_keys_device_fkey
        FOREIGN KEY (device_instance_id) REFERENCES public.device_instances (id)
);

-- A node id is global to the transport, so uniqueness is global too. Scoping it
-- per tenant would let two tenants claim one key and make the lookup ambiguous
-- exactly where it must not be.
CREATE UNIQUE INDEX IF NOT EXISTS uq_device_node_keys_node_id
    ON public.device_node_keys (node_id)
    WHERE revoked_at IS NULL;

-- One live key per device.
CREATE UNIQUE INDEX IF NOT EXISTS uq_device_node_keys_device
    ON public.device_node_keys (device_instance_id)
    WHERE revoked_at IS NULL;

ALTER TABLE public.device_node_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS device_node_keys_tenant_isolation ON public.device_node_keys;
CREATE POLICY device_node_keys_tenant_isolation ON public.device_node_keys
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

COMMENT ON TABLE public.device_node_keys IS
    'Binds a peer-to-peer node key to a paired device. A key that is not bound here is not admitted, however valid its cryptography.';
