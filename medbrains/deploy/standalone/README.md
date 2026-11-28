# MedBrains standalone deploy kit

Single-server deploy: native PostgreSQL 17 (PGDG apt, systemd), medbrains-server as a
systemd unit, no Docker, MedBrains Pingora edge proxy with Certbot-issued TLS,
daily storage-tier sweeper.

This is the **pilot path** — one box, three tier roots
(`/var/lib/medbrains/{objects,cold,archive}`), no S3, no Glacier.
For multi-server / cloud / RustFS layouts see `STORAGE.md`.

## Prerequisites

- A clean Ubuntu 22.04 / 24.04 or Debian 12 host with root access.
- DNS `A` (and ideally `AAAA`) record for the deploy hostname (e.g.
  `hims.example-hospital.org`) pointed at the server's public IP.
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
sudo bash /tmp/standalone/install.sh hims.example-hospital.org admin@example-hospital.org
```

Idempotent — re-running advances state without re-bootstrapping
secrets. Picks up where it left off if interrupted.

## What the installer does

1. Installs system packages: `certbot`, `openssl`, `age`, and turns on
   automatic OS security updates (`os-auto-updates.sh`: Debian/Ubuntu
   security archive only, nightly at 03:30 after the backups, no automatic
   reboot unless `OS_UPDATE_REBOOT=1`; logs in `/var/log/unattended-upgrades/`).
   Skipped on an attach host unless `OS_AUTO_UPDATES=1`. MedBrains itself is
   never updated by apt — it updates through its signed releases
   (`docs/SECURITY-RELEASE-PROCESS.md`).
2. Creates `medbrains` system user + directory tree under
   `/var/lib/medbrains/`.
3. Writes `/etc/medbrains/env` (postgres password, Ed25519 JWT
   keypair both auto-generated; permissions `640 root:medbrains`).
4. Installs PostgreSQL 17 from the PGDG apt repository (key fingerprint
   checked) as `postgresql@17-main`: 127.0.0.1 and ::1 only, `scram-sha-256`
   over loopback, `peer` for `postgres`, en_US.UTF-8, data checksums
   (`native-postgres.sh`). A host still running the old kit's
   `medbrains-postgres` container is refused until it is moved
   (see "Moving an existing host off Docker"). If
   `MEDBRAINS_ICD_LOCAL_SERVICE=true` and you installed docker yourself, also
   starts the WHO ICD-API sidecar on `127.0.0.1:8382`.
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
curl -I https://hims.example-hospital.org                        # 200 once ACME completes
```

## Day-2 ops

| Task | Command |
|---|---|
| Tail server logs | `journalctl -u medbrains-server -f` |
| Tail edge proxy logs | `journalctl -u medbrains-proxy -f` |
| Tail archive sweeper | `journalctl -u medbrains-archive -f` |
| Run sweeper now | `sudo systemctl start medbrains-archive.service` |
| Restart server | `sudo systemctl restart medbrains-server.service` |
| Tail Postgres | `journalctl -u postgresql@17-main -f` (and `/var/log/postgresql/postgresql-17-main.log`) |
| psql as superuser | `sudo -u postgres psql -d medbrains` |
| Tail local ICD-API (opt-in, docker) | `sudo docker logs -f medbrains-icd-api` |
| Backup now (sealed, shipped, recorded) | `sudo systemctl start medbrains-pg-backup.service && journalctl -u medbrains-pg-backup -n 20` |
| Is the last backup fresh? | Admin → Settings → System health, or `sudo systemctl start medbrains-host-check.service` |
| Update binary | Run `install.sh`. Replacing `/usr/local/bin/medbrains-server` alone now refuses to start on a host without the event token, signature and OAuth keys, which `install.sh` adds to `/etc/medbrains/env`. Values sealed under the old development keys then stop opening: doctors re-enrol signing keys and accounts reconnect |
| Did a service hit its memory limit? | `systemctl show medbrains-server -p MemoryMax -p MemoryCurrent -p MemoryPeak -p NRestarts`; a limit kill shows as `oom-kill` in `journalctl -u medbrains-server`. The server, proxy and edge are limited to a share of RAM (server 40%, proxy 25%, edge 8%; a hard limit only, so a leaking service is restarted, not slowed) so one of them cannot starve PostgreSQL, which has no hard limit. Only the service that hit its limit restarts. A host gets these limits the next time `install.sh` runs |
| Update SPA | `rsync apps/web/dist/ /var/www/medbrains/` (no restart needed) |
| Prove an update first (staging, before any hospital) | `scripts/staging_update_e2e.sh <from-tag> <to-tag>` on an arm64 Mac with Docker: installs FROM with this kit on a throwaway box, records a day's work, updates with a tab open, rolls back and forward; prints PASS/FAIL per step. The last row leaves the box alone for five minutes (`STAGING_IDLE_SECONDS`) and fails if server memory, PostgreSQL memory, open connections or the total are over `scripts/staging_idle_memory.budget`, or could not be read |

