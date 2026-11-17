# Backup and restore — production (app.medbrains.in)

Last reviewed 2026-11-17 (quality matrix, point-in-time recovery on both tiers, shared-cluster refusal); before that 2026-10-26 (age client-side encryption, monthly retention, Object Lock, pre-deploy backup, restore drill script). Read before any prod change, and before you need it.

## What prod actually is

| | |
|---|---|
| Host | one EC2, `i-08e9496a3e110ebdc`, ap-south-1 (`TF_VAR_tier=attach` in `infra/.env`) |
| Database | the host's own **native Postgres 17** (`TF_VAR_attach_reuse_postgres=true`), not a container |
| Front | Caddy on the host (`TF_VAR_attach_reuse_tls=true`) |
| Deploy | `deploy/standalone/install.sh`, driven by terraform (`envs/standalone/hospital-a`) |

The attach tier deliberately creates **no AWS resources** (`modules/standalone-vm/existing-host`). That matters here: the
S3 backup bucket, Object Lock, DLM snapshots and EC2 alarms in `modules/standalone-vm/aws-ec2/main.tf` belong to the
`starter` tier and **do not exist for prod**.

## What is backed up today

| What | How | Where | Retention | Encryption | Offsite |
|---|---|---|---|---|---|
| Postgres (whole DB `medbrains`) | `medbrains-pg-backup.timer` → `/usr/local/bin/medbrains-pg-backup`: `pg_dump --format=custom --compress=9 --no-owner` over `DATABASE_URL` | `/var/backups/medbrains/<host>-<UTC>.dump` (dir 0700, file 0600) | 14 days (`BACKUP_KEEP_DAYS`) | **None** beyond the volume's (EBS encryption of this instance is unverified) | **No** — same disk |
| Ad-hoc pre-deploy dump | manual `umask 077; pg_dump -Fc` before a prod change (`memory: reference_prod_deploy_attach`) | operator's choice | ad hoc | ad hoc | ad hoc |
| EBS snapshots | not managed by us on the attach tier | — | — | — | unknown — check below |
| Files (`/var/lib/medbrains`, `/var/lib/medbrains-edge`) | **not backed up** by any MedBrains job today | — | — | — | No |

The files tree is what Postgres rows point at: generated documents and prints (`MEDBRAINS_OBJECTS_HOT`, read by
`crates/medbrains-server/src/main.rs`), the cold and archive tiers moved there by `medbrains-archive`
(`MEDBRAINS_OBJECTS_COLD/ARCHIVE`), the audit sink (`/var/lib/medbrains/audit/archive`) and the edge doc store and
Merkle chain (`/var/lib/medbrains-edge`). Patient uploads go to S3 via presigned URLs only when `S3_BUCKET` is set;
otherwise those endpoints are disabled.

Schedule: daily 02:30 UTC (08:00 IST), `Persistent=true` (a missed run fires at next boot).
Failure: `OnFailure=medbrains-alert@` publishes to `ALERT_TOPIC_ARN` — **unset on prod**, so failures are currently
logged to the journal only. `medbrains-host-check.timer` (hourly) also fails if no dump landed in 26 h, with the same
(currently silent) notifier.

**Verdict: prod has an automated nightly backup, but it is on-host only, so it does not survive loss of the
instance or its volume, and nobody is told when it fails.** That is not disaster recovery.

Check what the hospital host has besides (read-only, operator credentials):

```sh
aws ec2 describe-volumes --region ap-south-1 \
  --filters Name=attachment.instance-id,Values=i-08e9496a3e110ebdc \
  --query 'Volumes[].{id:VolumeId,encrypted:Encrypted,kms:KmsKeyId,size:Size}'
aws dlm get-lifecycle-policies --region ap-south-1
aws ec2 describe-snapshots --owner-ids self --region ap-south-1 \
  --filters Name=volume-id,Values=<vol-id> --query 'reverse(sort_by(Snapshots,&StartTime))[:3]'
# on the host
systemctl list-timers medbrains-pg-backup.timer; ls -lt /var/backups/medbrains | head
```

## The fix, as code (not deployed)

