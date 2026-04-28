# Runbook — Sprint B Cutover (Patroni HA Production Rollout)

**Owner:** Platform / DBA / VP Engineering (sign-off)
**Source:** RFCs/sprints/SPRINT-B-patroni-ha.md §11

## Purpose

Step-by-step procedure for rolling out the 3-node Patroni HA cluster
into a production region for the **first** tier-1 hospital tenant or
on-prem deployment. Default SaaS tenants stay on Aurora Serverless v2;
this cutover is per-tenant via `tenant_db_topology`.

---

## Pre-cutover checklist

Block the cutover if any of these is unchecked.

- [ ] Sprint B branch merged into `master` and deployed to staging for ≥7 days
- [ ] `make check-all` green on the deploy SHA
- [ ] All 8 Sprint A acceptance criteria green in staging (no double-charges, crash recovery, BYPASSRLS verified, etc.)
- [ ] Packer AMI tagged `medbrains-image=postgres-16-patroni-3.3` exists in target region
- [ ] AMI passes `infra/test/patroni/` Terratest suite green (run on a sandbox AWS account first)
- [ ] `infra/k8s/cronjobs/pgbackrest-restore-test.yaml` deployed to the EKS cluster, has run successfully ≥3 times
- [ ] `runbooks/wal-recovery.md` rehearsed — restore drill report on file
- [ ] `runbooks/patroni-failover.md` reviewed by oncall
- [ ] `scripts/dr/patroni_switchover_drill.sh --dry-run` executed against staging cluster
- [ ] AWS Cost Explorer baseline captured for the target region (so post-cutover delta is measurable)
- [ ] On-call engineer paged + acknowledged for the cutover window
- [ ] Customer signoff (tier-1 hospital): explicit consent for the topology change + 30-min maintenance window

---

## Cost spec (estimate — ap-south-1, on-demand list price)

| Component | Qty | $/hr | $/mo (730h) |
|---|---|---|---|
| r7g.large PG nodes | 3 | 0.1672 | $367 |
| t4g.small etcd nodes | 3 | 0.0168 | $37 |
| NLB | 1 | 0.0225 + $0.006/LCU | ~$25 |
| EBS gp3 200GB data + 50GB root | 3 sets | $0.08/GB-month | ~$60 |
| S3 WAL archive (KMS) | varies | $0.023/GB-month | ~$5 (modest tenant) |
| Cross-AZ data transfer | varies | $0.01/GB | ~$10 |
| KMS keys | 4 | $1/key/month | $4 |
| **Total per cluster** | — | — | **~$508/mo** |

Compared to Aurora Serverless v2 at the same workload:
- Tier-1 with 8 ACU steady = $345/mo (cheaper)
- Tier-1 with 16 ACU steady = $691/mo (more expensive than Patroni)
- Patroni hosts ALL tenants on the cluster — so for >2 tier-1 tenants, Patroni wins on $/tenant

**Reserved Instance saving:** 1-year RI on r7g.large = 35% off = $239/mo. Apply RI when a tier-1 hospital signs a multi-year deal.

---

## Cutover procedure

### Phase 1 — provision (T-7 days)

```bash
# Pull the merged Sprint B branch
git fetch origin master
git checkout master
git pull

# Build / rebuild the Packer AMI in target region
cd medbrains/infra/packer/postgres-bottlerocket
packer build -var "region=ap-south-1" postgres.pkr.hcl
# capture AMI ID from output

# Verify AMI tag picked up by terraform
aws ec2 describe-images --region ap-south-1 --owners self \
  --filters "Name=tag:medbrains-image,Values=postgres-16-patroni-3.3" \
  --query 'Images[0].[ImageId,CreationDate]' --output text
```

```bash
# Run the bootstrap module (state buckets, lock tables) — ONE-TIME per region
cd medbrains/infra/terraform/modules/bootstrap
terraform init
terraform apply -var=region=ap-south-1
```

```bash
# Provision the production composition (vpc + kms + s3 + patroni-cluster)
cd medbrains/infra/terraform/envs/prod/regions/ap-south-1
terraform init
terraform plan -out=plan.tfplan
# review plan output — should show: vpc + 4 KMS keys + 4 S3 buckets +
# 3 PG nodes + 3 etcd nodes + NLB
terraform apply plan.tfplan
```

### Phase 2 — bring cluster up (T-1 day)

