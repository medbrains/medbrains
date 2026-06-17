# Admin & Operations — stories

_Auto-generated from `MedBrains_Features.xlsx` — every feature as a story with module-tailored acceptance criteria. 370 stories (✅ = Done). Source of truth is the xlsx; regenerate via `python3 scripts/generate_stories.py`._

## AMC/CMC

### ✅ AMC/CMC contract tracking with validity, coverage, exclusions
> As a **operations admin**, I want **amc/cmc contract tracking with validity, coverage, exclusions**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §M24, CL-10`

**Acceptance criteria**
- [x] The operations admin can aMC/CMC contract tracking with validity, coverage, exclusions from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Renewal alerts (30/60/90 days before expiry)
> As a **operations admin**, I want **renewal alerts (30/60/90 days before expiry)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §M24, CL-10`

**Acceptance criteria**
- [x] The operations admin can renewal alerts (30/60/90 days before expiry) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Vendor response time tracking (SLA)
> As a **operations admin**, I want **vendor response time tracking (sla)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §M24, CL-10`

**Acceptance criteria**
- [x] The operations admin can vendor response time tracking (SLA) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Contract cost vs breakdown cost analysis
> As a **operations admin**, I want **contract cost vs breakdown cost analysis**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §M24, CL-10`

**Acceptance criteria**
- [x] The operations admin can contract cost vs breakdown cost analysis from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Vendor performance evaluation
> As a **operations admin**, I want **vendor performance evaluation**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §M24, CL-10`

**Acceptance criteria**
- [x] The operations admin can vendor performance evaluation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Accreditation

### ✅ NABH standard-wise compliance tracking with Red/Yellow/Green indicators
> As a **operations admin**, I want **nabh standard-wise compliance tracking with red/yellow/green indicators**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.18, CL-12 E`

**Acceptance criteria**
- [x] The operations admin can nABH standard-wise compliance tracking with Red/Yellow/Green indicators from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ NMC MSR parameter tracking with deficiency alerts
> As a **operations admin**, I want **nmc msr parameter tracking with deficiency alerts**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.18, CL-12 E`

**Acceptance criteria**
- [x] The operations admin can nMC MSR parameter tracking with deficiency alerts from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Evidence auto-compilation from HMS modules
> As a **operations admin**, I want **evidence auto-compilation from hms modules**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.18, CL-12 E`

**Acceptance criteria**
- [x] The operations admin can evidence auto-compilation from HMS modules from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Gap analysis and action plan generation
> As a **operations admin**, I want **gap analysis and action plan generation**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.18, CL-12 E`

**Acceptance criteria**
- [x] The operations admin can gap analysis and action plan generation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Mock inspection scheduling with internal assessors
> As a **operations admin**, I want **mock inspection scheduling with internal assessors**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.18, CL-12 E`

**Acceptance criteria**
- [x] The operations admin can mock inspection scheduling with internal assessors from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### NMC NARF self-assessment data collection
> As a **operations admin**, I want **nmc narf self-assessment data collection**.

`Partial · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.18, CL-12 E`

**Acceptance criteria**
- [ ] The operations admin can nMC NARF self-assessment data collection from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### NAAC SSR data aggregation (if applicable)
> As a **operations admin**, I want **naac ssr data aggregation (if applicable)**.

`Partial · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.18, CL-12 E`

**Acceptance criteria**
- [ ] The operations admin can nAAC SSR data aggregation (if applicable) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ ABDM M1-M3 compliance
> As a **operations admin**, I want **abdm m1-m3 compliance**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.18, CL-12 E`

**Acceptance criteria**
- [x] The operations admin can aBDM M1-M3 compliance from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ NABL standards tracking (laboratory)
> As a **operations admin**, I want **nabl standards tracking (laboratory)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.18, CL-12 E`

**Acceptance criteria**
- [x] The operations admin can nABL standards tracking (laboratory) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Internal audit scheduling & tracking
> As a **operations admin**, I want **internal audit scheduling & tracking**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.18, CL-12 E`

**Acceptance criteria**
- [x] The operations admin can internal audit scheduling & tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Antibiotic Stewardship

### ✅ Restricted antibiotic approval workflow (prescriber → ID physician/microbiologist)
> As a **operations admin**, I want **restricted antibiotic approval workflow (prescriber → id physician/microbiologist)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-11 B`

**Acceptance criteria**
- [x] The operations admin can restricted antibiotic approval workflow (prescriber → ID physician/microbiologist) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Antibiotic escalation/de-escalation tracking
> As a **operations admin**, I want **antibiotic escalation/de-escalation tracking**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-11 B`

**Acceptance criteria**
- [x] The operations admin can antibiotic escalation/de-escalation tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Antibiogram generation from microbiology data
> As a **operations admin**, I want **antibiogram generation from microbiology data**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-11 B`

**Acceptance criteria**
- [x] The operations admin can antibiogram generation from microbiology data from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Duration of antibiotic therapy monitoring
> As a **operations admin**, I want **duration of antibiotic therapy monitoring**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-11 B`

**Acceptance criteria**
- [x] The operations admin can duration of antibiotic therapy monitoring from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ DDD (Defined Daily Dose) calculation per department
> As a **operations admin**, I want **ddd (defined daily dose) calculation per department**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-11 B`

**Acceptance criteria**
- [x] The operations admin can dDD (Defined Daily Dose) calculation per department from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Attendance

### Biometric attendance integration
> As a **operations admin**, I want **biometric attendance integration**.

`Partial · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.13, CL-8`

**Acceptance criteria**
- [ ] The operations admin can biometric attendance integration from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### AEBAS (Aadhaar Enabled Biometric Attendance System) compliance
> As a **operations admin**, I want **aebas (aadhaar enabled biometric attendance system) compliance**.

`Partial · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.13, CL-8`

**Acceptance criteria**
- [ ] The operations admin can aEBAS (Aadhaar Enabled Biometric Attendance System) compliance from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Multi-shift attendance management (morning/evening/night)
> As a **operations admin**, I want **multi-shift attendance management (morning/evening/night)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.13, CL-8`

**Acceptance criteria**
- [x] The operations admin can multi-shift attendance management (morning/evening/night) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Late arrival and early departure tracking
> As a **operations admin**, I want **late arrival and early departure tracking**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.13, CL-8`

**Acceptance criteria**
- [x] The operations admin can late arrival and early departure tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Overtime calculation
> As a **operations admin**, I want **overtime calculation**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.13, CL-8`

**Acceptance criteria**
- [x] The operations admin can overtime calculation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Duty roster and shift swap management
> As a **operations admin**, I want **duty roster and shift swap management**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.13, CL-8`

**Acceptance criteria**
- [x] The operations admin can duty roster and shift swap management from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## BMW Collection

### ✅ Waste collection schedule per ward
> As a **operations admin**, I want **waste collection schedule per ward**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-17 B`

**Acceptance criteria**
- [x] The operations admin can waste collection schedule per ward from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Weight-based recording per bag per ward (mobile app with barcode scan)
> As a **operations admin**, I want **weight-based recording per bag per ward (mobile app with barcode scan)**.

`Partial · Platforms: Web · Source: ACMSRC · RFC: CL-17 B`

**Acceptance criteria**
- [ ] The operations admin can weight-based recording per bag per ward (mobile app with barcode scan) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Color-coded segregation compliance verification
> As a **operations admin**, I want **color-coded segregation compliance verification**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-17 B`

**Acceptance criteria**
- [x] The operations admin can color-coded segregation compliance verification from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Transport to central storage documentation
> As a **operations admin**, I want **transport to central storage documentation**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-17 B`

**Acceptance criteria**
- [x] The operations admin can transport to central storage documentation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Sharp container replacement request
> As a **operations admin**, I want **sharp container replacement request**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-17 B`

**Acceptance criteria**
- [x] The operations admin can sharp container replacement request from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Bio-Waste Mgmt

### ✅ Color-coded waste segregation tracking (Yellow/Red/White/Blue per department per day)
> As a **operations admin**, I want **color-coded waste segregation tracking (yellow/red/white/blue per department per day)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.17, CL-11`

**Acceptance criteria**
- [x] The operations admin can color-coded waste segregation tracking (Yellow/Red/White/Blue per department per day) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Weight-based waste generation monitoring
> As a **operations admin**, I want **weight-based waste generation monitoring**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.17, CL-11`

**Acceptance criteria**
- [x] The operations admin can weight-based waste generation monitoring from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Manifest system for waste transporter (challan generation)
> As a **operations admin**, I want **manifest system for waste transporter (challan generation)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.17, CL-11`

**Acceptance criteria**
- [x] The operations admin can manifest system for waste transporter (challan generation) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Sharp container deployment and fill-level tracking
> As a **operations admin**, I want **sharp container deployment and fill-level tracking**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.17, CL-11`

**Acceptance criteria**
- [x] The operations admin can sharp container deployment and fill-level tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Needle stick injury reporting linked to specific container/ward
> As a **operations admin**, I want **needle stick injury reporting linked to specific container/ward**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.17, CL-11`

**Acceptance criteria**
- [x] The operations admin can needle stick injury reporting linked to specific container/ward from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ SPCB quarterly return (Form IV) generation
> As a **operations admin**, I want **spcb quarterly return (form iv) generation**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.17, CL-11`

**Acceptance criteria**
- [x] The operations admin can sPCB quarterly return (Form IV) generation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Mercury management and phased replacement tracking
> As a **operations admin**, I want **mercury management and phased replacement tracking**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.17, CL-11`

**Acceptance criteria**
- [x] The operations admin can mercury management and phased replacement tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Breakdown Maint.

### ✅ Breakdown reporting (department → BME) with timestamp
> As a **operations admin**, I want **breakdown reporting (department → bme) with timestamp**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-10 E`

**Acceptance criteria**
- [x] The operations admin can breakdown reporting (department → BME) with timestamp from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Priority classification (critical equipment — immediate response)
> As a **operations admin**, I want **priority classification (critical equipment — immediate response)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-10 E`

**Acceptance criteria**
- [x] The operations admin can priority classification (critical equipment — immediate response) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Downtime tracking per equipment
> As a **operations admin**, I want **downtime tracking per equipment**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-10 E`

**Acceptance criteria**
- [x] The operations admin can downtime tracking per equipment from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Repair documentation (spare parts used, vendor visit, cost)
> As a **operations admin**, I want **repair documentation (spare parts used, vendor visit, cost)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-10 E`

**Acceptance criteria**
- [x] The operations admin can repair documentation (spare parts used, vendor visit, cost) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Mean Time Between Failures (MTBF) tracking
> As a **operations admin**, I want **mean time between failures (mtbf) tracking**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-10 E`

**Acceptance criteria**
- [x] The operations admin can mean Time Between Failures (MTBF) tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Equipment uptime percentage reporting for NABH
> As a **operations admin**, I want **equipment uptime percentage reporting for nabh**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-10 E`

**Acceptance criteria**
- [x] The operations admin can equipment uptime percentage reporting for NABH from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## CCTV & Incidents

### ✅ Camera inventory management (location, type, status)
> As a **operations admin**, I want **camera inventory management (location, type, status)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-20 B`

**Acceptance criteria**
- [x] The operations admin can camera inventory management (location, type, status) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Incident-linked video retrieval (auto-tag timestamps on incident report)
> As a **operations admin**, I want **incident-linked video retrieval (auto-tag timestamps on incident report)**.

`Partial · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-20 B`

