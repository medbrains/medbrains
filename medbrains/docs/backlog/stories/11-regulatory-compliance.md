# Regulatory & Compliance — stories

_Auto-generated from `MedBrains_Features.xlsx` — every feature as a story with module-tailored acceptance criteria. 76 stories (✅ = Done). Source of truth is the xlsx; regenerate via `python3 scripts/generate_stories.py`._

## 27001

### ISO 27001 ISMS (Information Security Management System) control mapping
> As a **compliance officer**, I want **iso 27001 isms (information security management system) control mapping**.

`Partial · Platforms: Web · Source: Reg+MocDoc · RFC: §Reg`

**Acceptance criteria**
- [ ] The compliance officer can iSO 27001 ISMS (Information Security Management System) control mapping from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## 9001

### ISO 9001:2015 quality management system compliance tracking
> As a **compliance officer**, I want **iso 9001:2015 quality management system compliance tracking**.

`Partial · Platforms: Web · Source: Reg+MocDoc · RFC: §Reg`

**Acceptance criteria**
- [ ] The compliance officer can iSO 9001:2015 quality management system compliance tracking from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Abu Dhabi

### DOH (Dept of Health Abu Dhabi) — Malaffi health information exchange integration
> As a **compliance officer**, I want **doh (dept of health abu dhabi) — malaffi health information exchange integration**.

`Pending · Platforms: Web · Source: Reg · RFC: §Reg`

**Acceptance criteria**
- [ ] The compliance officer can dOH (Dept of Health Abu Dhabi) — Malaffi health information exchange integration from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Audit

### ✅ Internal audit scheduler with NABH compliance scoring per department
> As a **compliance officer**, I want **internal audit scheduler with nabh compliance scoring per department**.

`Done · Platforms: Web · Source: ACMSRC · RFC: §Reg`

**Acceptance criteria**
- [x] The compliance officer can internal audit scheduler with NABH compliance scoring per department from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Australia

### Australia TGA (Therapeutic Goods Administration) adverse event reporting
> As a **compliance officer**, I want **australia tga (therapeutic goods administration) adverse event reporting**.

`Pending · Platforms: Web · Source: Reg · RFC: §Reg`

**Acceptance criteria**
- [ ] The compliance officer can australia TGA (Therapeutic Goods Administration) adverse event reporting from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Biomedical

### ✅ CPCB biomedical waste reporting (BMW Rules 2016)
> As a **compliance officer**, I want **cpcb biomedical waste reporting (bmw rules 2016)**.

`Done · Platforms: Web, Mobile · Source: Reg · RFC: §Reg`

**Acceptance criteria**
- [x] The compliance officer can cPCB biomedical waste reporting (BMW Rules 2016) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Breach

### HIPAA breach notification workflow (60-day notification requirement)
> As a **compliance officer**, I want **hipaa breach notification workflow (60-day notification requirement)**.

`Partial · Platforms: Web · Source: Reg · RFC: §Reg`

**Acceptance criteria**
- [ ] The compliance officer can hIPAA breach notification workflow (60-day notification requirement) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Certification

### ONC Health IT certification criteria readiness (21st Century Cures Act)
> As a **compliance officer**, I want **onc health it certification criteria readiness (21st century cures act)**.

`Pending · Platforms: Web · Source: Reg · RFC: §Reg`

**Acceptance criteria**
- [ ] The compliance officer can oNC Health IT certification criteria readiness (21st Century Cures Act) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Compliance

### ✅ NMC medical college compliance tracking (for teaching hospitals)
> As a **compliance officer**, I want **nmc medical college compliance tracking (for teaching hospitals)**.

`Done · Platforms: Web, Mobile · Source: Reg · RFC: §Reg`

**Acceptance criteria**
- [x] The compliance officer can nMC medical college compliance tracking (for teaching hospitals) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ NMC doctor registration verification integration
> As a **compliance officer**, I want **nmc doctor registration verification integration**.

`Done · Platforms: Web, Mobile · Source: Reg · RFC: §Reg`

**Acceptance criteria**
- [x] The compliance officer can nMC doctor registration verification integration from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### NMC fee structure compliance reporting
> As a **compliance officer**, I want **nmc fee structure compliance reporting**.

