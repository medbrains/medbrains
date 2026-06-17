# Multi-Hospital & Vendors — stories

_Auto-generated from `MedBrains_Features.xlsx` — every feature as a story with module-tailored acceptance criteria. 90 stories (✅ = Done). Source of truth is the xlsx; regenerate via `python3 scripts/generate_stories.py`._

## Admin

### ✅ Hospital group hierarchy management (chain → region → campus → building → floor → dept)
> As a **group administrator**, I want **hospital group hierarchy management (chain → region → campus → building → floor → dept)**.

`Done · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [x] The group administrator can hospital group hierarchy management (chain → region → campus → building → floor → dept) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Centralized master data management (drug master, test master, procedure master — chain-wide)
> As a **group administrator**, I want **centralized master data management (drug master, test master, procedure master — chain-wide)**.

`Done · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [x] The group administrator can centralized master data management (drug master, test master, procedure master — chain-wide) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Chain-level configuration inheritance with hospital-level overrides
> As a **group administrator**, I want **chain-level configuration inheritance with hospital-level overrides**.

`Done · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [x] The group administrator can chain-level configuration inheritance with hospital-level overrides from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Centralized user management with cross-hospital role assignments
> As a **group administrator**, I want **centralized user management with cross-hospital role assignments**.

`Done · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [x] The group administrator can centralized user management with cross-hospital role assignments from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Single sign-on (SSO) across all hospitals in the chain
> As a **group administrator**, I want **single sign-on (sso) across all hospitals in the chain**.

`Partial · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The group administrator can single sign-on (SSO) across all hospitals in the chain from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Chain-wide template management (consent forms, report formats, SOP documents)
> As a **group administrator**, I want **chain-wide template management (consent forms, report formats, sop documents)**.

`Done · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [x] The group administrator can chain-wide template management (consent forms, report formats, SOP documents) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Ambulance

### Third-party ambulance service integration (dispatch API, GPS tracking, billing)
> As a **group administrator**, I want **third-party ambulance service integration (dispatch api, gps tracking, billing)**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The group administrator can third-party ambulance service integration (dispatch API, GPS tracking, billing) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Billing

### Split billing — hospital prescribes, external pharmacy bills directly to patient/insurance
> As a **group administrator**, I want **split billing — hospital prescribes, external pharmacy bills directly to patient/insurance**.

`Pending · Platforms: Web · Source: RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The group administrator can split billing — hospital prescribes, external pharmacy bills directly to patient/insurance from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Pharmacy commission/margin tracking for partner pharmacies
> As a **group administrator**, I want **pharmacy commission/margin tracking for partner pharmacies**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The group administrator can pharmacy commission/margin tracking for partner pharmacies from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Reference lab billing reconciliation (hospital price vs lab price, margin tracking)
> As a **group administrator**, I want **reference lab billing reconciliation (hospital price vs lab price, margin tracking)**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The group administrator can reference lab billing reconciliation (hospital price vs lab price, margin tracking) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Split billing for outsourced tests (patient pays hospital, hospital remits to lab)
> As a **group administrator**, I want **split billing for outsourced tests (patient pays hospital, hospital remits to lab)**.

`Pending · Platforms: Web · Source: RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The group administrator can split billing for outsourced tests (patient pays hospital, hospital remits to lab) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Teleradiology fee management (per-study billing to external radiologist)
> As a **group administrator**, I want **teleradiology fee management (per-study billing to external radiologist)**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The group administrator can teleradiology fee management (per-study billing to external radiologist) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Catering

### External catering/food service integration (diet orders → vendor → delivery tracking)
> As a **group administrator**, I want **external catering/food service integration (diet orders → vendor → delivery tracking)**.

