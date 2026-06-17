# Onboarding & Setup — stories

_Auto-generated from `MedBrains_Features.xlsx` — every feature as a story with module-tailored acceptance criteria. 159 stories (✅ = Done). Source of truth is the xlsx; regenerate via `python3 scripts/generate_stories.py`._

## General

### ✅ Welcome page with system requirements check (DB, ports, disk space)
> As a **hospital admin**, I want **welcome page with system requirements check (db, ports, disk space)**.

`P0 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can welcome page with system requirements check (DB, ports, disk space) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Auto-detect environment (Docker vs bare-metal vs cloud)
> As a **hospital admin**, I want **auto-detect environment (docker vs bare-metal vs cloud)**.

`P0 · Partial · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [ ] The hospital admin can auto-detect environment (Docker vs bare-metal vs cloud) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Database connection setup wizard (PostgreSQL host, port, credentials)
> As a **hospital admin**, I want **database connection setup wizard (postgresql host, port, credentials)**.

`P0 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can database connection setup wizard (PostgreSQL host, port, credentials) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Database creation and migration runner with progress indicator
> As a **hospital admin**, I want **database creation and migration runner with progress indicator**.

`P0 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can database creation and migration runner with progress indicator from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Seed default data option (demo data vs clean start)
> As a **hospital admin**, I want **seed default data option (demo data vs clean start)**.

`P0 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can seed default data option (demo data vs clean start) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Environment variable generator (.env file creation)
> As a **hospital admin**, I want **environment variable generator (.env file creation)**.

`P0 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can environment variable generator (.env file creation) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Create first super admin account (username, email, password)
> As a **hospital admin**, I want **create first super admin account (username, email, password)**.

`P0 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can create first super admin account (username, email, password) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Password strength validation (min 12 chars, complexity rules)
> As a **hospital admin**, I want **password strength validation (min 12 chars, complexity rules)**.

`P0 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can password strength validation (min 12 chars, complexity rules) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Recovery email setup for password reset
> As a **hospital admin**, I want **recovery email setup for password reset**.

`P0 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can recovery email setup for password reset from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Two-factor authentication setup (optional during onboarding)
> As a **hospital admin**, I want **two-factor authentication setup (optional during onboarding)**.

`P1 · Pending · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [ ] The hospital admin can two-factor authentication setup (optional during onboarding) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Hospital name, code, type (medical college, multi-specialty, etc.)
> As a **hospital admin**, I want **hospital name, code, type (medical college, multi-specialty, etc.)**.

`P0 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can hospital name, code, type (medical college, multi-specialty, etc.) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Hospital address, phone, email, website
> As a **hospital admin**, I want **hospital address, phone, email, website**.

`P0 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can hospital address, phone, email, website from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Hospital logo upload (used in headers, reports, prints)
> As a **hospital admin**, I want **hospital logo upload (used in headers, reports, prints)**.

`P0 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can hospital logo upload (used in headers, reports, prints) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Hospital registration number (state medical council)
> As a **hospital admin**, I want **hospital registration number (state medical council)**.

`P1 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can hospital registration number (state medical council) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ NABH/JCI accreditation number (optional)
> As a **hospital admin**, I want **nabh/jci accreditation number (optional)**.

`P1 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can nABH/JCI accreditation number (optional) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Timezone and locale configuration
> As a **hospital admin**, I want **timezone and locale configuration**.

`P0 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can timezone and locale configuration from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Currency and number format (INR, USD, etc.)
> As a **hospital admin**, I want **currency and number format (inr, usd, etc.)**.

`P0 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can currency and number format (INR, USD, etc.) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Financial year start month configuration
> As a **hospital admin**, I want **financial year start month configuration**.

`P1 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can financial year start month configuration from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Campus creation (name, address, geo-coordinates)
> As a **hospital admin**, I want **campus creation (name, address, geo-coordinates)**.

`P0 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can campus creation (name, address, geo-coordinates) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Building creation under campus
> As a **hospital admin**, I want **building creation under campus**.

`P0 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can building creation under campus from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Floor/wing/zone hierarchy builder
> As a **hospital admin**, I want **floor/wing/zone hierarchy builder**.

