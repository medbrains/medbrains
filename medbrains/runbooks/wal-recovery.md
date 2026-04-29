# Runbook — WAL Recovery + PITR

**Owner:** Platform / DBA
**Page:** PagerDuty `medbrains-db` rotation
**Source:** RFCs/sprints/SPRINT-B-patroni-ha.md §5

## When to use this

- A migration corrupted production data and we need to roll back to N minutes ago
- A bug deleted rows that shouldn't have been deleted
- The Patroni cluster lost quorum and the recovered nodes' WAL diverged
- The daily restore-test cron alert (`PgBackRestRestoreTestFailed`) fires
- Cross-region disaster recovery (Sprint D — copy from DR bucket)

## What's available

- **pgBackRest WAL archive** — every 60s push to `s3://medbrains-{env}-wal-archive-{region}/cluster-{id}/`. KMS-encrypted at rest + client-side AES-256-CBC. Retention: 35d hot WAL, 7 full backups.
- **Nightly basebackup** — 02:00 IST. ~50GB compressed via zst.
- **Cross-region snapshot** (Phase D) — every 6h to DR region.
- **PITR** — any timestamp within the WAL archive window.

## Procedure: Point-In-Time Recovery

### 1. Determine target time

```bash
# Find the latest "good" timestamp via the audit chain (since hash chain
# integrity is a hard guarantee, this is the canonical source of truth).
psql -h $WRITER_HOST -U postgres -c "
  SELECT created_at FROM audit_log
   WHERE tenant_id = '$TENANT_ID'
   ORDER BY created_at DESC
   LIMIT 1
"
```

Or use the verify-chain CLI to find when the chain was last clean:
```bash
medbrains-server audit verify-chain --tenant=$TENANT_ID
```

### 2. Stop writes (read-only mode)

```bash
# Sprint A.6 system_state — flips all non-GET to 503 for the affected tenant
curl -X POST $API/api/admin/system_state \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"mode":"read_only","reason":"PITR in progress"}'
```

### 3. Restore on a fresh node

```bash
# On a fresh PG instance with the same Patroni AMI:
pgbackrest --stanza=$CLUSTER_ID \
  --type=time \
  --target='2026-04-28 14:30:00 +05:30' \
  --target-action=promote \
  --delta \
  restore
```

`--delta` skips files already present (faster on a partial restore). `--target-action=promote` runs recovery to target then opens the DB read-write.

### 4. Validate

```bash
psql -h localhost -U postgres -c "
  SELECT pg_last_wal_replay_lsn(), now();
  SELECT count(*) FROM tenants;
  SELECT count(*) FROM patients WHERE tenant_id = '$TENANT_ID';
"
```

Compare against expected counts from the audit log:
```sql
SELECT entity_type, count(*)
  FROM audit_log
 WHERE tenant_id = '$TENANT_ID'
   AND created_at <= '2026-04-28 14:30:00+05:30'
   AND action = 'INSERT'
 GROUP BY entity_type;
```

### 5. Cut over Patroni

```bash
# On all live PG nodes — stop them, point them at the restored data dir,
# rejoin via patronictl reinit.
ssh pg-1 "systemctl stop patroni"
ssh pg-2 "systemctl stop patroni"
ssh pg-3 "systemctl stop patroni"

# Resync data dir from the freshly-restored PITR node:
patronictl -c /etc/medbrains/patroni.yml restart $CLUSTER_ID --force

# Resume each replica
patronictl -c /etc/medbrains/patroni.yml reinit $CLUSTER_ID pg-2
patronictl -c /etc/medbrains/patroni.yml reinit $CLUSTER_ID pg-3
```

### 6. Take system back online

```bash
curl -X POST $API/api/admin/system_state \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"mode":"normal","reason":"PITR complete to 2026-04-28T14:30+05:30"}'
```

### 7. Audit the gap

PITR loses everything between the target time and the failure. The
audit_log + outbox_events tables tell us what was lost:

```sql
-- Audit events that existed in the broken DB but were rolled back by PITR
-- (these need to be replayed by hand or accepted as data loss, depending on
-- whether the rolled-back rows were buggy or legitimate)
SELECT entity_type, count(*)
  FROM audit_log
 WHERE created_at BETWEEN '2026-04-28 14:30:00+05:30' AND '2026-04-28 16:00:00+05:30'
 GROUP BY entity_type;
```

The S3 Object Lock audit archive (90-day hot, 7-year compliance) holds
the canonical version of audit events for the rolled-back window. Cross-
reference and decide whether to replay legitimate operations.

## Procedure: Daily Restore-Test (automated)

The `pgbackrest-restore-test` CronJob in
`infra/k8s/cronjobs/pgbackrest-restore-test.yaml` runs this end-to-end
every day. If you see the `PgBackRestRestoreTestFailed` alert:

1. `kubectl logs -n medbrains-platform job/pgbackrest-restore-test-XXXXX`
2. Common failures:
   - **S3 access denied** — IRSA role drift; reconcile via Terraform
   - **Bucket not found** — DNS / endpoint config
   - **Restore timeout** — WAL volume growth; bump `activeDeadlineSeconds` after investigating
   - **Smoke query returned wrong count** — actual backup corruption, escalate to platform lead

## Procedure: Cross-region recovery (Sprint D)

Out of scope for this runbook. Sprint D wires the cross-region snapshot
copy + DR bucket replication. Until then, single-region recovery only.