## Encrypted off-site backups

What runs: `medbrains-pg-backup.timer` (02:30 UTC daily, and before every
re-deploy — `install.sh` refuses to restart onto new migrations if that
backup fails) dumps Postgres with `pg_dump -Fc`, seals it with
[age](https://age-encryption.org) to the public key(s) in
`/etc/medbrains/backup-recipients.txt`, and streams it to S3. `/etc/medbrains`
(HMAC/ABDM/JWT keys, role passwords — a restored database is unusable without
them) is sealed and shipped the same way. Nothing is staged on disk in plain
text, and no dump is ever written unencrypted: without a key the job refuses
and pages. The key belongs to **the hospital running this install**, never to
the MedBrains project, and its private half is kept **off the server**: the
host can write backups but neither it, root, nor the app can read one.

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

RPO 24 h (≤ 6 min with point-in-time recovery, `PITR_ENABLED=1`); RTO ≈ 2 h for a lost host — see
`docs/ops/BACKUP-RESTORE.md` ("Backup quality matrix").

### Steps to switch it on (in order)

1. **Make the hospital's key, offline** (an operator's machine or an
   air-gapped one, never the server). If you skip this, `install.sh` makes a
   keypair on the server on the first install, prints where the private key
   is, and you must move it offline and `shred -u` it there: until then root
   on the server can read the backups.
   ```sh
   brew install age                                  # age 1.3+ (distro packages are older)
   age-keygen -pq -o medbrains-backup.key            # post-quantum; prints "Public key: age1pq1…"
   age -p -o medbrains-backup.key.age medbrains-backup.key   # passphrase-protect it
   rm -P medbrains-backup.key                        # keep only the protected copy
   ```
   Store `medbrains-backup.key.age` in two places that do not share a fate
   (e.g. a USB stick in a safe + your password manager) and the passphrase
   separately. Lose both and **every backup is unreadable** — consider a
   second key held by someone you trust, as a second line in step 2.