`Pending · Platforms: Web · Source: Reg · RFC: §Reg`

**Acceptance criteria**
- [ ] The compliance officer can nMC fee structure compliance reporting from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Drug schedule compliance (Schedule H, H1, X marking on prescriptions)
> As a **compliance officer**, I want **drug schedule compliance (schedule h, h1, x marking on prescriptions)**.

`Done · Platforms: Web · Source: Reg+ACMSRC · RFC: §Reg`

**Acceptance criteria**
- [x] The compliance officer can drug schedule compliance (Schedule H, H1, X marking on prescriptions) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### CMS Conditions of Participation compliance (for US-market hospitals)
> As a **compliance officer**, I want **cms conditions of participation compliance (for us-market hospitals)**.

`Pending · Platforms: Web · Source: Reg · RFC: §Reg`

**Acceptance criteria**
- [ ] The compliance officer can cMS Conditions of Participation compliance (for US-market hospitals) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Country

### ✅ Country master — name, ISO code, WHO region, national regulatory bodies mapping
> As a **compliance officer**, I want **country master — name, iso code, who region, national regulatory bodies mapping**.

`Done · Platforms: Web · Source: Arch · RFC: §3`

**Acceptance criteria**
- [x] The compliance officer can country master — name, ISO code, WHO region, national regulatory bodies mapping from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Country-level regulation engine — auto-apply regulatory rules based on hospital country
> As a **compliance officer**, I want **country-level regulation engine — auto-apply regulatory rules based on hospital country**.

`Partial · Platforms: Web · Source: Arch · RFC: §3`

**Acceptance criteria**
- [ ] The compliance officer can country-level regulation engine — auto-apply regulatory rules based on hospital country from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## DPO

### Data Protection Officer (DPO) dashboard with DPIA (Data Protection Impact Assessment)
> As a **compliance officer**, I want **data protection officer (dpo) dashboard with dpia (data protection impact assessment)**.

`Pending · Platforms: Web · Source: Reg · RFC: §Reg`

**Acceptance criteria**
- [ ] The compliance officer can data Protection Officer (DPO) dashboard with DPIA (Data Protection Impact Assessment) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Dashboard

### ✅ NABH readiness dashboard — chapter-wise completion percentage
> As a **compliance officer**, I want **nabh readiness dashboard — chapter-wise completion percentage**.

`Done · Platforms: Web · Source: ACMSRC · RFC: §Reg`

**Acceptance criteria**
- [x] The compliance officer can nABH readiness dashboard — chapter-wise completion percentage from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ JCI compliance dashboard with chapter-wise scoring and gap analysis
> As a **compliance officer**, I want **jci compliance dashboard with chapter-wise scoring and gap analysis**.

`Done · Platforms: Web · Source: Reg · RFC: §Reg`

**Acceptance criteria**
- [x] The compliance officer can jCI compliance dashboard with chapter-wise scoring and gap analysis from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Data

### Geographic hierarchy seed data (country → state → district → taluk → village) with coordinates
> As a **compliance officer**, I want **geographic hierarchy seed data (country → state → district → taluk → village) with coordinates**.

`Partial · Platforms: Web · Source: Arch · RFC: §3`

**Acceptance criteria**
- [ ] The compliance officer can geographic hierarchy seed data (country → state → district → taluk → village) with coordinates from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Boundary polygon storage (PostGIS / GeoJSON) for administrative areas
> As a **compliance officer**, I want **boundary polygon storage (postgis / geojson) for administrative areas**.

`Pending · Platforms: Web · Source: Arch · RFC: §3`

**Acceptance criteria**
- [ ] The compliance officer can boundary polygon storage (PostGIS / GeoJSON) for administrative areas from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Address geocoding service integration (Google Maps / OpenStreetMap Nominatim)
> As a **compliance officer**, I want **address geocoding service integration (google maps / openstreetmap nominatim)**.

`Pending · Platforms: Web · Source: Arch · RFC: §3`

**Acceptance criteria**
- [ ] The compliance officer can address geocoding service integration (Google Maps / OpenStreetMap Nominatim) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Postal code to geographic hierarchy resolution (PIN → village → taluk → district → state)
> As a **compliance officer**, I want **postal code to geographic hierarchy resolution (pin → village → taluk → district → state)**.

