# IT, Security & Infrastructure — stories

_Auto-generated from `MedBrains_Features.xlsx` — every feature as a story with module-tailored acceptance criteria. 446 stories (✅ = Done). Source of truth is the xlsx; regenerate via `python3 scripts/generate_stories.py`._

## ABAC Monitoring

### Access denied events logged
> As a **system administrator**, I want **access denied events logged**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 E`

**Acceptance criteria**
- [ ] The system administrator can access denied events logged from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ ABAC policy change audit trail
> As a **system administrator**, I want **abac policy change audit trail**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-31 E`

**Acceptance criteria**
- [x] The system administrator can aBAC policy change audit trail from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Role assignment audit
> As a **system administrator**, I want **role assignment audit**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-31 E`

**Acceptance criteria**
- [x] The system administrator can role assignment audit from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Privilege escalation detection
> As a **system administrator**, I want **privilege escalation detection**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 E`

**Acceptance criteria**
- [ ] The system administrator can privilege escalation detection from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Segregation of duties monitoring (e.g., PO create vs PO approve)
> As a **system administrator**, I want **segregation of duties monitoring (e.g., po create vs po approve)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 E`

**Acceptance criteria**
- [ ] The system administrator can segregation of duties monitoring (e.g., PO create vs PO approve) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Time-based access compliance (vendor access expired but still active)
> As a **system administrator**, I want **time-based access compliance (vendor access expired but still active)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 E`

**Acceptance criteria**
- [ ] The system administrator can time-based access compliance (vendor access expired but still active) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### External user access monitoring (police, auditor, vendor — time-limited)
> As a **system administrator**, I want **external user access monitoring (police, auditor, vendor — time-limited)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 E`

**Acceptance criteria**
- [ ] The system administrator can external user access monitoring (police, auditor, vendor — time-limited) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## AI Analytics

### Natural language to SQL — 'show revenue by department last month' → generates PostgreSQL query via LLM
> As a **system administrator**, I want **natural language to sql — 'show revenue by department last month' → generates postgresql query via llm**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

**Acceptance criteria**
- [ ] The system administrator can natural language to SQL — 'show revenue by department last month' → generates PostgreSQL query via LLM from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### AI chart suggestion — given a dataset, AI recommends best chart type and column mapping
> As a **system administrator**, I want **ai chart suggestion — given a dataset, ai recommends best chart type and column mapping**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

**Acceptance criteria**
- [ ] The system administrator can aI chart suggestion — given a dataset, AI recommends best chart type and column mapping from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Anomaly detection — automatic alerting when KPIs deviate from historical patterns (spike/drop)
> As a **system administrator**, I want **anomaly detection — automatic alerting when kpis deviate from historical patterns (spike/drop)**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

**Acceptance criteria**
- [ ] The system administrator can anomaly detection — automatic alerting when KPIs deviate from historical patterns (spike/drop) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### AI-generated insights — auto-summarize dashboard ('ER volume up 23% vs last week, driven by...')
> As a **system administrator**, I want **ai-generated insights — auto-summarize dashboard ('er volume up 23% vs last week, driven by...')**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

**Acceptance criteria**
- [ ] The system administrator can aI-generated insights — auto-summarize dashboard ('ER volume up 23% vs last week, driven by...') from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Trend prediction — forecast next 30/60/90 days for key metrics using statistical models
> As a **system administrator**, I want **trend prediction — forecast next 30/60/90 days for key metrics using statistical models**.

`P2 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

**Acceptance criteria**
- [ ] The system administrator can trend prediction — forecast next 30/60/90 days for key metrics using statistical models from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Comparative analysis — AI compares periods, highlights statistically significant changes
> As a **system administrator**, I want **comparative analysis — ai compares periods, highlights statistically significant changes**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

**Acceptance criteria**
- [ ] The system administrator can comparative analysis — AI compares periods, highlights statistically significant changes from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Conversational analytics — chat interface to ask follow-up questions about displayed data
> As a **system administrator**, I want **conversational analytics — chat interface to ask follow-up questions about displayed data**.

`P2 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

**Acceptance criteria**
- [ ] The system administrator can conversational analytics — chat interface to ask follow-up questions about displayed data from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Root cause analysis — when anomaly detected, AI drills into sub-dimensions for contributing factors
> As a **system administrator**, I want **root cause analysis — when anomaly detected, ai drills into sub-dimensions for contributing factors**.

`P2 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

**Acceptance criteria**
- [ ] The system administrator can root cause analysis — when anomaly detected, AI drills into sub-dimensions for contributing factors from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## AI Auto-Configuration

### AI config generator — deterministic lookup from KB, pre-fills ~75% of device config (protocol, port, field mappings, transforms)
> As a **system administrator**, I want **ai config generator — deterministic lookup from kb, pre-fills ~75% of device config (protocol, port, field mappings, transforms)**.

`P0 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can aI config generator — deterministic lookup from KB, pre-fills ~75% of device config (protocol, port, field mappings, transforms) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Field mapping template engine — maps device output fields to MedBrains entity fields (e.g., OBX.5 → lab_results.value)
> As a **system administrator**, I want **field mapping template engine — maps device output fields to medbrains entity fields (e.g., obx.5 → lab_results.value)**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can field mapping template engine — maps device output fields to MedBrains entity fields (e.g., OBX.5 → lab_results.value) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Data transformation rules — unit conversions, code mappings, range normalization auto-applied per device model
> As a **system administrator**, I want **data transformation rules — unit conversions, code mappings, range normalization auto-applied per device model**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can data transformation rules — unit conversions, code mappings, range normalization auto-applied per device model from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### QC recommendation engine — suggests Westgard rules, critical value alerts based on device type and test catalog
> As a **system administrator**, I want **qc recommendation engine — suggests westgard rules, critical value alerts based on device type and test catalog**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can qC recommendation engine — suggests Westgard rules, critical value alerts based on device type and test catalog from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Confidence scoring — shows admin how much was auto-filled vs needs manual input (0.0-1.0 score)
> As a **system administrator**, I want **confidence scoring — shows admin how much was auto-filled vs needs manual input (0.0-1.0 score)**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can confidence scoring — shows admin how much was auto-filled vs needs manual input (0.0-1.0 score) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Config regeneration — re-run AI config when KB is updated or device firmware changes
> As a **system administrator**, I want **config regeneration — re-run ai config when kb is updated or device firmware changes**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can config regeneration — re-run AI config when KB is updated or device firmware changes from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Custom device onboarding — blank protocol template for unknown devices, saved back to KB for future use
> As a **system administrator**, I want **custom device onboarding — blank protocol template for unknown devices, saved back to kb for future use**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can custom device onboarding — blank protocol template for unknown devices, saved back to KB for future use from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Access Control

### ✅ RBAC (role-based access control)
> As a **system administrator**, I want **rbac (role-based access control)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-19/31`

**Acceptance criteria**
- [x] The system administrator can rBAC (role-based access control) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ABAC (attribute-based access control) per RFC §6.1
> As a **system administrator**, I want **abac (attribute-based access control) per rfc §6.1**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-19/31`

**Acceptance criteria**
- [ ] The system administrator can aBAC (attribute-based access control) per RFC §6.1 from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Data access lifetime (context-aware sessions)
> As a **system administrator**, I want **data access lifetime (context-aware sessions)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §6, CL-19/31`

**Acceptance criteria**
- [x] The system administrator can data access lifetime (context-aware sessions) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Break-glass emergency access with full audit trail
> As a **system administrator**, I want **break-glass emergency access with full audit trail**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-19/31`

**Acceptance criteria**
- [x] The system administrator can break-glass emergency access with full audit trail from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Field-level access control
> As a **system administrator**, I want **field-level access control**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-19/31`

**Acceptance criteria**
- [ ] The system administrator can field-level access control from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### IP address whitelisting
> As a **system administrator**, I want **ip address whitelisting**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-19/31`

**Acceptance criteria**
- [ ] The system administrator can iP address whitelisting from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Single-session enforcement
> As a **system administrator**, I want **single-session enforcement**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-19/31`

**Acceptance criteria**
- [x] The system administrator can single-session enforcement from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Multi-factor authentication (TOTP) — at minimum: admin, DBA, break-glass
> As a **system administrator**, I want **multi-factor authentication (totp) — at minimum: admin, dba, break-glass**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-19/31`

**Acceptance criteria**
- [ ] The system administrator can multi-factor authentication (TOTP) — at minimum: admin, DBA, break-glass from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Session timeout management (configurable per role)
> As a **system administrator**, I want **session timeout management (configurable per role)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-19/31`

**Acceptance criteria**
- [x] The system administrator can session timeout management (configurable per role) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Password policy enforcement (length, complexity, expiry, history)
> As a **system administrator**, I want **password policy enforcement (length, complexity, expiry, history)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-19/31`

**Acceptance criteria**
- [x] The system administrator can password policy enforcement (length, complexity, expiry, history) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Login audit trail
> As a **system administrator**, I want **login audit trail**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-19/31`

**Acceptance criteria**
- [x] The system administrator can login audit trail from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Failed login lockout with IP logging
> As a **system administrator**, I want **failed login lockout with ip logging**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-19/31`

**Acceptance criteria**
- [x] The system administrator can failed login lockout with IP logging from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Audit log (all operations) — IMMUTABLE, cannot be modified even by admin
> As a **system administrator**, I want **audit log (all operations) — immutable, cannot be modified even by admin**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-19/31`

**Acceptance criteria**
- [x] The system administrator can audit log (all operations) — IMMUTABLE, cannot be modified even by admin from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Tamper-evident audit chain (SHA-256)
> As a **system administrator**, I want **tamper-evident audit chain (sha-256)**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-19/31`

**Acceptance criteria**
- [ ] The system administrator can tamper-evident audit chain (SHA-256) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Break-glass review workflow
> As a **system administrator**, I want **break-glass review workflow**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-19/31`

**Acceptance criteria**
- [ ] The system administrator can break-glass review workflow from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Address-based conflict detection (staff vs patient)
> As a **system administrator**, I want **address-based conflict detection (staff vs patient)**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-19/31`

**Acceptance criteria**
- [ ] The system administrator can address-based conflict detection (staff vs patient) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Sensitive case escalation (HIV, psychiatry)
> As a **system administrator**, I want **sensitive case escalation (hiv, psychiatry)**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-19/31`

**Acceptance criteria**
- [ ] The system administrator can sensitive case escalation (HIV, psychiatry) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Data export control (print/export permissions)
> As a **system administrator**, I want **data export control (print/export permissions)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-19/31`

**Acceptance criteria**
- [x] The system administrator can data export control (print/export permissions) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Anonymized data access (students)
> As a **system administrator**, I want **anonymized data access (students)**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-19/31`

**Acceptance criteria**
- [ ] The system administrator can anonymized data access (students) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Psychiatric data isolation (separate encrypted partition per Rule PSY-001)
> As a **system administrator**, I want **psychiatric data isolation (separate encrypted partition per rule psy-001)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-19/31`

**Acceptance criteria**
- [x] The system administrator can psychiatric data isolation (separate encrypted partition per Rule PSY-001) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Concurrent session detection
> As a **system administrator**, I want **concurrent session detection**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-19/31`

**Acceptance criteria**
- [x] The system administrator can concurrent session detection from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### VPN requirement for remote access
> As a **system administrator**, I want **vpn requirement for remote access**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-19/31`

**Acceptance criteria**
- [ ] The system administrator can vPN requirement for remote access from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Access Logs

### ✅ Login/logout timestamp logging for every session
> As a **system administrator**, I want **login/logout timestamp logging for every session**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-31 B`

**Acceptance criteria**
- [x] The system administrator can login/logout timestamp logging for every session from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Failed login attempt logging with IP and lockout
> As a **system administrator**, I want **failed login attempt logging with ip and lockout**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-31 B`

**Acceptance criteria**
- [x] The system administrator can failed login attempt logging with IP and lockout from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Concurrent session detection (same user, multiple devices)
> As a **system administrator**, I want **concurrent session detection (same user, multiple devices)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-31 B`

**Acceptance criteria**
- [x] The system administrator can concurrent session detection (same user, multiple devices) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Session timeout logging
> As a **system administrator**, I want **session timeout logging**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-31 B`

**Acceptance criteria**
- [x] The system administrator can session timeout logging from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Password change/reset logging
> As a **system administrator**, I want **password change/reset logging**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-31 B`

**Acceptance criteria**
- [x] The system administrator can password change/reset logging from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Role change logging (who changed, old vs new, approver)
> As a **system administrator**, I want **role change logging (who changed, old vs new, approver)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 B`

**Acceptance criteria**
- [ ] The system administrator can role change logging (who changed, old vs new, approver) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ New user creation and deactivation logging
> As a **system administrator**, I want **new user creation and deactivation logging**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-31 B`

**Acceptance criteria**
- [x] The system administrator can new user creation and deactivation logging from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Access card/biometric provisioning logs
> As a **system administrator**, I want **access card/biometric provisioning logs**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 B`

**Acceptance criteria**
- [ ] The system administrator can access card/biometric provisioning logs from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Admin UI

### Device dashboard — connected/disconnected counts, message volume chart, recent errors, bridge agent status
> As a **system administrator**, I want **device dashboard — connected/disconnected counts, message volume chart, recent errors, bridge agent status**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can device dashboard — connected/disconnected counts, message volume chart, recent errors, bridge agent status from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Add Device wizard — 5-step: manufacturer → model → AI config review → network/credentials → test & save
> As a **system administrator**, I want **add device wizard — 5-step: manufacturer → model → ai config review → network/credentials → test & save**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can add Device wizard — 5-step: manufacturer → model → AI config review → network/credentials → test & save from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### AI config review step — pre-filled fields green, empty fields amber, field mapping visual editor
> As a **system administrator**, I want **ai config review step — pre-filled fields green, empty fields amber, field mapping visual editor**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can aI config review step — pre-filled fields green, empty fields amber, field mapping visual editor from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Device detail page — config view/edit, message log, connection status, health metrics, config history
> As a **system administrator**, I want **device detail page — config view/edit, message log, connection status, health metrics, config history**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can device detail page — config view/edit, message log, connection status, health metrics, config history from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Bridge agents page — list registered agents with status, version, device count, last heartbeat
> As a **system administrator**, I want **bridge agents page — list registered agents with status, version, device count, last heartbeat**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can bridge agents page — list registered agents with status, version, device count, last heartbeat from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Device catalog browser — searchable knowledge base of available device profiles
> As a **system administrator**, I want **device catalog browser — searchable knowledge base of available device profiles**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can device catalog browser — searchable knowledge base of available device profiles from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Aggregators

### MediBuddy / Practo / Lybrate appointment sync
> As a **system administrator**, I want **medibuddy / practo / lybrate appointment sync**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can mediBuddy / Practo / Lybrate appointment sync from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Karkinos oncology referral integration
> As a **system administrator**, I want **karkinos oncology referral integration**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can karkinos oncology referral integration from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Medall / SRL diagnostics lab integration
> As a **system administrator**, I want **medall / srl diagnostics lab integration**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can medall / SRL diagnostics lab integration from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Sufalam / InstaHealth data exchange
> As a **system administrator**, I want **sufalam / instahealth data exchange**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can sufalam / InstaHealth data exchange from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ABDM health locker — push/pull patient records
> As a **system administrator**, I want **abdm health locker — push/pull patient records**.

`Pending · Platforms: Web, Mobile · Source: MocDoc+RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can aBDM health locker — push/pull patient records from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Insurance TPA portal integration (pre-auth, claim status)
> As a **system administrator**, I want **insurance tpa portal integration (pre-auth, claim status)**.

