# Runbook — Headscale Operations

**Owner:** Platform Engineering
**Source:** `infra/terraform/modules/headscale/main.tf`

## What Headscale is for

Self-hosted, fully open-source control plane for the WireGuard mesh
between the cloud EKS cluster and every on-prem hospital cluster. We
chose Headscale + the open-source `tailscale` BSD-3 client over
Tailscale SaaS because:

- No per-device fees
- No third-party SaaS in the path of PHI control traffic
- Same WireGuard data plane (peer-to-peer, encrypted, fast)
- Same client UX

Headscale runs as a **single Go binary** on a `t4g.small` EC2 in the
cloud control plane region. State is sqlite on encrypted EBS,
replicated to S3 every 60s by Litestream, restored on boot if local
state is missing.

## Critical invariant

**Existing peer-to-peer WireGuard tunnels do NOT depend on Headscale
being up.** Once two nodes have exchanged keys + ACL info, they keep
their tunnel alive without the control plane. Headscale is only
needed for **new peer registration** and **ACL changes**.

Practical implication: a Headscale outage does not page on-call
unless it correlates with a tenant onboarding window.

---

## Daily ops

### Health check

The Headscale ALB has `/health` endpoint. Cloud observability
already alerts on 5xx for >2 min. No daily manual action needed.

```bash
curl -sf https://headscale.medbrains.cloud/health
```

### List nodes

```bash
ssh medbrains@<headscale-ec2-ip>
sudo headscale nodes list
```

Expected output: 1 row per cloud admin pod + 1 row per hospital bridge
VM. New unaccounted nodes = investigate (could be ACL misconfiguration
or a stolen pre-auth key).

### List ACLs

```bash
sudo headscale policy get
```

ACL JSON file lives at `/etc/headscale/acl.hujson`. Source of truth is
in the GitOps repo at `gitops/headscale/acl.hujson` — never edit on
the host.

---

## Issuing a per-tenant pre-auth key

`make hybrid-up TENANT=<id>` does this automatically via Terraform
local-exec. Manual command for when Terraform isn't the right tool
(e.g. one-off troubleshoot):

```bash
curl -sfH "Authorization: Bearer $(aws secretsmanager get-secret-value \
    --secret-id medbrains/prod/global/headscale-admin-api-key \
    --query SecretString --output text)" \
    https://headscale.medbrains.cloud/api/v1/preauthkey \
    -d '{
      "user": "tenant-<tenant_id>",
      "reusable": false,
      "ephemeral": false,
      "expiration": "24h",
      "aclTags": ["tag:hospital-<tenant_id>"]
    }'
```

The returned key is single-use + 24h TTL. Once the bridge VM uses it,
it becomes invalid; new VMs need a fresh key.

---

## Adding a tenant tag to ACL

ACL changes go through the GitOps repo. Steps:

1. PR against `gitops/headscale/acl.hujson` adding the tag:
   ```hujson
   {
     "tagOwners": {
       "tag:cloud-bridge": ["medbrains-admin@medbrains.cloud"],
       "tag:hospital-A": ["medbrains-admin@medbrains.cloud"],
       "tag:hospital-B": ["medbrains-admin@medbrains.cloud"],   // NEW
     },
     "acls": [...]
   }
   ```
2. 2-reviewer approval (per branch protection)
3. Merge → Flux reconciles → headscale picks up the new ACL within
   10 min via `headscale policy reload` triggered by a Flux Kustomize
   post-build hook

Never edit ACL on the host directly — Flux will overwrite on next
reconcile.

---

## Rotating the admin API key

Cadence: **every 90 days**.

```bash
# 1. Generate new key in headscale
ssh medbrains@<headscale-ec2-ip>
NEW_KEY=$(sudo headscale apikey create --expiration 90d)

# 2. Store in AWS Secrets Manager
aws secretsmanager put-secret-value \
    --secret-id medbrains/prod/global/headscale-admin-api-key \
    --secret-string "$NEW_KEY"

# 3. Force ESO refresh on cloud K8s pods that use it (Flux will pick
#    up the new value within the External Secrets refresh window)
kubectl annotate -n external-secrets externalsecret headscale-admin-key \
    force-sync=$(date +%s) --overwrite

# 4. Wait 10 min, verify cloud admin endpoints can still issue
#    pre-auth keys, then revoke the old key:
sudo headscale apikey expire <old-key-prefix>
```

---

## Disaster recovery

### Headscale instance dies (EC2 hardware failure)

1. Confirm tunnels still up (existing peer-to-peer WireGuard mesh
   doesn't need control plane):
   ```bash
   kubectl -n medbrains exec deploy/medbrains-server -- \
       tailscale ping <hospital-A-bridge-fqdn>
   ```
2. Run `terraform apply` against the cloud baseline — Terraform
   recreates the EC2 instance. Cloud-init pulls latest sqlite snapshot
   from S3 via Litestream restore. Recovery time: ~5 minutes.
3. Verify nodes still listed: `sudo headscale nodes list`. All should
   appear (Litestream-restored state includes them).
4. New tenant pre-auth keys can be issued again.

### Litestream replication lag

If Litestream hasn't replicated for >5 min, the next restore loses
data. Alarm via CloudWatch on the
`Litestream/replication_lag_seconds` metric. Common cause: S3
permissions issue. Fix the IAM role; Litestream resumes
automatically.

### ACL JSON corruption

If a bad PR lands on `gitops/headscale/acl.hujson`:

1. Headscale rejects the new ACL on reload (parse error)
2. Old ACL stays in effect (no service interruption)
3. Operator reverts the PR; Flux reconciles within 10 min

### Stolen pre-auth key

If a pre-auth key leaks (e.g., committed to a tenant's tfvars by
accident, or exfiltrated from `/tmp` on operator's laptop):

1. Single-use property: if the attacker uses it before the legitimate
   bridge VM, the legitimate provision fails — operator notices
   immediately.
2. 24h expiry: any unused key auto-invalidates within a day.
3. Even if used, the registered node only has `tag:hospital-<id>` —
   ACL only allows reaching that tenant's cloud-side resources, not
   any other tenant's data. Blast radius is limited to one tenant.
4. Revoke + remove the registered node:
   ```bash
   sudo headscale nodes list | grep tag:hospital-<id>
   sudo headscale nodes delete --identifier <node-id>
   ```
5. Issue new pre-auth key, redeploy bridge VM (tailscale logout +
   tailscale up --auth-key=<new>).

---

## When to switch from Headscale Free → Headscale HA

The single-instance setup is fine for **<200 hospital tenants**.
Beyond that, a Headscale outage during peak onboarding hours starts
hurting. Migration path to HA:

1. Provision a second Headscale EC2 with shared sqlite via Litestream
   read replicas (or migrate to PostgreSQL backend — Headscale
   supports both)
2. NLB in front, target both instances
3. Active-passive — only one Headscale process holds the sqlite write
   lock; the other is hot-standby

Until then, the runbook stance is: accept the 5-minute recovery time
for control plane outages because data plane is unaffected.
