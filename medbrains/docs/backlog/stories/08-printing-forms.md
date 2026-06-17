# Printing & Forms — stories

_Auto-generated from `MedBrains_Features.xlsx` — every feature as a story with module-tailored acceptance criteria. 211 stories (✅ = Done). Source of truth is the xlsx; regenerate via `python3 scripts/generate_stories.py`._

## Admin/BME Forms

### ✅ Employee ID Card (photo, designation, dept, access zone, barcode)
> As a **staff member**, I want **employee id card (photo, designation, dept, access zone, barcode)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 J-L`

**Acceptance criteria**
- [x] The staff member can employee ID Card (photo, designation, dept, access zone, barcode) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Duty Roster / Shift Schedule (dept-wise grid)
> As a **staff member**, I want **duty roster / shift schedule (dept-wise grid)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 J-L`

**Acceptance criteria**
- [x] The staff member can duty Roster / Shift Schedule (dept-wise grid) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Leave Application Form
> As a **staff member**, I want **leave application form**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-28 J-L`

**Acceptance criteria**
- [x] The staff member can leave Application Form from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Staff Attendance Report (monthly)
> As a **staff member**, I want **staff attendance report (monthly)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 J-L`

**Acceptance criteria**
- [x] The staff member can staff Attendance Report (monthly) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Training Attendance / Certificate
> As a **staff member**, I want **training attendance / certificate**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 J-L`

**Acceptance criteria**
- [x] The staff member can training Attendance / Certificate from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Staff Credential Verification Form
> As a **staff member**, I want **staff credential verification form**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 J-L`

**Acceptance criteria**
- [x] The staff member can staff Credential Verification Form from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Visitor Register (daily for security desk)
> As a **staff member**, I want **visitor register (daily for security desk)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 J-L`

**Acceptance criteria**
- [x] The staff member can visitor Register (daily for security desk) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Indent Form (dept → store requisition)
> As a **staff member**, I want **indent form (dept → store requisition)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 J-L`

**Acceptance criteria**
- [x] The staff member can indent Form (dept → store requisition) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Purchase Order (hospital letterhead, authorized signatory)
> As a **staff member**, I want **purchase order (hospital letterhead, authorized signatory)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 J-L`

**Acceptance criteria**
- [x] The staff member can purchase Order (hospital letterhead, authorized signatory) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Goods Receipt Note (GRN)
> As a **staff member**, I want **goods receipt note (grn)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 J-L`

**Acceptance criteria**
- [x] The staff member can goods Receipt Note (GRN) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Material Issue Voucher
> As a **staff member**, I want **material issue voucher**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 J-L`

**Acceptance criteria**
- [x] The staff member can material Issue Voucher from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Stock Transfer Voucher (inter-location)
> As a **staff member**, I want **stock transfer voucher (inter-location)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 J-L`

**Acceptance criteria**
- [x] The staff member can stock Transfer Voucher (inter-location) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Controlled Substance Register (NDPS narcotic drug log)
> As a **staff member**, I want **controlled substance register (ndps narcotic drug log)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 J-L`

**Acceptance criteria**
- [x] The staff member can controlled Substance Register (NDPS narcotic drug log) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Drug Expiry Alert List (monthly for pharmacy)
> As a **staff member**, I want **drug expiry alert list (monthly for pharmacy)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 J-L`

**Acceptance criteria**
- [x] The staff member can drug Expiry Alert List (monthly for pharmacy) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Equipment Condemnation Form (committee approval)
> As a **staff member**, I want **equipment condemnation form (committee approval)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-28 J-L`

**Acceptance criteria**
- [x] The staff member can equipment Condemnation Form (committee approval) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ AMC/CMC Contract Summary Sheet
> As a **staff member**, I want **amc/cmc contract summary sheet**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 J-L`

**Acceptance criteria**
- [x] The staff member can aMC/CMC Contract Summary Sheet from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Equipment Maintenance Work Order
> As a **staff member**, I want **equipment maintenance work order**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 J-L`

**Acceptance criteria**
- [x] The staff member can equipment Maintenance Work Order from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ PM Checklist (per equipment type)
> As a **staff member**, I want **pm checklist (per equipment type)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 J-L`

**Acceptance criteria**
- [x] The staff member can pM Checklist (per equipment type) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Calibration Certificate / Record
> As a **staff member**, I want **calibration certificate / record**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 J-L`

**Acceptance criteria**
- [x] The staff member can calibration Certificate / Record from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Equipment Breakdown Report
> As a **staff member**, I want **equipment breakdown report**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 J-L`

**Acceptance criteria**
- [x] The staff member can equipment Breakdown Report from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Equipment History Card (lifecycle summary)
> As a **staff member**, I want **equipment history card (lifecycle summary)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 J-L`

**Acceptance criteria**
- [x] The staff member can equipment History Card (lifecycle summary) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ MGPS Daily Log (O2 purity, pressure, manifold, consumption)
> As a **staff member**, I want **mgps daily log (o2 purity, pressure, manifold, consumption)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-28 J-L`

**Acceptance criteria**
- [x] The staff member can mGPS Daily Log (O2 purity, pressure, manifold, consumption) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Water Quality Test Record Sheet
> As a **staff member**, I want **water quality test record sheet**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 J-L`

**Acceptance criteria**
- [x] The staff member can water Quality Test Record Sheet from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ DG/UPS Run Log
> As a **staff member**, I want **dg/ups run log**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 J-L`

**Acceptance criteria**
- [x] The staff member can dG/UPS Run Log from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Fire Equipment Inspection Checklist
> As a **staff member**, I want **fire equipment inspection checklist**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 J-L`

**Acceptance criteria**
- [x] The staff member can fire Equipment Inspection Checklist from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Billing Prints

### ✅ OPD Bill / Receipt (charges, GST breakup, payment mode)
> As a **staff member**, I want **opd bill / receipt (charges, gst breakup, payment mode)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 G`

**Acceptance criteria**
- [x] The staff member can oPD Bill / Receipt (charges, GST breakup, payment mode) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ IPD Interim Bill (running bill for long-stay)
> As a **staff member**, I want **ipd interim bill (running bill for long-stay)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 G`

**Acceptance criteria**
- [x] The staff member can iPD Interim Bill (running bill for long-stay) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ IPD Final Bill (itemized: room, investigation, procedure, pharmacy, consumables, fees)
> As a **staff member**, I want **ipd final bill (itemized: room, investigation, procedure, pharmacy, consumables, fees)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 G`