`P0 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can floor/wing/zone hierarchy builder from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Room creation (type: consultation, ward, OT, lab, etc.)
> As a **hospital admin**, I want **room creation (type: consultation, ward, ot, lab, etc.)**.

`P0 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can room creation (type: consultation, ward, OT, lab, etc.) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Bed creation with bed type (general, semi-private, private, ICU)
> As a **hospital admin**, I want **bed creation with bed type (general, semi-private, private, icu)**.

`P1 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can bed creation with bed type (general, semi-private, private, ICU) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Visual floor plan editor (drag-drop rooms/beds)
> As a **hospital admin**, I want **visual floor plan editor (drag-drop rooms/beds)**.

`P3 · Pending · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [ ] The hospital admin can visual floor plan editor (drag-drop rooms/beds) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Import locations from CSV/Excel
> As a **hospital admin**, I want **import locations from csv/excel**.

`P2 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can import locations from CSV/Excel from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Department creation (code, name, type: clinical/admin/support)
> As a **hospital admin**, I want **department creation (code, name, type: clinical/admin/support)**.

`P0 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can department creation (code, name, type: clinical/admin/support) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Department hierarchy (parent-child relationships)
> As a **hospital admin**, I want **department hierarchy (parent-child relationships)**.

`P1 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can department hierarchy (parent-child relationships) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Department-location mapping (which dept in which floor/wing)
> As a **hospital admin**, I want **department-location mapping (which dept in which floor/wing)**.

`P1 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can department-location mapping (which dept in which floor/wing) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Department head assignment
> As a **hospital admin**, I want **department head assignment**.

`P1 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can department head assignment from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Department working hours / schedule
> As a **hospital admin**, I want **department working hours / schedule**.

`P1 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can department working hours / schedule from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Import departments from CSV/Excel
> As a **hospital admin**, I want **import departments from csv/excel**.

`P2 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can import departments from CSV/Excel from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Pre-built department templates (General Hospital, Medical College)
> As a **hospital admin**, I want **pre-built department templates (general hospital, medical college)**.

`P2 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can pre-built department templates (General Hospital, Medical College) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Service creation (code, name, type, department, price)
> As a **hospital admin**, I want **service creation (code, name, type, department, price)**.

`P0 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can service creation (code, name, type, department, price) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Service category management
> As a **hospital admin**, I want **service category management**.

`P1 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can service category management from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Service-department mapping
> As a **hospital admin**, I want **service-department mapping**.

`P0 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can service-department mapping from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Service pricing (base price, tax, discount rules)
> As a **hospital admin**, I want **service pricing (base price, tax, discount rules)**.

`P1 · Partial · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [ ] The hospital admin can service pricing (base price, tax, discount rules) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Import services from CSV/Excel
> As a **hospital admin**, I want **import services from csv/excel**.

`P2 · Partial · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [ ] The hospital admin can import services from CSV/Excel from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Pre-built role templates (Super Admin, Doctor, Nurse, etc.)
> As a **hospital admin**, I want **pre-built role templates (super admin, doctor, nurse, etc.)**.

`P0 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can pre-built role templates (Super Admin, Doctor, Nurse, etc.) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Custom role creation with name and description
> As a **hospital admin**, I want **custom role creation with name and description**.

`P1 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can custom role creation with name and description from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Permission matrix editor (module × action grid)
> As a **hospital admin**, I want **permission matrix editor (module × action grid)**.

`P1 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can permission matrix editor (module × action grid) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Role hierarchy (admin > doctor > nurse > clerk)
> As a **hospital admin**, I want **role hierarchy (admin > doctor > nurse > clerk)**.

`P2 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can role hierarchy (admin > doctor > nurse > clerk) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Data scope per role (own patients, department, all)
> As a **hospital admin**, I want **data scope per role (own patients, department, all)**.

`P2 · Partial · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [ ] The hospital admin can data scope per role (own patients, department, all) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Single user creation form (name, email, role, department)
> As a **hospital admin**, I want **single user creation form (name, email, role, department)**.

`P0 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can single user creation form (name, email, role, department) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Bulk user import from CSV/Excel
> As a **hospital admin**, I want **bulk user import from csv/excel**.

`P1 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can bulk user import from CSV/Excel from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Doctor profile setup (registration number, specialization, qualification)
> As a **hospital admin**, I want **doctor profile setup (registration number, specialization, qualification)**.

