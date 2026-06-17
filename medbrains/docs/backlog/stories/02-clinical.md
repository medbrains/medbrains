# Clinical — stories

_Auto-generated from `MedBrains_Features.xlsx` — every feature as a story with module-tailored acceptance criteria. 324 stories (✅ = Done). Source of truth is the xlsx; regenerate via `python3 scripts/generate_stories.py`._

## Admission

### ✅ IP admission form
> As a **clinician**, I want **ip admission form**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.3, WF-IPD-001`

**Acceptance criteria**
- [x] The clinician can iP admission form from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Emergency admission (fast-track)
> As a **clinician**, I want **emergency admission (fast-track)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.3, WF-IPD-001`

**Acceptance criteria**
- [x] The clinician can emergency admission (fast-track) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Planned admission from OPD
> As a **clinician**, I want **planned admission from opd**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.3, WF-IPD-001`

**Acceptance criteria**
- [x] The clinician can planned admission from OPD from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Admission from OPD/ER with bed selection (ward/room/bed picker with real-time availability)
> As a **clinician**, I want **admission from opd/er with bed selection (ward/room/bed picker with real-time availability)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.3, WF-IPD-001`

**Acceptance criteria**
- [x] The clinician can admission from OPD/ER with bed selection (ward/room/bed picker with real-time availability) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Auto-transfer of OPD history and demographics to IPD casesheet
> As a **clinician**, I want **auto-transfer of opd history and demographics to ipd casesheet**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.3, WF-IPD-001`

**Acceptance criteria**
- [x] The clinician can auto-transfer of OPD history and demographics to IPD casesheet from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Admission checklist validation
> As a **clinician**, I want **admission checklist validation**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.3, WF-IPD-001`

**Acceptance criteria**
- [x] The clinician can admission checklist validation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Attender/next-of-kin capture
> As a **clinician**, I want **attender/next-of-kin capture**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.3, WF-IPD-001`

**Acceptance criteria**
- [x] The clinician can attender/next-of-kin capture from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Admission slip/form print
> As a **clinician**, I want **admission slip/form print**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.3, WF-IPD-001`

**Acceptance criteria**
- [x] The clinician can admission slip/form print from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ IP type configuration (general, semi-private, private, ICU, NICU, etc.)
> As a **clinician**, I want **ip type configuration (general, semi-private, private, icu, nicu, etc.)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.3, WF-IPD-001`

**Acceptance criteria**
- [x] The clinician can iP type configuration (general, semi-private, private, ICU, NICU, etc.) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Estimated cost for admission
> As a **clinician**, I want **estimated cost for admission**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.3, WF-IPD-001`

**Acceptance criteria**
- [x] The clinician can estimated cost for admission from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Advance payment collection
> As a **clinician**, I want **advance payment collection**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.3, WF-IPD-001`

**Acceptance criteria**
- [x] The clinician can advance payment collection from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Pre-authorization for insurance
> As a **clinician**, I want **pre-authorization for insurance**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.3, WF-IPD-001`

**Acceptance criteria**
- [x] The clinician can pre-authorization for insurance from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ MLC registration at admission
> As a **clinician**, I want **mlc registration at admission**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.3, WF-IPD-001`

**Acceptance criteria**
- [x] The clinician can mLC registration at admission from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Ambient

### Ambient AI listening — auto-generates clinical notes from doctor-patient conversation
> As a **clinician**, I want **ambient ai listening — auto-generates clinical notes from doctor-patient conversation**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The clinician can ambient AI listening — auto-generates clinical notes from doctor-patient conversation from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### AI-drafted SOAP notes with physician review and edit workflow
> As a **clinician**, I want **ai-drafted soap notes with physician review and edit workflow**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The clinician can aI-drafted SOAP notes with physician review and edit workflow from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Auto-extraction of diagnoses, medications, allergies from conversation
> As a **clinician**, I want **auto-extraction of diagnoses, medications, allergies from conversation**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The clinician can auto-extraction of diagnoses, medications, allergies from conversation from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### AI-drafted shift conclusion/handover notes for nursing
> As a **clinician**, I want **ai-drafted shift conclusion/handover notes for nursing**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The clinician can aI-drafted shift conclusion/handover notes for nursing from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Smart charting — pre-fill fields based on context (returning patient, chronic condition)
> As a **clinician**, I want **smart charting — pre-fill fields based on context (returning patient, chronic condition)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The clinician can smart charting — pre-fill fields based on context (returning patient, chronic condition) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### AI summarization of patient history for quick review (visit summary generator)
> As a **clinician**, I want **ai summarization of patient history for quick review (visit summary generator)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The clinician can aI summarization of patient history for quick review (visit summary generator) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Multi-language ambient capture (Hindi, Tamil, Telugu → English clinical note)
> As a **clinician**, I want **multi-language ambient capture (hindi, tamil, telugu → english clinical note)**.

`Pending · Platforms: Web, Mobile · Source: Epic+iElixir · RFC: §Ext`

**Acceptance criteria**
- [ ] The clinician can multi-language ambient capture (Hindi, Tamil, Telugu → English clinical note) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Analytics

### Order set utilization analytics (which sets used, by whom, compliance)
> As a **clinician**, I want **order set utilization analytics (which sets used, by whom, compliance)**.

`Partial · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The clinician can order set utilization analytics (which sets used, by whom, compliance) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Appointments

### ✅ Appointment booking (date, time, doctor, department)
> As a **clinician**, I want **appointment booking (date, time, doctor, department)**.

`Done · Platforms: Web, Mobile · Source: RFC · RFC: §3.2`

**Acceptance criteria**
- [x] The clinician can appointment booking (date, time, doctor, department) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Doctor availability calendar (slot-based)
> As a **clinician**, I want **doctor availability calendar (slot-based)**.

`Done · Platforms: Web, Mobile · Source: RFC · RFC: §3.2`

**Acceptance criteria**
- [x] The clinician can doctor availability calendar (slot-based) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Recurring appointment scheduling
> As a **clinician**, I want **recurring appointment scheduling**.

`Done · Platforms: Web, Mobile · Source: RFC · RFC: §3.2`

**Acceptance criteria**
- [x] The clinician can recurring appointment scheduling from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Online appointment booking (patient portal/app)
> As a **clinician**, I want **online appointment booking (patient portal/app)**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §3.2`

**Acceptance criteria**
- [ ] The clinician can online appointment booking (patient portal/app) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Walk-in token generation
> As a **clinician**, I want **walk-in token generation**.

`Done · Platforms: Web, TV · Source: RFC · RFC: §3.2`

**Acceptance criteria**
- [x] The clinician can walk-in token generation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### QR code check-in at kiosk
> As a **clinician**, I want **qr code check-in at kiosk**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.2`

**Acceptance criteria**
- [ ] The clinician can qR code check-in at kiosk from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Token display system (TV/monitor)
> As a **clinician**, I want **token display system (tv/monitor)**.

`Pending · Platforms: Web, TV · Source: RFC · RFC: §3.2`

**Acceptance criteria**
- [ ] The clinician can token display system (TV/monitor) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Appointment rescheduling
> As a **clinician**, I want **appointment rescheduling**.

`Done · Platforms: Web, Mobile · Source: RFC · RFC: §3.2`

**Acceptance criteria**
- [x] The clinician can appointment rescheduling from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Appointment cancellation with reason
> As a **clinician**, I want **appointment cancellation with reason**.

`Done · Platforms: Web · Source: RFC · RFC: §3.2`

**Acceptance criteria**
- [x] The clinician can appointment cancellation with reason from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ No-show tracking
> As a **clinician**, I want **no-show tracking**.

`Done · Platforms: Web · Source: RFC · RFC: §3.2`

