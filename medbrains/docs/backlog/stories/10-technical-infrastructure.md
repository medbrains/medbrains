# Technical Infrastructure — stories

_Auto-generated from `MedBrains_Features.xlsx` — every feature as a story with module-tailored acceptance criteria. 320 stories (✅ = Done). Source of truth is the xlsx; regenerate via `python3 scripts/generate_stories.py`._

## Aggregation

### Centralized log aggregation (Loki / ELK / CloudWatch)
> As a **platform engineer**, I want **centralized log aggregation (loki / elk / cloudwatch)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can centralized log aggregation (Loki / ELK / CloudWatch) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Alerting

### Alert rules (PagerDuty / Slack / email) — error spike, high latency, disk full, DB connection exhaustion
> As a **platform engineer**, I want **alert rules (pagerduty / slack / email) — error spike, high latency, disk full, db connection exhaustion**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can alert rules (PagerDuty / Slack / email) — error spike, high latency, disk full, DB connection exhaustion from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Uptime monitoring with synthetic health checks (external probes every 30s)
> As a **platform engineer**, I want **uptime monitoring with synthetic health checks (external probes every 30s)**.

`Done · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [x] The platform engineer can uptime monitoring with synthetic health checks (external probes every 30s) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### SLA monitoring dashboard (99.9% uptime target with monthly reporting)
> As a **platform engineer**, I want **sla monitoring dashboard (99.9% uptime target with monthly reporting)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can sLA monitoring dashboard (99.9% uptime target with monthly reporting) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Audit Trail Integrity

### Per-tenant Merkle hash-chained audit log
> As a **platform engineer**, I want **per-tenant merkle hash-chained audit log**.

`P1 · Pending · Platforms: Web, Mobile · Source: RFC-INFRA-001 §A.7 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can per-tenant Merkle hash-chained audit log from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Ed25519-signed chain heads
> As a **platform engineer**, I want **ed25519-signed chain heads**.

`P1 · Pending · Platforms: Web, Mobile · Source: RFC-INFRA-001 §A.7 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can ed25519-signed chain heads from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Server-side anchor validation + RDS append
> As a **platform engineer**, I want **server-side anchor validation + rds append**.

`P1 · Pending · Platforms: Web · Source: RFC-INFRA-001 §A.7 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can server-side anchor validation + RDS append from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Fork detection + device quarantine + SIEM alert
> As a **platform engineer**, I want **fork detection + device quarantine + siem alert**.

`P2 · Pending · Platforms: Web · Source: RFC-INFRA-001 §A.7 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can fork detection + device quarantine + SIEM alert from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## CDN

### CDN for static assets (JS/CSS bundles, images, fonts — CloudFront / BunnyCDN)
> As a **platform engineer**, I want **cdn for static assets (js/css bundles, images, fonts — cloudfront / bunnycdn)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can cDN for static assets (JS/CSS bundles, images, fonts — CloudFront / BunnyCDN) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## CI/CD Pipeline

### GitHub Actions build + test + ECR push
> As a **platform engineer**, I want **github actions build + test + ecr push**.

`P1 · Pending · Source: RFC-INFRA-001 §C.7 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can gitHub Actions build + test + ECR push from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Argo CD pull-based deployment
> As a **platform engineer**, I want **argo cd pull-based deployment**.

`P1 · Pending · Source: RFC-INFRA-001 §C.7 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can argo CD pull-based deployment from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Image promotion via auto-PR (dev) + manual approval (prod)
> As a **platform engineer**, I want **image promotion via auto-pr (dev) + manual approval (prod)**.

`P2 · Pending · Source: RFC-INFRA-001 §C.7 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can image promotion via auto-PR (dev) + manual approval (prod) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Canary rollout (10% → analyse → 50% → 100%)
> As a **platform engineer**, I want **canary rollout (10% → analyse → 50% → 100%)**.

`P2 · Pending · Source: RFC-INFRA-001 §C.7 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can canary rollout (10% → analyse → 50% → 100%) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Per-region staged rollout (pause one, continue others)
> As a **platform engineer**, I want **per-region staged rollout (pause one, continue others)**.

`P2 · Pending · Source: RFC-INFRA-001 §C.7 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can per-region staged rollout (pause one, continue others) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## CRDT Engine (Loro)

### Loro CRDT engine — Rust core + WASM bindings
> As a **platform engineer**, I want **loro crdt engine — rust core + wasm bindings**.

`P1 · Pending · Platforms: Web, Mobile · Source: RFC-INFRA-001 §A.2 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can loro CRDT engine — Rust core + WASM bindings from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Tiered data model (T1 server-auth / T2 CRDT / T3 commit-gate)
> As a **platform engineer**, I want **tiered data model (t1 server-auth / t2 crdt / t3 commit-gate)**.

`P1 · Pending · Platforms: Web, Mobile · Source: RFC-INFRA-001 §A.1 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can tiered data model (T1 server-auth / T2 CRDT / T3 commit-gate) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### medbrains-crdt-core crate (Loro wrapper, container schemas)
> As a **platform engineer**, I want **medbrains-crdt-core crate (loro wrapper, container schemas)**.

`P1 · Pending · Platforms: Web, Mobile · Source: RFC-INFRA-001 §A.2 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can medbrains-crdt-core crate (Loro wrapper, container schemas) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### medbrains-crdt-codec crate (protobuf framing)
> As a **platform engineer**, I want **medbrains-crdt-codec crate (protobuf framing)**.

`P1 · Pending · Platforms: Web, Mobile · Source: RFC-INFRA-001 §A.2 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can medbrains-crdt-codec crate (protobuf framing) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### medbrains-crdt-policy crate (per-entity merge policies)
> As a **platform engineer**, I want **medbrains-crdt-policy crate (per-entity merge policies)**.

`P1 · Pending · Platforms: Web, Mobile · Source: RFC-INFRA-001 §A.2 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can medbrains-crdt-policy crate (per-entity merge policies) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Schema versioning + bidirectional migrators (M_n→n+1)
> As a **platform engineer**, I want **schema versioning + bidirectional migrators (m_n→n+1)**.

`P1 · Pending · Platforms: Web, Mobile · Source: RFC-INFRA-001 §A.4 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can schema versioning + bidirectional migrators (M_n→n+1) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Dual-write window enforcement (30 days)
> As a **platform engineer**, I want **dual-write window enforcement (30 days)**.

`P2 · Pending · Platforms: Web, Mobile · Source: RFC-INFRA-001 §A.4 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can dual-write window enforcement (30 days) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Cluster Add-ons

### AWS Load Balancer Controller
> As a **platform engineer**, I want **aws load balancer controller**.

`P1 · Pending · Source: RFC-INFRA-001 §C.2 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can aWS Load Balancer Controller from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### External-DNS (Route53 sync from Ingress)
> As a **platform engineer**, I want **external-dns (route53 sync from ingress)**.

`P1 · Pending · Source: RFC-INFRA-001 §C.2 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can external-DNS (Route53 sync from Ingress) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Cert-Manager for internal mTLS certs
> As a **platform engineer**, I want **cert-manager for internal mtls certs**.

`P1 · Pending · Source: RFC-INFRA-001 §C.2 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can cert-Manager for internal mTLS certs from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Argo CD (GitOps reconciliation)
> As a **platform engineer**, I want **argo cd (gitops reconciliation)**.

`P1 · Pending · Source: RFC-INFRA-001 §C.2 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can argo CD (GitOps reconciliation) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Argo ApplicationSet (per-region/per-env fan-out)
> As a **platform engineer**, I want **argo applicationset (per-region/per-env fan-out)**.

`P1 · Pending · Source: RFC-INFRA-001 §C.2 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can argo ApplicationSet (per-region/per-env fan-out) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Argo Rollouts (canary + blue-green)
> As a **platform engineer**, I want **argo rollouts (canary + blue-green)**.

`P2 · Pending · Source: RFC-INFRA-001 §C.2 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can argo Rollouts (canary + blue-green) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Kyverno (policy as YAML)
> As a **platform engineer**, I want **kyverno (policy as yaml)**.

`P1 · Pending · Source: RFC-INFRA-001 §C.2 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can kyverno (policy as YAML) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Falco (runtime security)
> As a **platform engineer**, I want **falco (runtime security)**.

`P2 · Pending · Source: RFC-INFRA-001 §C.2 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can falco (runtime security) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Velero (S3 backup of cluster state + PVs)
> As a **platform engineer**, I want **velero (s3 backup of cluster state + pvs)**.

`P1 · Pending · Source: RFC-INFRA-001 §C.2 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can velero (S3 backup of cluster state + PVs) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### KEDA (event-driven autoscaling on NATS lag)
> As a **platform engineer**, I want **keda (event-driven autoscaling on nats lag)**.

`P2 · Pending · Source: RFC-INFRA-001 §C.2 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can kEDA (event-driven autoscaling on NATS lag) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### metrics-server (HPA backend)
> As a **platform engineer**, I want **metrics-server (hpa backend)**.

`P1 · Pending · Source: RFC-INFRA-001 §C.2 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can metrics-server (HPA backend) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Conflict Resolution Policies

### Vital signs — append-only multi-writer LoroList
> As a **platform engineer**, I want **vital signs — append-only multi-writer lorolist**.

`P1 · Pending · Platforms: Web, Mobile · Source: RFC-INFRA-001 §A.5 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can vital signs — append-only multi-writer LoroList from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Nursing notes — append-only with soft-retract
> As a **platform engineer**, I want **nursing notes — append-only with soft-retract**.

`P1 · Pending · Platforms: Web, Mobile · Source: RFC-INFRA-001 §A.5 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can nursing notes — append-only with soft-retract from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Care plan tasks — op-based MovableTree
> As a **platform engineer**, I want **care plan tasks — op-based movabletree**.

`P2 · Pending · Platforms: Web, Mobile · Source: RFC-INFRA-001 §A.5 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can care plan tasks — op-based MovableTree from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Provisional Rx (T3) — CRDT until sign, then freeze
> As a **platform engineer**, I want **provisional rx (t3) — crdt until sign, then freeze**.

`P2 · Pending · Platforms: Web, Mobile · Source: RFC-INFRA-001 §A.5 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can provisional Rx (T3) — CRDT until sign, then freeze from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### MAR (Medication Admin Record) — T1 outbox replay
> As a **platform engineer**, I want **mar (medication admin record) — t1 outbox replay**.

