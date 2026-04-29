# RFC-INFRA-2026-001 — CRDT Sync, Terraform, and EKS

**Status:** Draft (architecture)
**Author:** MedBrains Infrastructure
**Date:** 2026-04-28
**Supersedes:** none
**Depends on:** RFC-HMS-2026-003 (TechStack APPROVED), RFC-HMS-2026-001 (Core)

## Executive Summary

- **CRDT engine: Loro (Rust)** — picked over Automerge and Yjs because (a) Rust-native (matches our Axum backend), (b) columnar encoding gives 10–40x smaller deltas than Automerge for our list-heavy clinical data, (c) WASM bindings work cleanly in browser and React Native, (d) it has typed containers (List/Map/MovableTree/Counter/Text) which map well to vitals/notes/care-plans, and (e) causal-order delivery is a first-class invariant — required for medication and vitals streams. Yjs lacks Rust core; Automerge's columnar codec is heavier and less ergonomic.
- **Tiered persistence model.** Not all clinical data is CRDT-safe. We split into three explicit tiers (server-authoritative / CRDT append-only / CRDT-with-commit-gate). Billing, NDPS register, final lab results, controlled-drug dispensing, and the audit chain are *never* CRDT.
- **Edge-node-per-hospital** (`medbrains-edge`, single Rust binary, embedded SQLite + Loro) is mandatory. Without it, true LAN-partition operation is fiction; with it, devices keep working when WAN is down for hours.
- **Single Terraform deploy** via Terragrunt. `make deploy ENV=prod REGION=ap-south-1` spins one region cleanly. Tenants are runtime config in Aurora, *not* Terraform — onboarding a new hospital is a row insert + namespace ConfigMap, never a `terraform apply`.
- **EKS 1.31 + Karpenter + Cilium + Argo CD** is the production substrate. Postgres = Aurora (out of cluster). YottaDB = StatefulSet (no managed option exists). Frontend = S3+CloudFront (not on EKS).

---

## Part A — Offline-first CRDT Sync Layer

### A.1 — Data classification (do this before anything else)

| Tier | Examples | Storage | Sync model |
|------|----------|---------|------------|
| **T1 — Server-authoritative** | Billing invoices, GST tax rows, NDPS controlled-drug register, finalised lab reports, blood-bank issue, DTC-approved formulary, prescriptions *after dispense*, audit chain root, user/role/permission, payment txns | RDS Aurora only | Online-required write; offline = read cache only |
| **T2 — CRDT append-only** | Vital signs, nursing notes, intake/output, care-plan task ticks, internal chat, ward-round observations, draft progress notes, queue position updates | Loro `LoroList` / `LoroMap` per encounter | Multi-writer CRDT, full offline writes |
| **T3 — CRDT with commit gate** | Provisional medication orders, draft prescriptions before sign, draft discharge summary, scheduling proposals | Loro container that *transitions* to T1 row on signature | Multi-writer drafts; commit triggers RDS row + freezes CRDT doc |

**Rationale.** T1 items have legal single-source-of-truth requirements (NDPS Act §42, DPDP §8, NABH MOM.4c). LWW or multi-writer merge can erase an audit-relevant write — unacceptable. T2 items are inherently multi-writer (two nurses charting on the same patient) and historically logged-not-edited — a perfect fit for an append-only Loro list. T3 is the dangerous middle: drafts are CRDT, but the *act of signing* must be online and atomic against RDS (bracketed by an advisory lock on `(tenant_id, encounter_id)`).

### A.2 — CRDT engine choice: Loro

| Option | Why rejected/picked |
|--------|---------------------|
| Automerge 2.x | Rust core ✓, but column-store overhead ~3-4x Loro for list-heavy workloads; binding ergonomics in RN are clunky |
| Yjs | JS-native (no Rust core), would force us to host CRDT logic in Node — incompatible with Axum boundary |
| Loro 1.x | **Picked.** Rust-native, WASM, BFT-causal, typed containers, encoded snapshot+delta format, has `MovableTree` (useful for care-plan hierarchies), Apache-2.0 |
| Custom (operation log + Lamport) | Avoid; we don't have the engineering budget to redo what Loro proved |