`Pending · Platforms: Web · Source: Arch · RFC: §3`

**Acceptance criteria**
- [ ] The compliance officer can postal code to geographic hierarchy resolution (PIN → village → taluk → district → state) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Nearest facility finder (patient location → closest hospitals by specialty and availability)
> As a **compliance officer**, I want **nearest facility finder (patient location → closest hospitals by specialty and availability)**.

`Pending · Platforms: Web · Source: Arch · RFC: §3`

**Acceptance criteria**
- [ ] The compliance officer can nearest facility finder (patient location → closest hospitals by specialty and availability) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Ambulance routing using geographic data (shortest path to nearest hospital by type)
> As a **compliance officer**, I want **ambulance routing using geographic data (shortest path to nearest hospital by type)**.

`Pending · Platforms: Web, Mobile · Source: Arch · RFC: §3`

**Acceptance criteria**
- [ ] The compliance officer can ambulance routing using geographic data (shortest path to nearest hospital by type) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Catchment area analysis — patient origin mapping for each hospital (heat map)
> As a **compliance officer**, I want **catchment area analysis — patient origin mapping for each hospital (heat map)**.

`Pending · Platforms: Web · Source: Arch · RFC: §3`

**Acceptance criteria**
- [ ] The compliance officer can catchment area analysis — patient origin mapping for each hospital (heat map) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Devices

### EU MDR (Medical Device Regulation) compliance for connected medical devices
> As a **compliance officer**, I want **eu mdr (medical device regulation) compliance for connected medical devices**.

`Pending · Platforms: Web · Source: Reg · RFC: §Reg`

**Acceptance criteria**
- [ ] The compliance officer can eU MDR (Medical Device Regulation) compliance for connected medical devices from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Digital Health

### ABDM (Ayushman Bharat Digital Mission) — ABHA creation, HIP/HIU integration, consent manager
> As a **compliance officer**, I want **abdm (ayushman bharat digital mission) — abha creation, hip/hiu integration, consent manager**.

`Partial · Platforms: Web · Source: RFC · RFC: §Reg`

**Acceptance criteria**
- [ ] The compliance officer can aBDM (Ayushman Bharat Digital Mission) — ABHA creation, HIP/HIU integration, consent manager from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## District

### District layer — district health authority, latitude/longitude, administrative boundaries
> As a **compliance officer**, I want **district layer — district health authority, latitude/longitude, administrative boundaries**.

`Partial · Platforms: Web · Source: Arch · RFC: §3`

**Acceptance criteria**
- [ ] The compliance officer can district layer — district health authority, latitude/longitude, administrative boundaries from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### District health office reporting (disease notifications, birth/death registration)
> As a **compliance officer**, I want **district health office reporting (disease notifications, birth/death registration)**.

`Pending · Platforms: Web · Source: Arch · RFC: §3`

**Acceptance criteria**
- [ ] The compliance officer can district health office reporting (disease notifications, birth/death registration) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Documentation

### ✅ NABH mandatory document generation (policies, SOPs, formats per chapter)
> As a **compliance officer**, I want **nabh mandatory document generation (policies, sops, formats per chapter)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: §Reg`

**Acceptance criteria**
- [x] The compliance officer can nABH mandatory document generation (policies, SOPs, formats per chapter) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ JCI tracer methodology support — patient tracer, system tracer, program-specific tracer
> As a **compliance officer**, I want **jci tracer methodology support — patient tracer, system tracer, program-specific tracer**.

`Done · Platforms: Web · Source: Reg · RFC: §Reg`

**Acceptance criteria**
- [x] The compliance officer can jCI tracer methodology support — patient tracer, system tracer, program-specific tracer from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Dubai

### DHA (Dubai Health Authority) — eClaim integration, DHA drug formulary, facility licensing
> As a **compliance officer**, I want **dha (dubai health authority) — eclaim integration, dha drug formulary, facility licensing**.

`Pending · Platforms: Web, Mobile · Source: Reg · RFC: §Reg`

**Acceptance criteria**
- [ ] The compliance officer can dHA (Dubai Health Authority) — eClaim integration, DHA drug formulary, facility licensing from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Facility

### Facility layer — hospital name, type (clinic/hospital/medical college), coordinates, license number
> As a **compliance officer**, I want **facility layer — hospital name, type (clinic/hospital/medical college), coordinates, license number**.

`Partial · Platforms: Web, Mobile · Source: Arch · RFC: §3`

**Acceptance criteria**
- [ ] The compliance officer can facility layer — hospital name, type (clinic/hospital/medical college), coordinates, license number from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Fiji

### Fiji VAT (Value Added Tax) compliance for healthcare services billing
> As a **compliance officer**, I want **fiji vat (value added tax) compliance for healthcare services billing**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Reg`