`Pending · Platforms: Web · Source: RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The group administrator can external catering/food service integration (diet orders → vendor → delivery tracking) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Compliance

### Controlled substance prescription tracking (Narcotic/Schedule H1 external dispensing log)
> As a **group administrator**, I want **controlled substance prescription tracking (narcotic/schedule h1 external dispensing log)**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The group administrator can controlled substance prescription tracking (Narcotic/Schedule H1 external dispensing log) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Contracts

### ✅ Rate contract management (agreed pricing for fixed period with auto-expiry alerts)
> As a **group administrator**, I want **rate contract management (agreed pricing for fixed period with auto-expiry alerts)**.

`Done · Platforms: Web · Source: RFC · RFC: §Ext`

**Acceptance criteria**
- [x] The group administrator can rate contract management (agreed pricing for fixed period with auto-expiry alerts) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Purchase order generation and vendor acknowledgment tracking
> As a **group administrator**, I want **purchase order generation and vendor acknowledgment tracking**.

`Done · Platforms: Web · Source: RFC · RFC: §Ext`

**Acceptance criteria**
- [x] The group administrator can purchase order generation and vendor acknowledgment tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Equipment

### Medical equipment vendor management (AMC tracking, service call logging, response SLA)
> As a **group administrator**, I want **medical equipment vendor management (amc tracking, service call logging, response sla)**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The group administrator can medical equipment vendor management (AMC tracking, service call logging, response SLA) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Third-party equipment rental tracking (ventilators, CPAP, oxygen concentrators)
> As a **group administrator**, I want **third-party equipment rental tracking (ventilators, cpap, oxygen concentrators)**.

`Pending · Platforms: Web · Source: RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The group administrator can third-party equipment rental tracking (ventilators, CPAP, oxygen concentrators) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Fulfillment

### External pharmacy fulfillment tracking (sent → acknowledged → dispensed → picked up)
> As a **group administrator**, I want **external pharmacy fulfillment tracking (sent → acknowledged → dispensed → picked up)**.

`Pending · Platforms: Web · Source: RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The group administrator can external pharmacy fulfillment tracking (sent → acknowledged → dispensed → picked up) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Home delivery pharmacy integration (Dunzo, Swiggy Instamart, PharmEasy, 1mg)
> As a **group administrator**, I want **home delivery pharmacy integration (dunzo, swiggy instamart, pharmeasy, 1mg)**.

`Pending · Platforms: Web · Source: RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The group administrator can home delivery pharmacy integration (Dunzo, Swiggy Instamart, PharmEasy, 1mg) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## General