`P1 · Pending · Platforms: Web, Mobile · Source: RFC-INFRA-001 §A.5 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can mAR (Medication Admin Record) — T1 outbox replay from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Chat — LWW per message id
> As a **platform engineer**, I want **chat — lww per message id**.

`P3 · Pending · Platforms: Web, Mobile · Source: RFC-INFRA-001 §A.5 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can chat — LWW per message id from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Vitals chart annotations — sub-map per vital op
> As a **platform engineer**, I want **vitals chart annotations — sub-map per vital op**.

`P3 · Pending · Platforms: Web, Mobile · Source: RFC-INFRA-001 §A.5 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can vitals chart annotations — sub-map per vital op from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Compile-time exhaustive policy enum (no LWW default)
> As a **platform engineer**, I want **compile-time exhaustive policy enum (no lww default)**.

`P1 · Pending · Platforms: Web · Source: RFC-INFRA-001 §A.5 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can compile-time exhaustive policy enum (no LWW default) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## DR

### RPO < 15 minutes, RTO < 2 hours disaster recovery target
> As a **platform engineer**, I want **rpo < 15 minutes, rto < 2 hours disaster recovery target**.

`Pending · Platforms: Web · Source: RFC+MocDoc · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can rPO < 15 minutes, RTO < 2 hours disaster recovery target from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Disaster recovery runbook with automated failover scripts
> As a **platform engineer**, I want **disaster recovery runbook with automated failover scripts**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can disaster recovery runbook with automated failover scripts from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Annual DR drill with documented results and improvement plan
> As a **platform engineer**, I want **annual dr drill with documented results and improvement plan**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can annual DR drill with documented results and improvement plan from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## DR & Backup

### Aurora PITR 35d + cross-region snapshots every 6h
> As a **platform engineer**, I want **aurora pitr 35d + cross-region snapshots every 6h**.

`P1 · Pending · Source: RFC-INFRA-001 §C.8 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can aurora PITR 35d + cross-region snapshots every 6h from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### YottaDB Velero hourly + EBS daily snapshots
> As a **platform engineer**, I want **yottadb velero hourly + ebs daily snapshots**.

`P1 · Pending · Source: RFC-INFRA-001 §C.8 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can yottaDB Velero hourly + EBS daily snapshots from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### S3 versioning + CRR for audit-archive and uploads
> As a **platform engineer**, I want **s3 versioning + crr for audit-archive and uploads**.

`P1 · Pending · Source: RFC-INFRA-001 §C.8 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can s3 versioning + CRR for audit-archive and uploads from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Velero hourly backup of K8s objects to S3
> As a **platform engineer**, I want **velero hourly backup of k8s objects to s3**.

`P1 · Pending · Source: RFC-INFRA-001 §C.8 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can velero hourly backup of K8s objects to S3 from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Edge node daily Restic snapshot to regional S3
> As a **platform engineer**, I want **edge node daily restic snapshot to regional s3**.

`P2 · Pending · Source: RFC-INFRA-001 §C.8 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can edge node daily Restic snapshot to regional S3 from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Quarterly DR game day per region
> As a **platform engineer**, I want **quarterly dr game day per region**.

`P2 · Pending · Source: RFC-INFRA-001 §C.8 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can quarterly DR game day per region from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Documented restore runbooks (Aurora, YottaDB, K8s)
> As a **platform engineer**, I want **documented restore runbooks (aurora, yottadb, k8s)**.

`P1 · Pending · Source: RFC-INFRA-001 §C.8 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can documented restore runbooks (Aurora, YottaDB, K8s) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Docker

### ✅ Docker containerization for all services (server, YottaDB, PostgreSQL, Redis, NATS, Meilisearch)
> As a **platform engineer**, I want **docker containerization for all services (server, yottadb, postgresql, redis, nats, meilisearch)**.

`Done · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [x] The platform engineer can docker containerization for all services (server, YottaDB, PostgreSQL, Redis, NATS, Meilisearch) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Docker Compose for local development environment (one-command setup)
> As a **platform engineer**, I want **docker compose for local development environment (one-command setup)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can docker Compose for local development environment (one-command setup) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## EKS Cluster

### EKS 1.31 with Bottlerocket AMI
> As a **platform engineer**, I want **eks 1.31 with bottlerocket ami**.

`P1 · Pending · Source: RFC-INFRA-001 §C.1 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can eKS 1.31 with Bottlerocket AMI from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Karpenter autoscaling (replaces Cluster Autoscaler)
> As a **platform engineer**, I want **karpenter autoscaling (replaces cluster autoscaler)**.

`P1 · Pending · Source: RFC-INFRA-001 §C.1 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can karpenter autoscaling (replaces Cluster Autoscaler) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### System NodePool (on-demand, AZ-spread)
> As a **platform engineer**, I want **system nodepool (on-demand, az-spread)**.

`P1 · Pending · Source: RFC-INFRA-001 §C.1 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can system NodePool (on-demand, AZ-spread) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### App on-demand NodePool (m6i/m7i)
> As a **platform engineer**, I want **app on-demand nodepool (m6i/m7i)**.

`P1 · Pending · Source: RFC-INFRA-001 §C.1 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can app on-demand NodePool (m6i/m7i) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### App spot NodePool (stateless workers)
> As a **platform engineer**, I want **app spot nodepool (stateless workers)**.

`P2 · Pending · Source: RFC-INFRA-001 §C.1 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can app spot NodePool (stateless workers) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### GPU NodePool (V2 — radiology AI)
> As a **platform engineer**, I want **gpu nodepool (v2 — radiology ai)**.

`P3 · Pending · Source: RFC-INFRA-001 §C.1 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can gPU NodePool (V2 — radiology AI) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### KMS-encrypted EKS secrets envelope
> As a **platform engineer**, I want **kms-encrypted eks secrets envelope**.

`P1 · Pending · Source: RFC-INFRA-001 §C.5 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can kMS-encrypted EKS secrets envelope from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Edge Node (medbrains-edge)

### medbrains-edge Rust binary (axum + sqlite + loro)
> As a **platform engineer**, I want **medbrains-edge rust binary (axum + sqlite + loro)**.

`P1 · Pending · Source: RFC-INFRA-001 §A.6 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can medbrains-edge Rust binary (axum + sqlite + loro) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### LAN sync hub with mDNS discovery
> As a **platform engineer**, I want **lan sync hub with mdns discovery**.

`P1 · Pending · Source: RFC-INFRA-001 §A.6 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can lAN sync hub with mDNS discovery from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Outbox WAL queue for T1 writes during WAN outage
> As a **platform engineer**, I want **outbox wal queue for t1 writes during wan outage**.

`P1 · Pending · Source: RFC-INFRA-001 §A.6 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can outbox WAL queue for T1 writes during WAN outage from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Read-cache for pinned Aurora subset (drug catalog, demographics)
> As a **platform engineer**, I want **read-cache for pinned aurora subset (drug catalog, demographics)**.

`P1 · Pending · Source: RFC-INFRA-001 §A.6 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can read-cache for pinned Aurora subset (drug catalog, demographics) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Idempotency-key replay on reconnect
> As a **platform engineer**, I want **idempotency-key replay on reconnect**.

`P1 · Pending · Source: RFC-INFRA-001 §A.6 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can idempotency-key replay on reconnect from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Device pairing + per-device cert issue
> As a **platform engineer**, I want **device pairing + per-device cert issue**.

`P2 · Pending · Source: RFC-INFRA-001 §A.6 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can device pairing + per-device cert issue from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Fleet management via FluxCD on single-node k3s
> As a **platform engineer**, I want **fleet management via fluxcd on single-node k3s**.

`P2 · Pending · Source: RFC-INFRA-001 §A.6 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can fleet management via FluxCD on single-node k3s from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### UPS-backed hardware spec (NUC, 8GB RAM, 256GB SSD, dual-NIC)
> As a **platform engineer**, I want **ups-backed hardware spec (nuc, 8gb ram, 256gb ssd, dual-nic)**.

`P2 · Pending · Source: RFC-INFRA-001 §A.6 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can uPS-backed hardware spec (NUC, 8GB RAM, 256GB SSD, dual-NIC) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Daily encrypted snapshot to regional S3 (Restic)
> As a **platform engineer**, I want **daily encrypted snapshot to regional s3 (restic)**.

`P2 · Pending · Source: RFC-INFRA-001 §C.8 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can daily encrypted snapshot to regional S3 (Restic) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Email

### SMTP / email service integration (SES / SendGrid / Mailgun) with template engine
> As a **platform engineer**, I want **smtp / email service integration (ses / sendgrid / mailgun) with template engine**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can sMTP / email service integration (SES / SendGrid / Mailgun) with template engine from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Email deliverability tracking (sent, delivered, opened, bounced)
> As a **platform engineer**, I want **email deliverability tracking (sent, delivered, opened, bounced)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can email deliverability tracking (sent, delivered, opened, bounced) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Gateway

### API gateway (rate limiting, authentication, request routing)
> As a **platform engineer**, I want **api gateway (rate limiting, authentication, request routing)**.

`Partial · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can aPI gateway (rate limiting, authentication, request routing) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Per-tenant API rate limiting (configurable RPS per plan tier)
> As a **platform engineer**, I want **per-tenant api rate limiting (configurable rps per plan tier)**.

