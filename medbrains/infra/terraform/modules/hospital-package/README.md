# `modules/hospital-package` — buyer-packaged tiers

Public-facing module the onboarding flow drives. Hospital picks one
of four tiers; terraform wires the matching compute + DB + storage +
scaling shape underneath.

## Tier matrix

| Tier | Hospital size | Compute | Database | Object storage | Autoscale | Indicative ₹/mo | Status |
|---|---|---|---|---|---|---|---|
| **Starter** | 1 hospital, ≤ 100 beds | EC2 t3.small | postgres-17 docker on the same box | LocalFs + ColdLocal on EBS | None — vertical via instance-type | **₹1,580** | ✅ active |
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

  tier        = "starter"        # starter | growth | enterprise | enterprise-k3s
  hospital_id = "alagappa"
  domain      = "hims.amh.org.in"
  zone_name   = "amh.org.in"
  admin_email = "ops@amh.org.in"

  aws_ssh_key_name = "medbrains-deploy"
}
```

## What every tier includes (regardless of tier)

- The full HMS feature set — same Rust binary, same SPA, same 67
  modules. Tier governs **infrastructure** shape, not feature flags.
- Caddy with auto Let's Encrypt at the edge.
- Daily storage-tier sweeper.
- Hash-chained audit log + RLS-backed multi-tenancy.
- ABDM / NABH / DPDP compliance hooks pre-wired.

## How dispatch works

`main.tf` has four conditional `module {}` blocks
(`count = var.tier == "<tier>" ? 1 : 0`), each forwarding into the
matching `standalone-vm` sub-module via its `provider_kind` knob:

| Tier | Sub-module | `provider_kind` |
|---|---|---|
| `starter` | `standalone-vm/aws-ec2/` | `aws-ec2` |
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