**Acceptance criteria**
- [ ] The operations admin can incident-linked video retrieval (auto-tag timestamps on incident report) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Recording retention policy management (30/90 days, permanent for incidents)
> As a **operations admin**, I want **recording retention policy management (30/90 days, permanent for incidents)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-20 B`

**Acceptance criteria**
- [x] The operations admin can recording retention policy management (30/90 days, permanent for incidents) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Incident reporting with classification and response documentation
> As a **operations admin**, I want **incident reporting with classification and response documentation**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-20 B`

**Acceptance criteria**
- [x] The operations admin can incident reporting with classification and response documentation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Calibration

### ✅ Calibration schedule per equipment (per RFC equipment tables)
> As a **operations admin**, I want **calibration schedule per equipment (per rfc equipment tables)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-10 C`

**Acceptance criteria**
- [x] The operations admin can calibration schedule per equipment (per RFC equipment tables) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Calibration due alert system
> As a **operations admin**, I want **calibration due alert system**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-10 C`

**Acceptance criteria**
- [x] The operations admin can calibration due alert system from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Calibration certificate storage
> As a **operations admin**, I want **calibration certificate storage**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-10 C`

**Acceptance criteria**
- [x] The operations admin can calibration certificate storage from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Out-of-calibration equipment auto-lock/alert
> As a **operations admin**, I want **out-of-calibration equipment auto-lock/alert**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-10 C`

**Acceptance criteria**
- [x] The operations admin can out-of-calibration equipment auto-lock/alert from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Third-party calibration vendor management
> As a **operations admin**, I want **third-party calibration vendor management**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-10 C`

**Acceptance criteria**
- [x] The operations admin can third-party calibration vendor management from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Camps

### ✅ Camp planning & scheduling
> As a **operations admin**, I want **camp planning & scheduling**.

`Done · Platforms: Web · Source: RFC · RFC: §3.22`

**Acceptance criteria**
- [x] The operations admin can camp planning & scheduling from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Camp location & logistics
> As a **operations admin**, I want **camp location & logistics**.

`Done · Platforms: Web · Source: RFC · RFC: §3.22`

**Acceptance criteria**
- [x] The operations admin can camp location & logistics from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Camp patient registration (simplified)
> As a **operations admin**, I want **camp patient registration (simplified)**.

`Done · Platforms: Web · Source: RFC · RFC: §3.22`

**Acceptance criteria**
- [x] The operations admin can camp patient registration (simplified) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Camp lab sample collection
> As a **operations admin**, I want **camp lab sample collection**.

`Done · Platforms: Web, Mobile · Source: RFC · RFC: §3.22`

**Acceptance criteria**
- [x] The operations admin can camp lab sample collection from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Camp billing (free/discounted)
> As a **operations admin**, I want **camp billing (free/discounted)**.

`Done · Platforms: Web · Source: RFC · RFC: §3.22`

**Acceptance criteria**
- [x] The operations admin can camp billing (free/discounted) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Camp reports & analytics
> As a **operations admin**, I want **camp reports & analytics**.

`Done · Platforms: Web · Source: RFC · RFC: §3.22`

**Acceptance criteria**
- [x] The operations admin can camp reports & analytics from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Follow-up tracking for camp patients
> As a **operations admin**, I want **follow-up tracking for camp patients**.

`Done · Platforms: Web · Source: RFC · RFC: §3.22`

**Acceptance criteria**
- [x] The operations admin can follow-up tracking for camp patients from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Camp-to-hospital patient conversion tracking
> As a **operations admin**, I want **camp-to-hospital patient conversion tracking**.

`Done · Platforms: Web · Source: RFC · RFC: §3.22`

**Acceptance criteria**
- [x] The operations admin can camp-to-hospital patient conversion tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Code Protocols

### ✅ Code Blue (cardiac arrest) — activation and response team assembly
> As a **operations admin**, I want **code blue (cardiac arrest) — activation and response team assembly**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-20 D`

**Acceptance criteria**
- [x] The operations admin can code Blue (cardiac arrest) — activation and response team assembly from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Code Red (fire) — RACE protocol and evacuation
> As a **operations admin**, I want **code red (fire) — race protocol and evacuation**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-20 D`

**Acceptance criteria**
- [x] The operations admin can code Red (fire) — RACE protocol and evacuation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Code Pink (infant abduction) — lockdown procedure
> As a **operations admin**, I want **code pink (infant abduction) — lockdown procedure**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-20 D`

**Acceptance criteria**
- [x] The operations admin can code Pink (infant abduction) — lockdown procedure from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Code Silver (weapon/hostage), Code Orange (hazmat), Code Black (bomb)
> As a **operations admin**, I want **code silver (weapon/hostage), code orange (hazmat), code black (bomb)**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-20 D`

**Acceptance criteria**
- [x] The operations admin can code Silver (weapon/hostage), Code Orange (hazmat), Code Black (bomb) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Code Yellow (mass casualty) integration with ER
> As a **operations admin**, I want **code yellow (mass casualty) integration with er**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-20 D`

**Acceptance criteria**
- [x] The operations admin can code Yellow (mass casualty) integration with ER from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Post-event debrief scheduling and documentation
> As a **operations admin**, I want **post-event debrief scheduling and documentation**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-20 D`

**Acceptance criteria**
- [x] The operations admin can post-event debrief scheduling and documentation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Committee Mgmt

### ✅ All mandatory committees configurable (HICC, DTC, Quality, Blood Transfusion, Ethics, etc.)
> As a **operations admin**, I want **all mandatory committees configurable (hicc, dtc, quality, blood transfusion, ethics, etc.)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-12 D`

**Acceptance criteria**
- [x] The operations admin can all mandatory committees configurable (HICC, DTC, Quality, Blood Transfusion, Ethics, etc.) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Auto-scheduling per committee charter (monthly/quarterly)
> As a **operations admin**, I want **auto-scheduling per committee charter (monthly/quarterly)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-12 D`

**Acceptance criteria**
- [x] The operations admin can auto-scheduling per committee charter (monthly/quarterly) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Agenda auto-population from pending items (incidents, purchase requests, audit findings)
> As a **operations admin**, I want **agenda auto-population from pending items (incidents, purchase requests, audit findings)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-12 D`

**Acceptance criteria**
- [x] The operations admin can agenda auto-population from pending items (incidents, purchase requests, audit findings) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Attendance tracking and minutes recording
> As a **operations admin**, I want **attendance tracking and minutes recording**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-12 D`

**Acceptance criteria**
- [x] The operations admin can attendance tracking and minutes recording from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Action item generation with assignee, deadline, and follow-up
> As a **operations admin**, I want **action item generation with assignee, deadline, and follow-up**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-12 D`

**Acceptance criteria**
- [x] The operations admin can action item generation with assignee, deadline, and follow-up from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Compliance dashboard (which committees met, which overdue)
> As a **operations admin**, I want **compliance dashboard (which committees met, which overdue)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-12 D`

**Acceptance criteria**
- [x] The operations admin can compliance dashboard (which committees met, which overdue) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Discharge

### ✅ Case manager assignment per patient with caseload balancing
> As a **operations admin**, I want **case manager assignment per patient with caseload balancing**.

`Done · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The operations admin can case manager assignment per patient with caseload balancing from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Discharge barriers tracking (insurance, placement, equipment, family, transport)
> As a **operations admin**, I want **discharge barriers tracking (insurance, placement, equipment, family, transport)**.

`Done · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The operations admin can discharge barriers tracking (insurance, placement, equipment, family, transport) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Post-acute facility finder (SNF, rehab, LTAC — availability, ratings, distance)
> As a **operations admin**, I want **post-acute facility finder (snf, rehab, ltac — availability, ratings, distance)**.

`Partial · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The operations admin can post-acute facility finder (SNF, rehab, LTAC — availability, ratings, distance) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Social work referral integration (housing, financial assistance, transportation)
> As a **operations admin**, I want **social work referral integration (housing, financial assistance, transportation)**.

`Done · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The operations admin can social work referral integration (housing, financial assistance, transportation) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Discharge disposition tracking (home, SNF, rehab, AMA, expired) with outcome analytics
> As a **operations admin**, I want **discharge disposition tracking (home, snf, rehab, ama, expired) with outcome analytics**.

`Done · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The operations admin can discharge disposition tracking (home, SNF, rehab, AMA, expired) with outcome analytics from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Document Control

### ✅ Document lifecycle: Draft → Review → Approve → Release → Revise → Obsolete
> As a **operations admin**, I want **document lifecycle: draft → review → approve → release → revise → obsolete**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-12 B`

**Acceptance criteria**
- [x] The operations admin can document lifecycle: Draft → Review → Approve → Release → Revise → Obsolete from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Version control with complete history preserved
> As a **operations admin**, I want **version control with complete history preserved**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-12 B`

**Acceptance criteria**
- [x] The operations admin can version control with complete history preserved from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Controlled distribution with read acknowledgment tracking
> As a **operations admin**, I want **controlled distribution with read acknowledgment tracking**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-12 B`

**Acceptance criteria**
- [x] The operations admin can controlled distribution with read acknowledgment tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Non-acknowledgment auto-escalation to HOD
> As a **operations admin**, I want **non-acknowledgment auto-escalation to hod**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-12 B`

**Acceptance criteria**
- [x] The operations admin can non-acknowledgment auto-escalation to HOD from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Watermarked printing (CONTROLLED / UNCONTROLLED)
> As a **operations admin**, I want **watermarked printing (controlled / uncontrolled)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-12 B`

**Acceptance criteria**
- [x] The operations admin can watermarked printing (CONTROLLED / UNCONTROLLED) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Training requirement flagging for new/revised SOPs
> As a **operations admin**, I want **training requirement flagging for new/revised sops**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-12 B`

**Acceptance criteria**
- [x] The operations admin can training requirement flagging for new/revised SOPs from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### External auditor time-limited access for NABH/NABL review
> As a **operations admin**, I want **external auditor time-limited access for nabh/nabl review**.

`Partial · Platforms: Web · Source: ACMSRC · RFC: CL-12 B`

**Acceptance criteria**
- [ ] The operations admin can external auditor time-limited access for NABH/NABL review from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Employee Mgmt

### ✅ Employee master with demographics, qualifications, registration numbers
> As a **operations admin**, I want **employee master with demographics, qualifications, registration numbers**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.13, CL-8`

**Acceptance criteria**
- [x] The operations admin can employee master with demographics, qualifications, registration numbers from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Credentialing management (medical council registration, renewal tracking)
> As a **operations admin**, I want **credentialing management (medical council registration, renewal tracking)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.13, CL-8`

**Acceptance criteria**
- [x] The operations admin can credentialing management (medical council registration, renewal tracking) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Document management (appointment letters, certificates)
> As a **operations admin**, I want **document management (appointment letters, certificates)**.

`Partial · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.13, CL-8`

**Acceptance criteria**
- [ ] The operations admin can document management (appointment letters, certificates) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Department/designation hierarchy management
> As a **operations admin**, I want **department/designation hierarchy management**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.13, CL-8`

**Acceptance criteria**
- [x] The operations admin can department/designation hierarchy management from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Employee onboarding workflow
> As a **operations admin**, I want **employee onboarding workflow**.

`Partial · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.13, CL-8`

**Acceptance criteria**
- [ ] The operations admin can employee onboarding workflow from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Separation/exit processing
> As a **operations admin**, I want **separation/exit processing**.

`Partial · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.13, CL-8`

**Acceptance criteria**
- [ ] The operations admin can separation/exit processing from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Energy Mgmt

### ✅ Grid power, DG, UPS, solar monitoring dashboard
> As a **operations admin**, I want **grid power, dg, ups, solar monitoring dashboard**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-18 D`