`Partial · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can per-tenant API rate limiting (configurable RPS per plan tier) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Payment gateway integration (Razorpay / Stripe / PayU / CCAvenue)
> As a **platform engineer**, I want **payment gateway integration (razorpay / stripe / payu / ccavenue)**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can payment gateway integration (Razorpay / Stripe / PayU / CCAvenue) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### UPI payment support (QR code + intent-based + collect)
> As a **platform engineer**, I want **upi payment support (qr code + intent-based + collect)**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can uPI payment support (QR code + intent-based + collect) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Payment reconciliation — auto-match gateway transactions with bills
> As a **platform engineer**, I want **payment reconciliation — auto-match gateway transactions with bills**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can payment reconciliation — auto-match gateway transactions with bills from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Refund processing workflow (partial/full refund with audit trail)
> As a **platform engineer**, I want **refund processing workflow (partial/full refund with audit trail)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can refund processing workflow (partial/full refund with audit trail) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Payment link generation (SMS/WhatsApp share for remote payment)
> As a **platform engineer**, I want **payment link generation (sms/whatsapp share for remote payment)**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can payment link generation (SMS/WhatsApp share for remote payment) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## General

### RESTful API for every module — auto-generated OpenAPI 3.1 docs with interactive Swagger UI
> As a **platform engineer**, I want **restful api for every module — auto-generated openapi 3.1 docs with interactive swagger ui**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The platform engineer can rESTful API for every module — auto-generated OpenAPI 3.1 docs with interactive Swagger UI from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Webhook event system — subscribe to events (patient_admitted, lab_result_ready, bill_generated)
> As a **platform engineer**, I want **webhook event system — subscribe to events (patient_admitted, lab_result_ready, bill_generated)**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The platform engineer can webhook event system — subscribe to events (patient_admitted, lab_result_ready, bill_generated) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### OAuth 2.0 third-party app authorization — external apps request scoped access with patient consent
> As a **platform engineer**, I want **oauth 2.0 third-party app authorization — external apps request scoped access with patient consent**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The platform engineer can oAuth 2.0 third-party app authorization — external apps request scoped access with patient consent from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### FHIR R4 native API layer — Patient, Observation, MedicationRequest, DiagnosticReport resources
> As a **platform engineer**, I want **fhir r4 native api layer — patient, observation, medicationrequest, diagnosticreport resources**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The platform engineer can fHIR R4 native API layer — Patient, Observation, MedicationRequest, DiagnosticReport resources from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Event-driven inter-module communication — NATS JetStream pub/sub for real-time cross-module triggers
> As a **platform engineer**, I want **event-driven inter-module communication — nats jetstream pub/sub for real-time cross-module triggers**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The platform engineer can event-driven inter-module communication — NATS JetStream pub/sub for real-time cross-module triggers from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Pre-built Tally connector — auto-push journal entries, invoices, payment receipts to Tally Prime
> As a **platform engineer**, I want **pre-built tally connector — auto-push journal entries, invoices, payment receipts to tally prime**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The platform engineer can pre-built Tally connector — auto-push journal entries, invoices, payment receipts to Tally Prime from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Pre-built SAP connector — GL account sync, purchase order exchange, vendor master sync
> As a **platform engineer**, I want **pre-built sap connector — gl account sync, purchase order exchange, vendor master sync**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The platform engineer can pre-built SAP connector — GL account sync, purchase order exchange, vendor master sync from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Pre-built ABDM connector — ABHA creation, care context linking, health record push (M1/M2/M3)
> As a **platform engineer**, I want **pre-built abdm connector — abha creation, care context linking, health record push (m1/m2/m3)**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The platform engineer can pre-built ABDM connector — ABHA creation, care context linking, health record push (M1/M2/M3) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Pre-built lab instrument adapter — HL7v2 ORM/ORU message parsing for bi-directional LIS interfacing
> As a **platform engineer**, I want **pre-built lab instrument adapter — hl7v2 orm/oru message parsing for bi-directional lis interfacing**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The platform engineer can pre-built lab instrument adapter — HL7v2 ORM/ORU message parsing for bi-directional LIS interfacing from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Integration marketplace UI — browse, install, configure third-party connectors from admin panel
> As a **platform engineer**, I want **integration marketplace ui — browse, install, configure third-party connectors from admin panel**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The platform engineer can integration marketplace UI — browse, install, configure third-party connectors from admin panel from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### API usage dashboard — request counts, error rates, latency per consumer with rate limiting controls
> As a **platform engineer**, I want **api usage dashboard — request counts, error rates, latency per consumer with rate limiting controls**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The platform engineer can aPI usage dashboard — request counts, error rates, latency per consumer with rate limiting controls from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Bulk import/export engine — CSV, JSON, FHIR Bundle for patient data migration across systems
> As a **platform engineer**, I want **bulk import/export engine — csv, json, fhir bundle for patient data migration across systems**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The platform engineer can bulk import/export engine — CSV, JSON, FHIR Bundle for patient data migration across systems from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Scheduled job framework — configurable cron-like triggers for EOD reports, data sync, cleanup tasks
> As a **platform engineer**, I want **scheduled job framework — configurable cron-like triggers for eod reports, data sync, cleanup tasks**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The platform engineer can scheduled job framework — configurable cron-like triggers for EOD reports, data sync, cleanup tasks from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### SDKs for popular languages — Python, JavaScript, .NET client libraries auto-generated from OpenAPI spec
> As a **platform engineer**, I want **sdks for popular languages — python, javascript, .net client libraries auto-generated from openapi spec**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The platform engineer can sDKs for popular languages — Python, JavaScript, .NET client libraries auto-generated from OpenAPI spec from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Sandbox environment — isolated test tenant with sample data for third-party developers to build against
> As a **platform engineer**, I want **sandbox environment — isolated test tenant with sample data for third-party developers to build against**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The platform engineer can sandbox environment — isolated test tenant with sample data for third-party developers to build against from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Global command palette (Cmd+K) — search pages, navigate modules, run quick actions with keyboard
> As a **platform engineer**, I want **global command palette (cmd+k) — search pages, navigate modules, run quick actions with keyboard**.

`P1 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [x] The platform engineer can global command palette (Cmd+K) — search pages, navigate modules, run quick actions with keyboard from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Toast notification system — success/error/warning/info toasts with auto-close and icon
> As a **platform engineer**, I want **toast notification system — success/error/warning/info toasts with auto-close and icon**.

`P1 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [x] The platform engineer can toast notification system — success/error/warning/info toasts with auto-close and icon from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Internationalization framework — 13 translation namespaces with react-i18next + HttpBackend
> As a **platform engineer**, I want **internationalization framework — 13 translation namespaces with react-i18next + httpbackend**.

`P1 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [x] The platform engineer can internationalization framework — 13 translation namespaces with react-i18next + HttpBackend from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Multi-measurement unit conversion — kg↔lb, cm↔in, °C↔°F per locale with backend metric storage
> As a **platform engineer**, I want **multi-measurement unit conversion — kg↔lb, cm↔in, °c↔°f per locale with backend metric storage**.

`P1 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [x] The platform engineer can multi-measurement unit conversion — kg↔lb, cm↔in, °C↔°F per locale with backend metric storage from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Visual form builder — drag-drop field canvas, property editor, conditional logic, versioning
> As a **platform engineer**, I want **visual form builder — drag-drop field canvas, property editor, conditional logic, versioning**.

`P1 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [x] The platform engineer can visual form builder — drag-drop field canvas, property editor, conditional logic, versioning from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Dashboard builder — widget palette, drag-drop layout, data binding, module-scoped views
> As a **platform engineer**, I want **dashboard builder — widget palette, drag-drop layout, data binding, module-scoped views**.

`P1 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [x] The platform engineer can dashboard builder — widget palette, drag-drop layout, data binding, module-scoped views from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Screen builder — dynamic page generator with zone-based layout (form, table, kanban, calendar)
> As a **platform engineer**, I want **screen builder — dynamic page generator with zone-based layout (form, table, kanban, calendar)**.

`P1 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [x] The platform engineer can screen builder — dynamic page generator with zone-based layout (form, table, kanban, calendar) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Integration builder — visual pipeline editor, node-based ETL, trigger/action/transform nodes
> As a **platform engineer**, I want **integration builder — visual pipeline editor, node-based etl, trigger/action/transform nodes**.

`P1 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [x] The platform engineer can integration builder — visual pipeline editor, node-based ETL, trigger/action/transform nodes from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Role-based permission system — 111 permission codes, page guards, element-level visibility hooks
> As a **platform engineer**, I want **role-based permission system — 111 permission codes, page guards, element-level visibility hooks**.

`P1 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [x] The platform engineer can role-based permission system — 111 permission codes, page guards, element-level visibility hooks from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Paginated data table — custom render columns, loading skeletons, empty state, sticky header
> As a **platform engineer**, I want **paginated data table — custom render columns, loading skeletons, empty state, sticky header**.

`P1 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [x] The platform engineer can paginated data table — custom render columns, loading skeletons, empty state, sticky header from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ CSV bulk import/export — upload master data, download lists to CSV
> As a **platform engineer**, I want **csv bulk import/export — upload master data, download lists to csv**.

`P1 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [x] The platform engineer can cSV bulk import/export — upload master data, download lists to CSV from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Print template builder — configurable hospital-branded print layouts for invoices/reports
> As a **platform engineer**, I want **print template builder — configurable hospital-branded print layouts for invoices/reports**.

`P1 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [x] The platform engineer can print template builder — configurable hospital-branded print layouts for invoices/reports from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Collapsible sidebar navigation — pin/unpin, hover-expand, mobile burger, data-driven from config
> As a **platform engineer**, I want **collapsible sidebar navigation — pin/unpin, hover-expand, mobile burger, data-driven from config**.

`P1 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [x] The platform engineer can collapsible sidebar navigation — pin/unpin, hover-expand, mobile burger, data-driven from config from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Session management with proactive token refresh — 13-min refresh cycle, auto-logout on expiry
> As a **platform engineer**, I want **session management with proactive token refresh — 13-min refresh cycle, auto-logout on expiry**.

