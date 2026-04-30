-- ════════════════════════════════════════════════════════════════
-- 0059 — Device pairing infrastructure
-- ════════════════════════════════════════════════════════════════
--
-- Two tables:
--   device_pairing_tokens  short-lived (5 min) one-time codes the
--                          admin generates for an unpaired device.
--                          The admin shows a QR encoding the token;
--                          the device scans, posts to /api/device-
--                          pairing/pair, and exchanges it for a
--                          cert + JWT.
--
--   paired_devices         long-lived registry of every device that
--                          has paired into the tenant. Cert
--                          fingerprint binds JWT issuance to device
--                          identity; revoked_at terminates
--                          authorisation immediately.
--
-- mTLS posture: the device generates an Ed25519 keypair locally,
-- signs a CSR with the pairing token, and the server returns the
-- signed cert + a JWT scoped to the issuing user. cert_fingerprint
-- is the SHA-256 of the device's public key in DER form.

CREATE TABLE IF NOT EXISTS device_pairing_tokens (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  token                    TEXT NOT NULL UNIQUE,
  expires_at               TIMESTAMPTZ NOT NULL,
  used_at                  TIMESTAMPTZ,
  used_by_device_id        UUID,
  issued_by_user_id        UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  intended_device_label    TEXT NOT NULL,
  intended_app_variant     TEXT NOT NULL CHECK (intended_app_variant IN ('staff', 'tv', 'vendor')),
  intended_user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  notes                    TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_pairing_tokens_tenant
  ON device_pairing_tokens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_device_pairing_tokens_token
  ON device_pairing_tokens(token);
CREATE INDEX IF NOT EXISTS idx_device_pairing_tokens_unused
  ON device_pairing_tokens(tenant_id, expires_at)
  WHERE used_at IS NULL;

ALTER TABLE device_pairing_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY device_pairing_tokens_tenant_isolation
  ON device_pairing_tokens
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);


CREATE TABLE IF NOT EXISTS paired_devices (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  label                    TEXT NOT NULL,
  app_variant              TEXT NOT NULL CHECK (app_variant IN ('staff', 'tv', 'vendor')),
  cert_fingerprint         TEXT NOT NULL UNIQUE,
  cert_pem                 TEXT NOT NULL,
  issued_to_user_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  paired_via_token_id      UUID NOT NULL REFERENCES device_pairing_tokens(id) ON DELETE RESTRICT,
  paired_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at             TIMESTAMPTZ,
  last_seen_ip             INET,
  revoked_at               TIMESTAMPTZ,
  revoked_by_user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  revoked_reason           TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paired_devices_tenant
  ON paired_devices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_paired_devices_active
  ON paired_devices(tenant_id, last_seen_at)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_paired_devices_cert_fp
  ON paired_devices(cert_fingerprint);

ALTER TABLE paired_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY paired_devices_tenant_isolation
  ON paired_devices
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP TRIGGER IF EXISTS paired_devices_updated_at ON paired_devices;
CREATE TRIGGER paired_devices_updated_at
  BEFORE UPDATE ON paired_devices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Now that paired_devices exists, link the back-pointer on the
-- token table.
ALTER TABLE device_pairing_tokens
  ADD CONSTRAINT fk_device_pairing_tokens_used_by_device
  FOREIGN KEY (used_by_device_id) REFERENCES paired_devices(id) ON DELETE SET NULL;