1. **`infra/terraform/envs/medbrains-in/ops.tf`** — an offsite bucket `medbrains-prod-pg-backups-<account>`:
   versioned, Object Lock COMPLIANCE 30 d (`company_backup_lock_days`), SSE-KMS with a dedicated rotating key
   (`alias/medbrains-prod-backups`), public access blocked, bucket policy: TLS only, no deletes by anyone, writes
   only from the instance role. Lifecycle: `pg-backups/` 31 d (30 dailies), `pg-backups-monthly/` 366 d
   (12 monthlies, IA after 30 d), `secrets-backups/` 31 d, aborted multipart uploads 1 d. An IAM policy lets the host **write and list only** (no read, no delete — a
   compromised host cannot destroy or exfiltrate history; the opt-in WAL grant below adds read on `wal-g/` only) and publish to the new alert topic. It is attached to
   the instance's role automatically if the instance has a profile. Apply: `docs/ops/MONITORING.md`.
2. **`deploy/standalone/medbrains-pg-backup`** — no longer passes `--no-privileges` (see drill finding 1), and now
   also mirrors the files tree: on the S3 branch, after the dump, `aws s3 sync` of each root in `BACKUP_FILES_ROOTS`
   (default `/var/lib/medbrains /var/lib/medbrains-edge`) to `s3://<bucket>/file-backups/<host><root>/`, excluding
   `pgdata/` (a file copy of a live cluster is not a backup) and `*.partial`. Sync, not a nightly tarball: objects are
   write-once and imaging runs to tens of GB, so only new/changed files upload. No `--delete`, and the bucket is
   versioned, so a deleted or overwritten file stays recoverable — current objects kept while they exist, replaced
   versions 90 days (lifecycle rule `file-mirror`). Same KMS key, same TLS-only policy, same failure alert (it runs in
   the same unit). On the `BACKUP_DIR` branch no file copy is made — it would sit on the same disk; the hospital's host
   backup must cover `/var/lib/medbrains` directly. Tested by `deploy/standalone/test-pg-backup-local.sh` (stubbed
   `aws`: dump key, sync target, pgdata exclusion, absent root skipped).
3. After apply, on the host (a prod change — yours):
   ```sh
   terraform output prod_ops        # BACKUP_BUCKET, ALERT_TOPIC_ARN, whether the policy attached
   # if backup_policy_attached = false: give the instance a role with that policy (console: EC2 → Actions →
   # Security → Modify IAM role), then re-apply so the attachment is made.
   sudo sh -c 'printf "BACKUP_BUCKET=%s\nALERT_TOPIC_ARN=%s\n" <bucket> <topic-arn> >> /etc/medbrains/env'
   # ship the updated script: next deploy installs it, or scp + install -m 0755 to /usr/local/bin/
   sudo systemctl start medbrains-pg-backup.service && journalctl -u medbrains-pg-backup -n 20
   sudo systemctl start medbrains-host-check.service   # must now say "an object landed in the last 26h"
   pg_dump --version                                   # must be >= 17 (server is 17); apt's 16 refuses
   ```
   Note: with `BACKUP_BUCKET` set the script writes **only** to S3 (it is either/or). Keep the pre-deploy manual
   dump habit for a fast local copy.

### Client-side encryption (age) — added 2026-10-26