`Pending · Platforms: Web · Source: MocDoc+RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can insurance TPA portal integration (pre-auth, claim status) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### International compliance adapters (AASANDHA/Maldives, VAT/Fiji)
> As a **system administrator**, I want **international compliance adapters (aasandha/maldives, vat/fiji)**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can international compliance adapters (AASANDHA/Maldives, VAT/Fiji) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Alert

### Warning before submitting critical orders on degraded connection
> As a **system administrator**, I want **warning before submitting critical orders on degraded connection**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can warning before submitting critical orders on degraded connection from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Alerts

### Auto-escalation on TAT breach (notify supervisor when SLA exceeded)
> As a **system administrator**, I want **auto-escalation on tat breach (notify supervisor when sla exceeded)**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can auto-escalation on TAT breach (notify supervisor when SLA exceeded) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Analytics

### ✅ Admin dashboard (hospital overview)
> As a **system administrator**, I want **admin dashboard (hospital overview)**.

`Done · Platforms: Web, Mobile · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [x] The system administrator can admin dashboard (hospital overview) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Revenue dashboard (daily/weekly/monthly)
> As a **system administrator**, I want **revenue dashboard (daily/weekly/monthly)**.

`Done · Platforms: Web, Mobile · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [x] The system administrator can revenue dashboard (daily/weekly/monthly) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Department-wise revenue analytics
> As a **system administrator**, I want **department-wise revenue analytics**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [ ] The system administrator can department-wise revenue analytics from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Doctor-wise revenue analytics
> As a **system administrator**, I want **doctor-wise revenue analytics**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [ ] The system administrator can doctor-wise revenue analytics from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ OPD footfall analytics
> As a **system administrator**, I want **opd footfall analytics**.

`Done · Platforms: Web · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [x] The system administrator can oPD footfall analytics from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### IPD census (admission/discharge/death)
> As a **system administrator**, I want **ipd census (admission/discharge/death)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [ ] The system administrator can iPD census (admission/discharge/death) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Bed occupancy dashboard
> As a **system administrator**, I want **bed occupancy dashboard**.

`Done · Platforms: Web, Mobile · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [x] The system administrator can bed occupancy dashboard from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Lab TAT analytics
> As a **system administrator**, I want **lab tat analytics**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [ ] The system administrator can lab TAT analytics from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Pharmacy sales analytics
> As a **system administrator**, I want **pharmacy sales analytics**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [ ] The system administrator can pharmacy sales analytics from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### OT utilization analytics
> As a **system administrator**, I want **ot utilization analytics**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [ ] The system administrator can oT utilization analytics from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Emergency department analytics
> As a **system administrator**, I want **emergency department analytics**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [ ] The system administrator can emergency department analytics from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Patient satisfaction dashboard
> As a **system administrator**, I want **patient satisfaction dashboard**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [ ] The system administrator can patient satisfaction dashboard from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Clinical indicators dashboard (mortality, infection rates)
> As a **system administrator**, I want **clinical indicators dashboard (mortality, infection rates)**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [ ] The system administrator can clinical indicators dashboard (mortality, infection rates) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### MIS report builder (custom reports)
> As a **system administrator**, I want **mis report builder (custom reports)**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [ ] The system administrator can mIS report builder (custom reports) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Export to Excel/PDF
> As a **system administrator**, I want **export to excel/pdf**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [ ] The system administrator can export to Excel/PDF from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Scheduled report delivery (email)
> As a **system administrator**, I want **scheduled report delivery (email)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [ ] The system administrator can scheduled report delivery (email) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Cross-timezone analytics
> As a **system administrator**, I want **cross-timezone analytics**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [ ] The system administrator can cross-timezone analytics from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Multi-location comparison analytics
> As a **system administrator**, I want **multi-location comparison analytics**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [ ] The system administrator can multi-location comparison analytics from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Population dashboard — disease prevalence, outcomes, cost per capita
> As a **system administrator**, I want **population dashboard — disease prevalence, outcomes, cost per capita**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can population dashboard — disease prevalence, outcomes, cost per capita from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### HEDIS/quality measure tracking (compliance rates per measure)
> As a **system administrator**, I want **hedis/quality measure tracking (compliance rates per measure)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can hEDIS/quality measure tracking (compliance rates per measure) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Cohort builder — dynamic patient groups by diagnosis, age, location, risk
> As a **system administrator**, I want **cohort builder — dynamic patient groups by diagnosis, age, location, risk**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can cohort builder — dynamic patient groups by diagnosis, age, location, risk from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### SDOH impact analytics — correlation between social factors and readmission/outcomes
> As a **system administrator**, I want **sdoh impact analytics — correlation between social factors and readmission/outcomes**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can sDOH impact analytics — correlation between social factors and readmission/outcomes from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Real-time KPI tiles (ALOS, mortality, infection rate, patient satisfaction)
> As a **system administrator**, I want **real-time kpi tiles (alos, mortality, infection rate, patient satisfaction)**.

`Partial · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can real-time KPI tiles (ALOS, mortality, infection rate, patient satisfaction) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Campaign ROI analytics (cost per acquisition, conversion rate, revenue generated)
> As a **system administrator**, I want **campaign roi analytics (cost per acquisition, conversion rate, revenue generated)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can campaign ROI analytics (cost per acquisition, conversion rate, revenue generated) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Audit Trail

### Every data CREATE logged (who, what, when, IP/device)
> As a **system administrator**, I want **every data create logged (who, what, when, ip/device)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 A`

**Acceptance criteria**
- [ ] The system administrator can every data CREATE logged (who, what, when, IP/device) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Every data READ/VIEW logged (who viewed which patient record)
> As a **system administrator**, I want **every data read/view logged (who viewed which patient record)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 A`

**Acceptance criteria**
- [ ] The system administrator can every data READ/VIEW logged (who viewed which patient record) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Every data UPDATE logged (old value vs new value, timestamp)
> As a **system administrator**, I want **every data update logged (old value vs new value, timestamp)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 A`

**Acceptance criteria**
- [ ] The system administrator can every data UPDATE logged (old value vs new value, timestamp) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Every data DELETE logged (soft-delete only, confirm deletion not allowed)
> As a **system administrator**, I want **every data delete logged (soft-delete only, confirm deletion not allowed)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 A`

**Acceptance criteria**
- [ ] The system administrator can every data DELETE logged (soft-delete only, confirm deletion not allowed) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Audit log is IMMUTABLE — cannot be modified/deleted even by DBA
> As a **system administrator**, I want **audit log is immutable — cannot be modified/deleted even by dba**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-31 A`

**Acceptance criteria**
- [x] The system administrator can audit log is IMMUTABLE — cannot be modified/deleted even by DBA from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Audit log stored separately from application database (tamper-proof)
> As a **system administrator**, I want **audit log stored separately from application database (tamper-proof)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-31 A`

**Acceptance criteria**
- [x] The system administrator can audit log stored separately from application database (tamper-proof) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Audit log includes: User ID, Role, IP, Device, Timestamp (ms), Module, Action, Record ID, Before/After
> As a **system administrator**, I want **audit log includes: user id, role, ip, device, timestamp (ms), module, action, record id, before/after**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-31 A`

**Acceptance criteria**
- [x] The system administrator can audit log includes: User ID, Role, IP, Device, Timestamp (ms), Module, Action, Record ID, Before/After from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Audit log retention: minimum 7 years for healthcare
> As a **system administrator**, I want **audit log retention: minimum 7 years for healthcare**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-31 A`

**Acceptance criteria**
- [x] The system administrator can audit log retention: minimum 7 years for healthcare from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Audit log search/filter (by user, date, module, action, patient ID)
> As a **system administrator**, I want **audit log search/filter (by user, date, module, action, patient id)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-31 A`

**Acceptance criteria**
- [x] The system administrator can audit log search/filter (by user, date, module, action, patient ID) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Audit log export for legal/compliance/forensics (CSV/PDF)
> As a **system administrator**, I want **audit log export for legal/compliance/forensics (csv/pdf)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-31 A`

**Acceptance criteria**
- [x] The system administrator can audit log export for legal/compliance/forensics (CSV/PDF) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Booking

### Google Reserve / Google Maps appointment booking integration
> As a **system administrator**, I want **google reserve / google maps appointment booking integration**.

`Pending · Platforms: Web, Mobile · Source: iElixir+Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can google Reserve / Google Maps appointment booking integration from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Practo / Lybrate / DocPrime profile sync (availability, fees)
> As a **system administrator**, I want **practo / lybrate / docprime profile sync (availability, fees)**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can practo / Lybrate / DocPrime profile sync (availability, fees) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Break-Glass

### Break-glass access fully logged (who, reason, duration, data accessed)
> As a **system administrator**, I want **break-glass access fully logged (who, reason, duration, data accessed)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 D`

**Acceptance criteria**
- [ ] The system administrator can break-glass access fully logged (who, reason, duration, data accessed) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Auto-notification to data owner, HOD, IT Security, Medical Superintendent
> As a **system administrator**, I want **auto-notification to data owner, hod, it security, medical superintendent**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 D`

**Acceptance criteria**
- [ ] The system administrator can auto-notification to data owner, HOD, IT Security, Medical Superintendent from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Break-glass auto-expires after configurable time
> As a **system administrator**, I want **break-glass auto-expires after configurable time**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 D`

**Acceptance criteria**
- [ ] The system administrator can break-glass auto-expires after configurable time from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Post-break-glass review workflow
> As a **system administrator**, I want **post-break-glass review workflow**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 D`

**Acceptance criteria**
- [ ] The system administrator can post-break-glass review workflow from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Break-glass abuse detection (repeated triggers → alert)
> As a **system administrator**, I want **break-glass abuse detection (repeated triggers → alert)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 D`

**Acceptance criteria**
- [ ] The system administrator can break-glass abuse detection (repeated triggers → alert) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Break-glass monthly report for NABH audit
> As a **system administrator**, I want **break-glass monthly report for nabh audit**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 D`

**Acceptance criteria**
- [ ] The system administrator can break-glass monthly report for NABH audit from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Bridge Agent

### Single Rust binary with feature flags — compile with --features hl7,astm,dicom,serial,rest,mqtt as needed
> As a **system administrator**, I want **single rust binary with feature flags — compile with --features hl7,astm,dicom,serial,rest,mqtt as needed**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can single Rust binary with feature flags — compile with --features hl7,astm,dicom,serial,rest,mqtt as needed from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### On-premise deployment mode — installed near serial/USB devices, communicates to MedBrains API over HTTPS
> As a **system administrator**, I want **on-premise deployment mode — installed near serial/usb devices, communicates to medbrains api over https**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can on-premise deployment mode — installed near serial/USB devices, communicates to MedBrains API over HTTPS from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Cloud sidecar mode — runs as container alongside MedBrains for network-accessible devices
> As a **system administrator**, I want **cloud sidecar mode — runs as container alongside medbrains for network-accessible devices**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can cloud sidecar mode — runs as container alongside MedBrains for network-accessible devices from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Agent registration — self-registers with MedBrains API using pre-provisioned API key
> As a **system administrator**, I want **agent registration — self-registers with medbrains api using pre-provisioned api key**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can agent registration — self-registers with MedBrains API using pre-provisioned API key from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Heartbeat — 30-second heartbeat with device counts, message volume, buffer depth, memory usage
> As a **system administrator**, I want **heartbeat — 30-second heartbeat with device counts, message volume, buffer depth, memory usage**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can heartbeat — 30-second heartbeat with device counts, message volume, buffer depth, memory usage from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Config polling — polls MedBrains API for updated device configs (fallback when NATS unavailable)
> As a **system administrator**, I want **config polling — polls medbrains api for updated device configs (fallback when nats unavailable)**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can config polling — polls MedBrains API for updated device configs (fallback when NATS unavailable) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### SQLite offline buffer — stores messages locally when MedBrains API unreachable, drains FIFO on reconnect
> As a **system administrator**, I want **sqlite offline buffer — stores messages locally when medbrains api unreachable, drains fifo on reconnect**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can sQLite offline buffer — stores messages locally when MedBrains API unreachable, drains FIFO on reconnect from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Exponential backoff retry — failed API deliveries retried 1s→2s→4s→...→5min, max 100 retries
> As a **system administrator**, I want **exponential backoff retry — failed api deliveries retried 1s→2s→4s→...→5min, max 100 retries**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can exponential backoff retry — failed API deliveries retried 1s→2s→4s→...→5min, max 100 retries from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Multi-device multiplexing — single bridge handles multiple devices concurrently
> As a **system administrator**, I want **multi-device multiplexing — single bridge handles multiple devices concurrently**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can multi-device multiplexing — single bridge handles multiple devices concurrently from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## CERT-In

### CERT-In incident reporting integration (6-hour mandatory reporting)
> As a **system administrator**, I want **cert-in incident reporting integration (6-hour mandatory reporting)**.

`Pending · Platforms: Web, Mobile · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can cERT-In incident reporting integration (6-hour mandatory reporting) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Vulnerability assessment scheduling and tracking
> As a **system administrator**, I want **vulnerability assessment scheduling and tracking**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can vulnerability assessment scheduling and tracking from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Security event log retention (180 days as per CERT-In)
> As a **system administrator**, I want **security event log retention (180 days as per cert-in)**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can security event log retention (180 days as per CERT-In) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### VAPT (Vulnerability Assessment & Penetration Testing) report dashboard
> As a **system administrator**, I want **vapt (vulnerability assessment & penetration testing) report dashboard**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can vAPT (Vulnerability Assessment & Penetration Testing) report dashboard from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ISO 27001 control mapping dashboard
> As a **system administrator**, I want **iso 27001 control mapping dashboard**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can iSO 27001 control mapping dashboard from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### HIPAA compliance checklist tracker
> As a **system administrator**, I want **hipaa compliance checklist tracker**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can hIPAA compliance checklist tracker from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### GDPR data subject request handling (right to erasure, portability)
> As a **system administrator**, I want **gdpr data subject request handling (right to erasure, portability)**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can gDPR data subject request handling (right to erasure, portability) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### SOC 2 Type II evidence collection automation
> As a **system administrator**, I want **soc 2 type ii evidence collection automation**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can sOC 2 Type II evidence collection automation from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Compliance dashboard — multi-standard view (NABH + HIPAA + ISO + CERT-In)
> As a **system administrator**, I want **compliance dashboard — multi-standard view (nabh + hipaa + iso + cert-in)**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can compliance dashboard — multi-standard view (NABH + HIPAA + ISO + CERT-In) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Caller Mgmt

