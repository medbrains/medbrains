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
  `hims.amh.org.in`) pointed at the server's public IP.
  Let's Encrypt verifies HTTP-01 over port 80 — both 80 and 443
  must be reachable from the public internet.
- Pre-built binaries dropped into `/tmp` on the host:

  ```sh
  # On the build host (Linux x86_64 or aarch64 — match the target):
  cargo build -p medbrains-server --release --bin medbrains-server
  cargo build -p medbrains-server --release --bin medbrains-archive
  cargo build -p medbrains-proxy --release --bin medbrains-proxy
  pnpm --filter @medbrains/web build

  # Then ship to the deploy host:
  scp target/release/medbrains-server  root@<host>:/tmp/
  scp target/release/medbrains-archive root@<host>:/tmp/
  scp target/release/medbrains-proxy   root@<host>:/tmp/
  rsync -a apps/web/dist/ root@<host>:/tmp/medbrains-web/
  scp -r medbrains/deploy/standalone root@<host>:/tmp/
  ```

## Run

```sh
sudo bash /tmp/standalone/install.sh hims.amh.org.in admin@amh.org.in
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
curl -I https://hims.amh.org.in                        # 200 once ACME completes
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
| Backup now (sealed, shipped, recorded) | `sudo systemctl start medbrains-pg-backup.service && journalctl -u medbrains-pg-backup -n 20` |
| Is the last backup fresh? | Admin → Settings → System health, or `sudo systemctl start medbrains-host-check.service` |
| Update binary | Replace `/usr/local/bin/medbrains-server` and `systemctl restart medbrains-server.service` |
| Update SPA | `rsync apps/web/dist/ /var/www/medbrains/` (no restart needed) |

## Encrypted off-site backups

What runs: `medbrains-pg-backup.timer` (02:30 UTC daily, and before every
re-deploy — `install.sh` refuses to restart onto new migrations if that
backup fails) dumps Postgres with `pg_dump -Fc`, seals it with
[age](https://age-encryption.org) to the public key(s) in
`/etc/medbrains/backup-recipients.txt`, and streams it to S3. `/etc/medbrains`
(HMAC/ABDM/JWT keys, role passwords — a restored database is unusable without
them) is sealed and shipped the same way. Nothing is staged on disk in plain
text. The private key is **never on the server**: the host can write backups
but neither it, root, nor the app can read one.

| Prefix | What | Kept |
|---|---|---|
| `pg-backups/<host>/*.dump.age` | nightly dumps | 31 days |
| `pg-backups-monthly/<host>/*.dump.age` | first dump of each month | 366 days |
| `secrets-backups/<host>/*.tar.age` | `/etc/medbrains` | 31 days |
| `file-backups/<host>/…` | documents mirror (SSE-KMS, not age) | while present; old versions 90 days |

The bucket (`infra/terraform/envs/medbrains-in/ops.tf`): ap-south-1, versioned,
Object Lock COMPLIANCE 30 days, SSE-KMS, public access blocked, TLS only, no
deletes by anyone, writes only from the prod instance role and only as `*.age`
under the dump prefixes. Every run writes a row to `backup_history`; **Admin →
Settings → System health** shows the age of the last good one and turns red
after 26 h. `medbrains-host-check` (hourly) pages through `ALERT_TOPIC_ARN`
on the same threshold, and a failed run pages via `OnFailure=`.

RPO 24 h (≤ 5 min with WAL-G opted in); RTO ≈ 2 h for a lost host — see
`docs/ops/BACKUP-RESTORE.md`.

### Founder's steps to switch it on (in order)

1. **Make the key, offline** (your own Mac or an air-gapped machine, never the server):
   ```sh
   brew install age                                  # or apt install age
   age-keygen -o medbrains-backup.key                # prints "Public key: age1…"
   age -p -o medbrains-backup.key.age medbrains-backup.key   # passphrase-protect it
   rm -P medbrains-backup.key                        # keep only the protected copy
   ```
   Store `medbrains-backup.key.age` in two places that do not share a fate
   (e.g. a USB stick in a safe + your password manager) and the passphrase
   separately. Lose both and **every backup is unreadable** — consider a
   second key held by someone you trust, as a second line in step 2.
2. **Commit the public key** (not secret): put the `age1…` line(s) in
   `deploy/standalone/backup-recipients.txt`, open a PR, merge. Every
   install now seals to it; `install.sh` refuses a malformed file.
3. **Create the bucket**: `cd infra/terraform/envs/medbrains-in`, then
   `terraform plan -out ops.tfplan` and check it — Object Lock on the existing
   bucket is in place and **cannot be switched off later** — then
   `terraform apply ops.tfplan` and `terraform output prod_ops`. If
   `backup_policy_attached = false`, give the instance an IAM role
   (EC2 → Actions → Security → Modify IAM role) and apply again.
4. **Point the deploy at it**: in `medbrains/infra/.env` set
   `TF_VAR_attach_backup_bucket=<prod_ops.BACKUP_BUCKET>` and
   `TF_VAR_attach_alert_topic_arn=<prod_ops.ALERT_TOPIC_ARN>`, confirm the
   alert e-mail subscription, then run the normal deploy. `install.sh`
   installs `age`, the key, both values, and takes the first sealed backup
   before restarting the server.
5. **Prove it** from your machine (needs `age`, Postgres 17 client, docker,
   and AWS credentials that can read the bucket and decrypt with its KMS key):
   ```sh
   make restore-drill FROM=s3://<bucket>/pg-backups/<host>/ IDENTITY=medbrains-backup.key.age
   # add --secrets-from s3://<bucket>/secrets-backups/<host>/ to check the keys archive
   ```
   It downloads the newest dump, decrypts it, restores it into a throwaway
   Postgres 17, checks migrations, row counts and the app role's grants,
   and prints the timings. Append the result to `docs/ops/BACKUP-RESTORE.md`.
   Repeat quarterly.

`make test-backups` runs the kit's own tests (a local directory stands in for
S3, with a throwaway key).

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
| `medbrains-pg-backup` (+ `.service`, `.timer`) | sealed nightly + pre-deploy backup → S3 or `BACKUP_DIR` |
| `medbrains-restore-drill` | operator-side: latest backup → scratch DB → integrity report |
| `backup-recipients.txt` | age public key(s) every backup is sealed to (add it: step 2 above) |
| `test-pg-backup-local.sh`, `test-backup-drill-e2e.sh` | `make test-backups` |
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
WHO_ICD_API_BASE_URL=https://hims.amh.org.in
WHO_ICD_AUTH_MODE=none
```

The standalone Pingora proxy exposes the ICD service under the same
hospital domain at `/icd/*`; the backend uses the same base URL as the
UI domain and appends the official ICD API path. Do not use wildcard
CORS. WHO also documents a native Linux systemd install for ICD-API,
but this kit keeps the default on Docker Compose because Docker is
already required for Postgres and makes sidecar lifecycle/rollback
simpler.

## Optional error tracking (Rustrak)

The server and the browser report crashes with the Sentry SDKs to a
self-hosted [Rustrak](https://github.com/rustrak/rustrak) on this host —
never to sentry.io. Every report is scrubbed of patient data before it
leaves the HMS process (`crates/medbrains-error-tracking`); the browser's
reports go through the server's tunnel to get the same scrubbing.

```bash
# DNS: errors.<domain> → this host, then:
INSTALL_RUSTRAK=1 sudo -E bash install.sh <domain> <admin-email>
```

`install-rustrak.sh` starts `rustrak/rustrak-server` pinned by tag and
digest (SQLite in the `medbrains-rustrak` volume, telemetry off, 30-day
retention), creates its admin login in `/etc/medbrains/rustrak.env`
(root only), and writes `SENTRY_DSN`, `RUSTRAK_API_TOKEN` and
`RUSTRAK_PUBLIC_URL` to `/etc/medbrains/env`. Pingora serves the
dashboard at `https://errors.<domain>` (a `passthrough` route on the same
certificate). Admin → Settings → Error tracking shows new issues and the
crash-free rate of the running release.

Source maps: build with `SENTRY_URL=https://errors.<domain>` and
`SENTRY_AUTH_TOKEN=<RUSTRAK_API_TOKEN>` in the environment and the web
build uploads them for its release; they are never served.

## What this kit does NOT install

- YottaDB (Phase 2 hierarchical store — defer until needed).
- SpiceDB (the Rust authz fallback covers the pilot).
- ABDM signing keys (real NHCX integration is a separate phase).
- Multi-server HA, Patroni replication. For
  multi-server, see `infra/terraform/modules-onprem/`.
- WAF, intrusion detection. Add per the hospital's IT-security
  policy before connecting real patient traffic.