**Acceptance criteria**
- [x] The operations admin can grid power, DG, UPS, solar monitoring dashboard from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ DG runtime, fuel consumption, load percentage tracking
> As a **operations admin**, I want **dg runtime, fuel consumption, load percentage tracking**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-18 D`

**Acceptance criteria**
- [x] The operations admin can dG runtime, fuel consumption, load percentage tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ UPS battery health and runtime monitoring per critical area
> As a **operations admin**, I want **ups battery health and runtime monitoring per critical area**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-18 D`

**Acceptance criteria**
- [x] The operations admin can uPS battery health and runtime monitoring per critical area from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Power switchover test tracking (<15 sec for OT/ICU/NICU/Blood Bank)
> As a **operations admin**, I want **power switchover test tracking (<15 sec for ot/icu/nicu/blood bank)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-18 D`

**Acceptance criteria**
- [x] The operations admin can power switchover test tracking (<15 sec for OT/ICU/NICU/Blood Bank) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### CEA (Central Electricity Authority) safety compliance
> As a **operations admin**, I want **cea (central electricity authority) safety compliance**.

`Partial · Platforms: Web · Source: ACMSRC · RFC: CL-18 D`

**Acceptance criteria**
- [ ] The operations admin can cEA (Central Electricity Authority) safety compliance from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Equipment Master

### ✅ Comprehensive equipment database (name, make, model, serial no, location, department)
> As a **operations admin**, I want **comprehensive equipment database (name, make, model, serial no, location, department)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §M24, CL-10`

**Acceptance criteria**
- [x] The operations admin can comprehensive equipment database (name, make, model, serial no, location, department) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Asset tagging with QR/barcode
> As a **operations admin**, I want **asset tagging with qr/barcode**.

`Partial · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §M24, CL-10`

**Acceptance criteria**
- [ ] The operations admin can asset tagging with QR/barcode from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Equipment categorization (critical/non-critical, high-risk/low-risk)
> As a **operations admin**, I want **equipment categorization (critical/non-critical, high-risk/low-risk)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §M24, CL-10`

**Acceptance criteria**
- [x] The operations admin can equipment categorization (critical/non-critical, high-risk/low-risk) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Installation and commissioning records
> As a **operations admin**, I want **installation and commissioning records**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §M24, CL-10`

**Acceptance criteria**
- [x] The operations admin can installation and commissioning records from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Warranty tracking with vendor details
> As a **operations admin**, I want **warranty tracking with vendor details**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §M24, CL-10`

**Acceptance criteria**
- [x] The operations admin can warranty tracking with vendor details from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Equipment lifecycle tracking (procurement → installation → maintenance → condemnation)
> As a **operations admin**, I want **equipment lifecycle tracking (procurement → installation → maintenance → condemnation)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §M24, CL-10`

**Acceptance criteria**
- [x] The operations admin can equipment lifecycle tracking (procurement → installation → maintenance → condemnation) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Fire Safety

### ✅ Fire equipment inventory (extinguishers, hydrants, detectors) with QR code tagging
> As a **operations admin**, I want **fire equipment inventory (extinguishers, hydrants, detectors) with qr code tagging**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-18 B`

**Acceptance criteria**
- [x] The operations admin can fire equipment inventory (extinguishers, hydrants, detectors) with QR code tagging from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Fire equipment inspection schedule and compliance tracking
> As a **operations admin**, I want **fire equipment inspection schedule and compliance tracking**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-18 B`

**Acceptance criteria**
- [x] The operations admin can fire equipment inspection schedule and compliance tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Mock drill management (quarterly per NABH) with drill report generation
> As a **operations admin**, I want **mock drill management (quarterly per nabh) with drill report generation**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-18 B`

**Acceptance criteria**
- [x] The operations admin can mock drill management (quarterly per NABH) with drill report generation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Fire NOC validity tracking with renewal alerts
> As a **operations admin**, I want **fire noc validity tracking with renewal alerts**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-18 B`