### Patient CRM — unified caller profile (call history, preferences, complaints, satisfaction)
> As a **system administrator**, I want **patient crm — unified caller profile (call history, preferences, complaints, satisfaction)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can patient CRM — unified caller profile (call history, preferences, complaints, satisfaction) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Inbound call routing with caller identification and context display
> As a **system administrator**, I want **inbound call routing with caller identification and context display**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can inbound call routing with caller identification and context display from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Care Gaps

### Care gap identification (overdue screenings, vaccinations, follow-ups)
> As a **system administrator**, I want **care gap identification (overdue screenings, vaccinations, follow-ups)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can care gap identification (overdue screenings, vaccinations, follow-ups) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Automated outreach for care gaps (SMS/WhatsApp/email reminders)
> As a **system administrator**, I want **automated outreach for care gaps (sms/whatsapp/email reminders)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can automated outreach for care gaps (SMS/WhatsApp/email reminders) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Chart & Visualization

### Chart type picker — bar, line, area, pie, donut, scatter, heatmap, gauge, funnel, treemap, KPI card
> As a **system administrator**, I want **chart type picker — bar, line, area, pie, donut, scatter, heatmap, gauge, funnel, treemap, kpi card**.

`P1 · Pending · Platforms: Web, Mobile · Source: Superset · RFC: RFC-MODULE-analytics-builder`

**Acceptance criteria**
- [ ] The system administrator can chart type picker — bar, line, area, pie, donut, scatter, heatmap, gauge, funnel, treemap, KPI card from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Chart configurator — map data columns to axes, colors, sizes, tooltips with live preview
> As a **system administrator**, I want **chart configurator — map data columns to axes, colors, sizes, tooltips with live preview**.

`P1 · Pending · Platforms: Web · Source: Superset · RFC: RFC-MODULE-analytics-builder`

**Acceptance criteria**
- [ ] The system administrator can chart configurator — map data columns to axes, colors, sizes, tooltips with live preview from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Multi-series charts — overlay multiple measures on one chart (admissions + discharges + deaths)
> As a **system administrator**, I want **multi-series charts — overlay multiple measures on one chart (admissions + discharges + deaths)**.

`P1 · Pending · Platforms: Web · Source: Superset · RFC: RFC-MODULE-analytics-builder`

**Acceptance criteria**
- [ ] The system administrator can multi-series charts — overlay multiple measures on one chart (admissions + discharges + deaths) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Conditional formatting — color-code values by thresholds (red >85% occupancy, green <70%)
> As a **system administrator**, I want **conditional formatting — color-code values by thresholds (red >85% occupancy, green <70%)**.

`P1 · Pending · Platforms: Web · Source: Superset · RFC: RFC-MODULE-analytics-builder`

**Acceptance criteria**
- [ ] The system administrator can conditional formatting — color-code values by thresholds (red >85% occupancy, green <70%) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Drill-down — click chart segment to filter into sub-dimension (dept → doctor → patient)
> As a **system administrator**, I want **drill-down — click chart segment to filter into sub-dimension (dept → doctor → patient)**.

`P2 · Pending · Platforms: Web, Mobile · Source: Superset · RFC: RFC-MODULE-analytics-builder`

**Acceptance criteria**
- [ ] The system administrator can drill-down — click chart segment to filter into sub-dimension (dept → doctor → patient) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Cross-filtering — click on one chart filters all other charts on the same dashboard
> As a **system administrator**, I want **cross-filtering — click on one chart filters all other charts on the same dashboard**.

`P2 · Pending · Platforms: Web · Source: Superset · RFC: RFC-MODULE-analytics-builder`

**Acceptance criteria**
- [ ] The system administrator can cross-filtering — click on one chart filters all other charts on the same dashboard from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### KPI/Scorecard widget — big number + trend arrow + sparkline + comparison to target/previous period
> As a **system administrator**, I want **kpi/scorecard widget — big number + trend arrow + sparkline + comparison to target/previous period**.

`P1 · Pending · Platforms: Web, Mobile · Source: Superset · RFC: RFC-MODULE-analytics-builder`

**Acceptance criteria**
- [ ] The system administrator can kPI/Scorecard widget — big number + trend arrow + sparkline + comparison to target/previous period from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Pivot table widget — configurable rows/columns/values with subtotals and conditional formatting
> As a **system administrator**, I want **pivot table widget — configurable rows/columns/values with subtotals and conditional formatting**.

`P2 · Pending · Platforms: Web · Source: Superset · RFC: RFC-MODULE-analytics-builder`

**Acceptance criteria**
- [ ] The system administrator can pivot table widget — configurable rows/columns/values with subtotals and conditional formatting from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Clinical AI

### ✅ AI-assisted clinical coding (ICD-10, CPT suggestion from notes)
> As a **system administrator**, I want **ai-assisted clinical coding (icd-10, cpt suggestion from notes)**.

`Done · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The system administrator can aI-assisted clinical coding (ICD-10, CPT suggestion from notes) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### AI-generated discharge summary draft (from clinical notes, labs, meds)
> As a **system administrator**, I want **ai-generated discharge summary draft (from clinical notes, labs, meds)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can aI-generated discharge summary draft (from clinical notes, labs, meds) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### AI drug interaction checker (beyond standard — ML-based severity scoring)
> As a **system administrator**, I want **ai drug interaction checker (beyond standard — ml-based severity scoring)**.

`Pending · Platforms: Web, Mobile · Source: iElixir · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can aI drug interaction checker (beyond standard — ML-based severity scoring) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### AI-powered triage assistant (symptom → urgency classification)
> As a **system administrator**, I want **ai-powered triage assistant (symptom → urgency classification)**.

`Pending · Platforms: Web, Mobile · Source: Epic+iElixir · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can aI-powered triage assistant (symptom → urgency classification) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Clinical Access Monitor

### Patient record access log — which staff accessed which patient
> As a **system administrator**, I want **patient record access log — which staff accessed which patient**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 C`

**Acceptance criteria**
- [ ] The system administrator can patient record access log — which staff accessed which patient from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### VIP/celebrity patient access alerting (unusual access pattern)
> As a **system administrator**, I want **vip/celebrity patient access alerting (unusual access pattern)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 C`

**Acceptance criteria**
- [ ] The system administrator can vIP/celebrity patient access alerting (unusual access pattern) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Cross-department access tracking
> As a **system administrator**, I want **cross-department access tracking**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 C`

**Acceptance criteria**
- [ ] The system administrator can cross-department access tracking from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### After-hours access alerting
> As a **system administrator**, I want **after-hours access alerting**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 C`

**Acceptance criteria**
- [ ] The system administrator can after-hours access alerting from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Bulk data access detection (abnormal download volume)
> As a **system administrator**, I want **bulk data access detection (abnormal download volume)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 C`

**Acceptance criteria**
- [ ] The system administrator can bulk data access detection (abnormal download volume) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Psychiatric record access monitoring (Rule PSY-001)
> As a **system administrator**, I want **psychiatric record access monitoring (rule psy-001)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 C`

**Acceptance criteria**
- [ ] The system administrator can psychiatric record access monitoring (Rule PSY-001) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Substance abuse record access monitoring (Rule PSY-002)
> As a **system administrator**, I want **substance abuse record access monitoring (rule psy-002)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 C`

**Acceptance criteria**
- [ ] The system administrator can substance abuse record access monitoring (Rule PSY-002) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Counseling record access monitoring (Rule STU-002: ZERO visibility)
> As a **system administrator**, I want **counseling record access monitoring (rule stu-002: zero visibility)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 C`

**Acceptance criteria**
- [ ] The system administrator can counseling record access monitoring (Rule STU-002: ZERO visibility) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Print/export/download tracking
> As a **system administrator**, I want **print/export/download tracking**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 C`

**Acceptance criteria**
- [ ] The system administrator can print/export/download tracking from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Coding

### ✅ ICD-10/CPT coding accuracy monitoring (unspecified codes, missing codes)
> As a **system administrator**, I want **icd-10/cpt coding accuracy monitoring (unspecified codes, missing codes)**.

`Done · Platforms: Web, Mobile · Source: iElixir · RFC: §Ext`

**Acceptance criteria**
- [x] The system administrator can iCD-10/CPT coding accuracy monitoring (unspecified codes, missing codes) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Comparison

### Patient inflow rate comparison — period vs period (this month vs last month vs last year)
> As a **system administrator**, I want **patient inflow rate comparison — period vs period (this month vs last month vs last year)**.

`Pending · Platforms: Web · Source: iElixir+Bahmni · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can patient inflow rate comparison — period vs period (this month vs last month vs last year) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Department-wise patient volume trending (OPD, ER, Lab, Radiology)
> As a **system administrator**, I want **department-wise patient volume trending (opd, er, lab, radiology)**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can department-wise patient volume trending (OPD, ER, Lab, Radiology) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Doctor-wise patient load comparison
> As a **system administrator**, I want **doctor-wise patient load comparison**.

`Pending · Platforms: Web, Mobile · Source: iElixir · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can doctor-wise patient load comparison from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Completeness

### Data completeness dashboard — % of records with missing demographics, diagnosis, vitals
> As a **system administrator**, I want **data completeness dashboard — % of records with missing demographics, diagnosis, vitals**.

`Pending · Platforms: Web, Mobile · Source: iElixir+Bahmni · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can data completeness dashboard — % of records with missing demographics, diagnosis, vitals from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Mandatory field compliance tracking per department
> As a **system administrator**, I want **mandatory field compliance tracking per department**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can mandatory field compliance tracking per department from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Configuration

### ✅ Tenant management (create, configure, activate)
> As a **system administrator**, I want **tenant management (create, configure, activate)**.

`Done · Platforms: Web · Source: RFC · RFC: §2`

**Acceptance criteria**
- [x] The system administrator can tenant management (create, configure, activate) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ 7-layer config hierarchy (Global → Tenant → Campus → Building → Floor → Dept → User)
> As a **system administrator**, I want **7-layer config hierarchy (global → tenant → campus → building → floor → dept → user)**.

`Done · Platforms: Web · Source: RFC · RFC: §2`

**Acceptance criteria**
- [x] The system administrator can 7-layer config hierarchy (Global → Tenant → Campus → Building → Floor → Dept → User) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Module enablement (activate/deactivate per tenant)
> As a **system administrator**, I want **module enablement (activate/deactivate per tenant)**.

`Done · Platforms: Web · Source: RFC · RFC: §2`

**Acceptance criteria**
- [x] The system administrator can module enablement (activate/deactivate per tenant) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Department master
> As a **system administrator**, I want **department master**.

`Pending · Platforms: Web · Source: RFC · RFC: §2`

**Acceptance criteria**
- [ ] The system administrator can department master from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Designation/role master
> As a **system administrator**, I want **designation/role master**.

`Pending · Platforms: Web · Source: RFC · RFC: §2`

**Acceptance criteria**
- [ ] The system administrator can designation/role master from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ User management (create, assign role, assign department)
> As a **system administrator**, I want **user management (create, assign role, assign department)**.

`Done · Platforms: Web · Source: RFC · RFC: §2`

**Acceptance criteria**
- [x] The system administrator can user management (create, assign role, assign department) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Permission management (ABAC policy editor)
> As a **system administrator**, I want **permission management (abac policy editor)**.

`Done · Platforms: Web · Source: RFC · RFC: §2`

**Acceptance criteria**
- [x] The system administrator can permission management (ABAC policy editor) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Master file management (lab tests, drugs, services, rates)
> As a **system administrator**, I want **master file management (lab tests, drugs, services, rates)**.

`Pending · Platforms: Web · Source: RFC · RFC: §2`

**Acceptance criteria**
- [ ] The system administrator can master file management (lab tests, drugs, services, rates) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Form builder (dynamic form configuration)
> As a **system administrator**, I want **form builder (dynamic form configuration)**.

`Pending · Platforms: Web · Source: RFC · RFC: §2`

**Acceptance criteria**
- [ ] The system administrator can form builder (dynamic form configuration) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Template management (print templates, report templates)
> As a **system administrator**, I want **template management (print templates, report templates)**.

`Pending · Platforms: Web · Source: RFC · RFC: §2`

**Acceptance criteria**
- [ ] The system administrator can template management (print templates, report templates) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Numbering/sequence configuration (UHID, bill, lab report)
> As a **system administrator**, I want **numbering/sequence configuration (uhid, bill, lab report)**.

`Pending · Platforms: Web · Source: RFC · RFC: §2`

**Acceptance criteria**
- [ ] The system administrator can numbering/sequence configuration (UHID, bill, lab report) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### System settings (date format, currency, timezone)
> As a **system administrator**, I want **system settings (date format, currency, timezone)**.

`Partial · Platforms: Web · Source: RFC · RFC: §2`

**Acceptance criteria**
- [ ] The system administrator can system settings (date format, currency, timezone) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Audit log viewer
> As a **system administrator**, I want **audit log viewer**.

`Done · Platforms: Web · Source: RFC · RFC: §2`

**Acceptance criteria**
- [x] The system administrator can audit log viewer from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### System health dashboard
> As a **system administrator**, I want **system health dashboard**.

`Pending · Platforms: Web · Source: RFC · RFC: §2`

**Acceptance criteria**
- [ ] The system administrator can system health dashboard from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Backup management
> As a **system administrator**, I want **backup management**.

`Pending · Platforms: Web · Source: RFC · RFC: §2`

**Acceptance criteria**
- [ ] The system administrator can backup management from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Data export tools
> As a **system administrator**, I want **data export tools**.

`Pending · Platforms: Web · Source: RFC · RFC: §2`

**Acceptance criteria**
- [ ] The system administrator can data export tools from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Branding configuration (logo, colors, header/footer)
> As a **system administrator**, I want **branding configuration (logo, colors, header/footer)**.

`Pending · Platforms: Web · Source: RFC · RFC: §2`

**Acceptance criteria**
- [ ] The system administrator can branding configuration (logo, colors, header/footer) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Configurable incentive slabs (percentage-based, flat-rate, tiered)
> As a **system administrator**, I want **configurable incentive slabs (percentage-based, flat-rate, tiered)**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can configurable incentive slabs (percentage-based, flat-rate, tiered) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Doctor referral incentive tracking (internal + external)
> As a **system administrator**, I want **doctor referral incentive tracking (internal + external)**.

`Pending · Platforms: Web, Mobile · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can doctor referral incentive tracking (internal + external) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Target-based incentive calculation (monthly/quarterly)
> As a **system administrator**, I want **target-based incentive calculation (monthly/quarterly)**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can target-based incentive calculation (monthly/quarterly) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Department-wise incentive rules (surgery, lab, radiology)
> As a **system administrator**, I want **department-wise incentive rules (surgery, lab, radiology)**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can department-wise incentive rules (surgery, lab, radiology) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Incentive approval workflow (calculate → review → approve → disburse)
> As a **system administrator**, I want **incentive approval workflow (calculate → review → approve → disburse)**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can incentive approval workflow (calculate → review → approve → disburse) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Incentive statement generation (PDF for doctor)
> As a **system administrator**, I want **incentive statement generation (pdf for doctor)**.