`P1 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can doctor profile setup (registration number, specialization, qualification) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Staff ID card generation
> As a **hospital admin**, I want **staff id card generation**.

`P3 · Pending · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [ ] The hospital admin can staff ID card generation from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ User department and location assignment
> As a **hospital admin**, I want **user department and location assignment**.

`P0 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can user department and location assignment from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### User schedule/shift assignment
> As a **hospital admin**, I want **user schedule/shift assignment**.

`P2 · Partial · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [ ] The hospital admin can user schedule/shift assignment from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Welcome email with temporary password
> As a **hospital admin**, I want **welcome email with temporary password**.

`P1 · Partial · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [ ] The hospital admin can welcome email with temporary password from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Module enable/disable dashboard (OPD, IPD, Lab, Pharmacy, etc.)
> As a **hospital admin**, I want **module enable/disable dashboard (opd, ipd, lab, pharmacy, etc.)**.

`P0 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can module enable/disable dashboard (OPD, IPD, Lab, Pharmacy, etc.) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Module dependency check (e.g., Billing requires Patient module)
> As a **hospital admin**, I want **module dependency check (e.g., billing requires patient module)**.

`P1 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can module dependency check (e.g., Billing requires Patient module) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Module-specific configuration wizard per enabled module
> As a **hospital admin**, I want **module-specific configuration wizard per enabled module**.

`P1 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can module-specific configuration wizard per enabled module from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Feature flag management within each module
> As a **hospital admin**, I want **feature flag management within each module**.

`P2 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can feature flag management within each module from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Guided setup for each enabled module's master data
> As a **hospital admin**, I want **guided setup for each enabled module's master data**.

`P0 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can guided setup for each enabled module's master data from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### OPD masters: visit types, queue config, token format
> As a **hospital admin**, I want **opd masters: visit types, queue config, token format**.

`P1 · Partial · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [ ] The hospital admin can oPD masters: visit types, queue config, token format from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Lab masters: test catalog, sample types, equipment, reagents
> As a **hospital admin**, I want **lab masters: test catalog, sample types, equipment, reagents**.

`P1 · Partial · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [ ] The hospital admin can lab masters: test catalog, sample types, equipment, reagents from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Pharmacy masters: drug catalog, formulations, manufacturers
> As a **hospital admin**, I want **pharmacy masters: drug catalog, formulations, manufacturers**.

`P1 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can pharmacy masters: drug catalog, formulations, manufacturers from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Billing masters: charge master, tax config, payment modes
> As a **hospital admin**, I want **billing masters: charge master, tax config, payment modes**.

`P1 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can billing masters: charge master, tax config, payment modes from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### IPD masters: ward types, bed categories, diet plans
> As a **hospital admin**, I want **ipd masters: ward types, bed categories, diet plans**.

`P1 · Partial · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [ ] The hospital admin can iPD masters: ward types, bed categories, diet plans from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Radiology masters: modality types, body parts, protocols
> As a **hospital admin**, I want **radiology masters: modality types, body parts, protocols**.

`P2 · Partial · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [ ] The hospital admin can radiology masters: modality types, body parts, protocols from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Skip master setup (configure later from module settings)
> As a **hospital admin**, I want **skip master setup (configure later from module settings)**.

`P1 · Partial · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [ ] The hospital admin can skip master setup (configure later from module settings) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ UHID format configuration (prefix, padding, separator)
> As a **hospital admin**, I want **uhid format configuration (prefix, padding, separator)**.

`P0 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can uHID format configuration (prefix, padding, separator) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Invoice number format (prefix-year-sequence)
> As a **hospital admin**, I want **invoice number format (prefix-year-sequence)**.

`P0 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can invoice number format (prefix-year-sequence) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Lab order number format
> As a **hospital admin**, I want **lab order number format**.

`P1 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can lab order number format from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Admission number format
> As a **hospital admin**, I want **admission number format**.

`P1 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can admission number format from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ OPD token format (daily reset vs continuous)
> As a **hospital admin**, I want **opd token format (daily reset vs continuous)**.

`P1 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can oPD token format (daily reset vs continuous) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Custom sequence creation for any entity
> As a **hospital admin**, I want **custom sequence creation for any entity**.

`P2 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can custom sequence creation for any entity from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Starting number configuration per sequence
> As a **hospital admin**, I want **starting number configuration per sequence**.

`P1 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can starting number configuration per sequence from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Email provider setup (SMTP / SendGrid / SES)
> As a **hospital admin**, I want **email provider setup (smtp / sendgrid / ses)**.

