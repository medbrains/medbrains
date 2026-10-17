-- Orders sent to an analyzer (#227) are outbound device_messages pointing at
-- the lab order; the worklist poll asks "was this order already delivered to
-- this device" for every collected sample.
CREATE INDEX IF NOT EXISTS idx_device_messages_outbound_entity
    ON device_messages (device_instance_id, target_entity_id)
    WHERE direction = 'outbound' AND deleted_at IS NULL;