`Pending · Platforms: Web, Mobile · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can incentive statement generation (PDF for doctor) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Integration with billing — auto-calculate from revenue
> As a **system administrator**, I want **integration with billing — auto-calculate from revenue**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can integration with billing — auto-calculate from revenue from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Audit trail for all incentive modifications
> As a **system administrator**, I want **audit trail for all incentive modifications**.

`Done · Platforms: Web · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [x] The system administrator can audit trail for all incentive modifications from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Coordination

### Discharge coordinator view — all patients pending discharge with blocker list
> As a **system administrator**, I want **discharge coordinator view — all patients pending discharge with blocker list**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can discharge coordinator view — all patients pending discharge with blocker list from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Environmental services tracking (bed cleaning status, room turnaround)
> As a **system administrator**, I want **environmental services tracking (bed cleaning status, room turnaround)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can environmental services tracking (bed cleaning status, room turnaround) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Transport management (patient transport requests, porter tracking)
> As a **system administrator**, I want **transport management (patient transport requests, porter tracking)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can transport management (patient transport requests, porter tracking) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Dashboard

### Unified TAT dashboard — all departments on one screen with deviation heat map
> As a **system administrator**, I want **unified tat dashboard — all departments on one screen with deviation heat map**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can unified TAT dashboard — all departments on one screen with deviation heat map from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### TAT trend analysis — weekly/monthly improvement or degradation tracking
> As a **system administrator**, I want **tat trend analysis — weekly/monthly improvement or degradation tracking**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can tAT trend analysis — weekly/monthly improvement or degradation tracking from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Dashboard Composer

### Drag-drop dashboard layout — arrange charts/tables/KPIs in 12-column configurable grid (enhance existing)
> As a **system administrator**, I want **drag-drop dashboard layout — arrange charts/tables/kpis in 12-column configurable grid (enhance existing)**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

**Acceptance criteria**
- [ ] The system administrator can drag-drop dashboard layout — arrange charts/tables/KPIs in 12-column configurable grid (enhance existing) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Dashboard-level filters — global date range, department, doctor filters that cascade to all widgets
> As a **system administrator**, I want **dashboard-level filters — global date range, department, doctor filters that cascade to all widgets**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

**Acceptance criteria**
- [ ] The system administrator can dashboard-level filters — global date range, department, doctor filters that cascade to all widgets from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Auto-refresh with configurable interval per dashboard (30s, 1m, 5m, manual)
> As a **system administrator**, I want **auto-refresh with configurable interval per dashboard (30s, 1m, 5m, manual)**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

**Acceptance criteria**
- [ ] The system administrator can auto-refresh with configurable interval per dashboard (30s, 1m, 5m, manual) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Dashboard templates — pre-built hospital analytics (CEO Overview, CMO Clinical, HOD Department, Finance)
> As a **system administrator**, I want **dashboard templates — pre-built hospital analytics (ceo overview, cmo clinical, hod department, finance)**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

**Acceptance criteria**
- [ ] The system administrator can dashboard templates — pre-built hospital analytics (CEO Overview, CMO Clinical, HOD Department, Finance) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Dashboard sharing — share via link, embed in pages, role/department-based visibility (enhance existing)
> As a **system administrator**, I want **dashboard sharing — share via link, embed in pages, role/department-based visibility (enhance existing)**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

**Acceptance criteria**
- [ ] The system administrator can dashboard sharing — share via link, embed in pages, role/department-based visibility (enhance existing) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Full-screen presentation mode — cycle through dashboards on TV displays with auto-rotate
> As a **system administrator**, I want **full-screen presentation mode — cycle through dashboards on tv displays with auto-rotate**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

**Acceptance criteria**
- [ ] The system administrator can full-screen presentation mode — cycle through dashboards on TV displays with auto-rotate from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### PDF/PNG export of entire dashboard with current data snapshot
> As a **system administrator**, I want **pdf/png export of entire dashboard with current data snapshot**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

**Acceptance criteria**
- [ ] The system administrator can pDF/PNG export of entire dashboard with current data snapshot from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Scheduled report delivery — auto-email PDF dashboards to stakeholders (daily/weekly/monthly)
> As a **system administrator**, I want **scheduled report delivery — auto-email pdf dashboards to stakeholders (daily/weekly/monthly)**.

`P2 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

**Acceptance criteria**
- [ ] The system administrator can scheduled report delivery — auto-email PDF dashboards to stakeholders (daily/weekly/monthly) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Detection

### Real-time network connectivity indicator in UI (green/yellow/red bar)
> As a **system administrator**, I want **real-time network connectivity indicator in ui (green/yellow/red bar)**.

`Pending · Platforms: Web · Source: iElixir+Bahmni · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can real-time network connectivity indicator in UI (green/yellow/red bar) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Auto-save clinical data locally when network drops (IndexedDB / WatermelonDB)
> As a **system administrator**, I want **auto-save clinical data locally when network drops (indexeddb / watermelondb)**.

`Pending · Platforms: Web · Source: iElixir+Bahmni · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can auto-save clinical data locally when network drops (IndexedDB / WatermelonDB) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Device Data Ingest

### Lab result ingest endpoint — bridge posts parsed lab data, server creates lab_results with QC validation
> As a **system administrator**, I want **lab result ingest endpoint — bridge posts parsed lab data, server creates lab_results with qc validation**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can lab result ingest endpoint — bridge posts parsed lab data, server creates lab_results with QC validation from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Radiology/DICOM ingest — receive study metadata and images, link to radiology_orders
> As a **system administrator**, I want **radiology/dicom ingest — receive study metadata and images, link to radiology_orders**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can radiology/DICOM ingest — receive study metadata and images, link to radiology_orders from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Vitals streaming ingest — patient monitor data → icu_flowsheets or vitals records
> As a **system administrator**, I want **vitals streaming ingest — patient monitor data → icu_flowsheets or vitals records**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can vitals streaming ingest — patient monitor data → icu_flowsheets or vitals records from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Generic ingest endpoint — catch-all for custom device data with configurable target module
> As a **system administrator**, I want **generic ingest endpoint — catch-all for custom device data with configurable target module**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can generic ingest endpoint — catch-all for custom device data with configurable target module from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Audit logging — every device-ingested record logged with bridge agent IP, device ID, raw payload hash
> As a **system administrator**, I want **audit logging — every device-ingested record logged with bridge agent ip, device id, raw payload hash**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can audit logging — every device-ingested record logged with bridge agent IP, device ID, raw payload hash from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Integration pipeline trigger — device data ingest fires internal events for automation pipelines
> As a **system administrator**, I want **integration pipeline trigger — device data ingest fires internal events for automation pipelines**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can integration pipeline trigger — device data ingest fires internal events for automation pipelines from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Device Instance Management

### Device instance CRUD — per-tenant create, read, update, decommission devices with full lifecycle tracking
> As a **system administrator**, I want **device instance crud — per-tenant create, read, update, decommission devices with full lifecycle tracking**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can device instance CRUD — per-tenant create, read, update, decommission devices with full lifecycle tracking from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Device status tracking — pending_setup → configuring → testing → active → degraded → disconnected → maintenance → decommissioned
> As a **system administrator**, I want **device status tracking — pending_setup → configuring → testing → active → degraded → disconnected → maintenance → decommissioned**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can device status tracking — pending_setup → configuring → testing → active → degraded → disconnected → maintenance → decommissioned from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Connectivity test — admin triggers test connection to device via assigned bridge agent, returns latency/status
> As a **system administrator**, I want **connectivity test — admin triggers test connection to device via assigned bridge agent, returns latency/status**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can connectivity test — admin triggers test connection to device via assigned bridge agent, returns latency/status from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Credential encryption — AES-256-GCM for device passwords/API keys at rest, masked in API responses
> As a **system administrator**, I want **credential encryption — aes-256-gcm for device passwords/api keys at rest, masked in api responses**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can credential encryption — AES-256-GCM for device passwords/API keys at rest, masked in API responses from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Config history audit trail — every config change (AI or human) logged with before/after diff and reason
> As a **system administrator**, I want **config history audit trail — every config change (ai or human) logged with before/after diff and reason**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can config history audit trail — every config change (AI or human) logged with before/after diff and reason from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### BME equipment linkage — FK to bme_equipment for maintenance/calibration tracking
> As a **system administrator**, I want **bme equipment linkage — fk to bme_equipment for maintenance/calibration tracking**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can bME equipment linkage — FK to bme_equipment for maintenance/calibration tracking from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Facility/department/location assignment — bind device to physical location for routing
> As a **system administrator**, I want **facility/department/location assignment — bind device to physical location for routing**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can facility/department/location assignment — bind device to physical location for routing from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Device message log — raw inbound/outbound message log with parsed payload, processing status, retry count
> As a **system administrator**, I want **device message log — raw inbound/outbound message log with parsed payload, processing status, retry count**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can device message log — raw inbound/outbound message log with parsed payload, processing status, retry count from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Failed message retry — admin retries failed/rejected messages from the message log
> As a **system administrator**, I want **failed message retry — admin retries failed/rejected messages from the message log**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can failed message retry — admin retries failed/rejected messages from the message log from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Device Knowledge Base

### Global device manufacturer catalog — searchable registry of medical device manufacturers with logos and support URLs
> As a **system administrator**, I want **global device manufacturer catalog — searchable registry of medical device manufacturers with logos and support urls**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can global device manufacturer catalog — searchable registry of medical device manufacturers with logos and support URLs from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Device model profiles — per-model defaults: protocol, port, baud rate, AE title, field mappings, transforms, known quirks
> As a **system administrator**, I want **device model profiles — per-model defaults: protocol, port, baud rate, ae title, field mappings, transforms, known quirks**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can device model profiles — per-model defaults: protocol, port, baud rate, AE title, field mappings, transforms, known quirks from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Community-contributed device profiles — tenants share configs for devices they've successfully connected
> As a **system administrator**, I want **community-contributed device profiles — tenants share configs for devices they've successfully connected**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can community-contributed device profiles — tenants share configs for devices they've successfully connected from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Verified badge — MedBrains team marks tested/verified device profiles
> As a **system administrator**, I want **verified badge — medbrains team marks tested/verified device profiles**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can verified badge — MedBrains team marks tested/verified device profiles from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Known quirks registry — auto-applied workarounds per device model (e.g., CR vs CRLF, ACK delays)
> As a **system administrator**, I want **known quirks registry — auto-applied workarounds per device model (e.g., cr vs crlf, ack delays)**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can known quirks registry — auto-applied workarounds per device model (e.g., CR vs CRLF, ACK delays) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Seed data — 20-30 common Indian hospital devices (Roche cobas, Beckman, Sysmex, Mindray, Erba, TransAsia, GE, Philips, Siemens)
> As a **system administrator**, I want **seed data — 20-30 common indian hospital devices (roche cobas, beckman, sysmex, mindray, erba, transasia, ge, philips, siemens)**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can seed data — 20-30 common Indian hospital devices (Roche cobas, Beckman, Sysmex, Mindray, Erba, TransAsia, GE, Philips, Siemens) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Discharge

### Discharge TAT — decision-to-actual-discharge time with bottleneck analysis
> As a **system administrator**, I want **discharge tat — decision-to-actual-discharge time with bottleneck analysis**.

`Pending · Platforms: Web, Mobile · Source: iElixir · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can discharge TAT — decision-to-actual-discharge time with bottleneck analysis from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Disposal

### Expired drug identification and quarantine workflow
> As a **system administrator**, I want **expired drug identification and quarantine workflow**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can expired drug identification and quarantine workflow from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Drug destruction documentation (witness, method, quantity)
> As a **system administrator**, I want **drug destruction documentation (witness, method, quantity)**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can drug destruction documentation (witness, method, quantity) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Narcotics disposal with mandatory dual-witness sign-off
> As a **system administrator**, I want **narcotics disposal with mandatory dual-witness sign-off**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can narcotics disposal with mandatory dual-witness sign-off from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Batch-level disposal tracking with reason codes
> As a **system administrator**, I want **batch-level disposal tracking with reason codes**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can batch-level disposal tracking with reason codes from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Environmental compliance documentation (biomedical waste category)
> As a **system administrator**, I want **environmental compliance documentation (biomedical waste category)**.

