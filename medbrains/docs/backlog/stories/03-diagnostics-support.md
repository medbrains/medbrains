# Diagnostics & Support — stories

_Auto-generated from `MedBrains_Features.xlsx` — every feature as a story with module-tailored acceptance criteria. 228 stories (✅ = Done). Source of truth is the xlsx; regenerate via `python3 scripts/generate_stories.py`._

## AERB Compliance

### ✅ Patient radiation dose tracking (cumulative exposure per patient)
> As a **lab/radiology technician**, I want **patient radiation dose tracking (cumulative exposure per patient)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-6 D`

**Acceptance criteria**
- [x] The lab/radiology technician can patient radiation dose tracking (cumulative exposure per patient) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ CT dose report (DLP, CTDIvol) auto-capture from scanner
> As a **lab/radiology technician**, I want **ct dose report (dlp, ctdivol) auto-capture from scanner**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-6 D`

**Acceptance criteria**
- [x] The lab/radiology technician can cT dose report (DLP, CTDIvol) auto-capture from scanner from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Fluoroscopy dose tracking (DAP, fluoroscopy time) for cath lab/interventional
> As a **lab/radiology technician**, I want **fluoroscopy dose tracking (dap, fluoroscopy time) for cath lab/interventional**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-6 D`

**Acceptance criteria**
- [x] The lab/radiology technician can fluoroscopy dose tracking (DAP, fluoroscopy time) for cath lab/interventional from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### AERB source inventory for nuclear medicine
> As a **lab/radiology technician**, I want **aerb source inventory for nuclear medicine**.

`Partial · Platforms: Web · Source: ACMSRC · RFC: CL-6 D`

**Acceptance criteria**
- [ ] The lab/radiology technician can aERB source inventory for nuclear medicine from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Personnel dosimetry record integration
> As a **lab/radiology technician**, I want **personnel dosimetry record integration**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-6 D`

**Acceptance criteria**
- [x] The lab/radiology technician can personnel dosimetry record integration from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ AERB compliance report generation
> As a **lab/radiology technician**, I want **aerb compliance report generation**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-6 D`

**Acceptance criteria**
- [x] The lab/radiology technician can aERB compliance report generation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Alternatives

### Therapeutic alternative suggestions (lower cost, same class, formulary-preferred)
> As a **lab/radiology technician**, I want **therapeutic alternative suggestions (lower cost, same class, formulary-preferred)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The lab/radiology technician can therapeutic alternative suggestions (lower cost, same class, formulary-preferred) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Generic substitution recommendation with cost comparison
> As a **lab/radiology technician**, I want **generic substitution recommendation with cost comparison**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The lab/radiology technician can generic substitution recommendation with cost comparison from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Analyzer Integration

### ✅ Bi-directional HL7/ASTM interface with analyzers
> As a **lab/radiology technician**, I want **bi-directional hl7/astm interface with analyzers**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can bi-directional HL7/ASTM interface with analyzers from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Supported analyzer list (Sysmex, Beckman, Roche, etc.) — verify models
> As a **lab/radiology technician**, I want **supported analyzer list (sysmex, beckman, roche, etc.) — verify models**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can supported analyzer list (Sysmex, Beckman, Roche, etc.) — verify models from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Auto-result capture from analyzer to LIS
> As a **lab/radiology technician**, I want **auto-result capture from analyzer to lis**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can auto-result capture from analyzer to LIS from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Worklist generation for analyzer from pending orders
> As a **lab/radiology technician**, I want **worklist generation for analyzer from pending orders**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can worklist generation for analyzer from pending orders from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Multi-analyzer support per test (failover capability)
> As a **lab/radiology technician**, I want **multi-analyzer support per test (failover capability)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can multi-analyzer support per test (failover capability) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Machine-specific drivers (Beckman, Roche, Sysmex, Siemens, Erba)
> As a **lab/radiology technician**, I want **machine-specific drivers (beckman, roche, sysmex, siemens, erba)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can machine-specific drivers (Beckman, Roche, Sysmex, Siemens, Erba) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## B2B & Referral

### ✅ B2B client registration
> As a **lab/radiology technician**, I want **b2b client registration**.

`Done · Platforms: Web · Source: RFC · RFC: §3.7`

**Acceptance criteria**
- [x] The lab/radiology technician can b2B client registration from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ B2B rate management (contract pricing)
> As a **lab/radiology technician**, I want **b2b rate management (contract pricing)**.

`Done · Platforms: Web · Source: RFC · RFC: §3.7`

**Acceptance criteria**
- [x] The lab/radiology technician can b2B rate management (contract pricing) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ B2B portal (order placement, report viewing)
> As a **lab/radiology technician**, I want **b2b portal (order placement, report viewing)**.

`Done · Platforms: Web · Source: RFC · RFC: §3.7`

**Acceptance criteria**
- [x] The lab/radiology technician can b2B portal (order placement, report viewing) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Referral doctor registration & portal
> As a **lab/radiology technician**, I want **referral doctor registration & portal**.

`Done · Platforms: Web, Mobile · Source: RFC · RFC: §3.7`

**Acceptance criteria**
- [x] The lab/radiology technician can referral doctor registration & portal from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Referral doctor payout/commission management
> As a **lab/radiology technician**, I want **referral doctor payout/commission management**.

`Done · Platforms: Web, Mobile · Source: RFC · RFC: §3.7`

**Acceptance criteria**
- [x] The lab/radiology technician can referral doctor payout/commission management from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Bulk invoicing for postpaid accounts
> As a **lab/radiology technician**, I want **bulk invoicing for postpaid accounts**.

`Done · Platforms: Web · Source: RFC · RFC: §3.7`

**Acceptance criteria**
- [x] The lab/radiology technician can bulk invoicing for postpaid accounts from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Credit management
> As a **lab/radiology technician**, I want **credit management**.

`Done · Platforms: Web · Source: RFC · RFC: §3.7`

**Acceptance criteria**
- [x] The lab/radiology technician can credit management from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Online payment settlement on portal
> As a **lab/radiology technician**, I want **online payment settlement on portal**.

`Done · Platforms: Web, Mobile · Source: RFC · RFC: §3.7`

**Acceptance criteria**
- [x] The lab/radiology technician can online payment settlement on portal from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Billing & Returns

### ✅ Auto-billing integration with pharmacy dispensing
> As a **lab/radiology technician**, I want **auto-billing integration with pharmacy dispensing**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-4 D`

**Acceptance criteria**
- [x] The lab/radiology technician can auto-billing integration with pharmacy dispensing from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Return/unused drug handling with credit note
> As a **lab/radiology technician**, I want **return/unused drug handling with credit note**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-4 D`

**Acceptance criteria**
- [x] The lab/radiology technician can return/unused drug handling with credit note from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Insurance/TPA drug approval workflow
> As a **lab/radiology technician**, I want **insurance/tpa drug approval workflow**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-4 D`