`P1 · Partial · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [ ] The hospital admin can email provider setup (SMTP / SendGrid / SES) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### SMS provider setup (Twilio / MSG91 / custom)
> As a **hospital admin**, I want **sms provider setup (twilio / msg91 / custom)**.

`P1 · Partial · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [ ] The hospital admin can sMS provider setup (Twilio / MSG91 / custom) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### WhatsApp Business API setup (optional)
> As a **hospital admin**, I want **whatsapp business api setup (optional)**.

`P2 · Pending · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [ ] The hospital admin can whatsApp Business API setup (optional) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Push notification setup (FCM for mobile)
> As a **hospital admin**, I want **push notification setup (fcm for mobile)**.

`P2 · Pending · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [ ] The hospital admin can push notification setup (FCM for mobile) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ABDM (Ayushman Bharat Digital Mission) integration setup
> As a **hospital admin**, I want **abdm (ayushman bharat digital mission) integration setup**.

`P2 · Pending · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [ ] The hospital admin can aBDM (Ayushman Bharat Digital Mission) integration setup from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Payment gateway setup (Razorpay / Stripe / PayU)
> As a **hospital admin**, I want **payment gateway setup (razorpay / stripe / payu)**.

`P2 · Pending · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [ ] The hospital admin can payment gateway setup (Razorpay / Stripe / PayU) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Lab equipment interface setup (HL7/ASTM)
> As a **hospital admin**, I want **lab equipment interface setup (hl7/astm)**.

`P3 · Pending · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [ ] The hospital admin can lab equipment interface setup (HL7/ASTM) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### PACS/DICOM server connection setup
> As a **hospital admin**, I want **pacs/dicom server connection setup**.

`P3 · Pending · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [ ] The hospital admin can pACS/DICOM server connection setup from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Hospital logo upload (multiple sizes: header, favicon, print)
> As a **hospital admin**, I want **hospital logo upload (multiple sizes: header, favicon, print)**.

`P0 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can hospital logo upload (multiple sizes: header, favicon, print) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Brand colors configuration (primary, secondary, accent)
> As a **hospital admin**, I want **brand colors configuration (primary, secondary, accent)**.

`P1 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can brand colors configuration (primary, secondary, accent) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Custom login page branding (background, tagline)
> As a **hospital admin**, I want **custom login page branding (background, tagline)**.

`P2 · Partial · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [ ] The hospital admin can custom login page branding (background, tagline) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Letterhead template setup (header, footer, margins)
> As a **hospital admin**, I want **letterhead template setup (header, footer, margins)**.

`P1 · Partial · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [ ] The hospital admin can letterhead template setup (header, footer, margins) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Prescription pad template
> As a **hospital admin**, I want **prescription pad template**.

`P1 · Partial · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [ ] The hospital admin can prescription pad template from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Invoice/receipt template
> As a **hospital admin**, I want **invoice/receipt template**.

`P1 · Partial · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [ ] The hospital admin can invoice/receipt template from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Lab report template
> As a **hospital admin**, I want **lab report template**.

`P2 · Pending · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [ ] The hospital admin can lab report template from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Discharge summary template
> As a **hospital admin**, I want **discharge summary template**.

`P2 · Pending · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [ ] The hospital admin can discharge summary template from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ One-command Docker Compose setup (make setup / docker compose up)
> As a **hospital admin**, I want **one-command docker compose setup (make setup / docker compose up)**.

`P0 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can one-command Docker Compose setup (make setup / docker compose up) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Kubernetes Helm chart for production deployment
> As a **hospital admin**, I want **kubernetes helm chart for production deployment**.

`P3 · Pending · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [ ] The hospital admin can kubernetes Helm chart for production deployment from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ARM64 support (Raspberry Pi / Apple Silicon)
> As a **hospital admin**, I want **arm64 support (raspberry pi / apple silicon)**.

`P2 · Partial · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [ ] The hospital admin can aRM64 support (Raspberry Pi / Apple Silicon) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Automatic HTTPS via Let's Encrypt / Caddy
> As a **hospital admin**, I want **automatic https via let's encrypt / caddy**.

`P2 · Pending · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [ ] The hospital admin can automatic HTTPS via Let's Encrypt / Caddy from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Database backup schedule configuration
> As a **hospital admin**, I want **database backup schedule configuration**.