**Concrete deliverable:** new crate `crates/medbrains-crdt/`:
- `medbrains-crdt-core` — Loro wrapper, container schemas (vitals, notes, care_plan), schema-version tag
- `medbrains-crdt-codec` — protobuf framing for sync messages
- `medbrains-crdt-policy` — per-entity merge policies (T2/T3 transition rules, conflict guard predicates)

### A.3 — Local storage on each client

| Surface | Local store | Rationale |
|---------|-------------|-----------|
| Web (React 18) | **IndexedDB via `idb`**, holding Loro snapshots + op log per encounter; in-memory Loro doc materialised on encounter open | We don't replace Zustand/TanStack Query; Loro is the *source* and TanStack Query reads materialised views via a thin adapter |
| Mobile (RN CLI + WatermelonDB) | **Loro op log lives in SQLite (the same DB Watermelon uses), as a separate table set `crdt_docs`, `crdt_ops`** | WatermelonDB's reactive layer stays for T1 cached read models; Loro lives alongside, not in conflict |
| TV (Android TV) | Receive-only — pulls materialised JSON over WS; does not store CRDT log | TVs are read displays, no offline writes needed |
| Edge node | SQLite + Loro op log for each tenant's encounters; ring-buffer 30 days hot, archive to S3 (cloud) | Edge is the LAN authority |

**WatermelonDB co-existence rule.** WatermelonDB remains the read-side store for T1 entities (cached lab catalog, pharmacy catalog, patient demographics). It does *not* own writes for T2/T3 — those go through the Loro adapter. We add a `loro` table family in the Watermelon schema (`crdt_docs`, `crdt_ops`, `crdt_actors`, `crdt_acks`) but do not use Watermelon's sync protocol for them.

### A.4 — Sync protocol

**Transport.** WebSocket primary (`wss://sync.<region>.medbrains.health/v1/ws`), HTTP long-poll fallback for restrictive networks (`POST /v1/sync/pull`, `POST /v1/sync/push`). Both tunneled over mTLS; client cert is the device cert (issued by per-tenant CA when device pairs).

**Wire format.** Protobuf (`SyncEnvelope { tenant_id, doc_id, schema_version, since: VersionVector, ops: bytes (Loro encoded), proof: MerkleProof }`).

**Delivery semantics.**
1. Client → server: `Hello { device_id, last_known_vv, schema_versions }`
2. Server → client: `CatchUp { ops_since_vv }` (chunked, max 256 KB/frame)
3. Steady state: bidirectional `OpFrame` stream; server multiplexes ops from other devices in the same tenant+doc
4. Each frame ACK'd with the receiving party's new VV
5. Backpressure via WebSocket per-message-deflate + a credit window of 64 frames; if exceeded, server pauses and lets client drain

**Schema migration.** Each Loro container carries `schema_version: u32` in its root map. The crate registers migrators `M_n→n+1`. On open, if local version < latest, migrator runs locally before any merge. The cloud refuses ops with `schema_version > server_version` (force-upgrade signal back to client). For drug-catalog field additions, this means: bump version → write migrator that adds the field with default → ship in same release as the writer code that uses it. Dual-write window of 30 days enforced in policy crate.

### A.5 — Conflict resolution policy (per entity)

