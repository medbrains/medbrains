# Runbook — Hybrid Cutover (Per-Tenant)

**Owner:** Platform Engineering + DBA + VP Engineering (sign-off)
**Source:** RFCs / `delegated-discovering-milner.md` plan §Run Order

## Purpose

Step-by-step procedure for cutting over a tier-1 hospital tenant from
the SaaS Aurora topology onto a hybrid topology where PHI lives on
the hospital's on-prem Patroni cluster while analytics + admin run in
the cloud, glued by the Headscale tailnet.

This runbook applies once per hospital. SaaS tenants on Aurora stay on
Aurora — this is not a one-shot rollout.

---

## Pre-cutover checklist

Block the cutover if any of these is unchecked.

- [ ] Hospital signed master service agreement + BAA
- [ ] Hospital provided Proxmox credentials (or bare-metal hosts) and
      networking (VLAN, DNS, internet egress route)
- [ ] Operator imported Proxmox API token into AWS Secrets Manager
      under `medbrains/prod/<tenant_id>/proxmox`
- [ ] `make hybrid-tf-validate` passes locally on the operator's laptop
- [ ] `infra/terraform/envs/cloud/prod/regions/<region>` baseline applied
      (Headscale, bridge-ingress ALB, KMS, audit S3 bucket)
- [ ] Headscale admin API key rotated within last 90 days (see
      `runbooks/headscale-ops.md`)
- [ ] `make hybrid-init TENANT=<tenant_id>` produced a tenant directory
- [ ] `terraform.tfvars` filled in per `terraform.tfvars.example`
- [ ] Customer signoff: explicit consent for the topology change + 30-min
      maintenance window
- [ ] On-call paged + acknowledged for the cutover window

---

## Cost spec (~ap-south-1, on-demand)

| Component | Where | $/mo |
|---|---|---|
| 3× t4g.small Patroni | On-prem (hospital) | $0 — hospital hardware |
| 3× t4g.nano etcd | On-prem (hospital) | $0 — hospital hardware |
| 1× small VM bridge agent | On-prem (hospital) | $0 — hospital hardware |
| K3s nodes | On-prem (hospital) | $0 — hospital hardware |
| Headscale t4g.small | Cloud (per-region) | ~$6 amortized across all hospitals |
| Aurora analytics ACU minutes | Cloud | varies w/ usage; min_acu=0 idles to $0 |
| Tailnet (Headscale OSS) | Cloud (1× t4g.small) | $0 per-device; $6/mo total |
| Outbox event egress | Cloud → on-prem via tailnet | ~free (NAT-T over hospital internet) |

Net cloud delta per hybrid tenant: ~$0–$30/mo (mostly Aurora analytics
queries + outbox event forwarding). All real cost is hospital-side.

---

## Cutover procedure

### Phase 0 — pre-flight (T-7 days)

```bash
git fetch origin master
git checkout master
git pull
make hybrid-tf-validate    # all 7 modules pass
```

Confirm the medbrains-bridge binary release artifact is at
`s3://medbrains-prod-artifacts/bridge/v0.1.0/medbrains-bridge-arm64`.
Hash matches the latest tag of `feature/bridge-headscale`.

### Phase 1 — initialize tenant directory (T-3 days)

```bash
make hybrid-init TENANT=<tenant_id>
cd infra/terraform/envs/tenants/<tenant_id>
cp terraform.tfvars.example terraform.tfvars
$EDITOR terraform.tfvars        # fill in all PLACEHOLDER values
```

Fields to fill:
- `tenant_id`, `hospital_name`, `aws_region`
- `cloud_kms_key_arn`, `cloud_audit_bucket_arn` — from cloud baseline outputs
- `headscale_url`, `headscale_admin_api_key` — from cloud Headscale module
- `onprem_substrate` = `proxmox` or `baremetal`
- Proxmox creds (or bare-metal host IPs)
- `ssh_public_key`, `ssh_private_key_path`
- `cluster_topology` = `ha` (default) or `single` for clinics
- `tunnel_provider` = `headscale` (default) — change to `wss` if hospital
  firewall blocks UDP entirely, or `none` for fully air-gapped

### Phase 2 — provision (T-1 day)

```bash
make hybrid-up TENANT=<tenant_id>
```

This runs `terraform init` + `terraform apply` against the tenant
directory. Order of operations Terraform schedules:

1. Cloud-side: tenant KMS, S3 prefix, IAM role for bridge agent,
   Headscale single-use pre-auth key written to `/tmp`
2. On-prem etcd VMs come up
3. On-prem Patroni PG VMs come up, run `medbrains-bootstrap-debian.sh`,
   format /dev/sdb XFS, render patroni.yml, start patroni service