**Acceptance criteria**
- [x] The operations admin can fire NOC validity tracking with renewal alerts from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Code Red activation workflow with zone-wise evacuation plan
> As a **operations admin**, I want **code red activation workflow with zone-wise evacuation plan**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-18 B`

**Acceptance criteria**
- [x] The operations admin can code Red activation workflow with zone-wise evacuation plan from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## General

### Learning module builder — rich content editor for text, images, embedded video lessons
> As a **operations admin**, I want **learning module builder — rich content editor for text, images, embedded video lessons**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The operations admin can learning module builder — rich content editor for text, images, embedded video lessons from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Pre-built NABH/JCI compliance course library — 50+ modules mapped to accreditation standards
> As a **operations admin**, I want **pre-built nabh/jci compliance course library — 50+ modules mapped to accreditation standards**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The operations admin can pre-built NABH/JCI compliance course library — 50+ modules mapped to accreditation standards from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Department-specific mandatory modules — Pharmacy→NDPS Act, Lab→NABL, Radiology→AERB, Blood Bank→NACO
> As a **operations admin**, I want **department-specific mandatory modules — pharmacy→ndps act, lab→nabl, radiology→aerb, blood bank→naco**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The operations admin can department-specific mandatory modules — Pharmacy→NDPS Act, Lab→NABL, Radiology→AERB, Blood Bank→NACO from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Video lesson hosting with progress tracking — resume where left off, minimum watch time enforcement
> As a **operations admin**, I want **video lesson hosting with progress tracking — resume where left off, minimum watch time enforcement**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The operations admin can video lesson hosting with progress tracking — resume where left off, minimum watch time enforcement from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Role-based learning paths — auto-assign courses by designation (nurse, doctor, pharmacist, admin)
> As a **operations admin**, I want **role-based learning paths — auto-assign courses by designation (nurse, doctor, pharmacist, admin)**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The operations admin can role-based learning paths — auto-assign courses by designation (nurse, doctor, pharmacist, admin) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Interactive quiz & assessment engine — MCQ, true/false, case-based with configurable pass marks
> As a **operations admin**, I want **interactive quiz & assessment engine — mcq, true/false, case-based with configurable pass marks**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The operations admin can interactive quiz & assessment engine — MCQ, true/false, case-based with configurable pass marks from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### New joiner onboarding learning track — auto-assigned on employee creation with deadline tracking
> As a **operations admin**, I want **new joiner onboarding learning track — auto-assigned on employee creation with deadline tracking**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The operations admin can new joiner onboarding learning track — auto-assigned on employee creation with deadline tracking from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Annual re-certification workflow — auto-trigger re-assessment 30 days before certification expiry
> As a **operations admin**, I want **annual re-certification workflow — auto-trigger re-assessment 30 days before certification expiry**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The operations admin can annual re-certification workflow — auto-trigger re-assessment 30 days before certification expiry from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Regulatory change auto-notification — detect regulation updates and auto-assign refresher modules
> As a **operations admin**, I want **regulatory change auto-notification — detect regulation updates and auto-assign refresher modules**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The operations admin can regulatory change auto-notification — detect regulation updates and auto-assign refresher modules from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Compliance certification tracker — issue/expiry dates, auto-renewal reminders (BLS, fire safety, POSH)
> As a **operations admin**, I want **compliance certification tracker — issue/expiry dates, auto-renewal reminders (bls, fire safety, posh)**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The operations admin can compliance certification tracker — issue/expiry dates, auto-renewal reminders (BLS, fire safety, POSH) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Learning gamification — completion points, department leaderboard, monthly top learner recognition
> As a **operations admin**, I want **learning gamification — completion points, department leaderboard, monthly top learner recognition**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The operations admin can learning gamification — completion points, department leaderboard, monthly top learner recognition from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Audit-ready training compliance reports — per-employee, per-department, per-regulation completion matrix
> As a **operations admin**, I want **audit-ready training compliance reports — per-employee, per-department, per-regulation completion matrix**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The operations admin can audit-ready training compliance reports — per-employee, per-department, per-regulation completion matrix from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Learning analytics dashboard — completion rates, quiz scores, overdue modules, department comparison
> As a **operations admin**, I want **learning analytics dashboard — completion rates, quiz scores, overdue modules, department comparison**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The operations admin can learning analytics dashboard — completion rates, quiz scores, overdue modules, department comparison from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Offline learning mode — download modules for areas with poor connectivity, sync completion on reconnect
> As a **operations admin**, I want **offline learning mode — download modules for areas with poor connectivity, sync completion on reconnect**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The operations admin can offline learning mode — download modules for areas with poor connectivity, sync completion on reconnect from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Energy consumption dashboard — track electricity, diesel, solar, gas usage per department with cost trends
> As a **operations admin**, I want **energy consumption dashboard — track electricity, diesel, solar, gas usage per department with cost trends**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The operations admin can energy consumption dashboard — track electricity, diesel, solar, gas usage per department with cost trends from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Water consumption monitoring — track water usage per department, recycled water percentage, rainwater harvesting
> As a **operations admin**, I want **water consumption monitoring — track water usage per department, recycled water percentage, rainwater harvesting**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The operations admin can water consumption monitoring — track water usage per department, recycled water percentage, rainwater harvesting from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Solar/renewable energy ROI tracker — monitor solar generation vs consumption with payback period calculation
> As a **operations admin**, I want **solar/renewable energy roi tracker — monitor solar generation vs consumption with payback period calculation**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The operations admin can solar/renewable energy ROI tracker — monitor solar generation vs consumption with payback period calculation from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Biomedical waste tracking — categorize, weigh, log waste by type (red/yellow/white/blue) per BMW Rules 2016
> As a **operations admin**, I want **biomedical waste tracking — categorize, weigh, log waste by type (red/yellow/white/blue) per bmw rules 2016**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The operations admin can biomedical waste tracking — categorize, weigh, log waste by type (red/yellow/white/blue) per BMW Rules 2016 from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Carbon footprint calculator — estimate Scope 1/2/3 emissions per department, procedure, and supply chain
> As a **operations admin**, I want **carbon footprint calculator — estimate scope 1/2/3 emissions per department, procedure, and supply chain**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The operations admin can carbon footprint calculator — estimate Scope 1/2/3 emissions per department, procedure, and supply chain from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### OT & lab chemical waste tracking — track formaldehyde, xylene, cytotoxic drug waste with safe disposal logs
> As a **operations admin**, I want **ot & lab chemical waste tracking — track formaldehyde, xylene, cytotoxic drug waste with safe disposal logs**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The operations admin can oT & lab chemical waste tracking — track formaldehyde, xylene, cytotoxic drug waste with safe disposal logs from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Paperless adoption tracker — measure paper reduction across departments (digital consent, e-prescriptions, e-reports)
> As a **operations admin**, I want **paperless adoption tracker — measure paper reduction across departments (digital consent, e-prescriptions, e-reports)**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The operations admin can paperless adoption tracker — measure paper reduction across departments (digital consent, e-prescriptions, e-reports) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Green procurement scoring — rate vendors on sustainability (recyclable packaging, local sourcing, carbon offset)
> As a **operations admin**, I want **green procurement scoring — rate vendors on sustainability (recyclable packaging, local sourcing, carbon offset)**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The operations admin can green procurement scoring — rate vendors on sustainability (recyclable packaging, local sourcing, carbon offset) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### NABH sustainability compliance checklist — auto-mapped to NABH 5th edition green hospital criteria
> As a **operations admin**, I want **nabh sustainability compliance checklist — auto-mapped to nabh 5th edition green hospital criteria**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The operations admin can nABH sustainability compliance checklist — auto-mapped to NABH 5th edition green hospital criteria from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Sustainability KPI dashboard — composite green score with benchmarks against IGBC/GRIHA standards
> As a **operations admin**, I want **sustainability kpi dashboard — composite green score with benchmarks against igbc/griha standards**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The operations admin can sustainability KPI dashboard — composite green score with benchmarks against IGBC/GRIHA standards from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Staff sustainability awareness modules — monthly eco-tips, waste segregation training, energy-saving practices
> As a **operations admin**, I want **staff sustainability awareness modules — monthly eco-tips, waste segregation training, energy-saving practices**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The operations admin can staff sustainability awareness modules — monthly eco-tips, waste segregation training, energy-saving practices from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ESG report generator — annual sustainability report with charts for board/investors/accreditation bodies
> As a **operations admin**, I want **esg report generator — annual sustainability report with charts for board/investors/accreditation bodies**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The operations admin can eSG report generator — annual sustainability report with charts for board/investors/accreditation bodies from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Doctor public profile page — photo, qualifications, specialties, experience, languages, hospital affiliations
> As a **operations admin**, I want **doctor public profile page — photo, qualifications, specialties, experience, languages, hospital affiliations**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The operations admin can doctor public profile page — photo, qualifications, specialties, experience, languages, hospital affiliations from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Doctor availability calendar — real-time slot display integrated with appointment booking widget
> As a **operations admin**, I want **doctor availability calendar — real-time slot display integrated with appointment booking widget**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The operations admin can doctor availability calendar — real-time slot display integrated with appointment booking widget from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Doctor video introduction — 60-second intro video on profile for patient trust-building
> As a **operations admin**, I want **doctor video introduction — 60-second intro video on profile for patient trust-building**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The operations admin can doctor video introduction — 60-second intro video on profile for patient trust-building from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Patient ratings & reviews per doctor — verified visit-based reviews with star ratings and written feedback
> As a **operations admin**, I want **patient ratings & reviews per doctor — verified visit-based reviews with star ratings and written feedback**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The operations admin can patient ratings & reviews per doctor — verified visit-based reviews with star ratings and written feedback from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Doctor awards & publications — certifications, conference presentations, research papers, media features
> As a **operations admin**, I want **doctor awards & publications — certifications, conference presentations, research papers, media features**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The operations admin can doctor awards & publications — certifications, conference presentations, research papers, media features from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Doctor success metrics — procedure count, years of experience, patient satisfaction score (anonymized)
> As a **operations admin**, I want **doctor success metrics — procedure count, years of experience, patient satisfaction score (anonymized)**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The operations admin can doctor success metrics — procedure count, years of experience, patient satisfaction score (anonymized) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Doctor search & discovery — filter/sort by specialty, language, gender, availability, ratings, location
> As a **operations admin**, I want **doctor search & discovery — filter/sort by specialty, language, gender, availability, ratings, location**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The operations admin can doctor search & discovery — filter/sort by specialty, language, gender, availability, ratings, location from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Doctor referral network map — visualize cross-specialty referral relationships and top referral sources
> As a **operations admin**, I want **doctor referral network map — visualize cross-specialty referral relationships and top referral sources**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The operations admin can doctor referral network map — visualize cross-specialty referral relationships and top referral sources from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Treatment cost estimator — patient selects procedure + insurance + room type for estimated cost range
> As a **operations admin**, I want **treatment cost estimator — patient selects procedure + insurance + room type for estimated cost range**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The operations admin can treatment cost estimator — patient selects procedure + insurance + room type for estimated cost range from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Public tariff card — standard price list for common procedures, surgeries, packages (NABH requirement)
> As a **operations admin**, I want **public tariff card — standard price list for common procedures, surgeries, packages (nabh requirement)**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The operations admin can public tariff card — standard price list for common procedures, surgeries, packages (NABH requirement) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Insurance coverage calculator — patient selects insurer + plan for covered amount vs out-of-pocket estimate
> As a **operations admin**, I want **insurance coverage calculator — patient selects insurer + plan for covered amount vs out-of-pocket estimate**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The operations admin can insurance coverage calculator — patient selects insurer + plan for covered amount vs out-of-pocket estimate from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### EMI/installment payment options — split payment plans for high-cost treatments via banking partners
> As a **operations admin**, I want **emi/installment payment options — split payment plans for high-cost treatments via banking partners**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The operations admin can eMI/installment payment options — split payment plans for high-cost treatments via banking partners from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Room category cost comparison — General / Semi-Private / Private / Deluxe / Suite pricing with amenity details
> As a **operations admin**, I want **room category cost comparison — general / semi-private / private / deluxe / suite pricing with amenity details**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The operations admin can room category cost comparison — General / Semi-Private / Private / Deluxe / Suite pricing with amenity details from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Advance deposit calculator — estimated deposit based on procedure, expected stay, and insurance coverage
> As a **operations admin**, I want **advance deposit calculator — estimated deposit based on procedure, expected stay, and insurance coverage**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The operations admin can advance deposit calculator — estimated deposit based on procedure, expected stay, and insurance coverage from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Bill vs estimate reconciliation — show patients how actual charges compared to initial estimate with variance explanation
> As a **operations admin**, I want **bill vs estimate reconciliation — show patients how actual charges compared to initial estimate with variance explanation**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The operations admin can bill vs estimate reconciliation — show patients how actual charges compared to initial estimate with variance explanation from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Cost transparency dashboard — average costs by procedure for management benchmarking and public reporting
> As a **operations admin**, I want **cost transparency dashboard — average costs by procedure for management benchmarking and public reporting**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The operations admin can cost transparency dashboard — average costs by procedure for management benchmarking and public reporting from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Patient referral program — existing patients refer friends/family with trackable referral codes and links
> As a **operations admin**, I want **patient referral program — existing patients refer friends/family with trackable referral codes and links**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The operations admin can patient referral program — existing patients refer friends/family with trackable referral codes and links from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Referral reward system — automatic discounts, cashback, or loyalty points for successful referral conversions
> As a **operations admin**, I want **referral reward system — automatic discounts, cashback, or loyalty points for successful referral conversions**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The operations admin can referral reward system — automatic discounts, cashback, or loyalty points for successful referral conversions from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Doctor-to-doctor referral tracking — which external physicians refer patients, referral volume and revenue attribution
> As a **operations admin**, I want **doctor-to-doctor referral tracking — which external physicians refer patients, referral volume and revenue attribution**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The operations admin can doctor-to-doctor referral tracking — which external physicians refer patients, referral volume and revenue attribution from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Loyalty tier system — Bronze/Silver/Gold/Platinum tiers based on visit frequency and cumulative spend
> As a **operations admin**, I want **loyalty tier system — bronze/silver/gold/platinum tiers based on visit frequency and cumulative spend**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The operations admin can loyalty tier system — Bronze/Silver/Gold/Platinum tiers based on visit frequency and cumulative spend from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Tier-based benefits — priority appointments, room upgrades, complimentary services escalating by tier
> As a **operations admin**, I want **tier-based benefits — priority appointments, room upgrades, complimentary services escalating by tier**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The operations admin can tier-based benefits — priority appointments, room upgrades, complimentary services escalating by tier from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Loyalty points accumulation & redemption — earn on bills, redeem for services, pharmacy, or partner offers
> As a **operations admin**, I want **loyalty points accumulation & redemption — earn on bills, redeem for services, pharmacy, or partner offers**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The operations admin can loyalty points accumulation & redemption — earn on bills, redeem for services, pharmacy, or partner offers from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### VIP patient identification — flagged across all touchpoints (reception, nursing, billing) for premium treatment
> As a **operations admin**, I want **vip patient identification — flagged across all touchpoints (reception, nursing, billing) for premium treatment**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The operations admin can vIP patient identification — flagged across all touchpoints (reception, nursing, billing) for premium treatment from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Referral & loyalty analytics — referral conversion rate, loyalty program ROI, tier distribution, churn by tier
> As a **operations admin**, I want **referral & loyalty analytics — referral conversion rate, loyalty program roi, tier distribution, churn by tier**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The operations admin can referral & loyalty analytics — referral conversion rate, loyalty program ROI, tier distribution, churn by tier from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Patient concierge assignment — dedicated coordinator for premium/international patients with task tracking
> As a **operations admin**, I want **patient concierge assignment — dedicated coordinator for premium/international patients with task tracking**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The operations admin can patient concierge assignment — dedicated coordinator for premium/international patients with task tracking from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Premium room booking — suite/deluxe room selection with photo gallery, amenity list, real-time availability
> As a **operations admin**, I want **premium room booking — suite/deluxe room selection with photo gallery, amenity list, real-time availability**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The operations admin can premium room booking — suite/deluxe room selection with photo gallery, amenity list, real-time availability from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Priority appointment scheduling — VIP fast-track queue bypass for consultations, diagnostics, procedures
> As a **operations admin**, I want **priority appointment scheduling — vip fast-track queue bypass for consultations, diagnostics, procedures**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The operations admin can priority appointment scheduling — VIP fast-track queue bypass for consultations, diagnostics, procedures from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Executive lounge & waiting area — premium waiting zone access with complimentary refreshments and Wi-Fi
> As a **operations admin**, I want **executive lounge & waiting area — premium waiting zone access with complimentary refreshments and wi-fi**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The operations admin can executive lounge & waiting area — premium waiting zone access with complimentary refreshments and Wi-Fi from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Personalized care plan communication — daily schedule, upcoming tests, diet delivered via app/SMS/WhatsApp
> As a **operations admin**, I want **personalized care plan communication — daily schedule, upcoming tests, diet delivered via app/sms/whatsapp**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The operations admin can personalized care plan communication — daily schedule, upcoming tests, diet delivered via app/SMS/WhatsApp from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Concierge task dashboard — coordinator tracks all patient requests, service delivery SLAs, escalations
> As a **operations admin**, I want **concierge task dashboard — coordinator tracks all patient requests, service delivery slas, escalations**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The operations admin can concierge task dashboard — coordinator tracks all patient requests, service delivery SLAs, escalations from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Guest & attendant services — extra bed booking, meal ordering, parking reservation for patient companions
> As a **operations admin**, I want **guest & attendant services — extra bed booking, meal ordering, parking reservation for patient companions**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The operations admin can guest & attendant services — extra bed booking, meal ordering, parking reservation for patient companions from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Premium service billing — separate line items for concierge add-ons with transparent pricing
> As a **operations admin**, I want **premium service billing — separate line items for concierge add-ons with transparent pricing**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The operations admin can premium service billing — separate line items for concierge add-ons with transparent pricing from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Procedure success rate dashboard — publicly shareable outcomes by department and procedure type
> As a **operations admin**, I want **procedure success rate dashboard — publicly shareable outcomes by department and procedure type**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The operations admin can procedure success rate dashboard — publicly shareable outcomes by department and procedure type from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Patient satisfaction scorecards — NPS and department-wise satisfaction scores with trend graphs
> As a **operations admin**, I want **patient satisfaction scorecards — nps and department-wise satisfaction scores with trend graphs**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The operations admin can patient satisfaction scorecards — NPS and department-wise satisfaction scores with trend graphs from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Readmission rate display — low readmission rates as quality indicator with national benchmark comparison
> As a **operations admin**, I want **readmission rate display — low readmission rates as quality indicator with national benchmark comparison**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The operations admin can readmission rate display — low readmission rates as quality indicator with national benchmark comparison from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Average length of stay benchmarks — ALOS by procedure vs national/regional standards
> As a **operations admin**, I want **average length of stay benchmarks — alos by procedure vs national/regional standards**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The operations admin can average length of stay benchmarks — ALOS by procedure vs national/regional standards from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Accreditation & quality badge showcase — NABH/JCI/NABL/ISO badges with verification links and validity dates
> As a **operations admin**, I want **accreditation & quality badge showcase — nabh/jci/nabl/iso badges with verification links and validity dates**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The operations admin can accreditation & quality badge showcase — NABH/JCI/NABL/ISO badges with verification links and validity dates from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Clinical excellence awards display — department-level recognitions, certifications, and media features
> As a **operations admin**, I want **clinical excellence awards display — department-level recognitions, certifications, and media features**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The operations admin can clinical excellence awards display — department-level recognitions, certifications, and media features from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## HAI Surveillance

### ✅ CLABSI (Central Line Associated BSI) tracking with device-days calculation
> As a **operations admin**, I want **clabsi (central line associated bsi) tracking with device-days calculation**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.17, CL-11`