**Acceptance criteria**
- [x] The lab/radiology technician can insurance/TPA drug approval workflow from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Package-based drug dispensing for day care/surgery packages
> As a **lab/radiology technician**, I want **package-based drug dispensing for day care/surgery packages**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-4 D`

**Acceptance criteria**
- [x] The lab/radiology technician can package-based drug dispensing for day care/surgery packages from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Counseling

### Genetic counseling documentation (family pedigree, risk assessment, recommendations)
> As a **lab/radiology technician**, I want **genetic counseling documentation (family pedigree, risk assessment, recommendations)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The lab/radiology technician can genetic counseling documentation (family pedigree, risk assessment, recommendations) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Hereditary risk screening tools (BRCA, Lynch, familial hypercholesterolemia)
> As a **lab/radiology technician**, I want **hereditary risk screening tools (brca, lynch, familial hypercholesterolemia)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The lab/radiology technician can hereditary risk screening tools (BRCA, Lynch, familial hypercholesterolemia) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Coverage

### Real-time prescription benefit check at point of prescribing (formulary status, tier, PA required)
> As a **lab/radiology technician**, I want **real-time prescription benefit check at point of prescribing (formulary status, tier, pa required)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The lab/radiology technician can real-time prescription benefit check at point of prescribing (formulary status, tier, PA required) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Patient out-of-pocket cost display before medication selection
> As a **lab/radiology technician**, I want **patient out-of-pocket cost display before medication selection**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The lab/radiology technician can patient out-of-pocket cost display before medication selection from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Insurance plan coverage details for each medication (copay, coinsurance, deductible)
> As a **lab/radiology technician**, I want **insurance plan coverage details for each medication (copay, coinsurance, deductible)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The lab/radiology technician can insurance plan coverage details for each medication (copay, coinsurance, deductible) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Cross-Match & Issue

### ✅ Cross-match request from IPD/OT/ER with electronic ordering
> As a **lab/radiology technician**, I want **cross-match request from ipd/ot/er with electronic ordering**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.10, CL-16`

**Acceptance criteria**
- [x] The lab/radiology technician can cross-match request from IPD/OT/ER with electronic ordering from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ ABO/Rh compatibility verification (system-enforced hard-block on mismatch)
> As a **lab/radiology technician**, I want **abo/rh compatibility verification (system-enforced hard-block on mismatch)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.10, CL-16`

**Acceptance criteria**
- [x] The lab/radiology technician can aBO/Rh compatibility verification (system-enforced hard-block on mismatch) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Cross-match result entry and compatibility determination
> As a **lab/radiology technician**, I want **cross-match result entry and compatibility determination**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.10, CL-16`

**Acceptance criteria**
- [x] The lab/radiology technician can cross-match result entry and compatibility determination from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Blood issue with double-identity verification (patient wristband + bag barcode)
> As a **lab/radiology technician**, I want **blood issue with double-identity verification (patient wristband + bag barcode)**.

`Partial · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.10, CL-16`

**Acceptance criteria**
- [ ] The lab/radiology technician can blood issue with double-identity verification (patient wristband + bag barcode) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Unused blood return workflow with temperature verification
> As a **lab/radiology technician**, I want **unused blood return workflow with temperature verification**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.10, CL-16`

**Acceptance criteria**
- [x] The lab/radiology technician can unused blood return workflow with temperature verification from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Maximum Surgical Blood Order Schedule (MSBOS) enforcement
> As a **lab/radiology technician**, I want **maximum surgical blood order schedule (msbos) enforcement**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.10, CL-16`

**Acceptance criteria**
- [x] The lab/radiology technician can maximum Surgical Blood Order Schedule (MSBOS) enforcement from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Dietary Services

### ✅ Diet order from doctor/dietician integrated with patient's clinical condition
> As a **lab/radiology technician**, I want **diet order from doctor/dietician integrated with patient's clinical condition**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.16, CL-23`

**Acceptance criteria**
- [x] The lab/radiology technician can diet order from doctor/dietician integrated with patient's clinical condition from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Therapeutic diet templates (diabetic, renal, cardiac, liquid, soft, high-protein)
> As a **lab/radiology technician**, I want **therapeutic diet templates (diabetic, renal, cardiac, liquid, soft, high-protein)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.16, CL-23`

**Acceptance criteria**
- [x] The lab/radiology technician can therapeutic diet templates (diabetic, renal, cardiac, liquid, soft, high-protein) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Allergy/intolerance flagging from patient record
> As a **lab/radiology technician**, I want **allergy/intolerance flagging from patient record**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.16, CL-23`

**Acceptance criteria**
- [x] The lab/radiology technician can allergy/intolerance flagging from patient record from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Calorie and macronutrient tracking per patient
> As a **lab/radiology technician**, I want **calorie and macronutrient tracking per patient**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.16, CL-23`

**Acceptance criteria**
- [x] The lab/radiology technician can calorie and macronutrient tracking per patient from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ NPO (nil per os) alert integration with nursing and kitchen
> As a **lab/radiology technician**, I want **npo (nil per os) alert integration with nursing and kitchen**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.16, CL-23`

**Acceptance criteria**
- [x] The lab/radiology technician can nPO (nil per os) alert integration with nursing and kitchen from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Modified diet for day care/short stay patients
> As a **lab/radiology technician**, I want **modified diet for day care/short stay patients**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.16, CL-23`

**Acceptance criteria**
- [x] The lab/radiology technician can modified diet for day care/short stay patients from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Menu planning (weekly rotation with seasonal variation)
> As a **lab/radiology technician**, I want **menu planning (weekly rotation with seasonal variation)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.16, CL-23`

**Acceptance criteria**
- [x] The lab/radiology technician can menu planning (weekly rotation with seasonal variation) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Meal count per meal per ward (auto-calculated from bed occupancy)
> As a **lab/radiology technician**, I want **meal count per meal per ward (auto-calculated from bed occupancy)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.16, CL-23`

**Acceptance criteria**
- [x] The lab/radiology technician can meal count per meal per ward (auto-calculated from bed occupancy) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Special diet requests (religious, vegetarian, cultural)
> As a **lab/radiology technician**, I want **special diet requests (religious, vegetarian, cultural)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.16, CL-23`

**Acceptance criteria**
- [x] The lab/radiology technician can special diet requests (religious, vegetarian, cultural) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Kitchen inventory management (procurement, stock, consumption)
> As a **lab/radiology technician**, I want **kitchen inventory management (procurement, stock, consumption)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.16, CL-23`

**Acceptance criteria**
- [x] The lab/radiology technician can kitchen inventory management (procurement, stock, consumption) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Food quality feedback collection from patients
> As a **lab/radiology technician**, I want **food quality feedback collection from patients**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.16, CL-23`

**Acceptance criteria**
- [x] The lab/radiology technician can food quality feedback collection from patients from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Food safety and hygiene audit trail (FSSAI compliance)
> As a **lab/radiology technician**, I want **food safety and hygiene audit trail (fssai compliance)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.16, CL-23`

**Acceptance criteria**
- [x] The lab/radiology technician can food safety and hygiene audit trail (FSSAI compliance) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Meal delivery tracking
> As a **lab/radiology technician**, I want **meal delivery tracking**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.16, CL-23`

**Acceptance criteria**
- [x] The lab/radiology technician can meal delivery tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Dispensing

### ✅ Electronic prescription receipt from OPD/IPD/ER (no paper)
> As a **lab/radiology technician**, I want **electronic prescription receipt from opd/ipd/er (no paper)**.