`P1 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [x] The platform engineer can session management with proactive token refresh — 13-min refresh cycle, auto-logout on expiry from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Clinical event broadcast — cross-module event provider for admission/discharge/prescription events
> As a **platform engineer**, I want **clinical event broadcast — cross-module event provider for admission/discharge/prescription events**.

`P1 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [x] The platform engineer can clinical event broadcast — cross-module event provider for admission/discharge/prescription events from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Enhanced global search — fuzzy search across patients, encounters, orders, documents (beyond nav-only Spotlight)
> As a **platform engineer**, I want **enhanced global search — fuzzy search across patients, encounters, orders, documents (beyond nav-only spotlight)**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The platform engineer can enhanced global search — fuzzy search across patients, encounters, orders, documents (beyond nav-only Spotlight) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Recent items panel — last 20 viewed patients, orders, reports with one-click re-access
> As a **platform engineer**, I want **recent items panel — last 20 viewed patients, orders, reports with one-click re-access**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The platform engineer can recent items panel — last 20 viewed patients, orders, reports with one-click re-access from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Favorites/bookmarks — pin any entity (patient, report, page) to personal quick-access panel
> As a **platform engineer**, I want **favorites/bookmarks — pin any entity (patient, report, page) to personal quick-access panel**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The platform engineer can favorites/bookmarks — pin any entity (patient, report, page) to personal quick-access panel from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Deep link sharing — copy shareable URL for any record/entity to clipboard for team sharing
> As a **platform engineer**, I want **deep link sharing — copy shareable url for any record/entity to clipboard for team sharing**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The platform engineer can deep link sharing — copy shareable URL for any record/entity to clipboard for team sharing from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Patient-aware breadcrumbs — context breadcrumbs showing patient→encounter→order hierarchy
> As a **platform engineer**, I want **patient-aware breadcrumbs — context breadcrumbs showing patient→encounter→order hierarchy**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The platform engineer can patient-aware breadcrumbs — context breadcrumbs showing patient→encounter→order hierarchy from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Notification center UI (bell icon) — persistent notification history with unread count, grouped by module
> As a **platform engineer**, I want **notification center ui (bell icon) — persistent notification history with unread count, grouped by module**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The platform engineer can notification center UI (bell icon) — persistent notification history with unread count, grouped by module from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Per-user notification preferences — choose channel (in-app, email, SMS, push) per event type
> As a **platform engineer**, I want **per-user notification preferences — choose channel (in-app, email, sms, push) per event type**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The platform engineer can per-user notification preferences — choose channel (in-app, email, SMS, push) per event type from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Three-tier alert severity — critical (immediate+audible), urgent (in-tray), routine (daily digest)
> As a **platform engineer**, I want **three-tier alert severity — critical (immediate+audible), urgent (in-tray), routine (daily digest)**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The platform engineer can three-tier alert severity — critical (immediate+audible), urgent (in-tray), routine (daily digest) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Do-not-disturb mode — suppress non-critical notifications during procedures/consultations
> As a **platform engineer**, I want **do-not-disturb mode — suppress non-critical notifications during procedures/consultations**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The platform engineer can do-not-disturb mode — suppress non-critical notifications during procedures/consultations from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Alert escalation chain — unacknowledged critical alerts auto-escalate to supervisor after timeout
> As a **platform engineer**, I want **alert escalation chain — unacknowledged critical alerts auto-escalate to supervisor after timeout**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The platform engineer can alert escalation chain — unacknowledged critical alerts auto-escalate to supervisor after timeout from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Alert fatigue mitigation — deduplicate repeated alerts, batch non-urgent, enforce clinical specificity
> As a **platform engineer**, I want **alert fatigue mitigation — deduplicate repeated alerts, batch non-urgent, enforce clinical specificity**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The platform engineer can alert fatigue mitigation — deduplicate repeated alerts, batch non-urgent, enforce clinical specificity from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Keyboard shortcuts framework — configurable hotkeys for common actions across all modules
> As a **platform engineer**, I want **keyboard shortcuts framework — configurable hotkeys for common actions across all modules**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The platform engineer can keyboard shortcuts framework — configurable hotkeys for common actions across all modules from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Keyboard shortcut reference overlay — Cmd+? opens full shortcuts cheat sheet
> As a **platform engineer**, I want **keyboard shortcut reference overlay — cmd+? opens full shortcuts cheat sheet**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The platform engineer can keyboard shortcut reference overlay — Cmd+? opens full shortcuts cheat sheet from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Auto-save form drafts — save form state every 30s to browser storage, recover on return
> As a **platform engineer**, I want **auto-save form drafts — save form state every 30s to browser storage, recover on return**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The platform engineer can auto-save form drafts — save form state every 30s to browser storage, recover on return from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Unsaved changes guard — prompt before navigating away from forms with pending edits
> As a **platform engineer**, I want **unsaved changes guard — prompt before navigating away from forms with pending edits**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The platform engineer can unsaved changes guard — prompt before navigating away from forms with pending edits from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Clinical context preservation — maintain form state, scroll position, filters across patient switches
> As a **platform engineer**, I want **clinical context preservation — maintain form state, scroll position, filters across patient switches**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The platform engineer can clinical context preservation — maintain form state, scroll position, filters across patient switches from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Smart phrases — type short abbreviation to auto-insert pre-written clinical text blocks (Epic SmartPhrases pattern)
> As a **platform engineer**, I want **smart phrases — type short abbreviation to auto-insert pre-written clinical text blocks (epic smartphrases pattern)**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The platform engineer can smart phrases — type short abbreviation to auto-insert pre-written clinical text blocks (Epic SmartPhrases pattern) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Dark mode toggle — system-preference-aware dark theme with manual override, persisted per user
> As a **platform engineer**, I want **dark mode toggle — system-preference-aware dark theme with manual override, persisted per user**.

`P1 · Pending · Platforms: Web, Mobile, TV · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The platform engineer can dark mode toggle — system-preference-aware dark theme with manual override, persisted per user from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### High-contrast mode — WCAG AAA compliant theme for visual accessibility
> As a **platform engineer**, I want **high-contrast mode — wcag aaa compliant theme for visual accessibility**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The platform engineer can high-contrast mode — WCAG AAA compliant theme for visual accessibility from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Configurable table columns — show/hide/reorder columns in any DataTable, save as named view
> As a **platform engineer**, I want **configurable table columns — show/hide/reorder columns in any datatable, save as named view**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The platform engineer can configurable table columns — show/hide/reorder columns in any DataTable, save as named view from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Saved filter presets — save and share frequently used filter combinations per module
> As a **platform engineer**, I want **saved filter presets — save and share frequently used filter combinations per module**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The platform engineer can saved filter presets — save and share frequently used filter combinations per module from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Custom landing page — user chooses default homepage (dashboard, patient list, OPD queue, etc.)
> As a **platform engineer**, I want **custom landing page — user chooses default homepage (dashboard, patient list, opd queue, etc.)**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The platform engineer can custom landing page — user chooses default homepage (dashboard, patient list, OPD queue, etc.) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### In-context comments — add notes/comments on any entity (patient, order, invoice, equipment)
> As a **platform engineer**, I want **in-context comments — add notes/comments on any entity (patient, order, invoice, equipment)**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The platform engineer can in-context comments — add notes/comments on any entity (patient, order, invoice, equipment) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### @mention colleagues — tag staff in comments, auto-generates notification to mentioned user
> As a **platform engineer**, I want **@mention colleagues — tag staff in comments, auto-generates notification to mentioned user**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The platform engineer can @mention colleagues — tag staff in comments, auto-generates notification to mentioned user from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Presence indicators — see who else is viewing the same patient/record to avoid edit conflicts
> As a **platform engineer**, I want **presence indicators — see who else is viewing the same patient/record to avoid edit conflicts**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The platform engineer can presence indicators — see who else is viewing the same patient/record to avoid edit conflicts from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Contextual task assignment — assign follow-up tasks to colleagues from any module record
> As a **platform engineer**, I want **contextual task assignment — assign follow-up tasks to colleagues from any module record**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The platform engineer can contextual task assignment — assign follow-up tasks to colleagues from any module record from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Universal list export — export any DataTable to Excel, CSV, or PDF with current filters applied
> As a **platform engineer**, I want **universal list export — export any datatable to excel, csv, or pdf with current filters applied**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The platform engineer can universal list export — export any DataTable to Excel, CSV, or PDF with current filters applied from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Universal entity print — print any detail page with hospital-branded header/footer
> As a **platform engineer**, I want **universal entity print — print any detail page with hospital-branded header/footer**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The platform engineer can universal entity print — print any detail page with hospital-branded header/footer from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Bulk multi-select actions — checkbox column in DataTable + batch toolbar (print, export, status change)
> As a **platform engineer**, I want **bulk multi-select actions — checkbox column in datatable + batch toolbar (print, export, status change)**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The platform engineer can bulk multi-select actions — checkbox column in DataTable + batch toolbar (print, export, status change) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Side-by-side record comparison — compare two records of same type (patients, invoices, test results)
> As a **platform engineer**, I want **side-by-side record comparison — compare two records of same type (patients, invoices, test results)**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The platform engineer can side-by-side record comparison — compare two records of same type (patients, invoices, test results) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Inline clinical calculators — BMI, GFR, drug dosage, unit conversion accessible from any page
> As a **platform engineer**, I want **inline clinical calculators — bmi, gfr, drug dosage, unit conversion accessible from any page**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The platform engineer can inline clinical calculators — BMI, GFR, drug dosage, unit conversion accessible from any page from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### WebSocket infrastructure — live data push for queues, beds, alerts without polling
> As a **platform engineer**, I want **websocket infrastructure — live data push for queues, beds, alerts without polling**.

`P1 · Pending · Platforms: Web, TV · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The platform engineer can webSocket infrastructure — live data push for queues, beds, alerts without polling from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Real-time queue updates — live OPD/ER queue position changes without page refresh
> As a **platform engineer**, I want **real-time queue updates — live opd/er queue position changes without page refresh**.

`P1 · Pending · Platforms: Web, Mobile, TV · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The platform engineer can real-time queue updates — live OPD/ER queue position changes without page refresh from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Real-time bed board — live occupancy and status changes pushed to all viewers
> As a **platform engineer**, I want **real-time bed board — live occupancy and status changes pushed to all viewers**.

`P1 · Pending · Platforms: Web, TV · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The platform engineer can real-time bed board — live occupancy and status changes pushed to all viewers from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Real-time notification delivery — push notifications to browser without polling
> As a **platform engineer**, I want **real-time notification delivery — push notifications to browser without polling**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The platform engineer can real-time notification delivery — push notifications to browser without polling from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### PWA installable — install on desktop/mobile with app icon, splash screen, standalone window
> As a **platform engineer**, I want **pwa installable — install on desktop/mobile with app icon, splash screen, standalone window**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The platform engineer can pWA installable — install on desktop/mobile with app icon, splash screen, standalone window from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Offline shell — cached navigation and last-viewed data when network unavailable
> As a **platform engineer**, I want **offline shell — cached navigation and last-viewed data when network unavailable**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The platform engineer can offline shell — cached navigation and last-viewed data when network unavailable from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Background sync — queue form submissions when offline, auto-submit on reconnect
> As a **platform engineer**, I want **background sync — queue form submissions when offline, auto-submit on reconnect**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The platform engineer can background sync — queue form submissions when offline, auto-submit on reconnect from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Service worker push notifications — receive alerts even when browser tab is closed
> As a **platform engineer**, I want **service worker push notifications — receive alerts even when browser tab is closed**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The platform engineer can service worker push notifications — receive alerts even when browser tab is closed from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Personal activity feed — chronological log of own actions across all modules
> As a **platform engineer**, I want **personal activity feed — chronological log of own actions across all modules**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The platform engineer can personal activity feed — chronological log of own actions across all modules from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Entity timeline — visual timeline showing all events on any entity (patient→visits→labs→billing)
> As a **platform engineer**, I want **entity timeline — visual timeline showing all events on any entity (patient→visits→labs→billing)**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The platform engineer can entity timeline — visual timeline showing all events on any entity (patient→visits→labs→billing) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Change history diff — show what changed, by whom, when on any editable record
> As a **platform engineer**, I want **change history diff — show what changed, by whom, when on any editable record**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The platform engineer can change history diff — show what changed, by whom, when on any editable record from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Active sessions dashboard — view sessions across devices, force logout from other devices
> As a **platform engineer**, I want **active sessions dashboard — view sessions across devices, force logout from other devices**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The platform engineer can active sessions dashboard — view sessions across devices, force logout from other devices from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Website AI chatbot — FAQ answers, doctor search, appointment booking, department directions, operating hours
> As a **platform engineer**, I want **website ai chatbot — faq answers, doctor search, appointment booking, department directions, operating hours**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The platform engineer can website AI chatbot — FAQ answers, doctor search, appointment booking, department directions, operating hours from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### WhatsApp AI assistant — conversational appointment booking, report status queries, bill inquiries in natural language
> As a **platform engineer**, I want **whatsapp ai assistant — conversational appointment booking, report status queries, bill inquiries in natural language**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The platform engineer can whatsApp AI assistant — conversational appointment booking, report status queries, bill inquiries in natural language from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Symptom checker — guided questionnaire suggesting appropriate department and specialist based on symptoms
> As a **platform engineer**, I want **symptom checker — guided questionnaire suggesting appropriate department and specialist based on symptoms**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The platform engineer can symptom checker — guided questionnaire suggesting appropriate department and specialist based on symptoms from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Smart appointment routing — chatbot triages urgency level and auto-routes to correct department/doctor
> As a **platform engineer**, I want **smart appointment routing — chatbot triages urgency level and auto-routes to correct department/doctor**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The platform engineer can smart appointment routing — chatbot triages urgency level and auto-routes to correct department/doctor from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Chatbot-to-human handoff — seamless escalation from bot to live agent with conversation context preserved
> As a **platform engineer**, I want **chatbot-to-human handoff — seamless escalation from bot to live agent with conversation context preserved**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The platform engineer can chatbot-to-human handoff — seamless escalation from bot to live agent with conversation context preserved from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Chatbot analytics dashboard — conversation volume, resolution rate, top query categories, handoff rate, CSAT
> As a **platform engineer**, I want **chatbot analytics dashboard — conversation volume, resolution rate, top query categories, handoff rate, csat**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The platform engineer can chatbot analytics dashboard — conversation volume, resolution rate, top query categories, handoff rate, CSAT from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Integration