`P1 · Partial · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [ ] The hospital admin can database backup schedule configuration from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Auto-update checker with changelog display
> As a **hospital admin**, I want **auto-update checker with changelog display**.

`P2 · Pending · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [ ] The hospital admin can auto-update checker with changelog display from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Contributor setup guide (CONTRIBUTING.md auto-generator)
> As a **hospital admin**, I want **contributor setup guide (contributing.md auto-generator)**.

`P2 · Pending · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [ ] The hospital admin can contributor setup guide (CONTRIBUTING.md auto-generator) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Plugin/extension system for community modules
> As a **hospital admin**, I want **plugin/extension system for community modules**.

`P3 · Pending · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [ ] The hospital admin can plugin/extension system for community modules from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Theme marketplace (community-contributed themes)
> As a **hospital admin**, I want **theme marketplace (community-contributed themes)**.

`P3 · Pending · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [ ] The hospital admin can theme marketplace (community-contributed themes) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Master data marketplace (pre-built ICD codes, drug lists, etc.)
> As a **hospital admin**, I want **master data marketplace (pre-built icd codes, drug lists, etc.)**.

`P2 · Pending · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [ ] The hospital admin can master data marketplace (pre-built ICD codes, drug lists, etc.) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Multi-language support setup (i18n configuration)
> As a **hospital admin**, I want **multi-language support setup (i18n configuration)**.

`P2 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can multi-language support setup (i18n configuration) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Telemetry opt-in for anonymous usage analytics
> As a **hospital admin**, I want **telemetry opt-in for anonymous usage analytics**.

`P3 · Pending · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [ ] The hospital admin can telemetry opt-in for anonymous usage analytics from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Interactive demo mode with sample hospital data
> As a **hospital admin**, I want **interactive demo mode with sample hospital data**.

`P1 · Partial · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [ ] The hospital admin can interactive demo mode with sample hospital data from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### In-app guided tours (first-time user tooltips)
> As a **hospital admin**, I want **in-app guided tours (first-time user tooltips)**.

`P1 · Pending · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [ ] The hospital admin can in-app guided tours (first-time user tooltips) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Contextual help links to documentation
> As a **hospital admin**, I want **contextual help links to documentation**.

`P2 · Pending · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [ ] The hospital admin can contextual help links to documentation from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Video tutorial links per module
> As a **hospital admin**, I want **video tutorial links per module**.

`P3 · Pending · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [ ] The hospital admin can video tutorial links per module from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ API documentation auto-generation (OpenAPI/Swagger)
> As a **hospital admin**, I want **api documentation auto-generation (openapi/swagger)**.

`P1 · Done · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [x] The hospital admin can aPI documentation auto-generation (OpenAPI/Swagger) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Postman/Bruno collection export
> As a **hospital admin**, I want **postman/bruno collection export**.

`P2 · Pending · Platforms: Web · Source: MedBrains`

**Acceptance criteria**
- [ ] The hospital admin can postman/Bruno collection export from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Country selection dropdown with auto-defaults (timezone, currency, locale, fiscal year)
> As a **hospital admin**, I want **country selection dropdown with auto-defaults (timezone, currency, locale, fiscal year)**.

`P0 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [x] The hospital admin can country selection dropdown with auto-defaults (timezone, currency, locale, fiscal year) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ State/Province cascading dropdown (filtered by country)
> As a **hospital admin**, I want **state/province cascading dropdown (filtered by country)**.

`P0 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [x] The hospital admin can state/Province cascading dropdown (filtered by country) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ District cascading dropdown (filtered by state)
> As a **hospital admin**, I want **district cascading dropdown (filtered by state)**.

`P0 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [x] The hospital admin can district cascading dropdown (filtered by state) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Sub-district/Taluk/Tehsil cascading dropdown (filtered by district)
> As a **hospital admin**, I want **sub-district/taluk/tehsil cascading dropdown (filtered by district)**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [ ] The hospital admin can sub-district/Taluk/Tehsil cascading dropdown (filtered by district) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Town/City selection (filtered by sub-district)
> As a **hospital admin**, I want **town/city selection (filtered by sub-district)**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [ ] The hospital admin can town/City selection (filtered by sub-district) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ PIN code reverse-lookup (enter PIN → auto-fill full geographic hierarchy)
> As a **hospital admin**, I want **pin code reverse-lookup (enter pin → auto-fill full geographic hierarchy)**.