| Entity | Policy | Mechanism |
|--------|--------|-----------|
| Vital signs (BP/HR/SpO2 etc.) | Multi-writer, append-only, never edit | `LoroList` of `{ts, value, actor_id, device_id}`; UI shows all entries |
| Nursing notes | Append-only with soft-retract | `LoroList`; "retracted" is a flag op, original preserved |
| Care plan tasks | Op-based (assign / tick / un-tick) on `MovableTree` | Each op carries actor; tick latest-wins per task within causal order |
| Provisional Rx (T3) | CRDT until sign; sign = atomic RDS insert + `freeze()` op | Once frozen, no more ops accepted; further edits create a new amendment doc |
| Med admin record (MAR) | T1 — not CRDT | Each administration is a server-authoritative POST; offline → queued in edge node, replayed on reconnect with idempotency key |
| Chat | LWW per message id, append on conversation | LoroList of immutable messages |
| Vitals chart annotation | Concurrent annotations OK, attached to vital op id | Sub-map under each vital |

**Crucial:** there is no global "last-writer-wins" default. Anything not explicitly assigned a policy is rejected by the policy crate at compile time (using a Rust enum that must be exhaustive over registered docs).

### A.6 — Edge node (`medbrains-edge`)

A single Rust binary deployed on a small server (NUC / Mini-PC) inside the hospital LAN. Same crate workspace, new app:

```
medbrains/
  apps/
    edge/                       # NEW — `medbrains-edge`
      Cargo.toml
      src/
        main.rs                 # axum server
        sync_hub.rs             # WS hub (LAN clients ↔ cloud)
        outbox.rs               # WAL queue when WAN down
        wan_link.rs             # uplink to regional cloud
        merkle.rs               # tenant audit chain
        bootstrap.rs            # device pairing, cert issue
```

**Responsibilities:**
1. **LAN sync hub** — every web/mobile client in the hospital connects here first (resolved via mDNS `_medbrains-edge._tcp.local` + DNS fallback `edge.<hospital>.medbrains.lan`).
2. **Outbox** — when WAN is down, all T1 writes (orders, dispenses, signatures) are queued with idempotency keys; T2 ops are merged locally and queued as deltas.
3. **Read-cache** — serves a pinned subset of Aurora data (patient demographics, drug catalog, etc.) so OPD/pharmacy keep working without WAN.
4. **Audit anchor** — owns the tenant's Merkle chain segment for the offline window; on reconnect, server validates and stitches.
5. **Same-codebase guarantee** — `medbrains-edge` reuses `medbrains-core`, `medbrains-crdt`, `medbrains-db` (with SQLite feature flag) so domain logic is identical.

**Hardware target:** any x86_64 with 8 GB RAM, 256 GB SSD, dual-NIC. Fleet-managed via FluxCD on a single-node k3s on the same NUC (so we can ship updates by `git push`). UPS-backed.

**Why mandatory.** The "ICU LAN partition" example: if there's no edge node, every device has its own Loro doc with no merge partner; merges happen only when each device individually reaches the cloud. With an edge, the hospital is internally consistent in milliseconds, and only the cloud gap is async. This is the only model that works for triage, ward rounds, and shift handovers.

### A.7 — Audit trail integrity

Healthcare audit logs are legally append-only. Two layers:

1. **Local Merkle chain per tenant per doc.** Each audit event (`who, what, when, doc_id, op_hash, prev_hash`) appends to a per-tenant chain stored in SQLite (edge) or IndexedDB (web direct). Chain heads are signed with the device's Ed25519 key.
2. **Server-side anchor.** When edge syncs, it sends the chain segment + signed head. Server validates `prev_hash` linkage against last anchored head; if valid, appends to RDS `audit_log` (T1) and updates tenant chain head. If invalid (fork detected → signal of compromised device), the server quarantines the device, alerts SIEM, and forces re-pair.

**Why this beats "merge audit lists with CRDT".** A CRDT merge of two audit lists could in principle be made strict (pure append-only set), but a malicious or buggy client could omit events from its segment and you'd never know. The Merkle chain forces every gap to be visible — you cannot add entry N+2 without knowing entry N+1's hash.

### A.8 — Security