### Third-party API key management vault (encrypted storage for external API keys)
> As a **platform engineer**, I want **third-party api key management vault (encrypted storage for external api keys)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can third-party API key management vault (encrypted storage for external API keys) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### FHIR R4 API endpoints for interoperability
> As a **platform engineer**, I want **fhir r4 api endpoints for interoperability**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can fHIR R4 API endpoints for interoperability from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Kubernetes

### Kubernetes deployment manifests (Helm charts for production)
> As a **platform engineer**, I want **kubernetes deployment manifests (helm charts for production)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can kubernetes deployment manifests (Helm charts for production) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Horizontal pod autoscaling based on CPU/memory/request-count
> As a **platform engineer**, I want **horizontal pod autoscaling based on cpu/memory/request-count**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can horizontal pod autoscaling based on CPU/memory/request-count from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Rolling updates with zero-downtime deployment
> As a **platform engineer**, I want **rolling updates with zero-downtime deployment**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can rolling updates with zero-downtime deployment from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Blue-green / canary deployment support
> As a **platform engineer**, I want **blue-green / canary deployment support**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can blue-green / canary deployment support from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Multi-region deployment capability (active-active or active-passive)
> As a **platform engineer**, I want **multi-region deployment capability (active-active or active-passive)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can multi-region deployment capability (active-active or active-passive) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Local CRDT Storage

### Web — IndexedDB via idb (Loro snapshots + op log)
> As a **platform engineer**, I want **web — indexeddb via idb (loro snapshots + op log)**.

`P1 · Pending · Platforms: Web · Source: RFC-INFRA-001 §A.3 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can web — IndexedDB via idb (Loro snapshots + op log) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Mobile — SQLite Loro store coexisting with WatermelonDB
> As a **platform engineer**, I want **mobile — sqlite loro store coexisting with watermelondb**.

`P1 · Pending · Platforms: Mobile · Source: RFC-INFRA-001 §A.3 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can mobile — SQLite Loro store coexisting with WatermelonDB from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Edge — SQLite per-tenant op log with 30-day hot ring buffer
> As a **platform engineer**, I want **edge — sqlite per-tenant op log with 30-day hot ring buffer**.

`P1 · Pending · Source: RFC-INFRA-001 §A.3 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can edge — SQLite per-tenant op log with 30-day hot ring buffer from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### S3 cold-archive of edge op logs
> As a **platform engineer**, I want **s3 cold-archive of edge op logs**.

`P3 · Pending · Source: RFC-INFRA-001 §A.3 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can s3 cold-archive of edge op logs from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### TanStack Query adapter materialising Loro views
> As a **platform engineer**, I want **tanstack query adapter materialising loro views**.

`P1 · Pending · Platforms: Web · Source: RFC-INFRA-001 §A.3 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can tanStack Query adapter materialising Loro views from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Meilisearch

### Meilisearch for patient search (name, UHID, phone, Aadhaar — typo-tolerant)
> As a **platform engineer**, I want **meilisearch for patient search (name, uhid, phone, aadhaar — typo-tolerant)**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can meilisearch for patient search (name, UHID, phone, Aadhaar — typo-tolerant) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Drug search (brand name, generic, salt composition — fuzzy matching)
> As a **platform engineer**, I want **drug search (brand name, generic, salt composition — fuzzy matching)**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can drug search (brand name, generic, salt composition — fuzzy matching) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ ICD-10 / procedure code search with keyword autocomplete
> As a **platform engineer**, I want **icd-10 / procedure code search with keyword autocomplete**.

`Done · Platforms: Web, Mobile · Source: RFC · RFC: §3`

**Acceptance criteria**
- [x] The platform engineer can iCD-10 / procedure code search with keyword autocomplete from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Multi-tenant search isolation (per-tenant index filtering)
> As a **platform engineer**, I want **multi-tenant search isolation (per-tenant index filtering)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can multi-tenant search isolation (per-tenant index filtering) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Real-time index sync from PostgreSQL (CDC or trigger-based)
> As a **platform engineer**, I want **real-time index sync from postgresql (cdc or trigger-based)**.

`Done · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [x] The platform engineer can real-time index sync from PostgreSQL (CDC or trigger-based) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Metrics

### Prometheus metrics endpoint on every service (request count, latency p50/p95/p99, error rate)
> As a **platform engineer**, I want **prometheus metrics endpoint on every service (request count, latency p50/p95/p99, error rate)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can prometheus metrics endpoint on every service (request count, latency p50/p95/p99, error rate) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Grafana dashboards — per-service health, database pool, cache hit rate, queue depth
> As a **platform engineer**, I want **grafana dashboards — per-service health, database pool, cache hit rate, queue depth**.

`Done · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [x] The platform engineer can grafana dashboards — per-service health, database pool, cache hit rate, queue depth from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Custom business metrics (registrations/hr, orders/hr, revenue/hr per tenant)
> As a **platform engineer**, I want **custom business metrics (registrations/hr, orders/hr, revenue/hr per tenant)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can custom business metrics (registrations/hr, orders/hr, revenue/hr per tenant) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## NATS JetStream

### NATS JetStream for async event streaming (order placed, result ready, discharge)
> As a **platform engineer**, I want **nats jetstream for async event streaming (order placed, result ready, discharge)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can nATS JetStream for async event streaming (order placed, result ready, discharge) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Event-driven notifications (lab result → notify doctor, bill ready → notify patient)
> As a **platform engineer**, I want **event-driven notifications (lab result → notify doctor, bill ready → notify patient)**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can event-driven notifications (lab result → notify doctor, bill ready → notify patient) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Durable subscription with at-least-once delivery guarantee
> As a **platform engineer**, I want **durable subscription with at-least-once delivery guarantee**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can durable subscription with at-least-once delivery guarantee from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Dead letter queue for failed event processing with retry logic
> As a **platform engineer**, I want **dead letter queue for failed event processing with retry logic**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can dead letter queue for failed event processing with retry logic from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Event replay capability (re-process historical events for new consumers)
> As a **platform engineer**, I want **event replay capability (re-process historical events for new consumers)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can event replay capability (re-process historical events for new consumers) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Network

### TLS 1.3 everywhere (API, database connections, inter-service communication)
> As a **platform engineer**, I want **tls 1.3 everywhere (api, database connections, inter-service communication)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can tLS 1.3 everywhere (API, database connections, inter-service communication) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### WAF (Web Application Firewall) — OWASP top 10 protection
> As a **platform engineer**, I want **waf (web application firewall) — owasp top 10 protection**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can wAF (Web Application Firewall) — OWASP top 10 protection from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### DDoS protection (CloudFlare / AWS Shield)
> As a **platform engineer**, I want **ddos protection (cloudflare / aws shield)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can dDoS protection (CloudFlare / AWS Shield) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Network segmentation (DMZ, application tier, database tier)
> As a **platform engineer**, I want **network segmentation (dmz, application tier, database tier)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can network segmentation (DMZ, application tier, database tier) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Network Topology

### Per-region VPC (3 AZs, public/private/db subnets)
> As a **platform engineer**, I want **per-region vpc (3 azs, public/private/db subnets)**.

`P1 · Pending · Source: RFC-INFRA-001 §B.4 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can per-region VPC (3 AZs, public/private/db subnets) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### PrivateLink VPC endpoint to Aurora
> As a **platform engineer**, I want **privatelink vpc endpoint to aurora**.

`P1 · Pending · Source: RFC-INFRA-001 §B.7 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can privateLink VPC endpoint to Aurora from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Global auth plane in primary region (cross-region replicas)
> As a **platform engineer**, I want **global auth plane in primary region (cross-region replicas)**.

`P2 · Pending · Source: RFC-INFRA-001 §B.7 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can global auth plane in primary region (cross-region replicas) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Route53 latency routing for app endpoints
> As a **platform engineer**, I want **route53 latency routing for app endpoints**.

`P2 · Pending · Source: RFC-INFRA-001 §B.7 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can route53 latency routing for app endpoints from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ACM certs per-region + us-east-1 wildcard for CloudFront
> As a **platform engineer**, I want **acm certs per-region + us-east-1 wildcard for cloudfront**.

`P1 · Pending · Source: RFC-INFRA-001 §B.4 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can aCM certs per-region + us-east-1 wildcard for CloudFront from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Networking & Service Mesh

### AWS VPC CNI + Cilium chaining
> As a **platform engineer**, I want **aws vpc cni + cilium chaining**.

`P1 · Pending · Source: RFC-INFRA-001 §C.4 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can aWS VPC CNI + Cilium chaining from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Cilium Service Mesh (mTLS via SPIFFE)
> As a **platform engineer**, I want **cilium service mesh (mtls via spiffe)**.

`P1 · Pending · Source: RFC-INFRA-001 §C.4 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can cilium Service Mesh (mTLS via SPIFFE) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Hubble flow logs
> As a **platform engineer**, I want **hubble flow logs**.