2. **Give the public key to the install** (not secret):
   `sudo BACKUP_AGE_RECIPIENT='age1pq1…' bash install.sh <domain> <email> …`
   (several keys: one per line, all post-quantum or all classic; age refuses a
   mix). A classic `age1…` key still works, with a warning on every run. It lands in
   `/etc/medbrains/backup-recipients.txt`; later installs keep that file
   unless `BACKUP_AGE_RECIPIENT` is set again. `install.sh` refuses a
   malformed key. The kit ships no key: a key in the kit would seal every
   hospital's backups to whoever committed it.
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
5. **Prove it** from your machine (needs `age`, PostgreSQL 17 client and
   server binaries — `initdb`/`pg_ctl` in `PG_BIN` or on `pg_config --bindir` —
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

### Rotate the backup key

Step by step, with re-sealing old copies, a lost key and restore onto a new
server: the admin guide's **Backups** page (`apps/docs/docs/admin/backups.md`).
A classic `age1…` key is rotated the same way to a post-quantum `age1pq1…` one.

Kits before 3.33.1 installed the MedBrains project's own public key on every
host, so those backups are sealed to a key the hospital does not hold. Such a
host says so in the backup log (`journalctl -u medbrains-pg-backup`) and on
**Admin → Settings → System health**. To move to the hospital's own key:

1. Make a key offline (step 1 above).
2. On the server: `sudo BACKUP_AGE_RECIPIENT='age1pq1…' bash install.sh …` as for
   any update, or write the `age1pq1…` line to
   `/etc/medbrains/backup-recipients.txt` directly.
3. `sudo systemctl start medbrains-pg-backup.service`, check System health no
   longer warns, and run the restore drill (step 5) with the new key.
4. Backups taken before the rotation stay sealed to the old key. Keep them
   until the new ones have passed the drill and covered the retention window,
   then retire them by your own policy.

The project's own server is the only host meant to hold the project key; it
sets `BACKUP_PROJECT_KEY_IS_OURS=1` in `/etc/medbrains/env`
(`infra/terraform/envs/medbrains-in/README.md`).

## Log archive

CERT-In direction (iv) wants 180 days of logs kept in India. journald is set to
persistent, 180 days, capped at 2G (`SystemMaxUse`) with 2G kept free, so local
logs can never fill the disk; on a busy host that is days, not months.

The S3 archive is **opt-in and off by default**: set `LOG_ARCHIVE_BUCKET` (and
optionally `LOG_ARCHIVE_PREFIX`, default `host-logs`) before running
`install.sh`. Only then is `medbrains-log-archive.timer` enabled; it ships the
previous day's journal (`journal.json.gz`) and plain-file logs touched that day
(`files.tar.gz`, list in `LOG_ARCHIVE_FILES`) at about 00:20. Credentials come
from the instance's IAM role only; no keys are written to disk or logged. The
AWS CLI uses HTTPS; at-rest encryption is the bucket's default SSE-KMS, and the
host's policy should allow put and list only, never get or delete. A failed run
pages through `medbrains-alert@`, and `medbrains-host-check` pages when
yesterday's object is missing or the clock is not NTP-synchronised.
Backfill a day: `sudo medbrains-log-archive 2026-10-20`.

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
| `os-auto-updates.sh` | unattended OS security updates: window, reboot policy, logging (`test-os-auto-updates.sh` checks it) |
| `PingoraProxy.toml.tmpl` | Pingora edge proxy template |
| `medbrains-proxy.service` | systemd unit for the Pingora edge proxy |
| `copy-medbrains-proxy-cert` | Certbot deploy hook that copies renewed certs into `/etc/medbrains/tls` |
| `stop-medbrains-proxy` | Certbot pre-renewal hook so standalone HTTP-01 can bind port 80 |
| `start-medbrains-proxy` | Certbot post-renewal hook that brings the edge proxy back |
| `medbrains-server.service` | systemd unit for the API + SPA server |
| `medbrains-archive.service` | systemd one-shot for the storage sweeper |
| `medbrains-archive.timer` | daily 02:00 timer |
| `native-postgres.sh` | sourced: PGDG repo, the cluster, its hba and loopback config |
| `migrate-docker-postgres-to-native.sh` | one-time move of an old-kit host off the Postgres container |
| `docker-compose.prod.yml` | opt-in container extras only (ICD-API, Rustrak); never started by default |
| `env.example` | starter `/etc/medbrains/env` |
| `medbrains-pg-backup` (+ `.service`, `.timer`) | sealed nightly + pre-deploy backup → S3 or `BACKUP_DIR` |
| `medbrains-restore-drill` | operator-side: latest backup → scratch DB → integrity report |
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
WHO_ICD_API_BASE_URL=https://hims.example-hospital.org
WHO_ICD_AUTH_MODE=none
```

The standalone Pingora proxy exposes the ICD service under the same
hospital domain at `/icd/*`; the backend uses the same base URL as the
UI domain and appends the official ICD API path. Do not use wildcard
CORS. WHO also documents a native Linux systemd install for ICD-API,
and moving the sidecar to it is the follow-up; until then it is the one
reason to install docker, and only if you want offline ICD search.

## Optional error tracking (Rustrak)

The server and the browser report crashes with the Sentry SDKs to a
self-hosted [Rustrak](https://github.com/rustrak/rustrak) on this host,
the default for every hospital install. A `SENTRY_DSN` that points off
this host, such as sentry.io, turns error tracking off unless
`SENTRY_ALLOW_EXTERNAL=1` is also set; the preflight warns either way.
That opt-in is for the project's own servers only: use an EU-region
Sentry project, sign Sentry's data processing agreement, and never turn
on `send_default_pii`. Every report is scrubbed of patient data before it
leaves the HMS process (`crates/medbrains-error-tracking`); the browser's
reports go through the server's tunnel to get the same scrubbing.
It is off until `SENTRY_DSN` is set: without it the server and the
browser send nothing, and no other variable is required.

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

## Moving an existing host off Docker

A host installed before 2026-11-20 runs Postgres in the `medbrains-postgres`
container, and `install.sh` refuses to run there until it is moved:

```sh
sudo bash migrate-docker-postgres-to-native.sh --dry-run   # every check, no change
sudo bash migrate-docker-postgres-to-native.sh             # the move (minutes of downtime)
```

It copies by dump and restore (never the data directory), verifies the copy
table by table, keeps the container stopped with its volume untouched for
rollback, and prints the rollback commands. Runbook, downtime and the
rehearsal record: `docs/ops/BACKUP-RESTORE.md`, "Moving a host off Docker".

## What this kit does NOT install

- Docker. Postgres is native; ICD-API and Rustrak, the two extras that exist
  only as images, are opt-in and need docker installed by the operator.
- YottaDB (Phase 2 hierarchical store — defer until needed).
- SpiceDB (the Rust authz fallback covers the pilot).
- ABDM signing keys (real NHCX integration is a separate phase).
- Multi-server HA, Patroni replication. For
  multi-server, see `infra/terraform/modules-onprem/`.
- WAF, intrusion detection. Add per the hospital's IT-security
  policy before connecting real patient traffic.