**Acceptance criteria**
- [ ] The compliance officer can fiji VAT (Value Added Tax) compliance for healthcare services billing from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## IPSG

### ✅ International Patient Safety Goals tracking (patient ID, communication, medication, surgery, infection, falls)
> As a **compliance officer**, I want **international patient safety goals tracking (patient id, communication, medication, surgery, infection, falls)**.

`Done · Platforms: Web · Source: Reg · RFC: §Reg`

**Acceptance criteria**
- [x] The compliance officer can international Patient Safety Goals tracking (patient ID, communication, medication, surgery, infection, falls) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Imaging

### ✅ PCPNDT Act compliance — Form F mandatory for all ultrasounds on pregnant women
> As a **compliance officer**, I want **pcpndt act compliance — form f mandatory for all ultrasounds on pregnant women**.

`Done · Platforms: Web · Source: ACMSRC · RFC: §Reg`

**Acceptance criteria**
- [x] The compliance officer can pCPNDT Act compliance — Form F mandatory for all ultrasounds on pregnant women from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ PCPNDT auto-block gender disclosure fields in fetal imaging reports
> As a **compliance officer**, I want **pcpndt auto-block gender disclosure fields in fetal imaging reports**.

`Done · Platforms: Web · Source: ACMSRC · RFC: §Reg`

**Acceptance criteria**
- [x] The compliance officer can pCPNDT auto-block gender disclosure fields in fetal imaging reports from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## India

### CERT-In 6-hour incident reporting compliance and log retention (180 days)
> As a **compliance officer**, I want **cert-in 6-hour incident reporting compliance and log retention (180 days)**.

`Partial · Platforms: Web, Mobile · Source: Reg+MocDoc · RFC: §Reg`

**Acceptance criteria**
- [ ] The compliance officer can cERT-In 6-hour incident reporting compliance and log retention (180 days) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Insurance

### IRDAI (Insurance Regulatory) compliant claim format generation
> As a **compliance officer**, I want **irdai (insurance regulatory) compliant claim format generation**.

`Partial · Platforms: Web · Source: Reg · RFC: §Reg`

**Acceptance criteria**
- [ ] The compliance officer can iRDAI (Insurance Regulatory) compliant claim format generation from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Kenya

### Kenya NHIF (National Hospital Insurance Fund) claims integration
> As a **compliance officer**, I want **kenya nhif (national hospital insurance fund) claims integration**.

`Pending · Platforms: Web · Source: Reg · RFC: §Reg`

**Acceptance criteria**
- [ ] The compliance officer can kenya NHIF (National Hospital Insurance Fund) claims integration from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Lab

### ✅ NABL accreditation compliance tracking for laboratory
> As a **compliance officer**, I want **nabl accreditation compliance tracking for laboratory**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: §Reg`

**Acceptance criteria**
- [x] The compliance officer can nABL accreditation compliance tracking for laboratory from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ NABL document control — SOPs, calibration records, proficiency testing
> As a **compliance officer**, I want **nabl document control — sops, calibration records, proficiency testing**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: §Reg`

**Acceptance criteria**
- [x] The compliance officer can nABL document control — SOPs, calibration records, proficiency testing from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Maldives

