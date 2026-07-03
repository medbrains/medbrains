-- Optional network access layer (VPN/LAN): a per-tenant IP DENYLIST beside the
-- existing allowlist (tenants.allowed_ips, 0001_core.sql). Deny wins over allow.
-- Empty [] = no denials (opt-in; most hospitals run on LAN and set neither list).
-- CIDR strings (IPv4/IPv6), matched by middleware/ip_restrict.rs.

ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS blocked_ips jsonb DEFAULT '[]'::jsonb NOT NULL;