**Acceptance criteria**
- [x] The operations admin can cLABSI (Central Line Associated BSI) tracking with device-days calculation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ CAUTI (Catheter Associated UTI) tracking
> As a **operations admin**, I want **cauti (catheter associated uti) tracking**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.17, CL-11`

**Acceptance criteria**
- [x] The operations admin can cAUTI (Catheter Associated UTI) tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ VAP (Ventilator Associated Pneumonia) tracking
> As a **operations admin**, I want **vap (ventilator associated pneumonia) tracking**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.17, CL-11`

**Acceptance criteria**
- [x] The operations admin can vAP (Ventilator Associated Pneumonia) tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ SSI (Surgical Site Infection) surveillance per procedure type
> As a **operations admin**, I want **ssi (surgical site infection) surveillance per procedure type**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.17, CL-11`

**Acceptance criteria**
- [x] The operations admin can sSI (Surgical Site Infection) surveillance per procedure type from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ HAI rate calculation per ICU/ward with benchmarking
> As a **operations admin**, I want **hai rate calculation per icu/ward with benchmarking**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.17, CL-11`

**Acceptance criteria**
- [x] The operations admin can hAI rate calculation per ICU/ward with benchmarking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Infection control dashboard with real-time alerts
> As a **operations admin**, I want **infection control dashboard with real-time alerts**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.17, CL-11`

**Acceptance criteria**
- [x] The operations admin can infection control dashboard with real-time alerts from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Hand Hygiene

### ✅ Hand hygiene compliance monitoring (5 moments of hand hygiene)
> As a **operations admin**, I want **hand hygiene compliance monitoring (5 moments of hand hygiene)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-11 D`

**Acceptance criteria**
- [x] The operations admin can hand hygiene compliance monitoring (5 moments of hand hygiene) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Audit tool for hand hygiene observation
> As a **operations admin**, I want **audit tool for hand hygiene observation**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-11 D`

**Acceptance criteria**
- [x] The operations admin can audit tool for hand hygiene observation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Endoscope reprocessing (HLD) cycle tracking per scope serial number
> As a **operations admin**, I want **endoscope reprocessing (hld) cycle tracking per scope serial number**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-11 D`

**Acceptance criteria**
- [x] The operations admin can endoscope reprocessing (HLD) cycle tracking per scope serial number from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Scope culture surveillance result tracking
> As a **operations admin**, I want **scope culture surveillance result tracking**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-11 D`

**Acceptance criteria**
- [x] The operations admin can scope culture surveillance result tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Environmental culture tracking
> As a **operations admin**, I want **environmental culture tracking**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-11 D`

**Acceptance criteria**
- [x] The operations admin can environmental culture tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Incident Reporting

### ✅ Anonymous incident reporting option (technically enforced, not just policy)
> As a **operations admin**, I want **anonymous incident reporting option (technically enforced, not just policy)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-12 C`

**Acceptance criteria**
- [x] The operations admin can anonymous incident reporting option (technically enforced, not just policy) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Incident classification (medication error, fall, needle stick, sentinel event, near-miss)
> As a **operations admin**, I want **incident classification (medication error, fall, needle stick, sentinel event, near-miss)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-12 C`

**Acceptance criteria**
- [x] The operations admin can incident classification (medication error, fall, needle stick, sentinel event, near-miss) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Auto-routing to department HOD and Quality Manager
> As a **operations admin**, I want **auto-routing to department hod and quality manager**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-12 C`

**Acceptance criteria**
- [x] The operations admin can auto-routing to department HOD and Quality Manager from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Root Cause Analysis (RCA) template per NABH standard
> As a **operations admin**, I want **root cause analysis (rca) template per nabh standard**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-12 C`

**Acceptance criteria**
- [x] The operations admin can root Cause Analysis (RCA) template per NABH standard from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ CAPA (Corrective & Preventive Action) tracking with due dates
> As a **operations admin**, I want **capa (corrective & preventive action) tracking with due dates**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-12 C`

**Acceptance criteria**
- [x] The operations admin can cAPA (Corrective & Preventive Action) tracking with due dates from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Incident reports are NEVER deletable (permanent audit log)
> As a **operations admin**, I want **incident reports are never deletable (permanent audit log)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-12 C`

**Acceptance criteria**
- [x] The operations admin can incident reports are NEVER deletable (permanent audit log) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Regulatory reporting — PvPI (ADR), Hemovigilance (NACO), Materiovigilance (CDSCO)
> As a **operations admin**, I want **regulatory reporting — pvpi (adr), hemovigilance (naco), materiovigilance (cdsco)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-12 C`

**Acceptance criteria**
- [x] The operations admin can regulatory reporting — PvPI (ADR), Hemovigilance (NACO), Materiovigilance (CDSCO) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Indicators

### ✅ Clinical indicators (mortality rate, readmission rate, SSI rate, average LOS)
> As a **operations admin**, I want **clinical indicators (mortality rate, readmission rate, ssi rate, average los)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-12 A`

**Acceptance criteria**
- [x] The operations admin can clinical indicators (mortality rate, readmission rate, SSI rate, average LOS) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Patient safety indicators (fall rate, medication error rate, pressure ulcer rate)
> As a **operations admin**, I want **patient safety indicators (fall rate, medication error rate, pressure ulcer rate)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-12 A`

**Acceptance criteria**
- [x] The operations admin can patient safety indicators (fall rate, medication error rate, pressure ulcer rate) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Operational indicators (OPD waiting time, ER door-to-doctor, OT utilization)
> As a **operations admin**, I want **operational indicators (opd waiting time, er door-to-doctor, ot utilization)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-12 A`

**Acceptance criteria**
- [x] The operations admin can operational indicators (OPD waiting time, ER door-to-doctor, OT utilization) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Benchmark comparison (national/international standards)
> As a **operations admin**, I want **benchmark comparison (national/international standards)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-12 A`

**Acceptance criteria**
- [x] The operations admin can benchmark comparison (national/international standards) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Auto-calculated from clinical data (not manual entry)
> As a **operations admin**, I want **auto-calculated from clinical data (not manual entry)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-12 A`

**Acceptance criteria**
- [x] The operations admin can auto-calculated from clinical data (not manual entry) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Trend analysis with graphical dashboards
> As a **operations admin**, I want **trend analysis with graphical dashboards**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-12 A`

**Acceptance criteria**
- [x] The operations admin can trend analysis with graphical dashboards from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Injury

### ✅ Work-related injury documentation with OSHA recordability determination
> As a **operations admin**, I want **work-related injury documentation with osha recordability determination**.

`Done · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The operations admin can work-related injury documentation with OSHA recordability determination from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Workers compensation claim integration (injury → treatment → claim)
> As a **operations admin**, I want **workers compensation claim integration (injury → treatment → claim)**.

`Done · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The operations admin can workers compensation claim integration (injury → treatment → claim) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Return-to-work clearance workflow with restrictions and accommodations
> As a **operations admin**, I want **return-to-work clearance workflow with restrictions and accommodations**.

`Done · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The operations admin can return-to-work clearance workflow with restrictions and accommodations from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Insurance & TPA

### ✅ Insurance/TPA pre-authorization workflow
> As a **operations admin**, I want **insurance/tpa pre-authorization workflow**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can insurance/TPA pre-authorization workflow from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Cashless claim processing and tracking
> As a **operations admin**, I want **cashless claim processing and tracking**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can cashless claim processing and tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Reimbursement claim documentation generation
> As a **operations admin**, I want **reimbursement claim documentation generation**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can reimbursement claim documentation generation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### CGHS/ECHS/ESI/Ayushman Bharat integration
> As a **operations admin**, I want **cghs/echs/esi/ayushman bharat integration**.

`Partial · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [ ] The operations admin can cGHS/ECHS/ESI/Ayushman Bharat integration from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Claim rejection tracking and re-submission workflow
> As a **operations admin**, I want **claim rejection tracking and re-submission workflow**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can claim rejection tracking and re-submission workflow from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ TPA-wise rate negotiation management
> As a **operations admin**, I want **tpa-wise rate negotiation management**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can tPA-wise rate negotiation management from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Co-pay/deductible calculation
> As a **operations admin**, I want **co-pay/deductible calculation**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can co-pay/deductible calculation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Dual insurance (primary + secondary)
> As a **operations admin**, I want **dual insurance (primary + secondary)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can dual insurance (primary + secondary) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Corporate billing & invoicing
> As a **operations admin**, I want **corporate billing & invoicing**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can corporate billing & invoicing from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Corporate credit management
> As a **operations admin**, I want **corporate credit management**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can corporate credit management from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Insurance panel (smart panel view)
> As a **operations admin**, I want **insurance panel (smart panel view)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can insurance panel (smart panel view) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### NHCX (National Health Claim Exchange) integration
> As a **operations admin**, I want **nhcx (national health claim exchange) integration**.

`Partial · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [ ] The operations admin can nHCX (National Health Claim Exchange) integration from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Linen & Laundry

### Linen lifecycle tracking (barcode/RFID per item)
> As a **operations admin**, I want **linen lifecycle tracking (barcode/rfid per item)**.

`Partial · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-17 C`

**Acceptance criteria**
- [ ] The operations admin can linen lifecycle tracking (barcode/RFID per item) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Ward-wise soiled linen collection with weight-based recording
> As a **operations admin**, I want **ward-wise soiled linen collection with weight-based recording**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-17 C`

**Acceptance criteria**
- [x] The operations admin can ward-wise soiled linen collection with weight-based recording from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Infection classification (regular vs contaminated vs isolation)
> As a **operations admin**, I want **infection classification (regular vs contaminated vs isolation)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-17 C`

**Acceptance criteria**
- [x] The operations admin can infection classification (regular vs contaminated vs isolation) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Wash process tracking (formula, temperature, cycle time)
> As a **operations admin**, I want **wash process tracking (formula, temperature, cycle time)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-17 C`

**Acceptance criteria**
- [x] The operations admin can wash process tracking (formula, temperature, cycle time) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Clean linen distribution with par level management
> As a **operations admin**, I want **clean linen distribution with par level management**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-17 C`

**Acceptance criteria**
- [x] The operations admin can clean linen distribution with par level management from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Linen loss tracking (collected vs returned audit)
> As a **operations admin**, I want **linen loss tracking (collected vs returned audit)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-17 C`

**Acceptance criteria**
- [x] The operations admin can linen loss tracking (collected vs returned audit) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Condemnation workflow (lifecycle reached — 100-150 washes for bed linen)
> As a **operations admin**, I want **condemnation workflow (lifecycle reached — 100-150 washes for bed linen)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-17 C`

**Acceptance criteria**
- [x] The operations admin can condemnation workflow (lifecycle reached — 100-150 washes for bed linen) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## MGPS