### Maldives AASANDHA national health insurance integration
> As a **compliance officer**, I want **maldives aasandha national health insurance integration**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Reg`

**Acceptance criteria**
- [ ] The compliance officer can maldives AASANDHA national health insurance integration from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Mapping

### Geohash-based hospital-to-regulator mapping (coordinates → village → district → state → country → regulators)
> As a **compliance officer**, I want **geohash-based hospital-to-regulator mapping (coordinates → village → district → state → country → regulators)**.

`Pending · Platforms: Web · Source: Arch · RFC: §3`

**Acceptance criteria**
- [ ] The compliance officer can geohash-based hospital-to-regulator mapping (coordinates → village → district → state → country → regulators) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Auto-detect applicable regulatory bodies from hospital coordinates (NABH, state drug controller, AERB, etc.)
> As a **compliance officer**, I want **auto-detect applicable regulatory bodies from hospital coordinates (nabh, state drug controller, aerb, etc.)**.

`Partial · Platforms: Web · Source: Arch · RFC: §3`

**Acceptance criteria**
- [ ] The compliance officer can auto-detect applicable regulatory bodies from hospital coordinates (NABH, state drug controller, AERB, etc.) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### District-level inspector assignment and inspection schedule management
> As a **compliance officer**, I want **district-level inspector assignment and inspection schedule management**.

`Pending · Platforms: Web · Source: Arch · RFC: §3`

**Acceptance criteria**
- [ ] The compliance officer can district-level inspector assignment and inspection schedule management from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### GIS map visualization — all hospitals in chain with regulator jurisdiction overlay
> As a **compliance officer**, I want **gis map visualization — all hospitals in chain with regulator jurisdiction overlay**.

`Pending · Platforms: Web · Source: Arch · RFC: §3`

**Acceptance criteria**
- [ ] The compliance officer can gIS map visualization — all hospitals in chain with regulator jurisdiction overlay from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Multi-jurisdiction compliance view — hospital at state border may have dual jurisdiction
> As a **compliance officer**, I want **multi-jurisdiction compliance view — hospital at state border may have dual jurisdiction**.

`Pending · Platforms: Web · Source: Arch · RFC: §3`

**Acceptance criteria**
- [ ] The compliance officer can multi-jurisdiction compliance view — hospital at state border may have dual jurisdiction from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Regulatory change notification — auto-alert when a regulator updates rules for a jurisdiction
> As a **compliance officer**, I want **regulatory change notification — auto-alert when a regulator updates rules for a jurisdiction**.

`Pending · Platforms: Web · Source: Arch · RFC: §3`

**Acceptance criteria**
- [ ] The compliance officer can regulatory change notification — auto-alert when a regulator updates rules for a jurisdiction from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Oman

### Oman MOH — Al Shifa integration for public-private health data exchange
> As a **compliance officer**, I want **oman moh — al shifa integration for public-private health data exchange**.

`Pending · Platforms: Web · Source: Reg · RFC: §Reg`

**Acceptance criteria**
- [ ] The compliance officer can oman MOH — Al Shifa integration for public-private health data exchange from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Privacy

### HIPAA Privacy Rule compliance — minimum necessary standard, patient rights
> As a **compliance officer**, I want **hipaa privacy rule compliance — minimum necessary standard, patient rights**.

`Partial · Platforms: Web · Source: Reg · RFC: §Reg`

**Acceptance criteria**
- [ ] The compliance officer can hIPAA Privacy Rule compliance — minimum necessary standard, patient rights from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### GDPR data processing agreements (DPA) for each data processor
> As a **compliance officer**, I want **gdpr data processing agreements (dpa) for each data processor**.

`Partial · Platforms: Web · Source: Reg · RFC: §Reg`

**Acceptance criteria**
- [ ] The compliance officer can gDPR data processing agreements (DPA) for each data processor from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## QI

### ✅ Quality indicator tracking (NABH 32 indicators — mortality, infection, falls, etc.)
> As a **compliance officer**, I want **quality indicator tracking (nabh 32 indicators — mortality, infection, falls, etc.)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: §Reg`

**Acceptance criteria**
- [x] The compliance officer can quality indicator tracking (NABH 32 indicators — mortality, infection, falls, etc.) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### JCI quality improvement program — Plan-Do-Study-Act (PDSA) cycle tracking
> As a **compliance officer**, I want **jci quality improvement program — plan-do-study-act (pdsa) cycle tracking**.

`Partial · Platforms: Web · Source: Reg · RFC: §Reg`

**Acceptance criteria**
- [ ] The compliance officer can jCI quality improvement program — Plan-Do-Study-Act (PDSA) cycle tracking from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Qatar

### QCHP (Qatar Council for Healthcare Practitioners) — provider licensing verification
> As a **compliance officer**, I want **qchp (qatar council for healthcare practitioners) — provider licensing verification**.