### Anonymized KPI sharing — hospitals opt-in to share metrics (ALOS, infection rate, mortality) with peer network
> As a **group administrator**, I want **anonymized kpi sharing — hospitals opt-in to share metrics (alos, infection rate, mortality) with peer network**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The group administrator can anonymized KPI sharing — hospitals opt-in to share metrics (ALOS, infection rate, mortality) with peer network from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Peer comparison dashboards — compare your hospital's KPIs against anonymized peers by size/type/region
> As a **group administrator**, I want **peer comparison dashboards — compare your hospital's kpis against anonymized peers by size/type/region**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The group administrator can peer comparison dashboards — compare your hospital's KPIs against anonymized peers by size/type/region from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### National/regional percentile ranking — see where your hospital stands (top 10%, median, bottom quartile)
> As a **group administrator**, I want **national/regional percentile ranking — see where your hospital stands (top 10%, median, bottom quartile)**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The group administrator can national/regional percentile ranking — see where your hospital stands (top 10%, median, bottom quartile) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Department-level benchmarking — compare ED wait times, OT utilization, lab TAT against peer averages
> As a **group administrator**, I want **department-level benchmarking — compare ed wait times, ot utilization, lab tat against peer averages**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The group administrator can department-level benchmarking — compare ED wait times, OT utilization, lab TAT against peer averages from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Custom peer group creation — define peer group by bed count, specialty mix, location, accreditation status
> As a **group administrator**, I want **custom peer group creation — define peer group by bed count, specialty mix, location, accreditation status**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The group administrator can custom peer group creation — define peer group by bed count, specialty mix, location, accreditation status from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Accreditation readiness score — auto-calculated NABH/JCI readiness percentage with gap identification
> As a **group administrator**, I want **accreditation readiness score — auto-calculated nabh/jci readiness percentage with gap identification**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The group administrator can accreditation readiness score — auto-calculated NABH/JCI readiness percentage with gap identification from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Revenue per bed benchmarking — compare revenue metrics against similar-sized hospitals in same region
> As a **group administrator**, I want **revenue per bed benchmarking — compare revenue metrics against similar-sized hospitals in same region**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The group administrator can revenue per bed benchmarking — compare revenue metrics against similar-sized hospitals in same region from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Staffing ratio benchmarking — nurse-to-patient ratio, doctor-to-bed ratio vs recommended standards
> As a **group administrator**, I want **staffing ratio benchmarking — nurse-to-patient ratio, doctor-to-bed ratio vs recommended standards**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The group administrator can staffing ratio benchmarking — nurse-to-patient ratio, doctor-to-bed ratio vs recommended standards from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Infection rate benchmarking — HAI rates compared to NHSN (US) or INICC (India) published benchmarks
> As a **group administrator**, I want **infection rate benchmarking — hai rates compared to nhsn (us) or inicc (india) published benchmarks**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The group administrator can infection rate benchmarking — HAI rates compared to NHSN (US) or INICC (India) published benchmarks from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Cost-per-case analysis — compare treatment costs by DRG/procedure against regional averages
> As a **group administrator**, I want **cost-per-case analysis — compare treatment costs by drg/procedure against regional averages**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The group administrator can cost-per-case analysis — compare treatment costs by DRG/procedure against regional averages from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Best-practice recommendations — AI-generated suggestions based on top-performing peers' configurations
> As a **group administrator**, I want **best-practice recommendations — ai-generated suggestions based on top-performing peers' configurations**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The group administrator can best-practice recommendations — AI-generated suggestions based on top-performing peers' configurations from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Benchmark trend alerts — auto-notify when your metric falls below peer average for 3 consecutive months
> As a **group administrator**, I want **benchmark trend alerts — auto-notify when your metric falls below peer average for 3 consecutive months**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The group administrator can benchmark trend alerts — auto-notify when your metric falls below peer average for 3 consecutive months from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Benchmarking reports for board/management — exportable PDF/PPT with peer comparison charts
> As a **group administrator**, I want **benchmarking reports for board/management — exportable pdf/ppt with peer comparison charts**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The group administrator can benchmarking reports for board/management — exportable PDF/PPT with peer comparison charts from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Multi-language patient concierge portal — English, Arabic, Russian, Chinese, French, German interface
> As a **group administrator**, I want **multi-language patient concierge portal — english, arabic, russian, chinese, french, german interface**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The group administrator can multi-language patient concierge portal — English, Arabic, Russian, Chinese, French, German interface from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Visa invitation letter generation — hospital letterhead with treatment plan, cost estimate, doctor details
> As a **group administrator**, I want **visa invitation letter generation — hospital letterhead with treatment plan, cost estimate, doctor details**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The group administrator can visa invitation letter generation — hospital letterhead with treatment plan, cost estimate, doctor details from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Airport pickup/drop coordination — vehicle assignment, driver details, estimated arrival notification
> As a **group administrator**, I want **airport pickup/drop coordination — vehicle assignment, driver details, estimated arrival notification**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The group administrator can airport pickup/drop coordination — vehicle assignment, driver details, estimated arrival notification from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### International patient coordinator assignment — dedicated communication channel per patient
> As a **group administrator**, I want **international patient coordinator assignment — dedicated communication channel per patient**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The group administrator can international patient coordinator assignment — dedicated communication channel per patient from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Travel & accommodation booking assistance — partner hotel listing with proximity, pricing, availability
> As a **group administrator**, I want **travel & accommodation booking assistance — partner hotel listing with proximity, pricing, availability**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The group administrator can travel & accommodation booking assistance — partner hotel listing with proximity, pricing, availability from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Multi-currency billing — USD, AED, EUR, GBP, RUB with live exchange rates and currency conversion
> As a **group administrator**, I want **multi-currency billing — usd, aed, eur, gbp, rub with live exchange rates and currency conversion**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The group administrator can multi-currency billing — USD, AED, EUR, GBP, RUB with live exchange rates and currency conversion from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### International insurance processing — BUPA, Allianz, Aetna, Cigna claim formats and direct settlement
> As a **group administrator**, I want **international insurance processing — bupa, allianz, aetna, cigna claim formats and direct settlement**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The group administrator can international insurance processing — BUPA, Allianz, Aetna, Cigna claim formats and direct settlement from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Interpreter/translator service booking — per language per appointment with availability calendar
> As a **group administrator**, I want **interpreter/translator service booking — per language per appointment with availability calendar**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The group administrator can interpreter/translator service booking — per language per appointment with availability calendar from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Medical visa documentation package — treatment summary, cost breakdown, doctor credentials bundle
> As a **group administrator**, I want **medical visa documentation package — treatment summary, cost breakdown, doctor credentials bundle**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The group administrator can medical visa documentation package — treatment summary, cost breakdown, doctor credentials bundle from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### International patient outcomes portfolio — success stories filterable by nationality and procedure
> As a **group administrator**, I want **international patient outcomes portfolio — success stories filterable by nationality and procedure**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The group administrator can international patient outcomes portfolio — success stories filterable by nationality and procedure from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Post-return telehealth follow-up — cross-timezone scheduling for international patient aftercare
> As a **group administrator**, I want **post-return telehealth follow-up — cross-timezone scheduling for international patient aftercare**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The group administrator can post-return telehealth follow-up — cross-timezone scheduling for international patient aftercare from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Medical tourism package builder — treatment + hospital stay + hotel + travel as bundled pricing
> As a **group administrator**, I want **medical tourism package builder — treatment + hospital stay + hotel + travel as bundled pricing**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The group administrator can medical tourism package builder — treatment + hospital stay + hotel + travel as bundled pricing from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Housekeeping