`Done · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.9, CL-4`

**Acceptance criteria**
- [x] The lab/radiology technician can electronic prescription receipt from OPD/IPD/ER (no paper) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Prescription validation — dose, frequency, route, duration check
> As a **lab/radiology technician**, I want **prescription validation — dose, frequency, route, duration check**.

`Done · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.9, CL-4`

**Acceptance criteria**
- [x] The lab/radiology technician can prescription validation — dose, frequency, route, duration check from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Drug-drug interaction alert at dispensing stage
> As a **lab/radiology technician**, I want **drug-drug interaction alert at dispensing stage**.

`Done · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.9, CL-4`

**Acceptance criteria**
- [x] The lab/radiology technician can drug-drug interaction alert at dispensing stage from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Allergy cross-check before dispensing
> As a **lab/radiology technician**, I want **allergy cross-check before dispensing**.

`Done · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.9, CL-4`

**Acceptance criteria**
- [x] The lab/radiology technician can allergy cross-check before dispensing from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Barcode-based dispensing with patient verification
> As a **lab/radiology technician**, I want **barcode-based dispensing with patient verification**.

`Partial · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.9, CL-4`

**Acceptance criteria**
- [ ] The lab/radiology technician can barcode-based dispensing with patient verification from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Substitution workflow (generic/brand swap with doctor notification)
> As a **lab/radiology technician**, I want **substitution workflow (generic/brand swap with doctor notification)**.

`Done · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.9, CL-4`

**Acceptance criteria**
- [x] The lab/radiology technician can substitution workflow (generic/brand swap with doctor notification) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ IP inpatient medication dispensing — unit dose vs bulk
> As a **lab/radiology technician**, I want **ip inpatient medication dispensing — unit dose vs bulk**.

`Done · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.9, CL-4`

**Acceptance criteria**
- [x] The lab/radiology technician can iP inpatient medication dispensing — unit dose vs bulk from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Discharge medication dispensing linked to discharge summary
> As a **lab/radiology technician**, I want **discharge medication dispensing linked to discharge summary**.

`Done · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.9, CL-4`

**Acceptance criteria**
- [x] The lab/radiology technician can discharge medication dispensing linked to discharge summary from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ OTC sales (walk-in billing)
> As a **lab/radiology technician**, I want **otc sales (walk-in billing)**.

`Done · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.9, CL-4`

**Acceptance criteria**
- [x] The lab/radiology technician can oTC sales (walk-in billing) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Donor Mgmt

### ✅ Donor registration with demographics and medical history screening
> As a **lab/radiology technician**, I want **donor registration with demographics and medical history screening**.

`Done · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.10, CL-16`

**Acceptance criteria**
- [x] The lab/radiology technician can donor registration with demographics and medical history screening from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Donor deferral criteria enforcement (auto-check against history)
> As a **lab/radiology technician**, I want **donor deferral criteria enforcement (auto-check against history)**.

`Done · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.10, CL-16`

**Acceptance criteria**
- [x] The lab/radiology technician can donor deferral criteria enforcement (auto-check against history) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Donation record (volume, date, type — whole blood/apheresis)
> As a **lab/radiology technician**, I want **donation record (volume, date, type — whole blood/apheresis)**.

`Done · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.10, CL-16`

**Acceptance criteria**
- [x] The lab/radiology technician can donation record (volume, date, type — whole blood/apheresis) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Donor adverse reaction documentation
> As a **lab/radiology technician**, I want **donor adverse reaction documentation**.

`Done · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.10, CL-16`

**Acceptance criteria**
- [x] The lab/radiology technician can donor adverse reaction documentation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Repeat donor tracking and recruitment management
> As a **lab/radiology technician**, I want **repeat donor tracking and recruitment management**.

`Done · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.10, CL-16`

**Acceptance criteria**
- [x] The lab/radiology technician can repeat donor tracking and recruitment management from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Donor camp management
> As a **lab/radiology technician**, I want **donor camp management**.

`Partial · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.10, CL-16`

**Acceptance criteria**
- [ ] The lab/radiology technician can donor camp management from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Fleet Mgmt

### ✅ Ambulance fleet master
> As a **lab/radiology technician**, I want **ambulance fleet master**.

`Done · Platforms: Web, Mobile · Source: RFC · RFC: §3.21`

**Acceptance criteria**
- [x] The lab/radiology technician can ambulance fleet master from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Ambulance booking/dispatch
> As a **lab/radiology technician**, I want **ambulance booking/dispatch**.

`Done · Platforms: Web, Mobile · Source: RFC · RFC: §3.21`

**Acceptance criteria**
- [x] The lab/radiology technician can ambulance booking/dispatch from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ GPS tracking integration
> As a **lab/radiology technician**, I want **gps tracking integration**.

`Done · Platforms: Web · Source: RFC · RFC: §3.21`

**Acceptance criteria**
- [x] The lab/radiology technician can gPS tracking integration from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Driver assignment
> As a **lab/radiology technician**, I want **driver assignment**.

`Done · Platforms: Web, Mobile · Source: RFC · RFC: §3.21`

**Acceptance criteria**
- [x] The lab/radiology technician can driver assignment from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Patient pickup/drop tracking
> As a **lab/radiology technician**, I want **patient pickup/drop tracking**.

`Done · Platforms: Web · Source: RFC · RFC: §3.21`

**Acceptance criteria**
- [x] The lab/radiology technician can patient pickup/drop tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Emergency vs scheduled trips
> As a **lab/radiology technician**, I want **emergency vs scheduled trips**.

`Done · Platforms: Web · Source: RFC · RFC: §3.21`

**Acceptance criteria**
- [x] The lab/radiology technician can emergency vs scheduled trips from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Ambulance billing
> As a **lab/radiology technician**, I want **ambulance billing**.

`Done · Platforms: Web, Mobile · Source: RFC · RFC: §3.21`

**Acceptance criteria**
- [x] The lab/radiology technician can ambulance billing from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Trip log & reports
> As a **lab/radiology technician**, I want **trip log & reports**.

`Done · Platforms: Web · Source: RFC · RFC: §3.21`

**Acceptance criteria**
- [x] The lab/radiology technician can trip log & reports from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Maintenance schedule
> As a **lab/radiology technician**, I want **maintenance schedule**.

`Done · Platforms: Web · Source: RFC · RFC: §3.21`

**Acceptance criteria**
- [x] The lab/radiology technician can maintenance schedule from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Formulary & Control

### ✅ Hospital formulary management (approved drug list)
> As a **lab/radiology technician**, I want **hospital formulary management (approved drug list)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.9, CL-4`

**Acceptance criteria**
- [x] The lab/radiology technician can hospital formulary management (approved drug list) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Non-formulary drug request workflow (doctor → DTC approval)
> As a **lab/radiology technician**, I want **non-formulary drug request workflow (doctor → dtc approval)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.9, CL-4`