**Acceptance criteria**
- [x] The clinician can no-show tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### SMS/WhatsApp appointment reminders
> As a **clinician**, I want **sms/whatsapp appointment reminders**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §3.2`

**Acceptance criteria**
- [ ] The clinician can sMS/WhatsApp appointment reminders from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Waiting time estimation
> As a **clinician**, I want **waiting time estimation**.

`Done · Platforms: Web · Source: RFC · RFC: §3.2`

**Acceptance criteria**
- [x] The clinician can waiting time estimation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Multi-doctor appointment (e.g., health checkup)
> As a **clinician**, I want **multi-doctor appointment (e.g., health checkup)**.

`Done · Platforms: Web, Mobile · Source: RFC · RFC: §3.2`

**Acceptance criteria**
- [x] The clinician can multi-doctor appointment (e.g., health checkup) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Bundle Compliance

### ✅ Central line bundle compliance (insertion checklist, daily necessity review)
> As a **clinician**, I want **central line bundle compliance (insertion checklist, daily necessity review)**.

`P2 · Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-14`

**Acceptance criteria**
- [x] The clinician can central line bundle compliance (insertion checklist, daily necessity review) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Central line days tracking (auto-calculated from insertion date)
> As a **clinician**, I want **central line days tracking (auto-calculated from insertion date)**.

`P2 · Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-14`

**Acceptance criteria**
- [x] The clinician can central line days tracking (auto-calculated from insertion date) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Urinary catheter days tracking with daily necessity review
> As a **clinician**, I want **urinary catheter days tracking with daily necessity review**.

`P2 · Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-14`

**Acceptance criteria**
- [x] The clinician can urinary catheter days tracking with daily necessity review from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Ventilator days tracking with VAP bundle compliance
> As a **clinician**, I want **ventilator days tracking with vap bundle compliance**.

`P2 · Done · Platforms: Web · Source: ACMSRC · RFC: CL-14`

**Acceptance criteria**
- [x] The clinician can ventilator days tracking with VAP bundle compliance from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Restraint documentation with 4-hour review cycle
> As a **clinician**, I want **restraint documentation with 4-hour review cycle**.

`P2 · Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-14`

**Acceptance criteria**
- [x] The clinician can restraint documentation with 4-hour review cycle from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Device-related infection rate auto-calculation
> As a **clinician**, I want **device-related infection rate auto-calculation**.

`P2 · Done · Platforms: Web · Source: ACMSRC · RFC: CL-14`

**Acceptance criteria**
- [x] The clinician can device-related infection rate auto-calculation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Categories

### ✅ Walk-in patient
> As a **clinician**, I want **walk-in patient**.

`Done · Platforms: Web · Source: RFC · RFC: §3.1`

**Acceptance criteria**
- [x] The clinician can walk-in patient from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Referred patient (with referring doctor capture)
> As a **clinician**, I want **referred patient (with referring doctor capture)**.

`Done · Platforms: Web, Mobile · Source: RFC · RFC: §3.1`

**Acceptance criteria**
- [x] The clinician can referred patient (with referring doctor capture) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Corporate patient (company linked)
> As a **clinician**, I want **corporate patient (company linked)**.

`Done · Platforms: Web · Source: RFC · RFC: §3.1`

**Acceptance criteria**
- [x] The clinician can corporate patient (company linked) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Insurance patient (TPA linked)
> As a **clinician**, I want **insurance patient (tpa linked)**.

`Done · Platforms: Web · Source: RFC · RFC: §3.1`

**Acceptance criteria**
- [x] The clinician can insurance patient (TPA linked) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Emergency patient
> As a **clinician**, I want **emergency patient**.

`Done · Platforms: Web · Source: RFC · RFC: §3.1`

**Acceptance criteria**
- [x] The clinician can emergency patient from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Medico-legal case (MLC) patient
> As a **clinician**, I want **medico-legal case (mlc) patient**.

`Done · Platforms: Web · Source: RFC · RFC: §3.1`

**Acceptance criteria**
- [x] The clinician can medico-legal case (MLC) patient from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ VIP/VVIP flagging (restricted access)
> As a **clinician**, I want **vip/vvip flagging (restricted access)**.

`Done · Platforms: Web · Source: RFC · RFC: §3.1`

**Acceptance criteria**
- [x] The clinician can vIP/VVIP flagging (restricted access) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Staff/employee patient
> As a **clinician**, I want **staff/employee patient**.

`Done · Platforms: Web · Source: RFC · RFC: §3.1`

**Acceptance criteria**
- [x] The clinician can staff/employee patient from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Camp patient
> As a **clinician**, I want **camp patient**.

`Done · Platforms: Web · Source: RFC · RFC: §3.1`

**Acceptance criteria**
- [x] The clinician can camp patient from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Clinical Decision Support

### ✅ Drug-drug interaction alerts at prescription time
> As a **clinician**, I want **drug-drug interaction alerts at prescription time**.

`P1 · Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-1`

**Acceptance criteria**
- [x] The clinician can drug-drug interaction alerts at prescription time from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Allergy alerts (drug, food, latex) prominently displayed
> As a **clinician**, I want **allergy alerts (drug, food, latex) prominently displayed**.

`P1 · Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-1`

**Acceptance criteria**
- [x] The clinician can allergy alerts (drug, food, latex) prominently displayed from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Duplicate order detection (same investigation within configurable period)
> As a **clinician**, I want **duplicate order detection (same investigation within configurable period)**.

`P1 · Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-1`

**Acceptance criteria**
- [x] The clinician can duplicate order detection (same investigation within configurable period) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Renal dose adjustment alerts based on creatinine/GFR
> As a **clinician**, I want **renal dose adjustment alerts based on creatinine/gfr**.

`P1 · Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-1`

**Acceptance criteria**
- [x] The clinician can renal dose adjustment alerts based on creatinine/GFR from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Critical value alerts from lab directly on doctor's dashboard
> As a **clinician**, I want **critical value alerts from lab directly on doctor's dashboard**.

`P1 · Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-1`

**Acceptance criteria**
- [x] The clinician can critical value alerts from lab directly on doctor's dashboard from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Clinical protocol/guideline integration (e.g., sepsis bundle, DVT prophylaxis)
> As a **clinician**, I want **clinical protocol/guideline integration (e.g., sepsis bundle, dvt prophylaxis)**.

`P1 · Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-1`

**Acceptance criteria**
- [x] The clinician can clinical protocol/guideline integration (e.g., sepsis bundle, DVT prophylaxis) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Antibiotic stewardship — restricted antibiotic approval workflow
> As a **clinician**, I want **antibiotic stewardship — restricted antibiotic approval workflow**.

`P1 · Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-1`

**Acceptance criteria**
- [x] The clinician can antibiotic stewardship — restricted antibiotic approval workflow from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Clinical Inpatient

### ✅ Digital case sheet entry
> As a **clinician**, I want **digital case sheet entry**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.3`

**Acceptance criteria**
- [x] The clinician can digital case sheet entry from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Doctor rounds notes (daily progress notes) with timestamped entries
> As a **clinician**, I want **doctor rounds notes (daily progress notes) with timestamped entries**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.3`

**Acceptance criteria**
- [x] The clinician can doctor rounds notes (daily progress notes) with timestamped entries from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Nursing notes
> As a **clinician**, I want **nursing notes**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.3`

**Acceptance criteria**
- [x] The clinician can nursing notes from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Vitals monitoring (periodic charting) with graphical trending
> As a **clinician**, I want **vitals monitoring (periodic charting) with graphical trending**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.3`

**Acceptance criteria**
- [x] The clinician can vitals monitoring (periodic charting) with graphical trending from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ I/O (Intake/Output) charting with auto-calculation of balance
> As a **clinician**, I want **i/o (intake/output) charting with auto-calculation of balance**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.3`

**Acceptance criteria**
- [x] The clinician can i/O (Intake/Output) charting with auto-calculation of balance from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Medication administration record (MAR)
> As a **clinician**, I want **medication administration record (mar)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.3`

**Acceptance criteria**
- [x] The clinician can medication administration record (MAR) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Diet chart management
> As a **clinician**, I want **diet chart management**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.3`

**Acceptance criteria**
- [x] The clinician can diet chart management from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Wound care documentation with photo upload
> As a **clinician**, I want **wound care documentation with photo upload**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.3`

**Acceptance criteria**
- [x] The clinician can wound care documentation with photo upload from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Fall risk assessment (Morse Fall Scale) with auto-alert for high-risk
> As a **clinician**, I want **fall risk assessment (morse fall scale) with auto-alert for high-risk**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.3`

**Acceptance criteria**
- [x] The clinician can fall risk assessment (Morse Fall Scale) with auto-alert for high-risk from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Pain assessment scoring (NRS/VAS) with trending
> As a **clinician**, I want **pain assessment scoring (nrs/vas) with trending**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.3`

**Acceptance criteria**
- [x] The clinician can pain assessment scoring (NRS/VAS) with trending from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Pressure ulcer risk (Braden Scale) with prevention protocol trigger
> As a **clinician**, I want **pressure ulcer risk (braden scale) with prevention protocol trigger**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.3`

**Acceptance criteria**
- [x] The clinician can pressure ulcer risk (Braden Scale) with prevention protocol trigger from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Glasgow Coma Scale tracking
> As a **clinician**, I want **glasgow coma scale tracking**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.3`

**Acceptance criteria**
- [x] The clinician can glasgow Coma Scale tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ ICU care bundle compliance
> As a **clinician**, I want **icu care bundle compliance**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.3`

**Acceptance criteria**
- [x] The clinician can iCU care bundle compliance from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Ventilator settings & monitoring
> As a **clinician**, I want **ventilator settings & monitoring**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.3`

**Acceptance criteria**
- [x] The clinician can ventilator settings & monitoring from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Central line care checklist
> As a **clinician**, I want **central line care checklist**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.3`

**Acceptance criteria**
- [x] The clinician can central line care checklist from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Catheter care checklist
> As a **clinician**, I want **catheter care checklist**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.3`

**Acceptance criteria**
- [x] The clinician can catheter care checklist from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Restraint documentation
> As a **clinician**, I want **restraint documentation**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.3`

**Acceptance criteria**
- [x] The clinician can restraint documentation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Transfusion documentation
> As a **clinician**, I want **transfusion documentation**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.3`

**Acceptance criteria**
- [x] The clinician can transfusion documentation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Consent forms (procedure-specific)
> As a **clinician**, I want **consent forms (procedure-specific)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.3`

**Acceptance criteria**
- [x] The clinician can consent forms (procedure-specific) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Investigation result inline display (lab/radiology) within casesheet
> As a **clinician**, I want **investigation result inline display (lab/radiology) within casesheet**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.3`

**Acceptance criteria**
- [x] The clinician can investigation result inline display (lab/radiology) within casesheet from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Inter-department transfer with clinical summary carryover
> As a **clinician**, I want **inter-department transfer with clinical summary carryover**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.3`

**Acceptance criteria**
- [x] The clinician can inter-department transfer with clinical summary carryover from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Communication

### ✅ Message nurse / request assistance from bedside
> As a **clinician**, I want **message nurse / request assistance from bedside**.

`Done · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The clinician can message nurse / request assistance from bedside from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Video call with family members from bedside terminal
> As a **clinician**, I want **video call with family members from bedside terminal**.

`Partial · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The clinician can video call with family members from bedside terminal from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Configuration

### ✅ Order set builder — group labs, meds, nursing orders, diets into named bundles
> As a **clinician**, I want **order set builder — group labs, meds, nursing orders, diets into named bundles**.

`Done · Platforms: Web, Mobile · Source: iElixir+Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The clinician can order set builder — group labs, meds, nursing orders, diets into named bundles from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Diagnosis-driven order sets (Pneumonia workup, DKA protocol, Chest Pain panel)
> As a **clinician**, I want **diagnosis-driven order sets (pneumonia workup, dka protocol, chest pain panel)**.

`Done · Platforms: Web, Mobile · Source: iElixir+Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The clinician can diagnosis-driven order sets (Pneumonia workup, DKA protocol, Chest Pain panel) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Admission order sets (general admission, ICU admission, pediatric admission)
> As a **clinician**, I want **admission order sets (general admission, icu admission, pediatric admission)**.

`Done · Platforms: Web, Mobile · Source: iElixir+Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The clinician can admission order sets (general admission, ICU admission, pediatric admission) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Pre-operative order sets (by surgery type — cardiac, ortho, neuro)
> As a **clinician**, I want **pre-operative order sets (by surgery type — cardiac, ortho, neuro)**.

`Partial · Platforms: Web, Mobile · Source: iElixir+Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The clinician can pre-operative order sets (by surgery type — cardiac, ortho, neuro) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Consultation

### ✅ Doctor queue/worklist
> As a **clinician**, I want **doctor queue/worklist**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.2, WF-OPD-001`

**Acceptance criteria**
- [x] The clinician can doctor queue/worklist from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Queue/token integration — doctor can call next patient from screen
> As a **clinician**, I want **queue/token integration — doctor can call next patient from screen**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.2, WF-OPD-001`

**Acceptance criteria**
- [x] The clinician can queue/token integration — doctor can call next patient from screen from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Patient history view (previous visits, labs, prescriptions)
> As a **clinician**, I want **patient history view (previous visits, labs, prescriptions)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.2, WF-OPD-001`

**Acceptance criteria**
- [x] The clinician can patient history view (previous visits, labs, prescriptions) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Auto-load previous history, allergies, current medications on casesheet open
> As a **clinician**, I want **auto-load previous history, allergies, current medications on casesheet open**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.2, WF-OPD-001`