### Outsourced housekeeping vendor integration (task assignment, SLA tracking)
> As a **group administrator**, I want **outsourced housekeeping vendor integration (task assignment, sla tracking)**.

`Pending · Platforms: Web · Source: RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The group administrator can outsourced housekeeping vendor integration (task assignment, SLA tracking) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Insurance

### TPA (Third-Party Administrator) portal integration (pre-auth, claims, denials)
> As a **group administrator**, I want **tpa (third-party administrator) portal integration (pre-auth, claims, denials)**.

`Pending · Platforms: Web · Source: RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The group administrator can tPA (Third-Party Administrator) portal integration (pre-auth, claims, denials) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Inventory

### ✅ Inter-hospital stock transfer with automated replenishment
> As a **group administrator**, I want **inter-hospital stock transfer with automated replenishment**.

`Done · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [x] The group administrator can inter-hospital stock transfer with automated replenishment from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Centralized procurement with hospital-wise indent and allocation
> As a **group administrator**, I want **centralized procurement with hospital-wise indent and allocation**.

`Partial · Platforms: Web, Mobile · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The group administrator can centralized procurement with hospital-wise indent and allocation from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Group purchasing organization (GPO) rate negotiation tracking
> As a **group administrator**, I want **group purchasing organization (gpo) rate negotiation tracking**.

`Partial · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The group administrator can group purchasing organization (GPO) rate negotiation tracking from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Laundry

### External laundry service tracking (pickup → wash → return with item count reconciliation)
> As a **group administrator**, I want **external laundry service tracking (pickup → wash → return with item count reconciliation)**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The group administrator can external laundry service tracking (pickup → wash → return with item count reconciliation) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## NABL

### NABL accredited lab preference in routing rules
> As a **group administrator**, I want **nabl accredited lab preference in routing rules**.

`Pending · Platforms: Web · Source: RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The group administrator can nABL accredited lab preference in routing rules from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Onboarding

### ✅ Vendor registration and onboarding (license, GST, drug license, NABL cert upload)
> As a **group administrator**, I want **vendor registration and onboarding (license, gst, drug license, nabl cert upload)**.

`Done · Platforms: Web · Source: RFC · RFC: §Ext`

**Acceptance criteria**
- [x] The group administrator can vendor registration and onboarding (license, GST, drug license, NABL cert upload) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Vendor qualification assessment (quality audit, delivery performance, pricing)
> As a **group administrator**, I want **vendor qualification assessment (quality audit, delivery performance, pricing)**.

`Partial · Platforms: Web · Source: RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The group administrator can vendor qualification assessment (quality audit, delivery performance, pricing) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Orders

### Reference lab order routing — auto-route tests not available in-house to partner lab
> As a **group administrator**, I want **reference lab order routing — auto-route tests not available in-house to partner lab**.

`Pending · Platforms: Web · Source: RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The group administrator can reference lab order routing — auto-route tests not available in-house to partner lab from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Reference lab directory with test menu, pricing, TAT per lab
> As a **group administrator**, I want **reference lab directory with test menu, pricing, tat per lab**.

`Pending · Platforms: Web · Source: RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The group administrator can reference lab directory with test menu, pricing, TAT per lab from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### HL7/FHIR-based order transmission to external labs (ORM/OBR messages)
> As a **group administrator**, I want **hl7/fhir-based order transmission to external labs (orm/obr messages)**.

`Pending · Platforms: Web · Source: RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The group administrator can hL7/FHIR-based order transmission to external labs (ORM/OBR messages) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## PACS

### Cloud PACS integration for multi-site image access
> As a **group administrator**, I want **cloud pacs integration for multi-site image access**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The group administrator can cloud PACS integration for multi-site image access from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Payments