`Pending · Platforms: Web, Mobile · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can environmental compliance documentation (biomedical waste category) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Disposal approval workflow (pharmacist → manager → compliance)
> As a **system administrator**, I want **disposal approval workflow (pharmacist → manager → compliance)**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can disposal approval workflow (pharmacist → manager → compliance) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Integration with inventory — auto-deduct disposed stock
> As a **system administrator**, I want **integration with inventory — auto-deduct disposed stock**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can integration with inventory — auto-deduct disposed stock from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Disposal register report for regulatory audit
> As a **system administrator**, I want **disposal register report for regulatory audit**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can disposal register report for regulatory audit from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Duplicates

### Duplicate patient detection (fuzzy matching on name, DOB, phone, Aadhaar)
> As a **system administrator**, I want **duplicate patient detection (fuzzy matching on name, dob, phone, aadhaar)**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can duplicate patient detection (fuzzy matching on name, DOB, phone, Aadhaar) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Patient merge workflow (merge duplicates with audit trail and supervisor approval)
> As a **system administrator**, I want **patient merge workflow (merge duplicates with audit trail and supervisor approval)**.

`Done · Platforms: Web · Source: iElixir · RFC: §Ext`

**Acceptance criteria**
- [x] The system administrator can patient merge workflow (merge duplicates with audit trail and supervisor approval) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## ERP & Standards

### Tally integration
> As a **system administrator**, I want **tally integration**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [ ] The system administrator can tally integration from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### SAP integration
> As a **system administrator**, I want **sap integration**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [ ] The system administrator can sAP integration from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Odoo integration
> As a **system administrator**, I want **odoo integration**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [ ] The system administrator can odoo integration from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Zoho Books integration
> As a **system administrator**, I want **zoho books integration**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [ ] The system administrator can zoho Books integration from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Webhook-based generic integration
> As a **system administrator**, I want **webhook-based generic integration**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [ ] The system administrator can webhook-based generic integration from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ ICD-10 coding
> As a **system administrator**, I want **icd-10 coding**.

`Done · Platforms: Web, Mobile · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [x] The system administrator can iCD-10 coding from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### SNOMED CT
> As a **system administrator**, I want **snomed ct**.

`Partial · Platforms: Web, Mobile · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [ ] The system administrator can sNOMED CT from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### LOINC (lab codes)
> As a **system administrator**, I want **loinc (lab codes)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [ ] The system administrator can lOINC (lab codes) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### CPT (procedure codes)
> As a **system administrator**, I want **cpt (procedure codes)**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [ ] The system administrator can cPT (procedure codes) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### HL7 FHIR (data exchange) R4
> As a **system administrator**, I want **hl7 fhir (data exchange) r4**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [ ] The system administrator can hL7 FHIR (data exchange) R4 from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### CDSS (Clinical Decision Support)
> As a **system administrator**, I want **cdss (clinical decision support)**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [ ] The system administrator can cDSS (Clinical Decision Support) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Emergency

### ER TAT — door-to-doctor, door-to-disposition time tracking
> As a **system administrator**, I want **er tat — door-to-doctor, door-to-disposition time tracking**.

`Pending · Platforms: Web, Mobile · Source: iElixir · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can eR TAT — door-to-doctor, door-to-disposition time tracking from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Engagement

### Real-time wait time display per department/doctor on website
> As a **system administrator**, I want **real-time wait time display per department/doctor on website**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can real-time wait time display per department/doctor on website from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Chat bot / virtual assistant for FAQs, appointment help, directions
> As a **system administrator**, I want **chat bot / virtual assistant for faqs, appointment help, directions**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can chat bot / virtual assistant for FAQs, appointment help, directions from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Patient lifecycle tracking (prospect → first visit → regular → inactive → re-engaged)
> As a **system administrator**, I want **patient lifecycle tracking (prospect → first visit → regular → inactive → re-engaged)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can patient lifecycle tracking (prospect → first visit → regular → inactive → re-engaged) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Birthday/anniversary greetings automation
> As a **system administrator**, I want **birthday/anniversary greetings automation**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can birthday/anniversary greetings automation from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Engine

### Workflow template builder (admin)
> As a **system administrator**, I want **workflow template builder (admin)**.

`Pending · Platforms: Web · Source: RFC · RFC: RFC-002`

**Acceptance criteria**
- [ ] The system administrator can workflow template builder (admin) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Step sequence definition (JSONB)
> As a **system administrator**, I want **step sequence definition (jsonb)**.

`Pending · Platforms: Web · Source: RFC · RFC: RFC-002`

**Acceptance criteria**
- [ ] The system administrator can step sequence definition (JSONB) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Conditional branching (if/else rules)
> As a **system administrator**, I want **conditional branching (if/else rules)**.

`Pending · Platforms: Web · Source: RFC · RFC: RFC-002`

**Acceptance criteria**
- [ ] The system administrator can conditional branching (if/else rules) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Parallel steps
> As a **system administrator**, I want **parallel steps**.

`Pending · Platforms: Web · Source: RFC · RFC: RFC-002`

**Acceptance criteria**
- [ ] The system administrator can parallel steps from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Approval steps (single/multi-level)
> As a **system administrator**, I want **approval steps (single/multi-level)**.

`Pending · Platforms: Web · Source: RFC · RFC: RFC-002`

**Acceptance criteria**
- [ ] The system administrator can approval steps (single/multi-level) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Auto-trigger workflows (on event)
> As a **system administrator**, I want **auto-trigger workflows (on event)**.

`Pending · Platforms: Web · Source: RFC · RFC: RFC-002`

**Acceptance criteria**
- [ ] The system administrator can auto-trigger workflows (on event) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Manual trigger workflows
> As a **system administrator**, I want **manual trigger workflows**.

`Pending · Platforms: Web · Source: RFC · RFC: RFC-002`

**Acceptance criteria**
- [ ] The system administrator can manual trigger workflows from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### SLA/deadline tracking per step
> As a **system administrator**, I want **sla/deadline tracking per step**.

`Pending · Platforms: Web · Source: RFC · RFC: RFC-002`

**Acceptance criteria**
- [ ] The system administrator can sLA/deadline tracking per step from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Escalation on deadline breach
> As a **system administrator**, I want **escalation on deadline breach**.

`Pending · Platforms: Web · Source: RFC · RFC: RFC-002`

**Acceptance criteria**
- [ ] The system administrator can escalation on deadline breach from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Workflow instance tracking (status per patient/order)
> As a **system administrator**, I want **workflow instance tracking (status per patient/order)**.

`Pending · Platforms: Web · Source: RFC · RFC: RFC-002`

**Acceptance criteria**
- [ ] The system administrator can workflow instance tracking (status per patient/order) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Workflow audit trail
> As a **system administrator**, I want **workflow audit trail**.

`Done · Platforms: Web · Source: RFC · RFC: RFC-002`

**Acceptance criteria**
- [x] The system administrator can workflow audit trail from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Form builder (dynamic forms per workflow step)
> As a **system administrator**, I want **form builder (dynamic forms per workflow step)**.

`Pending · Platforms: Web · Source: RFC · RFC: RFC-002`

**Acceptance criteria**
- [ ] The system administrator can form builder (dynamic forms per workflow step) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Notification integration (per step)
> As a **system administrator**, I want **notification integration (per step)**.

`Pending · Platforms: Web · Source: RFC · RFC: RFC-002`

**Acceptance criteria**
- [ ] The system administrator can notification integration (per step) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### 120+ pre-built workflow templates (from RFC-002)
> As a **system administrator**, I want **120+ pre-built workflow templates (from rfc-002)**.

`Pending · Platforms: Web · Source: RFC · RFC: RFC-002`

**Acceptance criteria**
- [ ] The system administrator can 120+ pre-built workflow templates (from RFC-002) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Export

### Full data export (all patient records, visits, orders in FHIR/CSV/JSON)
> As a **system administrator**, I want **full data export (all patient records, visits, orders in fhir/csv/json)**.

`Pending · Platforms: Web · Source: iElixir+Bahmni · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can full data export (all patient records, visits, orders in FHIR/CSV/JSON) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Department-wise data export with date range filters
> As a **system administrator**, I want **department-wise data export with date range filters**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can department-wise data export with date range filters from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Follow-up

### Post-discharge follow-up scheduling (auto-book 7-day/30-day follow-up)
> As a **system administrator**, I want **post-discharge follow-up scheduling (auto-book 7-day/30-day follow-up)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can post-discharge follow-up scheduling (auto-book 7-day/30-day follow-up) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Post-discharge phone/WhatsApp call tracking (nurse callback with checklist)
> As a **system administrator**, I want **post-discharge phone/whatsapp call tracking (nurse callback with checklist)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can post-discharge phone/WhatsApp call tracking (nurse callback with checklist) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## General

### Country-specific regulatory engine — auto-detect applicable laws/bodies based on hospital country and state
> As a **system administrator**, I want **country-specific regulatory engine — auto-detect applicable laws/bodies based on hospital country and state**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The system administrator can country-specific regulatory engine — auto-detect applicable laws/bodies based on hospital country and state from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Multi-script patient name storage — Latin + Devanagari + Arabic + Thai script with transliteration
> As a **system administrator**, I want **multi-script patient name storage — latin + devanagari + arabic + thai script with transliteration**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The system administrator can multi-script patient name storage — Latin + Devanagari + Arabic + Thai script with transliteration from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Country-specific patient ID formats — Aadhaar (India), Emirates ID (UAE), NRIC (Singapore), SSN (US)
> As a **system administrator**, I want **country-specific patient id formats — aadhaar (india), emirates id (uae), nric (singapore), ssn (us)**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The system administrator can country-specific patient ID formats — Aadhaar (India), Emirates ID (UAE), NRIC (Singapore), SSN (US) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Multi-calendar support — Gregorian + Hijri + Thai Buddhist + Nepali Bikram Sambat with auto-conversion
> As a **system administrator**, I want **multi-calendar support — gregorian + hijri + thai buddhist + nepali bikram sambat with auto-conversion**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The system administrator can multi-calendar support — Gregorian + Hijri + Thai Buddhist + Nepali Bikram Sambat with auto-conversion from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Multi-format date/time/number display — DD/MM/YYYY vs MM/DD/YYYY vs YYYY-MM-DD per locale preference
> As a **system administrator**, I want **multi-format date/time/number display — dd/mm/yyyy vs mm/dd/yyyy vs yyyy-mm-dd per locale preference**.

`P1 · Pending · Platforms: Web, TV · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The system administrator can multi-format date/time/number display — DD/MM/YYYY vs MM/DD/YYYY vs YYYY-MM-DD per locale preference from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### RTL (right-to-left) UI support — Arabic/Hebrew interface mirroring for Gulf region deployments
> As a **system administrator**, I want **rtl (right-to-left) ui support — arabic/hebrew interface mirroring for gulf region deployments**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The system administrator can rTL (right-to-left) UI support — Arabic/Hebrew interface mirroring for Gulf region deployments from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Multi-timezone scheduling — per-campus timezone with cross-timezone appointment coordination
> As a **system administrator**, I want **multi-timezone scheduling — per-campus timezone with cross-timezone appointment coordination**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The system administrator can multi-timezone scheduling — per-campus timezone with cross-timezone appointment coordination from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Multi-measurement auto-conversion — kg↔lb, cm↔in, °C↔°F, mmol/L↔mg/dL per locale with stored metric
> As a **system administrator**, I want **multi-measurement auto-conversion — kg↔lb, cm↔in, °c↔°f, mmol/l↔mg/dl per locale with stored metric**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The system administrator can multi-measurement auto-conversion — kg↔lb, cm↔in, °C↔°F, mmol/L↔mg/dL per locale with stored metric from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Country-specific tax engine — GST (India), VAT (UAE/EU), sales tax (US) with configurable rates per service
> As a **system administrator**, I want **country-specific tax engine — gst (india), vat (uae/eu), sales tax (us) with configurable rates per service**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The system administrator can country-specific tax engine — GST (India), VAT (UAE/EU), sales tax (US) with configurable rates per service from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Country-specific drug scheduling — Schedule H/H1/X (India), Schedule 8 (Australia), Class A/B/C (UK)
> As a **system administrator**, I want **country-specific drug scheduling — schedule h/h1/x (india), schedule 8 (australia), class a/b/c (uk)**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The system administrator can country-specific drug scheduling — Schedule H/H1/X (India), Schedule 8 (Australia), Class A/B/C (UK) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Country-specific consent templates — legal requirements vary (India=witness required, US=HIPAA notice)
> As a **system administrator**, I want **country-specific consent templates — legal requirements vary (india=witness required, us=hipaa notice)**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The system administrator can country-specific consent templates — legal requirements vary (India=witness required, US=HIPAA notice) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Country-specific clinical coding — ICD-10-CM (US) vs ICD-10-AM (Australia) vs ICD-10 WHO (India)
> As a **system administrator**, I want **country-specific clinical coding — icd-10-cm (us) vs icd-10-am (australia) vs icd-10 who (india)**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The system administrator can country-specific clinical coding — ICD-10-CM (US) vs ICD-10-AM (Australia) vs ICD-10 WHO (India) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Country-specific billing formats — NABH format (India), DHA/HAAD format (UAE), CMS-1500 (US)
> As a **system administrator**, I want **country-specific billing formats — nabh format (india), dha/haad format (uae), cms-1500 (us)**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The system administrator can country-specific billing formats — NABH format (India), DHA/HAAD format (UAE), CMS-1500 (US) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Country-specific emergency protocols — MLC reporting (India), mandatory reporting laws per jurisdiction
> As a **system administrator**, I want **country-specific emergency protocols — mlc reporting (india), mandatory reporting laws per jurisdiction**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The system administrator can country-specific emergency protocols — MLC reporting (India), mandatory reporting laws per jurisdiction from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Regional holiday calendar — auto-populate public holidays per country for leave/scheduling modules
> As a **system administrator**, I want **regional holiday calendar — auto-populate public holidays per country for leave/scheduling modules**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The system administrator can regional holiday calendar — auto-populate public holidays per country for leave/scheduling modules from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Deployment region selector — data residency compliance (data stays in-country per GDPR/DPDP/PDPA)
> As a **system administrator**, I want **deployment region selector — data residency compliance (data stays in-country per gdpr/dpdp/pdpa)**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The system administrator can deployment region selector — data residency compliance (data stays in-country per GDPR/DPDP/PDPA) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Real-time hospital digital twin — live 3D visualization of bed occupancy, staff positions, equipment status
> As a **system administrator**, I want **real-time hospital digital twin — live 3d visualization of bed occupancy, staff positions, equipment status**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The system administrator can real-time hospital digital twin — live 3D visualization of bed occupancy, staff positions, equipment status from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Historical replay — replay any past day's operations to identify root causes of delays or incidents
> As a **system administrator**, I want **historical replay — replay any past day's operations to identify root causes of delays or incidents**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The system administrator can historical replay — replay any past day's operations to identify root causes of delays or incidents from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### What-if capacity simulation — model impact of adding beds, closing wards, or changing staffing ratios
> As a **system administrator**, I want **what-if capacity simulation — model impact of adding beds, closing wards, or changing staffing ratios**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The system administrator can what-if capacity simulation — model impact of adding beds, closing wards, or changing staffing ratios from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Disaster scenario simulation — simulate mass casualty, pandemic surge, power outage on hospital operations
> As a **system administrator**, I want **disaster scenario simulation — simulate mass casualty, pandemic surge, power outage on hospital operations**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The system administrator can disaster scenario simulation — simulate mass casualty, pandemic surge, power outage on hospital operations from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Patient flow simulation — model bottleneck impact of changing admission/discharge policies
> As a **system administrator**, I want **patient flow simulation — model bottleneck impact of changing admission/discharge policies**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The system administrator can patient flow simulation — model bottleneck impact of changing admission/discharge policies from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### OT scheduling simulation — optimize surgical block allocation by simulating different configurations
> As a **system administrator**, I want **ot scheduling simulation — optimize surgical block allocation by simulating different configurations**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The system administrator can oT scheduling simulation — optimize surgical block allocation by simulating different configurations from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Staffing optimization simulator — model shift patterns and nurse-to-patient ratios against patient acuity
> As a **system administrator**, I want **staffing optimization simulator — model shift patterns and nurse-to-patient ratios against patient acuity**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The system administrator can staffing optimization simulator — model shift patterns and nurse-to-patient ratios against patient acuity from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Equipment utilization simulation — predict impact of adding/removing ventilators, monitors, or imaging machines
> As a **system administrator**, I want **equipment utilization simulation — predict impact of adding/removing ventilators, monitors, or imaging machines**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The system administrator can equipment utilization simulation — predict impact of adding/removing ventilators, monitors, or imaging machines from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Financial impact modeling — simulate revenue impact of tariff changes, new services, or insurance panel changes
> As a **system administrator**, I want **financial impact modeling — simulate revenue impact of tariff changes, new services, or insurance panel changes**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The system administrator can financial impact modeling — simulate revenue impact of tariff changes, new services, or insurance panel changes from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Simulation report generator — export scenario comparison reports for board/management decision-making
> As a **system administrator**, I want **simulation report generator — export scenario comparison reports for board/management decision-making**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The system administrator can simulation report generator — export scenario comparison reports for board/management decision-making from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Screen reader optimization — ARIA labels, landmark regions, focus management across all pages
> As a **system administrator**, I want **screen reader optimization — aria labels, landmark regions, focus management across all pages**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The system administrator can screen reader optimization — ARIA labels, landmark regions, focus management across all pages from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Keyboard-only navigation — full app usable without mouse via Tab/Enter/Escape
> As a **system administrator**, I want **keyboard-only navigation — full app usable without mouse via tab/enter/escape**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The system administrator can keyboard-only navigation — full app usable without mouse via Tab/Enter/Escape from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### User-adjustable font scaling — 100% to 200% text size without layout breakage
> As a **system administrator**, I want **user-adjustable font scaling — 100% to 200% text size without layout breakage**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The system administrator can user-adjustable font scaling — 100% to 200% text size without layout breakage from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Color-blind safe palettes — alternative color schemes for deuteranopia, protanopia, tritanopia
> As a **system administrator**, I want **color-blind safe palettes — alternative color schemes for deuteranopia, protanopia, tritanopia**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The system administrator can color-blind safe palettes — alternative color schemes for deuteranopia, protanopia, tritanopia from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Reduced motion mode — disable animations for users with vestibular disorders
> As a **system administrator**, I want **reduced motion mode — disable animations for users with vestibular disorders**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The system administrator can reduced motion mode — disable animations for users with vestibular disorders from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Break-glass emergency access — override authorization with emergency code, mandatory reason, auto-audit log
> As a **system administrator**, I want **break-glass emergency access — override authorization with emergency code, mandatory reason, auto-audit log**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The system administrator can break-glass emergency access — override authorization with emergency code, mandatory reason, auto-audit log from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Patient identity banner — always-visible bar showing active patient (name, UHID, age, allergies) on clinical pages
> As a **system administrator**, I want **patient identity banner — always-visible bar showing active patient (name, uhid, age, allergies) on clinical pages**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The system administrator can patient identity banner — always-visible bar showing active patient (name, UHID, age, allergies) on clinical pages from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Similar-name patient alert — visual warning when two patients with similar names are accessed in same session
> As a **system administrator**, I want **similar-name patient alert — visual warning when two patients with similar names are accessed in same session**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The system administrator can similar-name patient alert — visual warning when two patients with similar names are accessed in same session from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### High-risk action confirmation — double-check step for dangerous doses, critical medication changes, irreversible orders
> As a **system administrator**, I want **high-risk action confirmation — double-check step for dangerous doses, critical medication changes, irreversible orders**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The system administrator can high-risk action confirmation — double-check step for dangerous doses, critical medication changes, irreversible orders from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Clinical handoff summary — auto-generated end-of-shift summary of patients under care with pending actions
> As a **system administrator**, I want **clinical handoff summary — auto-generated end-of-shift summary of patients under care with pending actions**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [ ] The system administrator can clinical handoff summary — auto-generated end-of-shift summary of patients under care with pending actions from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### 47. CONFIGURABLE ANALYTICS BUILDER + AI ANALYTICS
> As a **system administrator**, I want **47. configurable analytics builder + ai analytics**.