`P0 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [x] The hospital admin can pIN code reverse-lookup (enter PIN → auto-fill full geographic hierarchy) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### GPS coordinate capture (manual entry or browser geolocation API)
> As a **hospital admin**, I want **gps coordinate capture (manual entry or browser geolocation api)**.

`P2 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [ ] The hospital admin can gPS coordinate capture (manual entry or browser geolocation API) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Local language name display for geographic entities (e.g., Tamil for TN districts)
> As a **hospital admin**, I want **local language name display for geographic entities (e.g., tamil for tn districts)**.

`P2 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [ ] The hospital admin can local language name display for geographic entities (e.g., Tamil for TN districts) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Pre-seeded India data: 36 states, ~780 districts, ~6700 subdistricts, ~8000 towns
> As a **hospital admin**, I want **pre-seeded india data: 36 states, ~780 districts, ~6700 subdistricts, ~8000 towns**.

`P0 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [x] The hospital admin can pre-seeded India data: 36 states, ~780 districts, ~6700 subdistricts, ~8000 towns from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Pre-seeded PIN code mapping (~30,000 Indian postal codes)
> As a **hospital admin**, I want **pre-seeded pin code mapping (~30,000 indian postal codes)**.

`P0 · Partial · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [ ] The hospital admin can pre-seeded PIN code mapping (~30,000 Indian postal codes) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### CSV import for additional countries' geographic data
> As a **hospital admin**, I want **csv import for additional countries' geographic data**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [ ] The hospital admin can cSV import for additional countries' geographic data from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Hierarchy integrity validation on geographic data import
> As a **hospital admin**, I want **hierarchy integrity validation on geographic data import**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [ ] The hospital admin can hierarchy integrity validation on geographic data import from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Admin-only geographic data management (tenants can only select, not modify)
> As a **hospital admin**, I want **admin-only geographic data management (tenants can only select, not modify)**.

`P0 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [x] The hospital admin can admin-only geographic data management (tenants can only select, not modify) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Auto-detect applicable regulatory bodies based on hospital location
> As a **hospital admin**, I want **auto-detect applicable regulatory bodies based on hospital location**.

`P0 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [x] The hospital admin can auto-detect applicable regulatory bodies based on hospital location from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ International regulators (WHO, JCI) shown for all locations
> As a **hospital admin**, I want **international regulators (who, jci) shown for all locations**.

`P0 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [x] The hospital admin can international regulators (WHO, JCI) shown for all locations from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ National regulators auto-mapped based on country (NMC, NABH, CDSCO, CPCB, CEA for India)
> As a **hospital admin**, I want **national regulators auto-mapped based on country (nmc, nabh, cdsco, cpcb, cea for india)**.

`P0 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [x] The hospital admin can national regulators auto-mapped based on country (NMC, NABH, CDSCO, CPCB, CEA for India) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ State-level regulators auto-mapped (State Medical Council, Drug Controller, PCB)
> As a **hospital admin**, I want **state-level regulators auto-mapped (state medical council, drug controller, pcb)**.

`P0 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [x] The hospital admin can state-level regulators auto-mapped (State Medical Council, Drug Controller, PCB) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### District-level regulators auto-mapped (DHO, CMHO)
> As a **hospital admin**, I want **district-level regulators auto-mapped (dho, cmho)**.

`P1 · Partial · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [ ] The hospital admin can district-level regulators auto-mapped (DHO, CMHO) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Conditional regulators based on enabled modules (AERB for radiology, NACO for blood bank, FSSAI for diet)
> As a **hospital admin**, I want **conditional regulators based on enabled modules (aerb for radiology, naco for blood bank, fssai for diet)**.

`P0 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [x] The hospital admin can conditional regulators based on enabled modules (AERB for radiology, NACO for blood bank, FSSAI for diet) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Education-specific regulators per facility type (PCI for pharmacy, INC for nursing, DCI for dental)
> As a **hospital admin**, I want **education-specific regulators per facility type (pci for pharmacy, inc for nursing, dci for dental)**.