`Pending · Platforms: Web · Source: Reg · RFC: §Reg`

**Acceptance criteria**
- [ ] The compliance officer can qCHP (Qatar Council for Healthcare Practitioners) — provider licensing verification from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Radiology

### AERB (Atomic Energy Regulatory Board) compliance for radiology/nuclear medicine
> As a **compliance officer**, I want **aerb (atomic energy regulatory board) compliance for radiology/nuclear medicine**.

`Partial · Platforms: Web · Source: ACMSRC · RFC: §Reg`

**Acceptance criteria**
- [ ] The compliance officer can aERB (Atomic Energy Regulatory Board) compliance for radiology/nuclear medicine from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Radiation dose tracking and personnel TLD badge monitoring
> As a **compliance officer**, I want **radiation dose tracking and personnel tld badge monitoring**.

`Partial · Platforms: Web · Source: ACMSRC · RFC: §Reg`

**Acceptance criteria**
- [ ] The compliance officer can radiation dose tracking and personnel TLD badge monitoring from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Reporting

### ✅ ADR reporting to PvPI (Pharmacovigilance Programme of India)
> As a **compliance officer**, I want **adr reporting to pvpi (pharmacovigilance programme of india)**.

`Done · Platforms: Web · Source: Reg+ACMSRC · RFC: §Reg`

**Acceptance criteria**
- [x] The compliance officer can aDR reporting to PvPI (Pharmacovigilance Programme of India) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Materiovigilance reporting (medical device adverse events)
> As a **compliance officer**, I want **materiovigilance reporting (medical device adverse events)**.

`Done · Platforms: Web · Source: Reg+ACMSRC · RFC: §Reg`

**Acceptance criteria**
- [x] The compliance officer can materiovigilance reporting (medical device adverse events) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Hemovigilance reporting (blood transfusion adverse events)
> As a **compliance officer**, I want **hemovigilance reporting (blood transfusion adverse events)**.

`Partial · Platforms: Web · Source: Reg+ACMSRC · RFC: §Reg`

**Acceptance criteria**
- [ ] The compliance officer can hemovigilance reporting (blood transfusion adverse events) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Rights

### Right to access, right to erasure, right to portability — automated workflows
> As a **compliance officer**, I want **right to access, right to erasure, right to portability — automated workflows**.

`Pending · Platforms: Web · Source: Reg · RFC: §Reg`

**Acceptance criteria**
- [ ] The compliance officer can right to access, right to erasure, right to portability — automated workflows from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## SEA

### Thailand PDPA / Singapore PDPA — personal data protection compliance
> As a **compliance officer**, I want **thailand pdpa / singapore pdpa — personal data protection compliance**.

`Pending · Platforms: Web · Source: Reg · RFC: §Reg`

**Acceptance criteria**
- [ ] The compliance officer can thailand PDPA / Singapore PDPA — personal data protection compliance from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Safety

### ✅ Fire safety compliance tracking (NOC, fire drill records, extinguisher inspection)
> As a **compliance officer**, I want **fire safety compliance tracking (noc, fire drill records, extinguisher inspection)**.

`Done · Platforms: Web, Mobile · Source: Reg · RFC: §Reg`

**Acceptance criteria**
- [x] The compliance officer can fire safety compliance tracking (NOC, fire drill records, extinguisher inspection) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Saudi

### Saudi MOH — NPHIES (National Platform for Health Information Exchange) integration
> As a **compliance officer**, I want **saudi moh — nphies (national platform for health information exchange) integration**.

`Pending · Platforms: Web · Source: Reg · RFC: §Reg`

**Acceptance criteria**
- [ ] The compliance officer can saudi MOH — NPHIES (National Platform for Health Information Exchange) integration from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Saudi MOH — Wasfaty e-prescribing platform integration
> As a **compliance officer**, I want **saudi moh — wasfaty e-prescribing platform integration**.

`Pending · Platforms: Web · Source: Reg · RFC: §Reg`

**Acceptance criteria**
- [ ] The compliance officer can saudi MOH — Wasfaty e-prescribing platform integration from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Security

### HIPAA Security Rule — administrative, physical, technical safeguards checklist
> As a **compliance officer**, I want **hipaa security rule — administrative, physical, technical safeguards checklist**.

