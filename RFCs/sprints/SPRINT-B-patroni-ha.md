# Sprint B — Patroni HA Postgres + WAL archive + failover drill

## Context

Sprint A landed the durable outbox so external integrations no longer
freeze the request thread. Sprint B closes the next failure mode in
the offline-first RFC: **the database itself going down**.

Today's failure modes Sprint B fixes:
- **Postgres leader crash** — single Aurora writer; AZ outage = ~3 min RTO via Aurora's built-in failover, but on-prem deployments have no failover at all
- **Planned switchover** — version upgrade, OS patch, instance resize all currently require ~30 min of write-downtime
- **WAL data loss** — Aurora has 35-day PITR via S3 backups, but on-prem has no offsite WAL archive
- **Replica drift** — read replicas exist but no monitoring of replication lag → stale read alerts surface only as user complaints

Sprint B delivers a Patroni-managed 3-node Postgres cluster with
streaming replication, etcd quorum, automatic leader election, S3
WAL archive, and a quarterly failover drill script. The same module
runs in two deploy modes:

| Mode | What |
|---|---|
| `saas` | Patroni cluster *alongside* Aurora, used for **on-prem-class workloads** (high-frequency low-latency clinical reads). Aurora stays as primary OLTP. |
| `onprem` | Patroni is the **only** Postgres. No Aurora. |

The cutover decision (Aurora vs Patroni for the OLTP path) is a per-tenant
config (`tenants.db_topology`). Default stays Aurora; tier-1 hospitals
that need on-prem opt into Patroni.

---

## 1. Architecture

```
                ┌─────────────────────────────────────┐
                │  EKS workload pods (medbrains-server)│
                │  connect to: HAProxy VIP            │
                └─────────────────┬───────────────────┘
                                  │
                       ┌──────────▼──────────┐
                       │  HAProxy / pgBouncer │  (writes only — reader endpoint
                       │  reads Patroni REST  │   exposed separately)
                       │  /leader endpoint   │
                       └──────────┬──────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
   ┌────▼────┐               ┌────▼────┐               ┌────▼────┐
   │ pg-1    │               │ pg-2    │               │ pg-3    │
   │ leader  │ ◄── stream ── │ replica │ ◄── stream ── │ replica │
   │ + Patroni│              │ + Patroni│              │ + Patroni│
   └─────┬────┘               └─────┬────┘             └─────┬────┘
         │                          │                        │
         └──────────┬───────────────┴────────────────────────┘
                    │
              ┌─────▼─────┐
              │   etcd    │  (quorum DCS — 3 nodes)
              │  3 nodes  │
              └───────────┘
                    │
                    ▼
              S3 WAL archive (KMS-encrypted, 90d retention)
              + nightly basebackup (90d retention)
              + cross-region replication for DR
```

**Key choices:**