`P2 · Pending · Source: RFC-INFRA-001 §C.4 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can hubble flow logs from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Default-deny NetworkPolicy per namespace
> As a **platform engineer**, I want **default-deny networkpolicy per namespace**.

`P1 · Pending · Source: RFC-INFRA-001 §C.4 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can default-deny NetworkPolicy per namespace from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### L7 path-aware policies (per-service allow-list)
> As a **platform engineer**, I want **l7 path-aware policies (per-service allow-list)**.

`P1 · Pending · Source: RFC-INFRA-001 §C.4 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can l7 path-aware policies (per-service allow-list) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### FQDN egress allowlist (Cilium FQDN policy)
> As a **platform engineer**, I want **fqdn egress allowlist (cilium fqdn policy)**.

`P2 · Pending · Source: RFC-INFRA-001 §C.4 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can fQDN egress allowlist (Cilium FQDN policy) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### L7 tenant header continuity validation
> As a **platform engineer**, I want **l7 tenant header continuity validation**.

`P1 · Pending · Source: RFC-INFRA-001 §C.5 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can l7 tenant header continuity validation from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Per-tenant rate limits (Envoy ratelimit service)
> As a **platform engineer**, I want **per-tenant rate limits (envoy ratelimit service)**.

`P2 · Pending · Source: RFC-INFRA-001 §C.5 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can per-tenant rate limits (Envoy ratelimit service) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Observability Stack

### Prometheus (in-cluster + AMP remote-write)
> As a **platform engineer**, I want **prometheus (in-cluster + amp remote-write)**.

`P1 · Pending · Source: RFC-INFRA-001 §C.6 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can prometheus (in-cluster + AMP remote-write) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Loki with S3 backend (90d hot / 1y archive)
> As a **platform engineer**, I want **loki with s3 backend (90d hot / 1y archive)**.

`P1 · Pending · Source: RFC-INFRA-001 §C.6 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can loki with S3 backend (90d hot / 1y archive) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Tempo with S3 backend (30d, tail-based sampling)
> As a **platform engineer**, I want **tempo with s3 backend (30d, tail-based sampling)**.

`P1 · Pending · Source: RFC-INFRA-001 §C.6 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can tempo with S3 backend (30d, tail-based sampling) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Grafana dashboards via GitOps ConfigMap
> As a **platform engineer**, I want **grafana dashboards via gitops configmap**.

`P1 · Pending · Source: RFC-INFRA-001 §C.6 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can grafana dashboards via GitOps ConfigMap from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### RED/USE dashboards per service
> As a **platform engineer**, I want **red/use dashboards per service**.

`P2 · Pending · Source: RFC-INFRA-001 §C.6 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can rED/USE dashboards per service from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Business KPI dashboards (admissions/hr, lab TAT)
> As a **platform engineer**, I want **business kpi dashboards (admissions/hr, lab tat)**.

`P2 · Pending · Source: RFC-INFRA-001 §C.6 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can business KPI dashboards (admissions/hr, lab TAT) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Alertmanager → PagerDuty (sev1/2) + Slack (sev3)
> As a **platform engineer**, I want **alertmanager → pagerduty (sev1/2) + slack (sev3)**.

`P1 · Pending · Source: RFC-INFRA-001 §C.6 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can alertmanager → PagerDuty (sev1/2) + Slack (sev3) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### OpenTelemetry Collector (DaemonSet + Deployment)
> As a **platform engineer**, I want **opentelemetry collector (daemonset + deployment)**.

`P1 · Pending · Source: RFC-INFRA-001 §C.6 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can openTelemetry Collector (DaemonSet + Deployment) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### tracing-opentelemetry in Rust app
> As a **platform engineer**, I want **tracing-opentelemetry in rust app**.

`P1 · Pending · Source: RFC-INFRA-001 §C.6 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can tracing-opentelemetry in Rust app from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Per-Tenant Isolation (runtime)

### Tenant onboarding via INSERT (no terraform apply)
> As a **platform engineer**, I want **tenant onboarding via insert (no terraform apply)**.

`P1 · Pending · Source: RFC-INFRA-001 §B.8 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can tenant onboarding via INSERT (no terraform apply) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### medbrains-tenant-operator (Rust controller)
> As a **platform engineer**, I want **medbrains-tenant-operator (rust controller)**.

`P2 · Pending · Source: RFC-INFRA-001 §B.8 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can medbrains-tenant-operator (Rust controller) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Per-tenant Kyverno PolicyException via ApplicationSet
> As a **platform engineer**, I want **per-tenant kyverno policyexception via applicationset**.

`P2 · Pending · Source: RFC-INFRA-001 §B.8 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can per-tenant Kyverno PolicyException via ApplicationSet from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Per-tenant edge-node CA cert issuance
> As a **platform engineer**, I want **per-tenant edge-node ca cert issuance**.

`P2 · Pending · Source: RFC-INFRA-001 §B.8 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can per-tenant edge-node CA cert issuance from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Per-tenant CloudWatch log group
> As a **platform engineer**, I want **per-tenant cloudwatch log group**.

`P3 · Pending · Source: RFC-INFRA-001 §B.8 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can per-tenant CloudWatch log group from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Performance

### Performance profiling — slow API endpoint detection (>1s response time alerts)
> As a **platform engineer**, I want **performance profiling — slow api endpoint detection (>1s response time alerts)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can performance profiling — slow API endpoint detection (>1s response time alerts) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Database query profiling — identify N+1 queries, slow joins, missing indexes
> As a **platform engineer**, I want **database query profiling — identify n+1 queries, slow joins, missing indexes**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can database query profiling — identify N+1 queries, slow joins, missing indexes from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Pipeline

### ✅ CI pipeline — lint (clippy + Biome) → test → build → security scan on every PR
> As a **platform engineer**, I want **ci pipeline — lint (clippy + biome) → test → build → security scan on every pr**.

`Done · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [x] The platform engineer can cI pipeline — lint (clippy + Biome) → test → build → security scan on every PR from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### CD pipeline — auto-deploy to staging on merge, manual promote to production
> As a **platform engineer**, I want **cd pipeline — auto-deploy to staging on merge, manual promote to production**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can cD pipeline — auto-deploy to staging on merge, manual promote to production from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Database migration check in CI (ensure migrations are reversible)
> As a **platform engineer**, I want **database migration check in ci (ensure migrations are reversible)**.

`Done · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [x] The platform engineer can database migration check in CI (ensure migrations are reversible) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Container image scanning (Trivy / Grype) for CVE detection
> As a **platform engineer**, I want **container image scanning (trivy / grype) for cve detection**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can container image scanning (Trivy / Grype) for CVE detection from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Dependency audit (cargo audit + pnpm audit) in CI
> As a **platform engineer**, I want **dependency audit (cargo audit + pnpm audit) in ci**.

`Done · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [x] The platform engineer can dependency audit (cargo audit + pnpm audit) in CI from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### E2E test suite in CI (Playwright for web, Detox for mobile)
> As a **platform engineer**, I want **e2e test suite in ci (playwright for web, detox for mobile)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can e2E test suite in CI (Playwright for web, Detox for mobile) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Build artifact versioning (semantic versioning with git SHA)
> As a **platform engineer**, I want **build artifact versioning (semantic versioning with git sha)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can build artifact versioning (semantic versioning with git SHA) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## PostgreSQL

### ✅ PostgreSQL 16+ with Row-Level Security (RLS) per tenant
> As a **platform engineer**, I want **postgresql 16+ with row-level security (rls) per tenant**.

`Done · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [x] The platform engineer can postgreSQL 16+ with Row-Level Security (RLS) per tenant from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Connection pooling (PgBouncer / built-in) — min 100 concurrent connections
> As a **platform engineer**, I want **connection pooling (pgbouncer / built-in) — min 100 concurrent connections**.

`Done · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [x] The platform engineer can connection pooling (PgBouncer / built-in) — min 100 concurrent connections from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Read replicas for reporting queries (async replication)
> As a **platform engineer**, I want **read replicas for reporting queries (async replication)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can read replicas for reporting queries (async replication) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Automatic failover (Patroni / pg_auto_failover)
> As a **platform engineer**, I want **automatic failover (patroni / pg_auto_failover)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can automatic failover (Patroni / pg_auto_failover) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Point-in-time recovery (WAL archiving to S3/MinIO)
> As a **platform engineer**, I want **point-in-time recovery (wal archiving to s3/minio)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can point-in-time recovery (WAL archiving to S3/MinIO) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Database migration system (SQLx embedded migrations with version tracking)
> As a **platform engineer**, I want **database migration system (sqlx embedded migrations with version tracking)**.

`Done · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [x] The platform engineer can database migration system (SQLx embedded migrations with version tracking) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Query performance monitoring (pg_stat_statements, slow query logging)
> As a **platform engineer**, I want **query performance monitoring (pg_stat_statements, slow query logging)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can query performance monitoring (pg_stat_statements, slow query logging) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Automated vacuum and index maintenance scheduling
> As a **platform engineer**, I want **automated vacuum and index maintenance scheduling**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can automated vacuum and index maintenance scheduling from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Database encryption at rest (LUKS / cloud-managed encryption)
> As a **platform engineer**, I want **database encryption at rest (luks / cloud-managed encryption)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can database encryption at rest (LUKS / cloud-managed encryption) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Push

### Push notification service (FCM for Android, APNS for iOS)
> As a **platform engineer**, I want **push notification service (fcm for android, apns for ios)**.

`Pending · Platforms: Mobile · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can push notification service (FCM for Android, APNS for iOS) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Push notification template management with scheduling
> As a **platform engineer**, I want **push notification template management with scheduling**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can push notification template management with scheduling from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Redis/Dragonfly

### Redis / Dragonfly cache layer for session, rate-limit, and hot data
> As a **platform engineer**, I want **redis / dragonfly cache layer for session, rate-limit, and hot data**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can redis / Dragonfly cache layer for session, rate-limit, and hot data from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Cache invalidation strategy (TTL + event-driven purge on data change)
> As a **platform engineer**, I want **cache invalidation strategy (ttl + event-driven purge on data change)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can cache invalidation strategy (TTL + event-driven purge on data change) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Distributed rate limiting per API endpoint per tenant
> As a **platform engineer**, I want **distributed rate limiting per api endpoint per tenant**.

`Partial · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can distributed rate limiting per API endpoint per tenant from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Cache warming on service startup (drug master, test master, config)
> As a **platform engineer**, I want **cache warming on service startup (drug master, test master, config)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can cache warming on service startup (drug master, test master, config) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Retention