### ✅ PSA O2 plant monitoring (purity >93%, pressure, flow, temperature)
> As a **operations admin**, I want **psa o2 plant monitoring (purity >93%, pressure, flow, temperature)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-18 A`

**Acceptance criteria**
- [x] The operations admin can pSA O2 plant monitoring (purity >93%, pressure, flow, temperature) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ LMO tank level monitoring with IoT alerts
> As a **operations admin**, I want **lmo tank level monitoring with iot alerts**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-18 A`

**Acceptance criteria**
- [x] The operations admin can lMO tank level monitoring with IoT alerts from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Cylinder manifold status and auto-switchover monitoring
> As a **operations admin**, I want **cylinder manifold status and auto-switchover monitoring**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-18 A`

**Acceptance criteria**
- [x] The operations admin can cylinder manifold status and auto-switchover monitoring from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Zone valve status per floor/department
> As a **operations admin**, I want **zone valve status per floor/department**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-18 A`

**Acceptance criteria**
- [x] The operations admin can zone valve status per floor/department from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Pipeline pressure monitoring at key points (3.5-4 bar outlet)
> As a **operations admin**, I want **pipeline pressure monitoring at key points (3.5-4 bar outlet)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-18 A`

**Acceptance criteria**
- [x] The operations admin can pipeline pressure monitoring at key points (3.5-4 bar outlet) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Daily O2 consumption per department
> As a **operations admin**, I want **daily o2 consumption per department**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-18 A`

**Acceptance criteria**
- [x] The operations admin can daily O2 consumption per department from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Gas purity analyzer integration
> As a **operations admin**, I want **gas purity analyzer integration**.

`Partial · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-18 A`

**Acceptance criteria**
- [ ] The operations admin can gas purity analyzer integration from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ PESO compliance documentation and Drug License tracking
> As a **operations admin**, I want **peso compliance documentation and drug license tracking**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-18 A`

**Acceptance criteria**
- [x] The operations admin can pESO compliance documentation and Drug License tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Medical Records

### ✅ Medical record indexing
> As a **operations admin**, I want **medical record indexing**.

`Done · Platforms: Web · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [x] The operations admin can medical record indexing from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Record retrieval tracking
> As a **operations admin**, I want **record retrieval tracking**.

`Done · Platforms: Web · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [x] The operations admin can record retrieval tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Record movement tracking
> As a **operations admin**, I want **record movement tracking**.

`Done · Platforms: Web · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [x] The operations admin can record movement tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Coding (ICD-10, procedure coding)
> As a **operations admin**, I want **coding (icd-10, procedure coding)**.

`Done · Platforms: Web, Mobile · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [x] The operations admin can coding (ICD-10, procedure coding) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Morbidity & mortality reports
> As a **operations admin**, I want **morbidity & mortality reports**.

`Done · Platforms: Web · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [x] The operations admin can morbidity & mortality reports from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Statistical reports (admission, discharge, death rates)
> As a **operations admin**, I want **statistical reports (admission, discharge, death rates)**.

`Done · Platforms: Web · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [x] The operations admin can statistical reports (admission, discharge, death rates) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Birth & death register
> As a **operations admin**, I want **birth & death register**.

`Done · Platforms: Web · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [x] The operations admin can birth & death register from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ MLC register
> As a **operations admin**, I want **mlc register**.

`Done · Platforms: Web · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [x] The operations admin can mLC register from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Record retention & destruction policy
> As a **operations admin**, I want **record retention & destruction policy**.

`Done · Platforms: Web · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [x] The operations admin can record retention & destruction policy from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Scanned document management
> As a **operations admin**, I want **scanned document management**.

`Partial · Platforms: Web · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [ ] The operations admin can scanned document management from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Medico-legal case documentation
> As a **operations admin**, I want **medico-legal case documentation**.

`Done · Platforms: Web · Source: RFC · RFC: §3.18`

**Acceptance criteria**
- [x] The operations admin can medico-legal case documentation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Needle Stick

### ✅ Needle stick / blood exposure incident protocol with follow-up scheduling
> As a **operations admin**, I want **needle stick / blood exposure incident protocol with follow-up scheduling**.

`Done · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The operations admin can needle stick / blood exposure incident protocol with follow-up scheduling from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## No-Show AI

### ✅ ML-based no-show prediction scoring per appointment (historical patterns, demographics)
> As a **operations admin**, I want **ml-based no-show prediction scoring per appointment (historical patterns, demographics)**.

`Done · Platforms: Web · Source: Epic+iElixir · RFC: §Ext`

**Acceptance criteria**
- [x] The operations admin can mL-based no-show prediction scoring per appointment (historical patterns, demographics) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Overbooking recommendation based on predicted no-show rate per slot
> As a **operations admin**, I want **overbooking recommendation based on predicted no-show rate per slot**.

`Done · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The operations admin can overbooking recommendation based on predicted no-show rate per slot from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Targeted reminder escalation for high no-show risk patients (call instead of SMS)
> As a **operations admin**, I want **targeted reminder escalation for high no-show risk patients (call instead of sms)**.

`Done · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The operations admin can targeted reminder escalation for high no-show risk patients (call instead of SMS) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Waitlist auto-fill — offer cancelled/no-show slots to waitlisted patients instantly
> As a **operations admin**, I want **waitlist auto-fill — offer cancelled/no-show slots to waitlisted patients instantly**.

`Done · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The operations admin can waitlist auto-fill — offer cancelled/no-show slots to waitlisted patients instantly from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ No-show analytics dashboard (rate by doctor, department, day, time, insurance)
> As a **operations admin**, I want **no-show analytics dashboard (rate by doctor, department, day, time, insurance)**.

`Done · Platforms: Web, Mobile · Source: Epic+iElixir · RFC: §Ext`

**Acceptance criteria**
- [x] The operations admin can no-show analytics dashboard (rate by doctor, department, day, time, insurance) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Operations

### ✅ OPD billing (consultation, investigations, procedures) auto-generated from orders
> As a **operations admin**, I want **opd billing (consultation, investigations, procedures) auto-generated from orders**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can oPD billing (consultation, investigations, procedures) auto-generated from orders from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ IPD billing (room charges auto-calculated, consumables, procedures, pharmacy)
> As a **operations admin**, I want **ipd billing (room charges auto-calculated, consumables, procedures, pharmacy)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can iPD billing (room charges auto-calculated, consumables, procedures, pharmacy) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Interim bill generation for long-stay patients
> As a **operations admin**, I want **interim bill generation for long-stay patients**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can interim bill generation for long-stay patients from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Final bill auto-compilation at discharge
> As a **operations admin**, I want **final bill auto-compilation at discharge**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can final bill auto-compilation at discharge from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Multiple payment modes (cash, card, UPI, NEFT, cheque)
> As a **operations admin**, I want **multiple payment modes (cash, card, upi, neft, cheque)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can multiple payment modes (cash, card, UPI, NEFT, cheque) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Advance/deposit collection and adjustment
> As a **operations admin**, I want **advance/deposit collection and adjustment**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can advance/deposit collection and adjustment from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Refund processing workflow with approval
> As a **operations admin**, I want **refund processing workflow with approval**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can refund processing workflow with approval from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Concession/discount workflow with authorization levels
> As a **operations admin**, I want **concession/discount workflow with authorization levels**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can concession/discount workflow with authorization levels from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Package billing for surgeries, day care, health checkups
> As a **operations admin**, I want **package billing for surgeries, day care, health checkups**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can package billing for surgeries, day care, health checkups from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ ER billing (deferred billing for emergency cases)
> As a **operations admin**, I want **er billing (deferred billing for emergency cases)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can eR billing (deferred billing for emergency cases) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Multi-level rate plans (general, staff, VIP, corporate, insurance)
> As a **operations admin**, I want **multi-level rate plans (general, staff, vip, corporate, insurance)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can multi-level rate plans (general, staff, VIP, corporate, insurance) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Service/procedure rate master
> As a **operations admin**, I want **service/procedure rate master**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can service/procedure rate master from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Lab billing
> As a **operations admin**, I want **lab billing**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can lab billing from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Pharmacy billing
> As a **operations admin**, I want **pharmacy billing**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can pharmacy billing from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Radiology billing
> As a **operations admin**, I want **radiology billing**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can radiology billing from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ OT billing
> As a **operations admin**, I want **ot billing**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can oT billing from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Auto-charge on service (lab order → auto-bill)
> As a **operations admin**, I want **auto-charge on service (lab order → auto-bill)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can auto-charge on service (lab order → auto-bill) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Bill cancellation & refund
> As a **operations admin**, I want **bill cancellation & refund**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can bill cancellation & refund from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Multi-payment mode per bill
> As a **operations admin**, I want **multi-payment mode per bill**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can multi-payment mode per bill from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Receipt generation & print
> As a **operations admin**, I want **receipt generation & print**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can receipt generation & print from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Bill print (customizable format with GST breakup)
> As a **operations admin**, I want **bill print (customizable format with gst breakup)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can bill print (customizable format with GST breakup) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Duplicate bill generation
> As a **operations admin**, I want **duplicate bill generation**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can duplicate bill generation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Multi-currency support
> As a **operations admin**, I want **multi-currency support**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can multi-currency support from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ GST/tax management
> As a **operations admin**, I want **gst/tax management**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can gST/tax management from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Billing threshold control
> As a **operations admin**, I want **billing threshold control**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can billing threshold control from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Outbreak Mgmt

### Outbreak detection alerts (unusual pathogen clustering)
> As a **operations admin**, I want **outbreak detection alerts (unusual pathogen clustering)**.

`Partial · Platforms: Web · Source: ACMSRC · RFC: CL-11 E`

**Acceptance criteria**
- [ ] The operations admin can outbreak detection alerts (unusual pathogen clustering) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Line listing generation for outbreak investigation
> As a **operations admin**, I want **line listing generation for outbreak investigation**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-11 E`

**Acceptance criteria**
- [x] The operations admin can line listing generation for outbreak investigation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Contact tracing capability
> As a **operations admin**, I want **contact tracing capability**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-11 E`

**Acceptance criteria**
- [x] The operations admin can contact tracing capability from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Outbreak mode activation (visitor restriction, enhanced precautions)
> As a **operations admin**, I want **outbreak mode activation (visitor restriction, enhanced precautions)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-11 E`

**Acceptance criteria**
- [x] The operations admin can outbreak mode activation (visitor restriction, enhanced precautions) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ HICC (Hospital Infection Control Committee) meeting trigger
> As a **operations admin**, I want **hicc (hospital infection control committee) meeting trigger**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-11 E`

**Acceptance criteria**
- [x] The operations admin can hICC (Hospital Infection Control Committee) meeting trigger from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Patient Security

### Infant RFID tagging system (mother-baby matching)
> As a **operations admin**, I want **infant rfid tagging system (mother-baby matching)**.

`Partial · Platforms: Web · Source: ACMSRC · RFC: CL-20 C`

**Acceptance criteria**
- [ ] The operations admin can infant RFID tagging system (mother-baby matching) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Zone alert if infant tag exits designated area
> As a **operations admin**, I want **zone alert if infant tag exits designated area**.

`Partial · Platforms: Web · Source: ACMSRC · RFC: CL-20 C`

**Acceptance criteria**
- [ ] The operations admin can zone alert if infant tag exits designated area from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Code Pink activation workflow for missing infant
> As a **operations admin**, I want **code pink activation workflow for missing infant**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-20 C`