**Acceptance criteria**
- [x] The clinician can auto-load previous history, allergies, current medications on casesheet open from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Chief complaints entry
> As a **clinician**, I want **chief complaints entry**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.2, WF-OPD-001`

**Acceptance criteria**
- [x] The clinician can chief complaints entry from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ History of present illness (HPI)
> As a **clinician**, I want **history of present illness (hpi)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.2, WF-OPD-001`

**Acceptance criteria**
- [x] The clinician can history of present illness (HPI) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Past medical history
> As a **clinician**, I want **past medical history**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.2, WF-OPD-001`

**Acceptance criteria**
- [x] The clinician can past medical history from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Family history
> As a **clinician**, I want **family history**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.2, WF-OPD-001`

**Acceptance criteria**
- [x] The clinician can family history from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Pre-consultation nursing vitals (BP, pulse, temp, SpO2, weight, height) visible to doctor
> As a **clinician**, I want **pre-consultation nursing vitals (bp, pulse, temp, spo2, weight, height) visible to doctor**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.2, WF-OPD-001`

**Acceptance criteria**
- [x] The clinician can pre-consultation nursing vitals (BP, pulse, temp, SpO2, weight, height) visible to doctor from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Clinical examination notes
> As a **clinician**, I want **clinical examination notes**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.2, WF-OPD-001`

**Acceptance criteria**
- [x] The clinician can clinical examination notes from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Diagnosis entry with ICD-10 auto-suggestion
> As a **clinician**, I want **diagnosis entry with icd-10 auto-suggestion**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.2, WF-OPD-001`

**Acceptance criteria**
- [x] The clinician can diagnosis entry with ICD-10 auto-suggestion from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Differential diagnosis documentation support
> As a **clinician**, I want **differential diagnosis documentation support**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.2, WF-OPD-001`

**Acceptance criteria**
- [x] The clinician can differential diagnosis documentation support from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ SNOMED CT coded findings
> As a **clinician**, I want **snomed ct coded findings**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.2, WF-OPD-001`

**Acceptance criteria**
- [x] The clinician can sNOMED CT coded findings from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Clinical notes (free text + structured)
> As a **clinician**, I want **clinical notes (free text + structured)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.2, WF-OPD-001`

**Acceptance criteria**
- [x] The clinician can clinical notes (free text + structured) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Specialty-specific casesheet templates (16 specialties per RFC §3.2.2)
> As a **clinician**, I want **specialty-specific casesheet templates (16 specialties per rfc §3.2.2)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.2, WF-OPD-001`

**Acceptance criteria**
- [x] The clinician can specialty-specific casesheet templates (16 specialties per RFC §3.2.2) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Template builder (admin-configurable)
> As a **clinician**, I want **template builder (admin-configurable)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.2, WF-OPD-001`

**Acceptance criteria**
- [x] The clinician can template builder (admin-configurable) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Automatic EMR prompts (drug allergies, chronic conditions)
> As a **clinician**, I want **automatic emr prompts (drug allergies, chronic conditions)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.2, WF-OPD-001`

**Acceptance criteria**
- [x] The clinician can automatic EMR prompts (drug allergies, chronic conditions) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Patient timeline view during consultation
> As a **clinician**, I want **patient timeline view during consultation**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.2, WF-OPD-001`

**Acceptance criteria**
- [x] The clinician can patient timeline view during consultation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Voice-to-text option for ward round documentation
> As a **clinician**, I want **voice-to-text option for ward round documentation**.

`Partial · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.2, WF-OPD-001`

**Acceptance criteria**
- [ ] The clinician can voice-to-text option for ward round documentation from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Data Entry

### ✅ Backdated clinical data entry with mandatory reason and supervisor approval
> As a **clinician**, I want **backdated clinical data entry with mandatory reason and supervisor approval**.

`Done · Platforms: Web · Source: iElixir+Bahmni · RFC: §Ext`

**Acceptance criteria**
- [x] The clinician can backdated clinical data entry with mandatory reason and supervisor approval from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Retrospective visit creation (paper records digitization)
> As a **clinician**, I want **retrospective visit creation (paper records digitization)**.

`Done · Platforms: Web · Source: iElixir+Bahmni · RFC: §Ext`

**Acceptance criteria**
- [x] The clinician can retrospective visit creation (paper records digitization) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Visual indicator on all retrospective entries (badge/watermark: 'Entered retrospectively')
> As a **clinician**, I want **visual indicator on all retrospective entries (badge/watermark: 'entered retrospectively')**.

`Done · Platforms: Web · Source: iElixir · RFC: §Ext`

**Acceptance criteria**
- [x] The clinician can visual indicator on all retrospective entries (badge/watermark: 'Entered retrospectively') from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Audit trail — original entry time vs clinical event time
> As a **clinician**, I want **audit trail — original entry time vs clinical event time**.

`Done · Platforms: Web · Source: iElixir · RFC: §Ext`

**Acceptance criteria**
- [x] The clinician can audit trail — original entry time vs clinical event time from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Configurable retrospective entry window (e.g., max 72 hours back, admin override)
> As a **clinician**, I want **configurable retrospective entry window (e.g., max 72 hours back, admin override)**.

`Done · Platforms: Web · Source: iElixir · RFC: §Ext`

**Acceptance criteria**
- [x] The clinician can configurable retrospective entry window (e.g., max 72 hours back, admin override) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Detection

### Automated infection surveillance — flag potential HAIs from lab + clinical data patterns
> As a **clinician**, I want **automated infection surveillance — flag potential hais from lab + clinical data patterns**.

`Partial · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The clinician can automated infection surveillance — flag potential HAIs from lab + clinical data patterns from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Nosocomial infection classification (CAUTI, CLABSI, SSI, VAP) with CDC/NHSN criteria
> As a **clinician**, I want **nosocomial infection classification (cauti, clabsi, ssi, vap) with cdc/nhsn criteria**.

`Done · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The clinician can nosocomial infection classification (CAUTI, CLABSI, SSI, VAP) with CDC/NHSN criteria from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Discharge

### ✅ Discharge summary auto-generation from clinical entries with editable template
> As a **clinician**, I want **discharge summary auto-generation from clinical entries with editable template**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.3, WF-IPD-004`

**Acceptance criteria**
- [x] The clinician can discharge summary auto-generation from clinical entries with editable template from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Discharge checklist
> As a **clinician**, I want **discharge checklist**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.3, WF-IPD-004`

**Acceptance criteria**
- [x] The clinician can discharge checklist from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Final billing at discharge
> As a **clinician**, I want **final billing at discharge**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.3, WF-IPD-004`

**Acceptance criteria**
- [x] The clinician can final billing at discharge from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Discharge medication list with instructions (in patient's language with pictograms)
> As a **clinician**, I want **discharge medication list with instructions (in patient's language with pictograms)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.3, WF-IPD-004`

