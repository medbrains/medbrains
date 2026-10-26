# Backup and restore — production (app.medbrains.in)

Last reviewed 2026-10-26 (age client-side encryption, monthly retention, Object Lock, pre-deploy backup, restore drill script). Read before any prod change, and before you need it.

## What prod actually is

| | |
|---|---|
| Host | one EC2, `i-08e9496a3e110ebdc`, ap-south-1 (`TF_VAR_tier=attach` in `infra/.env`) |
| Database | the host's own **native Postgres 17** (`TF_VAR_attach_reuse_postgres=true`), not a container |
| Front | Caddy on the host (`TF_VAR_attach_reuse_tls=true`) |
| Deploy | `deploy/standalone/install.sh`, driven by terraform (`envs/clients/alagappa`, formerly `envs/standalone/alagappa`) |

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
key(s) in `deploy/standalone/backup-recipients.txt` (installed to `/etc/medbrains/backup-recipients.txt`)
inside the `pg_dump | age | aws s3 cp -` pipe — no plaintext touches the disk or the bucket. Only a **public** key
is on the host, so the earlier objection (a second secret on the host to manage and lose) does not apply: the
private key is kept offline by the founder (generation: `deploy/standalone/README.md`, "Founder's steps"). The
backup script refuses an S3 destination without a key, and the writer IAM policy only accepts `*.age` keys under
the dump and secrets prefixes. Locally (`BACKUP_DIR`) dumps are sealed too once the key is installed
(`*.dump.age`, `*.secrets.tar.age`). The files mirror stays SSE-KMS only (`aws s3 sync` cannot seal per object).

`/etc/medbrains` is backed up because a restored database is not usable without it:
`MEDBRAINS_IDENTIFIER_HMAC_KEY` keys every identifier fingerprint, and the ABDM/NHCX/JWT keys and role passwords
live there. The app (user `medbrains`) cannot read the sealed copy; nobody can without the offline key.

Every run (and every failure) writes a `backup_history` row (`tenant_id` NULL = the installation); Admin →
Settings → System health shows the newest good one and turns red at 26 h. `install.sh` runs the same unit before
every re-deploy and stops if it fails (`SKIP_PREDEPLOY_BACKUP=1` only after a manual dump).

## RPO / RTO

| | Today | After the fix |
|---|---|---|
| **RPO** (data you can lose) | up to 24 h, and **everything** if the disk is lost | up to 24 h with dumps only; **≤ 5 min** (≤ 15 min target) with WAL archiving opted in |
| **RTO** (time to serve again) | restore itself ≈ 1 min per 0.5 GB (drill below); unbounded if the host is gone | new host + deploy (~30-60 min incl. build) + restore (minutes) + DNS (TTL 600 s) ≈ **2 h target** |

## WAL archiving (opt-in, RPO ≤ 15 min)

Not enabled by default. Nothing runs until an operator applies terraform with the flag **and** runs the setup script.

**Tool: WAL-G** (`v3.0.9`, pinned), not pgBackRest. Both stream WAL to S3 with SSE-KMS from an instance role. The
deciding point is retention without delete rights: the host here may never delete backups. pgBackRest keeps
`backup.info` / `archive.info` catalogues and expects to expire backups itself (`s3:DeleteObject`); if an S3 lifecycle
deletes underneath it, the catalogue references missing sets and `info`/`expire` fail. WAL-G discovers backups by
listing the prefix, so an S3 lifecycle can own retention and the host keeps write+read only. WAL-G is also one static
binary with an official Ubuntu 24.04 Postgres build for both `aarch64` (prod is `t4g`) and `amd64`; pgBackRest would
come from PGDG/universe apt and add a repo dependency to a host we share with the hospital. Availability check: the
release ships `wal-g-pg-24.04-aarch64` / `-amd64` with published SHA-256 digests (pinned in the script).

As code:

| Piece | File |
|---|---|
| IAM grant on `wal-g/` (Put/Get/List, KMS encrypt+decrypt; no delete) behind `company_wal_archiving = false` | `infra/terraform/envs/medbrains-in/ops.tf` (`aws_iam_policy.prod_wal_g`) |
| Retention: `wal-g/` expires at 35 days (lifecycle rule `wal-g`) | same |
| Installer: pinned + checksum-verified `wal-g`, `/etc/medbrains/walg.yaml` (no secrets), `ALTER SYSTEM` `archive_mode=on`, `archive_command='/usr/local/bin/wal-g --config /etc/medbrains/walg.yaml wal-push %p'`, `archive_timeout=300`, preflight `wal-g st ls`, `WAL_ARCHIVING=1`; dry run by default | `deploy/standalone/medbrains-wal-g-setup` |
| Daily base backup 03:00 UTC, delta chain ≤ 6 (weekly full), `OnFailure` alert | `deploy/standalone/medbrains-wal-g-backup.{service,timer}` |
| Alert when `pg_stat_archiver` shows a failure newer than the last success (not on idle) | `deploy/standalone/medbrains-host-check` |

RPO: a segment is archived when full (16 MB) or after `archive_timeout` (300 s) with any activity, so ≤ 5 min of WAL
is at risk, inside the 15 min target. Cost: one segment per 5 busy minutes is ≤ 288 × 16 MB/day before compression —
small. Not on the starter tier (Postgres in a container); this is for the native-Postgres attach host.

Enable (yours, a prod change):

```sh
cd infra/terraform/envs/medbrains-in
( set -a; source ../../../.env; set +a
  terraform plan -var company_wal_archiving=true -var 'company_alarm_email=…' -out wal.tfplan && terraform apply wal.tfplan )
terraform output prod_ops        # WALG_S3_PREFIX, WALG_S3_SSE_KMS_ID
# on the host, with deploy/standalone/ copied up:
sudo WALG_S3_PREFIX=… WALG_S3_SSE_KMS_ID=… bash medbrains-wal-g-setup            # dry run
sudo WALG_S3_PREFIX=… WALG_S3_SSE_KMS_ID=… bash medbrains-wal-g-setup --apply
sudo systemctl restart postgresql   # at a quiet moment — archive_mode needs it; the script says when
sudo -u postgres wal-g --config /etc/medbrains/walg.yaml backup-list
```

Disable: `ALTER SYSTEM SET archive_mode = off` + restart, `systemctl disable --now medbrains-wal-g-backup.timer`,
`WAL_ARCHIVING=0`. While archiving is on, a broken `archive_command` makes `pg_wal` grow until the disk fills — the
host check pages on the first failure for that reason.

### Point-in-time restore (WAL-G)

On the host (its role can read `wal-g/` once opted in) or a replacement with the same role:

```sh
PGDATA=$(sudo -u postgres psql -XAtc 'SHOW data_directory')   # Ubuntu PGDG: /var/lib/postgresql/17/main
sudo systemctl stop medbrains-server postgresql
sudo mv "$PGDATA" "${PGDATA}.broken-$(date -u +%F)" && sudo install -d -o postgres -m 0700 "$PGDATA"
sudo -u postgres wal-g --config /etc/medbrains/walg.yaml backup-fetch "$PGDATA" LATEST
sudo -u postgres touch "$PGDATA/recovery.signal"
sudo -u postgres tee -a "$PGDATA/postgresql.auto.conf" <<'CONF'
restore_command = '/usr/local/bin/wal-g --config /etc/medbrains/walg.yaml wal-fetch %f %p'
recovery_target_time = '2026-10-12 09:41:00+05:30'   # just before the incident; omit to replay everything
recovery_target_action = 'promote'
CONF
sudo systemctl start postgresql    # replays WAL, then promotes; watch the server log
```

Then step 7 (verify) of the runbook below, remove the `restore_command`/`recovery_target_*` lines, start the server.
Take a fresh base backup straight after (`systemctl start medbrains-wal-g-backup`): the timeline changed.

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
     least `MEDBRAINS_IDENTIFIER_HMAC_KEY`, `MEDBRAINS_ABDM_SECRET_KEY`, `MEDBRAINS_NHCX_SECRET_KEY`, `MEDBRAINS_PACS_SECRET_KEY` and the JWT keys
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

- The files mirror and WAL archiving are code only — inert until `ops.tf` is applied and the host steps are run.
- The files mirror runs once a day: up to 24 h of generated documents can be lost even with WAL archiving on.
- The restore drill is run by hand (it needs the offline key, so it cannot be scheduled on the host by design).
  Quarterly, and after any change to the backup script.
- Losing the offline key (and any second recipient) makes every sealed backup unreadable. Keep two copies.
- Object Lock requires a checksum on every PUT; the backup script sends one, WAL-G is untested against it — run
  `wal-g st put` once before opting WAL archiving in.