Every dump, and a tarball of `/etc/medbrains`, is sealed with [age](https://age-encryption.org) to the public
key(s) of the hospital running the install, in `/etc/medbrains/backup-recipients.txt` (written by `install.sh`)
inside the `pg_dump | age | aws s3 cp -` pipe — no plaintext touches the disk or the bucket. Only a **public** key
is on the host, so the earlier objection (a second secret on the host to manage and lose) does not apply: the
private key is kept offline by the hospital (generation and rotation: `deploy/standalone/README.md`, "Encrypted
off-site backups"). The backup script refuses to run without a key on either destination, and the writer IAM policy
only accepts `*.age` keys under the dump and secrets prefixes. Locally (`BACKUP_DIR`) dumps are sealed the same way
(`*.dump.age`, `*.secrets.tar.age`). The files mirror stays SSE-KMS only (`aws s3 sync` cannot seal per object).

`/etc/medbrains` is backed up because a restored database is not usable without it:
`MEDBRAINS_IDENTIFIER_HMAC_KEY` keys every identifier fingerprint, and the ABDM/NHCX/JWT keys and role passwords
live there. The app (user `medbrains`) cannot read the sealed copy; nobody can without the offline key.

Every run (and every failure) writes a `backup_history` row (`tenant_id` NULL = the installation); Admin →
Settings → System health shows the newest good one and turns red at 26 h. `install.sh` runs the same unit before
every re-deploy and stops if it fails, and the deploy then fails too. The new binaries are already installed by
then, so finish the same day: fix the backup and re-deploy, or take a dump by hand and restart (the commands are in
the error). `SKIP_PREDEPLOY_BACKUP=1` works only when `install.sh` is run by hand on the host; terraform does not pass it.

A bucket whose policy allows only some prefixes (a write-only vault owned by another account) refuses the defaults
`pg-backups-monthly/`, `secrets-backups/` and `file-backups/` with `AccessDenied ... no resource-based policy allows`.
Set all four in `/etc/medbrains/env` under an allowed prefix, for example `BACKUP_PREFIX=pg`,
`BACKUP_MONTHLY_PREFIX=pg/monthly`, `BACKUP_SECRETS_PREFIX=pg/secrets`, `BACKUP_FILES_PREFIX=pg/files`, then
`sudo systemctl start medbrains-pg-backup.service` to prove it. The vault's retention then applies to those keys.

## Backup quality matrix

What each method protects against, what you can lose (RPO) and how long until the hospital works again (RTO). The
methods are independent. Losing one key, one tool or one prefix leaves the others.

| Method | What it is | RPO | RTO | Protects against | Needs to restore |
|---|---|---|---|---|---|
| Nightly dump (`medbrains-pg-backup`) | `pg_dump` sealed with age to the hospital's **offline** key; Object Lock 30 d | ≤ 24 h | ≈ 1 min per 0.5 GB to restore; ≈ 2 h for a lost host | lost host or disk, ransomware (the host cannot read or delete it), a bad deploy | the offline age key, operator credentials |
| Point-in-time recovery (WAL-G, **opt-in**, `PITR_ENABLED=1`) | WAL every ≤ 5 min plus a daily base backup (full weekly), sealed with WAL-G's libsodium key | **≤ 6 min** | base fetch + WAL replay: minutes for a small hospital; ≈ 1 h for a lost host | everything above, **plus** "restore to 10:41": a wrong bulk update, a dropped table, ransomware inside the database | `/etc/medbrains/walg.key` (on the host, and in the sealed secrets backup) |
| Lightsail / EBS snapshots (per-hospital servers) | whole disk, daily, 7 kept | ≤ 24 h | ≈ 15 min (new instance from snapshot) | a lost instance | the AWS account |
| Monthly restore test (`medbrains-restore-test`, with PITR) | restores the PITR archive on the server into a scratch standby, checks it, emails the result | n/a | n/a | an archive that looks fine and does not restore | nothing new: it uses `walg.key` |
| Per-hospital export (`medbrains-tenant-export`) | one tenant, weekly, sealed | ≤ 7 d | hours (a new install plus import) | a hand-over or a move. **Not** disaster recovery | the receiving key |

Before PITR the data-loss window is the day since 02:30. With PITR it is the last few minutes.

## Point-in-time recovery (opt-in, RPO ≤ 6 min)

Off by default. Nothing changes on any server until its env file says `PITR_ENABLED=1` and `install.sh` runs (or
`medbrains-wal-g-setup --apply` is run by hand). It works on both tiers: the host's own Postgres (attach), and the
dedicated tier's `medbrains-postgres` container (Rishi's Lightsail server, `postgres:17-alpine`).

**Tool: WAL-G** (`v3.0.9`, pinned and checksum-verified; the Ubuntu 22.04 build also runs on Debian 12), not
pgBackRest. Both stream WAL to S3. The deciding point is retention **without delete rights**: the host may never
delete backups. pgBackRest keeps `backup.info` / `archive.info` catalogues and expects to expire backups itself, which
needs `s3:DeleteObject`. If a lifecycle deletes underneath it, the catalogue references missing sets and `info` /
`expire` fail. WAL-G finds backups by listing the prefix, so the bucket's lifecycle owns retention, and the host keeps
put, get and list only. On an Object Lock bucket a delete from the host would only add a delete marker anyway: the
versions stay billed until their lock date. Storage is about retention × WAL volume either way. Neither tool runs
inside the alpine container (musl; both ship glibc builds), which is why the spool below exists.

**How it works.**

1. `archive_command` copies each finished WAL segment into `<data directory>/medbrains-wal-spool/`: cp, fsync,
   rename, fsync. An identical earlier copy counts as done; a different one fails loudly. The data directory is the
   one place both the container and the host see, so enabling this never recreates the container.
2. `medbrains-wal-push.timer`, every minute on the host, runs `wal-g wal-push` on each spooled file and deletes it
   only once WAL-G has accepted it.
3. `medbrains-wal-g-backup.timer` runs daily at 03:00 local, after the dump. `WALG_DELTA_MAX_STEPS=6`, so a full
   base goes up weekly with deltas in between.
4. RPO: `archive_timeout` 300 s plus the 60 s push.
5. `medbrains-host-check` pages when `pg_stat_archiver` shows a current failure, or when a spooled file is older than
   15 minutes (WAL that is not off-site). The push unit itself does not page, because an S3 outage would page every
   minute.

**Encryption, and how it relates to the age dumps.** WAL and base backups are sealed on the host by WAL-G's libsodium
crypter, a 32-byte key in `/etc/medbrains/walg.key` (`WALG_LIBSODIUM_KEY_PATH`, hex). The key is made once by the
setup and never replaced. The bucket adds SSE (SSE-S3 or SSE-KMS), Object Lock, deny-delete and TLS-only on top. This
is a **symmetric key on the host**, unlike the dumps, whose private key is offline. That is deliberate: the host must
read its own WAL archive to take delta backups and to run the monthly restore test, and the host can read the live
database anyway. What root on the host gains is access to history (rows already deleted). The dumps stay sealed to
the offline key as an **independent second method**: a stolen host key opens the PITR archive and nothing else, and a
lost host key loses PITR and nothing else. `walg.key` lives in `/etc/medbrains`, so the nightly sealed secrets backup
carries it. A replacement host gets it back with the offline key. Keep a second copy with the age key.

**Shared cluster: check first, every time.** WAL archiving and base backups work per **cluster**, not per database.
On a server whose Postgres also holds another application's databases, enabling it would copy that application's
data into MedBrains' bucket. The setup therefore **refuses** when the cluster holds any database other than
MedBrains' own (`POSTGRES_DB` or the one in `DATABASE_URL`, `spicedb`, and `PITR_ALLOWED_DATABASES`), or when
`archive_command` is already set by another tool. Check by hand as well:

```sh
sudo -u postgres psql -c '\l'                                         # the host's own Postgres
sudo docker exec medbrains-postgres psql -U medbrains -c '\l'         # the container
sudo -u postgres psql -XAtc 'SHOW archive_mode; SHOW archive_command'   # someone else archiving?
```

A per-hospital server (its own Postgres, nothing else on it) passes. **The shared production host does not.** Its
cluster also serves another client's ERP and HR databases, and that client archives the whole cluster with its own
tooling. There, PITR for MedBrains first needs **its own Postgres cluster** on the same machine. Outline, not yet
planned in detail:

1. `pg_createcluster 17 medbrains --port 5433` (its own data directory and unit, `postgresql@17-medbrains`).
2. Roles with `db-roles.sh`, then `pg_dump -Fc` from 5432 and `pg_restore` into 5433. Compare row counts with
   `medbrains-restore-drill`'s checks.
3. Cutover: stop the server, take a final dump and restore it, point every `*DATABASE_URL` and SpiceDB's URI at
   5433, start, verify.
4. Rollback: point the URLs back. The 5432 database is untouched until the hospital confirms.
5. Then `WAL_PGPORT=5433` and `PITR_ENABLED=1`.
6. Drop the 5432 copy, so the other client's base backups stop carrying MedBrains' data. Their **existing** archives
   still hold it until their retention passes.

Until that is done, the shared host has dumps only.

**Credentials.** The setup uses the instance role (prod EC2) or root's `~/.aws/credentials` beside the container
(Lightsail has no instance role; the units run as root with `HOME=/root` so the SDK finds it). No static key is
written by this kit.

**IAM and retention, per bucket.**

| Bucket | Prefix | Grant | Retention |
|---|---|---|---|
| prod, `infra/terraform/envs/medbrains-in/ops.tf` | `wal-g/<host>/` | `company_wal_archiving = true` attaches `prod_wal_g`: Put/Get/AbortMultipartUpload on `wal-g/*`, List on the prefix, KMS via S3 only; no delete | lifecycle `wal-g`: `company_wal_retention_days` (default 35, 14-400) |
| per-hospital, private repo `hospital-backups` | `<slug>/pitr/<host>/` | put, get, list on `<slug>/pitr/*` for the writer user (source IP pinned); no delete; objects are not `.age` (WAL-G seals them itself) | lifecycle on `<slug>/pitr/` |

Restore reaches back about **retention minus 7 days**, because a full base backup is at most 7 days old and the
deltas need it. Get is needed because WAL-G reads its own archive: delta backups read the previous backup's metadata,
`wal-push` checks for an existing segment, and the restore test fetches everything.

**Enable (yours, a prod change):**

```sh
# 1. The bucket grants (prod: terraform apply with company_wal_archiving = true; per-hospital: the module).
# 2. On the server, in /etc/medbrains/env:
#      PITR_ENABLED=1
#      WALG_S3_PREFIX=s3://<bucket>/<slug>/pitr     # prod: terraform output prod_ops (…/wal-g)
#      WALG_S3_SSE_KMS_ID=<key arn>                 # SSE-KMS buckets only
sudo bash /tmp/standalone/medbrains-wal-g-setup              # dry run: refuses a shared cluster, prints the plan
sudo bash /tmp/standalone/install.sh <domain> <ops-email> <bucket>   # or: medbrains-wal-g-setup --apply --restart-if-needed
sudo medbrains-wal-g list                                     # the first base backup
sudo systemctl start medbrains-host-check && journalctl -u medbrains-host-check -n 20   # "wal: spool drained"
```

The setup checks the archive before Postgres depends on it. It lists the prefix and round-trips a sealed canary
(`canary/…`), which also proves Object Lock accepts WAL-G's uploads. If the canary is refused, nothing is changed.
Beside the container, `--restart-if-needed` restarts it once for `archive_mode`. The host's own Postgres is never
restarted for you.

**Disable:** `ALTER SYSTEM SET archive_mode = off`, restart Postgres,
`systemctl disable --now medbrains-wal-push.timer medbrains-wal-g-backup.timer`, set `WAL_ARCHIVING=0` and
`PITR_ENABLED=0`, and empty `medbrains-wal-spool/`. While archiving is on and pushing fails, the spool grows until the
disk fills, which is why the host check pages after 15 minutes.

### Point-in-time restore ("restore to 10:41")

On the server, or a replacement holding the same `walg.key` and bucket access. Restore beside nothing: this replaces
the cluster, so take the evidence dump first (runbook step 2).

```sh
sudo systemctl stop medbrains-server
SPOOL=$(sudo medbrains-wal-g spool); DATA=${SPOOL%/medbrains-wal-spool}
sudo docker stop medbrains-postgres          # host's own Postgres: sudo systemctl stop postgresql
OWNER=$(sudo stat -c %u:%g "$DATA")
sudo mv "$DATA" "$DATA.broken-$(date -u +%F)" && sudo install -d -o "${OWNER%:*}" -g "${OWNER#*:}" -m 0700 "$DATA"
sudo medbrains-wal-g fetch-base "$DATA"
sudo rm -rf "$DATA/medbrains-wal-spool" && sudo install -d -m 0700 "$DATA/medbrains-wal-spool" "$DATA/medbrains-wal-restore"
sudo medbrains-wal-g fetch-wals "$DATA/medbrains-wal-restore"      # prints how many segments it fetched
sudo chown -R "$OWNER" "$DATA"
sudo touch "$DATA/recovery.signal"
sudo tee -a "$DATA/postgresql.auto.conf" <<'CONF'
restore_command = 'cp medbrains-wal-restore/%f %p'
recovery_target_time = '2026-11-17 10:41:00+05:30'   # just before the incident; omit to replay everything
recovery_target_action = 'promote'
CONF
sudo chown "$OWNER" "$DATA/postgresql.auto.conf" "$DATA/recovery.signal"
sudo docker start medbrains-postgres         # or: sudo systemctl start postgresql; replays, then promotes
```

`restore_command` copies from a prefetched directory instead of calling WAL-G, so the same steps work in the
container. When the log says `database system is ready to accept connections`, do step 7 (verify) of the runbook
below. Then delete the three recovery lines and `medbrains-wal-restore/`, start the server, and take a fresh base
backup straight away (`systemctl start medbrains-wal-g-backup`): the timeline changed. Keep `$DATA.broken-*` until the
hospital confirms.

## Monthly restore test (automatic, with PITR)

`medbrains-restore-test.timer` runs on the 1st of each month at 05:00 (server time) on every server with
`PITR_ENABLED=1`. It is enabled and disabled by `install.sh` with PITR. It proves on the server itself that the
point-in-time archive restores, emails the result to `BACKUP_REPORT_TO`, writes `RESTORE_TEST_LAST="<date> PASSED"` (or
`FAILED` / `SKIPPED`) into `/etc/medbrains/env`, and pages through `OnFailure=` when it fails. The nightly backup email
shows the line too.

What it does:

1. **Refuses to risk the live database.**
   - The scratch directory must be named `…/medbrains-restore-test…` (default `/var/lib/medbrains-restore-test`).
   - It must not be inside the live data directory.
   - It must not already exist unless the script's own marker is in it.
   - There must be space for 1.3 × the cluster's size plus `RESTORE_TEST_RESERVE_GB` (5) to spare. Otherwise the
     email says **SKIPPED: not enough space**, and nothing is restored.
2. Fetches the newest base backup and every WAL segment since, with `medbrains-wal-g fetch-base` / `fetch-wals`.
3. Starts a throwaway Postgres on the copy **as a standby**: `standby.signal`, `restore_command = cp …`,
   `archive_mode=off`, `hot_standby=on`, `shared_buffers=32MB`, no TCP listener.
   - Host tier: socket in the scratch directory, port 55439.
   - Container tier: a container `medbrains-restore-test` from the same image, `--network none`, `--memory 512m`.
   - A standby never promotes, so it never starts a new timeline and can never write into the archive.
4. Waits until the replay position stops moving, then checks:
   - the schema version equals the live database's, and no migration failed;
   - the newest `audit_log` entry is within `RESTORE_TEST_MAX_LAG_MIN` (30) of the live one when the test began;
   - for every hospital, rows in `users`, `patients`, `encounters`, `invoices` and `audit_log`, restored against live.
     A table that has rows live and none restored fails.
5. Stops the scratch server and deletes the directory, on every exit path.

`sudo medbrains-restore-test --print` runs it by hand and shows the email instead of sending it.

**Why it tests the PITR path and not the dumps (the key question).** The dumps are sealed to the hospital's **offline**
age key. Testing them on the server means putting a private key there that opens every dump. A separate "test" key
whose private half lives in a root-only file would do the same thing. Root on the host could then read every
historical dump (deleted patients, old records), and the host would also need **read** access to the dump prefixes,
which it does not have today. That breaks the property that a compromised server cannot read or exfiltrate its own
backup history.

The PITR archive has no such cost: the server already holds `walg.key` to take delta backups, and it can read the live
database anyway. So:

- **automated monthly** on the PITR path, here;
- **manual** for the age dumps, from the operator's machine with the offline key (`medbrains-restore-drill`, below),
  quarterly and after any change to the backup script. Record it in `RESTORE_DRILL_LAST`.

The two together cover both independent methods.

Tested so far: locally, a Homebrew PostgreSQL 17.5 standby from `pg_basebackup` plus WAL prefetched by
`archive_command` into `medbrains-wal-restore/`. It came up in recovery, replayed to the live row count (50,001 =
50,001), reported `archive_mode = off` with the live cluster's `archive_command` still in its `postgresql.auto.conf`,
and left the spool empty. The script's comparison logic was run against two seeded tenants. **Not yet run on a
server.** The first scheduled run, or `--print` after enabling PITR, is its first real result. Append it here.

## Restore runbook

Run as an operator with credentials that can **read** the bucket and **decrypt** with the backup key (the host cannot,
by design). Never restore over the live database directly — restore beside it, verify, then swap.

1. **Declare and freeze.** Tell the hospital the system is read-only; stop writers:
   `sudo systemctl stop medbrains-server medbrains-pg-backup.timer`.
2. **Take a dump of what is there now**, even if it is broken — it is evidence and a fallback:
   `umask 077; sudo -u postgres pg_dump -Fc -d medbrains -f /var/backups/medbrains/pre-restore-$(date -u +%FT%H-%M-%SZ).dump`
3. **Pick the archive.** First prove it with `deploy/standalone/medbrains-restore-drill` (below) on your machine.
   - S3: `aws s3 ls s3://<bucket>/pg-backups/<host>/ | sort | tail` (and `pg-backups-monthly/` for older), then
     `aws s3 cp s3://<bucket>/pg-backups/<host>/<stamp>.dump.age /var/tmp/restore.dump.age`. Objects from before
     2026-10-26 end in `.sql.gz` and are unsealed custom format.
   - Local: `ls -t /var/backups/medbrains/*.dump* | head -1`.
   - Decrypt **with the offline key, which never stays on the server**: decrypt on your machine and copy the
     plaintext up over SSH, or `age -d -i key.age restore.dump.age | ssh host 'umask 077; cat > /var/tmp/restore.dump'`.
     Shred both copies afterwards. Secrets, if the host is new:
     `age -d -i key.age <stamp>.tar.age | tar -xOf - medbrains/env` gives the old `/etc/medbrains/env` — restore at
     least `MEDBRAINS_IDENTIFIER_HMAC_KEY`, `MEDBRAINS_ABDM_SECRET_KEY`, `MEDBRAINS_NHCX_SECRET_KEY`, `MEDBRAINS_PACS_SECRET_KEY`, `MEDBRAINS_EVENT_TOKEN_KEY`, `MEDBRAINS_SIGNATURE_KEY_ENCRYPTION_KEY`, `MEDBRAINS_OAUTH_TOKEN_KEY` and the JWT keys
     before the server starts.
   - Sanity: `pg_restore --list /var/tmp/restore.dump | grep -c 'TABLE DATA'` (expect ~915).
4. **Roles first (new host only).** Dumps carry no roles. On a fresh cluster create the owner role, then
   `medbrains_app` and `medbrains_outbox_worker` — `deploy/standalone/db-roles.sh` does this and sets their passwords
   into `/etc/medbrains/env`.
5. **Restore beside the live DB:**
   ```sh
   sudo -u postgres createdb -O <owner> medbrains_restore
   sudo -u postgres pg_restore -d medbrains_restore --no-owner --role=<owner> --exit-on-error -j 4 /var/tmp/restore.dump
   ```
6. **Grants — only for dumps taken before 2026-10-12** (made with `--no-privileges`): re-run the GRANT / ALTER DEFAULT
   PRIVILEGES statements of migrations `0981_app_role_without_rls_bypass.sql` and `0984_outbox_worker_role.sql`
   (`crates/medbrains-db-migrations/src/migrations/`) against `medbrains_restore` as the owner. The migrations will not
   re-run them: `_sqlx_migrations` already records them.
7. **Verify** (same checks as the drill): `_sqlx_migrations` count/max version equal what the deployed binary expects;
   row counts of `tenants, users, patients, encounters, invoices, audit_log`; `SET ROLE medbrains_app; SELECT 1 FROM
   patients LIMIT 1;` must not say "permission denied"; newest `audit_log.created_at` ≈ the dump time.
8. **Swap:** `ALTER DATABASE medbrains RENAME TO medbrains_broken_<date>; ALTER DATABASE medbrains_restore RENAME TO medbrains;`
   (no connections may be open), then `sudo systemctl start medbrains-server`; `curl -s https://app.medbrains.in/api/health`
   must show `"status":"ok"`. Re-enable `medbrains-pg-backup.timer`.
9. **Files.** If the files tree is lost or damaged, restore it from the mirror (operator credentials, not the host's —
   the host cannot read): `aws s3 sync s3://<bucket>/file-backups/<host>/var/lib/medbrains/ /var/lib/medbrains/
   --exclude 'pgdata/*'` (and the same for `/var/lib/medbrains-edge`), then `chown -R medbrains:medbrains` both. For a
   single file overwritten or deleted after the last sync, list versions:
   `aws s3api list-object-versions --bucket <bucket> --prefix file-backups/<host>/var/lib/medbrains/<path>` and
   `aws s3api get-object --version-id <id> …`. The mirror is up to 24 h behind (it runs with the nightly dump), so
   documents generated since then are re-generated from the restored rows where possible.
10. **Afterwards:** record the data-loss window (dump time → incident time) and tell the hospital which entries must be
   re-keyed from paper. Keep `medbrains_broken_<date>` until they confirm, then drop it.

Whole host lost: launch a replacement in the same VPC/subnet, run the terraform deploy for the env, stop the server,
then steps 3-8. Repoint `app.medbrains.in` (`envs/medbrains-in/app.tf` reads the instance id — change
`company_prod_instance_id`) and the old name.

## Restore drill — 2026-10-12 (local dev DB)

Environment: `docker compose` service `postgres` (`postgres:17-alpine`, PostgreSQL 17.11), database `medbrains`,
562 MB on disk, 917 tables, 525,019 rows, 141 applied migrations. Same flags as the prod script.

Drill 1 — exactly what prod ran until today (`--no-owner --no-privileges`):

```sh
docker compose exec -T postgres pg_dump -U medbrains -d medbrains --format=custom --compress=9 \
  --no-owner --no-privileges -f /tmp/drill.dump                              # 15 s, 58.9 MB
docker compose exec -T postgres pg_restore --list /tmp/drill.dump | grep -c "TABLE DATA"   # 915
docker compose exec -T postgres psql -U medbrains -d postgres -c "CREATE DATABASE medbrains_restore_drill"
docker compose exec -T postgres pg_restore -U medbrains -d medbrains_restore_drill \
  --no-owner --no-privileges --exit-on-error /tmp/drill.dump                 # 40 s, exit 0
```

Verification — exact `count(*)` of **every** table in both databases (a PL/pgSQL loop over `pg_tables`), diffed:

| Table | Source | Restored |
|---|---|---|
| tenants | 4 | 4 |
| users | 18,583 | 18,583 |
| patients | 3,815 | 3,815 |
| encounters | 2,839 | 2,839 |
| invoices | 743 | 743 |
| roles | 121 | 121 |
| departments | 1,256 | 1,256 |
| audit_log | 178,896 | 178,896 |
| lab_orders | 163 | 163 |
| prescriptions | 494 | 494 |
| admissions | 457 | 457 |
| appointments | 96 | 96 |
| **all 917 tables** | | **identical** |

`_sqlx_migrations`: 141 rows, max version 1061, md5 over (version, checksum, success) `02909cd5…f0a4` — identical.
Schema objects identical: 915 policies, 870 RLS-enabled relations, 1,313 triggers, 125 functions, 4,222 indexes,
4 extensions.

**Finding 1 (fixed):** table grants to `medbrains_app` / `medbrains_outbox_worker`: **7,360 in the source, 0 in the
restore**; default privileges likewise lost. Prod's install splits roles (`deploy/standalone/db-roles.sh`: requests
connect as `medbrains_app`), so a restore of any prod dump taken before today yields a database on which **every
request is refused**, and migrations will not repair it. Fix: dropped `--no-privileges` from the backup script.

