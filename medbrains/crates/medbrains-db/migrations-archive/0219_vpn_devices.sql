-- Migration: 0219_vpn_devices.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- VPN device inventory (RFC-VPN-PLATFORM, Phase 1). One row per enrolled remote
-- device. The device joins the on-prem Headscale tailnet via a per-device,
-- single-use pre-auth key minted by POST /api/vpn/enroll; revoked on logout-all /
-- deprovision / role loss. Tenant-scoped RLS (app.tenant_id).

CREATE TABLE IF NOT EXISTS vpn_devices (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name              text NOT NULL,
    headscale_node_id text,
    created_at        timestamptz NOT NULL DEFAULT now(),
    last_seen_at      timestamptz,
    revoked_at        timestamptz
);

CREATE INDEX IF NOT EXISTS idx_vpn_devices_tenant_user
    ON vpn_devices (tenant_id, user_id) WHERE revoked_at IS NULL;

ALTER TABLE vpn_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY vpn_devices_tenant_isolation ON vpn_devices
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