`Platforms: Web`

**Acceptance criteria**
- [ ] The system administrator can 47. CONFIGURABLE ANALYTICS BUILDER + AI ANALYTICS from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Government

### ABDM (ABHA, care context, consent) — M1/M2/M3
> As a **system administrator**, I want **abdm (abha, care context, consent) — m1/m2/m3**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [ ] The system administrator can aBDM (ABHA, care context, consent) — M1/M2/M3 from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### NHCX (National Health Claim Exchange)
> As a **system administrator**, I want **nhcx (national health claim exchange)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [ ] The system administrator can nHCX (National Health Claim Exchange) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### e-Hospital (NIC)
> As a **system administrator**, I want **e-hospital (nic)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [ ] The system administrator can e-Hospital (NIC) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### CoWIN (vaccination records)
> As a **system administrator**, I want **cowin (vaccination records)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [ ] The system administrator can coWIN (vaccination records) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Handoff

### Structured handoff document (I-PASS: Illness, Patient Summary, Action List, Situation, Synthesis)
> As a **system administrator**, I want **structured handoff document (i-pass: illness, patient summary, action list, situation, synthesis)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can structured handoff document (I-PASS: Illness, Patient Summary, Action List, Situation, Synthesis) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Automated transition-of-care notification to PCP/referring doctor
> As a **system administrator**, I want **automated transition-of-care notification to pcp/referring doctor**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can automated transition-of-care notification to PCP/referring doctor from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### AI handoff summary generation (synthesize shift events into structured handover)
> As a **system administrator**, I want **ai handoff summary generation (synthesize shift events into structured handover)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can aI handoff summary generation (synthesize shift events into structured handover) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Import

### Bulk patient import from CSV/Excel (demographics, insurance, contacts)
> As a **system administrator**, I want **bulk patient import from csv/excel (demographics, insurance, contacts)**.

`Pending · Platforms: Web · Source: iElixir+Bahmni · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can bulk patient import from CSV/Excel (demographics, insurance, contacts) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Historical visit/encounter import (map fields from competitor HMS export)
> As a **system administrator**, I want **historical visit/encounter import (map fields from competitor hms export)**.

`Pending · Platforms: Web · Source: iElixir+Bahmni · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can historical visit/encounter import (map fields from competitor HMS export) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Drug master import (name, generic, strength, route, frequency from CSV)
> As a **system administrator**, I want **drug master import (name, generic, strength, route, frequency from csv)**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can drug master import (name, generic, strength, route, frequency from CSV) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Lab test master import (test name, sample type, ranges from CSV)
> As a **system administrator**, I want **lab test master import (test name, sample type, ranges from csv)**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can lab test master import (test name, sample type, ranges from CSV) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Incident Log Audit

### ✅ Incident report audit trail — NEVER deletable (Rule INC-002)
> As a **system administrator**, I want **incident report audit trail — never deletable (rule inc-002)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-31 F`

**Acceptance criteria**
- [x] The system administrator can incident report audit trail — NEVER deletable (Rule INC-002) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Anonymous incident reporter identity encryption audit (Rule INC-001)
> As a **system administrator**, I want **anonymous incident reporter identity encryption audit (rule inc-001)**.

`Pending · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-31 F`

**Acceptance criteria**
- [ ] The system administrator can anonymous incident reporter identity encryption audit (Rule INC-001) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Medication error report auto-notification log (Rule INC-003)
> As a **system administrator**, I want **medication error report auto-notification log (rule inc-003)**.

`Pending · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-31 F`

**Acceptance criteria**
- [ ] The system administrator can medication error report auto-notification log (Rule INC-003) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Consent form access and modification audit
> As a **system administrator**, I want **consent form access and modification audit**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 F`

**Acceptance criteria**
- [ ] The system administrator can consent form access and modification audit from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Consent revocation real-time logging
> As a **system administrator**, I want **consent revocation real-time logging**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 F`

**Acceptance criteria**
- [ ] The system administrator can consent revocation real-time logging from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Form printing audit (reprint detection with DUPLICATE watermark)
> As a **system administrator**, I want **form printing audit (reprint detection with duplicate watermark)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 F`

**Acceptance criteria**
- [ ] The system administrator can form printing audit (reprint detection with DUPLICATE watermark) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Integration

### Apple Health / Google Fit data ingestion (steps, heart rate, sleep, activity)
> As a **system administrator**, I want **apple health / google fit data ingestion (steps, heart rate, sleep, activity)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can apple Health / Google Fit data ingestion (steps, heart rate, sleep, activity) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Bluetooth BP cuff, glucometer, pulse oximeter, weight scale integration
> As a **system administrator**, I want **bluetooth bp cuff, glucometer, pulse oximeter, weight scale integration**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can bluetooth BP cuff, glucometer, pulse oximeter, weight scale integration from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Continuous glucose monitor (CGM) data integration (Dexcom, Libre)
> As a **system administrator**, I want **continuous glucose monitor (cgm) data integration (dexcom, libre)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can continuous glucose monitor (CGM) data integration (Dexcom, Libre) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Lab

### Lab TAT tracking — order-to-result time with SLA breach alerts
> As a **system administrator**, I want **lab tat tracking — order-to-result time with sla breach alerts**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can lab TAT tracking — order-to-result time with SLA breach alerts from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Medication

### Medication reconciliation at every transition (admit → transfer → discharge)
> As a **system administrator**, I want **medication reconciliation at every transition (admit → transfer → discharge)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can medication reconciliation at every transition (admit → transfer → discharge) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Message Draft

### AI-drafted replies to patient portal messages (doctor reviews before sending)
> As a **system administrator**, I want **ai-drafted replies to patient portal messages (doctor reviews before sending)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can aI-drafted replies to patient portal messages (doctor reviews before sending) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### AI patient message categorization (urgent vs routine vs administrative)
> As a **system administrator**, I want **ai patient message categorization (urgent vs routine vs administrative)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can aI patient message categorization (urgent vs routine vs administrative) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Metadata & Semantic Layer

### Schema introspection — auto-discover PostgreSQL tables, columns, types, foreign keys from information_schema
> As a **system administrator**, I want **schema introspection — auto-discover postgresql tables, columns, types, foreign keys from information_schema**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

**Acceptance criteria**
- [ ] The system administrator can schema introspection — auto-discover PostgreSQL tables, columns, types, foreign keys from information_schema from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Metadata catalog — cached registry of all analytics-ready tables with column descriptions, data types, sample values
> As a **system administrator**, I want **metadata catalog — cached registry of all analytics-ready tables with column descriptions, data types, sample values**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

**Acceptance criteria**
- [ ] The system administrator can metadata catalog — cached registry of all analytics-ready tables with column descriptions, data types, sample values from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Semantic mapping — business-friendly names for columns (admitted_at → Admission Date, tenant_id → hidden)
> As a **system administrator**, I want **semantic mapping — business-friendly names for columns (admitted_at → admission date, tenant_id → hidden)**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

**Acceptance criteria**
- [ ] The system administrator can semantic mapping — business-friendly names for columns (admitted_at → Admission Date, tenant_id → hidden) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Pre-built JOIN graph — define relationships between tables (patients→encounters→lab_orders) for auto-join
> As a **system administrator**, I want **pre-built join graph — define relationships between tables (patients→encounters→lab_orders) for auto-join**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

**Acceptance criteria**
- [ ] The system administrator can pre-built JOIN graph — define relationships between tables (patients→encounters→lab_orders) for auto-join from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Calculated fields — define virtual columns (revenue_per_patient, tat_hours, occupancy_pct) reusable across charts
> As a **system administrator**, I want **calculated fields — define virtual columns (revenue_per_patient, tat_hours, occupancy_pct) reusable across charts**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

**Acceptance criteria**
- [ ] The system administrator can calculated fields — define virtual columns (revenue_per_patient, tat_hours, occupancy_pct) reusable across charts from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Materialized views — auto-create/refresh PostgreSQL materialized views for heavy aggregation queries
> As a **system administrator**, I want **materialized views — auto-create/refresh postgresql materialized views for heavy aggregation queries**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

**Acceptance criteria**
- [ ] The system administrator can materialized views — auto-create/refresh PostgreSQL materialized views for heavy aggregation queries from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Query cache layer — cache analytics query results in Redis/memory with TTL (30s–5min) for repeated dashboard loads
> As a **system administrator**, I want **query cache layer — cache analytics query results in redis/memory with ttl (30s–5min) for repeated dashboard loads**.