**Acceptance criteria**
- [x] The operations admin can code Pink activation workflow for missing infant from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Absconder/elopement patient protocol (psychiatric, MLC)
> As a **operations admin**, I want **absconder/elopement patient protocol (psychiatric, mlc)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-20 C`

**Acceptance criteria**
- [x] The operations admin can absconder/elopement patient protocol (psychiatric, MLC) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Wander guard for dementia patients
> As a **operations admin**, I want **wander guard for dementia patients**.

`Partial · Platforms: Web · Source: ACMSRC · RFC: CL-20 C`

**Acceptance criteria**
- [ ] The operations admin can wander guard for dementia patients from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Payroll & Leave

### Payroll processing with attendance integration
> As a **operations admin**, I want **payroll processing with attendance integration**.

`Partial · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.13, CL-8`

**Acceptance criteria**
- [ ] The operations admin can payroll processing with attendance integration from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Leave management (CL, EL, ML, maternity, paternity)
> As a **operations admin**, I want **leave management (cl, el, ml, maternity, paternity)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.13, CL-8`

**Acceptance criteria**
- [x] The operations admin can leave management (CL, EL, ML, maternity, paternity) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Leave approval workflow (employee → HOD → admin)
> As a **operations admin**, I want **leave approval workflow (employee → hod → admin)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.13, CL-8`

**Acceptance criteria**
- [x] The operations admin can leave approval workflow (employee → HOD → admin) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Salary slip generation
> As a **operations admin**, I want **salary slip generation**.

`Partial · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.13, CL-8`

**Acceptance criteria**
- [ ] The operations admin can salary slip generation from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### PF/ESI/TDS calculation and compliance
> As a **operations admin**, I want **pf/esi/tds calculation and compliance**.

`Partial · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.13, CL-8`

**Acceptance criteria**
- [ ] The operations admin can pF/ESI/TDS calculation and compliance from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Arrears and increment management
> As a **operations admin**, I want **arrears and increment management**.

`Partial · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.13, CL-8`

**Acceptance criteria**
- [ ] The operations admin can arrears and increment management from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Physical Access

### Integration with card/biometric/PIN door access system
> As a **operations admin**, I want **integration with card/biometric/pin door access system**.

`Partial · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-20 A`

**Acceptance criteria**
- [ ] The operations admin can integration with card/biometric/PIN door access system from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Zone definitions (Public, Semi-restricted, Restricted, Highly Restricted)
> As a **operations admin**, I want **zone definitions (public, semi-restricted, restricted, highly restricted)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-20 A`

**Acceptance criteria**
- [x] The operations admin can zone definitions (Public, Semi-restricted, Restricted, Highly Restricted) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Access log for each zone entry/exit
> As a **operations admin**, I want **access log for each zone entry/exit**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-20 A`

**Acceptance criteria**
- [x] The operations admin can access log for each zone entry/exit from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Access card provisioning linked to HR module (auto-deactivate on separation)
> As a **operations admin**, I want **access card provisioning linked to hr module (auto-deactivate on separation)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-20 A`

**Acceptance criteria**
- [x] The operations admin can access card provisioning linked to HR module (auto-deactivate on separation) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ After-hours access tracking with alerts
> As a **operations admin**, I want **after-hours access tracking with alerts**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-20 A`

**Acceptance criteria**
- [x] The operations admin can after-hours access tracking with alerts from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Pre-Employment

### ✅ Pre-employment physical examination workflow (medical history, fitness assessment)
> As a **operations admin**, I want **pre-employment physical examination workflow (medical history, fitness assessment)**.

`Done · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The operations admin can pre-employment physical examination workflow (medical history, fitness assessment) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Pre-employment drug screening management (chain-of-custody, MRO review)
> As a **operations admin**, I want **pre-employment drug screening management (chain-of-custody, mro review)**.

`Done · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The operations admin can pre-employment drug screening management (chain-of-custody, MRO review) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Vaccination compliance tracking for healthcare workers (Hep B, flu, COVID)
> As a **operations admin**, I want **vaccination compliance tracking for healthcare workers (hep b, flu, covid)**.

`Done · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The operations admin can vaccination compliance tracking for healthcare workers (Hep B, flu, COVID) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Preventive Maint.

### ✅ PM schedule generation (monthly/quarterly/6-monthly/annual per RFC equipment tables)
> As a **operations admin**, I want **pm schedule generation (monthly/quarterly/6-monthly/annual per rfc equipment tables)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §M24, CL-10`

**Acceptance criteria**
- [x] The operations admin can pM schedule generation (monthly/quarterly/6-monthly/annual per RFC equipment tables) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ PM task checklist per equipment type
> As a **operations admin**, I want **pm task checklist per equipment type**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §M24, CL-10`

**Acceptance criteria**
- [x] The operations admin can pM task checklist per equipment type from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ PM compliance dashboard (done vs overdue vs upcoming)
> As a **operations admin**, I want **pm compliance dashboard (done vs overdue vs upcoming)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §M24, CL-10`

**Acceptance criteria**
- [x] The operations admin can pM compliance dashboard (done vs overdue vs upcoming) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Work order generation and assignment
> As a **operations admin**, I want **work order generation and assignment**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §M24, CL-10`

**Acceptance criteria**
- [x] The operations admin can work order generation and assignment from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ PM completion documentation with technician sign-off
> As a **operations admin**, I want **pm completion documentation with technician sign-off**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §M24, CL-10`

**Acceptance criteria**
- [x] The operations admin can pM completion documentation with technician sign-off from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ PM history per equipment
> As a **operations admin**, I want **pm history per equipment**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §M24, CL-10`

**Acceptance criteria**
- [x] The operations admin can pM history per equipment from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Prior Auth

### ✅ Prior authorization requirement detection at order entry (procedure, imaging, medication)
> As a **operations admin**, I want **prior authorization requirement detection at order entry (procedure, imaging, medication)**.

`Done · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The operations admin can prior authorization requirement detection at order entry (procedure, imaging, medication) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Electronic prior auth submission to payer (FHIR-based or payer portal integration)
> As a **operations admin**, I want **electronic prior auth submission to payer (fhir-based or payer portal integration)**.

`Partial · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The operations admin can electronic prior auth submission to payer (FHIR-based or payer portal integration) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Prior auth status tracking dashboard (pending, approved, denied, appeal)
> As a **operations admin**, I want **prior auth status tracking dashboard (pending, approved, denied, appeal)**.

`Done · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The operations admin can prior auth status tracking dashboard (pending, approved, denied, appeal) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Auto-attach clinical documentation to PA request (diagnosis, notes, labs)
> As a **operations admin**, I want **auto-attach clinical documentation to pa request (diagnosis, notes, labs)**.

`Done · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The operations admin can auto-attach clinical documentation to PA request (diagnosis, notes, labs) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ PA denial appeal workflow with letter generation
> As a **operations admin**, I want **pa denial appeal workflow with letter generation**.

`Done · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The operations admin can pA denial appeal workflow with letter generation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### PA turnaround time tracking with escalation on delays
> As a **operations admin**, I want **pa turnaround time tracking with escalation on delays**.

`Partial · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The operations admin can pA turnaround time tracking with escalation on delays from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Privacy

### ✅ Employer access controls (employer sees fitness status only, not clinical details)
> As a **operations admin**, I want **employer access controls (employer sees fitness status only, not clinical details)**.

`Done · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The operations admin can employer access controls (employer sees fitness status only, not clinical details) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Queue Mgmt

### ✅ Appointment booking (slot-based or token-based, configurable per doctor)
> As a **operations admin**, I want **appointment booking (slot-based or token-based, configurable per doctor)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-13 B`

**Acceptance criteria**
- [x] The operations admin can appointment booking (slot-based or token-based, configurable per doctor) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Real-time doctor availability display
> As a **operations admin**, I want **real-time doctor availability display**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-13 B`

**Acceptance criteria**
- [x] The operations admin can real-time doctor availability display from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Walk-in vs scheduled patient differentiation
> As a **operations admin**, I want **walk-in vs scheduled patient differentiation**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-13 B`

**Acceptance criteria**
- [x] The operations admin can walk-in vs scheduled patient differentiation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Token generation with estimated wait time
> As a **operations admin**, I want **token generation with estimated wait time**.

`Done · Platforms: Web, Mobile, TV · Source: ACMSRC · RFC: CL-13 B`

**Acceptance criteria**
- [x] The operations admin can token generation with estimated wait time from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Queue display on waiting area screens
> As a **operations admin**, I want **queue display on waiting area screens**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-13 B`

**Acceptance criteria**
- [x] The operations admin can queue display on waiting area screens from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### SMS/WhatsApp notification 3 patients before turn
> As a **operations admin**, I want **sms/whatsapp notification 3 patients before turn**.

`Partial · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-13 B`

**Acceptance criteria**
- [ ] The operations admin can sMS/WhatsApp notification 3 patients before turn from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Priority queue for disabled, elderly, pregnant, emergency referral
> As a **operations admin**, I want **priority queue for disabled, elderly, pregnant, emergency referral**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-13 B`

**Acceptance criteria**
- [x] The operations admin can priority queue for disabled, elderly, pregnant, emergency referral from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Lab sample collection queue, radiology queue, pharmacy queue
> As a **operations admin**, I want **lab sample collection queue, radiology queue, pharmacy queue**.

`Partial · Platforms: Web, Mobile, TV · Source: ACMSRC · RFC: CL-13 B`

**Acceptance criteria**
- [ ] The operations admin can lab sample collection queue, radiology queue, pharmacy queue from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Revenue & Accounts

### ✅ Revenue dashboard (daily/weekly/monthly collections)
> As a **operations admin**, I want **revenue dashboard (daily/weekly/monthly collections)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can revenue dashboard (daily/weekly/monthly collections) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Outstanding receivables tracking (patient + TPA)
> As a **operations admin**, I want **outstanding receivables tracking (patient + tpa)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can outstanding receivables tracking (patient + TPA) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Department-wise revenue analysis
> As a **operations admin**, I want **department-wise revenue analysis**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can department-wise revenue analysis from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Doctor-wise revenue attribution
> As a **operations admin**, I want **doctor-wise revenue attribution**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can doctor-wise revenue attribution from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Bad debt identification and write-off workflow
> As a **operations admin**, I want **bad debt identification and write-off workflow**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can bad debt identification and write-off workflow from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Credit patient management
> As a **operations admin**, I want **credit patient management**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can credit patient management from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ GST compliance (invoicing, return filing support)
> As a **operations admin**, I want **gst compliance (invoicing, return filing support)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can gST compliance (invoicing, return filing support) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ TDS management
> As a **operations admin**, I want **tds management**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can tDS management from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Audit trail for all financial transactions (tamper-proof)
> As a **operations admin**, I want **audit trail for all financial transactions (tamper-proof)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can audit trail for all financial transactions (tamper-proof) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Day-end/month-end reconciliation reports
> As a **operations admin**, I want **day-end/month-end reconciliation reports**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can day-end/month-end reconciliation reports from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Financial MIS for management (configurable dashboards)
> As a **operations admin**, I want **financial mis for management (configurable dashboards)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can financial MIS for management (configurable dashboards) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Accounting journal entries
> As a **operations admin**, I want **accounting journal entries**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can accounting journal entries from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ End-of-day cash closing
> As a **operations admin**, I want **end-of-day cash closing**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can end-of-day cash closing from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Bank reconciliation
> As a **operations admin**, I want **bank reconciliation**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can bank reconciliation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ERP integration (Tally, SAP, Odoo, Zoho Books)
> As a **operations admin**, I want **erp integration (tally, sap, odoo, zoho books)**.