`P0 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [x] The hospital admin can education-specific regulators per facility type (PCI for pharmacy, INC for nursing, DCI for dental) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Regulator override: mark as exempt with mandatory reason
> As a **hospital admin**, I want **regulator override: mark as exempt with mandatory reason**.

`P1 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [x] The hospital admin can regulator override: mark as exempt with mandatory reason from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Re-check applicable regulators when modules are activated/deactivated
> As a **hospital admin**, I want **re-check applicable regulators when modules are activated/deactivated**.

`P1 · Partial · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [ ] The hospital admin can re-check applicable regulators when modules are activated/deactivated from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Pre-seeded regulatory bodies: 2 international + 14 national + per-state + per-district for India
> As a **hospital admin**, I want **pre-seeded regulatory bodies: 2 international + 14 national + per-state + per-district for india**.

`P0 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [x] The hospital admin can pre-seeded regulatory bodies: 2 international + 14 national + per-state + per-district for India from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Auto-create compliance checklist for each mapped regulator per facility
> As a **hospital admin**, I want **auto-create compliance checklist for each mapped regulator per facility**.

`P0 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [x] The hospital admin can auto-create compliance checklist for each mapped regulator per facility from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ License number entry per compliance record
> As a **hospital admin**, I want **license number entry per compliance record**.

`P0 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [x] The hospital admin can license number entry per compliance record from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Issue date and expiry date tracking per license
> As a **hospital admin**, I want **issue date and expiry date tracking per license**.

`P0 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [x] The hospital admin can issue date and expiry date tracking per license from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Certificate/document upload per compliance record
> As a **hospital admin**, I want **certificate/document upload per compliance record**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [ ] The hospital admin can certificate/document upload per compliance record from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Compliance status tracking (not_started, in_progress, compliant, expired, exempt)
> As a **hospital admin**, I want **compliance status tracking (not_started, in_progress, compliant, expired, exempt)**.

`P0 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [x] The hospital admin can compliance status tracking (not_started, in_progress, compliant, expired, exempt) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### License expiry alerts (90-day, 60-day, 30-day warnings)
> As a **hospital admin**, I want **license expiry alerts (90-day, 60-day, 30-day warnings)**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [ ] The hospital admin can license expiry alerts (90-day, 60-day, 30-day warnings) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Compliance dashboard view grouped by facility
> As a **hospital admin**, I want **compliance dashboard view grouped by facility**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [ ] The hospital admin can compliance dashboard view grouped by facility from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Compliance audit trail (who reviewed, when)
> As a **hospital admin**, I want **compliance audit trail (who reviewed, when)**.

`P1 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [x] The hospital admin can compliance audit trail (who reviewed, when) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Renewal reminder notifications (email/in-app)
> As a **hospital admin**, I want **renewal reminder notifications (email/in-app)**.

`P2 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [ ] The hospital admin can renewal reminder notifications (email/in-app) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Auto-create 'Main Hospital' facility on tenant creation
> As a **hospital admin**, I want **auto-create 'main hospital' facility on tenant creation**.

`P0 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [x] The hospital admin can auto-create 'Main Hospital' facility on tenant creation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Add sub-institutions with facility type (30+ types: hospital, college, clinic, lab, etc.)
> As a **hospital admin**, I want **add sub-institutions with facility type (30+ types: hospital, college, clinic, lab, etc.)**.

`P0 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [x] The hospital admin can add sub-institutions with facility type (30+ types: hospital, college, clinic, lab, etc.) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Facility tree hierarchy with parent-child relationships
> As a **hospital admin**, I want **facility tree hierarchy with parent-child relationships**.

`P0 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [x] The hospital admin can facility tree hierarchy with parent-child relationships from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Per-facility address and geographic hierarchy (different branch = different state/district)
> As a **hospital admin**, I want **per-facility address and geographic hierarchy (different branch = different state/district)**.

`P0 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [x] The hospital admin can per-facility address and geographic hierarchy (different branch = different state/district) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Per-facility registration number and bed count
> As a **hospital admin**, I want **per-facility registration number and bed count**.

`P0 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [x] The hospital admin can per-facility registration number and bed count from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Facility status management (active, inactive, under_construction, temporarily_closed)
> As a **hospital admin**, I want **facility status management (active, inactive, under_construction, temporarily_closed)**.

`P1 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [x] The hospital admin can facility status management (active, inactive, under_construction, temporarily_closed) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Facility head assignment (Dean, Director, In-charge) with designation
> As a **hospital admin**, I want **facility head assignment (dean, director, in-charge) with designation**.