- **Patroni** (Zalando's HA orchestrator) over `repmgr` / `pg_auto_failover`. Patroni is the de-facto standard for production PG HA in 2026; integrates natively with etcd; has REST API for HAProxy health checks; supports pgBackRest WAL archive out of the box.
- **etcd** (3 nodes) for distributed consensus. **Not** Consul — etcd is what Patroni's docs recommend; Kubernetes-native; we already have it implicitly via EKS control plane.
- **HAProxy** in front. Polls each Patroni node's `/leader` REST endpoint every 1s; only the current leader passes the health check; failover routes traffic in <2s.
- **pgBouncer** between HAProxy and pg-* for connection pooling. Same pgBouncer can sit in front of Aurora too; cluster-aware via PGBOUNCER_POOL_MODE=transaction.
- **pgBackRest** for WAL archive + basebackup. Archives every 60s to S3 (via the audit KMS key). Continuous restore-test job validates archive integrity.
- **Watchdog** on each PG node — kernel `softdog` module triggers reboot if Patroni fails to renew its lease (split-brain prevention).
- **Synchronous replication** to at least 1 replica (`synchronous_standby_names = 'ANY 1 (pg-2, pg-3)'`). Trades a few ms of write latency for zero-data-loss RPO.

---

## 2. New Terraform module — `infra/terraform/modules/patroni-cluster/`

### Inputs
- `region`, `environment`
- `vpc_id`, `private_subnet_ids` (3 — one per AZ)
- `kms_key_arn` (db CMK from existing kms module)
- `wal_archive_bucket` (from s3 module)
- `instance_type` (default `r7g.large`)
- `pg_version` (default 16)
- `patroni_version` (default 3.3)
- `etcd_version` (default 3.5)

### Resources
- 3 × `aws_instance` PG nodes (Bottlerocket-PostgreSQL custom AMI baked via Packer in `infra/packer/postgres-bottlerocket/`)
- 3 × `aws_instance` etcd nodes (smaller — `t4g.small`)
- `aws_lb` (NLB) for HAProxy with target group of 3 PG nodes
- `aws_security_group` × 3 — one for PG, one for etcd, one for HAProxy
- `aws_iam_role` for nodes — allows `s3:Put/Get` on WAL archive bucket only
- `aws_cloudwatch_log_group` per node for postgres + patroni logs
- `aws_route53_record` for `pg.medbrains.internal` → NLB

### Outputs
- `writer_endpoint` (NLB DNS for the Patroni leader)
- `reader_endpoint` (NLB DNS that load-balances across replicas)
- `etcd_endpoints` (for ops debugging only)
- `wal_archive_bucket_arn`

---

## 3. Custom AMI — `infra/packer/postgres-bottlerocket/`

Single AMI used for all three PG nodes:

- Base: Bottlerocket (or Amazon Linux 2023 if Bottlerocket lacks PG support — fallback)
- PostgreSQL 16 + pgBackRest installed
- Patroni 3.3 + Python 3.12 venv at `/opt/patroni`
- Watchdog (`/dev/watchdog`) wired to `softdog`
- Configuration baked via cloud-init from instance tags:
  - `MedBrainsPgRole` = `leader-candidate`
  - `MedBrainsPgClusterId` = environment-region tag
  - `MedBrainsEtcdEndpoints` = comma-separated etcd peer list
  - `MedBrainsWalBucket` = S3 bucket name

Packer template + `scripts/packer/build-pg-ami.sh` invoked from CI on
patroni/postgres version bumps. AMI ID exported as a `data` source to
the Terraform module.

---

## 4. Migration plan — application side

### 4.1 Connection topology config

New table:

```sql
CREATE TABLE tenant_db_topology (
    tenant_id        UUID PRIMARY KEY REFERENCES tenants(id),
    topology         TEXT NOT NULL DEFAULT 'aurora'
                     CHECK (topology IN ('aurora', 'patroni', 'aurora_with_patroni_reads')),
    patroni_writer  TEXT,
    patroni_reader  TEXT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      UUID REFERENCES users(id)
);
```

App resolves at request time: `claims.tenant_id → tenant_db_topology.topology`.

### 4.2 New crate `medbrains-db-topology/`

Wraps the topology lookup + connection routing:
- `Box<dyn TopologyResolver>` — Aurora-only / Patroni-only / hybrid
- Per-tenant connection pool cache
- HAProxy /leader endpoint health check on cold start

`AppState` adds `pub topology: Arc<TopologyRouter>`. Existing
`state.db: PgPool` becomes the **default** Aurora pool; routing happens
on a per-tenant basis only when a tenant opts into Patroni.

### 4.3 Changes to `medbrains-db::pool`

Tiny — `set_request_context_full` and friends already work with any
Postgres-compatible connection. The only change: `create_pool_with_config`
accepts a `target` enum (`Aurora | Patroni { writer: String, reader: String }`)
to wire the right URL.

---

## 5. WAL archive + restore

### Continuous archive
- pgBackRest configured to push WAL every 60s to `s3://medbrains-{env}-wal-archive-{region}/cluster-{id}/`
- Encryption at rest with the audit KMS key (separate from app data key)
- Lifecycle: 90d hot → Glacier after 90d → expire after 7y (HIPAA/DPDP)
- Cross-region replication for DR (Phase D)

### Nightly basebackup
- 02:00 IST cron via Patroni's `archive_command`
- Validated by a separate "restore-test" job: restores yesterday's basebackup + replays WAL into a throwaway PG instance, runs `SELECT count(*) FROM tenants` smoke check, emits Prometheus metric `pg_restore_test_seconds`. Failure pages oncall.

### PITR
- `pgBackRest restore --type=time --target='2026-04-28 14:30:00'` from any of the 3 PG nodes — single command
- Documented in `runbooks/wal-recovery.md`

---

## 6. Failover scenarios + scripts

### 6.1 Automatic — leader crashes

Patroni handles end-to-end. HAProxy `/leader` health check fails on
the dead node within 1s; new leader election completes in 5-10s
(Patroni's `loop_wait=10s` default). HAProxy routes to new leader.

App perceives this as ~10s of write 5xx, then recovers. Outbox
queues writes that landed during the gap.

**Acceptance:** simulated `aws ec2 stop-instances` on the leader → cluster recovers; total app-visible 5xx burst < 15s.

### 6.2 Planned — version upgrade or OS patch

`runbooks/switchover-drill.sh`:
1. SSH to current leader: `patronictl pause`
2. Upgrade replica-1, replica-2 first (rolling)
3. `patronictl switchover --candidate=replica-1` — promotes replica-1 to leader
4. Upgrade former leader (now replica)
5. `patronictl resume`

Scripted dry-run + drill cadence quarterly.

### 6.3 Whole-AZ loss

Two PG nodes survive (or one, depending on AZ topology). If quorum
holds (etcd needs 2/3), Patroni elects a new leader from the
surviving healthy nodes. If quorum is lost, cluster goes read-only;
ops manually intervenes via `patronictl reinit`.

**Acceptance:** chaos test (`aws-chaos kill-az ap-south-1a`) → cluster
remains writable from `ap-south-1b/c` within 30s.

### 6.4 Cross-region disaster (Sprint D, not Sprint B)

`pgBackRest restore` from S3 cross-region replicated archive. Out of
scope for Sprint B; runbook `runbooks/cross-region-restore.md` is a
Phase D deliverable.

---

## 7. Tests

| # | Test | Setup | Assertion |
|---|---|---|---|
| 1 | `patroni_leader_election` | terraform apply on dev → kill leader EC2 | New leader within 15s; HAProxy routes correctly |
| 2 | `wal_archive_continuous` | Generate 1k INSERTs/s for 5min | pgBackRest archive sees no gaps; restore-test passes |
| 3 | `synchronous_replication_zero_loss` | INSERT then immediately SIGKILL leader | Replica-promoted node has the row |
| 4 | `quorum_loss_read_only` | Kill 2 of 3 PG nodes | Cluster goes read-only, doesn't lie about state |
| 5 | `switchover_drill` | Run `runbooks/switchover-drill.sh` | Old leader is replica; new leader serves writes |
| 6 | `pgbackrest_pitr` | INSERT → snapshot timestamp → INSERT bad rows → restore to timestamp | Bad rows gone, good rows present |
| 7 | `topology_router_per_tenant` | Set tenant A to `aurora`, tenant B to `patroni` | Both pools active; cross-pool query attempt errors |
| 8 | `restore_test_cron_alert` | Corrupt yesterday's basebackup in S3 | restore-test job fails; Prom metric flips; PagerDuty pages |

Tests live in `infra/test/patroni/` (Terratest) + `crates/medbrains-server/tests/integration/topology_router/` (Rust).

---

## 8. Acceptance criteria

1. `make deploy ENV=dev REGION=ap-south-1` provisions a 3-node Patroni cluster + 3-node etcd + HAProxy NLB
2. `psql` against the writer endpoint succeeds; INSERT replicates to both replicas in <100ms
3. `aws ec2 stop-instances` on the current leader → app-visible 5xx burst < 15s; full recovery < 30s
4. Quarterly `runbooks/switchover-drill.sh` runs end-to-end with zero data loss
5. pgBackRest restore-test cron passes 7 days running; failure pages oncall
6. `tenant.db_topology = 'patroni'` flips a single tenant's connections without affecting others
7. cargo clippy / pnpm typecheck / terraform validate all green

---

## 9. Effort estimate

| Task | Hours |
|---|---|
| Packer postgres AMI | 16 |
| Terraform `patroni-cluster` module | 24 |
| HAProxy + pgBouncer config + cloud-init | 8 |
| pgBackRest config + S3 WAL archive | 12 |
| medbrains-db-topology crate | 16 |
| tenant_db_topology migration + admin endpoint | 8 |
| Restore-test cron + drift detector | 8 |
| Failover drill scripts + runbooks | 12 |
| Tests (8 cases above) | 24 |
| Docs + RFC follow-ups | 4 |
| **Total** | **~132h ≈ 3.5 dev-weeks** |

---

## 10. Out of scope (this sprint)

- Cross-region failover (Sprint D)
- Active-active / multi-master (CRDT layer is RFC-INFRA-2026-001)
- Citus sharding (way past current scale)
- ZFS snapshot-based backups (pgBackRest is enough)
- pgvector / pgaudit / pgsodium extensions (separate add-on PRs)
- On-prem appliance build (Sprint E)

---

## 11. Branch + PR plan

- Branch: `feature/sprint-b-patroni-ha`
- Single PR — scaffolding + module + tests must land together to be testable
- PR title: *Sprint B: Patroni HA + WAL archive + failover drill*
- Reviewer focus: (a) etcd quorum semantics under partition, (b) pgBackRest config correctness, (c) HAProxy /leader health-check timeout tuning, (d) tenant_db_topology routing safety