```bash
# Connect via SSM to verify Patroni converged
aws ssm start-session --region ap-south-1 \
  --target $(aws ec2 describe-instances --region ap-south-1 \
    --filters "Name=tag:medbrains-pg-node-id,Values=pg-1" \
    --query 'Reservations[0].Instances[0].InstanceId' --output text)

# Inside the session
sudo -u postgres patronictl -c /etc/medbrains/patroni.yml list
# Should show: pg-1 Leader, pg-2 Replica running, pg-3 Replica running
```

```bash
# Bootstrap the schema — same migrations Aurora runs
DATABASE_URL=postgres://postgres:$PASSWORD@pg-writer.medbrains.internal:5432/medbrains \
  cargo run --bin medbrains-server -- migrate
```

### Phase 3 — flip ONE tenant (T-0)

```sql
-- In the Aurora-side admin DB:
INSERT INTO tenant_db_topology (
    tenant_id, topology, patroni_writer_url, patroni_reader_url, notes, updated_by
) VALUES (
    '<TIER_1_TENANT_UUID>',
    'patroni',
    'postgres://app:$ROTATED_PASSWORD@pg-writer.medbrains.internal:5432/medbrains?sslmode=require',
    'postgres://app:$ROTATED_PASSWORD@pg-writer.medbrains.internal:5433/medbrains?sslmode=require',
    'Cutover 2026-XX-XX per RFC-INFRA-2026-002 Sprint B',
    '<DBA_USER_UUID>'
);

-- TopologyRouter cache TTL is 5 min; force eviction by calling the admin endpoint:
-- POST /api/admin/db-topology with the same body to trigger state.topology.invalidate()
```

### Phase 4 — verify (T+15min)

- [ ] `GET /api/health` from a workload pod returns 200
- [ ] `GET /api/patients?limit=1` returns rows for the cut-over tenant
- [ ] `POST /api/patients` succeeds (writes route to Patroni)
- [ ] Outbox events queued during the flip drain to `sent` status
- [ ] CloudWatch metric `pg_replication_lag_bytes` < 1 MB on both replicas
- [ ] pgBackRest archive: WAL files appearing in `s3://medbrains-prod-wal-archive-ap-south-1/cluster-<id>/` every ~60s

### Phase 5 — soak (T+1 to T+7 days)

- Run `runbooks/restore-drill-template.md` against the new cluster (PITR to T-30min, validate, abandon restore)
- Watch DLQ — should stay flat
- Watch p95 latency — should be within 10% of Aurora baseline
- Daily review of restore-test CronJob status

---

## Rollback (if soak goes bad)

Reverse cutover is per-tenant, tx-safe:

```sql
UPDATE tenant_db_topology SET topology = 'aurora' WHERE tenant_id = '<UUID>';
```

Then call the admin endpoint to invalidate the TopologyRouter cache.
Tenant immediately routes back to Aurora; outbox events that landed
on Patroni during the flip stay on Patroni (they'll dispatch from
there — independent of which DB the app reads). After 5 min cache
expiry, all replicas route to Aurora. **No data loss** because writes
that landed on Patroni are still there; reads just route elsewhere.

To fully abandon the cluster:
```bash
cd medbrains/infra/terraform/envs/prod/regions/ap-south-1
terraform destroy -target=module.patroni
# state buckets + KMS keys retained; only Patroni cluster destroyed
```

---

## Evidence pack to file post-cutover

- [ ] `terraform show` output (full resource graph)
- [ ] Packer build log + AMI ID
- [ ] First successful `runbooks/patroni-failover.md` drill report
- [ ] First `pgbackrest-restore-test` CronJob green run logs
- [ ] AWS Cost Explorer 24h after cutover vs baseline
- [ ] CloudWatch dashboard URL: PG replication lag, HAProxy /leader status, NLB target health
- [ ] Customer (tier-1 hospital) acceptance email

File under `RFCs/compliance/sprint-b-cutover-{tenant}-{date}/`.

---

## Done criteria

Sprint B is **done for this tenant** when:

1. ✓ Tenant traffic running on Patroni for ≥30 days
2. ✓ Quarterly switchover drill executed (`scripts/dr/patroni_switchover_drill.sh`)
3. ✓ Daily restore-test CronJob green for 30 consecutive days
4. ✓ No SEV1 incidents related to the new topology
5. ✓ Cost spec matches forecast within ±15%

Subsequent tier-1 tenants reuse this runbook — start at Phase 3 (the
cluster is already up).