- **Per-device cert** issued by per-tenant intermediate CA on enrolment (HSM-backed root in AWS KMS, intermediates in CloudHSM).
- **Tenant isolation in CRDT layer.** Doc IDs are namespaced `tenant_id/doc_kind/entity_id`. The sync server enforces, on every frame, that the device's cert subject matches the doc's `tenant_id`. This is *not* trusting the app — it's at the WS handshake.
- **E2E encryption optional, mTLS mandatory.** True E2E (where the server can't read content) is incompatible with regulatory inspection — we want the cloud to be able to produce records on a court order. mTLS with KMS-backed envelope encryption at rest gives us the right balance.
- **Replay protection** via VV monotonicity per `(device, doc)` pair.

### A.9 — CRDT phasing

| Phase | Scope |
|-------|-------|
| MVP (Phase 2 of overall infra plan) | Loro crate, edge node, vitals + nursing notes only. No T3 transitions yet. |
| V2 | Care plan, MAR queueing, chat, full T3 commit-gate flow. |
| V3 | Cross-encounter docs (e.g. patient-level allergy doc), camp mode (offline weeks). |

---

## Part B — Terraform Multi-Region Single-Deploy

### B.1 — Tooling: Terragrunt over vanilla Terraform

We use **Terragrunt** to wrap Terraform. Rationale:
- Terraform workspaces conflate state and config; for region+env+stack combinations they get unwieldy.
- Terragrunt gives us DRY `inputs`, generated `backend.tf`, and `dependency` graphs — eliminates 80% of the boilerplate.
- Healthcare's strict region isolation pushes us toward "one state file per region per env per stack", which is exactly Terragrunt's sweet spot.

### B.2 — Directory layout

```
medbrains/
  infra/
    terraform/
      modules/                       # reusable TF modules (vanilla)
        vpc/
        eks/
        aurora/
        msk/                         # Kafka — for high-tier event streaming (optional)
        nats/                        # NATS JetStream alternative (preferred for dev)
        s3-buckets/
        kms/
        iam-irsa/
        route53-zone/
        acm-cert/
        elasticache-redis/
        observability/               # CW logs + X-Ray
        bootstrap/                   # ECR, OIDC, SSO
      live/
        _envcommon/                  # shared inputs per env
          prod.hcl
          staging.hcl
          dev.hcl
        global/                      # one-time, region-less
          route53/
            terragrunt.hcl
          iam-org/
            terragrunt.hcl
          ecr/
            terragrunt.hcl
        regions/
          ap-south-1/                # Mumbai (primary, India)
            prod/
              vpc/terragrunt.hcl
              eks/terragrunt.hcl
              aurora/terragrunt.hcl
              redis/terragrunt.hcl
              nats/terragrunt.hcl
              observability/terragrunt.hcl
              app/terragrunt.hcl     # helm releases via TF (or Argo seed)
            staging/...
            dev/...
          ap-southeast-1/            # Singapore (V2)
            ...
          me-south-1/                # Bahrain (V3 — MENA)
            ...
    helm/                            # charts referenced by Argo CD
    argocd/                          # Argo CD ApplicationSets
    kyverno/                         # cluster policies
```

### B.3 — Single command UX

```
make deploy ENV=prod REGION=ap-south-1               # one region, one env
make deploy-all ENV=prod                             # all regions, parallel
make plan ENV=prod REGION=ap-south-1                 # tg run-all plan
make destroy ENV=dev REGION=ap-south-1               # safe — gated on ENV != prod
```

Backed by:
```
infra/terraform/Makefile
  deploy:    cd live/regions/$(REGION)/$(ENV) && terragrunt run-all apply --terragrunt-non-interactive
  plan:      cd live/regions/$(REGION)/$(ENV) && terragrunt run-all plan
```

### B.4 — Per-region stack contents

| Component | Module | Notes |
|-----------|--------|-------|
| VPC (3 AZs, 3 public + 3 private + 3 db subnets) | `vpc` | /16 per region; non-overlapping CIDRs across regions |
| EKS 1.31 cluster | `eks` | Bottlerocket, IRSA enabled, public+private endpoints, KMS-encrypted secrets |
| Karpenter NodePools | `eks` add-on | system, on-demand, spot |
| Aurora PostgreSQL 16 | `aurora` | Multi-AZ, 3 replicas, KMS encryption, IAM auth, PITR 35 days |
| ElastiCache Redis 7 | `elasticache-redis` | cluster mode, in-transit + at-rest enc |
| NATS JetStream (on EKS via Helm) | k8s-side | event bus, stream replication 3, durable |
| S3 buckets | `s3-buckets` | `medbrains-<env>-<region>-{static,uploads,backups,audit-archive}` with object lock on audit-archive |
| ALB (via AWS LB Controller) | k8s-side | ingress per service mesh ingress |
| Route53 records | `route53-zone` | hosted zone is global; A records per region |
| ACM certs | `acm-cert` | per-region + us-east-1 wildcard for CloudFront |
| KMS keys | `kms` | per-purpose: db, secrets, audit, backups |
| IRSA OIDC + IAM roles | `iam-irsa` | one role per service account |
| CloudFront | global | static assets only; origin = S3 |
| CloudWatch + X-Ray | `observability` | infra-level only; app metrics go to in-cluster Prom |

### B.5 — State management

**Decision: per-region S3 + DynamoDB lock, key prefixed by env+stack.**

```
s3://medbrains-tfstate-<region>/<env>/<stack>/terraform.tfstate
DynamoDB: medbrains-tflock-<region>
```

- Region isolation forced by the bucket living in the region (DPDP-aligned for India).
- No cross-region implicit dependencies — explicit via `terraform_remote_state` only where needed (e.g., region reads global Route53 zone id).
- `live/global/` uses `us-east-1` bucket explicitly (CloudFront, IAM).

### B.6 — Secrets

**Decision: AWS Secrets Manager + External Secrets Operator (ESO) on EKS.** No HashiCorp Vault. No Sealed Secrets.

Why: ESO+SM is one less thing to operate, integrates with IRSA (no static creds in cluster), supports rotation, and KMS-encrypts at rest with our keys. Vault is power but adds an HA cluster, a snapshot policy, and an outage class we don't need.

Path: Secrets in SM under `medbrains/<env>/<service>/<key>`. ESO `ClusterSecretStore` per region. Refresh interval 1 hour. Rotation lambdas for DB creds.

### B.7 — Network topology

- **No VPC peering, no Transit Gateway across regions.** Each region is fully isolated. Cross-region only at the application layer (HTTPS via Route53 latency routing) and only for non-PII flows.
- **PrivateLink for Aurora:** workloads access Aurora via VPC endpoint (instead of public DNS), eliminates the IGW path.
- **Global auth plane:** authoritative auth tables (`users`, `roles`, `permissions`) live in the **primary region** (ap-south-1) Aurora. Other regions read via cross-region Aurora replica (read-only, low latency to local app), and writes are routed back to primary. JWTs are signed with a global Ed25519 key (already chosen in tech stack) so any region can verify any token.
- **Why not per-region auth?** A doctor working at a multi-region hospital group should not see different identities per region. Single source of truth simplifies revocation and audit.

### B.8 — Per-tenant isolation: runtime, not infra

**Hard rule: no Terraform changes per tenant.** Onboarding a new hospital must be:
1. INSERT into `tenants` table
2. Apply per-tenant Kyverno PolicyException via Argo CD (declarative, ApplicationSet-driven)
3. Issue per-tenant edge-node CA cert
4. Create per-tenant CloudWatch log group via the operator (we run a small Rust controller `medbrains-tenant-operator`)

Tenants share the namespace `medbrains-app` in EKS. Isolation is enforced by:
- PostgreSQL RLS (already in place, per existing CLAUDE.md)
- Tenant claim in JWT validated at every request
- NetworkPolicy at L7 by Cilium: app pods can only reach Aurora via the configured proxy with `tenant_id` header
- Per-tenant rate limits via Cilium L7 + envoy filters

Namespace-per-tenant was rejected: 1000+ tenants × N services = unmanageable Argo apps and IAM blast radius without payoff.

### B.9 — Phasing

| Phase | Deliverable |
|-------|-------------|
| Phase 1 (MVP, 8–10 wks) | `infra/terraform/modules/{vpc,eks,aurora,kms,iam-irsa,s3-buckets,acm-cert,route53-zone,observability}` + `live/global/` + `live/regions/ap-south-1/{prod,staging}` |
| Phase 2 | NATS, Redis, edge-node CI artefacts, second region (Singapore) |
| Phase 3 | MENA region, DR runbooks, chaos drills |

---

## Part C — EKS / Kubernetes Design

### C.1 — Cluster

- **EKS 1.31** (or latest LTS at deploy time)
- **AMI: Bottlerocket** — minimal attack surface, atomic updates, no SSH by default
- **Autoscaler: Karpenter** (not Cluster Autoscaler) — faster provisioning, better consolidation, native spot mixing
- **Node groups via Karpenter NodePools:**
  - `system` — on-demand, AZ-spread, taint=`system=true`, hosts CoreDNS / metrics-server / Cilium / ESO / Argo CD
  - `app-on-demand` — on-demand m6i/m7i, hosts Rust API + stateful infra
  - `app-spot` — spot for stateless background workers (report generation, email batches, OCR)
  - `gpu` — V2 — for OCR/medical-imaging workloads when we add radiology AI

### C.2 — Add-ons

| Add-on | Purpose |
|--------|---------|
| AWS Load Balancer Controller | NLB/ALB ingress |
| External-DNS | Route53 record sync from Ingress annotations |
| Cert-Manager | per-service cert issuing (mTLS internal) |
| Argo CD (+ Argo Rollouts) | GitOps; canary + blue-green deploys |
| Argo ApplicationSet | per-region/per-env app fan-out from one manifest |
| Prometheus + Grafana + Loki + Tempo | metrics/logs/traces |
| OpenTelemetry Collector (DaemonSet + Deployment) | shipping signals to Loki/Tempo/Prom |
| Kyverno (preferred over OPA Gatekeeper) | policy as YAML, easier auth |
| Falco | runtime security; alerts to SIEM |
| Velero (S3 backup) | backup of cluster state + PVs |
| Cilium | CNI + NetworkPolicy + L7 + Hubble + service mesh |
| External Secrets Operator | secrets from AWS SM |
| metrics-server | HPA |
| KEDA | event-driven autoscale (NATS lag, queue depth) |

### C.3 — Workload placement

| Workload | Where | Notes |
|----------|-------|-------|
| `medbrains-server` (Axum) | EKS Deployment, app-on-demand, 3 replicas min, HPA on CPU 60% + custom metric `req_p95_ms`, PDB minAvailable=2 | mTLS via Cilium mesh; IRSA for S3/SecretsManager |
| `medbrains-tenant-operator` | EKS Deployment, system, 1 replica (leader-elect for HA later) | Reads tenants table, materialises K8s objects |
| Web frontend | **NOT on EKS** — S3 + CloudFront with OAC | Static SPA; no point burning EKS for it |
| Mobile / TV | client-side; talk to API via the global LB | n/a for cluster |
| YottaDB | EKS StatefulSet, 3 replicas (active + 2 replicating), EBS gp3 200 GiB initial, PodAntiAffinity by AZ | Velero hourly snapshot + EBS daily snapshot replicated to S3 |
| Aurora | **NOT on EKS** — managed RDS | |
| Redis | **NOT on EKS** — ElastiCache | |
| NATS JetStream | EKS StatefulSet, 3 replicas, EBS gp3, anti-affinity | Embedded in cluster — gives us tighter control than MSK and is sufficient for our event volume |
| Kafka (MSK) | Optional V2 if event volume crosses ~50k msg/s | otherwise NATS |

**Why YottaDB on EKS and not bare-metal/EC2?** Operational consistency — same secrets, same observability, same backup tooling. The downside (StatefulSet operational risk) is mitigated by Velero + EBS snapshots + a tested restore runbook.

### C.4 — Network

- **CNI: AWS VPC CNI + Cilium chaining** — pod IPs from VPC (works with PrivateLink, no SNAT), policy + observability from Cilium.
- **Service mesh: Cilium Service Mesh** — picked over Istio (too heavy, sidecar-per-pod overhead) and Linkerd (great but adds another control plane). Cilium gives us L7 policy + mTLS via SPIFFE + Hubble flow logs in one stack.
- **NetworkPolicy:** default-deny per namespace; allow-list per service. L7 path-aware policies (e.g., `medbrains-server` can only call `aurora-proxy` on `:5432` AND `nats` on `:4222`).
- **Egress control:** all egress through a NAT GW; deny-by-default to internet, allow-list specific FQDNs (drug catalog mirror, ABDM endpoints) via Cilium FQDN policy.

### C.5 — Security

- **Pod Security Admission: `restricted` profile** enforced cluster-wide; only `system` namespace gets `baseline`.
- **Image signing: Cosign** — every image signed in CI; admission via Kyverno's `verifyImages` rule. No unsigned image runs.
- **IRSA everywhere** — zero static AWS creds in pods; one IAM role per ServiceAccount, scoped to least-privilege resources.
- **mTLS internal** via Cilium SPIFFE identities; no plaintext on the wire.
- **KMS at rest** for: EBS volumes (CMK per env), Aurora (CMK), S3 (SSE-KMS), Secrets Manager (CMK), EKS secrets envelope encryption.
- **Audit logging:** EKS audit logs to CloudWatch → forwarded to Loki + (later) SIEM.
- **HIPAA/DPDP encryption-in-transit:** TLS 1.3 minimum; older TLS rejected at ALB.
- **Tenant isolation in cluster:**
  - All app pods in one namespace, but a Cilium L7 policy validates `x-tenant-id` header continuity (header set by ingress after JWT validation, sealed via mTLS-protected envoy filter)
  - Per-tenant rate limits via Envoy ratelimit service
  - PostgreSQL RLS (existing) is the second wall

### C.6 — Observability

- **Metrics:** Prometheus (in-cluster, prod = remote-write to Amazon Managed Prometheus for long-term)
- **Logs:** Loki with S3 backend + Boltdb-shipper, retention 90 days hot / 1 year archived
- **Traces:** Tempo with S3 backend, retention 30 days (tail-based sampling 5% baseline + always-keep on errors)
- **Dashboards:** Grafana provisioned via ConfigMap (GitOps) — RED/USE per service, business KPIs (admissions/hr, lab TAT)
- **Alerting:** Alertmanager → PagerDuty (sev1/2) + Slack (sev3)
- **OTEL:** Rust app emits via `tracing-opentelemetry`; collector sidecar pattern rejected in favour of cluster collector + DaemonSet for host signals

### C.7 — CI/CD

- **GitHub Actions** for build + test + ECR push
- **Argo CD** pulls and reconciles — every cluster change is a Git commit
- **Image promotion** via Argo ApplicationSet referencing `image.tag` from a per-env Git file; the CI pipeline opens a PR to bump the tag, which is auto-merged in dev, manually approved in staging/prod
- **Argo Rollouts canary** for `medbrains-server`: 10% → analysis (latency, error rate) → 50% → 100%
- **Per-region rollout:** `prod` ApplicationSet fans out one Application per region; we can pause one region while others continue

### C.8 — DR / backup

| Asset | Mechanism | RPO | RTO |
|-------|-----------|-----|-----|
| Aurora | PITR 35d + cross-region snapshot every 6h | 6h | 30 min |
| YottaDB | Velero hourly + EBS snapshot daily, replicated to S3 cross-region | 1h | 1h |
| S3 buckets | Versioning + Cross-Region Replication for `audit-archive` and `uploads` | <5 min | minutes |
| Kubernetes objects | Velero hourly to S3 | 1h | 30 min |
| Edge node | Daily encrypted snapshot to regional S3 via Restic | 1d | 4h (replace hardware) |

DR drill cadence: full game day per region per quarter.

### C.9 — Phasing

| Phase | Deliverable |
|-------|-------------|
| Phase 1 (MVP, 8 wks) | EKS+Karpenter+Cilium, Aurora, Argo CD, ESO, OTEL stack, Cosign+Kyverno baseline policies, prod single-region |
| Phase 2 (6 wks) | Argo Rollouts canary, Velero, Falco, KEDA, NATS, second region |
| Phase 3 | Cross-region DR drill automation, AMP/AMG migration, GPU node pool |

---

## Open Questions (need user decision)

1. **Edge-node hardware ownership** — does MedBrains supply NUCs to hospitals, or do hospitals BYO? Affects fleet management cost and SLA.
2. **Auth plane regionality** — confirm single global auth in ap-south-1 is acceptable for MENA latency (≈170 ms RT to Bahrain). If not, federated auth design needed.
3. **MSK vs NATS** — locking in NATS JetStream until proven insufficient. If a near-term integration partner mandates Kafka semantics (e.g., a payer integration), we'd flip.
4. **SIEM target** — CloudWatch + manual correlation (cheap), Wazuh (open), Datadog (paid). Falco events need a destination.
5. **Edge node image distribution** — Flux on k3s vs simple `apt`-managed Rust binary with a custom updater. The former is heavier but consistent with cloud GitOps story.
6. **Loro vendor risk** — Loro is young; what is our acceptable risk tolerance? Mitigation: pin to a fork in our `vendored/` and own upgrades.

## Risk Register (top 5)

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|------------|--------|------------|
| 1 | YottaDB StatefulSet data loss on AZ failure or pod eviction storm | M | Critical | 3-replica replication + EBS gp3 + hourly Velero + daily cross-region snapshot + documented restore runbook tested quarterly |
| 2 | DPDP non-compliance (Indian patient data leaving India) | M | Catastrophic (license loss) | Region-pinned tenants; auth plane writes only travel inside ap-south-1; CRDT sync server is region-pinned; egress NetworkPolicy denies external destinations except allowlist |
| 3 | CRDT schema migration breaks live encounters (a vitals doc opened on old code can't be read after upgrade) | M | High | Versioned containers + bidirectional migrators + 30-day dual-write window enforced in policy crate; staged rollout per region |
| 4 | Audit log loss during merge or partition | L | Catastrophic (legal) | Hash-chained Merkle log per tenant; server rejects any chain with broken linkage; RDS append-only audit table with object-lock S3 archive |
| 5 | Edge-node fleet drift (firmware, certs, app version) leading to silent sync failures | H | High | Flux on edge with single source-of-truth Git repo; daily heartbeat to cloud; auto-quarantine on drift; remote-rotate certs |

---

## Critical Files for Implementation

- `medbrains/Cargo.toml` (workspace — add `crates/medbrains-crdt`, `apps/edge`)
- `medbrains/infra/terraform/live/regions/ap-south-1/prod/eks/terragrunt.hcl` (cluster definition; primary region MVP)
- `medbrains/infra/terraform/modules/eks/main.tf` (reusable EKS module — Karpenter, Cilium, IRSA, addons)
- `medbrains/infra/argocd/applicationset.yaml` (per-region/per-env app fan-out, the GitOps backbone)
- `medbrains/apps/edge/src/main.rs` (edge node binary — sync hub + outbox + Merkle chain)