**Acceptance criteria**
- [x] The lab/radiology technician can non-formulary drug request workflow (doctor → DTC approval) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Restricted antibiotic approval workflow (antibiotic stewardship)
> As a **lab/radiology technician**, I want **restricted antibiotic approval workflow (antibiotic stewardship)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.9, CL-4`

**Acceptance criteria**
- [x] The lab/radiology technician can restricted antibiotic approval workflow (antibiotic stewardship) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ NDPS Act compliance — narcotic drug register, controlled substance tracking
> As a **lab/radiology technician**, I want **ndps act compliance — narcotic drug register, controlled substance tracking**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.9, CL-4`

**Acceptance criteria**
- [x] The lab/radiology technician can nDPS Act compliance — narcotic drug register, controlled substance tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Opioid consumption register (ward-wise, patient-wise per RFC v2.1 A5)
> As a **lab/radiology technician**, I want **opioid consumption register (ward-wise, patient-wise per rfc v2.1 a5)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.9, CL-4`

**Acceptance criteria**
- [x] The lab/radiology technician can opioid consumption register (ward-wise, patient-wise per RFC v2.1 A5) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Drug recall management
> As a **lab/radiology technician**, I want **drug recall management**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.9, CL-4`

**Acceptance criteria**
- [x] The lab/radiology technician can drug recall management from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Hemovigilance

### ✅ Bedside transfusion checklist (nurse documentation)
> As a **lab/radiology technician**, I want **bedside transfusion checklist (nurse documentation)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.10, CL-16`

**Acceptance criteria**
- [x] The lab/radiology technician can bedside transfusion checklist (nurse documentation) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Transfusion reaction monitoring and reporting
> As a **lab/radiology technician**, I want **transfusion reaction monitoring and reporting**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.10, CL-16`

**Acceptance criteria**
- [x] The lab/radiology technician can transfusion reaction monitoring and reporting from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Hemovigilance report to NACO
> As a **lab/radiology technician**, I want **hemovigilance report to naco**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.10, CL-16`

**Acceptance criteria**
- [x] The lab/radiology technician can hemovigilance report to NACO from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Lookback/traceback for post-donation infection detection
> As a **lab/radiology technician**, I want **lookback/traceback for post-donation infection detection**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.10, CL-16`

**Acceptance criteria**
- [x] The lab/radiology technician can lookback/traceback for post-donation infection detection from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ SBTC (State Blood Transfusion Council) compliance reporting
> As a **lab/radiology technician**, I want **sbtc (state blood transfusion council) compliance reporting**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.10, CL-16`

**Acceptance criteria**
- [x] The lab/radiology technician can sBTC (State Blood Transfusion Council) compliance reporting from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Blood utilization tracking
> As a **lab/radiology technician**, I want **blood utilization tracking**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.10, CL-16`

**Acceptance criteria**
- [x] The lab/radiology technician can blood utilization tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Blood discard management
> As a **lab/radiology technician**, I want **blood discard management**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.10, CL-16`

**Acceptance criteria**
- [x] The lab/radiology technician can blood discard management from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Blood bank billing
> As a **lab/radiology technician**, I want **blood bank billing**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.10, CL-16`

**Acceptance criteria**
- [x] The lab/radiology technician can blood bank billing from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Inventory

### ✅ Real-time stock tracking across all pharmacy locations (main, satellite, OT, ER)
> As a **lab/radiology technician**, I want **real-time stock tracking across all pharmacy locations (main, satellite, ot, er)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.9, CL-4`

**Acceptance criteria**
- [x] The lab/radiology technician can real-time stock tracking across all pharmacy locations (main, satellite, OT, ER) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Auto reorder level alerts (configurable per drug)
> As a **lab/radiology technician**, I want **auto reorder level alerts (configurable per drug)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.9, CL-4`

**Acceptance criteria**
- [x] The lab/radiology technician can auto reorder level alerts (configurable per drug) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Expiry management with FEFO (First Expiry First Out) enforcement
> As a **lab/radiology technician**, I want **expiry management with fefo (first expiry first out) enforcement**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.9, CL-4`

**Acceptance criteria**
- [x] The lab/radiology technician can expiry management with FEFO (First Expiry First Out) enforcement from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Batch tracking from procurement to dispensing
> As a **lab/radiology technician**, I want **batch tracking from procurement to dispensing**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.9, CL-4`

**Acceptance criteria**
- [x] The lab/radiology technician can batch tracking from procurement to dispensing from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Near-expiry alert dashboard (30/60/90 day configurable)
> As a **lab/radiology technician**, I want **near-expiry alert dashboard (30/60/90 day configurable)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.9, CL-4`

**Acceptance criteria**
- [x] The lab/radiology technician can near-expiry alert dashboard (30/60/90 day configurable) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Dead stock identification
> As a **lab/radiology technician**, I want **dead stock identification**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.9, CL-4`

**Acceptance criteria**
- [x] The lab/radiology technician can dead stock identification from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Inter-location stock transfer
> As a **lab/radiology technician**, I want **inter-location stock transfer**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.9, CL-4`

**Acceptance criteria**
- [x] The lab/radiology technician can inter-location stock transfer from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Multi-store management
> As a **lab/radiology technician**, I want **multi-store management**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.9, CL-4`

**Acceptance criteria**
- [x] The lab/radiology technician can multi-store management from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Oncology

### Tumor biomarker tracking and targeted therapy matching
> As a **lab/radiology technician**, I want **tumor biomarker tracking and targeted therapy matching**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The lab/radiology technician can tumor biomarker tracking and targeted therapy matching from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Cancer registry staging — AJCC TNM classification with auto-submission to registry
> As a **lab/radiology technician**, I want **cancer registry staging — ajcc tnm classification with auto-submission to registry**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The lab/radiology technician can cancer registry staging — AJCC TNM classification with auto-submission to registry from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Orders & Scheduling

### ✅ Electronic radiology order from OPD/IPD/ER with clinical indication
> As a **lab/radiology technician**, I want **electronic radiology order from opd/ipd/er with clinical indication**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.8, CL-6`

**Acceptance criteria**
- [x] The lab/radiology technician can electronic radiology order from OPD/IPD/ER with clinical indication from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Modality worklist (MWL) generation — DICOM
> As a **lab/radiology technician**, I want **modality worklist (mwl) generation — dicom**.

`Partial · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.8, CL-6`

**Acceptance criteria**
- [ ] The lab/radiology technician can modality worklist (MWL) generation — DICOM from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Appointment scheduling for CT, MRI, USG, interventional procedures
> As a **lab/radiology technician**, I want **appointment scheduling for ct, mri, usg, interventional procedures**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.8, CL-6`

**Acceptance criteria**
- [x] The lab/radiology technician can appointment scheduling for CT, MRI, USG, interventional procedures from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Priority/STAT flagging for emergency investigations
> As a **lab/radiology technician**, I want **priority/stat flagging for emergency investigations**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.8, CL-6`

**Acceptance criteria**
- [x] The lab/radiology technician can priority/STAT flagging for emergency investigations from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Pregnancy verification check before radiation-based studies
> As a **lab/radiology technician**, I want **pregnancy verification check before radiation-based studies**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.8, CL-6`