`Partial · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [ ] The operations admin can eRP integration (Tally, SAP, Odoo, Zoho Books) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Profit & loss by department
> As a **operations admin**, I want **profit & loss by department**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.12, CL-7`

**Acceptance criteria**
- [x] The operations admin can profit & loss by department from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Review

### ✅ Admission/continued stay review with InterQual/Milliman criteria integration
> As a **operations admin**, I want **admission/continued stay review with interqual/milliman criteria integration**.

`Done · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The operations admin can admission/continued stay review with InterQual/Milliman criteria integration from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ AI-assisted utilization review (auto-extract relevant clinical data for reviewer)
> As a **operations admin**, I want **ai-assisted utilization review (auto-extract relevant clinical data for reviewer)**.

`Done · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The operations admin can aI-assisted utilization review (auto-extract relevant clinical data for reviewer) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Concurrent review tracking — LOS vs expected LOS with outlier alerts
> As a **operations admin**, I want **concurrent review tracking — los vs expected los with outlier alerts**.

`Done · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The operations admin can concurrent review tracking — LOS vs expected LOS with outlier alerts from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Payer communication log (authorization requests, denials, appeals per case)
> As a **operations admin**, I want **payer communication log (authorization requests, denials, appeals per case)**.

`Done · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The operations admin can payer communication log (authorization requests, denials, appeals per case) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Observation vs inpatient status tracking with conversion workflow
> As a **operations admin**, I want **observation vs inpatient status tracking with conversion workflow**.

`Done · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The operations admin can observation vs inpatient status tracking with conversion workflow from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Room & Bed

### ✅ Room cleaning turnaround tracking (discharge → clean → ready)
> As a **operations admin**, I want **room cleaning turnaround tracking (discharge → clean → ready)**.

`Done · Platforms: Web, Mobile, TV · Source: ACMSRC · RFC: CL-17 A`

**Acceptance criteria**
- [x] The operations admin can room cleaning turnaround tracking (discharge → clean → ready) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Bed status dashboard (occupied/vacant/cleaning/blocked/maintenance)
> As a **operations admin**, I want **bed status dashboard (occupied/vacant/cleaning/blocked/maintenance)**.

`Done · Platforms: Web, Mobile, TV · Source: ACMSRC · RFC: CL-17 A`

**Acceptance criteria**
- [x] The operations admin can bed status dashboard (occupied/vacant/cleaning/blocked/maintenance) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Cleaning schedule per area type (ICU: every 4hr, ward: daily, OT: between cases)
> As a **operations admin**, I want **cleaning schedule per area type (icu: every 4hr, ward: daily, ot: between cases)**.

`Done · Platforms: Web, Mobile, TV · Source: ACMSRC · RFC: CL-17 A`

**Acceptance criteria**
- [x] The operations admin can cleaning schedule per area type (ICU: every 4hr, ward: daily, OT: between cases) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Cleaning compliance checklist with supervisor sign-off
> As a **operations admin**, I want **cleaning compliance checklist with supervisor sign-off**.

`Done · Platforms: Web, Mobile, TV · Source: ACMSRC · RFC: CL-17 A`

**Acceptance criteria**
- [x] The operations admin can cleaning compliance checklist with supervisor sign-off from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Pest control schedule tracking
> As a **operations admin**, I want **pest control schedule tracking**.

`Done · Platforms: Web, Mobile, TV · Source: ACMSRC · RFC: CL-17 A`

**Acceptance criteria**
- [x] The operations admin can pest control schedule tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Scheduling

### ✅ Doctor/nurse on-call schedule management
> As a **operations admin**, I want **doctor/nurse on-call schedule management**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.13, CL-8`

**Acceptance criteria**
- [x] The operations admin can doctor/nurse on-call schedule management from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Mandatory training tracking (fire safety, BLS, infection control)
> As a **operations admin**, I want **mandatory training tracking (fire safety, bls, infection control)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.13, CL-8`

**Acceptance criteria**
- [x] The operations admin can mandatory training tracking (fire safety, BLS, infection control) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Annual appraisal documentation
> As a **operations admin**, I want **annual appraisal documentation**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.13, CL-8`

**Acceptance criteria**
- [x] The operations admin can annual appraisal documentation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Statutory compliance (labour law, POSH training records)
> As a **operations admin**, I want **statutory compliance (labour law, posh training records)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.13, CL-8`

**Acceptance criteria**
- [x] The operations admin can statutory compliance (labour law, POSH training records) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Access card provisioning linked to role-based access zones
> As a **operations admin**, I want **access card provisioning linked to role-based access zones**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.13, CL-8`

**Acceptance criteria**
- [x] The operations admin can access card provisioning linked to role-based access zones from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Doctor payout/incentive management
> As a **operations admin**, I want **doctor payout/incentive management**.

`Partial · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.13, CL-8`

**Acceptance criteria**
- [ ] The operations admin can doctor payout/incentive management from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Referral commission management
> As a **operations admin**, I want **referral commission management**.

`Partial · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.13, CL-8`

**Acceptance criteria**
- [ ] The operations admin can referral commission management from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Staff training records
> As a **operations admin**, I want **staff training records**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.13, CL-8`

**Acceptance criteria**
- [x] The operations admin can staff training records from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Surveillance

### ✅ Periodic health surveillance scheduling (hearing tests, lung function, blood lead)
> As a **operations admin**, I want **periodic health surveillance scheduling (hearing tests, lung function, blood lead)**.

`Done · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The operations admin can periodic health surveillance scheduling (hearing tests, lung function, blood lead) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Verification

### Real-time electronic insurance eligibility verification (X12 270/271 transaction)
> As a **operations admin**, I want **real-time electronic insurance eligibility verification (x12 270/271 transaction)**.

`Partial · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The operations admin can real-time electronic insurance eligibility verification (X12 270/271 transaction) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Auto-verify insurance at scheduling, check-in, and admission (3-point verification)
> As a **operations admin**, I want **auto-verify insurance at scheduling, check-in, and admission (3-point verification)**.

`Done · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The operations admin can auto-verify insurance at scheduling, check-in, and admission (3-point verification) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Benefits breakdown display (deductible remaining, co-pay, co-insurance, OOP max)
> As a **operations admin**, I want **benefits breakdown display (deductible remaining, co-pay, co-insurance, oop max)**.

`Done · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The operations admin can benefits breakdown display (deductible remaining, co-pay, co-insurance, OOP max) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Policy active/inactive status with coverage dates and member ID validation
> As a **operations admin**, I want **policy active/inactive status with coverage dates and member id validation**.

`Done · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The operations admin can policy active/inactive status with coverage dates and member ID validation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Visitor Mgmt

### ✅ Visitor registration with photo, ID verification, and contact
> As a **operations admin**, I want **visitor registration with photo, id verification, and contact**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: CL-13 C`

**Acceptance criteria**
- [x] The operations admin can visitor registration with photo, ID verification, and contact from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Visitor pass generation (time-limited, ward-specific, QR code)
> As a **operations admin**, I want **visitor pass generation (time-limited, ward-specific, qr code)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: CL-13 C`

**Acceptance criteria**
- [x] The operations admin can visitor pass generation (time-limited, ward-specific, QR code) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Visiting hours enforcement per ward type (auto-reject outside hours)
> As a **operations admin**, I want **visiting hours enforcement per ward type (auto-reject outside hours)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: CL-13 C`

**Acceptance criteria**
- [x] The operations admin can visiting hours enforcement per ward type (auto-reject outside hours) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Maximum visitor count per patient per slot
> As a **operations admin**, I want **maximum visitor count per patient per slot**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: CL-13 C`

**Acceptance criteria**
- [x] The operations admin can maximum visitor count per patient per slot from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Outbreak mode — complete visitor restriction with override
> As a **operations admin**, I want **outbreak mode — complete visitor restriction with override**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: CL-13 C`

**Acceptance criteria**
- [x] The operations admin can outbreak mode — complete visitor restriction with override from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Special categories (legal counsel, religious visitor, VIP protocol)
> As a **operations admin**, I want **special categories (legal counsel, religious visitor, vip protocol)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: CL-13 C`

**Acceptance criteria**
- [x] The operations admin can special categories (legal counsel, religious visitor, VIP protocol) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Visitor management system
> As a **operations admin**, I want **visitor management system**.

`Partial · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: CL-13 C`

**Acceptance criteria**
- [ ] The operations admin can visitor management system from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Parking management
> As a **operations admin**, I want **parking management**.

`Partial · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: CL-13 C`

**Acceptance criteria**
- [ ] The operations admin can parking management from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Water Quality

### ✅ Water quality testing schedule and result tracking (bacteriological + chemical)
> As a **operations admin**, I want **water quality testing schedule and result tracking (bacteriological + chemical)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-18 C`

**Acceptance criteria**
- [x] The operations admin can water quality testing schedule and result tracking (bacteriological + chemical) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Dialysis RO water monitoring (conductivity, endotoxin, bacteria — IoT sensors)
> As a **operations admin**, I want **dialysis ro water monitoring (conductivity, endotoxin, bacteria — iot sensors)**.

`Partial · Platforms: Web · Source: ACMSRC · RFC: CL-18 C`

**Acceptance criteria**
- [ ] The operations admin can dialysis RO water monitoring (conductivity, endotoxin, bacteria — IoT sensors) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Legionella prevention (hot water temperature monitoring, tank cleaning schedule)
> As a **operations admin**, I want **legionella prevention (hot water temperature monitoring, tank cleaning schedule)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-18 C`

**Acceptance criteria**
- [x] The operations admin can legionella prevention (hot water temperature monitoring, tank cleaning schedule) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Water tank cleaning schedule (6-monthly per NABH)
> As a **operations admin**, I want **water tank cleaning schedule (6-monthly per nabh)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-18 C`

**Acceptance criteria**
- [x] The operations admin can water tank cleaning schedule (6-monthly per NABH) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ STP treated water quality and reuse tracking
> As a **operations admin**, I want **stp treated water quality and reuse tracking**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-18 C`

**Acceptance criteria**
- [x] The operations admin can sTP treated water quality and reuse tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Wellness

### ✅ Employee wellness program tracking (BMI, fitness challenges, health risk assessment)
> As a **operations admin**, I want **employee wellness program tracking (bmi, fitness challenges, health risk assessment)**.

`Done · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The operations admin can employee wellness program tracking (BMI, fitness challenges, health risk assessment) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Work Orders

### ✅ Department maintenance request submission
> As a **operations admin**, I want **department maintenance request submission**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-18 E`

**Acceptance criteria**
- [x] The operations admin can department maintenance request submission from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Work order assignment and tracking
> As a **operations admin**, I want **work order assignment and tracking**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-18 E`

**Acceptance criteria**
- [x] The operations admin can work order assignment and tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Completion documentation with sign-off
> As a **operations admin**, I want **completion documentation with sign-off**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-18 E`

**Acceptance criteria**
- [x] The operations admin can completion documentation with sign-off from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Vendor service report management
> As a **operations admin**, I want **vendor service report management**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-18 E`

**Acceptance criteria**
- [x] The operations admin can vendor service report management from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Preventive maintenance schedule for all infrastructure
> As a **operations admin**, I want **preventive maintenance schedule for all infrastructure**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-18 E`

**Acceptance criteria**
- [x] The operations admin can preventive maintenance schedule for all infrastructure from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Domain norms where relevant (NDPS/Schedule H/INN/AWaRe for pharmacy; GST/CGHS/TPA for billing); DTC/formulary + audit controls.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