### Log retention policy — 90 days hot, 1 year cold, 7 years archive for compliance
> As a **platform engineer**, I want **log retention policy — 90 days hot, 1 year cold, 7 years archive for compliance**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can log retention policy — 90 days hot, 1 year cold, 7 years archive for compliance from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## S3/MinIO

### S3-compatible object storage (MinIO / AWS S3) for medical documents, images, reports
> As a **platform engineer**, I want **s3-compatible object storage (minio / aws s3) for medical documents, images, reports**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can s3-compatible object storage (MinIO / AWS S3) for medical documents, images, reports from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Per-tenant storage isolation (bucket per tenant or prefix-based)
> As a **platform engineer**, I want **per-tenant storage isolation (bucket per tenant or prefix-based)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can per-tenant storage isolation (bucket per tenant or prefix-based) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Signed URL generation for secure time-limited document access
> As a **platform engineer**, I want **signed url generation for secure time-limited document access**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can signed URL generation for secure time-limited document access from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### DICOM image storage integration (PACS → object storage)
> As a **platform engineer**, I want **dicom image storage integration (pacs → object storage)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can dICOM image storage integration (PACS → object storage) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Automatic file versioning (retain previous versions of updated documents)
> As a **platform engineer**, I want **automatic file versioning (retain previous versions of updated documents)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can automatic file versioning (retain previous versions of updated documents) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Storage lifecycle policy (move old files to cold storage after retention period)
> As a **platform engineer**, I want **storage lifecycle policy (move old files to cold storage after retention period)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can storage lifecycle policy (move old files to cold storage after retention period) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## SMS

### SMS gateway integration (Twilio / MSG91 / Kaleyra) with DLT template registration
> As a **platform engineer**, I want **sms gateway integration (twilio / msg91 / kaleyra) with dlt template registration**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can sMS gateway integration (Twilio / MSG91 / Kaleyra) with DLT template registration from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### SMS delivery status tracking and retry on failure
> As a **platform engineer**, I want **sms delivery status tracking and retry on failure**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can sMS delivery status tracking and retry on failure from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Scanning

### SAST (Static Application Security Testing) in CI — code vulnerability scanning
> As a **platform engineer**, I want **sast (static application security testing) in ci — code vulnerability scanning**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can sAST (Static Application Security Testing) in CI — code vulnerability scanning from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### DAST (Dynamic Application Security Testing) — runtime vulnerability scanning
> As a **platform engineer**, I want **dast (dynamic application security testing) — runtime vulnerability scanning**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can dAST (Dynamic Application Security Testing) — runtime vulnerability scanning from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Penetration testing schedule (quarterly VAPT with third-party vendor)
> As a **platform engineer**, I want **penetration testing schedule (quarterly vapt with third-party vendor)**.

`Pending · Platforms: Web · Source: RFC+MocDoc · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can penetration testing schedule (quarterly VAPT with third-party vendor) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Scheduler

### Cron-based job scheduler (tokio-cron / custom) for recurring tasks
> As a **platform engineer**, I want **cron-based job scheduler (tokio-cron / custom) for recurring tasks**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can cron-based job scheduler (tokio-cron / custom) for recurring tasks from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Nightly jobs — bed charge calculation, insurance policy expiry check, drug expiry alerts
> As a **platform engineer**, I want **nightly jobs — bed charge calculation, insurance policy expiry check, drug expiry alerts**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can nightly jobs — bed charge calculation, insurance policy expiry check, drug expiry alerts from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Report generation scheduler (daily MIS, weekly compliance, monthly finance)
> As a **platform engineer**, I want **report generation scheduler (daily mis, weekly compliance, monthly finance)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can report generation scheduler (daily MIS, weekly compliance, monthly finance) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Job execution history with success/failure tracking and retry management
> As a **platform engineer**, I want **job execution history with success/failure tracking and retry management**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can job execution history with success/failure tracking and retry management from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Data archival job (move records older than retention period to archive schema)
> As a **platform engineer**, I want **data archival job (move records older than retention period to archive schema)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can data archival job (move records older than retention period to archive schema) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Secrets

### Secrets management vault (HashiCorp Vault / AWS Secrets Manager — DB creds, API keys)
> As a **platform engineer**, I want **secrets management vault (hashicorp vault / aws secrets manager — db creds, api keys)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can secrets management vault (HashiCorp Vault / AWS Secrets Manager — DB creds, API keys) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Auto-rotation of database passwords and API keys
> As a **platform engineer**, I want **auto-rotation of database passwords and api keys**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can auto-rotation of database passwords and API keys from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Secrets Management

### AWS Secrets Manager as source of truth
> As a **platform engineer**, I want **aws secrets manager as source of truth**.

`P1 · Pending · Source: RFC-INFRA-001 §B.6 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can aWS Secrets Manager as source of truth from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### External Secrets Operator (ESO) on EKS
> As a **platform engineer**, I want **external secrets operator (eso) on eks**.

`P1 · Pending · Source: RFC-INFRA-001 §B.6 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can external Secrets Operator (ESO) on EKS from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Per-region ClusterSecretStore with IRSA
> As a **platform engineer**, I want **per-region clustersecretstore with irsa**.

`P1 · Pending · Source: RFC-INFRA-001 §B.6 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can per-region ClusterSecretStore with IRSA from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Rotation lambdas for DB creds
> As a **platform engineer**, I want **rotation lambdas for db creds**.

`P2 · Pending · Source: RFC-INFRA-001 §B.6 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can rotation lambdas for DB creds from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### KMS envelope encryption for all secrets at rest
> As a **platform engineer**, I want **kms envelope encryption for all secrets at rest**.

`P1 · Pending · Source: RFC-INFRA-001 §B.6 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can kMS envelope encryption for all secrets at rest from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Security

### JWT token validation at gateway level (Ed25519 signature verification)
> As a **platform engineer**, I want **jwt token validation at gateway level (ed25519 signature verification)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can jWT token validation at gateway level (Ed25519 signature verification) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ CORS policy management per tenant/domain
> As a **platform engineer**, I want **cors policy management per tenant/domain**.

`Done · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [x] The platform engineer can cORS policy management per tenant/domain from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Request/response payload size limits and validation
> As a **platform engineer**, I want **request/response payload size limits and validation**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can request/response payload size limits and validation from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### IP whitelisting for admin APIs
> As a **platform engineer**, I want **ip whitelisting for admin apis**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can iP whitelisting for admin APIs from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Security & Compliance

### Pod Security Admission — restricted profile
> As a **platform engineer**, I want **pod security admission — restricted profile**.

`P1 · Pending · Source: RFC-INFRA-001 §C.5 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can pod Security Admission — restricted profile from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Cosign image signing in CI
> As a **platform engineer**, I want **cosign image signing in ci**.

`P1 · Pending · Source: RFC-INFRA-001 §C.5 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can cosign image signing in CI from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Kyverno verifyImages admission policy
> As a **platform engineer**, I want **kyverno verifyimages admission policy**.

`P1 · Pending · Source: RFC-INFRA-001 §C.5 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can kyverno verifyImages admission policy from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### IRSA per ServiceAccount (zero static AWS creds)
> As a **platform engineer**, I want **irsa per serviceaccount (zero static aws creds)**.

`P1 · Pending · Source: RFC-INFRA-001 §C.5 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can iRSA per ServiceAccount (zero static AWS creds) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### KMS at rest (EBS, Aurora, S3, Secrets Manager)
> As a **platform engineer**, I want **kms at rest (ebs, aurora, s3, secrets manager)**.

`P1 · Pending · Source: RFC-INFRA-001 §C.5 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can kMS at rest (EBS, Aurora, S3, Secrets Manager) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### EKS audit logs to CloudWatch + Loki forwarding
> As a **platform engineer**, I want **eks audit logs to cloudwatch + loki forwarding**.

`P1 · Pending · Source: RFC-INFRA-001 §C.5 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can eKS audit logs to CloudWatch + Loki forwarding from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### TLS 1.3 minimum at ALB (HIPAA/DPDP)
> As a **platform engineer**, I want **tls 1.3 minimum at alb (hipaa/dpdp)**.

`P1 · Pending · Source: RFC-INFRA-001 §C.5 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can tLS 1.3 minimum at ALB (HIPAA/DPDP) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Single-Command Deploy

### make deploy ENV=prod REGION=ap-south-1
> As a **platform engineer**, I want **make deploy env=prod region=ap-south-1**.

`P1 · Pending · Source: RFC-INFRA-001 §B.3 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can make deploy ENV=prod REGION=ap-south-1 from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### make deploy-all ENV=prod (parallel multi-region)
> As a **platform engineer**, I want **make deploy-all env=prod (parallel multi-region)**.

`P2 · Pending · Source: RFC-INFRA-001 §B.3 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can make deploy-all ENV=prod (parallel multi-region) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### make plan / make destroy with ENV gating
> As a **platform engineer**, I want **make plan / make destroy with env gating**.

`P1 · Pending · Source: RFC-INFRA-001 §B.3 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can make plan / make destroy with ENV gating from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### CI workflow running terragrunt run-all plan on PRs
> As a **platform engineer**, I want **ci workflow running terragrunt run-all plan on prs**.

`P2 · Pending · Source: RFC-INFRA-001 §B.3 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can cI workflow running terragrunt run-all plan on PRs from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## State Management

### Per-region S3 bucket for tfstate (DPDP residency)
> As a **platform engineer**, I want **per-region s3 bucket for tfstate (dpdp residency)**.

`P1 · Pending · Source: RFC-INFRA-001 §B.5 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can per-region S3 bucket for tfstate (DPDP residency) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Per-region DynamoDB lock table
> As a **platform engineer**, I want **per-region dynamodb lock table**.

`P1 · Pending · Source: RFC-INFRA-001 §B.5 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can per-region DynamoDB lock table from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Cross-stack reads via terraform_remote_state
> As a **platform engineer**, I want **cross-stack reads via terraform_remote_state**.

`P1 · Pending · Source: RFC-INFRA-001 §B.5 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can cross-stack reads via terraform_remote_state from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### State encryption with per-region KMS CMK
> As a **platform engineer**, I want **state encryption with per-region kms cmk**.

`P1 · Pending · Source: RFC-INFRA-001 §B.5 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can state encryption with per-region KMS CMK from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Strategy

### ✅ Automated daily full backup + hourly incremental (PostgreSQL WAL + object storage snapshots)
> As a **platform engineer**, I want **automated daily full backup + hourly incremental (postgresql wal + object storage snapshots)**.