**Acceptance criteria**
- [x] The lab/radiology technician can pregnancy verification check before radiation-based studies from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Contrast allergy flagging from patient record
> As a **lab/radiology technician**, I want **contrast allergy flagging from patient record**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.8, CL-6`

**Acceptance criteria**
- [x] The lab/radiology technician can contrast allergy flagging from patient record from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## PA

### Prior authorization required flag with auto-submission workflow
> As a **lab/radiology technician**, I want **prior authorization required flag with auto-submission workflow**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The lab/radiology technician can prior authorization required flag with auto-submission workflow from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## PACS & DICOM

### ✅ DICOM image storage and retrieval
> As a **lab/radiology technician**, I want **dicom image storage and retrieval**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.8, CL-6`

**Acceptance criteria**
- [x] The lab/radiology technician can dICOM image storage and retrieval from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Web-based DICOM viewer (no thick client needed)
> As a **lab/radiology technician**, I want **web-based dicom viewer (no thick client needed)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.8, CL-6`

**Acceptance criteria**
- [x] The lab/radiology technician can web-based DICOM viewer (no thick client needed) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Prior study comparison (side-by-side)
> As a **lab/radiology technician**, I want **prior study comparison (side-by-side)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.8, CL-6`

**Acceptance criteria**
- [x] The lab/radiology technician can prior study comparison (side-by-side) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Multi-modality support (X-ray, CT, MRI, USG, mammography, fluoroscopy)
> As a **lab/radiology technician**, I want **multi-modality support (x-ray, ct, mri, usg, mammography, fluoroscopy)**.

`Partial · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.8, CL-6`

**Acceptance criteria**
- [ ] The lab/radiology technician can multi-modality support (X-ray, CT, MRI, USG, mammography, fluoroscopy) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Image sharing with referring doctor via DICOM viewer link
> As a **lab/radiology technician**, I want **image sharing with referring doctor via dicom viewer link**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.8, CL-6`

**Acceptance criteria**
- [x] The lab/radiology technician can image sharing with referring doctor via DICOM viewer link from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ CD/USB burning for patient with viewer
> As a **lab/radiology technician**, I want **cd/usb burning for patient with viewer**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.8, CL-6`

**Acceptance criteria**
- [x] The lab/radiology technician can cD/USB burning for patient with viewer from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Integration with Orthanc or existing PACS
> As a **lab/radiology technician**, I want **integration with orthanc or existing pacs**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.8, CL-6`

**Acceptance criteria**
- [x] The lab/radiology technician can integration with Orthanc or existing PACS from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Pharmacogenomics

### Pharmacogenomic alerts — drug-gene interaction at point of prescribing
> As a **lab/radiology technician**, I want **pharmacogenomic alerts — drug-gene interaction at point of prescribing**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The lab/radiology technician can pharmacogenomic alerts — drug-gene interaction at point of prescribing from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Patient pharmacogenomic profile (known variants affecting drug metabolism)
> As a **lab/radiology technician**, I want **patient pharmacogenomic profile (known variants affecting drug metabolism)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The lab/radiology technician can patient pharmacogenomic profile (known variants affecting drug metabolism) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Processing & Storage

### ✅ Component preparation (PRBC, FFP, platelets, cryo) tracking
> As a **lab/radiology technician**, I want **component preparation (prbc, ffp, platelets, cryo) tracking**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.10, CL-16`

**Acceptance criteria**
- [x] The lab/radiology technician can component preparation (PRBC, FFP, platelets, cryo) tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Blood group and Rh typing with double-check
> As a **lab/radiology technician**, I want **blood group and rh typing with double-check**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.10, CL-16`

**Acceptance criteria**
- [x] The lab/radiology technician can blood group and Rh typing with double-check from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Infectious disease screening (HIV, HBV, HCV, syphilis, malaria) result tracking
> As a **lab/radiology technician**, I want **infectious disease screening (hiv, hbv, hcv, syphilis, malaria) result tracking**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.10, CL-16`

**Acceptance criteria**
- [x] The lab/radiology technician can infectious disease screening (HIV, HBV, HCV, syphilis, malaria) result tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Bag labeling with barcode/ISBT 128 coding
> As a **lab/radiology technician**, I want **bag labeling with barcode/isbt 128 coding**.

`Partial · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.10, CL-16`

**Acceptance criteria**
- [ ] The lab/radiology technician can bag labeling with barcode/ISBT 128 coding from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Cold chain monitoring (refrigerator/freezer temperature IoT alerts)
> As a **lab/radiology technician**, I want **cold chain monitoring (refrigerator/freezer temperature iot alerts)**.

`Partial · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.10, CL-16`

**Acceptance criteria**
- [ ] The lab/radiology technician can cold chain monitoring (refrigerator/freezer temperature IoT alerts) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Expiry management with FEFO enforcement
> As a **lab/radiology technician**, I want **expiry management with fefo enforcement**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.10, CL-16`

**Acceptance criteria**
- [x] The lab/radiology technician can expiry management with FEFO enforcement from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Stock dashboard by component and blood group
> As a **lab/radiology technician**, I want **stock dashboard by component and blood group**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.10, CL-16`

**Acceptance criteria**
- [x] The lab/radiology technician can stock dashboard by component and blood group from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Procurement & Store

### ✅ Product/item master
> As a **lab/radiology technician**, I want **product/item master**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.14, CL-9`

**Acceptance criteria**
- [x] The lab/radiology technician can product/item master from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Supplier/vendor master
> As a **lab/radiology technician**, I want **supplier/vendor master**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.14, CL-9`

**Acceptance criteria**
- [x] The lab/radiology technician can supplier/vendor master from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Department-wise indent generation with item catalog
> As a **lab/radiology technician**, I want **department-wise indent generation with item catalog**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.14, CL-9`

**Acceptance criteria**
- [x] The lab/radiology technician can department-wise indent generation with item catalog from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Indent approval workflow (dept → store → purchase committee)
> As a **lab/radiology technician**, I want **indent approval workflow (dept → store → purchase committee)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.14, CL-9`

**Acceptance criteria**
- [x] The lab/radiology technician can indent approval workflow (dept → store → purchase committee) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Purchase order generation from approved indents
> As a **lab/radiology technician**, I want **purchase order generation from approved indents**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.14, CL-9`

**Acceptance criteria**
- [x] The lab/radiology technician can purchase order generation from approved indents from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Vendor comparison and selection workflow
> As a **lab/radiology technician**, I want **vendor comparison and selection workflow**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.14, CL-9`

**Acceptance criteria**
- [x] The lab/radiology technician can vendor comparison and selection workflow from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Rate contract management with validity tracking
> As a **lab/radiology technician**, I want **rate contract management with validity tracking**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.14, CL-9`

**Acceptance criteria**
- [x] The lab/radiology technician can rate contract management with validity tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Emergency/spot purchase workflow
> As a **lab/radiology technician**, I want **emergency/spot purchase workflow**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.14, CL-9`

**Acceptance criteria**
- [x] The lab/radiology technician can emergency/spot purchase workflow from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ GRN (Goods Receipt Note) with quality check documentation
> As a **lab/radiology technician**, I want **grn (goods receipt note) with quality check documentation**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.14, CL-9`

**Acceptance criteria**
- [x] The lab/radiology technician can gRN (Goods Receipt Note) with quality check documentation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Batch and expiry tracking at receipt
> As a **lab/radiology technician**, I want **batch and expiry tracking at receipt**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.14, CL-9`

