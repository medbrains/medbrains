# MedBrains on-prem — one box, any OS

For a hospital that wants the system on hardware it owns. Runs the same way on
**Windows Server** (Docker Desktop / WSL2), Linux and macOS, because nothing is
installed on the host — everything is a container.

This is not the same as `deploy/standalone/`, which is Ubuntu + systemd +
Pingora + certbot and assumes a public DNS name. Use that one for an
internet-facing single server. Use this one for a box on the hospital LAN.

## Which proxy — and Pingora is the default where it runs

**Prefer `medbrains-proxy` (Pingora).** It is not merely a reverse proxy: it
enforces per-route body limits, requires an idempotency key on `/api/sync/`
and `/api/outbox/`, sets CSP, and blocks source maps — all from
`PingoraProxy.toml`, no rebuild. Caddy does none of that, and on the offline /
outbox path the idempotency enforcement is real behaviour, not decoration.

Use Caddy **only** when Pingora cannot run. Two cases, both hard:

1. **Windows.** Pingora is Linux-first. If the hospital's box is Windows
   Server, Pingora is not an option and Caddy is.
2. **A LAN with no public DNS.** `PingoraProxy.toml` reads `fullchain.pem` and
   `privkey.pem` from disk; certbot puts them there by proving the domain over
   HTTP-01, which needs public DNS and inbound port 80 from the internet. A
   ward box has neither, so somebody hand-generates a self-signed certificate
   and has to remember to replace it before it expires. Caddy's internal CA
   issues and renews itself.

| | Pingora | Caddy |
|---|---|---|
| Windows | no | yes |
| Certificate on an isolated LAN | manual, manual renewal | automatic, self-renewing |
| Public certificate | certbot alongside | built in |
| Edge policies (body limits, idempotency, CSP) | **yes, already written** | no |
| Throughput headroom | far higher | ample for one hospital |

### If you are on Linux and want Pingora here

Use `deploy/standalone/` — it is the Pingora path and it works. This kit
exists for the boxes that one cannot serve.

**What you give up by choosing Caddy:** the edge policies above. If the
deployment uses device sync or the outbox, port those rules into the
`Caddyfile` (`request_body max_size` per matcher gets some of it; the
idempotency requirement has no Caddy equivalent without a plugin) or accept
that they are enforced only by the application.

## Quick start

```sh
cp .env.example .env          # then edit it
pnpm --filter @medbrains/web build      # produces apps/web/dist
docker compose --env-file .env up -d
```

On Windows use PowerShell and the same commands — Docker Desktop must be
running with the WSL2 backend.

## What the network team needs

### The box

**A static IP, or a DHCP reservation.** Not optional. Paired devices, TV
boards, kiosks and the edge appliance all address this machine, and a lease
change silently breaks every one of them.

**An internal DNS A record** pointing at it — `hims.hospital.local` or
similar. Better than an IP: the certificate is issued for a name, and changing
the IP later then costs one DNS edit instead of a re-trust on every
workstation.

### Ports

| Port | Proto | From | To | Why |
|---|---|---|---|---|
| 443 | TCP | ward LAN | server | the only way in. Web, API, websockets |
| 80 | TCP | ward LAN | server | redirect to 443. Not needed if staff always type https |
| 7811 | TCP | ward LAN | edge appliance | device sync, if an edge box is deployed |
| 5353 | UDP | ward LAN | broadcast | mDNS, how devices find the edge box |

**Nothing else is published.** Postgres, the API container and Gotenberg talk
over the compose network and are not reachable from the LAN even from the same
machine. Do not open 5432.

### LAN vs WAN

The system runs with **no internet at all**. Everything clinical is local.

WAN is needed only for these, and each is optional:

| Wants internet | For | If unavailable |
|---|---|---|
| SMS / OTP delivery | patient portal sign-in, booking codes | those features are off; staff book at the desk |
| ABDM / Health ID | national health ID | unused |
| WHO ICD-API | ICD-11 coding | run the `icd-api` sidecar locally instead |
| Public TLS certificate | a real cert instead of the internal CA | use the internal CA (default here) |

If outbound is allowed at all, prefer an allowlist over open egress — the
codebase has an egress allowlist check in CI for exactly this reason.

### The IP-range trap worth raising now

**Docker's default bridge network is `172.17.0.0/16`.** If the hospital uses
anything in `172.16.0.0/12` on its LAN — many do — containers will fail to
reach hosts on that range, and the symptom looks like a random subset of the
network being down. Ask the network team what they use, and if it overlaps,
set a different pool before first start:

```json
// Windows: %ProgramData%\docker\config\daemon.json
// Linux:   /etc/docker/daemon.json
{
  "default-address-pools": [
    { "base": "10.201.0.0/16", "size": 24 }
  ]
}
```

Pick a base the hospital confirms is free. Changing it later means recreating
every container.

### Remote access

If the vendor needs to reach the box for support, do not port-forward 443 to
the internet. The repo carries a WireGuard/Headscale module
(`infra/terraform/modules/headscale`) for exactly this.

## Trusting the certificate

With `tls internal`, Caddy runs its own CA. Browsers warn until its root is
trusted. Export it once:

```sh
docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt ./medbrains-root.crt
```

Then distribute it — Group Policy on a Windows domain, MDM on tablets, or by
hand on a small pilot. On Android 14+ a user-installed CA is not trusted by
apps by default; a device that must sync over TLS needs the CA at system
level, or a publicly trusted certificate via the DNS-01 option in the
`Caddyfile`.

**Do not skip this and serve plain HTTP.** Session cookies and patient data on
a ward network in the clear is worse than a warning somebody clicks once.

## Backups

The compose file keeps everything in named volumes. Back up
`medbrains-pgdata` (the database) and `medbrains-objects` (uploaded scans and
documents). A Postgres dump alone is not enough — the object volume holds
files the database only references.

`deploy/standalone/medbrains-pg-backup` is a working nightly dump script; it
is systemd-based, so on Windows use Task Scheduler calling
`docker compose exec postgres pg_dump`.

## Object storage

Defaults to the local filesystem inside the container, on a named volume. That
is the right choice for one hospital: no S3, no egress, no bucket policy.

To point at MinIO or a cloud bucket instead, set `S3_ENDPOINT`, `S3_BUCKET`,
`S3_REGION` and the key pair in `.env`. The client already sends path-style
requests to a custom endpoint, so MinIO works without code changes.

## Verified, and not

`docker compose config` parses and interpolates cleanly. **The `Caddyfile` has
not been run** — no Docker daemon was available on the machine this was written
on, so `caddy validate` could not execute. Run it once before a real
deployment:

```sh
docker run --rm -v "$PWD/Caddyfile:/etc/caddy/Caddyfile:ro" \
  caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile
```

Nothing in this directory has been stood up end to end against a running
system. Treat the first deployment as the test.

## What this kit does not do

- **No high availability.** One box. If it dies, the hospital is on paper
  until it is restored. For HA see `infra/terraform/modules-onprem/` (k3s +
  Patroni).
- **No automatic OS patching, no monitoring.** Whatever the hospital already
  runs.
- **No clinical validation.** Deploying this does not mean the clinical
  modules have been checked by a pharmacist or clinician. Scope what staff may
  use, in writing.
