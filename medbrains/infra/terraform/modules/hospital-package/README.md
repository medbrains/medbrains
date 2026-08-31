# `modules/hospital-package` — buyer-packaged tiers

Public-facing module the onboarding flow drives. Hospital picks one
of six cost-aware packages; terraform wires the matching compute + DB
+ storage + scaling shape underneath.

## Tier matrix

| Tier | Hospital size | Compute | Database | Object storage | Autoscale | Indicative ₹/mo | Status |
|---|---|---|---|---|---|---|---|
| **Test** | Engineering smoke / short-lived demos | EC2 t4g.small | postgres docker on same box | LocalFs + backups | None | lowest, temporary only | active |
| **Demo** | Board demo / training / sandbox | EC2 t4g.medium | postgres docker on same box | LocalFs + backups | None | low, single-host | active |
| **Starter** | 1 hospital, ≤ 100 beds | EC2 t4g.medium | postgres-17 docker on the same box | LocalFs + ColdLocal on EBS | None — vertical via instance-type | low single-host baseline | ✅ active |
| **Attach** | Hospital already owns a host | *none created* — deploys onto an existing VM | postgres-17 already on the host, or docker | LocalFs + ColdLocal | None | **no infra cost** | ✅ active |
| **Growth** | 1-3 hospitals, 100-300 beds, peak/off-peak load | ECS Fargate (0.5-2 vCPU) behind ALB | RDS db.t4g.micro | S3 (hot) + S3 IA (cold) | Fargate target-tracking + EventBridge scale-to-zero overnight | **₹3,500** | scaffold |
| **Enterprise-k3s** | 3+ hospitals on a budget | EC2 t4g.medium running k3s | RDS db.t4g.small | S3 + Glacier | k3s HPA on a fixed-size node | **₹4,500** | scaffold |
| **Enterprise** | Multi-region, ABDM compliant | EKS + Karpenter (spot) | Aurora Postgres-compatible | S3 + Glacier | HPA + Cluster Autoscaler | **₹9,000+ shared** | scaffold |

The non-Starter tiers ship terraform that **`terraform validate`s clean
today** but is intentionally minimal. Each gets fleshed out when a
real hospital signs up at that tier.

## Usage

```hcl
module "hospital" {
  source = "../../modules/hospital-package"

  tier        = "starter"        # test | demo | starter | growth | enterprise | enterprise-k3s
  hospital_id = "alagappa"
  domain      = "hims.amh.org.in"
  zone_name   = "amh.org.in"
  admin_email = "ops@amh.org.in"

  aws_ssh_key_name = "medbrains-deploy"
}
```

## The Attach tier

For a hospital that already has a server — on-prem, another cloud, or an
existing EC2 box carrying other applications. Terraform creates the KMS keys,
the uploads bucket and the IAM role, then deploys onto the host over SSH. It
does **not** create an instance, a security group or a DNS record, because the
buyer already has all three.

Two switches exist because the standalone install assumes it owns the box:

- `attach_reuse_postgres` (default true) — use the Postgres already running
  rather than starting one in Docker on the same port.
- `attach_reuse_tls` (default true) — leave 80/443 to whatever already
  terminates TLS, and have it proxy `domain` to `medbrains-server`.

That second one is not a preference. `deploy/standalone/install.sh` runs
`systemctl stop caddy`, `systemctl disable caddy` and `certbot --standalone`.
On a dedicated host that is correct. On a host already serving other names it
takes every one of them down and then cannot renew, because certbot needs the
port the other proxy is holding. Anything driving the Attach tier must honour
these flags before running the deploy kit.

## What every tier includes (regardless of tier)

- The full HMS feature set — same Rust binary, same SPA, same 67
  modules. Tier governs **infrastructure** shape, not feature flags.
- MedBrains Pingora edge proxy with Certbot-issued TLS.
- Daily storage-tier sweeper.
- Hash-chained audit log + RLS-backed multi-tenancy.
- ABDM / NABH / DPDP compliance hooks pre-wired.

## Cost guardrails

- `test`, `demo`, and `starter` route to the single-host Starter shape.
  They do not create RDS, ALB, EKS, Aurora, or Patroni HA volumes.
- Expensive data disks must be opt-in at the module that creates them.
  The Patroni HA module defaults to deleting data disks on termination,
  and the test harness pins baseline gp3 storage.
- KMS keys and resources are tagged with `Tier` and `CostGuard` so Cost
  Explorer can split real Starter spend from demo/test/enterprise spend.

## How dispatch works

`main.tf` has four conditional `module {}` blocks
(`count = var.tier == "<tier>" ? 1 : 0`), each forwarding into the
matching `standalone-vm` sub-module via its `provider_kind` knob:

| Tier | Sub-module | `provider_kind` |
|---|---|---|
| `test`, `demo`, `starter` | `standalone-vm/aws-ec2/` | `aws-ec2` |
| `growth` | `standalone-vm/aws-fargate/` | `aws-fargate` |
| `enterprise-k3s` | `standalone-vm/aws-k3s/` | `aws-k3s` |
| `enterprise` | `standalone-vm/aws-eks/` | `aws-eks` |

Outputs (`public_endpoint`, `health_url`, `db_endpoint`,
`object_store_bucket`) are coalesced via `try(...)` so callers see
one stable interface regardless of tier.

## Migration between tiers (future work)

| From → To | What happens |
|---|---|
| Starter → Growth | One-time `pg_dump` → RDS, DNS A record stays, terraform destroys EC2 + recreates as Fargate. ~30min downtime. |
| Growth → Enterprise | Aurora migration via DMS, ALB stays, EKS replaces Fargate. ~2hr maintenance window. |
| Enterprise → Starter | Strange direction; only sensible during a tear-down. |

DMS migration scripts ship in a follow-up PR.

## Phase 1 scope (this PR)

- Router + four sub-modules, all `terraform validate` clean.
- `aws-ec2` (Starter) is the only tier with a tested end-to-end apply.
- Other three are scaffolds — they declare the right shape of resources
  but real apply tests + Helm chart + ECR push ship in later phases.
