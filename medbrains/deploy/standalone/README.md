# MedBrains standalone deploy kit

Single-server deploy: postgres-17 in docker, medbrains-server as a
systemd unit, Caddy 2 reverse proxy with automatic Let's Encrypt,
daily storage-tier sweeper.

This is the **pilot path** — one box, three tier roots
(`/var/lib/medbrains/{objects,cold,archive}`), no S3, no Glacier.
For multi-server / cloud / RustFS layouts see `STORAGE.md`.

## Prerequisites

- A clean Ubuntu 22.04 / 24.04 or Debian 12 host with root access.
- DNS `A` (and ideally `AAAA`) record for the deploy hostname (e.g.
  `hims.alagappahospital.com`) pointed at the server's public IP.
  Let's Encrypt verifies HTTP-01 over port 80 — both 80 and 443
  must be reachable from the public internet.
- Pre-built binaries dropped into `/tmp` on the host:

  ```sh
  # On the build host (Linux x86_64 or aarch64 — match the target):
  cargo build -p medbrains-server --release --bin medbrains-server
  cargo build -p medbrains-server --release --bin medbrains-archive
  pnpm --filter @medbrains/web build

  # Then ship to the deploy host:
  scp target/release/medbrains-server  root@<host>:/tmp/
  scp target/release/medbrains-archive root@<host>:/tmp/
  rsync -a apps/web/dist/ root@<host>:/tmp/medbrains-web/
  scp -r medbrains/deploy/standalone root@<host>:/tmp/
  ```

## Run

```sh
sudo bash /tmp/standalone/install.sh hims.alagappahospital.com admin@alagappahospital.com
```

Idempotent — re-running advances state without re-bootstrapping
secrets. Picks up where it left off if interrupted.

## What the installer does

1. Installs system packages: `docker.io`, `caddy`, `openssl`.
2. Creates `medbrains` system user + directory tree under
   `/var/lib/medbrains/`.
3. Writes `/etc/medbrains/env` (postgres password, Ed25519 JWT
   keypair both auto-generated; permissions `640 root:medbrains`).
4. Brings up postgres-17 via docker compose, bound to localhost
   only.
5. Installs `medbrains-server` + `medbrains-archive` binaries to
   `/usr/local/bin`.
6. Copies SPA static files to `/var/www/medbrains`.
7. Installs + enables `medbrains-server.service` (long-running) and
   `medbrains-archive.timer` (daily 02:00 oneshot).
8. Renders `Caddyfile.tmpl` → `/etc/caddy/Caddyfile`, reloads Caddy.
   Caddy auto-issues + renews TLS certs.
9. Probes `/api/health` and prints the public URL.

## Verification

```sh
systemctl is-active medbrains-server.service           # active
systemctl list-timers medbrains-archive.timer          # next run scheduled
curl -fsS http://127.0.0.1:3000/api/health             # {"status":"ok",...}
journalctl -u caddy -f                                 # ACME challenge logs
curl -I https://hims.alagappahospital.com              # 200 once ACME completes
```

## Day-2 ops

| Task | Command |
|---|---|
| Tail server logs | `journalctl -u medbrains-server -f` |
| Tail archive sweeper | `journalctl -u medbrains-archive -f` |
| Run sweeper now | `sudo systemctl start medbrains-archive.service` |
| Restart server | `sudo systemctl restart medbrains-server.service` |
| Backup postgres | `sudo docker exec medbrains-postgres pg_dump -U medbrains medbrains > backup-$(date +%F).sql` |
| Update binary | Replace `/usr/local/bin/medbrains-server` and `systemctl restart medbrains-server.service` |
| Update SPA | `rsync apps/web/dist/ /var/www/medbrains/` (no restart needed) |

## Files in this directory

| File | Purpose |
|---|---|
| `install.sh` | Idempotent bootstrap script |
| `Caddyfile.tmpl` | Caddy reverse-proxy template ({{DOMAIN}}, {{ADMIN_EMAIL}}) |
| `medbrains-server.service` | systemd unit for the API + SPA server |
| `medbrains-archive.service` | systemd one-shot for the storage sweeper |
| `medbrains-archive.timer` | daily 02:00 timer |
| `docker-compose.prod.yml` | postgres-17 only |
| `env.example` | starter `/etc/medbrains/env` |
| `STORAGE.md` | LocalFs / RustFS / S3+Glacier deployment shapes |

## What this kit does NOT install

- YottaDB (Phase 2 hierarchical store — defer until needed).
- SpiceDB (the Rust authz fallback covers the pilot).
- ABDM signing keys (real NHCX integration is a separate phase).
- Multi-server HA, Patroni replication, off-site backups. For
  multi-server, see `infra/terraform/modules-onprem/`.
- WAF, intrusion detection. Add per the hospital's IT-security
  policy before connecting real patient traffic.