### Vendor payment tracking (invoice → approval → payment → reconciliation)
> As a **group administrator**, I want **vendor payment tracking (invoice → approval → payment → reconciliation)**.

`Partial · Platforms: Web · Source: RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The group administrator can vendor payment tracking (invoice → approval → payment → reconciliation) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### GST input credit tracking per vendor invoice
> As a **group administrator**, I want **gst input credit tracking per vendor invoice**.

`Partial · Platforms: Web · Source: RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The group administrator can gST input credit tracking per vendor invoice from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Performance

### Vendor performance scorecard (delivery timeliness, quality rejections, pricing compliance)
> As a **group administrator**, I want **vendor performance scorecard (delivery timeliness, quality rejections, pricing compliance)**.

`Partial · Platforms: Web · Source: RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The group administrator can vendor performance scorecard (delivery timeliness, quality rejections, pricing compliance) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Vendor comparison analytics (price comparison across vendors per item)
> As a **group administrator**, I want **vendor comparison analytics (price comparison across vendors per item)**.

`Partial · Platforms: Web · Source: RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The group administrator can vendor comparison analytics (price comparison across vendors per item) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Prescribing

### E-prescribing to external/retail pharmacies (electronic Rx transmission)
> As a **group administrator**, I want **e-prescribing to external/retail pharmacies (electronic rx transmission)**.

`Pending · Platforms: Web, Mobile · Source: RFC+Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The group administrator can e-prescribing to external/retail pharmacies (electronic Rx transmission) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Pharmacy network directory (nearby pharmacies with stock availability)
> As a **group administrator**, I want **pharmacy network directory (nearby pharmacies with stock availability)**.

`Pending · Platforms: Web · Source: RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The group administrator can pharmacy network directory (nearby pharmacies with stock availability) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Prescription routing — in-house first, external if out-of-stock or patient preference
> As a **group administrator**, I want **prescription routing — in-house first, external if out-of-stock or patient preference**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The group administrator can prescription routing — in-house first, external if out-of-stock or patient preference from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Pricing

### ✅ Centralized tariff management with hospital-level price overrides
> As a **group administrator**, I want **centralized tariff management with hospital-level price overrides**.

`Done · Platforms: Web, Mobile · Source: RFC · RFC: §3`

**Acceptance criteria**
- [x] The group administrator can centralized tariff management with hospital-level price overrides from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Multi-currency support (INR, USD, AED, SAR, etc.) per hospital
> As a **group administrator**, I want **multi-currency support (inr, usd, aed, sar, etc.) per hospital**.

`Partial · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The group administrator can multi-currency support (INR, USD, AED, SAR, etc.) per hospital from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## QC

### External lab quality monitoring (proficiency testing results, accreditation status)
> As a **group administrator**, I want **external lab quality monitoring (proficiency testing results, accreditation status)**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The group administrator can external lab quality monitoring (proficiency testing results, accreditation status) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Refill

### Prescription refill request from patient to external pharmacy via app
> As a **group administrator**, I want **prescription refill request from patient to external pharmacy via app**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The group administrator can prescription refill request from patient to external pharmacy via app from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Reporting

### ✅ Consolidated dashboard — all hospitals on one screen (occupancy, revenue, patient volume)
> As a **group administrator**, I want **consolidated dashboard — all hospitals on one screen (occupancy, revenue, patient volume)**.

`Done · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [x] The group administrator can consolidated dashboard — all hospitals on one screen (occupancy, revenue, patient volume) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Hospital-wise P&L (profit & loss) reporting
> As a **group administrator**, I want **hospital-wise p&l (profit & loss) reporting**.

`Done · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [x] The group administrator can hospital-wise P&L (profit & loss) reporting from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Cross-hospital benchmarking (ALOS, infection rate, readmission by branch)
> As a **group administrator**, I want **cross-hospital benchmarking (alos, infection rate, readmission by branch)**.

`Done · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [x] The group administrator can cross-hospital benchmarking (ALOS, infection rate, readmission by branch) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Consolidated HR reporting (staff count, attrition, training compliance by branch)
> As a **group administrator**, I want **consolidated hr reporting (staff count, attrition, training compliance by branch)**.

`Partial · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The group administrator can consolidated HR reporting (staff count, attrition, training compliance by branch) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Chain-wide quality indicator dashboard (NABH indicators aggregated)
> As a **group administrator**, I want **chain-wide quality indicator dashboard (nabh indicators aggregated)**.

`Partial · Platforms: Web, Mobile · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The group administrator can chain-wide quality indicator dashboard (NABH indicators aggregated) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Inter-hospital referral pattern analysis (which branches refer where)
> As a **group administrator**, I want **inter-hospital referral pattern analysis (which branches refer where)**.

