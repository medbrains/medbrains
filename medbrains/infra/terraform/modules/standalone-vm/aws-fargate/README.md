# `aws-fargate` — Growth tier (ECS Fargate + RDS + S3 + ALB)

Phase 1 scaffold for the Growth tier of `modules/hospital-package`.

## Shape

- **Compute** — ECS Fargate task pulling `var.image_uri` (defaults to
  the GHCR image published by `release.yml`). 0.5 vCPU / 1 GB by
  default; bumped via `fargate_task_cpu` / `fargate_task_memory`.
- **Load balancer** — ALB on 80/443 in front of the service. HTTPS
  listener + ACM cert land in Phase 2.
- **Database** — RDS db.t4g.micro PostgreSQL 17 Multi-AZ.
- **Object storage** — S3 bucket with lifecycle that transitions
  objects to STANDARD_IA after `var.hot_to_cold_days` (default 90).
- **Autoscaling** — application autoscaling target tracking on CPU 60%.
  Optional scale-to-zero overnight via `var.scale_to_zero_at_night`
  (saves ~70% on Fargate spend for clinics that close at night).

## Status

`terraform validate` passes. End-to-end apply not yet exercised — the
Helm chart / Deployment YAML for the medbrains-server image is still
TODO (Phase 3 PR), and HTTPS termination at the ALB needs an ACM cert
which the env doesn't currently auto-provision (Phase 2 PR).

## Out of scope here

- ECR push from CI (today only GHCR; private ECR pull from Fargate
  needs the task execution role to have ECR perms).
- ACM cert + HTTPS listener.
- VPC dedicated to the hospital. Today reuses the default VPC.
- VPC endpoints for RDS / S3 / ECR.
- DB password stored in Secrets Manager (currently plain in state).