`P2 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

**Acceptance criteria**
- [ ] The system administrator can query cache layer — cache analytics query results in Redis/memory with TTL (30s–5min) for repeated dashboard loads from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Tenant-scoped metadata — each tenant sees only their allowed datasets, respects RLS
> As a **system administrator**, I want **tenant-scoped metadata — each tenant sees only their allowed datasets, respects rls**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

**Acceptance criteria**
- [ ] The system administrator can tenant-scoped metadata — each tenant sees only their allowed datasets, respects RLS from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Monitoring

### Abnormal reading alerts to care team (HR >120, SpO2 <90, BP >180)
> As a **system administrator**, I want **abnormal reading alerts to care team (hr >120, spo2 <90, bp >180)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can abnormal reading alerts to care team (HR >120, SpO2 <90, BP >180) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Patient-generated health data dashboard (trend charts, compliance)
> As a **system administrator**, I want **patient-generated health data dashboard (trend charts, compliance)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can patient-generated health data dashboard (trend charts, compliance) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### RPM (Remote Patient Monitoring) program enrollment and billing (CPT 99453-99458)
> As a **system administrator**, I want **rpm (remote patient monitoring) program enrollment and billing (cpt 99453-99458)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can rPM (Remote Patient Monitoring) program enrollment and billing (CPT 99453-99458) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Wearable data quality filtering (artifact rejection, plausibility checks)
> As a **system administrator**, I want **wearable data quality filtering (artifact rejection, plausibility checks)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can wearable data quality filtering (artifact rejection, plausibility checks) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Notifications

### Automated end-of-day summary (OPD count, IPD census, revenue, pending tasks)
> As a **system administrator**, I want **automated end-of-day summary (opd count, ipd census, revenue, pending tasks)**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can automated end-of-day summary (OPD count, IPD census, revenue, pending tasks) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Department-wise EOD breakdown (lab pending, pharmacy pending, billing pending)
> As a **system administrator**, I want **department-wise eod breakdown (lab pending, pharmacy pending, billing pending)**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can department-wise EOD breakdown (lab pending, pharmacy pending, billing pending) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### WhatsApp/email delivery of EOD digest to management
> As a **system administrator**, I want **whatsapp/email delivery of eod digest to management**.

`Pending · Platforms: Web, Mobile · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can whatsApp/email delivery of EOD digest to management from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Configurable digest schedule (shift-end, 8PM, midnight)
> As a **system administrator**, I want **configurable digest schedule (shift-end, 8pm, midnight)**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can configurable digest schedule (shift-end, 8PM, midnight) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Critical alert escalation (overdue tasks, pending discharges, low stock)
> As a **system administrator**, I want **critical alert escalation (overdue tasks, pending discharges, low stock)**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can critical alert escalation (overdue tasks, pending discharges, low stock) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Week/month trend comparison in digest
> As a **system administrator**, I want **week/month trend comparison in digest**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can week/month trend comparison in digest from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Outreach

### Health campaign management (flu drive, screening camp, wellness program)
> As a **system administrator**, I want **health campaign management (flu drive, screening camp, wellness program)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can health campaign management (flu drive, screening camp, wellness program) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Targeted patient outreach — filter by condition, age, last visit, insurance for campaigns
> As a **system administrator**, I want **targeted patient outreach — filter by condition, age, last visit, insurance for campaigns**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can targeted patient outreach — filter by condition, age, last visit, insurance for campaigns from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Multi-channel campaign delivery (SMS, WhatsApp, email, push notification, IVR)
> As a **system administrator**, I want **multi-channel campaign delivery (sms, whatsapp, email, push notification, ivr)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can multi-channel campaign delivery (SMS, WhatsApp, email, push notification, IVR) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Campaign response tracking (opened, clicked, booked, no-response)
> As a **system administrator**, I want **campaign response tracking (opened, clicked, booked, no-response)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can campaign response tracking (opened, clicked, booked, no-response) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Patterns

### Hour-of-day / day-of-week heat map (when do patients come?)
> As a **system administrator**, I want **hour-of-day / day-of-week heat map (when do patients come?)**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can hour-of-day / day-of-week heat map (when do patients come?) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Referral source analysis (self, doctor referral, insurance, online booking)
> As a **system administrator**, I want **referral source analysis (self, doctor referral, insurance, online booking)**.

`Pending · Platforms: Web, Mobile · Source: iElixir · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can referral source analysis (self, doctor referral, insurance, online booking) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### New vs returning patient ratio tracking
> As a **system administrator**, I want **new vs returning patient ratio tracking**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can new vs returning patient ratio tracking from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Payment & Comms

### Payment gateway (Razorpay/Stripe)
> As a **system administrator**, I want **payment gateway (razorpay/stripe)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [ ] The system administrator can payment gateway (Razorpay/Stripe) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### UPI integration
> As a **system administrator**, I want **upi integration**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [ ] The system administrator can uPI integration from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### POS terminal integration
> As a **system administrator**, I want **pos terminal integration**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [ ] The system administrator can pOS terminal integration from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### SMS gateway integration
> As a **system administrator**, I want **sms gateway integration**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [ ] The system administrator can sMS gateway integration from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### WhatsApp Business API
> As a **system administrator**, I want **whatsapp business api**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [ ] The system administrator can whatsApp Business API from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Email (SMTP/SendGrid)
> As a **system administrator**, I want **email (smtp/sendgrid)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [ ] The system administrator can email (SMTP/SendGrid) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Push notification (FCM/APNs)
> As a **system administrator**, I want **push notification (fcm/apns)**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [ ] The system administrator can push notification (FCM/APNs) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Pharmacy

### Pharmacy TAT — prescription-to-dispensing time
> As a **system administrator**, I want **pharmacy tat — prescription-to-dispensing time**.

`Pending · Platforms: Web, Mobile · Source: iElixir · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can pharmacy TAT — prescription-to-dispensing time from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Plain Language

### AI plain language translator — convert medical terminology to patient-friendly language
> As a **system administrator**, I want **ai plain language translator — convert medical terminology to patient-friendly language**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can aI plain language translator — convert medical terminology to patient-friendly language from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Pre-Visit

### Digital pre-registration (demographics, insurance, consent — before arrival)
> As a **system administrator**, I want **digital pre-registration (demographics, insurance, consent — before arrival)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can digital pre-registration (demographics, insurance, consent — before arrival) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Pre-visit questionnaire (symptoms, history, allergies — auto-populates chart)
> As a **system administrator**, I want **pre-visit questionnaire (symptoms, history, allergies — auto-populates chart)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can pre-visit questionnaire (symptoms, history, allergies — auto-populates chart) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Agentic AI pre-visit chart preparation (summarize history, flag care gaps, stage orders)
> As a **system administrator**, I want **agentic ai pre-visit chart preparation (summarize history, flag care gaps, stage orders)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can agentic AI pre-visit chart preparation (summarize history, flag care gaps, stage orders) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### AI-generated patient briefing for doctor (1-page summary before consultation)
> As a **system administrator**, I want **ai-generated patient briefing for doctor (1-page summary before consultation)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can aI-generated patient briefing for doctor (1-page summary before consultation) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Predictions

### Patient flow prediction — ED arrivals, admissions, discharges by hour
> As a **system administrator**, I want **patient flow prediction — ed arrivals, admissions, discharges by hour**.

`Pending · Platforms: Web · Source: Epic+iElixir · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can patient flow prediction — ED arrivals, admissions, discharges by hour from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Bed demand forecasting (predict bed shortages 24-48 hours ahead)
> As a **system administrator**, I want **bed demand forecasting (predict bed shortages 24-48 hours ahead)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can bed demand forecasting (predict bed shortages 24-48 hours ahead) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Readmission risk scoring (30-day readmission probability per patient)
> As a **system administrator**, I want **readmission risk scoring (30-day readmission probability per patient)**.

`Pending · Platforms: Web · Source: Epic+iElixir · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can readmission risk scoring (30-day readmission probability per patient) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Patient deterioration early warning (NEWS2/MEWS auto-calculated from vitals)
> As a **system administrator**, I want **patient deterioration early warning (news2/mews auto-calculated from vitals)**.

`Pending · Platforms: Web, Mobile · Source: Epic+iElixir · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can patient deterioration early warning (NEWS2/MEWS auto-calculated from vitals) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Privacy

### TLS 1.3 (transit encryption)
> As a **system administrator**, I want **tls 1.3 (transit encryption)**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-33 F`

**Acceptance criteria**
- [ ] The system administrator can tLS 1.3 (transit encryption) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Database encryption at rest (AES-256)
> As a **system administrator**, I want **database encryption at rest (aes-256)**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-33 F`

**Acceptance criteria**
- [ ] The system administrator can database encryption at rest (AES-256) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Field-level encryption (Aadhaar, phone, HIV status)
> As a **system administrator**, I want **field-level encryption (aadhaar, phone, hiv status)**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-33 F`

**Acceptance criteria**
- [ ] The system administrator can field-level encryption (Aadhaar, phone, HIV status) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Per-patient encryption keys (PDK)
> As a **system administrator**, I want **per-patient encryption keys (pdk)**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-33 F`

**Acceptance criteria**
- [ ] The system administrator can per-patient encryption keys (PDK) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Key hierarchy (MK → KEK → PDK → field keys)
> As a **system administrator**, I want **key hierarchy (mk → kek → pdk → field keys)**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-33 F`

**Acceptance criteria**
- [ ] The system administrator can key hierarchy (MK → KEK → PDK → field keys) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Consent-based encryption (HIV, psychiatry — patient must consent)
> As a **system administrator**, I want **consent-based encryption (hiv, psychiatry — patient must consent)**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-33 F`

**Acceptance criteria**
- [ ] The system administrator can consent-based encryption (HIV, psychiatry — patient must consent) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Password hashing (Argon2id)
> As a **system administrator**, I want **password hashing (argon2id)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-33 F`

**Acceptance criteria**
- [x] The system administrator can password hashing (Argon2id) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ JWT signing (Ed25519)
> As a **system administrator**, I want **jwt signing (ed25519)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-33 F`

**Acceptance criteria**
- [x] The system administrator can jWT signing (Ed25519) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Certificate pinning (mobile app)
> As a **system administrator**, I want **certificate pinning (mobile app)**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-33 F`

**Acceptance criteria**
- [ ] The system administrator can certificate pinning (mobile app) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### mTLS for ABDM/TPA API calls
> As a **system administrator**, I want **mtls for abdm/tpa api calls**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-33 F`

**Acceptance criteria**
- [ ] The system administrator can mTLS for ABDM/TPA API calls from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Key rotation (MK annual, KEK quarterly)
> As a **system administrator**, I want **key rotation (mk annual, kek quarterly)**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-33 F`

**Acceptance criteria**
- [ ] The system administrator can key rotation (MK annual, KEK quarterly) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### DPDPA compliance (right to erasure, consent management)
> As a **system administrator**, I want **dpdpa compliance (right to erasure, consent management)**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-33 F`

**Acceptance criteria**
- [ ] The system administrator can dPDPA compliance (right to erasure, consent management) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Key management (HSM, KMS, vault)
> As a **system administrator**, I want **key management (hsm, kms, vault)**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-33 F`

**Acceptance criteria**
- [ ] The system administrator can key management (HSM, KMS, vault) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Backup encryption (at rest + during transfer)
> As a **system administrator**, I want **backup encryption (at rest + during transfer)**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-33 F`

**Acceptance criteria**
- [ ] The system administrator can backup encryption (at rest + during transfer) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### DICOM traffic encryption (TLS for DICOM associations)
> As a **system administrator**, I want **dicom traffic encryption (tls for dicom associations)**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-33 F`

**Acceptance criteria**
- [ ] The system administrator can dICOM traffic encryption (TLS for DICOM associations) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Protocol Adapters

### HL7 v2 MLLP adapter — TCP listener/sender with MLLP framing (0x0B/0x1C/0x0D), ACK/NAK generation
> As a **system administrator**, I want **hl7 v2 mllp adapter — tcp listener/sender with mllp framing (0x0b/0x1c/0x0d), ack/nak generation**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can hL7 v2 MLLP adapter — TCP listener/sender with MLLP framing (0x0B/0x1C/0x0D), ACK/NAK generation from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ASTM E1381/E1394 adapter — ENQ/ACK/EOT handshake, frame parsing for older lab analyzers
> As a **system administrator**, I want **astm e1381/e1394 adapter — enq/ack/eot handshake, frame parsing for older lab analyzers**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can aSTM E1381/E1394 adapter — ENQ/ACK/EOT handshake, frame parsing for older lab analyzers from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### DICOM adapter — C-STORE (receive studies), C-FIND (query), Modality Worklist (send orders to scanners)
> As a **system administrator**, I want **dicom adapter — c-store (receive studies), c-find (query), modality worklist (send orders to scanners)**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can dICOM adapter — C-STORE (receive studies), C-FIND (query), Modality Worklist (send orders to scanners) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Serial RS-232 adapter — configurable baud/parity/stop bits for legacy point-of-care devices
> As a **system administrator**, I want **serial rs-232 adapter — configurable baud/parity/stop bits for legacy point-of-care devices**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can serial RS-232 adapter — configurable baud/parity/stop bits for legacy point-of-care devices from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### REST/JSON adapter — poll or webhook mode for modern IoT devices and cloud APIs
> As a **system administrator**, I want **rest/json adapter — poll or webhook mode for modern iot devices and cloud apis**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can rEST/JSON adapter — poll or webhook mode for modern IoT devices and cloud APIs from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### MQTT adapter — subscribe to sensor topics for cold chain monitoring, environment sensors, wearables
> As a **system administrator**, I want **mqtt adapter — subscribe to sensor topics for cold chain monitoring, environment sensors, wearables**.

