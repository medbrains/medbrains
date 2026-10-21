# MedBrains standalone deploy kit

Single-server deploy: postgres-17 in docker, medbrains-server as a
systemd unit, MedBrains Pingora edge proxy with Certbot-issued TLS,
daily storage-tier sweeper.

This is the **pilot path** — one box, three tier roots
(`/var/lib/medbrains/{objects,cold,archive}`), no S3, no Glacier.
For multi-server / cloud / RustFS layouts see `STORAGE.md`.

## Prerequisites

- A clean Ubuntu 22.04 / 24.04 or Debian 12 host with root access.
- DNS `A` (and ideally `AAAA`) record for the deploy hostname (e.g.
  `hims.example.org`) pointed at the server's public IP.
  Let's Encrypt verifies HTTP-01 over port 80 — both 80 and 443
  must be reachable from the public internet.
- Pre-built binaries dropped into `/tmp` on the host:

  ```sh
  # On a Linux build host of the same architecture as the target:
  cargo build -p medbrains-server --release --bin medbrains-server
  cargo build -p medbrains-server --release --bin medbrains-archive
  cargo build -p medbrains-proxy --release --bin medbrains-proxy
  pnpm --filter @medbrains/web build
  # From a Mac (or any other host), cross-compile with cargo-zigbuild instead:
  #   cargo zigbuild --release --target=x86_64-unknown-linux-gnu -p medbrains-server
  # and take the binaries from target/x86_64-unknown-linux-gnu/release/.
  # medbrains-edge (offline edge sync) is optional; install.sh skips it if absent.

  # Then ship to the deploy host:
  scp target/release/medbrains-server  root@<host>:/tmp/
  scp target/release/medbrains-archive root@<host>:/tmp/
  scp target/release/medbrains-proxy   root@<host>:/tmp/
  rsync -a apps/web/dist/ root@<host>:/tmp/medbrains-web/
  scp -r medbrains/deploy/standalone root@<host>:/tmp/
  ```

## Run

```sh
sudo bash /tmp/standalone/install.sh hims.example.org admin@example.org
```

Idempotent — re-running advances state without re-bootstrapping
secrets. Picks up where it left off if interrupted.

## What the installer does

1. Installs system packages: Docker, `certbot`, `openssl`.
2. Creates `medbrains` system user + directory tree under
   `/var/lib/medbrains/`.
3. Writes `/etc/medbrains/env` (postgres password, Ed25519 JWT
   keypair both auto-generated; permissions `640 root:medbrains`).
4. Brings up postgres-17 via docker compose, bound to localhost
   only. If `MEDBRAINS_ICD_LOCAL_SERVICE=true`, also starts the
   WHO ICD-API sidecar on `127.0.0.1:8382`.
5. Installs `medbrains-server`, `medbrains-archive`, and `medbrains-proxy` binaries to
   `/usr/local/bin`.
6. Copies SPA static files to `/var/www/medbrains`.
7. Installs + enables `medbrains-server.service` (long-running) and
   `medbrains-archive.timer` (daily 02:00 oneshot).
8. Issues TLS with Certbot, copies certs to `/etc/medbrains/tls`,
   renders `PingoraProxy.toml.tmpl`, and starts `medbrains-proxy`.
9. Probes `/api/health` and prints the public URL.

## Verification

```sh
systemctl is-active medbrains-server.service           # active
systemctl list-timers medbrains-archive.timer          # next run scheduled
curl -fsS http://127.0.0.1:3000/api/health             # {"status":"ok",...}
journalctl -u medbrains-proxy -f                       # edge proxy logs
curl -I https://hims.example.org                        # 200 once ACME completes
```

## Day-2 ops