**Acceptance criteria**
- [x] The clinician can discharge medication list with instructions (in patient's language with pictograms) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Follow-up appointment scheduling
> As a **clinician**, I want **follow-up appointment scheduling**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.3, WF-IPD-004`

**Acceptance criteria**
- [x] The clinician can follow-up appointment scheduling from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ DAMA/LAMA documentation workflow with consent
> As a **clinician**, I want **dama/lama documentation workflow with consent**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.3, WF-IPD-004`

**Acceptance criteria**
- [x] The clinician can dAMA/LAMA documentation workflow with consent from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Absconding patient workflow
> As a **clinician**, I want **absconding patient workflow**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.3, WF-IPD-004`

**Acceptance criteria**
- [x] The clinician can absconding patient workflow from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Death summary auto-generation from IPD records
> As a **clinician**, I want **death summary auto-generation from ipd records**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.3, WF-IPD-004`

**Acceptance criteria**
- [x] The clinician can death summary auto-generation from IPD records from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Death certificate generation (Form 4/4A)
> As a **clinician**, I want **death certificate generation (form 4/4a)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.3, WF-IPD-004`

**Acceptance criteria**
- [x] The clinician can death certificate generation (Form 4/4A) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Birth certificate generation (maternity)
> As a **clinician**, I want **birth certificate generation (maternity)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.3, WF-IPD-004`

**Acceptance criteria**
- [x] The clinician can birth certificate generation (maternity) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Transfer summary (inter-hospital clinical handover)
> As a **clinician**, I want **transfer summary (inter-hospital clinical handover)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.3, WF-IPD-004`

**Acceptance criteria**
- [x] The clinician can transfer summary (inter-hospital clinical handover) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Dept-wise billing configuration at discharge
> As a **clinician**, I want **dept-wise billing configuration at discharge**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.3, WF-IPD-004`

**Acceptance criteria**
- [x] The clinician can dept-wise billing configuration at discharge from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Billing threshold control
> As a **clinician**, I want **billing threshold control**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.3, WF-IPD-004`

**Acceptance criteria**
- [x] The clinician can billing threshold control from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ TAT tracking for discharge process
> As a **clinician**, I want **tat tracking for discharge process**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.3, WF-IPD-004`

**Acceptance criteria**
- [x] The clinician can tAT tracking for discharge process from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Patient feedback at discharge
> As a **clinician**, I want **patient feedback at discharge**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.3, WF-IPD-004`

**Acceptance criteria**
- [x] The clinician can patient feedback at discharge from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Documentation

### ✅ Hourly ICU flowsheet (vitals, ventilator settings, drugs, I/O)
> As a **clinician**, I want **hourly icu flowsheet (vitals, ventilator settings, drugs, i/o)**.

`P2 · Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-14`

**Acceptance criteria**
- [x] The clinician can hourly ICU flowsheet (vitals, ventilator settings, drugs, I/O) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Ventilator parameter tracking (mode, FiO2, PEEP, TV, RR, ABG correlation)
> As a **clinician**, I want **ventilator parameter tracking (mode, fio2, peep, tv, rr, abg correlation)**.

`P2 · Done · Platforms: Web · Source: ACMSRC · RFC: CL-14`

**Acceptance criteria**
- [x] The clinician can ventilator parameter tracking (mode, FiO2, PEEP, TV, RR, ABG correlation) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Hemodynamic monitoring integration (arterial line, CVP, cardiac output)
> As a **clinician**, I want **hemodynamic monitoring integration (arterial line, cvp, cardiac output)**.

`P2 · Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-14`

**Acceptance criteria**
- [x] The clinician can hemodynamic monitoring integration (arterial line, CVP, cardiac output) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Infusion pump tracking (drug, rate, duration)
> As a **clinician**, I want **infusion pump tracking (drug, rate, duration)**.

`P2 · Done · Platforms: Web · Source: ACMSRC · RFC: CL-14`

**Acceptance criteria**
- [x] The clinician can infusion pump tracking (drug, rate, duration) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Sedation scoring (RASS/Richmond) and sedation vacation documentation
> As a **clinician**, I want **sedation scoring (rass/richmond) and sedation vacation documentation**.

`P2 · Done · Platforms: Web · Source: ACMSRC · RFC: CL-14`

**Acceptance criteria**
- [x] The clinician can sedation scoring (RASS/Richmond) and sedation vacation documentation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Nutrition tracking (enteral/parenteral with calorie calculation)
> As a **clinician**, I want **nutrition tracking (enteral/parenteral with calorie calculation)**.

`P2 · Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-14`

**Acceptance criteria**
- [x] The clinician can nutrition tracking (enteral/parenteral with calorie calculation) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Drug-o-gram

### ✅ Drug-o-gram — visual timeline of all medications for chronic patients (diabetes, TB, HIV, etc.)
> As a **clinician**, I want **drug-o-gram — visual timeline of all medications for chronic patients (diabetes, tb, hiv, etc.)**.

`Done · Done · Platforms: Web, Mobile · Source: iElixir · RFC: §Ext`

**Acceptance criteria**
- [x] The clinician can drug-o-gram — visual timeline of all medications for chronic patients (diabetes, TB, HIV, etc.) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Medication change tracking on timeline (start, stop, dose change, switch)
> As a **clinician**, I want **medication change tracking on timeline (start, stop, dose change, switch)**.

`Done · Done · Platforms: Web, Mobile · Source: iElixir · RFC: §Ext`

**Acceptance criteria**
- [x] The clinician can medication change tracking on timeline (start, stop, dose change, switch) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Side-by-side lab value overlay on drug timeline (HbA1c trend vs insulin dose)
> As a **clinician**, I want **side-by-side lab value overlay on drug timeline (hba1c trend vs insulin dose)**.

`Done · Done · Platforms: Web, Mobile · Source: iElixir · RFC: §Ext`

**Acceptance criteria**
- [x] The clinician can side-by-side lab value overlay on drug timeline (HbA1c trend vs insulin dose) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Treatment program enrollment (TB DOTS, HIV ART, Diabetes, Hypertension)
> As a **clinician**, I want **treatment program enrollment (tb dots, hiv art, diabetes, hypertension)**.

`Done · Done · Platforms: Web, Mobile · Source: iElixir+Bahmni · RFC: §Ext`

**Acceptance criteria**
- [x] The clinician can treatment program enrollment (TB DOTS, HIV ART, Diabetes, Hypertension) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Protocol adherence tracking — missed doses, late refills, appointment no-shows
> As a **clinician**, I want **protocol adherence tracking — missed doses, late refills, appointment no-shows**.

`Done · Done · Platforms: Web, Mobile · Source: iElixir · RFC: §Ext`

**Acceptance criteria**
- [x] The clinician can protocol adherence tracking — missed doses, late refills, appointment no-shows from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Chronic disease outcome dashboard (target vs actual — BP, sugar, viral load)
> As a **clinician**, I want **chronic disease outcome dashboard (target vs actual — bp, sugar, viral load)**.

`Done · Done · Platforms: Web, Mobile · Source: iElixir · RFC: §Ext`

**Acceptance criteria**
- [x] The clinician can chronic disease outcome dashboard (target vs actual — BP, sugar, viral load) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Multi-drug interaction timeline alerts for polypharmacy patients
> As a **clinician**, I want **multi-drug interaction timeline alerts for polypharmacy patients**.

`Done · Done · Platforms: Web, Mobile · Source: iElixir · RFC: §Ext`

**Acceptance criteria**
- [x] The clinician can multi-drug interaction timeline alerts for polypharmacy patients from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Printable chronic treatment summary for patient/referral
> As a **clinician**, I want **printable chronic treatment summary for patient/referral**.

`Done · Done · Platforms: Web, Mobile · Source: iElixir · RFC: §Ext`

**Acceptance criteria**
- [x] The clinician can printable chronic treatment summary for patient/referral from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Education

### ✅ Patient education videos (condition-specific, post-op care, medication guides)
> As a **clinician**, I want **patient education videos (condition-specific, post-op care, medication guides)**.

`Done · Platforms: Web, Mobile, TV · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The clinician can patient education videos (condition-specific, post-op care, medication guides) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Execution

### ✅ One-click order set activation with per-item opt-out
> As a **clinician**, I want **one-click order set activation with per-item opt-out**.

`Done · Platforms: Web, Mobile · Source: iElixir+Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The clinician can one-click order set activation with per-item opt-out from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Order set version control (update protocol without breaking active orders)
> As a **clinician**, I want **order set version control (update protocol without breaking active orders)**.

`Done · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The clinician can order set version control (update protocol without breaking active orders) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Feedback

### ✅ Real-time experience feedback (pain level, comfort, cleanliness)
> As a **clinician**, I want **real-time experience feedback (pain level, comfort, cleanliness)**.

`Done · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The clinician can real-time experience feedback (pain level, comfort, cleanliness) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## General

### Ambient voice capture — AI listens to patient-doctor conversation and generates structured SOAP notes
> As a **clinician**, I want **ambient voice capture — ai listens to patient-doctor conversation and generates structured soap notes**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The clinician can ambient voice capture — AI listens to patient-doctor conversation and generates structured SOAP notes from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Auto-generated consultation summary — patient-friendly plain-language visit summary from ambient capture
> As a **clinician**, I want **auto-generated consultation summary — patient-friendly plain-language visit summary from ambient capture**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The clinician can auto-generated consultation summary — patient-friendly plain-language visit summary from ambient capture from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Voice-to-order extraction — detect medication, lab, imaging orders from conversation and pre-fill order forms
> As a **clinician**, I want **voice-to-order extraction — detect medication, lab, imaging orders from conversation and pre-fill order forms**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The clinician can voice-to-order extraction — detect medication, lab, imaging orders from conversation and pre-fill order forms from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Multilingual ambient capture — transcribe Hindi, Tamil, Telugu, Arabic, Nepali conversations to English notes
> As a **clinician**, I want **multilingual ambient capture — transcribe hindi, tamil, telugu, arabic, nepali conversations to english notes**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The clinician can multilingual ambient capture — transcribe Hindi, Tamil, Telugu, Arabic, Nepali conversations to English notes from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Voice-activated patient lookup — 'Show me patient's last blood report' hands-free during consultation
> As a **clinician**, I want **voice-activated patient lookup — 'show me patient's last blood report' hands-free during consultation**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The clinician can voice-activated patient lookup — 'Show me patient's last blood report' hands-free during consultation from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### AI clinical coding — auto-suggest ICD-10/CPT codes from clinical notes with confidence scores
> As a **clinician**, I want **ai clinical coding — auto-suggest icd-10/cpt codes from clinical notes with confidence scores**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The clinician can aI clinical coding — auto-suggest ICD-10/CPT codes from clinical notes with confidence scores from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Drug interaction check from voice — real-time alert when doctor verbally prescribes conflicting medication
> As a **clinician**, I want **drug interaction check from voice — real-time alert when doctor verbally prescribes conflicting medication**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The clinician can drug interaction check from voice — real-time alert when doctor verbally prescribes conflicting medication from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### AI-assisted discharge summary — auto-draft discharge summary from admission-to-discharge clinical data
> As a **clinician**, I want **ai-assisted discharge summary — auto-draft discharge summary from admission-to-discharge clinical data**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The clinician can aI-assisted discharge summary — auto-draft discharge summary from admission-to-discharge clinical data from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Smart template selection — AI selects appropriate clinical note template based on chief complaint
> As a **clinician**, I want **smart template selection — ai selects appropriate clinical note template based on chief complaint**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The clinician can smart template selection — AI selects appropriate clinical note template based on chief complaint from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Clinical decision support nudges — evidence-based suggestions during consultation (screening due, protocol gap)
> As a **clinician**, I want **clinical decision support nudges — evidence-based suggestions during consultation (screening due, protocol gap)**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The clinician can clinical decision support nudges — evidence-based suggestions during consultation (screening due, protocol gap) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### AI differential diagnosis assistant — suggest differentials from symptoms/findings with probability ranking
> As a **clinician**, I want **ai differential diagnosis assistant — suggest differentials from symptoms/findings with probability ranking**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The clinician can aI differential diagnosis assistant — suggest differentials from symptoms/findings with probability ranking from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Conversation-to-referral — detect referral intent from conversation and auto-create referral with context
> As a **clinician**, I want **conversation-to-referral — detect referral intent from conversation and auto-create referral with context**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The clinician can conversation-to-referral — detect referral intent from conversation and auto-create referral with context from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### AI note quality scoring — flag incomplete/inconsistent documentation before sign-off with fix suggestions
> As a **clinician**, I want **ai note quality scoring — flag incomplete/inconsistent documentation before sign-off with fix suggestions**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The clinician can aI note quality scoring — flag incomplete/inconsistent documentation before sign-off with fix suggestions from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Visual journey builder — drag-and-drop care pathway designer for common conditions (surgery, chemo, dialysis)
> As a **clinician**, I want **visual journey builder — drag-and-drop care pathway designer for common conditions (surgery, chemo, dialysis)**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The clinician can visual journey builder — drag-and-drop care pathway designer for common conditions (surgery, chemo, dialysis) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Pre-built journey templates — 30+ templates for common pathways (elective surgery, normal delivery, AMI, stroke)
> As a **clinician**, I want **pre-built journey templates — 30+ templates for common pathways (elective surgery, normal delivery, ami, stroke)**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The clinician can pre-built journey templates — 30+ templates for common pathways (elective surgery, normal delivery, AMI, stroke) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Auto-task routing — journey steps auto-assigned to correct department/staff as patient progresses
> As a **clinician**, I want **auto-task routing — journey steps auto-assigned to correct department/staff as patient progresses**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The clinician can auto-task routing — journey steps auto-assigned to correct department/staff as patient progresses from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Cross-department handoff automation — auto-notify next department when current step completes
> As a **clinician**, I want **cross-department handoff automation — auto-notify next department when current step completes**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The clinician can cross-department handoff automation — auto-notify next department when current step completes from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Journey progress tracker — patient and family can see where they are in the care journey via portal/app
> As a **clinician**, I want **journey progress tracker — patient and family can see where they are in the care journey via portal/app**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The clinician can journey progress tracker — patient and family can see where they are in the care journey via portal/app from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### SLA monitoring per journey step — alert when any step exceeds expected duration (lab TAT, OT wait, bed allocation)
> As a **clinician**, I want **sla monitoring per journey step — alert when any step exceeds expected duration (lab tat, ot wait, bed allocation)**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The clinician can sLA monitoring per journey step — alert when any step exceeds expected duration (lab TAT, OT wait, bed allocation) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Journey deviation alerts — flag when patient pathway diverges from planned route (unexpected ICU transfer, complication)
> As a **clinician**, I want **journey deviation alerts — flag when patient pathway diverges from planned route (unexpected icu transfer, complication)**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The clinician can journey deviation alerts — flag when patient pathway diverges from planned route (unexpected ICU transfer, complication) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Outcome tracking per journey — link patient outcomes to specific pathway versions for continuous improvement
> As a **clinician**, I want **outcome tracking per journey — link patient outcomes to specific pathway versions for continuous improvement**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The clinician can outcome tracking per journey — link patient outcomes to specific pathway versions for continuous improvement from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Patient communication at each step — auto-send status updates, preparation instructions, expected timeline
> As a **clinician**, I want **patient communication at each step — auto-send status updates, preparation instructions, expected timeline**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The clinician can patient communication at each step — auto-send status updates, preparation instructions, expected timeline from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Journey analytics — average time per step, bottleneck identification, completion rate by pathway type
> As a **clinician**, I want **journey analytics — average time per step, bottleneck identification, completion rate by pathway type**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The clinician can journey analytics — average time per step, bottleneck identification, completion rate by pathway type from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Insurance pre-authorization per journey — auto-trigger PA requests at journey stages requiring authorization
> As a **clinician**, I want **insurance pre-authorization per journey — auto-trigger pa requests at journey stages requiring authorization**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The clinician can insurance pre-authorization per journey — auto-trigger PA requests at journey stages requiring authorization from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Family/caregiver journey view — separate portal view for family showing patient progress and next steps
> As a **clinician**, I want **family/caregiver journey view — separate portal view for family showing patient progress and next steps**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

**Acceptance criteria**
- [ ] The clinician can family/caregiver journey view — separate portal view for family showing patient progress and next steps from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Health checkup package builder — configurable test bundles with pricing (Executive, Master, Cardiac, Diabetic, etc.)
> As a **clinician**, I want **health checkup package builder — configurable test bundles with pricing (executive, master, cardiac, diabetic, etc.)**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The clinician can health checkup package builder — configurable test bundles with pricing (Executive, Master, Cardiac, Diabetic, etc.) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Package catalog display — public-facing listing with test details, price, duration, preparation instructions
> As a **clinician**, I want **package catalog display — public-facing listing with test details, price, duration, preparation instructions**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The clinician can package catalog display — public-facing listing with test details, price, duration, preparation instructions from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Online package purchase — patient self-books and pays for health checkup packages via web/app
> As a **clinician**, I want **online package purchase — patient self-books and pays for health checkup packages via web/app**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The clinician can online package purchase — patient self-books and pays for health checkup packages via web/app from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Corporate health screening packages — bulk employee packages with group pricing and scheduling
> As a **clinician**, I want **corporate health screening packages — bulk employee packages with group pricing and scheduling**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The clinician can corporate health screening packages — bulk employee packages with group pricing and scheduling from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Package appointment scheduling — auto-assign lab, radiology, and doctor slots across single or multi-day visit
> As a **clinician**, I want **package appointment scheduling — auto-assign lab, radiology, and doctor slots across single or multi-day visit**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The clinician can package appointment scheduling — auto-assign lab, radiology, and doctor slots across single or multi-day visit from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Package report consolidation — single summary report with all results, doctor commentary, and recommendations
> As a **clinician**, I want **package report consolidation — single summary report with all results, doctor commentary, and recommendations**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The clinician can package report consolidation — single summary report with all results, doctor commentary, and recommendations from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Preventive care reminders — annual checkup nudges based on age, gender, family history, risk profile
> As a **clinician**, I want **preventive care reminders — annual checkup nudges based on age, gender, family history, risk profile**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The clinician can preventive care reminders — annual checkup nudges based on age, gender, family history, risk profile from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Wellness subscription plans — monthly/quarterly monitoring subscriptions (diabetes care, cardiac care, etc.)
> As a **clinician**, I want **wellness subscription plans — monthly/quarterly monitoring subscriptions (diabetes care, cardiac care, etc.)**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The clinician can wellness subscription plans — monthly/quarterly monitoring subscriptions (diabetes care, cardiac care, etc.) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Package comparison tool — side-by-side comparison of different health packages with test overlap highlighting
> As a **clinician**, I want **package comparison tool — side-by-side comparison of different health packages with test overlap highlighting**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The clinician can package comparison tool — side-by-side comparison of different health packages with test overlap highlighting from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Package conversion analytics — views to bookings to completions to follow-up revenue tracking for marketing ROI
> As a **clinician**, I want **package conversion analytics — views to bookings to completions to follow-up revenue tracking for marketing roi**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The clinician can package conversion analytics — views to bookings to completions to follow-up revenue tracking for marketing ROI from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### QR code check-in — scan at hospital entrance, auto-check-in, queue assigned, directions sent to phone
> As a **clinician**, I want **qr code check-in — scan at hospital entrance, auto-check-in, queue assigned, directions sent to phone**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The clinician can qR code check-in — scan at hospital entrance, auto-check-in, queue assigned, directions sent to phone from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Online pre-registration — complete demographics, insurance, consent forms digitally before hospital arrival
> As a **clinician**, I want **online pre-registration — complete demographics, insurance, consent forms digitally before hospital arrival**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The clinician can online pre-registration — complete demographics, insurance, consent forms digitally before hospital arrival from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Real-time wait time display — estimated wait by department shown on website and app before patient leaves home
> As a **clinician**, I want **real-time wait time display — estimated wait by department shown on website and app before patient leaves home**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The clinician can real-time wait time display — estimated wait by department shown on website and app before patient leaves home from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Appointment day journey tracker — patient sees step-by-step progress (check-in, consult, lab, pharmacy, billing)
> As a **clinician**, I want **appointment day journey tracker — patient sees step-by-step progress (check-in, consult, lab, pharmacy, billing)**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The clinician can appointment day journey tracker — patient sees step-by-step progress (check-in, consult, lab, pharmacy, billing) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## NICU Specific

### ✅ Neonatal vital signs (with normative ranges by gestational age)
> As a **clinician**, I want **neonatal vital signs (with normative ranges by gestational age)**.

`P2 · Done · Platforms: Web, Mobile, TV · Source: ACMSRC · RFC: CL-14`

**Acceptance criteria**
- [x] The clinician can neonatal vital signs (with normative ranges by gestational age) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Breast milk management (labeling, storage, administration)
> As a **clinician**, I want **breast milk management (labeling, storage, administration)**.

`P2 · Done · Platforms: Web, Mobile, TV · Source: ACMSRC · RFC: CL-14`

**Acceptance criteria**
- [x] The clinician can breast milk management (labeling, storage, administration) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Phototherapy monitoring and bilirubin trending
> As a **clinician**, I want **phototherapy monitoring and bilirubin trending**.

`P2 · Done · Platforms: Web, Mobile, TV · Source: ACMSRC · RFC: CL-14`

**Acceptance criteria**
- [x] The clinician can phototherapy monitoring and bilirubin trending from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Neonatal sepsis screening protocol
> As a **clinician**, I want **neonatal sepsis screening protocol**.

`P2 · Done · Platforms: Web, Mobile, TV · Source: ACMSRC · RFC: CL-14`

**Acceptance criteria**
- [x] The clinician can neonatal sepsis screening protocol from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Mother-baby identification matching (Code Pink security)
> As a **clinician**, I want **mother-baby identification matching (code pink security)**.

`P2 · Done · Platforms: Web, Mobile, TV · Source: ACMSRC · RFC: CL-14`

**Acceptance criteria**
- [x] The clinician can mother-baby identification matching (Code Pink security) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Newborn Hearing Screening Program (NHSP) integration
> As a **clinician**, I want **newborn hearing screening program (nhsp) integration**.

`P2 · Done · Platforms: Web, Mobile, TV · Source: ACMSRC · RFC: CL-14`

**Acceptance criteria**
- [x] The clinician can newborn Hearing Screening Program (NHSP) integration from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Nursing Services

### ✅ Initial nursing assessment at admission (head-to-toe)
> As a **clinician**, I want **initial nursing assessment at admission (head-to-toe)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-3`

**Acceptance criteria**
- [x] The clinician can initial nursing assessment at admission (head-to-toe) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Nursing care plan creation and modification
> As a **clinician**, I want **nursing care plan creation and modification**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-3`

**Acceptance criteria**
- [x] The clinician can nursing care plan creation and modification from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Barcode scanning for medication verification (right patient, right drug)
> As a **clinician**, I want **barcode scanning for medication verification (right patient, right drug)**.

`Partial · Platforms: Web · Source: ACMSRC · RFC: CL-3`

**Acceptance criteria**
- [ ] The clinician can barcode scanning for medication verification (right patient, right drug) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Medication administration timestamp with nurse ID
> As a **clinician**, I want **medication administration timestamp with nurse id**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-3`

**Acceptance criteria**
- [x] The clinician can medication administration timestamp with nurse ID from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ PRN medication documentation with reason
> As a **clinician**, I want **prn medication documentation with reason**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-3`

**Acceptance criteria**
- [x] The clinician can pRN medication documentation with reason from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Missed dose documentation with reason
> As a **clinician**, I want **missed dose documentation with reason**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-3`

**Acceptance criteria**
- [x] The clinician can missed dose documentation with reason from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ High-alert medication double-check workflow
> As a **clinician**, I want **high-alert medication double-check workflow**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-3`

**Acceptance criteria**
- [x] The clinician can high-alert medication double-check workflow from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Chemotherapy administration (requires chemo certification — ABAC check)
> As a **clinician**, I want **chemotherapy administration (requires chemo certification — abac check)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-3`

**Acceptance criteria**
- [x] The clinician can chemotherapy administration (requires chemo certification — ABAC check) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ SBAR (Situation, Background, Assessment, Recommendation) handover format
> As a **clinician**, I want **sbar (situation, background, assessment, recommendation) handover format**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-3`

**Acceptance criteria**
- [x] The clinician can sBAR (Situation, Background, Assessment, Recommendation) handover format from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Pending task carryover between shifts
> As a **clinician**, I want **pending task carryover between shifts**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-3`

**Acceptance criteria**
- [x] The clinician can pending task carryover between shifts from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Critical patient flagging for incoming shift
> As a **clinician**, I want **critical patient flagging for incoming shift**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-3`

**Acceptance criteria**
- [x] The clinician can critical patient flagging for incoming shift from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Nurse call system integration with response time tracking
> As a **clinician**, I want **nurse call system integration with response time tracking**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-3`

**Acceptance criteria**
- [x] The clinician can nurse call system integration with response time tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Escalation if nurse call unresponded > 2 min → charge nurse, > 5 min → supervisor
> As a **clinician**, I want **escalation if nurse call unresponded > 2 min → charge nurse, > 5 min → supervisor**.

`Partial · Platforms: Web · Source: ACMSRC · RFC: CL-3`

**Acceptance criteria**
- [ ] The clinician can escalation if nurse call unresponded > 2 min → charge nurse, > 5 min → supervisor from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Patient identification wristband verification (barcode scan)
> As a **clinician**, I want **patient identification wristband verification (barcode scan)**.

`Partial · Platforms: Web · Source: ACMSRC · RFC: CL-3`

**Acceptance criteria**
- [ ] The clinician can patient identification wristband verification (barcode scan) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Consent verification before procedure (scan patient + consent barcode)
> As a **clinician**, I want **consent verification before procedure (scan patient + consent barcode)**.

`Partial · Platforms: Web · Source: ACMSRC · RFC: CL-3`

**Acceptance criteria**
- [ ] The clinician can consent verification before procedure (scan patient + consent barcode) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Blood transfusion checklist and reaction monitoring
> As a **clinician**, I want **blood transfusion checklist and reaction monitoring**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-3`

**Acceptance criteria**
- [x] The clinician can blood transfusion checklist and reaction monitoring from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Incident reporting (anonymous option available)
> As a **clinician**, I want **incident reporting (anonymous option available)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-3`

**Acceptance criteria**
- [x] The clinician can incident reporting (anonymous option available) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Restraint monitoring log (every 30 min for psychiatric patients)
> As a **clinician**, I want **restraint monitoring log (every 30 min for psychiatric patients)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-3`

**Acceptance criteria**
- [x] The clinician can restraint monitoring log (every 30 min for psychiatric patients) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Elopement risk assessment for psychiatric/MLC patients
> As a **clinician**, I want **elopement risk assessment for psychiatric/mlc patients**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-3`

**Acceptance criteria**
- [x] The clinician can elopement risk assessment for psychiatric/MLC patients from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ ICU nursing flowsheet (hourly documentation)
> As a **clinician**, I want **icu nursing flowsheet (hourly documentation)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-3`

**Acceptance criteria**
- [x] The clinician can iCU nursing flowsheet (hourly documentation) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ NICU nursing — neonatal assessment, feeding chart, phototherapy log
> As a **clinician**, I want **nicu nursing — neonatal assessment, feeding chart, phototherapy log**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-3`

**Acceptance criteria**
- [x] The clinician can nICU nursing — neonatal assessment, feeding chart, phototherapy log from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ OT nursing — surgical safety checklist (WHO), instrument count, specimen log
> As a **clinician**, I want **ot nursing — surgical safety checklist (who), instrument count, specimen log**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-3`

**Acceptance criteria**
- [x] The clinician can oT nursing — surgical safety checklist (WHO), instrument count, specimen log from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Dialysis nursing — pre/intra/post dialysis documentation
> As a **clinician**, I want **dialysis nursing — pre/intra/post dialysis documentation**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-3`

**Acceptance criteria**
- [x] The clinician can dialysis nursing — pre/intra/post dialysis documentation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Endoscopy nursing — sedation monitoring, recovery (Aldrete score)
> As a **clinician**, I want **endoscopy nursing — sedation monitoring, recovery (aldrete score)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-3`

**Acceptance criteria**
- [x] The clinician can endoscopy nursing — sedation monitoring, recovery (Aldrete score) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Operation Theatre

### ✅ OT scheduling calendar with slot management
> As a **clinician**, I want **ot scheduling calendar with slot management**.

`Done · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.6, CL-15`

**Acceptance criteria**
- [x] The clinician can oT scheduling calendar with slot management from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Emergency OT booking with priority override
> As a **clinician**, I want **emergency ot booking with priority override**.

`Done · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.6, CL-15`

**Acceptance criteria**
- [x] The clinician can emergency OT booking with priority override from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Pre-operative assessment checklist (anesthesia fitness, investigations, consent)
> As a **clinician**, I want **pre-operative assessment checklist (anesthesia fitness, investigations, consent)**.

`Done · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.6, CL-15`

**Acceptance criteria**
- [x] The clinician can pre-operative assessment checklist (anesthesia fitness, investigations, consent) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Pre-anesthesia check-up (PAC) documentation
> As a **clinician**, I want **pre-anesthesia check-up (pac) documentation**.

`Done · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.6, CL-15`

**Acceptance criteria**
- [x] The clinician can pre-anesthesia check-up (PAC) documentation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Blood reservation request to blood bank
> As a **clinician**, I want **blood reservation request to blood bank**.

`Done · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.6, CL-15`

**Acceptance criteria**
- [x] The clinician can blood reservation request to blood bank from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ OT preparation checklist (equipment, instruments, positioning)
> As a **clinician**, I want **ot preparation checklist (equipment, instruments, positioning)**.

`Done · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.6, CL-15`

**Acceptance criteria**
- [x] The clinician can oT preparation checklist (equipment, instruments, positioning) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ WHO Surgical Safety Checklist (Sign In, Time Out, Sign Out) with HARD-BLOCK if incomplete
> As a **clinician**, I want **who surgical safety checklist (sign in, time out, sign out) with hard-block if incomplete**.

`Done · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.6, CL-15`

**Acceptance criteria**
- [x] The clinician can wHO Surgical Safety Checklist (Sign In, Time Out, Sign Out) with HARD-BLOCK if incomplete from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Anesthesia record (drugs, airway, vitals, fluid balance)
> As a **clinician**, I want **anesthesia record (drugs, airway, vitals, fluid balance)**.

`Done · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.6, CL-15`

**Acceptance criteria**
- [x] The clinician can anesthesia record (drugs, airway, vitals, fluid balance) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Surgeon's operative note template
> As a **clinician**, I want **surgeon's operative note template**.

`Done · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.6, CL-15`

**Acceptance criteria**
- [x] The clinician can surgeon's operative note template from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Instrument and sponge count (pre/post procedure) with mismatch alert
> As a **clinician**, I want **instrument and sponge count (pre/post procedure) with mismatch alert**.

`Done · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.6, CL-15`

**Acceptance criteria**
- [x] The clinician can instrument and sponge count (pre/post procedure) with mismatch alert from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Implant/prosthesis tracking with barcode scan and patient linkage
> As a **clinician**, I want **implant/prosthesis tracking with barcode scan and patient linkage**.

`Partial · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.6, CL-15`

**Acceptance criteria**
- [ ] The clinician can implant/prosthesis tracking with barcode scan and patient linkage from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Specimen collection documentation with chain-of-custody to pathology
> As a **clinician**, I want **specimen collection documentation with chain-of-custody to pathology**.

`Done · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.6, CL-15`

**Acceptance criteria**
- [x] The clinician can specimen collection documentation with chain-of-custody to pathology from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Blood product usage documentation
> As a **clinician**, I want **blood product usage documentation**.

`Done · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.6, CL-15`

**Acceptance criteria**
- [x] The clinician can blood product usage documentation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Post-Anesthesia Care Unit (PACU) monitoring (Aldrete score)
> As a **clinician**, I want **post-anesthesia care unit (pacu) monitoring (aldrete score)**.

`Done · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.6, CL-15`

**Acceptance criteria**
- [x] The clinician can post-Anesthesia Care Unit (PACU) monitoring (Aldrete score) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Post-operative order set generation
> As a **clinician**, I want **post-operative order set generation**.

`Done · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.6, CL-15`

**Acceptance criteria**
- [x] The clinician can post-operative order set generation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Handover from OT to ward/ICU with documentation
> As a **clinician**, I want **handover from ot to ward/icu with documentation**.

`Done · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.6, CL-15`

**Acceptance criteria**
- [x] The clinician can handover from OT to ward/ICU with documentation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Surgical site marking verification
> As a **clinician**, I want **surgical site marking verification**.

`Done · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.6, CL-15`

**Acceptance criteria**
- [x] The clinician can surgical site marking verification from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ OT turnaround time tracking (room cleaning, preparation)
> As a **clinician**, I want **ot turnaround time tracking (room cleaning, preparation)**.

`Done · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.6, CL-15`

**Acceptance criteria**
- [x] The clinician can oT turnaround time tracking (room cleaning, preparation) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ OT consumable tracking
> As a **clinician**, I want **ot consumable tracking**.

`Done · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.6, CL-15`

**Acceptance criteria**
- [x] The clinician can oT consumable tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ OT utilization report (scheduled vs actual time, cancellation rate)
> As a **clinician**, I want **ot utilization report (scheduled vs actual time, cancellation rate)**.

`Done · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.6, CL-15`

**Acceptance criteria**
- [x] The clinician can oT utilization report (scheduled vs actual time, cancellation rate) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Surgeon-wise case load analysis
> As a **clinician**, I want **surgeon-wise case load analysis**.

`Done · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.6, CL-15`

**Acceptance criteria**
- [x] The clinician can surgeon-wise case load analysis from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Anesthesia complication tracking
> As a **clinician**, I want **anesthesia complication tracking**.

`Done · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.6, CL-15`

**Acceptance criteria**
- [x] The clinician can anesthesia complication tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Surgical site infection correlation with OT environment data
> As a **clinician**, I want **surgical site infection correlation with ot environment data**.

`Done · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.6, CL-15`

**Acceptance criteria**
- [x] The clinician can surgical site infection correlation with OT environment data from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Orders & Referrals

### ✅ Investigation ordering (lab/radiology) with electronic routing — no paper requisition
> As a **clinician**, I want **investigation ordering (lab/radiology) with electronic routing — no paper requisition**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.2`

**Acceptance criteria**
- [x] The clinician can investigation ordering (lab/radiology) with electronic routing — no paper requisition from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Procedure ordering
> As a **clinician**, I want **procedure ordering**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.2`

**Acceptance criteria**
- [x] The clinician can procedure ordering from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Inter-department referral with reason, urgency, bi-directional communication
> As a **clinician**, I want **inter-department referral with reason, urgency, bi-directional communication**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.2`

**Acceptance criteria**
- [x] The clinician can inter-department referral with reason, urgency, bi-directional communication from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ External referral letter generation
> As a **clinician**, I want **external referral letter generation**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.2`

**Acceptance criteria**
- [x] The clinician can external referral letter generation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Follow-up scheduling with SMS/WhatsApp auto-reminders
> As a **clinician**, I want **follow-up scheduling with sms/whatsapp auto-reminders**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.2`

**Acceptance criteria**
- [x] The clinician can follow-up scheduling with SMS/WhatsApp auto-reminders from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Cost estimation for ordered services
> As a **clinician**, I want **cost estimation for ordered services**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.2`

**Acceptance criteria**
- [x] The clinician can cost estimation for ordered services from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Pre-authorization request (insurance patients)
> As a **clinician**, I want **pre-authorization request (insurance patients)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.2`

**Acceptance criteria**
- [x] The clinician can pre-authorization request (insurance patients) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Auto-generation of billing for consultation + ordered investigations
> As a **clinician**, I want **auto-generation of billing for consultation + ordered investigations**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.2`

**Acceptance criteria**
- [x] The clinician can auto-generation of billing for consultation + ordered investigations from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## PG/Intern Integration

### ✅ PG logbook auto-entry from cases seen/procedures performed
> As a **clinician**, I want **pg logbook auto-entry from cases seen/procedures performed**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-1 D`

**Acceptance criteria**
- [x] The clinician can pG logbook auto-entry from cases seen/procedures performed from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Intern case logging with supervisor verification
> As a **clinician**, I want **intern case logging with supervisor verification**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-1 D`

**Acceptance criteria**
- [x] The clinician can intern case logging with supervisor verification from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Medical student view-only access with anonymization option
> As a **clinician**, I want **medical student view-only access with anonymization option**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-1 D`

**Acceptance criteria**
- [x] The clinician can medical student view-only access with anonymization option from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Supervision hierarchy enforcement (intern → resident → consultant)
> As a **clinician**, I want **supervision hierarchy enforcement (intern → resident → consultant)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-1 D`

**Acceptance criteria**
- [x] The clinician can supervision hierarchy enforcement (intern → resident → consultant) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Co-signature workflow for resident orders (consultant approval)
> As a **clinician**, I want **co-signature workflow for resident orders (consultant approval)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-1 D`

**Acceptance criteria**
- [x] The clinician can co-signature workflow for resident orders (consultant approval) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Patient View

### ✅ Bedside tablet — patient views their daily schedule (tests, procedures, meals, visits)
> As a **clinician**, I want **bedside tablet — patient views their daily schedule (tests, procedures, meals, visits)**.

`Done · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The clinician can bedside tablet — patient views their daily schedule (tests, procedures, meals, visits) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ View current medications with plain-language descriptions
> As a **clinician**, I want **view current medications with plain-language descriptions**.

`Done · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The clinician can view current medications with plain-language descriptions from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ View latest vitals and lab results (patient-friendly format)
> As a **clinician**, I want **view latest vitals and lab results (patient-friendly format)**.

`Done · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The clinician can view latest vitals and lab results (patient-friendly format) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Meal ordering from bedside (diet-restricted menu based on orders)
> As a **clinician**, I want **meal ordering from bedside (diet-restricted menu based on orders)**.

`Done · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The clinician can meal ordering from bedside (diet-restricted menu based on orders) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Post-Consultation

### ✅ Docket management (doctor daily summary)
> As a **clinician**, I want **docket management (doctor daily summary)**.

`Done · Platforms: Web, Mobile · Source: RFC · RFC: §3.2`

**Acceptance criteria**
- [x] The clinician can docket management (doctor daily summary) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Review & reminder management
> As a **clinician**, I want **review & reminder management**.

`Done · Platforms: Web, Mobile · Source: RFC · RFC: §3.2`

**Acceptance criteria**
- [x] The clinician can review & reminder management from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Patient feedback collection
> As a **clinician**, I want **patient feedback collection**.

`Done · Platforms: Web, Mobile · Source: RFC · RFC: §3.2`

**Acceptance criteria**
- [x] The clinician can patient feedback collection from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Medical certificate generation
> As a **clinician**, I want **medical certificate generation**.

`Done · Platforms: Web, Mobile · Source: RFC · RFC: §3.2`

**Acceptance criteria**
- [x] The clinician can medical certificate generation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Fitness certificate
> As a **clinician**, I want **fitness certificate**.

`Done · Platforms: Web, Mobile · Source: RFC · RFC: §3.2`

**Acceptance criteria**
- [x] The clinician can fitness certificate from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Sick leave certificate
> As a **clinician**, I want **sick leave certificate**.

`Done · Platforms: Web, Mobile · Source: RFC · RFC: §3.2`

**Acceptance criteria**
- [x] The clinician can sick leave certificate from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Disability certificate
> As a **clinician**, I want **disability certificate**.

`Done · Platforms: Web, Mobile · Source: RFC · RFC: §3.2`

**Acceptance criteria**
- [x] The clinician can disability certificate from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Charts & graphs (vitals trend, lab trends)
> As a **clinician**, I want **charts & graphs (vitals trend, lab trends)**.

`Done · Platforms: Web, Mobile · Source: RFC · RFC: §3.2`

**Acceptance criteria**
- [x] The clinician can charts & graphs (vitals trend, lab trends) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Visit summary print
> As a **clinician**, I want **visit summary print**.

`Done · Platforms: Web, Mobile · Source: RFC · RFC: §3.2`

**Acceptance criteria**
- [x] The clinician can visit summary print from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Digital consent for procedures
> As a **clinician**, I want **digital consent for procedures**.

`Done · Platforms: Web, Mobile · Source: RFC · RFC: §3.2`

**Acceptance criteria**
- [x] The clinician can digital consent for procedures from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Prescription

### ✅ E-prescription with drug search
> As a **clinician**, I want **e-prescription with drug search**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.2`

**Acceptance criteria**
- [x] The clinician can e-prescription with drug search from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Drug formulary master
> As a **clinician**, I want **drug formulary master**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.2`

**Acceptance criteria**
- [x] The clinician can drug formulary master from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Dosage, frequency, duration, route
> As a **clinician**, I want **dosage, frequency, duration, route**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.2`

**Acceptance criteria**
- [x] The clinician can dosage, frequency, duration, route from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Prescription with drug interaction alerts, allergy cross-check, formulary enforcement
> As a **clinician**, I want **prescription with drug interaction alerts, allergy cross-check, formulary enforcement**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.2`

**Acceptance criteria**
- [x] The clinician can prescription with drug interaction alerts, allergy cross-check, formulary enforcement from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Favourite prescriptions (doctor-specific templates)
> As a **clinician**, I want **favourite prescriptions (doctor-specific templates)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.2`

**Acceptance criteria**
- [x] The clinician can favourite prescriptions (doctor-specific templates) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Prescription print (standard format with doctor Reg No, qualifications, digital signature)
> As a **clinician**, I want **prescription print (standard format with doctor reg no, qualifications, digital signature)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.2`

**Acceptance criteria**
- [x] The clinician can prescription print (standard format with doctor Reg No, qualifications, digital signature) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Prescription forwarding to in-house pharmacy
> As a **clinician**, I want **prescription forwarding to in-house pharmacy**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.2`

**Acceptance criteria**
- [x] The clinician can prescription forwarding to in-house pharmacy from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ External pharmacy prescription print
> As a **clinician**, I want **external pharmacy prescription print**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.2`

**Acceptance criteria**
- [x] The clinician can external pharmacy prescription print from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Prescription history view
> As a **clinician**, I want **prescription history view**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.2`

**Acceptance criteria**
- [x] The clinician can prescription history view from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Registration

### ✅ Quick patient registration form (name, age, gender, phone, address)
> As a **clinician**, I want **quick patient registration form (name, age, gender, phone, address)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.1`

**Acceptance criteria**
- [x] The clinician can quick patient registration form (name, age, gender, phone, address) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ UHID auto-generation (ACMS-YYYY-NNNNNN format)
> As a **clinician**, I want **uhid auto-generation (acms-yyyy-nnnnnn format)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.1`

**Acceptance criteria**
- [x] The clinician can uHID auto-generation (ACMS-YYYY-NNNNNN format) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ QR code generation per patient
> As a **clinician**, I want **qr code generation per patient**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.1`

**Acceptance criteria**
- [x] The clinician can qR code generation per patient from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Aadhaar-based deduplication
> As a **clinician**, I want **aadhaar-based deduplication**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.1`

**Acceptance criteria**
- [x] The clinician can aadhaar-based deduplication from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ABHA ID creation & linking (ABDM M1)
> As a **clinician**, I want **abha id creation & linking (abdm m1)**.

`Partial · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.1`

**Acceptance criteria**
- [ ] The clinician can aBHA ID creation & linking (ABDM M1) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Photo capture (webcam/upload)
> As a **clinician**, I want **photo capture (webcam/upload)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.1`

**Acceptance criteria**
- [x] The clinician can photo capture (webcam/upload) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Emergency registration (minimal fields, complete later)
> As a **clinician**, I want **emergency registration (minimal fields, complete later)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.1`

**Acceptance criteria**
- [x] The clinician can emergency registration (minimal fields, complete later) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Temporary UHID with EMERGENCY prefix
> As a **clinician**, I want **temporary uhid with emergency prefix**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.1`

**Acceptance criteria**
- [x] The clinician can temporary UHID with EMERGENCY prefix from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Family linking (spouse, parent, child relationships)
> As a **clinician**, I want **family linking (spouse, parent, child relationships)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.1`

**Acceptance criteria**
- [x] The clinician can family linking (spouse, parent, child relationships) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Patient merge (duplicate resolution)
> As a **clinician**, I want **patient merge (duplicate resolution)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.1`

**Acceptance criteria**
- [x] The clinician can patient merge (duplicate resolution) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Patient search (name, phone, UHID, ABHA, Aadhaar)
> As a **clinician**, I want **patient search (name, phone, uhid, abha, aadhaar)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.1`

**Acceptance criteria**
- [x] The clinician can patient search (name, phone, UHID, ABHA, Aadhaar) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Fuzzy/typo-tolerant search (name + phone + DOB fuzzy matching)
> As a **clinician**, I want **fuzzy/typo-tolerant search (name + phone + dob fuzzy matching)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.1`

**Acceptance criteria**
- [x] The clinician can fuzzy/typo-tolerant search (name + phone + DOB fuzzy matching) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Patient history timeline (all visits, labs, prescriptions)
> As a **clinician**, I want **patient history timeline (all visits, labs, prescriptions)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.1`

**Acceptance criteria**
- [x] The clinician can patient history timeline (all visits, labs, prescriptions) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Patient portal (self-service appointment, reports)
> As a **clinician**, I want **patient portal (self-service appointment, reports)**.

`Partial · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.1`

**Acceptance criteria**
- [ ] The clinician can patient portal (self-service appointment, reports) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Digital consent forms (registration consent, treatment consent)
> As a **clinician**, I want **digital consent forms (registration consent, treatment consent)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.1`

**Acceptance criteria**
- [x] The clinician can digital consent forms (registration consent, treatment consent) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Multi-language support (form labels, consent text)
> As a **clinician**, I want **multi-language support (form labels, consent text)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.1`

**Acceptance criteria**
- [x] The clinician can multi-language support (form labels, consent text) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Patient card printing with QR code (UHID + ABHA)
> As a **clinician**, I want **patient card printing with qr code (uhid + abha)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.1`

**Acceptance criteria**
- [x] The clinician can patient card printing with QR code (UHID + ABHA) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Patient wristband — IPD (Name, UHID, DOB, Blood Group, Allergy flag, Barcode)
> As a **clinician**, I want **patient wristband — ipd (name, uhid, dob, blood group, allergy flag, barcode)**.

`Partial · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.1`

**Acceptance criteria**
- [ ] The clinician can patient wristband — IPD (Name, UHID, DOB, Blood Group, Allergy flag, Barcode) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Infant wristband — NICU (Mother name, Baby ID, DOB, Gender, RFID tag)
> As a **clinician**, I want **infant wristband — nicu (mother name, baby id, dob, gender, rfid tag)**.

`Partial · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.1`

**Acceptance criteria**
- [ ] The clinician can infant wristband — NICU (Mother name, Baby ID, DOB, Gender, RFID tag) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Reporting

### ✅ NHSN/CDC regulatory reporting auto-generation
> As a **clinician**, I want **nhsn/cdc regulatory reporting auto-generation**.

`Done · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The clinician can nHSN/CDC regulatory reporting auto-generation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Line-day/device-day tracking for denominator calculation
> As a **clinician**, I want **line-day/device-day tracking for denominator calculation**.

`Done · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The clinician can line-day/device-day tracking for denominator calculation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Response

### ✅ Contact tracing workflow (identify exposed patients/staff from index case)
> As a **clinician**, I want **contact tracing workflow (identify exposed patients/staff from index case)**.

`Done · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The clinician can contact tracing workflow (identify exposed patients/staff from index case) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Scoring & Outcomes

### ✅ APACHE II/IV score calculation
> As a **clinician**, I want **apache ii/iv score calculation**.

`P2 · Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-14`

**Acceptance criteria**
- [x] The clinician can aPACHE II/IV score calculation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ SOFA score daily tracking
> As a **clinician**, I want **sofa score daily tracking**.

`P2 · Done · Platforms: Web · Source: ACMSRC · RFC: CL-14`

**Acceptance criteria**
- [x] The clinician can sOFA score daily tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ GCS tracking with trend
> As a **clinician**, I want **gcs tracking with trend**.

`P2 · Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-14`

**Acceptance criteria**
- [x] The clinician can gCS tracking with trend from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ PRISM score (PICU), SNAPPE (NICU)
> As a **clinician**, I want **prism score (picu), snappe (nicu)**.

`P2 · Done · Platforms: Web · Source: ACMSRC · RFC: CL-14`

**Acceptance criteria**
- [x] The clinician can pRISM score (PICU), SNAPPE (NICU) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Predicted mortality vs actual outcome comparison
> As a **clinician**, I want **predicted mortality vs actual outcome comparison**.

`P2 · Done · Platforms: Web · Source: ACMSRC · RFC: CL-14`

**Acceptance criteria**
- [x] The clinician can predicted mortality vs actual outcome comparison from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ ICU length of stay and readmission tracking
> As a **clinician**, I want **icu length of stay and readmission tracking**.

`P2 · Done · Platforms: Web · Source: ACMSRC · RFC: CL-14`

**Acceptance criteria**
- [x] The clinician can iCU length of stay and readmission tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Templates

### Express Lane documentation — single-screen visit templates (well-child, routine follow-up)
> As a **clinician**, I want **express lane documentation — single-screen visit templates (well-child, routine follow-up)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The clinician can express Lane documentation — single-screen visit templates (well-child, routine follow-up) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Specialty-specific smart templates (cardiology review, orthopedic assessment, psych eval)
> As a **clinician**, I want **specialty-specific smart templates (cardiology review, orthopedic assessment, psych eval)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The clinician can specialty-specific smart templates (cardiology review, orthopedic assessment, psych eval) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Patient-reported pre-visit questionnaire auto-populating chart fields
> As a **clinician**, I want **patient-reported pre-visit questionnaire auto-populating chart fields**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The clinician can patient-reported pre-visit questionnaire auto-populating chart fields from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Trending

### ✅ Infection trend analysis — time-series charts per ward/ICU/procedure type
> As a **clinician**, I want **infection trend analysis — time-series charts per ward/icu/procedure type**.

`Done · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The clinician can infection trend analysis — time-series charts per ward/ICU/procedure type from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Antibiogram generation — hospital-wide antibiotic sensitivity patterns
> As a **clinician**, I want **antibiogram generation — hospital-wide antibiotic sensitivity patterns**.

`Done · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The clinician can antibiogram generation — hospital-wide antibiotic sensitivity patterns from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Outbreak detection algorithm (unusual cluster of same organism/ward)
> As a **clinician**, I want **outbreak detection algorithm (unusual cluster of same organism/ward)**.

`Done · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The clinician can outbreak detection algorithm (unusual cluster of same organism/ward) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Ward & Bed Mgmt

### ✅ Ward master (name, type, floor, building)
> As a **clinician**, I want **ward master (name, type, floor, building)**.

`Done · Platforms: Web, Mobile, TV · Source: RFC · RFC: §3.3`

**Acceptance criteria**
- [x] The clinician can ward master (name, type, floor, building) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Bed master (bed number, type, features)
> As a **clinician**, I want **bed master (bed number, type, features)**.

`Done · Platforms: Web, Mobile, TV · Source: RFC · RFC: §3.3`

**Acceptance criteria**
- [x] The clinician can bed master (bed number, type, features) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Real-time bed occupancy dashboard
> As a **clinician**, I want **real-time bed occupancy dashboard**.

`Done · Platforms: Web, Mobile, TV · Source: RFC · RFC: §3.3`

**Acceptance criteria**
- [x] The clinician can real-time bed occupancy dashboard from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Bed transfer (ward to ward, bed to bed)
> As a **clinician**, I want **bed transfer (ward to ward, bed to bed)**.

`Done · Platforms: Web, Mobile, TV · Source: RFC · RFC: §3.3`

**Acceptance criteria**
- [x] The clinician can bed transfer (ward to ward, bed to bed) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Bed blocking/reservation
> As a **clinician**, I want **bed blocking/reservation**.

`Done · Platforms: Web, Mobile, TV · Source: RFC · RFC: §3.3`

**Acceptance criteria**
- [x] The clinician can bed blocking/reservation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Bed cleaning status tracking
> As a **clinician**, I want **bed cleaning status tracking**.

`Done · Platforms: Web, Mobile, TV · Source: RFC · RFC: §3.3`

**Acceptance criteria**
- [x] The clinician can bed cleaning status tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Bed turnaround time tracking
> As a **clinician**, I want **bed turnaround time tracking**.

`Done · Platforms: Web, Mobile, TV · Source: RFC · RFC: §3.3`

**Acceptance criteria**
- [x] The clinician can bed turnaround time tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Isolation bed flagging
> As a **clinician**, I want **isolation bed flagging**.

`Done · Platforms: Web, Mobile, TV · Source: RFC · RFC: §3.3`

**Acceptance criteria**
- [x] The clinician can isolation bed flagging from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ ICU bed management
> As a **clinician**, I want **icu bed management**.

`Done · Platforms: Web, Mobile, TV · Source: RFC · RFC: §3.3`

**Acceptance criteria**
- [x] The clinician can iCU bed management from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ NICU/PICU bed management
> As a **clinician**, I want **nicu/picu bed management**.

`Done · Platforms: Web, Mobile, TV · Source: RFC · RFC: §3.3`

**Acceptance criteria**
- [x] The clinician can nICU/PICU bed management from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Nursery management
> As a **clinician**, I want **nursery management**.

`Done · Platforms: Web, Mobile, TV · Source: RFC · RFC: §3.3`

**Acceptance criteria**
- [x] The clinician can nursery management from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### TV display for bed status (ward-level)
> As a **clinician**, I want **tv display for bed status (ward-level)**.

`Partial · Platforms: Web, Mobile, TV · Source: RFC · RFC: §3.3`

**Acceptance criteria**
- [ ] The clinician can tV display for bed status (ward-level) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Ward Dashboard

### ✅ Ward-level patient grid — all beds with status (vitals due, meds due, assessments pending)
> As a **clinician**, I want **ward-level patient grid — all beds with status (vitals due, meds due, assessments pending)**.

`Done · Platforms: Web, Mobile, TV · Source: iElixir+Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The clinician can ward-level patient grid — all beds with status (vitals due, meds due, assessments pending) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Color-coded task urgency (overdue=red, due-now=yellow, upcoming=green)
> As a **clinician**, I want **color-coded task urgency (overdue=red, due-now=yellow, upcoming=green)**.

`Done · Platforms: Web, TV · Source: iElixir+Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The clinician can color-coded task urgency (overdue=red, due-now=yellow, upcoming=green) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Medication administration pending list per nurse assignment
> As a **clinician**, I want **medication administration pending list per nurse assignment**.

`Done · Platforms: Web, Mobile, TV · Source: iElixir+Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The clinician can medication administration pending list per nurse assignment from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Vitals collection checklist (which patients need vitals, when last taken)
> As a **clinician**, I want **vitals collection checklist (which patients need vitals, when last taken)**.

`Done · Platforms: Web, Mobile, TV · Source: iElixir+Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The clinician can vitals collection checklist (which patients need vitals, when last taken) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Patient handover summary generation (shift change — pending tasks, critical notes)
> As a **clinician**, I want **patient handover summary generation (shift change — pending tasks, critical notes)**.

`Done · Platforms: Web, Mobile, TV · Source: iElixir+Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The clinician can patient handover summary generation (shift change — pending tasks, critical notes) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Real-time bed board with acuity scores and fall risk indicators
> As a **clinician**, I want **real-time bed board with acuity scores and fall risk indicators**.

`Done · Platforms: Web, Mobile, TV · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The clinician can real-time bed board with acuity scores and fall risk indicators from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Discharge readiness tracker (pending labs, clearances, meds, transport)
> As a **clinician**, I want **discharge readiness tracker (pending labs, clearances, meds, transport)**.

`Done · Platforms: Web, TV · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The clinician can discharge readiness tracker (pending labs, clearances, meds, transport) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Non-medication task tracking (wound care, catheter care, repositioning)
> As a **clinician**, I want **non-medication task tracking (wound care, catheter care, repositioning)**.

`Done · Platforms: Web, Mobile, TV · Source: iElixir+Bahmni · RFC: §Ext`

**Acceptance criteria**
- [x] The clinician can non-medication task tracking (wound care, catheter care, repositioning) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Clinical coding applied (ICD-10/11, SNOMED) and IPSG safety enforced (2-ID, allergy/LASA, consent).
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