**Acceptance criteria**
- [x] The lab/radiology technician can batch and expiry tracking at receipt from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ FEFO enforcement
> As a **lab/radiology technician**, I want **fefo enforcement**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.14, CL-9`

**Acceptance criteria**
- [x] The lab/radiology technician can fEFO enforcement from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Multi-location store management (main store, sub-stores, satellite)
> As a **lab/radiology technician**, I want **multi-location store management (main store, sub-stores, satellite)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.14, CL-9`

**Acceptance criteria**
- [x] The lab/radiology technician can multi-location store management (main store, sub-stores, satellite) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Bin/rack location tracking
> As a **lab/radiology technician**, I want **bin/rack location tracking**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.14, CL-9`

**Acceptance criteria**
- [x] The lab/radiology technician can bin/rack location tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Temperature-sensitive item monitoring (cold chain)
> As a **lab/radiology technician**, I want **temperature-sensitive item monitoring (cold chain)**.

`Partial · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.14, CL-9`

**Acceptance criteria**
- [ ] The lab/radiology technician can temperature-sensitive item monitoring (cold chain) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Department-wise issue with auto stock deduction
> As a **lab/radiology technician**, I want **department-wise issue with auto stock deduction**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.14, CL-9`

**Acceptance criteria**
- [x] The lab/radiology technician can department-wise issue with auto stock deduction from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Patient-level consumable tracking (chargeable items to billing)
> As a **lab/radiology technician**, I want **patient-level consumable tracking (chargeable items to billing)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.14, CL-9`

**Acceptance criteria**
- [x] The lab/radiology technician can patient-level consumable tracking (chargeable items to billing) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Return to store workflow
> As a **lab/radiology technician**, I want **return to store workflow**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.14, CL-9`

**Acceptance criteria**
- [x] The lab/radiology technician can return to store workflow from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Consumption analysis per department/item
> As a **lab/radiology technician**, I want **consumption analysis per department/item**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.14, CL-9`

**Acceptance criteria**
- [x] The lab/radiology technician can consumption analysis per department/item from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Auto reorder level alerts
> As a **lab/radiology technician**, I want **auto reorder level alerts**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.14, CL-9`

**Acceptance criteria**
- [x] The lab/radiology technician can auto reorder level alerts from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Dead stock and slow-moving item identification
> As a **lab/radiology technician**, I want **dead stock and slow-moving item identification**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.14, CL-9`

**Acceptance criteria**
- [x] The lab/radiology technician can dead stock and slow-moving item identification from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Consignment stock management (vendor-owned, billed on use) for stents/implants
> As a **lab/radiology technician**, I want **consignment stock management (vendor-owned, billed on use) for stents/implants**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.14, CL-9`

**Acceptance criteria**
- [x] The lab/radiology technician can consignment stock management (vendor-owned, billed on use) for stents/implants from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ High-value consumable tracking with barcode/serial number
> As a **lab/radiology technician**, I want **high-value consumable tracking with barcode/serial number**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.14, CL-9`

**Acceptance criteria**
- [x] The lab/radiology technician can high-value consumable tracking with barcode/serial number from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Implant registry with patient linkage
> As a **lab/radiology technician**, I want **implant registry with patient linkage**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.14, CL-9`

**Acceptance criteria**
- [x] The lab/radiology technician can implant registry with patient linkage from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Equipment condemnation workflow with committee approval
> As a **lab/radiology technician**, I want **equipment condemnation workflow with committee approval**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.14, CL-9`

**Acceptance criteria**
- [x] The lab/radiology technician can equipment condemnation workflow with committee approval from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Vendor performance rating
> As a **lab/radiology technician**, I want **vendor performance rating**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.14, CL-9`

**Acceptance criteria**
- [x] The lab/radiology technician can vendor performance rating from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Purchase vs consumption trend analysis
> As a **lab/radiology technician**, I want **purchase vs consumption trend analysis**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.14, CL-9`

**Acceptance criteria**
- [x] The lab/radiology technician can purchase vs consumption trend analysis from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Inventory valuation reports
> As a **lab/radiology technician**, I want **inventory valuation reports**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.14, CL-9`

**Acceptance criteria**
- [x] The lab/radiology technician can inventory valuation reports from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ NMC/NABH inventory compliance reports
> As a **lab/radiology technician**, I want **nmc/nabh inventory compliance reports**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.14, CL-9`

**Acceptance criteria**
- [x] The lab/radiology technician can nMC/NABH inventory compliance reports from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ FSN analysis (Fast/Slow/Non-moving)
> As a **lab/radiology technician**, I want **fsn analysis (fast/slow/non-moving)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.14, CL-9`

**Acceptance criteria**
- [x] The lab/radiology technician can fSN analysis (Fast/Slow/Non-moving) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ ABC analysis (value-based classification)
> As a **lab/radiology technician**, I want **abc analysis (value-based classification)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.14, CL-9`

**Acceptance criteria**
- [x] The lab/radiology technician can aBC analysis (value-based classification) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ VED analysis (Vital/Essential/Desirable)
> As a **lab/radiology technician**, I want **ved analysis (vital/essential/desirable)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.14, CL-9`

**Acceptance criteria**
- [x] The lab/radiology technician can vED analysis (Vital/Essential/Desirable) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Supplier payment tracking
> As a **lab/radiology technician**, I want **supplier payment tracking**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.14, CL-9`

**Acceptance criteria**
- [x] The lab/radiology technician can supplier payment tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Barcode & QR generation for stock items
> As a **lab/radiology technician**, I want **barcode & qr generation for stock items**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.14, CL-9`

**Acceptance criteria**
- [x] The lab/radiology technician can barcode & QR generation for stock items from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## QC & NABL

### ✅ Internal QC (Levey-Jennings charts, Westgard rules)
> As a **lab/radiology technician**, I want **internal qc (levey-jennings charts, westgard rules)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can internal QC (Levey-Jennings charts, Westgard rules) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ External QA program (EQAS) result tracking
> As a **lab/radiology technician**, I want **external qa program (eqas) result tracking**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can external QA program (EQAS) result tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Calibration tracking per analyzer/method
> As a **lab/radiology technician**, I want **calibration tracking per analyzer/method**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can calibration tracking per analyzer/method from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Reagent lot tracking with expiry management
> As a **lab/radiology technician**, I want **reagent lot tracking with expiry management**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can reagent lot tracking with expiry management from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Reagent consumption reports & re-order alerts
> As a **lab/radiology technician**, I want **reagent consumption reports & re-order alerts**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can reagent consumption reports & re-order alerts from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ NABL document control integration
> As a **lab/radiology technician**, I want **nabl document control integration**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can nABL document control integration from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Proficiency testing result management
> As a **lab/radiology technician**, I want **proficiency testing result management**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can proficiency testing result management from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### CAP accreditation compliance
> As a **lab/radiology technician**, I want **cap accreditation compliance**.

`Partial · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [ ] The lab/radiology technician can cAP accreditation compliance from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Reporting

### ✅ Structured reporting templates per modality/body part
> As a **lab/radiology technician**, I want **structured reporting templates per modality/body part**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.8, CL-6`