| Task | Command |
|---|---|
| Tail server logs | `journalctl -u medbrains-server -f` |
| Tail edge proxy logs | `journalctl -u medbrains-proxy -f` |
| Tail archive sweeper | `journalctl -u medbrains-archive -f` |
| Run sweeper now | `sudo systemctl start medbrains-archive.service` |
| Restart server | `sudo systemctl restart medbrains-server.service` |
| Tail local ICD-API | `sudo docker logs -f medbrains-icd-api` |
| Backup postgres | `sudo docker exec medbrains-postgres pg_dump -U medbrains medbrains > backup-$(date +%F).sql` |
| Update binary | Replace `/usr/local/bin/medbrains-server` and `systemctl restart medbrains-server.service` |
| Update SPA | `rsync apps/web/dist/ /var/www/medbrains/` (no restart needed) |

## A hospital's own domain

A hospital names its domain in **Settings → Organization** and proves it on
**Setup → Domains & Email** with a DNS TXT record (`_medbrains-verify.<domain>`).
Until it is proven, sign-in does not follow the domain.

Certificates for proven domains need no hand work on a host fronted by Caddy:
on-demand TLS asks MedBrains before issuing, and MedBrains answers 200 only for
a proven, active hospital domain.

```caddy
{
    on_demand_tls {
        ask http://127.0.0.1:3000/api/tls/allow
    }
}

https:// {
    tls {
        on_demand
    }
    reverse_proxy 127.0.0.1:3000
}
```

On a Pingora-fronted install (this kit's default), issue the certificate with
Certbot once the domain is proven and add its route to the proxy config.

## Files in this directory

| File | Purpose |
|---|---|
| `install.sh` | Idempotent bootstrap script |
| `PingoraProxy.toml.tmpl` | Pingora edge proxy template |
| `medbrains-proxy.service` | systemd unit for the Pingora edge proxy |
| `copy-medbrains-proxy-cert` | Certbot deploy hook that copies renewed certs into `/etc/medbrains/tls` |
| `stop-medbrains-proxy` | Certbot pre-renewal hook so standalone HTTP-01 can bind port 80 |
| `start-medbrains-proxy` | Certbot post-renewal hook that brings the edge proxy back |
| `medbrains-server.service` | systemd unit for the API + SPA server |
| `medbrains-archive.service` | systemd one-shot for the storage sweeper |
| `medbrains-archive.timer` | daily 02:00 timer |
| `docker-compose.prod.yml` | postgres-17 plus optional profile-gated sidecars |
| `env.example` | starter `/etc/medbrains/env` |
| `STORAGE.md` | LocalFs / RustFS / S3+Glacier deployment shapes |

## Optional local WHO ICD-API

For research and diagnosis-code reproducibility, prefer the official
WHO ICD-API local service over cloud OAuth:

```env
MEDBRAINS_ICD_LOCAL_SERVICE=true
ICD_API_ACCEPT_LICENSE=true
ICD_API_INCLUDE=2026-01_en
ICD_API_SAVE_ANALYTICS=false
WHO_ICD_RELEASE_ID=2026-01
WHO_ICD_API_BASE_URL=https://hims.example.org
WHO_ICD_AUTH_MODE=none
```

The standalone Pingora proxy exposes the ICD service under the same
hospital domain at `/icd/*`; the backend uses the same base URL as the
UI domain and appends the official ICD API path. Do not use wildcard
CORS. WHO also documents a native Linux systemd install for ICD-API,
but this kit keeps the default on Docker Compose because Docker is
already required for Postgres and makes sidecar lifecycle/rollback
simpler.

## What this kit does NOT install

- SpiceDB. Install it separately with `install-spicedb.sh` and
  `spicedb-schema.zed`.
- ABDM and NHCX keys. The integrations are built; each hospital's
  gateway credentials are configured after go-live approval.
- Continuous WAL archiving. The installer sets up daily Postgres dumps
  (`medbrains-pg-backup.timer`, to a bucket or a host directory); WAL
  archiving to object storage is opt-in via `medbrains-wal-g-setup`
  (see `docs/ops/BACKUP-RESTORE.md`).
- Multi-server HA and Patroni replication. For multi-server, see
  `infra/terraform/modules-onprem/`.
- WAF, intrusion detection. Add per the hospital's IT-security
  policy before connecting real patient traffic.