4. K3s server VM, then K3s agent VMs (HA mode)
5. Bridge VM — runs `tailscale up --login-server=<headscale-url>
   --auth-key=<preauth-from-step-1>`, joins the tailnet, starts the
   medbrains-bridge daemon

Apply takes ~20–40 minutes wall-clock depending on Proxmox host I/O.

### Phase 3 — bring app up (T+0)

GitOps Flux deploys medbrains-server to the new K3s cluster from the
tenant overlay path `gitops/tenants/<tenant_id>/`. First reconcile
takes ~5 min after Flux finds the cluster.

Verify pods running:
```bash
kubectl --kubeconfig=kubeconfig-<tenant_id>.yaml \
    -n medbrains get pods
```

### Phase 4 — smoke (T+15 min)

```bash
make hybrid-smoke TENANT=<tenant_id>
```

Six checks — all must pass:
1. Tailnet handshake cloud → on-prem
2. Cloud event bus reachable from on-prem K3s pod
3. PHI redaction proven (Aadhaar dropped before cloud egress)
4. Audit chain verifies on both sides
5. Patroni leader election survives a deliberate restart
6. Bridge-down → cloud marks tenant degraded → bridge-up → healthy

If any fails, **do not flip the topology row**. Investigate, fix,
re-run smoke.

### Phase 5 — flip the topology (T+1 hour, after smoke passes)

The on-prem cluster is now running but the cloud server still routes
all reads/writes for this tenant to Aurora. Flip:

```bash
psql "${ADMIN_DB_URL}" <<EOF
UPDATE tenant_db_topology
SET topology   = 'patroni_with_cloud_analytics',
    deploy_mode = 'hybrid',
    tunnel_provider = 'headscale',
    onprem_cluster_id = 'medbrains-<tenant_id>-onprem-pg',
    notes      = 'Cutover ${date} per RFC-INFRA-2026-002 hybrid'
WHERE tenant_id = (SELECT id FROM tenants WHERE slug = '<tenant_id>');
EOF
```

The cloud server's `TopologyRouter` cache TTL is 5 min. Force eviction:
```bash
curl -X POST "https://api.medbrains.cloud/api/admin/db-topology/invalidate" \
    -H "x-admin-token: $ADMIN_TOKEN" \
    -d '{"tenant_id":"<tenant_id>"}'
```

Tenant traffic now routes to on-prem Patroni for writes; analytics
reads continue to flow to Aurora via outbox events from on-prem.

### Phase 6 — soak (T+1 to T+7 days)

- Daily review of `pgbackrest-restore-test` CronJob status
- Daily review of `audit_chain_verifications` table — no failures
- Watch DLQ — should stay flat (any drained item indicates a redaction
  rule gap; investigate)
- Watch outbox event throughput — expected matches OLTP volume on the
  on-prem cluster
- Watch p95 latency from a cloud admin endpoint hitting on-prem via
  tailnet — should be within 100ms of pure cloud baseline

### Phase 7 — done

Sprint cutover is **done for this tenant** when:

1. ✓ Tenant traffic running on-prem Patroni for ≥7 days
2. ✓ One restore drill completed (`scripts/hybrid-smoke.sh` includes
   the PITR step in the next iteration)
3. ✓ Daily restore-test CronJob green for 7 consecutive days
4. ✓ No SEV1 incidents related to the new topology

---

## Rollback

Reverse the topology flip — tx-safe, zero data loss:

```sql
UPDATE tenant_db_topology
SET topology    = 'aurora',
    deploy_mode = 'saas',
    notes       = 'Rollback ${date}'
WHERE tenant_id = (SELECT id FROM tenants WHERE slug = '<tenant_id>');
```

Then invalidate cache:
```bash
curl -X POST "https://api.medbrains.cloud/api/admin/db-topology/invalidate" ...
```

Tenant immediately routes back to Aurora. Outbox events queued on
on-prem during the rollback window keep draining to cloud event bus
(they're independent of read/write routing). **No data loss** because
writes that landed on Patroni are still there; reads just point
elsewhere.

If you want to fully tear down the on-prem stack:
```bash
make hybrid-down TENANT=<tenant_id>
```

This destroys all VMs + state. KMS keys + S3 prefixes are retained
(per `lifecycle { prevent_destroy = true }` on the cloud-side
resources in `cloud.tf`).

---

## Evidence pack to file post-cutover

- [ ] `terraform show` output (full resource graph)
- [ ] `make hybrid-smoke` log
- [ ] First successful restore-test CronJob run logs
- [ ] AWS Cost Explorer 7-day delta vs baseline
- [ ] Customer acceptance email
- [ ] Audit chain verification proofs (cloud + on-prem)
- [ ] Headscale ACL JSON snapshot at cutover time

File under `RFCs/compliance/hybrid-cutover-<tenant_id>-<YYYY-MM-DD>/`.
