# VPN platform — dev setup (Phase 1 foundation)

See `RFCs/RFC-VPN-PLATFORM.md` for the full design. This is the on-prem,
WireGuard/Headscale-based remote-access VPN. **Opt-in** — most hospitals run on
LAN and skip it entirely; those wanting turnkey remote access enable it.

## What's in this slice
- `vpn_devices` table (migration `0219`) — the enrolled-device inventory (tenant-scoped RLS).
- `headscale` service in `docker-compose.yml` behind the **`vpn` profile** (off by default).
- `deploy/headscale/config.yaml` — minimal dev Headscale config.

## Run Headscale (dev)
```bash
docker compose --profile vpn up -d headscale
docker compose exec headscale headscale users create medbrains   # one-time
```
Headscale listens on `127.0.0.1:8080`. Its tailnet CIDR is `100.64.0.0/10`
(see `prefixes.v4`) — add that (or the tenant's slice of it) to
`tenants.allowed_ips` so `middleware/ip_restrict.rs` + Pingora admit VPN clients.

## Flow (once the enroll API lands — Phase 1b)
1. User authenticates to MedBrains → **step-up (MFA)** → `POST /api/vpn/enroll {device_name}`.
2. Backend calls Headscale to mint a **single-use, short-expiry pre-auth key**, records a
   `vpn_devices` row, audits `vpn_enrolled`.
3. Client: `tailscale up --login-server http://<headscale> --authkey <key>` → joins → gets a
   `100.64.x.x` address in the allowlisted CIDR → reaches the HIMS API over WireGuard.
4. Revoke (logout-all / deprovision) → backend expires the node in Headscale + sets `revoked_at`.

## Prod (later)
Terraform module: Headscale container/VM on-prem, TLS via the proxy, persistent volume (or Postgres
backend), `server_url` = the VPN-internal hostname. `MEDBRAINS_HEADSCALE_URL` + API key via the
secret resolver. Never expose Headscale's API without auth.

## If you already have a corporate VPN
Skip all of this: set `tenants.allowed_ips` to your VPN's CIDR. The platform is only for hospitals
that want a first-party turnkey solution.