**Acceptance criteria**
- [x] The staff member can iPD Final Bill (itemized: room, investigation, procedure, pharmacy, consumables, fees) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Advance / Deposit Receipt
> As a **staff member**, I want **advance / deposit receipt**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 G`

**Acceptance criteria**
- [x] The staff member can advance / Deposit Receipt from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Refund Receipt
> As a **staff member**, I want **refund receipt**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 G`

**Acceptance criteria**
- [x] The staff member can refund Receipt from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Insurance / TPA Pre-Authorization Form
> As a **staff member**, I want **insurance / tpa pre-authorization form**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 G`

**Acceptance criteria**
- [x] The staff member can insurance / TPA Pre-Authorization Form from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Cashless Claim Form (treatment details auto-filled)
> As a **staff member**, I want **cashless claim form (treatment details auto-filled)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 G`

**Acceptance criteria**
- [x] The staff member can cashless Claim Form (treatment details auto-filled) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Credit Note (returns/adjustments)
> As a **staff member**, I want **credit note (returns/adjustments)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 G`

**Acceptance criteria**
- [x] The staff member can credit Note (returns/adjustments) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Package Bill (surgery/day care with inclusions/exclusions)
> As a **staff member**, I want **package bill (surgery/day care with inclusions/exclusions)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 G`

**Acceptance criteria**
- [x] The staff member can package Bill (surgery/day care with inclusions/exclusions) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Estimate / Proforma Invoice (pre-admission cost estimate)
> As a **staff member**, I want **estimate / proforma invoice (pre-admission cost estimate)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 G`

**Acceptance criteria**
- [x] The staff member can estimate / Proforma Invoice (pre-admission cost estimate) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ CGHS / ECHS / ESI / Ayushman Bharat claim forms
> As a **staff member**, I want **cghs / echs / esi / ayushman bharat claim forms**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 G`

**Acceptance criteria**
- [x] The staff member can cGHS / ECHS / ESI / Ayushman Bharat claim forms from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ TDS Certificate (Form 16A for vendor payments)
> As a **staff member**, I want **tds certificate (form 16a for vendor payments)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 G`

**Acceptance criteria**
- [x] The staff member can tDS Certificate (Form 16A for vendor payments) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ GST Invoice (GSTIN, SAC codes)
> As a **staff member**, I want **gst invoice (gstin, sac codes)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 G`

**Acceptance criteria**
- [x] The staff member can gST Invoice (GSTIN, SAC codes) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Branding & Signage

### ✅ Hospital logo on ALL printed outputs (configurable position)
> As a **staff member**, I want **hospital logo on all printed outputs (configurable position)**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-28 B`

**Acceptance criteria**
- [x] The staff member can hospital logo on ALL printed outputs (configurable position) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Multi-entity branding (Hospital vs Medical College vs Trust)
> As a **staff member**, I want **multi-entity branding (hospital vs medical college vs trust)**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-28 B`

**Acceptance criteria**
- [x] The staff member can multi-entity branding (Hospital vs Medical College vs Trust) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Hospital name, address, phone, email, website, NABH number in header/footer
> As a **staff member**, I want **hospital name, address, phone, email, website, nabh number in header/footer**.

`Done · Platforms: Web, Mobile, TV · Source: ACMSRC · RFC: CL-28 B`

**Acceptance criteria**
- [x] The staff member can hospital name, address, phone, email, website, NABH number in header/footer from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Doctor signature block (Name, Designation, Dept, Reg No, Qualifications)
> As a **staff member**, I want **doctor signature block (name, designation, dept, reg no, qualifications)**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-28 B`

**Acceptance criteria**
- [x] The staff member can doctor signature block (Name, Designation, Dept, Reg No, Qualifications) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Digital signature integration (scanned signature auto-placed on printouts)
> As a **staff member**, I want **digital signature integration (scanned signature auto-placed on printouts)**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-28 B`

**Acceptance criteria**
- [x] The staff member can digital signature integration (scanned signature auto-placed on printouts) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Aadhaar e-Sign on consent forms
> As a **staff member**, I want **aadhaar e-sign on consent forms**.

`Partial · Platforms: Web, TV · Source: ACMSRC · RFC: CL-28 B`

**Acceptance criteria**
- [ ] The staff member can aadhaar e-Sign on consent forms from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Multiple doctor signatures on same form (surgeon + anesthesiologist)
> As a **staff member**, I want **multiple doctor signatures on same form (surgeon + anesthesiologist)**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-28 B`

**Acceptance criteria**
- [x] The staff member can multiple doctor signatures on same form (surgeon + anesthesiologist) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Department-wise header customization (Lab: NABL logo, Pharmacy: Drug License no)
> As a **staff member**, I want **department-wise header customization (lab: nabl logo, pharmacy: drug license no)**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-28 B`

**Acceptance criteria**
- [x] The staff member can department-wise header customization (Lab: NABL logo, Pharmacy: Drug License no) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Footer: auto form ID, print date/time, printed-by user, page X of Y
> As a **staff member**, I want **footer: auto form id, print date/time, printed-by user, page x of y**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-28 B`

**Acceptance criteria**
- [x] The staff member can footer: auto form ID, print date/time, printed-by user, page X of Y from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Watermark support (DRAFT, CONFIDENTIAL, COPY, DUPLICATE, UNCONTROLLED)
> As a **staff member**, I want **watermark support (draft, confidential, copy, duplicate, uncontrolled)**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-28 B`

**Acceptance criteria**
- [x] The staff member can watermark support (DRAFT, CONFIDENTIAL, COPY, DUPLICATE, UNCONTROLLED) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ QR code on printed forms linking to digital record in HMS
> As a **staff member**, I want **qr code on printed forms linking to digital record in hms**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-28 B`

**Acceptance criteria**
- [x] The staff member can qR code on printed forms linking to digital record in HMS from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Clinical Prints

### ✅ OPD Prescription Print (logo, doctor Reg No, drug details, signature, follow-up, pharmacy copy)
> As a **staff member**, I want **opd prescription print (logo, doctor reg no, drug details, signature, follow-up, pharmacy copy)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 D`