Drill 2 — the fixed flags (`--no-owner` only): dump 14 s / 59.3 MB, restore 31 s; all 917 table counts identical;
grants 7,360 = 7,360; default ACLs 3 = 3; `SET ROLE medbrains_app` reads succeed.

Cleanup: `DROP DATABASE medbrains_restore_drill`, dump files removed; confirmed 0 scratch databases remain.

Not covered by this drill (do it before calling DR proven): a restore **from S3** onto a **fresh host** with the roles
created by `db-roles.sh`, timed end-to-end, and the uploaded-objects tree. Repeat the drill quarterly and after any
change to the backup script; append results here.

## Restore drill script (operator machine)

`deploy/standalone/medbrains-restore-drill` (`make restore-drill FROM=… IDENTITY=…`) does steps 3, 5 and 7 into a
throwaway Postgres 17 container: newest object under `--from` (S3 prefix, directory or file) → `age -d` with the
offline key (a tampered or truncated object fails here, age authenticates each chunk) → creates the roles the
archive grants to → `pg_restore --exit-on-error -j 4` → checks: migrations recorded and none failed, exact row
counts of every table (`--counts-out` writes them), tenants/users present, newest `audit_log`, `SET ROLE
medbrains_app` can read `patients`; `--secrets-from` decrypts the `/etc/medbrains` archive and lists the key
**names** only. Prints download/decrypt/restore timings (the RTO evidence) and exits non-zero on any failure.
The plaintext dump lives only in a 0700 temp dir for the run.

