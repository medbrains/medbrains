-- Bind node keys to the devices that actually sync.
--
-- 0298 bound `device_node_keys` to `device_instances`. That is the wrong table.
-- `device_instances` is the biomedical equipment registry — it carries
-- `adapter_code`, `hostname`, `port` and HL7/ASTM field mappings, and it models
-- analysers and monitors. Those do not run a CRDT sync client.
--
-- The devices that do are in `paired_devices`: staff phones, ward tablets, TV
-- boards and vendor devices, each paired by QR and holding a certificate. As
-- written, pairing a nurse's phone for sync would have meant inventing a fake
-- analyser record for it, with an `adapter_code` naming a protocol the phone
-- does not speak.
--
-- Existing rows are discarded rather than migrated. There is no sensible
-- mapping from an analyser to a phone, and the endpoints that created these
-- rows shipped in the same batch as this correction with no UI calling them —
-- any row here is a manual test, not a paired device somebody is relying on.

DELETE FROM public.device_node_keys;

ALTER TABLE public.device_node_keys
    DROP CONSTRAINT IF EXISTS device_node_keys_device_fkey;

DROP INDEX IF EXISTS uq_device_node_keys_device;

ALTER TABLE public.device_node_keys
    RENAME COLUMN device_instance_id TO paired_device_id;

ALTER TABLE public.device_node_keys
    ADD CONSTRAINT device_node_keys_paired_device_fkey
        FOREIGN KEY (paired_device_id) REFERENCES public.paired_devices (id)
        ON DELETE CASCADE;

-- One live key per device, as before. Unpairing a device removes its key with
-- it, which is why this FK cascades where the old one did not: a paired device
-- that is gone cannot have a key that still resolves.
CREATE UNIQUE INDEX IF NOT EXISTS uq_device_node_keys_paired_device
    ON public.device_node_keys (paired_device_id)
    WHERE revoked_at IS NULL;

COMMENT ON TABLE public.device_node_keys IS
    'Binds a peer-to-peer node key to a paired device (staff phone, tablet, TV). A key that is not bound here is not admitted, however valid its cryptography.';