`Partial · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The group administrator can inter-hospital referral pattern analysis (which branches refer where) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### DICOM image transmission to external reporting radiologist (teleradiology)
> As a **group administrator**, I want **dicom image transmission to external reporting radiologist (teleradiology)**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The group administrator can dICOM image transmission to external reporting radiologist (teleradiology) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### External radiologist report ingestion (structured report with findings/impression)
> As a **group administrator**, I want **external radiologist report ingestion (structured report with findings/impression)**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The group administrator can external radiologist report ingestion (structured report with findings/impression) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### After-hours / weekend teleradiology routing (auto-send to night-reading partner)
> As a **group administrator**, I want **after-hours / weekend teleradiology routing (auto-send to night-reading partner)**.

`Pending · Platforms: Web · Source: RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The group administrator can after-hours / weekend teleradiology routing (auto-send to night-reading partner) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Results

### Automatic result ingestion from reference lab (HL7 ORU / FHIR DiagnosticReport)
> As a **group administrator**, I want **automatic result ingestion from reference lab (hl7 oru / fhir diagnosticreport)**.

`Pending · Platforms: Web · Source: RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The group administrator can automatic result ingestion from reference lab (HL7 ORU / FHIR DiagnosticReport) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### External lab result review and approval workflow before patient release
> As a **group administrator**, I want **external lab result review and approval workflow before patient release**.

`Pending · Platforms: Web · Source: RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The group administrator can external lab result review and approval workflow before patient release from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Result branding — hospital logo on report even when test done at reference lab
> As a **group administrator**, I want **result branding — hospital logo on report even when test done at reference lab**.

`Pending · Platforms: Web · Source: RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The group administrator can result branding — hospital logo on report even when test done at reference lab from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Sample

### Sample pickup coordination (external lab courier scheduling and tracking)
> As a **group administrator**, I want **sample pickup coordination (external lab courier scheduling and tracking)**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The group administrator can sample pickup coordination (external lab courier scheduling and tracking) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Sample handover documentation with temperature and time logging
> As a **group administrator**, I want **sample handover documentation with temperature and time logging**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The group administrator can sample handover documentation with temperature and time logging from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Security

### Outsourced security vendor management (guard deployment, incident reporting)
> As a **group administrator**, I want **outsourced security vendor management (guard deployment, incident reporting)**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The group administrator can outsourced security vendor management (guard deployment, incident reporting) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Staff

### ✅ Doctor rotation scheduling across branches
> As a **group administrator**, I want **doctor rotation scheduling across branches**.

`Done · Platforms: Web, Mobile · Source: RFC · RFC: §3`

**Acceptance criteria**
- [x] The group administrator can doctor rotation scheduling across branches from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Locum / visiting consultant scheduling at multiple hospitals
> As a **group administrator**, I want **locum / visiting consultant scheduling at multiple hospitals**.

`Done · Platforms: Web, Mobile · Source: RFC · RFC: §3`

**Acceptance criteria**
- [x] The group administrator can locum / visiting consultant scheduling at multiple hospitals from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## TAT

### External lab TAT tracking with SLA breach alerts
> As a **group administrator**, I want **external lab tat tracking with sla breach alerts**.

`Pending · Platforms: Web · Source: RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The group administrator can external lab TAT tracking with SLA breach alerts from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Transfer

### ✅ Inter-hospital patient transfer with clinical data handover
> As a **group administrator**, I want **inter-hospital patient transfer with clinical data handover**.

`Done · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [x] The group administrator can inter-hospital patient transfer with clinical data handover from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Cross-hospital appointment booking (patient books at any branch)
> As a **group administrator**, I want **cross-hospital appointment booking (patient books at any branch)**.

`Partial · Platforms: Web, Mobile · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The group administrator can cross-hospital appointment booking (patient books at any branch) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Lab sample routing to sister hospital (if test not available locally)
> As a **group administrator**, I want **lab sample routing to sister hospital (if test not available locally)**.

`Partial · Platforms: Web · Source: RFC · RFC: §3`

**Acceptance criteria**
- [ ] The group administrator can lab sample routing to sister hospital (if test not available locally) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Cross-tenant data boundaries enforced; vendor / head-office scoping respected.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

