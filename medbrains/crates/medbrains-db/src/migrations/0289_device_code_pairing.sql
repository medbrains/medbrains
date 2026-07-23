-- Device-code pairing for camera-less surfaces (RFC 8628 shape).
--
-- The existing flow in 0059 is admin-first: an administrator mints a token and
-- the device redeems it. That suits a phone, which can scan the QR the admin is
-- holding. A TV has no camera, so the direction has to reverse — the display
-- asks for a code, shows it, and an administrator approves it from a device
-- that does have a keyboard.
--
-- Two codes, as the RFC has them, because they do different jobs:
--   user_code    short and unambiguous, shown on the TV and read aloud or typed
--                by whoever approves it
--   device_code  long and secret, never displayed, the only thing that can
--                redeem the approval
--
-- Approving does not itself mint the JWT. The device polls, and the JWT is
-- issued to the poller holding device_code, so a shoulder-surfed user_code
-- cannot be redeemed by a bystander.

CREATE TABLE IF NOT EXISTS device_pairing_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Null until approved: the display does not know its tenant yet, which is
  -- the whole reason it is asking.
  tenant_id           UUID REFERENCES tenants(id) ON DELETE CASCADE,
  device_code         TEXT NOT NULL UNIQUE,
  user_code           TEXT NOT NULL UNIQUE,
  app_variant         TEXT NOT NULL CHECK (app_variant IN ('staff', 'tv', 'vendor')),
  requested_label     TEXT NOT NULL,
  public_key_pem      TEXT,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'approved', 'denied', 'claimed')),
  approved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_for_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at         TIMESTAMPTZ,
  claimed_at          TIMESTAMPTZ,
  paired_device_id    UUID REFERENCES paired_devices(id) ON DELETE SET NULL,
  expires_at          TIMESTAMPTZ NOT NULL,
  -- Rate-limits polling without a separate store.
  poll_count          INTEGER NOT NULL DEFAULT 0,
  last_polled_at      TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The approval screen lists what is waiting, so it reads by status and age.
CREATE INDEX IF NOT EXISTS idx_device_pairing_requests_pending
  ON device_pairing_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_pairing_requests_tenant
  ON device_pairing_requests(tenant_id);

-- Unapproved requests carry no tenant, so they cannot be tenant-scoped by
-- policy; they are reachable only by an unguessable code and expire in minutes.
-- Once approved the row belongs to a tenant and is isolated like everything else.
ALTER TABLE device_pairing_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_device_pairing_requests ON device_pairing_requests
  USING (
    tenant_id IS NULL
    OR tenant_id::text = current_setting('app.tenant_id', true)
  )
  WITH CHECK (
    tenant_id IS NULL
    OR tenant_id::text = current_setting('app.tenant_id', true)
  );

-- A device paired by code went through no token, so the column now means
-- "the token, when pairing went that way" rather than "always a token".
ALTER TABLE paired_devices ALTER COLUMN paired_via_token_id DROP NOT NULL;
