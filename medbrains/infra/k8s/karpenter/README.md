# Karpenter cost-tuned NodePools

Sprint B follow-up: cost-optimal node provisioning for EKS.

## What's here

```
karpenter/
├── ec2nodeclass-default.yaml      # underlying EC2 launch params (Bottlerocket, gp3, IMDSv2)
├── nodepool-system.yaml           # CoreDNS / Karpenter / Argo CD — on-demand only
├── nodepool-app-spot.yaml         # medbrains-server stateless API — spot 70% off
└── nodepool-app-ondemand.yaml     # outbox / cashier path — on-demand fallback
```

## Cost model

| Pool | Capacity | List $/hr per vCPU | Effective $/hr per vCPU | Annual at 100 vCPU avg |
|---|---|---|---|---|
| system | on-demand m7g | 0.0408 | 0.0408 | $35,750 |
| app-spot | spot c7g/m7g/r7g | 0.0408 | **0.0122** | **$10,710** |
| app-ondemand | on-demand m7g | 0.0408 | 0.0408 | $35,750 |

**Default workload routing (per pod nodeSelector / toleration):**

```yaml
# medbrains-server (Axum API, stateless)
nodeSelector: { medbrains/pool: app-spot }     # 70% savings
tolerations:
  - key: karpenter.sh/disrupted
    operator: Exists
    effect: NoSchedule

# outbox worker (cashier-path, intolerant of eviction)
nodeSelector: { medbrains/pool: app-ondemand }
tolerations:
  - { key: medbrains/capacity, value: on-demand, effect: NoSchedule }

# system add-ons (CoreDNS, Cilium operator, ESO, OTEL)
nodeSelector: { medbrains/pool: system }
tolerations:
  - { key: medbrains/pool, value: system, effect: NoSchedule }
```

## Spot eviction safety

Spot eviction = 2-min advance notice via instance metadata. Pods on
`app-spot`:

1. **medbrains-server** — multiple replicas behind ALB; HPA respawns on
   surviving nodes. PDB minAvailable=2 prevents simultaneous loss of
   majority. **Eviction = brief 503 burst, < 30s.**
2. **OTEL collector replicas** — gateway pattern, > 1 replica, downstream
   buffers. **Eviction = silent.**
3. **Background reports** — restartable. Idempotent. **Eviction = retry.**

What MUST NOT run on spot:
- Outbox worker (FOR UPDATE SKIP LOCKED makes N>1 safe, but eviction in
  the middle of dispatching a payment.create_order is the risk we
  designed Sprint A to **avoid**, so respect it)
- Patroni / NATS StatefulSets (not autoscaled at all)

## Disruption budgets

```
spot:
  consolidateAfter: 30s         # cheap to churn — spot dollar churn
  budgets:
    - { schedule: "0 9 * * 1-5", duration: "9h", nodes: "0" }
                                 # never disrupt during 09:00–18:00 IST weekdays
on-demand:
  consolidateAfter: 5m          # steadier, less churn
  budgets:
    - { nodes: "10%" }
```

## Required Terraform wiring

`infra/terraform/modules/eks/karpenter.tf` (Phase 4 follow-up) provisions:

1. Karpenter Helm release (chart from `oci://public.ecr.aws/karpenter/karpenter`)
2. SQS queue for spot interruption events
3. EventBridge rule + IAM role for Karpenter to consume interruption events
4. IRSA role `KarpenterController-medbrains` referenced by service account
5. Tags `karpenter.sh/discovery=medbrains` on private subnets + node SGs
   (matched by EC2NodeClass selectors above)

## Spotlight: ARM64 (Graviton)

Every NodePool sets `kubernetes.io/arch: arm64`. Pricing:
- m7g (Graviton 3) = ~20% cheaper than m7i (x86) at same vCPU/RAM
- 40% better perf/$ on Rust/Postgres/Java workloads (per AWS benchmarks)

Our Dockerfile builds multi-arch (`docker buildx build --platform linux/amd64,linux/arm64`).
Switching x86 → ARM64 is **free 20% savings** at the node level on top
of spot/on-demand mix.

## Apply

Once Karpenter Helm release lands (Phase 4):

```bash
kubectl apply -f infra/k8s/karpenter/ec2nodeclass-default.yaml
kubectl apply -f infra/k8s/karpenter/nodepool-system.yaml
kubectl apply -f infra/k8s/karpenter/nodepool-app-spot.yaml
kubectl apply -f infra/k8s/karpenter/nodepool-app-ondemand.yaml
```

Or via Argo CD `infra/argocd/applicationsets/karpenter.yaml` (Phase 5).