**Acceptance criteria**
- [x] The lab/radiology technician can structured reporting templates per modality/body part from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Voice-to-text dictation for radiology reports
> As a **lab/radiology technician**, I want **voice-to-text dictation for radiology reports**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.8, CL-6`

**Acceptance criteria**
- [x] The lab/radiology technician can voice-to-text dictation for radiology reports from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Preliminary report by resident, final by consultant workflow
> As a **lab/radiology technician**, I want **preliminary report by resident, final by consultant workflow**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.8, CL-6`

**Acceptance criteria**
- [x] The lab/radiology technician can preliminary report by resident, final by consultant workflow from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Critical finding alert to ordering doctor (auto-notification)
> As a **lab/radiology technician**, I want **critical finding alert to ordering doctor (auto-notification)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.8, CL-6`

**Acceptance criteria**
- [x] The lab/radiology technician can critical finding alert to ordering doctor (auto-notification) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Report delivery to referring doctor dashboard and patient portal
> As a **lab/radiology technician**, I want **report delivery to referring doctor dashboard and patient portal**.

`Partial · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.8, CL-6`

**Acceptance criteria**
- [ ] The lab/radiology technician can report delivery to referring doctor dashboard and patient portal from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ TAT tracking per modality with SLA alerts
> As a **lab/radiology technician**, I want **tat tracking per modality with sla alerts**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.8, CL-6`

**Acceptance criteria**
- [x] The lab/radiology technician can tAT tracking per modality with SLA alerts from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ ABC/VED/XYZ analysis for inventory optimization
> As a **lab/radiology technician**, I want **abc/ved/xyz analysis for inventory optimization**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-4 E`

**Acceptance criteria**
- [x] The lab/radiology technician can aBC/VED/XYZ analysis for inventory optimization from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Drug utilization review reports
> As a **lab/radiology technician**, I want **drug utilization review reports**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-4 E`

**Acceptance criteria**
- [x] The lab/radiology technician can drug utilization review reports from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Adverse Drug Reaction (ADR) reporting to PvPI
> As a **lab/radiology technician**, I want **adverse drug reaction (adr) reporting to pvpi**.

`Partial · Platforms: Web · Source: ACMSRC · RFC: CL-4 E`

**Acceptance criteria**
- [ ] The lab/radiology technician can adverse Drug Reaction (ADR) reporting to PvPI from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### CDSCO compliance reporting
> As a **lab/radiology technician**, I want **cdsco compliance reporting**.

`Partial · Platforms: Web · Source: ACMSRC · RFC: CL-4 E`

**Acceptance criteria**
- [ ] The lab/radiology technician can cDSCO compliance reporting from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Drugs & Therapeutics Committee (DTC) report generation
> As a **lab/radiology technician**, I want **drugs & therapeutics committee (dtc) report generation**.

`Partial · Platforms: Web · Source: ACMSRC · RFC: CL-4 E`

**Acceptance criteria**
- [ ] The lab/radiology technician can drugs & Therapeutics Committee (DTC) report generation from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Results & Reporting

### ✅ Manual result entry with normal range display
> As a **lab/radiology technician**, I want **manual result entry with normal range display**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can manual result entry with normal range display from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Auto-validation for results within normal range
> As a **lab/radiology technician**, I want **auto-validation for results within normal range**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can auto-validation for results within normal range from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Abnormal/critical value flagging with auto-alert to ordering doctor
> As a **lab/radiology technician**, I want **abnormal/critical value flagging with auto-alert to ordering doctor**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can abnormal/critical value flagging with auto-alert to ordering doctor from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Delta check (comparison with previous result for same patient)
> As a **lab/radiology technician**, I want **delta check (comparison with previous result for same patient)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can delta check (comparison with previous result for same patient) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Result authorization workflow (technician → pathologist verification)
> As a **lab/radiology technician**, I want **result authorization workflow (technician → pathologist verification)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can result authorization workflow (technician → pathologist verification) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Cumulative report view for repeat investigations
> As a **lab/radiology technician**, I want **cumulative report view for repeat investigations**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can cumulative report view for repeat investigations from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Report format customization per department
> As a **lab/radiology technician**, I want **report format customization per department**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can report format customization per department from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Auto-delivery of results to doctor dashboard and patient portal
> As a **lab/radiology technician**, I want **auto-delivery of results to doctor dashboard and patient portal**.

`Partial · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [ ] The lab/radiology technician can auto-delivery of results to doctor dashboard and patient portal from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Preliminary report generation
> As a **lab/radiology technician**, I want **preliminary report generation**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can preliminary report generation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Report locking (auto-lock after approval)
> As a **lab/radiology technician**, I want **report locking (auto-lock after approval)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can report locking (auto-lock after approval) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Report amendment with audit trail
> As a **lab/radiology technician**, I want **report amendment with audit trail**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can report amendment with audit trail from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Omni-channel report delivery (WhatsApp, SMS, Email)
> As a **lab/radiology technician**, I want **omni-channel report delivery (whatsapp, sms, email)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can omni-channel report delivery (WhatsApp, SMS, Email) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Bulk report printing
> As a **lab/radiology technician**, I want **bulk report printing**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can bulk report printing from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Report dispatch tracking
> As a **lab/radiology technician**, I want **report dispatch tracking**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can report dispatch tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Referring doctor portal (view reports)
> As a **lab/radiology technician**, I want **referring doctor portal (view reports)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can referring doctor portal (view reports) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Trend charts (patient lab value history)
> As a **lab/radiology technician**, I want **trend charts (patient lab value history)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can trend charts (patient lab value history) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ QR code on lab reports (verification)
> As a **lab/radiology technician**, I want **qr code on lab reports (verification)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can qR code on lab reports (verification) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ TAT tracking & analytics per test with SLA alerts
> As a **lab/radiology technician**, I want **tat tracking & analytics per test with sla alerts**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can tAT tracking & analytics per test with SLA alerts from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ STAT test monitoring
> As a **lab/radiology technician**, I want **stat test monitoring**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can sTAT test monitoring from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Sample Management

### ✅ Lab test master (test name, sample type, container, department)
> As a **lab/radiology technician**, I want **lab test master (test name, sample type, container, department)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can lab test master (test name, sample type, container, department) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Lab panel/profile master (CBC = Hb+WBC+Plt+...)
> As a **lab/radiology technician**, I want **lab panel/profile master (cbc = hb+wbc+plt+...)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can lab panel/profile master (CBC = Hb+WBC+Plt+...) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Electronic test ordering from OPD/IPD/ER (no paper requisition)
> As a **lab/radiology technician**, I want **electronic test ordering from opd/ipd/er (no paper requisition)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can electronic test ordering from OPD/IPD/ER (no paper requisition) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Barcode label generation at point of order
> As a **lab/radiology technician**, I want **barcode label generation at point of order**.

`Partial · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [ ] The lab/radiology technician can barcode label generation at point of order from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Sample collection acknowledgment with timestamp and collector ID
> As a **lab/radiology technician**, I want **sample collection acknowledgment with timestamp and collector id**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can sample collection acknowledgment with timestamp and collector ID from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Sample rejection criteria enforcement with reason documentation
> As a **lab/radiology technician**, I want **sample rejection criteria enforcement with reason documentation**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can sample rejection criteria enforcement with reason documentation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Sample tracking from collection → transport → receipt → processing → report
> As a **lab/radiology technician**, I want **sample tracking from collection → transport → receipt → processing → report**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can sample tracking from collection → transport → receipt → processing → report from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Emergency/STAT sample handling
> As a **lab/radiology technician**, I want **emergency/stat sample handling**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can emergency/STAT sample handling from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Phlebotomy queue management for walk-in patients
> As a **lab/radiology technician**, I want **phlebotomy queue management for walk-in patients**.