`P2 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can mQTT adapter — subscribe to sensor topics for cold chain monitoring, environment sensors, wearables from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ProtocolAdapter trait — pluggable interface: connect, disconnect, receive, parse, ack, test_connection
> As a **system administrator**, I want **protocoladapter trait — pluggable interface: connect, disconnect, receive, parse, ack, test_connection**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can protocolAdapter trait — pluggable interface: connect, disconnect, receive, parse, ack, test_connection from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Message parser pipeline — raw bytes → parsed segments → field mapping → data transforms → validation → MedBrains entity
> As a **system administrator**, I want **message parser pipeline — raw bytes → parsed segments → field mapping → data transforms → validation → medbrains entity**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

**Acceptance criteria**
- [ ] The system administrator can message parser pipeline — raw bytes → parsed segments → field mapping → data transforms → validation → MedBrains entity from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Provider Search

### Provider directory with search by specialty, language, insurance, availability
> As a **system administrator**, I want **provider directory with search by specialty, language, insurance, availability**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can provider directory with search by specialty, language, insurance, availability from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Provider profile pages (photo, qualifications, ratings, available slots)
> As a **system administrator**, I want **provider profile pages (photo, qualifications, ratings, available slots)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can provider profile pages (photo, qualifications, ratings, available slots) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Radiology

### Radiology TAT — order-to-report time with priority-based SLAs
> As a **system administrator**, I want **radiology tat — order-to-report time with priority-based slas**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can radiology TAT — order-to-report time with priority-based SLAs from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Referral

### Community resource directory (food banks, shelters, mental health, transport services)
> As a **system administrator**, I want **community resource directory (food banks, shelters, mental health, transport services)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can community resource directory (food banks, shelters, mental health, transport services) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Closed-loop referral to community orgs (track if patient connected with resource)
> As a **system administrator**, I want **closed-loop referral to community orgs (track if patient connected with resource)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can closed-loop referral to community orgs (track if patient connected with resource) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### External referral tracking (referred out — track if patient was seen, report received)
> As a **system administrator**, I want **external referral tracking (referred out — track if patient was seen, report received)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can external referral tracking (referred out — track if patient was seen, report received) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Reports

### Monthly data quality scorecard per department (completeness, accuracy, timeliness)
> As a **system administrator**, I want **monthly data quality scorecard per department (completeness, accuracy, timeliness)**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can monthly data quality scorecard per department (completeness, accuracy, timeliness) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Reviews

### ✅ JustDial review integration — auto-push patient feedback to JustDial listing
> As a **system administrator**, I want **justdial review integration — auto-push patient feedback to justdial listing**.

`Done · Platforms: Web, Mobile · Source: iElixir · RFC: §Ext`

**Acceptance criteria**
- [x] The system administrator can justDial review integration — auto-push patient feedback to JustDial listing from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Google Business review integration — prompt satisfied patients to leave Google review
> As a **system administrator**, I want **google business review integration — prompt satisfied patients to leave google review**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can google Business review integration — prompt satisfied patients to leave Google review from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Risk

### Patient risk stratification (low/medium/high based on conditions, utilization, social factors)
> As a **system administrator**, I want **patient risk stratification (low/medium/high based on conditions, utilization, social factors)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can patient risk stratification (low/medium/high based on conditions, utilization, social factors) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Chronic disease registry (all diabetics, hypertensives, COPD patients in one view)
> As a **system administrator**, I want **chronic disease registry (all diabetics, hypertensives, copd patients in one view)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can chronic disease registry (all diabetics, hypertensives, COPD patients in one view) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## SIEM

### ✅ Real-time security dashboard (active sessions, failed logins, break-glass, anomalies)
> As a **system administrator**, I want **real-time security dashboard (active sessions, failed logins, break-glass, anomalies)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-31 G`

**Acceptance criteria**
- [x] The system administrator can real-time security dashboard (active sessions, failed logins, break-glass, anomalies) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Automated anomaly detection (unusual access patterns)
> As a **system administrator**, I want **automated anomaly detection (unusual access patterns)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 G`

**Acceptance criteria**
- [ ] The system administrator can automated anomaly detection (unusual access patterns) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### SIEM integration (Splunk, ELK, Wazuh)
> As a **system administrator**, I want **siem integration (splunk, elk, wazuh)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 G`

**Acceptance criteria**
- [ ] The system administrator can sIEM integration (Splunk, ELK, Wazuh) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Log forwarding to centralized log management (syslog, JSON, CEF)
> As a **system administrator**, I want **log forwarding to centralized log management (syslog, json, cef)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 G`

**Acceptance criteria**
- [ ] The system administrator can log forwarding to centralized log management (syslog, JSON, CEF) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Alert engine for security events
> As a **system administrator**, I want **alert engine for security events**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 G`

**Acceptance criteria**
- [ ] The system administrator can alert engine for security events from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Periodic security audit reports (monthly/quarterly)
> As a **system administrator**, I want **periodic security audit reports (monthly/quarterly)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 G`

**Acceptance criteria**
- [ ] The system administrator can periodic security audit reports (monthly/quarterly) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### DPDP Act compliance reporting (data access logs for data subject requests)
> As a **system administrator**, I want **dpdp act compliance reporting (data access logs for data subject requests)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 G`

**Acceptance criteria**
- [ ] The system administrator can dPDP Act compliance reporting (data access logs for data subject requests) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Forensic investigation support (reconstruct complete user activity timeline)
> As a **system administrator**, I want **forensic investigation support (reconstruct complete user activity timeline)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 G`

**Acceptance criteria**
- [ ] The system administrator can forensic investigation support (reconstruct complete user activity timeline) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Scheduling

### Unified online scheduling — OPD, teleconsult, lab, radiology, vaccination
> As a **system administrator**, I want **unified online scheduling — opd, teleconsult, lab, radiology, vaccination**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can unified online scheduling — OPD, teleconsult, lab, radiology, vaccination from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Appointment booking from Google Maps / Google Business integration
> As a **system administrator**, I want **appointment booking from google maps / google business integration**.

`Pending · Platforms: Web, Mobile · Source: Epic+iElixir · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can appointment booking from Google Maps / Google Business integration from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Screening

### SDOH screening questionnaire (food insecurity, housing, transportation, safety)
> As a **system administrator**, I want **sdoh screening questionnaire (food insecurity, housing, transportation, safety)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can sDOH screening questionnaire (food insecurity, housing, transportation, safety) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ ICD-10 Z-code auto-mapping from SDOH responses (Z59=housing, Z56=employment)
> As a **system administrator**, I want **icd-10 z-code auto-mapping from sdoh responses (z59=housing, z56=employment)**.

`Done · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The system administrator can iCD-10 Z-code auto-mapping from SDOH responses (Z59=housing, Z56=employment) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Staffing

### Predictive staffing — nurse/doctor demand based on census forecast
> As a **system administrator**, I want **predictive staffing — nurse/doctor demand based on census forecast**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can predictive staffing — nurse/doctor demand based on census forecast from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### OR utilization optimization — suggest schedule changes to reduce idle time
> As a **system administrator**, I want **or utilization optimization — suggest schedule changes to reduce idle time**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can oR utilization optimization — suggest schedule changes to reduce idle time from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Symptom Checker

### AI-powered symptom checker (patient enters symptoms → suggested specialty/urgency)
> As a **system administrator**, I want **ai-powered symptom checker (patient enters symptoms → suggested specialty/urgency)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can aI-powered symptom checker (patient enters symptoms → suggested specialty/urgency) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Sync

### Auto-sync queued data when connectivity restored (conflict resolution)
> As a **system administrator**, I want **auto-sync queued data when connectivity restored (conflict resolution)**.

`Pending · Platforms: Web · Source: iElixir+Bahmni · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can auto-sync queued data when connectivity restored (conflict resolution) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Sync status dashboard — pending uploads, last sync time, failed syncs
> As a **system administrator**, I want **sync status dashboard — pending uploads, last sync time, failed syncs**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can sync status dashboard — pending uploads, last sync time, failed syncs from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Timeliness

### Documentation timeliness — time from event to chart entry per department
> As a **system administrator**, I want **documentation timeliness — time from event to chart entry per department**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can documentation timeliness — time from event to chart entry per department from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Validation

### Pre-import data validation (missing fields, format errors, duplicates)
> As a **system administrator**, I want **pre-import data validation (missing fields, format errors, duplicates)**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can pre-import data validation (missing fields, format errors, duplicates) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Migration reconciliation report (imported vs source counts per entity)
> As a **system administrator**, I want **migration reconciliation report (imported vs source counts per entity)**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can migration reconciliation report (imported vs source counts per entity) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### AI model validation framework (accuracy, bias, drift monitoring)
> As a **system administrator**, I want **ai model validation framework (accuracy, bias, drift monitoring)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can aI model validation framework (accuracy, bias, drift monitoring) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ AI decision audit trail (which model, version, input, output, confidence score)
> As a **system administrator**, I want **ai decision audit trail (which model, version, input, output, confidence score)**.

`Done · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The system administrator can aI decision audit trail (which model, version, input, output, confidence score) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### HIPAA-compliant AI pipeline (LLM integration with PHI guardrails)
> As a **system administrator**, I want **hipaa-compliant ai pipeline (llm integration with phi guardrails)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can hIPAA-compliant AI pipeline (LLM integration with PHI guardrails) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### AI feature toggle per department (enable/disable specific AI features)
> As a **system administrator**, I want **ai feature toggle per department (enable/disable specific ai features)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can aI feature toggle per department (enable/disable specific AI features) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Clinician override tracking (how often AI suggestion is accepted vs rejected)
> As a **system administrator**, I want **clinician override tracking (how often ai suggestion is accepted vs rejected)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can clinician override tracking (how often AI suggestion is accepted vs rejected) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Visibility

### ✅ Hospital-wide real-time dashboard — ED census, bed occupancy, OT status, pending discharges
> As a **system administrator**, I want **hospital-wide real-time dashboard — ed census, bed occupancy, ot status, pending discharges**.

`Done · Platforms: Web, TV · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The system administrator can hospital-wide real-time dashboard — ED census, bed occupancy, OT status, pending discharges from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Patient flow visualization (admission → ward → discharge pipeline with bottlenecks)
> As a **system administrator**, I want **patient flow visualization (admission → ward → discharge pipeline with bottlenecks)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can patient flow visualization (admission → ward → discharge pipeline with bottlenecks) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Department load balancing alerts (ED overcrowding, ICU full, OR delays)
> As a **system administrator**, I want **department load balancing alerts (ed overcrowding, icu full, or delays)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can department load balancing alerts (ED overcrowding, ICU full, OR delays) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Ambulance tracking & incoming patient alerts (pre-arrival notification)
> As a **system administrator**, I want **ambulance tracking & incoming patient alerts (pre-arrival notification)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can ambulance tracking & incoming patient alerts (pre-arrival notification) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Hospital listing management across Google, JustDial, Practo (single dashboard)
> As a **system administrator**, I want **hospital listing management across google, justdial, practo (single dashboard)**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can hospital listing management across Google, JustDial, Practo (single dashboard) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Visual Query Builder

### Dataset browser — tree view of available datasets/tables with column metadata and preview
> As a **system administrator**, I want **dataset browser — tree view of available datasets/tables with column metadata and preview**.

`P1 · Pending · Platforms: Web · Source: Superset · RFC: RFC-MODULE-analytics-builder`

**Acceptance criteria**
- [ ] The system administrator can dataset browser — tree view of available datasets/tables with column metadata and preview from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Drag-drop dimension/measure — pick columns as dimensions (GROUP BY) or measures (SUM/AVG/COUNT/MIN/MAX)
> As a **system administrator**, I want **drag-drop dimension/measure — pick columns as dimensions (group by) or measures (sum/avg/count/min/max)**.

`P1 · Pending · Platforms: Web · Source: Superset · RFC: RFC-MODULE-analytics-builder`

**Acceptance criteria**
- [ ] The system administrator can drag-drop dimension/measure — pick columns as dimensions (GROUP BY) or measures (SUM/AVG/COUNT/MIN/MAX) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Filter builder — visual WHERE clause with AND/OR groups, date ranges, value pickers, relative dates
> As a **system administrator**, I want **filter builder — visual where clause with and/or groups, date ranges, value pickers, relative dates**.

`P1 · Pending · Platforms: Web · Source: Superset · RFC: RFC-MODULE-analytics-builder`

**Acceptance criteria**
- [ ] The system administrator can filter builder — visual WHERE clause with AND/OR groups, date ranges, value pickers, relative dates from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Time grain selector — automatic date truncation (day/week/month/quarter/year) for time-series queries
> As a **system administrator**, I want **time grain selector — automatic date truncation (day/week/month/quarter/year) for time-series queries**.

`P1 · Pending · Platforms: Web · Source: Superset · RFC: RFC-MODULE-analytics-builder`

**Acceptance criteria**
- [ ] The system administrator can time grain selector — automatic date truncation (day/week/month/quarter/year) for time-series queries from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Query result preview — live data preview with pagination while building the query
> As a **system administrator**, I want **query result preview — live data preview with pagination while building the query**.

`P1 · Pending · Platforms: Web · Source: Superset · RFC: RFC-MODULE-analytics-builder`

**Acceptance criteria**
- [ ] The system administrator can query result preview — live data preview with pagination while building the query from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### SQL editor mode — advanced users write raw SELECT queries (permission-gated, read-only enforcement)
> As a **system administrator**, I want **sql editor mode — advanced users write raw select queries (permission-gated, read-only enforcement)**.

`P2 · Pending · Platforms: Web · Source: Superset · RFC: RFC-MODULE-analytics-builder`

**Acceptance criteria**
- [ ] The system administrator can sQL editor mode — advanced users write raw SELECT queries (permission-gated, read-only enforcement) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Save as dataset — save configured query as reusable named dataset for other users/charts
> As a **system administrator**, I want **save as dataset — save configured query as reusable named dataset for other users/charts**.

`P1 · Pending · Platforms: Web · Source: Superset · RFC: RFC-MODULE-analytics-builder`

**Acceptance criteria**
- [ ] The system administrator can save as dataset — save configured query as reusable named dataset for other users/charts from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Query history — recent queries with re-run capability and performance stats
> As a **system administrator**, I want **query history — recent queries with re-run capability and performance stats**.

`P2 · Pending · Platforms: Web · Source: Superset · RFC: RFC-MODULE-analytics-builder`

**Acceptance criteria**
- [ ] The system administrator can query history — recent queries with re-run capability and performance stats from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Wizard

### Step-by-step hospital setup wizard (org details → departments → users → config)
> As a **system administrator**, I want **step-by-step hospital setup wizard (org details → departments → users → config)**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can step-by-step hospital setup wizard (org details → departments → users → config) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Import existing data (CSV/Excel for patients, doctors, inventory)
> As a **system administrator**, I want **import existing data (csv/excel for patients, doctors, inventory)**.

`Pending · Platforms: Web, Mobile · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can import existing data (CSV/Excel for patients, doctors, inventory) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Template selection (clinic vs hospital vs chain — pre-configured modules)
> As a **system administrator**, I want **template selection (clinic vs hospital vs chain — pre-configured modules)**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can template selection (clinic vs hospital vs chain — pre-configured modules) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Branding setup (logo, colors, letterhead, receipt format)
> As a **system administrator**, I want **branding setup (logo, colors, letterhead, receipt format)**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can branding setup (logo, colors, letterhead, receipt format) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Integration configuration (ABDM, payment gateway, SMS/WhatsApp)
> As a **system administrator**, I want **integration configuration (abdm, payment gateway, sms/whatsapp)**.

`Pending · Platforms: Web, Mobile · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can integration configuration (ABDM, payment gateway, SMS/WhatsApp) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Sample data mode (demo patients/visits for training)
> As a **system administrator**, I want **sample data mode (demo patients/visits for training)**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can sample data mode (demo patients/visits for training) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Progress tracker with completion percentage
> As a **system administrator**, I want **progress tracker with completion percentage**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The system administrator can progress tracker with completion percentage from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Security/privacy enforced: RBAC least-privilege, audit trail, encryption at rest, data-retention; no PHI in logs.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

