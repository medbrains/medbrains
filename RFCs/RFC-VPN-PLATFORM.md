# RFC — MedBrains VPN Platform (on-prem, WireGuard/Headscale, auth-integrated)

Status: DRAFT · Owner: platform · Supersedes: the "Phase 4/5 VPN" section of the auth-revamp plan

## 1. Thesis
Give hospitals a **first-party, on-prem VPN** for remote staff to reach the HIMS — owned and run by
the hospital, **no third-party cloud, no PHI-adjacent metadata leaving the building**, and identity
tied to MedBrains auth + access-groups. We do **not** invent a VPN protocol: we stand on **WireGuard**
(kernel-audited crypto) and a **self-hosted control plane (Headscale**, the open-source Tailscale
server). MedBrains owns the **identity, enrollment, ACL policy, client UX, and audit**; WireGuard owns
the tunnel. This is "our own VPN platform" the safe way.

Non-goals: rolling our own crypto/handshake; a public multi-tenant VPN SaaS; replacing the hospital's
existing corporate VPN if they already have one (they just allowlist its CIDR — see §8).

## 2. Why Headscale (not Tailscale-cloud, not custom)
- **On-prem + data-sovereign** — the coordination server runs in the hospital; no metadata to a vendor.
- **Proven clients + crypto** — standard WireGuard + Tailscale clients; we don't ship a network stack.
- **API-driven** — Headscale has an HTTP/gRPC API + pre-auth keys + ACL policy we can automate from
  MedBrains. Custom WireGuard orchestration would reinvent exactly this (months) for no gain.

## 3. Architecture
```
 Remote staff device                MedBrains (on-prem)                 Headscale (on-prem)
 ┌───────────────┐   1. login+enroll ┌──────────────────┐  2. mint key  ┌──────────────────┐
 │ Branded client│ ────────────────► │ /api/vpn/*       │ ────────────► │ control server   │
 │ (Tauri/WG)    │ ◄──────────────── │ enroll/status/   │ ◄──────────── │ (pre-auth keys,  │
 └──────┬────────┘   3. WG config    │ revoke + ACL sync│  ACL policy   │  ACLs, peers)    │
        │ 4. WireGuard tunnel (data plane, never through MedBrains)      └──────────────────┘
        ▼
 HIMS API (behind Pingora) ── ip_restrict allowlists the tailnet CIDR (already shipped #3593)
```
- **Data plane** = WireGuard peer-to-peer (device ↔ on-prem network). MedBrains is only the **control
  plane** (who may enroll, what they may reach), never in the packet path.
- **Enforcement** = the tailnet CIDR is in `tenants.allowed_ips`; `middleware/ip_restrict.rs` +
  Pingora gate the API. Already built.

## 4. Components & phases
- **P1 — Headscale + auth-tied enrollment** (backend + infra). Deploy Headscale (docker-compose dev /
  Terraform prod). New `medbrains-server` **VPN module**: `POST /api/vpn/enroll` (authenticated, MFA/
  step-up required → call Headscale API to mint a single-use, expiring **pre-auth key** scoped to this
  user/device → return join info), `GET /api/vpn/status`, `POST /api/vpn/revoke` (deprovision device).
  Headscale URL + API key resolved via the existing `secret_resolver`. Audit every enroll/revoke.
- **P2 — Branded desktop client** (Tauri, `apps/desktop`). Connect/Disconnect + tailnet status, driving
  the local WireGuard/Tailscale client or `wireguard-go`. Uses the enroll API + `secureStore` (keyring
  #3403) for the key. Web "Set up remote access" page = download client + show enroll status.
- **P3 — ACL sync** (backend). Translate MedBrains **access-groups → Headscale ACL policy** so VPN
  reachability follows RBAC (e.g. only the "remote-clinicians" group can reach the HIMS subnet).
  Re-synced on membership change (ties into the auth-revamp perm_version work).
- **P4 — Lifecycle** — auto-revoke the device on logout-all / user deprovision / role loss; key
  rotation; expiry; an admin **device inventory** page (who's enrolled, last seen, revoke).
- **P5 — Mobile** (later) — same enroll API; WireGuard mobile SDK.

## 5. Enrollment flow (P1)
1. Authenticated user (web/desktop) hits **"Enable remote access"** → **step-up re-auth** (password/MFA;
   ties to the auth-revamp step-up work).
2. `POST /api/vpn/enroll {device_name}` → backend `require_permission(vpn.enroll)` → calls Headscale
   `POST /api/v1/preauthkey` (reusable=false, ephemeral=false, expiry≈24h, tags=`tag:tenant-<id>`).
3. Backend records the device (`vpn_devices` table: user_id, tenant_id, node_key?, name, created,
   last_seen, revoked) + audits `vpn_enrolled`.
4. Client runs `tailscale up --login-server <headscale> --authkey <key>` (or WG config) → joins →
   gets a stable IP in the tenant's tailnet CIDR (which is in `allowed_ips`).
5. Now the device reaches the HIMS API over WireGuard; `ip_restrict` passes it.

## 6. Security
- **Never hand-roll crypto** — WireGuard only. Headscale is the sole trusted control plane, on-prem.
- **Enrollment gated** by MedBrains auth + `vpn.enroll` permission + **step-up (MFA)**. Pre-auth keys
  are single-use, short-expiry, per-device, tagged by tenant.
- **Revocation** — logout-all / deprovision / role loss → backend calls Headscale to expire the node +
  marks `vpn_devices.revoked`. Key never reusable.
- **Isolation** — ACLs (P3) restrict a device to the HIMS subnet only, not the whole LAN.
- **Audit** — enroll, revoke, ACL change, connect (from Headscale logs) → `audit_log`.
- **Secrets** — Headscale API key + server URL via `secret_resolver`/KMS, never in code or the client.
- New dep review: a small Headscale HTTP client (reqwest, already in tree) — no heavy new crate.

## 7. Data model (new)
- `vpn_devices` (RLS): id, tenant_id, user_id, name, headscale_node_id, created_at, last_seen_at,
  revoked_at, source. Migration `0219_vpn_devices.sql`.
- `tenant_settings.vpn`: `enabled` (opt-in), `headscale_url`, `tailnet_cidr` (auto-added to
  `allowed_ips`), `require_step_up` (default true).

## 8. If the hospital already has a VPN
No platform needed — they set `tenants.allowed_ips` to their VPN's CIDR and skip P1–P5 entirely. The
platform is for hospitals that want a **turnkey, first-party** remote-access solution.

## 9. Deployment (full-automation per project rule)
- **Dev**: `docker-compose` service for Headscale + a seed pre-auth key.
- **Prod**: Terraform module (Headscale container/VM on-prem, TLS via the existing proxy, persistent
  volume for its DB). `MEDBRAINS_HEADSCALE_URL` + API key in secrets.

## 10. Verification
- P1: enroll returns a working pre-auth key; a client joins Headscale; the device gets a CIDR IP;
  the HIMS API is reachable over WG and rejected off-VPN (with enforcement on). Revoke kills access.
- Gate each PR: `cargo clippy` + TS gates + `make check-api`; **/security-review** (auth+network).
- E2E: enroll → connect → reach API → revoke → blocked.

## 11. Phase order
P1 (Headscale + enroll API + infra) → P2 (desktop client) → P3 (ACL sync) → P4 (lifecycle + admin
inventory) → P5 (mobile). P1 is the foundation and the first shippable slice.