`deploy/standalone/test-backup-drill-e2e.sh` (`make test-backups`) proves the whole chain locally with a throwaway
key and a directory as the bucket: the uploaded object is age ciphertext (no `PGDMP` magic, `pg_restore` cannot read
it, a wrong key cannot open it, secret values absent), S3 without a key is refused and recorded, monthly-then-daily
placement, `backup_history` rows, restored row counts identical to the source, scratch DB dropped, tampered object
fails, and the drill also runs in its own throwaway container. 15/15 on 2026-10-26.

## Known gaps

- The files mirror and point-in-time recovery are code only — inert until the bucket grants are applied and the host
  steps are run. PITR has not yet run against a real bucket: the setup's canary is the first proof, and the monthly
  restore test the second.
- The files mirror runs once a day: up to 24 h of generated documents can be lost even with WAL archiving on.
- The age-dump restore drill is run by hand (it needs the offline key, so it cannot be scheduled on the host by
  design). Quarterly, and after any change to the backup script. The PITR archive is tested monthly by the server
  itself (`medbrains-restore-test`).
- Losing the offline key (and any second recipient) makes every sealed backup unreadable. Keep two copies.
- Object Lock requires a checksum on every PUT. The backup script sends one. WAL-G's SDK sends one by default
  (`AWS_REQUEST_CHECKSUM_CALCULATION=WHEN_SUPPORTED`), and the setup's canary upload proves it before anything
  depends on it.
- The shared production host cannot have PITR until MedBrains has its own cluster there (see "Shared cluster").