**Acceptance criteria**
- [x] The staff member can oPD Prescription Print (logo, doctor Reg No, drug details, signature, follow-up, pharmacy copy) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### OPD Consultation Summary (diagnosis, advice, orders — patient's language)
> As a **staff member**, I want **opd consultation summary (diagnosis, advice, orders — patient's language)**.

`Partial · Platforms: Web · Source: ACMSRC · RFC: CL-28 D`

**Acceptance criteria**
- [ ] The staff member can oPD Consultation Summary (diagnosis, advice, orders — patient's language) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ IPD Treatment Chart (medication schedule, nurse initials grid)
> As a **staff member**, I want **ipd treatment chart (medication schedule, nurse initials grid)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 D`

**Acceptance criteria**
- [x] The staff member can iPD Treatment Chart (medication schedule, nurse initials grid) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Discharge Summary (structured: ICD-10, procedures, medications, follow-up, signatures)
> As a **staff member**, I want **discharge summary (structured: icd-10, procedures, medications, follow-up, signatures)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 D`

**Acceptance criteria**
- [x] The staff member can discharge Summary (structured: ICD-10, procedures, medications, follow-up, signatures) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Death Summary (auto-generated, cause of death, ICD-10)
> As a **staff member**, I want **death summary (auto-generated, cause of death, icd-10)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 D`

**Acceptance criteria**
- [x] The staff member can death Summary (auto-generated, cause of death, ICD-10) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Death Certificate (Form 4/4A per Registration of Births and Deaths Act)
> As a **staff member**, I want **death certificate (form 4/4a per registration of births and deaths act)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 D`

**Acceptance criteria**
- [x] The staff member can death Certificate (Form 4/4A per Registration of Births and Deaths Act) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Transfer Summary (inter-dept/hospital clinical handover)
> As a **staff member**, I want **transfer summary (inter-dept/hospital clinical handover)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 D`

**Acceptance criteria**
- [x] The staff member can transfer Summary (inter-dept/hospital clinical handover) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Referral Letter (history + investigation summary)
> As a **staff member**, I want **referral letter (history + investigation summary)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 D`

**Acceptance criteria**
- [x] The staff member can referral Letter (history + investigation summary) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Follow-up Reminder Card (next visit, doctor, preparation instructions)
> As a **staff member**, I want **follow-up reminder card (next visit, doctor, preparation instructions)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 D`

**Acceptance criteria**
- [x] The staff member can follow-up Reminder Card (next visit, doctor, preparation instructions) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Take-Home Medication List (drug, dose, timing, food instructions, pictograms, patient's language)
> As a **staff member**, I want **take-home medication list (drug, dose, timing, food instructions, pictograms, patient's language)**.

`Partial · Platforms: Web · Source: ACMSRC · RFC: CL-28 D`

**Acceptance criteria**
- [ ] The staff member can take-Home Medication List (drug, dose, timing, food instructions, pictograms, patient's language) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Patient Education Material (disease-specific, post-operative care instructions)
> As a **staff member**, I want **patient education material (disease-specific, post-operative care instructions)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 D`

**Acceptance criteria**
- [x] The staff member can patient Education Material (disease-specific, post-operative care instructions) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Consent Forms

### ✅ General Consent for Admission & Treatment
> As a **staff member**, I want **general consent for admission & treatment**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 E`

**Acceptance criteria**
- [x] The staff member can general Consent for Admission & Treatment from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Surgical / Procedure-Specific Consent (risks, benefits, alternatives)
> As a **staff member**, I want **surgical / procedure-specific consent (risks, benefits, alternatives)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 E`

**Acceptance criteria**
- [x] The staff member can surgical / Procedure-Specific Consent (risks, benefits, alternatives) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Anesthesia Consent
> As a **staff member**, I want **anesthesia consent**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 E`

**Acceptance criteria**
- [x] The staff member can anesthesia Consent from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Blood Transfusion Consent
> As a **staff member**, I want **blood transfusion consent**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 E`

**Acceptance criteria**
- [x] The staff member can blood Transfusion Consent from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ HIV Testing Consent
> As a **staff member**, I want **hiv testing consent**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 E`

**Acceptance criteria**
- [x] The staff member can hIV Testing Consent from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ High-Risk Procedure Consent (with risk percentages)
> As a **staff member**, I want **high-risk procedure consent (with risk percentages)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 E`

**Acceptance criteria**
- [x] The staff member can high-Risk Procedure Consent (with risk percentages) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Informed Refusal / AMA / DAMA / LAMA Form
> As a **staff member**, I want **informed refusal / ama / dama / lama form**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 E`

**Acceptance criteria**
- [x] The staff member can informed Refusal / AMA / DAMA / LAMA Form from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Photography / Video / Telemedicine Consent
> As a **staff member**, I want **photography / video / telemedicine consent**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 E`

**Acceptance criteria**
- [x] The staff member can photography / Video / Telemedicine Consent from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Teaching / Student Observation Consent
> As a **staff member**, I want **teaching / student observation consent**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 E`

**Acceptance criteria**
- [x] The staff member can teaching / Student Observation Consent from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Research Participation Consent (IEC-approved)
> As a **staff member**, I want **research participation consent (iec-approved)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-28 E`

**Acceptance criteria**
- [x] The staff member can research Participation Consent (IEC-approved) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ ABDM/ABHA Health Data Sharing Consent
> As a **staff member**, I want **abdm/abha health data sharing consent**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 E`

**Acceptance criteria**
- [x] The staff member can aBDM/ABHA Health Data Sharing Consent from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ DNR / Advance Directive / End-of-Life Wishes
> As a **staff member**, I want **dnr / advance directive / end-of-life wishes**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 E`

**Acceptance criteria**
- [x] The staff member can dNR / Advance Directive / End-of-Life Wishes from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Organ Donation Consent (THOA compliance)
> As a **staff member**, I want **organ donation consent (thoa compliance)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 E`

**Acceptance criteria**
- [x] The staff member can organ Donation Consent (THOA compliance) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ DPDP Act Data Processing Consent
> As a **staff member**, I want **dpdp act data processing consent**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 E`

**Acceptance criteria**
- [x] The staff member can dPDP Act Data Processing Consent from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Multi-language auto-generation from single template (6 languages)
> As a **staff member**, I want **multi-language auto-generation from single template (6 languages)**.

`Partial · Platforms: Web · Source: ACMSRC · RFC: CL-28 E`

**Acceptance criteria**
- [ ] The staff member can multi-language auto-generation from single template (6 languages) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Read-aloud / Audio consent for illiterate patients (witness signature block)
> As a **staff member**, I want **read-aloud / audio consent for illiterate patients (witness signature block)**.

`Partial · Platforms: Web · Source: ACMSRC · RFC: CL-28 E`

**Acceptance criteria**
- [ ] The staff member can read-aloud / Audio consent for illiterate patients (witness signature block) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Video consent recording attachment (QR to video on printed form)
> As a **staff member**, I want **video consent recording attachment (qr to video on printed form)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 E`

**Acceptance criteria**
- [x] The staff member can video consent recording attachment (QR to video on printed form) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Form Builder

### ✅ Visual form designer — drag-and-drop (text, checkbox, date, dropdown, table, image, signature)
> As a **staff member**, I want **visual form designer — drag-and-drop (text, checkbox, date, dropdown, table, image, signature)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 A`

**Acceptance criteria**
- [x] The staff member can visual form designer — drag-and-drop (text, checkbox, date, dropdown, table, image, signature) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Template library — pre-built for all standard hospital forms
> As a **staff member**, I want **template library — pre-built for all standard hospital forms**.

`Partial · Platforms: Web · Source: ACMSRC · RFC: CL-28 A`

**Acceptance criteria**
- [ ] The staff member can template library — pre-built for all standard hospital forms from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Custom form creation by department HODs without IT intervention
> As a **staff member**, I want **custom form creation by department hods without it intervention**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 A`

**Acceptance criteria**
- [x] The staff member can custom form creation by department HODs without IT intervention from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Form versioning with audit trail (v1.0, v1.1, v2.0 etc.)
> As a **staff member**, I want **form versioning with audit trail (v1.0, v1.1, v2.0 etc.)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 A`

**Acceptance criteria**
- [x] The staff member can form versioning with audit trail (v1.0, v1.1, v2.0 etc.) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Multi-language form rendering (English, Hindi, Tamil, Telugu, Kannada, Malayalam)
> As a **staff member**, I want **multi-language form rendering (english, hindi, tamil, telugu, kannada, malayalam)**.

`Partial · Platforms: Web · Source: ACMSRC · RFC: CL-28 A`

**Acceptance criteria**
- [ ] The staff member can multi-language form rendering (English, Hindi, Tamil, Telugu, Kannada, Malayalam) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Dynamic field population from patient/clinical data (auto-fill name, UHID, age, diagnosis)
> As a **staff member**, I want **dynamic field population from patient/clinical data (auto-fill name, uhid, age, diagnosis)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 A`

**Acceptance criteria**
- [x] The staff member can dynamic field population from patient/clinical data (auto-fill name, UHID, age, diagnosis) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Conditional fields — show/hide sections based on form type (e.g., pediatric vs adult)
> As a **staff member**, I want **conditional fields — show/hide sections based on form type (e.g., pediatric vs adult)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 A`

**Acceptance criteria**
- [x] The staff member can conditional fields — show/hide sections based on form type (e.g., pediatric vs adult) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Configurable paper sizes (A4, A5, prescription pad, label, wristband)
> As a **staff member**, I want **configurable paper sizes (a4, a5, prescription pad, label, wristband)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 A`

**Acceptance criteria**
- [x] The staff member can configurable paper sizes (A4, A5, prescription pad, label, wristband) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Form approval workflow before activation (draft → review → approve → active)
> As a **staff member**, I want **form approval workflow before activation (draft → review → approve → active)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-28 A`

**Acceptance criteria**
- [x] The staff member can form approval workflow before activation (draft → review → approve → active) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Obsolete form retirement with watermark 'OBSOLETE' + auto-redirect to new version
> As a **staff member**, I want **obsolete form retirement with watermark 'obsolete' + auto-redirect to new version**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 A`

**Acceptance criteria**
- [x] The staff member can obsolete form retirement with watermark 'OBSOLETE' + auto-redirect to new version from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Form Compliance

### ✅ Form version control (multiple versions, only latest active)
> As a **staff member**, I want **form version control (multiple versions, only latest active)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 Q`

**Acceptance criteria**
- [x] The staff member can form version control (multiple versions, only latest active) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Form usage audit trail (who printed what, when, for which patient)
> As a **staff member**, I want **form usage audit trail (who printed what, when, for which patient)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 Q`

**Acceptance criteria**
- [x] The staff member can form usage audit trail (who printed what, when, for which patient) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Form archival (old forms retrievable but marked obsolete)
> As a **staff member**, I want **form archival (old forms retrievable but marked obsolete)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 Q`

**Acceptance criteria**
- [x] The staff member can form archival (old forms retrievable but marked obsolete) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Controlled form printing (watermarked CONTROLLED COPY with copy number)
> As a **staff member**, I want **controlled form printing (watermarked controlled copy with copy number)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 Q`

**Acceptance criteria**
- [x] The staff member can controlled form printing (watermarked CONTROLLED COPY with copy number) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Uncontrolled copy printing (watermarked UNCONTROLLED COPY)
> As a **staff member**, I want **uncontrolled copy printing (watermarked uncontrolled copy)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 Q`

**Acceptance criteria**
- [x] The staff member can uncontrolled copy printing (watermarked UNCONTROLLED COPY) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Form compliance dashboard (updated forms vs overdue for review)
> As a **staff member**, I want **form compliance dashboard (updated forms vs overdue for review)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 Q`

**Acceptance criteria**
- [x] The staff member can form compliance dashboard (updated forms vs overdue for review) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Annual form review cycle tracking (per NABH/NABL requirement)
> As a **staff member**, I want **annual form review cycle tracking (per nabh/nabl requirement)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 Q`

**Acceptance criteria**
- [x] The staff member can annual form review cycle tracking (per NABH/NABL requirement) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### External auditor form access (time-limited, read-only for NABH/NMC inspectors)
> As a **staff member**, I want **external auditor form access (time-limited, read-only for nabh/nmc inspectors)**.

`Partial · Platforms: Web · Source: ACMSRC · RFC: CL-28 Q`

**Acceptance criteria**
- [ ] The staff member can external auditor form access (time-limited, read-only for NABH/NMC inspectors) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## IC & Safety Forms

### ✅ Hand Hygiene Audit Form (5 Moments observation)
> As a **staff member**, I want **hand hygiene audit form (5 moments observation)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 I`

**Acceptance criteria**
- [x] The staff member can hand Hygiene Audit Form (5 Moments observation) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ BMW Segregation Log (daily ward-wise weight)
> As a **staff member**, I want **bmw segregation log (daily ward-wise weight)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 I`

**Acceptance criteria**
- [x] The staff member can bMW Segregation Log (daily ward-wise weight) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ BMW Manifest / Challan (for transporter)
> As a **staff member**, I want **bmw manifest / challan (for transporter)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 I`

**Acceptance criteria**
- [x] The staff member can bMW Manifest / Challan (for transporter) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Needle Stick Injury Report Form
> As a **staff member**, I want **needle stick injury report form**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 I`

**Acceptance criteria**
- [x] The staff member can needle Stick Injury Report Form from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ HAI Surveillance Form
> As a **staff member**, I want **hai surveillance form**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 I`

**Acceptance criteria**
- [x] The staff member can hAI Surveillance Form from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Incident Report Form (medication error, fall, near-miss, sentinel)
> As a **staff member**, I want **incident report form (medication error, fall, near-miss, sentinel)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 I`

**Acceptance criteria**
- [x] The staff member can incident Report Form (medication error, fall, near-miss, sentinel) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ RCA Template (NABH format)
> As a **staff member**, I want **rca template (nabh format)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 I`

**Acceptance criteria**
- [x] The staff member can rCA Template (NABH format) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ CAPA Tracking Form
> As a **staff member**, I want **capa tracking form**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 I`

**Acceptance criteria**
- [x] The staff member can cAPA Tracking Form from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ ADR Report Form (PvPI format for CDSCO)
> As a **staff member**, I want **adr report form (pvpi format for cdsco)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 I`

**Acceptance criteria**
- [x] The staff member can aDR Report Form (PvPI format for CDSCO) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Transfusion Reaction Report Form (Hemovigilance NACO)
> As a **staff member**, I want **transfusion reaction report form (hemovigilance naco)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 I`

**Acceptance criteria**
- [x] The staff member can transfusion Reaction Report Form (Hemovigilance NACO) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Equipment Malfunction / Materiovigilance Report Form
> As a **staff member**, I want **equipment malfunction / materiovigilance report form**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 I`

**Acceptance criteria**
- [x] The staff member can equipment Malfunction / Materiovigilance Report Form from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Fire Safety Mock Drill Report Form
> As a **staff member**, I want **fire safety mock drill report form**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 I`

**Acceptance criteria**
- [x] The staff member can fire Safety Mock Drill Report Form from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Restricted Antibiotic Request Form
> As a **staff member**, I want **restricted antibiotic request form**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 I`

**Acceptance criteria**
- [x] The staff member can restricted Antibiotic Request Form from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Identity Prints

### ✅ Patient Registration Card (UHID, Name, Photo, QR, Blood Group)
> As a **staff member**, I want **patient registration card (uhid, name, photo, qr, blood group)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 C`

**Acceptance criteria**
- [x] The staff member can patient Registration Card (UHID, Name, Photo, QR, Blood Group) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Patient Wristband — IPD (Name, UHID, DOB, Blood Group, Allergy, Barcode)
> As a **staff member**, I want **patient wristband — ipd (name, uhid, dob, blood group, allergy, barcode)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 C`

**Acceptance criteria**
- [x] The staff member can patient Wristband — IPD (Name, UHID, DOB, Blood Group, Allergy, Barcode) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Infant Wristband — NICU (Mother name, Baby ID, DOB, Gender, RFID)
> As a **staff member**, I want **infant wristband — nicu (mother name, baby id, dob, gender, rfid)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 C`

**Acceptance criteria**
- [x] The staff member can infant Wristband — NICU (Mother name, Baby ID, DOB, Gender, RFID) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Queue Token Slip (Token no, Doctor, Dept, Wait time)
> As a **staff member**, I want **queue token slip (token no, doctor, dept, wait time)**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-28 C`

**Acceptance criteria**
- [x] The staff member can queue Token Slip (Token no, Doctor, Dept, Wait time) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Appointment Confirmation Slip (Date, Time, Doctor, Dept, Prep instructions)
> As a **staff member**, I want **appointment confirmation slip (date, time, doctor, dept, prep instructions)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-28 C`

**Acceptance criteria**
- [x] The staff member can appointment Confirmation Slip (Date, Time, Doctor, Dept, Prep instructions) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Visitor Pass (Name, Photo, Ward/Bed, Time-limited, QR entry/exit)
> As a **staff member**, I want **visitor pass (name, photo, ward/bed, time-limited, qr entry/exit)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 C`

**Acceptance criteria**
- [x] The staff member can visitor Pass (Name, Photo, Ward/Bed, Time-limited, QR entry/exit) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## MRD Forms

### ✅ Case Sheet Cover Page
> As a **staff member**, I want **case sheet cover page**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 H`

**Acceptance criteria**
- [x] The staff member can case Sheet Cover Page from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ History & Physical Examination Form
> As a **staff member**, I want **history & physical examination form**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 H`

**Acceptance criteria**
- [x] The staff member can history & Physical Examination Form from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Progress Notes Sheet
> As a **staff member**, I want **progress notes sheet**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 H`

**Acceptance criteria**
- [x] The staff member can progress Notes Sheet from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Nursing Assessment Form (initial + ongoing)
> As a **staff member**, I want **nursing assessment form (initial + ongoing)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 H`

**Acceptance criteria**
- [x] The staff member can nursing Assessment Form (initial + ongoing) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ MAR — printable grid (drug/dose/time/nurse columns)
> As a **staff member**, I want **mar — printable grid (drug/dose/time/nurse columns)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 H`

**Acceptance criteria**
- [x] The staff member can mAR — printable grid (drug/dose/time/nurse columns) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Vital Signs Chart (graphical trending for MRD filing)
> As a **staff member**, I want **vital signs chart (graphical trending for mrd filing)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 H`

**Acceptance criteria**
- [x] The staff member can vital Signs Chart (graphical trending for MRD filing) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Intake-Output Chart
> As a **staff member**, I want **intake-output chart**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 H`

**Acceptance criteria**
- [x] The staff member can intake-Output Chart from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Fluid Balance Chart
> As a **staff member**, I want **fluid balance chart**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 H`

**Acceptance criteria**
- [x] The staff member can fluid Balance Chart from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Pain Assessment Chart
> As a **staff member**, I want **pain assessment chart**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 H`

**Acceptance criteria**
- [x] The staff member can pain Assessment Chart from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Fall Risk Assessment Form (Morse Fall Scale)
> As a **staff member**, I want **fall risk assessment form (morse fall scale)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 H`

**Acceptance criteria**
- [x] The staff member can fall Risk Assessment Form (Morse Fall Scale) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Pressure Ulcer Risk Assessment (Braden Scale)
> As a **staff member**, I want **pressure ulcer risk assessment (braden scale)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 H`

**Acceptance criteria**
- [x] The staff member can pressure Ulcer Risk Assessment (Braden Scale) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Glasgow Coma Scale Chart
> As a **staff member**, I want **glasgow coma scale chart**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 H`

**Acceptance criteria**
- [x] The staff member can glasgow Coma Scale Chart from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Restraint Documentation Form (MHCA 2017 for psychiatry)
> As a **staff member**, I want **restraint documentation form (mhca 2017 for psychiatry)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 H`

**Acceptance criteria**
- [x] The staff member can restraint Documentation Form (MHCA 2017 for psychiatry) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Pre-Operative Assessment Checklist
> As a **staff member**, I want **pre-operative assessment checklist**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 H`

**Acceptance criteria**
- [x] The staff member can pre-Operative Assessment Checklist from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ WHO Surgical Safety Checklist (printable for OT)
> As a **staff member**, I want **who surgical safety checklist (printable for ot)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 H`

**Acceptance criteria**
- [x] The staff member can wHO Surgical Safety Checklist (printable for OT) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Anesthesia Record (pre-printed vitals grid, drug log, airway)
> As a **staff member**, I want **anesthesia record (pre-printed vitals grid, drug log, airway)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 H`

**Acceptance criteria**
- [x] The staff member can anesthesia Record (pre-printed vitals grid, drug log, airway) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Operation Notes (template: procedure, findings, complications, specimens)
> As a **staff member**, I want **operation notes (template: procedure, findings, complications, specimens)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 H`

**Acceptance criteria**
- [x] The staff member can operation Notes (template: procedure, findings, complications, specimens) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Post-Operative Orders Sheet
> As a **staff member**, I want **post-operative orders sheet**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 H`

**Acceptance criteria**
- [x] The staff member can post-Operative Orders Sheet from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Blood Transfusion Requisition Form
> As a **staff member**, I want **blood transfusion requisition form**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 H`

**Acceptance criteria**
- [x] The staff member can blood Transfusion Requisition Form from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Blood Transfusion Monitoring Form (bedside checklist)
> As a **staff member**, I want **blood transfusion monitoring form (bedside checklist)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 H`

**Acceptance criteria**
- [x] The staff member can blood Transfusion Monitoring Form (bedside checklist) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ ICU Flowsheet (hourly charting grid)
> As a **staff member**, I want **icu flowsheet (hourly charting grid)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 H`

**Acceptance criteria**
- [x] The staff member can iCU Flowsheet (hourly charting grid) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Discharge Checklist (clearance from all departments)
> As a **staff member**, I want **discharge checklist (clearance from all departments)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 H`

**Acceptance criteria**
- [x] The staff member can discharge Checklist (clearance from all departments) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Against Medical Advice (AMA) Form
> As a **staff member**, I want **against medical advice (ama) form**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 H`

**Acceptance criteria**
- [x] The staff member can against Medical Advice (AMA) Form from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ MLC Register Entry Form
> As a **staff member**, I want **mlc register entry form**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 H`

**Acceptance criteria**
- [x] The staff member can mLC Register Entry Form from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Wound Certificate
> As a **staff member**, I want **wound certificate**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 H`

**Acceptance criteria**
- [x] The staff member can wound Certificate from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Age Estimation Form
> As a **staff member**, I want **age estimation form**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 H`

**Acceptance criteria**
- [x] The staff member can age Estimation Form from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Death Declaration Form
> As a **staff member**, I want **death declaration form**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 H`

**Acceptance criteria**
- [x] The staff member can death Declaration Form from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Medico-Legal Case Documentation Form
> As a **staff member**, I want **medico-legal case documentation form**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 H`

**Acceptance criteria**
- [x] The staff member can medico-Legal Case Documentation Form from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Print Infrastructure

### Thermal printer support for wristbands, labels, tokens
> As a **staff member**, I want **thermal printer support for wristbands, labels, tokens**.

`Partial · Platforms: Web, TV · Source: ACMSRC · RFC: CL-28 P`

**Acceptance criteria**
- [ ] The staff member can thermal printer support for wristbands, labels, tokens from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Barcode / QR code printing on all forms
> As a **staff member**, I want **barcode / qr code printing on all forms**.

`Partial · Platforms: Web · Source: ACMSRC · RFC: CL-28 P`

**Acceptance criteria**
- [ ] The staff member can barcode / QR code printing on all forms from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Laser printer support for A4/A5 forms, reports, prescriptions
> As a **staff member**, I want **laser printer support for a4/a5 forms, reports, prescriptions**.

`Partial · Platforms: Web · Source: ACMSRC · RFC: CL-28 P`

**Acceptance criteria**
- [ ] The staff member can laser printer support for A4/A5 forms, reports, prescriptions from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Dot matrix printer support (multi-copy carbonless forms)
> As a **staff member**, I want **dot matrix printer support (multi-copy carbonless forms)**.

`Partial · Platforms: Web · Source: ACMSRC · RFC: CL-28 P`

**Acceptance criteria**
- [ ] The staff member can dot matrix printer support (multi-copy carbonless forms) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Pre-printed stationery support (variable data on letterheads)
> As a **staff member**, I want **pre-printed stationery support (variable data on letterheads)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 P`

**Acceptance criteria**
- [x] The staff member can pre-printed stationery support (variable data on letterheads) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Blank paper printing (complete form generated by system)
> As a **staff member**, I want **blank paper printing (complete form generated by system)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 P`

**Acceptance criteria**
- [x] The staff member can blank paper printing (complete form generated by system) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### PDF generation for digital distribution (email, WhatsApp, portal)
> As a **staff member**, I want **pdf generation for digital distribution (email, whatsapp, portal)**.

`Partial · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-28 P`

**Acceptance criteria**
- [ ] The staff member can pDF generation for digital distribution (email, WhatsApp, portal) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Bulk print capability (batch printing pending reports, ward-wise)
> As a **staff member**, I want **bulk print capability (batch printing pending reports, ward-wise)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 P`

**Acceptance criteria**
- [x] The staff member can bulk print capability (batch printing pending reports, ward-wise) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Print queue management (per printer, per department)
> As a **staff member**, I want **print queue management (per printer, per department)**.

`Partial · Platforms: Web, TV · Source: ACMSRC · RFC: CL-28 P`

**Acceptance criteria**
- [ ] The staff member can print queue management (per printer, per department) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Reprint with DUPLICATE watermark (audit-logged)
> As a **staff member**, I want **reprint with duplicate watermark (audit-logged)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 P`

**Acceptance criteria**
- [x] The staff member can reprint with DUPLICATE watermark (audit-logged) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Print preview before printing
> As a **staff member**, I want **print preview before printing**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 P`

**Acceptance criteria**
- [x] The staff member can print preview before printing from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Mobile printing (doctor prints from app to nearest printer)
> As a **staff member**, I want **mobile printing (doctor prints from app to nearest printer)**.

`Partial · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-28 P`

**Acceptance criteria**
- [ ] The staff member can mobile printing (doctor prints from app to nearest printer) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Configurable printer mapping (department → default printer)
> As a **staff member**, I want **configurable printer mapping (department → default printer)**.

`Partial · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-28 P`

**Acceptance criteria**
- [ ] The staff member can configurable printer mapping (department → default printer) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Regulatory Prints

### ✅ NABH Quality Indicator Report (monthly/quarterly)
> As a **staff member**, I want **nabh quality indicator report (monthly/quarterly)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 O`

**Acceptance criteria**
- [x] The staff member can nABH Quality Indicator Report (monthly/quarterly) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ NMC Inspection Compliance Report
> As a **staff member**, I want **nmc inspection compliance report**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 O`

**Acceptance criteria**
- [x] The staff member can nMC Inspection Compliance Report from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ NABL Lab Quality Report
> As a **staff member**, I want **nabl lab quality report**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 O`

**Acceptance criteria**
- [x] The staff member can nABL Lab Quality Report from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ SPCB BMW Quarterly Return (Form IV)
> As a **staff member**, I want **spcb bmw quarterly return (form iv)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 O`

**Acceptance criteria**
- [x] The staff member can sPCB BMW Quarterly Return (Form IV) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### AERB Radiation Safety Report (nuclear med / cath lab)
> As a **staff member**, I want **aerb radiation safety report (nuclear med / cath lab)**.

`Partial · Platforms: Web · Source: ACMSRC · RFC: CL-28 O`

**Acceptance criteria**
- [ ] The staff member can aERB Radiation Safety Report (nuclear med / cath lab) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ PESO Compliance Report (LMO storage)
> As a **staff member**, I want **peso compliance report (lmo storage)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 O`

**Acceptance criteria**
- [x] The staff member can pESO Compliance Report (LMO storage) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Drug License Related Reports
> As a **staff member**, I want **drug license related reports**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 O`

**Acceptance criteria**
- [x] The staff member can drug License Related Reports from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ PCPNDT Monthly Report (Form G)
> As a **staff member**, I want **pcpndt monthly report (form g)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 O`

**Acceptance criteria**
- [x] The staff member can pCPNDT Monthly Report (Form G) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Birth Register (municipal authority)
> As a **staff member**, I want **birth register (municipal authority)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 O`

**Acceptance criteria**
- [x] The staff member can birth Register (municipal authority) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Death Register (municipal authority)
> As a **staff member**, I want **death register (municipal authority)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 O`

**Acceptance criteria**
- [x] The staff member can death Register (municipal authority) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ MLC Register (police / court)
> As a **staff member**, I want **mlc register (police / court)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 O`

**Acceptance criteria**
- [x] The staff member can mLC Register (police / court) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ AEBAS Attendance Report (government compliance)
> As a **staff member**, I want **aebas attendance report (government compliance)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 O`

**Acceptance criteria**
- [x] The staff member can aEBAS Attendance Report (government compliance) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ NMC NARF Self-Assessment Data Report
> As a **staff member**, I want **nmc narf self-assessment data report**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 O`

**Acceptance criteria**
- [x] The staff member can nMC NARF Self-Assessment Data Report from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Report Prints

### ✅ Lab Report (hospital+NABL logo, test, result, range, flag, pathologist sig, barcode)
> As a **staff member**, I want **lab report (hospital+nabl logo, test, result, range, flag, pathologist sig, barcode)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 F`

**Acceptance criteria**
- [x] The staff member can lab Report (hospital+NABL logo, test, result, range, flag, pathologist sig, barcode) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Cumulative Lab Report (multiple visits side-by-side trending)
> As a **staff member**, I want **cumulative lab report (multiple visits side-by-side trending)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 F`

**Acceptance criteria**
- [x] The staff member can cumulative Lab Report (multiple visits side-by-side trending) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Microbiology Culture Sensitivity Report (organism, antibiotic, MIC, S/I/R)
> As a **staff member**, I want **microbiology culture sensitivity report (organism, antibiotic, mic, s/i/r)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 F`

**Acceptance criteria**
- [x] The staff member can microbiology Culture Sensitivity Report (organism, antibiotic, MIC, S/I/R) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Histopathology Report (synoptic for cancers)
> As a **staff member**, I want **histopathology report (synoptic for cancers)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 F`

**Acceptance criteria**
- [x] The staff member can histopathology Report (synoptic for cancers) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Radiology Report (logo, key images, radiologist sig + Reg No)
> As a **staff member**, I want **radiology report (logo, key images, radiologist sig + reg no)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 F`

**Acceptance criteria**
- [x] The staff member can radiology Report (logo, key images, radiologist sig + Reg No) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Blood Bank Cross-Match Report (ABO/Rh, bag number, expiry)
> As a **staff member**, I want **blood bank cross-match report (abo/rh, bag number, expiry)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 F`

**Acceptance criteria**
- [x] The staff member can blood Bank Cross-Match Report (ABO/Rh, bag number, expiry) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Blood Component Issue Slip (bag barcode, patient verification)
> As a **staff member**, I want **blood component issue slip (bag barcode, patient verification)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 F`

**Acceptance criteria**
- [x] The staff member can blood Component Issue Slip (bag barcode, patient verification) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Investigation Requisition Form (auto-printed from e-order)
> As a **staff member**, I want **investigation requisition form (auto-printed from e-order)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 F`

**Acceptance criteria**
- [x] The staff member can investigation Requisition Form (auto-printed from e-order) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Specialty/Academic Forms

### ✅ OT Register (daily OT list)
> As a **staff member**, I want **ot register (daily ot list)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 M-N`

**Acceptance criteria**
- [x] The staff member can oT Register (daily OT list) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Blood Bank Donor Registration Form
> As a **staff member**, I want **blood bank donor registration form**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 M-N`

**Acceptance criteria**
- [x] The staff member can blood Bank Donor Registration Form from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Blood Bank Cross-Match Requisition
> As a **staff member**, I want **blood bank cross-match requisition**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 M-N`

**Acceptance criteria**
- [x] The staff member can blood Bank Cross-Match Requisition from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Dialysis Run Sheet
> As a **staff member**, I want **dialysis run sheet**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 M-N`

**Acceptance criteria**
- [x] The staff member can dialysis Run Sheet from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Endoscopy Procedure Report (with images)
> As a **staff member**, I want **endoscopy procedure report (with images)**.

`Partial · Platforms: Web · Source: ACMSRC · RFC: CL-28 M-N`

**Acceptance criteria**
- [ ] The staff member can endoscopy Procedure Report (with images) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Endoscope Reprocessing (HLD) Log
> As a **staff member**, I want **endoscope reprocessing (hld) log**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 M-N`

**Acceptance criteria**
- [x] The staff member can endoscope Reprocessing (HLD) Log from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Cath Lab Procedure Report (hemodynamics, devices, radiation dose)
> As a **staff member**, I want **cath lab procedure report (hemodynamics, devices, radiation dose)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 M-N`

**Acceptance criteria**
- [x] The staff member can cath Lab Procedure Report (hemodynamics, devices, radiation dose) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Cath Lab Device Usage Log (stent/pacemaker barcode)
> As a **staff member**, I want **cath lab device usage log (stent/pacemaker barcode)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 M-N`

**Acceptance criteria**
- [x] The staff member can cath Lab Device Usage Log (stent/pacemaker barcode) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ ECT Register Form (psychiatry — MHCA 2017)
> As a **staff member**, I want **ect register form (psychiatry — mhca 2017)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 M-N`

**Acceptance criteria**
- [x] The staff member can eCT Register Form (psychiatry — MHCA 2017) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Seclusion & Restraint Documentation Form (psychiatry)
> As a **staff member**, I want **seclusion & restraint documentation form (psychiatry)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 M-N`

**Acceptance criteria**
- [x] The staff member can seclusion & Restraint Documentation Form (psychiatry) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Palliative Care Plan & DNR Order Form
> As a **staff member**, I want **palliative care plan & dnr order form**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 M-N`

**Acceptance criteria**
- [x] The staff member can palliative Care Plan & DNR Order Form from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Disability Certificate (RPWD Act 2016)
> As a **staff member**, I want **disability certificate (rpwd act 2016)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 M-N`

**Acceptance criteria**
- [x] The staff member can disability Certificate (RPWD Act 2016) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ PCPNDT Form F (USG on pregnant women — mandatory)
> As a **staff member**, I want **pcpndt form f (usg on pregnant women — mandatory)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 M-N`

**Acceptance criteria**
- [x] The staff member can pCPNDT Form F (USG on pregnant women — mandatory) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Mortuary Body Receipt Register
> As a **staff member**, I want **mortuary body receipt register**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 M-N`

**Acceptance criteria**
- [x] The staff member can mortuary Body Receipt Register from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Body Release Form (identity verification, photo documentation)
> As a **staff member**, I want **body release form (identity verification, photo documentation)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 M-N`

**Acceptance criteria**
- [x] The staff member can body Release Form (identity verification, photo documentation) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Post-Mortem Requisition Form
> As a **staff member**, I want **post-mortem requisition form**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 M-N`

**Acceptance criteria**
- [x] The staff member can post-Mortem Requisition Form from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Viscera Chain-of-Custody Form
> As a **staff member**, I want **viscera chain-of-custody form**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 M-N`

**Acceptance criteria**
- [x] The staff member can viscera Chain-of-Custody Form from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Unclaimed Body Protocol Documentation
> As a **staff member**, I want **unclaimed body protocol documentation**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 M-N`

**Acceptance criteria**
- [x] The staff member can unclaimed Body Protocol Documentation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Student Admission Form
> As a **staff member**, I want **student admission form**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 M-N`

**Acceptance criteria**
- [x] The staff member can student Admission Form from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Intern Rotation Schedule / Posting Order
> As a **staff member**, I want **intern rotation schedule / posting order**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 M-N`

**Acceptance criteria**
- [x] The staff member can intern Rotation Schedule / Posting Order from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ PG Logbook Case Entry (HMS auto-populated)
> As a **staff member**, I want **pg logbook case entry (hms auto-populated)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 M-N`

**Acceptance criteria**
- [x] The staff member can pG Logbook Case Entry (HMS auto-populated) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Intern Logbook Entry Form
> As a **staff member**, I want **intern logbook entry form**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 M-N`

**Acceptance criteria**
- [x] The staff member can intern Logbook Entry Form from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Internal Assessment Mark Sheet
> As a **staff member**, I want **internal assessment mark sheet**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 M-N`

**Acceptance criteria**
- [x] The staff member can internal Assessment Mark Sheet from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Exam Hall Ticket
> As a **staff member**, I want **exam hall ticket**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 M-N`

**Acceptance criteria**
- [x] The staff member can exam Hall Ticket from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ OSCE Station Scoring Sheet
> As a **staff member**, I want **osce station scoring sheet**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 M-N`

**Acceptance criteria**
- [x] The staff member can oSCE Station Scoring Sheet from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Simulation Session Debriefing Form
> As a **staff member**, I want **simulation session debriefing form**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 M-N`

**Acceptance criteria**
- [x] The staff member can simulation Session Debriefing Form from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ CME / FDP Certificate (QR verified)
> As a **staff member**, I want **cme / fdp certificate (qr verified)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 M-N`

**Acceptance criteria**
- [x] The staff member can cME / FDP Certificate (QR verified) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ IEC Ethics Approval Certificate
> As a **staff member**, I want **iec ethics approval certificate**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-28 M-N`

**Acceptance criteria**
- [x] The staff member can iEC Ethics Approval Certificate from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Research Proposal Submission Form
> As a **staff member**, I want **research proposal submission form**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 M-N`

**Acceptance criteria**
- [x] The staff member can research Proposal Submission Form from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Hostel Room Allotment Order
> As a **staff member**, I want **hostel room allotment order**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 M-N`

**Acceptance criteria**
- [x] The staff member can hostel Room Allotment Order from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Anti-Ragging Undertaking (student + parent)
> As a **staff member**, I want **anti-ragging undertaking (student + parent)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 M-N`

**Acceptance criteria**
- [x] The staff member can anti-Ragging Undertaking (student + parent) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Disability Accommodation Plan Form
> As a **staff member**, I want **disability accommodation plan form**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 M-N`

**Acceptance criteria**
- [x] The staff member can disability Accommodation Plan Form from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Internship Completion Certificate (NMC format)
> As a **staff member**, I want **internship completion certificate (nmc format)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 M-N`

**Acceptance criteria**
- [x] The staff member can internship Completion Certificate (NMC format) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Service Bond Agreement
> As a **staff member**, I want **service bond agreement**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 M-N`

**Acceptance criteria**
- [x] The staff member can service Bond Agreement from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Stipend Payment Advice
> As a **staff member**, I want **stipend payment advice**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-28 M-N`

**Acceptance criteria**
- [x] The staff member can stipend Payment Advice from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Regulatory fields on output (UHID/MLC/Schedule badges); document audit (who printed, reprint count).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

