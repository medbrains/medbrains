# `aws-k3s` — Enterprise-k3s tier (single-node k3s + RDS + S3)

Phase 1 scaffold for the cost-sensitive Enterprise-k3s tier. Same
Kubernetes API surface as the Enterprise EKS tier but on a single
EC2 host running k3s — order-of-magnitude cheaper.

## Shape

- **Compute** — One `aws_instance` (default t4g.medium ARM) with
  cloud-init that installs k3s via `https://get.k3s.io`. Traefik
  bundled with k3s is disabled in favour of the existing
  `infra/k8s/karpenter` / cert-manager stack we install over Helm
  in Phase 3.
- **Public IP** — `aws_eip` for stable DNS.
- **Security group** — 22 / 80 / 443 inbound, 6443 (k3s API)
  internal-only.
- **Database** — RDS db.t4g.small Multi-AZ (slightly larger than
  the Growth tier since k3s + the app share the host).
- **Object storage** — S3 with lifecycle: STANDARD → STANDARD_IA at
  `hot_to_cold_days`, → GLACIER at 4× that.
- **Autoscale** — pod-level only via HPA inside k3s. No node
  autoscale (single-node design).

## Status

`terraform validate` passes. End-to-end apply is gated on the Helm
chart for medbrains-server (Phase 3 PR) — without it, the k3s install
runs but no app pods are scheduled.

## Out of scope here

- Helm install of medbrains-server, cert-manager, Traefik IngressRoute.
- HA k3s (multi-server etcd / external datastore).
- Backup of /var/lib/rancher/k3s to S3 (today only RDS data is durable).
- ECR auth on the node.