`Partial · Platforms: Web · Source: Reg · RFC: §Reg`

**Acceptance criteria**
- [ ] The compliance officer can hIPAA Security Rule — administrative, physical, technical safeguards checklist from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### SOC 2 Type II evidence collection and control monitoring
> As a **compliance officer**, I want **soc 2 type ii evidence collection and control monitoring**.

`Partial · Platforms: Web · Source: Reg+MocDoc · RFC: §Reg`

**Acceptance criteria**
- [ ] The compliance officer can sOC 2 Type II evidence collection and control monitoring from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### HITRUST CSF certification readiness assessment
> As a **compliance officer**, I want **hitrust csf certification readiness assessment**.

`Pending · Platforms: Web · Source: Reg · RFC: §Reg`

**Acceptance criteria**
- [ ] The compliance officer can hITRUST CSF certification readiness assessment from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## South Africa

### South Africa SAHPRA compliance for medication regulatory reporting
> As a **compliance officer**, I want **south africa sahpra compliance for medication regulatory reporting**.

`Pending · Platforms: Web · Source: Reg · RFC: §Reg`

**Acceptance criteria**
- [ ] The compliance officer can south Africa SAHPRA compliance for medication regulatory reporting from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Standards

### ✅ NABH 5th edition standards mapping — all 10 chapters with criteria checklist
> As a **compliance officer**, I want **nabh 5th edition standards mapping — all 10 chapters with criteria checklist**.

`Done · Platforms: Web · Source: ACMSRC · RFC: §Reg`

**Acceptance criteria**
- [x] The compliance officer can nABH 5th edition standards mapping — all 10 chapters with criteria checklist from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ NABH entry-level vs full accreditation criteria tracking
> As a **compliance officer**, I want **nabh entry-level vs full accreditation criteria tracking**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: §Reg`

**Acceptance criteria**
- [x] The compliance officer can nABH entry-level vs full accreditation criteria tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ JCI accreditation standards mapping (14 chapters — IPSG, ACC, PFR, AOP, MMU, etc.)
> As a **compliance officer**, I want **jci accreditation standards mapping (14 chapters — ipsg, acc, pfr, aop, mmu, etc.)**.

`Done · Platforms: Web, Mobile · Source: Reg · RFC: §Reg`

**Acceptance criteria**
- [x] The compliance officer can jCI accreditation standards mapping (14 chapters — IPSG, ACC, PFR, AOP, MMU, etc.) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## State

### ✅ State / Province layer — state code, health department, state drug controller, state medical council
> As a **compliance officer**, I want **state / province layer — state code, health department, state drug controller, state medical council**.

`Done · Platforms: Web · Source: Arch · RFC: §3`

**Acceptance criteria**
- [x] The compliance officer can state / Province layer — state code, health department, state drug controller, state medical council from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### State-level health department reporting integration (e.g., DME Tamil Nadu, DGHS Delhi)
> As a **compliance officer**, I want **state-level health department reporting integration (e.g., dme tamil nadu, dghs delhi)**.

`Pending · Platforms: Web · Source: Arch · RFC: §3`

**Acceptance criteria**
- [ ] The compliance officer can state-level health department reporting integration (e.g., DME Tamil Nadu, DGHS Delhi) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Subdistrict

### Subdistrict / Taluk / County layer — administrative type, boundary polygon, local inspector
> As a **compliance officer**, I want **subdistrict / taluk / county layer — administrative type, boundary polygon, local inspector**.

`Pending · Platforms: Web · Source: Arch · RFC: §3`

**Acceptance criteria**
- [ ] The compliance officer can subdistrict / Taluk / County layer — administrative type, boundary polygon, local inspector from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Village/Town

### Town / Village layer — postal code, coordinates, municipal/panchayat body
> As a **compliance officer**, I want **town / village layer — postal code, coordinates, municipal/panchayat body**.

`Pending · Platforms: Web · Source: Arch · RFC: §3`

**Acceptance criteria**
- [ ] The compliance officer can town / Village layer — postal code, coordinates, municipal/panchayat body from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Maps to the applicable norm (NABH/JCI/NDPS/D&C/PNDT/…) with evidence captured for accreditation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

