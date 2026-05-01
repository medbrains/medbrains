# `aws-eks` — Enterprise tier (EKS + RDS + S3)

Phase 1 scaffold. Final form (Phase 3) wraps the existing
`modules/eks` (Karpenter + IRSA) and `modules/aurora` (Aurora
Serverless v2 + RDS Proxy) — those modules expect a VPC + KMS
abstraction layer that doesn't exist for the per-hospital deploy
story yet, so this scaffold uses a minimal EKS + managed-node-group
+ RDS shape so terraform validate passes and the buyer-tier router
can be exercised end-to-end.

## Shape (today)

- **Compute** — EKS cluster (default Kubernetes 1.31), one
  managed node group on SPOT t3.medium instances, scales 1-4.
- **Database** — RDS db.t4g.small Multi-AZ. Will be swapped for
  `modules/aurora` once the wrapper accepts simpler inputs.
- **Object storage** — S3 with lifecycle: STANDARD → STANDARD_IA →
  GLACIER.

## Shape (Phase 3 target)

- Wrap `modules/eks` for Karpenter-driven node autoscaling.
- Wrap `modules/aurora` for Aurora Serverless v2 + RDS Proxy.
- Wrap `modules/s3` for KMS-encrypted buckets with Object Lock.
- `helm_release "medbrains-server"` installing the chart at
  `medbrains/deploy/helm/medbrains-server/`.
- IRSA role for the chart's service account so it can read S3 and
  authenticate to RDS via IAM tokens.

## Status

`terraform validate` passes. End-to-end apply gated on the Helm chart.

## Out of scope here

- The `modules/eks` / `modules/aurora` wrap (Phase 3).
- Helm chart install.
- Cert-manager + AWS Load Balancer Controller for ingress.
- IRSA role for the app's service account.
- VPC dedicated to the hospital. Today reuses the default VPC.
- KMS-encrypted everything.
