# Enterprise-k3s deployment plan (ARM, ap-south-1)

Deploy MedBrains as Enterprise-k3s tier — single ARM EC2 host running
k3s, RDS db.t4g.small for postgres, S3 with Glacier lifecycle for MRD.
Same Kubernetes API as full EKS, ~₹4,500/mo.

## Dependency chain (in order)

```
1. Multi-arch image    (CI fix — release.yml builds amd64+arm64, fires on master)
        ↓
2. Helm chart          (deploy/helm/medbrains-server/, repo has none today)
        ↓
3. Cluster bootstrap   (cert-manager + ingress-nginx + medbrains-server chart,
                        installed via remote-exec in aws-k3s sub-module)
        ↓
4. Terraform apply     (provisions EC2 + RDS + S3 + bootstraps cluster)
        ↓
5. DNS A record        (godaddy-dns_record points at the EIP)
        ↓
6. Cert + first pod    (cert-manager issues Let's Encrypt cert,
                        medbrains-server pod schedules, migration job runs)
```

## Decisions

| Question | Decision | Why |
|---|---|---|
| ARM or AMD? | **ARM (t4g.medium)** | ~20% cheaper than t3.medium; the Rust binary cross-compiles cleanly. Once CI builds multi-arch we get ARM for free. |
| k3s Traefik or ingress-nginx? | **ingress-nginx** | Wider ecosystem, real cert-manager integration, k3s Traefik v2 has odd CRD quirks. We disable bundled Traefik in cloud-init. |
| HTTPS termination | **cert-manager + Let's Encrypt HTTP-01** | Same approach as Starter tier's Caddy. Operator already owns the GoDaddy zone. |
| Image registry | **GHCR (existing)** | Already wired via release.yml. Skip ECR for now — saves ~₹100/mo + IAM complexity. |
| Pull secret | **None if package public; else PAT** | Default to public package. If user keeps it private, set `TF_VAR_ghcr_pull_token`. |
| Database | **RDS db.t4g.small** | Multi-AZ, ARM (~20% cheaper than x86). Migration job runs from a pre-install Helm hook. |
| Object storage | **S3 + Glacier lifecycle** | STANDARD → STANDARD_IA at 90d → GLACIER at 360d. Same lifecycle as Starter's LocalFs sweeper. |

## Blockers we resolve in this PR

| # | Blocker | Fix |
|---|---|---|
| 1 | release.yml builds **amd64 only** | Add `setup-qemu-action` + `platforms: linux/amd64,linux/arm64` to build-push-action |
| 2 | Image only built on **`v*` tags** | Add `push: branches: [master]` trigger that publishes `:latest` |
| 3 | No app manifests anywhere | New `deploy/helm/medbrains-server/` chart |
| 4 | aws-k3s sub-module installs k3s but doesn't deploy app | Add `null_resource.bootstrap` that helm-installs cert-manager + ingress-nginx + medbrains-server |
| 5 | No DB migration on pod start | Pre-install Helm hook Job runs `medbrains-server migrate` |

## Make commands (operator workflow)

```sh
# One-time per release — image builds in CI, no local docker needed
git tag v0.1.0 && git push --tags

# Or: skip CI, build locally on the mac (ARM-native, fastest)
make -C medbrains/infra/terraform/envs/standalone/alagappa build-image-local

# Apply terraform — provisions everything
TF_VAR_tier=enterprise-k3s \
  make -C medbrains/infra/terraform/envs/standalone/alagappa apply

# Watch the rollout
make -C medbrains/infra/terraform/envs/standalone/alagappa kubeconfig
kubectl --kubeconfig=./kubeconfig get pods -A -w

# Verify
curl https://hims.amh.org.in/api/health
```

## Cost breakdown (ap-south-1, monthly)

| Line item | Spec | ₹/mo |
|---|---|---|
| EC2 t4g.medium | 2 vCPU / 4 GB ARM, on-demand | ₹2,400 |
| RDS db.t4g.small Multi-AZ | 2 vCPU / 2 GB, 50 GB gp3 | ₹1,650 |
| S3 STANDARD (10 GB) | first 90d of MRD | ₹35 |
| S3 STANDARD_IA (50 GB) | 90-360d | ₹140 |
| S3 GLACIER (200 GB) | 360d+ | ₹70 |
| EIP + ALB | EIP free while attached, no ALB (ingress-nginx as NodePort + EIP) | ₹0 |
| Data transfer (50 GB out) | | ₹500 |
| **Total** | | **~₹4,800** |

## Out of scope (Phase 3)

- Karpenter / multi-node k3s.
- Cross-region snapshot copy.
- Aurora Serverless v2 (only matters at >3 hospitals).
- KMS-encrypted everything (today: storage_encrypted=true on RDS, AES256 on S3).
- Backup of `/var/lib/rancher/k3s` to S3 (only RDS data is durable today).