`Done · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [x] The platform engineer can automated daily full backup + hourly incremental (PostgreSQL WAL + object storage snapshots) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Cross-region backup replication (at least 2 geographic locations)
> As a **platform engineer**, I want **cross-region backup replication (at least 2 geographic locations)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can cross-region backup replication (at least 2 geographic locations) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Backup encryption (AES-256) at rest and during transfer
> As a **platform engineer**, I want **backup encryption (aes-256) at rest and during transfer**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can backup encryption (AES-256) at rest and during transfer from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Backup retention policy — 30 days daily, 12 months monthly, 7 years annual
> As a **platform engineer**, I want **backup retention policy — 30 days daily, 12 months monthly, 7 years annual**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can backup retention policy — 30 days daily, 12 months monthly, 7 years annual from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Structured

### ✅ Structured JSON logging (tracing crate) with request_id, tenant_id, user_id in every log
> As a **platform engineer**, I want **structured json logging (tracing crate) with request_id, tenant_id, user_id in every log**.

`Done · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [x] The platform engineer can structured JSON logging (tracing crate) with request_id, tenant_id, user_id in every log from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Sync Protocol

### WebSocket primary transport (wss://sync.<region>.medbrains.health)
> As a **platform engineer**, I want **websocket primary transport (wss://sync.<region>.medbrains.health)**.

`P1 · Pending · Platforms: Web, Mobile · Source: RFC-INFRA-001 §A.4 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can webSocket primary transport (wss://sync.<region>.medbrains.health) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### HTTP long-poll fallback for restrictive networks
> As a **platform engineer**, I want **http long-poll fallback for restrictive networks**.

`P2 · Pending · Platforms: Web, Mobile · Source: RFC-INFRA-001 §A.4 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can hTTP long-poll fallback for restrictive networks from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Protobuf SyncEnvelope wire format
> As a **platform engineer**, I want **protobuf syncenvelope wire format**.

`P1 · Pending · Platforms: Web, Mobile · Source: RFC-INFRA-001 §A.4 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can protobuf SyncEnvelope wire format from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Version vector + delta sync with chunked CatchUp
> As a **platform engineer**, I want **version vector + delta sync with chunked catchup**.

`P1 · Pending · Platforms: Web, Mobile · Source: RFC-INFRA-001 §A.4 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can version vector + delta sync with chunked CatchUp from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Backpressure via credit window (64 frames)
> As a **platform engineer**, I want **backpressure via credit window (64 frames)**.

`P2 · Pending · Platforms: Web, Mobile · Source: RFC-INFRA-001 §A.4 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can backpressure via credit window (64 frames) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Per-device mTLS cert (per-tenant CA)
> As a **platform engineer**, I want **per-device mtls cert (per-tenant ca)**.

`P1 · Pending · Platforms: Web, Mobile · Source: RFC-INFRA-001 §A.8 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can per-device mTLS cert (per-tenant CA) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Replay protection via VV monotonicity
> As a **platform engineer**, I want **replay protection via vv monotonicity**.

`P1 · Pending · Platforms: Web, Mobile · Source: RFC-INFRA-001 §A.8 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can replay protection via VV monotonicity from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Terragrunt Layout

### Terragrunt wrapper over vanilla Terraform
> As a **platform engineer**, I want **terragrunt wrapper over vanilla terraform**.

`P1 · Pending · Source: RFC-INFRA-001 §B.1 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can terragrunt wrapper over vanilla Terraform from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Reusable TF modules (vpc/eks/aurora/kms/iam-irsa/s3/...)
> As a **platform engineer**, I want **reusable tf modules (vpc/eks/aurora/kms/iam-irsa/s3/...)**.

`P1 · Pending · Source: RFC-INFRA-001 §B.2 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can reusable TF modules (vpc/eks/aurora/kms/iam-irsa/s3/...) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### live/global/ stack (Route53, IAM org, ECR)
> As a **platform engineer**, I want **live/global/ stack (route53, iam org, ecr)**.

`P1 · Pending · Source: RFC-INFRA-001 §B.2 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can live/global/ stack (Route53, IAM org, ECR) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### live/regions/ap-south-1/ (primary, India)
> As a **platform engineer**, I want **live/regions/ap-south-1/ (primary, india)**.

`P1 · Pending · Source: RFC-INFRA-001 §B.2 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can live/regions/ap-south-1/ (primary, India) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### live/regions/ap-southeast-1/ (Singapore, V2)
> As a **platform engineer**, I want **live/regions/ap-southeast-1/ (singapore, v2)**.

`P3 · Pending · Source: RFC-INFRA-001 §B.2 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can live/regions/ap-southeast-1/ (Singapore, V2) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### live/regions/me-south-1/ (Bahrain, V3)
> As a **platform engineer**, I want **live/regions/me-south-1/ (bahrain, v3)**.

`P3 · Pending · Source: RFC-INFRA-001 §B.2 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can live/regions/me-south-1/ (Bahrain, V3) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Testing

### Automated backup restore testing (weekly verification on isolated environment)
> As a **platform engineer**, I want **automated backup restore testing (weekly verification on isolated environment)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can automated backup restore testing (weekly verification on isolated environment) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Tracing

### ✅ Distributed tracing (OpenTelemetry) — request trace across API → DB → cache → external service
> As a **platform engineer**, I want **distributed tracing (opentelemetry) — request trace across api → db → cache → external service**.

`Done · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [x] The platform engineer can distributed tracing (OpenTelemetry) — request trace across API → DB → cache → external service from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Tracking

### Error tracking service (Sentry) — capture panics, unhandled errors, JS exceptions
> As a **platform engineer**, I want **error tracking service (sentry) — capture panics, unhandled errors, js exceptions**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can error tracking service (Sentry) — capture panics, unhandled errors, JS exceptions from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Error grouping and deduplication with release-based regression detection
> As a **platform engineer**, I want **error grouping and deduplication with release-based regression detection**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can error grouping and deduplication with release-based regression detection from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Source map upload for frontend error stack traces
> As a **platform engineer**, I want **source map upload for frontend error stack traces**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can source map upload for frontend error stack traces from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Versioning

### API versioning strategy (URL path — /v1/, /v2/ — with deprecation lifecycle)
> As a **platform engineer**, I want **api versioning strategy (url path — /v1/, /v2/ — with deprecation lifecycle)**.

`Partial · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can aPI versioning strategy (URL path — /v1/, /v2/ — with deprecation lifecycle) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### OpenAPI / Swagger documentation auto-generated from routes
> As a **platform engineer**, I want **openapi / swagger documentation auto-generated from routes**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can openAPI / Swagger documentation auto-generated from routes from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Webhooks

### Outbound webhook system (configurable per tenant — fire on events to external URLs)
> As a **platform engineer**, I want **outbound webhook system (configurable per tenant — fire on events to external urls)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can outbound webhook system (configurable per tenant — fire on events to external URLs) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## WhatsApp

### WhatsApp Business API integration (template messages, session messages)
> As a **platform engineer**, I want **whatsapp business api integration (template messages, session messages)**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can whatsApp Business API integration (template messages, session messages) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### WhatsApp chatbot for appointment booking, report delivery, queue status
> As a **platform engineer**, I want **whatsapp chatbot for appointment booking, report delivery, queue status**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can whatsApp chatbot for appointment booking, report delivery, queue status from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Workload Placement

### medbrains-server (Axum) Deployment + HPA + PDB
> As a **platform engineer**, I want **medbrains-server (axum) deployment + hpa + pdb**.

`P1 · Pending · Source: RFC-INFRA-001 §C.3 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can medbrains-server (Axum) Deployment + HPA + PDB from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### medbrains-tenant-operator Deployment
> As a **platform engineer**, I want **medbrains-tenant-operator deployment**.

`P2 · Pending · Source: RFC-INFRA-001 §C.3 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can medbrains-tenant-operator Deployment from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Web frontend on S3 + CloudFront with OAC
> As a **platform engineer**, I want **web frontend on s3 + cloudfront with oac**.

`P1 · Pending · Platforms: Web · Source: RFC-INFRA-001 §C.3 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can web frontend on S3 + CloudFront with OAC from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### YottaDB StatefulSet (3 replicas, EBS gp3, anti-affinity)
> As a **platform engineer**, I want **yottadb statefulset (3 replicas, ebs gp3, anti-affinity)**.

`P1 · Pending · Source: RFC-INFRA-001 §C.3 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can yottaDB StatefulSet (3 replicas, EBS gp3, anti-affinity) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### NATS JetStream StatefulSet (3 replicas)
> As a **platform engineer**, I want **nats jetstream statefulset (3 replicas)**.

`P1 · Pending · Source: RFC-INFRA-001 §C.3 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can nATS JetStream StatefulSet (3 replicas) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Aurora PostgreSQL 16 (managed RDS, NOT in cluster)
> As a **platform engineer**, I want **aurora postgresql 16 (managed rds, not in cluster)**.

`P1 · Pending · Source: RFC-INFRA-001 §C.3 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can aurora PostgreSQL 16 (managed RDS, NOT in cluster) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ElastiCache Redis 7 (managed, NOT in cluster)
> As a **platform engineer**, I want **elasticache redis 7 (managed, not in cluster)**.

`P1 · Pending · Source: RFC-INFRA-001 §C.3 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can elastiCache Redis 7 (managed, NOT in cluster) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### MSK (Kafka) — V2 if event volume > 50k msg/s
> As a **platform engineer**, I want **msk (kafka) — v2 if event volume > 50k msg/s**.

`P3 · Pending · Source: RFC-INFRA-001 §C.3 · RFC: RFC-INFRA-001`

**Acceptance criteria**
- [ ] The platform engineer can mSK (Kafka) — V2 if event volume > 50k msg/s from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## YottaDB

### YottaDB for hierarchical config trees (^CONFIG global)
> As a **platform engineer**, I want **yottadb for hierarchical config trees (^config global)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can yottaDB for hierarchical config trees (^CONFIG global) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Atomic sequence generation (^SEQUENCE — UHID, invoice numbers)
> As a **platform engineer**, I want **atomic sequence generation (^sequence — uhid, invoice numbers)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can atomic sequence generation (^SEQUENCE — UHID, invoice numbers) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Real-time bed state management (^BEDSTATE global)
> As a **platform engineer**, I want **real-time bed state management (^bedstate global)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can real-time bed state management (^BEDSTATE global) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Session management with TTL-based expiry
> As a **platform engineer**, I want **session management with ttl-based expiry**.

`Pending · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The platform engineer can session management with TTL-based expiry from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ YottaDB REST API integration (HTTP client from Rust)
> As a **platform engineer**, I want **yottadb rest api integration (http client from rust)**.

`Done · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [x] The platform engineer can yottaDB REST API integration (HTTP client from Rust) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Multi-tenant isolation (RLS), observability (tracing), and graceful degradation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