`Done · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can phlebotomy queue management for walk-in patients from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Phlebotomist assignment
> As a **lab/radiology technician**, I want **phlebotomist assignment**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can phlebotomist assignment from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Home collection management
> As a **lab/radiology technician**, I want **home collection management**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can home collection management from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Collection center management
> As a **lab/radiology technician**, I want **collection center management**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can collection center management from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Camp-based sample collection
> As a **lab/radiology technician**, I want **camp-based sample collection**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can camp-based sample collection from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Outsourced test management (external lab integration)
> As a **lab/radiology technician**, I want **outsourced test management (external lab integration)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can outsourced test management (external lab integration) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Sample archival & retrieval
> As a **lab/radiology technician**, I want **sample archival & retrieval**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can sample archival & retrieval from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Add-on test to existing sample
> As a **lab/radiology technician**, I want **add-on test to existing sample**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.7, CL-5`

**Acceptance criteria**
- [x] The lab/radiology technician can add-on test to existing sample from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Specialized Labs

### ✅ Microbiology — culture sensitivity report, antibiogram
> As a **lab/radiology technician**, I want **microbiology — culture sensitivity report, antibiogram**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-5 E`

**Acceptance criteria**
- [x] The lab/radiology technician can microbiology — culture sensitivity report, antibiogram from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Histopathology — gross/microscopy, special stains, IHC, synoptic reporting
> As a **lab/radiology technician**, I want **histopathology — gross/microscopy, special stains, ihc, synoptic reporting**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-5 E`

**Acceptance criteria**
- [x] The lab/radiology technician can histopathology — gross/microscopy, special stains, IHC, synoptic reporting from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Blood bank cross-match integration
> As a **lab/radiology technician**, I want **blood bank cross-match integration**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-5 E`

**Acceptance criteria**
- [x] The lab/radiology technician can blood bank cross-match integration from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Cytology (Pap smear, FNAC) reporting
> As a **lab/radiology technician**, I want **cytology (pap smear, fnac) reporting**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-5 E`

**Acceptance criteria**
- [x] The lab/radiology technician can cytology (Pap smear, FNAC) reporting from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Molecular/PCR result management
> As a **lab/radiology technician**, I want **molecular/pcr result management**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-5 E`

**Acceptance criteria**
- [x] The lab/radiology technician can molecular/PCR result management from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Sterilization

### ✅ Individual instrument tracking with barcode/RFID
> As a **lab/radiology technician**, I want **individual instrument tracking with barcode/rfid**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.15, CL-22`

**Acceptance criteria**
- [x] The lab/radiology technician can individual instrument tracking with barcode/RFID from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Instrument set composition management (OT-specific sets)
> As a **lab/radiology technician**, I want **instrument set composition management (ot-specific sets)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.15, CL-22`

**Acceptance criteria**
- [x] The lab/radiology technician can instrument set composition management (OT-specific sets) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Decontamination documentation (pre-cleaning, enzymatic wash)
> As a **lab/radiology technician**, I want **decontamination documentation (pre-cleaning, enzymatic wash)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.15, CL-22`

**Acceptance criteria**
- [x] The lab/radiology technician can decontamination documentation (pre-cleaning, enzymatic wash) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Autoclave cycle logging (time, temperature, pressure, BI results)
> As a **lab/radiology technician**, I want **autoclave cycle logging (time, temperature, pressure, bi results)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.15, CL-22`

**Acceptance criteria**
- [x] The lab/radiology technician can autoclave cycle logging (time, temperature, pressure, BI results) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Chemical indicator tracking per load
> As a **lab/radiology technician**, I want **chemical indicator tracking per load**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.15, CL-22`

**Acceptance criteria**
- [x] The lab/radiology technician can chemical indicator tracking per load from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Biological indicator result tracking with lot linkage
> As a **lab/radiology technician**, I want **biological indicator result tracking with lot linkage**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.15, CL-22`

**Acceptance criteria**
- [x] The lab/radiology technician can biological indicator result tracking with lot linkage from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Sterile pack issuance to OT/ward with expiry tracking
> As a **lab/radiology technician**, I want **sterile pack issuance to ot/ward with expiry tracking**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.15, CL-22`

**Acceptance criteria**
- [x] The lab/radiology technician can sterile pack issuance to OT/ward with expiry tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Recall capability if sterilization failure detected
> As a **lab/radiology technician**, I want **recall capability if sterilization failure detected**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.15, CL-22`

**Acceptance criteria**
- [x] The lab/radiology technician can recall capability if sterilization failure detected from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Flash sterilization documentation (emergency — with justification)
> As a **lab/radiology technician**, I want **flash sterilization documentation (emergency — with justification)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.15, CL-22`

**Acceptance criteria**
- [x] The lab/radiology technician can flash sterilization documentation (emergency — with justification) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Complete traceability: patient → instrument set → autoclave load → BI result
> As a **lab/radiology technician**, I want **complete traceability: patient → instrument set → autoclave load → bi result**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.15, CL-22`

**Acceptance criteria**
- [x] The lab/radiology technician can complete traceability: patient → instrument set → autoclave load → BI result from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Instrument lifecycle and repair/sharpening tracking
> As a **lab/radiology technician**, I want **instrument lifecycle and repair/sharpening tracking**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.15, CL-22`

**Acceptance criteria**
- [x] The lab/radiology technician can instrument lifecycle and repair/sharpening tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ CSSD workload and turnaround time reporting
> As a **lab/radiology technician**, I want **cssd workload and turnaround time reporting**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.15, CL-22`

**Acceptance criteria**
- [x] The lab/radiology technician can cSSD workload and turnaround time reporting from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Sterilizer maintenance log
> As a **lab/radiology technician**, I want **sterilizer maintenance log**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.15, CL-22`

**Acceptance criteria**
- [x] The lab/radiology technician can sterilizer maintenance log from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Testing

### Genetic test ordering integrated into clinical workflow (via Aura-style network)
> As a **lab/radiology technician**, I want **genetic test ordering integrated into clinical workflow (via aura-style network)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The lab/radiology technician can genetic test ordering integrated into clinical workflow (via Aura-style network) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Discrete genetic results in structured format (not PDF attachments)
> As a **lab/radiology technician**, I want **discrete genetic results in structured format (not pdf attachments)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The lab/radiology technician can discrete genetic results in structured format (not PDF attachments) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Diagnostics norms met: LOINC + critical-value reporting (NABL); DICOM/AERB/PCPNDT for imaging; critical results routed to the ordering clinician.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