`P1 · Partial · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [ ] The hospital admin can facility head assignment (Dean, Director, In-charge) with designation from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Facility contact info (phone, email) independent of parent
> As a **hospital admin**, I want **facility contact info (phone, email) independent of parent**.

`P1 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [x] The hospital admin can facility contact info (phone, email) independent of parent from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Established date tracking per facility
> As a **hospital admin**, I want **established date tracking per facility**.

`P2 · Partial · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [ ] The hospital admin can established date tracking per facility from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Bulk import facilities from CSV
> As a **hospital admin**, I want **bulk import facilities from csv**.

`P2 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [ ] The hospital admin can bulk import facilities from CSV from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Affiliated university assignment (e.g., RGUHS, MUHS)
> As a **hospital admin**, I want **affiliated university assignment (e.g., rguhs, muhs)**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [ ] The hospital admin can affiliated university assignment (e.g., RGUHS, MUHS) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Recognition body and number (NMC, PCI, INC, DCI)
> As a **hospital admin**, I want **recognition body and number (nmc, pci, inc, dci)**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [ ] The hospital admin can recognition body and number (NMC, PCI, INC, DCI) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Student intake capacity per academic facility
> As a **hospital admin**, I want **student intake capacity per academic facility**.

`P2 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [ ] The hospital admin can student intake capacity per academic facility from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Academic year configuration per college
> As a **hospital admin**, I want **academic year configuration per college**.

`P2 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [ ] The hospital admin can academic year configuration per college from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Course/program listing per academic facility
> As a **hospital admin**, I want **course/program listing per academic facility**.

`P2 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [ ] The hospital admin can course/program listing per academic facility from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Toggle shared vs independent billing per facility
> As a **hospital admin**, I want **toggle shared vs independent billing per facility**.

`P0 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [x] The hospital admin can toggle shared vs independent billing per facility from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Toggle shared vs independent pharmacy/drug stock per facility
> As a **hospital admin**, I want **toggle shared vs independent pharmacy/drug stock per facility**.

`P0 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [x] The hospital admin can toggle shared vs independent pharmacy/drug stock per facility from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Toggle shared vs independent laboratory per facility
> As a **hospital admin**, I want **toggle shared vs independent laboratory per facility**.

`P1 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [x] The hospital admin can toggle shared vs independent laboratory per facility from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Toggle shared vs independent HR/staff records per facility
> As a **hospital admin**, I want **toggle shared vs independent hr/staff records per facility**.

`P1 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [x] The hospital admin can toggle shared vs independent HR/staff records per facility from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Module activation per facility (e.g., blood bank module only for blood_bank facility)
> As a **hospital admin**, I want **module activation per facility (e.g., blood bank module only for blood_bank facility)**.

`P0 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [x] The hospital admin can module activation per facility (e.g., blood bank module only for blood_bank facility) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ User-to-facility assignment (a doctor can work at multiple facilities)
> As a **hospital admin**, I want **user-to-facility assignment (a doctor can work at multiple facilities)**.

`P0 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [x] The hospital admin can user-to-facility assignment (a doctor can work at multiple facilities) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Location hierarchy scoped per facility (each facility has own buildings/floors/rooms)
> As a **hospital admin**, I want **location hierarchy scoped per facility (each facility has own buildings/floors/rooms)**.

`P0 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [x] The hospital admin can location hierarchy scoped per facility (each facility has own buildings/floors/rooms) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Department creation scoped per facility
> As a **hospital admin**, I want **department creation scoped per facility**.

`P0 · Done · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [x] The hospital admin can department creation scoped per facility from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Cross-facility patient referral tracking
> As a **hospital admin**, I want **cross-facility patient referral tracking**.

`P2 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [ ] The hospital admin can cross-facility patient referral tracking from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Consolidated reporting across all facilities
> As a **hospital admin**, I want **consolidated reporting across all facilities**.

`P2 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-onboarding`

**Acceptance criteria**
- [ ] The hospital admin can consolidated reporting across all facilities from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] 7-layer config hierarchy respected; masters/seed validated; tenant isolation from creation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

