# MedBrains Infrastructure-as-Code

Terraform layout for RFC-INFRA-2026-002 Phase 4. Vanilla Terraform
(no Terragrunt). One `make deploy ENV=<env> REGION=<region>` per stack.

## Layout

```
infra/terraform/
├── modules/                  # Reusable Terraform modules
│   ├── vpc/                  # 3 AZs, NAT/AZ, VPC endpoints
│   ├── eks/                  # EKS 1.31 + Karpenter + Cilium prereqs
│   ├── aurora/               # Aurora Serverless v2 + RDS Proxy
│   ├── kms/                  # 4 CMKs: app, db, audit, secrets
│   ├── iam-irsa/             # OIDC + IAM roles per ServiceAccount
│   ├── s3/                   # 4 buckets per region
│   ├── route53/              # Zone + records
│   ├── acm/                  # Certs (per-region + us-east-1 wildcard)
│   ├── observability-iam/    # CloudWatch + AMP + AMG roles
│   └── bootstrap/            # State buckets + DynamoDB locks (run once)
├── envs/
│   ├── dev/regions/ap-south-1/
│   ├── staging/regions/ap-south-1/
│   └── prod/regions/{ap-south-1,ap-southeast-1,us-east-1}/
└── shared/
    ├── tags.tf               # Standard tags
    └── providers.tf          # AWS provider config
```

## Single-command deploy

```
make deploy ENV=prod REGION=ap-south-1     # one region, one env
make deploy-plan ENV=prod REGION=ap-south-1  # plan only
```

## State backend

Per-region S3 + DynamoDB lock:

```
s3://medbrains-tf-state-<region>/envs/<env>/<region>/terraform.tfstate
DynamoDB: medbrains-tf-locks (one per region)
```

Bootstrap module creates the state buckets + lock tables once per region;
runs with local state, then state is migrated to S3.

## Per-tenant onboarding stays runtime — NOT Terraform

`POST /api/admin/tenants` does:
1. INSERT into `tenants` table
2. Apply per-tenant seed migrations
3. Provision Route53 record via SDK (IRSA: `medbrains-tenant-provisioner`)
4. Trigger Argo CD ApplicationSet

No `terraform apply` per tenant — boundary is sharp: Terraform = platform,
runtime = tenants.

## Status

Phase 4 deliverable status (RFC-INFRA-2026-002):

| Module | Status |
|---|---|
| bootstrap | skeleton |
| kms | skeleton |
| vpc | skeleton |
| s3 | skeleton |
| iam-irsa | skeleton |
| eks | skeleton |
| aurora | skeleton |
| route53 / acm | skeleton |
| observability-iam | skeleton |
| envs/dev | skeleton |
| envs/staging | skeleton |
| envs/prod/regions/ap-south-1 | skeleton |
| envs/prod/regions/ap-southeast-1 | not started (Phase 6) |
| envs/prod/regions/us-east-1 | not started (Phase 6) |

Skeleton files in this commit declare the structure + variable contracts.
Phase 4.2+ fills in resource definitions and tests against a dev cluster.
