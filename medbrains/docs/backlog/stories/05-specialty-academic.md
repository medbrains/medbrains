# Specialty & Academic — stories

_Auto-generated from `MedBrains_Features.xlsx` — every feature as a story with module-tailored acceptance criteria. 299 stories (✅ = Done). Source of truth is the xlsx; regenerate via `python3 scripts/generate_stories.py`._

## Accreditation

### Stipend processing with attendance-based calculation
> As a **specialist**, I want **stipend processing with attendance-based calculation**.

`Pending · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: CL-21 H`

**Acceptance criteria**
- [ ] The specialist can stipend processing with attendance-based calculation from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Service bond tracking (amount, period, completion, forfeiture)
> As a **specialist**, I want **service bond tracking (amount, period, completion, forfeiture)**.

`Pending · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: CL-21 H`

**Acceptance criteria**
- [ ] The specialist can service bond tracking (amount, period, completion, forfeiture) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Scholarship/fee waiver management with utilization certificates
> As a **specialist**, I want **scholarship/fee waiver management with utilization certificates**.

`Pending · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: CL-21 H`

**Acceptance criteria**
- [ ] The specialist can scholarship/fee waiver management with utilization certificates from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### NMC NARF self-assessment with evidence auto-compilation
> As a **specialist**, I want **nmc narf self-assessment with evidence auto-compilation**.

`Pending · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: CL-21 H`

**Acceptance criteria**
- [ ] The specialist can nMC NARF self-assessment with evidence auto-compilation from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### NAAC SSR data aggregation
> As a **specialist**, I want **naac ssr data aggregation**.

`Pending · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: CL-21 H`

**Acceptance criteria**
- [ ] The specialist can nAAC SSR data aggregation from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Inspection readiness dashboard with Red/Yellow/Green indicators
> As a **specialist**, I want **inspection readiness dashboard with red/yellow/green indicators**.

`Pending · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: CL-21 H`

**Acceptance criteria**
- [ ] The specialist can inspection readiness dashboard with Red/Yellow/Green indicators from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Faculty-student ratio reporting
> As a **specialist**, I want **faculty-student ratio reporting**.

`Pending · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: CL-21 H`

**Acceptance criteria**
- [ ] The specialist can faculty-student ratio reporting from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Research/thesis tracking
> As a **specialist**, I want **research/thesis tracking**.

`Pending · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: CL-21 H`

**Acceptance criteria**
- [ ] The specialist can research/thesis tracking from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### NMC inspection report generation (one-click)
> As a **specialist**, I want **nmc inspection report generation (one-click)**.

`Pending · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: CL-21 H`

**Acceptance criteria**
- [ ] The specialist can nMC inspection report generation (one-click) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Patient consent for teaching
> As a **specialist**, I want **patient consent for teaching**.

`Pending · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: CL-21 H`

**Acceptance criteria**
- [ ] The specialist can patient consent for teaching from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Anonymized patient data for students (ABAC-filtered)
> As a **specialist**, I want **anonymized patient data for students (abac-filtered)**.

`Pending · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: CL-21 H`

**Acceptance criteria**
- [ ] The specialist can anonymized patient data for students (ABAC-filtered) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Administration

### Infusion administration documentation (start/stop time, rate, reactions, vitals)
> As a **specialist**, I want **infusion administration documentation (start/stop time, rate, reactions, vitals)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can infusion administration documentation (start/stop time, rate, reactions, vitals) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Builder

### Hospital micro website builder (drag-and-drop pages)
> As a **specialist**, I want **hospital micro website builder (drag-and-drop pages)**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can hospital micro website builder (drag-and-drop pages) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Department pages with doctor profiles, timings, contact
> As a **specialist**, I want **department pages with doctor profiles, timings, contact**.

`Pending · Platforms: Web, Mobile · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can department pages with doctor profiles, timings, contact from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Online appointment booking widget (embeddable)
> As a **specialist**, I want **online appointment booking widget (embeddable)**.

`Pending · Platforms: Web, Mobile · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can online appointment booking widget (embeddable) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Health packages / promotions display with online payment
> As a **specialist**, I want **health packages / promotions display with online payment**.

`Pending · Platforms: Web, Mobile · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can health packages / promotions display with online payment from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Patient testimonials and review section
> As a **specialist**, I want **patient testimonials and review section**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can patient testimonials and review section from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### SEO optimization tools (meta tags, sitemap, schema markup)
> As a **specialist**, I want **seo optimization tools (meta tags, sitemap, schema markup)**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can sEO optimization tools (meta tags, sitemap, schema markup) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Custom domain mapping (hospital.com → micro site)
> As a **specialist**, I want **custom domain mapping (hospital.com → micro site)**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can custom domain mapping (hospital.com → micro site) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Responsive design — auto-adapt to mobile/tablet/desktop
> As a **specialist**, I want **responsive design — auto-adapt to mobile/tablet/desktop**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can responsive design — auto-adapt to mobile/tablet/desktop from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Blog/health articles CMS for patient education
> As a **specialist**, I want **blog/health articles cms for patient education**.

`Pending · Platforms: Web, Mobile, TV · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can blog/health articles CMS for patient education from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### WhatsApp/chat widget integration
> As a **specialist**, I want **whatsapp/chat widget integration**.

`Pending · Platforms: Web, Mobile · Source: MocDoc · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can whatsApp/chat widget integration from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## CME & Conferences

### CME event management with certificate generation (QR verified)
> As a **specialist**, I want **cme event management with certificate generation (qr verified)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-21 F`

**Acceptance criteria**
- [ ] The specialist can cME event management with certificate generation (QR verified) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### CME credit hours tracking per doctor (State Medical Council compliance)
> As a **specialist**, I want **cme credit hours tracking per doctor (state medical council compliance)**.

`Pending · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-21 F`

**Acceptance criteria**
- [ ] The specialist can cME credit hours tracking per doctor (State Medical Council compliance) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### FDP tracking (BCME/ACMET completion with renewal alerts)
> As a **specialist**, I want **fdp tracking (bcme/acmet completion with renewal alerts)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-21 F`

**Acceptance criteria**
- [ ] The specialist can fDP tracking (BCME/ACMET completion with renewal alerts) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Faculty teaching hours per week tracking (NMC minimum)
> As a **specialist**, I want **faculty teaching hours per week tracking (nmc minimum)**.

`Pending · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-21 F`

**Acceptance criteria**
- [ ] The specialist can faculty teaching hours per week tracking (NMC minimum) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Conference abstract submission and review workflow
> As a **specialist**, I want **conference abstract submission and review workflow**.

`Pending · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-21 F`

**Acceptance criteria**
- [ ] The specialist can conference abstract submission and review workflow from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Cath Lab

### ✅ STEMI pathway with door-to-balloon time tracking (target <90 min)
> As a **specialist**, I want **stemi pathway with door-to-balloon time tracking (target <90 min)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-25 A`

**Acceptance criteria**
- [x] The specialist can sTEMI pathway with door-to-balloon time tracking (target <90 min) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Hemodynamic recording (pressures, saturations, gradients)
> As a **specialist**, I want **hemodynamic recording (pressures, saturations, gradients)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-25 A`

**Acceptance criteria**
- [x] The specialist can hemodynamic recording (pressures, saturations, gradients) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Stent/device barcode tracking (every device scanned)
> As a **specialist**, I want **stent/device barcode tracking (every device scanned)**.

`Partial · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-25 A`

**Acceptance criteria**
- [ ] The specialist can stent/device barcode tracking (every device scanned) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Contrast volume tracking (cumulative nephrotoxicity risk)
> As a **specialist**, I want **contrast volume tracking (cumulative nephrotoxicity risk)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-25 A`

**Acceptance criteria**
- [x] The specialist can contrast volume tracking (cumulative nephrotoxicity risk) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Radiation dose tracking (fluoroscopy time, DAP, air kerma — AERB)
> As a **specialist**, I want **radiation dose tracking (fluoroscopy time, dap, air kerma — aerb)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-25 A`

**Acceptance criteria**
- [x] The specialist can radiation dose tracking (fluoroscopy time, DAP, air kerma — AERB) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Consignment stock management (vendor-owned, billed on use)
> As a **specialist**, I want **consignment stock management (vendor-owned, billed on use)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-25 A`

**Acceptance criteria**
- [x] The specialist can consignment stock management (vendor-owned, billed on use) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Post-procedure monitoring (sheath removal, hemostasis, ambulation)
> As a **specialist**, I want **post-procedure monitoring (sheath removal, hemostasis, ambulation)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-25 A`

**Acceptance criteria**
- [x] The specialist can post-procedure monitoring (sheath removal, hemostasis, ambulation) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ECG viewer, Echo data integration, stress test templates
> As a **specialist**, I want **ecg viewer, echo data integration, stress test templates**.

`Partial · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-25 A`

**Acceptance criteria**
- [ ] The specialist can eCG viewer, Echo data integration, stress test templates from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Chronic Care

### Chronic disease management in custody (diabetes, HIV, hepatitis, psychiatric conditions)
> As a **specialist**, I want **chronic disease management in custody (diabetes, hiv, hepatitis, psychiatric conditions)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can chronic disease management in custody (diabetes, HIV, hepatitis, psychiatric conditions) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Clinical

### Uro-specific workflows (cystoscopy, urodynamics, biopsy documentation)
> As a **specialist**, I want **uro-specific workflows (cystoscopy, urodynamics, biopsy documentation)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can uro-specific workflows (cystoscopy, urodynamics, biopsy documentation) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Prostate cancer screening tracking (PSA trends, biopsy results, Gleason scoring)
> As a **specialist**, I want **prostate cancer screening tracking (psa trends, biopsy results, gleason scoring)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can prostate cancer screening tracking (PSA trends, biopsy results, Gleason scoring) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Kidney stone analysis documentation (composition, size, location, intervention)
> As a **specialist**, I want **kidney stone analysis documentation (composition, size, location, intervention)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can kidney stone analysis documentation (composition, size, location, intervention) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Clinical Comms

### ✅ Critical value alert (lab → doctor) with acknowledgment tracking
> As a **specialist**, I want **critical value alert (lab → doctor) with acknowledgment tracking**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: CL-26 B`

**Acceptance criteria**
- [x] The specialist can critical value alert (lab → doctor) with acknowledgment tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Secure clinical messaging (in-app, NOT WhatsApp for clinical data)
> As a **specialist**, I want **secure clinical messaging (in-app, not whatsapp for clinical data)**.

`Partial · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: CL-26 B`

**Acceptance criteria**
- [ ] The specialist can secure clinical messaging (in-app, NOT WhatsApp for clinical data) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ SBAR handover communication between shifts
> As a **specialist**, I want **sbar handover communication between shifts**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: CL-26 B`

**Acceptance criteria**
- [x] The specialist can sBAR handover communication between shifts from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Referral communication with bi-directional messaging
> As a **specialist**, I want **referral communication with bi-directional messaging**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: CL-26 B`

**Acceptance criteria**
- [x] The specialist can referral communication with bi-directional messaging from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Discharge communication to referring doctor/GP
> As a **specialist**, I want **discharge communication to referring doctor/gp**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: CL-26 B`

**Acceptance criteria**
- [x] The specialist can discharge communication to referring doctor/GP from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Masked communication (Uber model — staff-to-staff)
> As a **specialist**, I want **masked communication (uber model — staff-to-staff)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: CL-26 B`

**Acceptance criteria**
- [x] The specialist can masked communication (Uber model — staff-to-staff) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Intercom code system
> As a **specialist**, I want **intercom code system**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: CL-26 B`

**Acceptance criteria**
- [x] The specialist can intercom code system from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Critical result escalation chain
> As a **specialist**, I want **critical result escalation chain**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: CL-26 B`

**Acceptance criteria**
- [x] The specialist can critical result escalation chain from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Auto-escalation (doctor not responding → HOD → MS)
> As a **specialist**, I want **auto-escalation (doctor not responding → hod → ms)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: CL-26 B`

**Acceptance criteria**
- [x] The specialist can auto-escalation (doctor not responding → HOD → MS) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Clinical Workflow

### ✅ Resuscitation bay allocation with real-time timer
> As a **specialist**, I want **resuscitation bay allocation with real-time timer**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-2 B`

**Acceptance criteria**
- [x] The specialist can resuscitation bay allocation with real-time timer from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Real-time medication and fluid documentation during resuscitation
> As a **specialist**, I want **real-time medication and fluid documentation during resuscitation**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-2 B`

**Acceptance criteria**
- [x] The specialist can real-time medication and fluid documentation during resuscitation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Code Blue activation and response team auto-assembly
> As a **specialist**, I want **code blue activation and response team auto-assembly**.

`Partial · Platforms: Web, TV · Source: ACMSRC · RFC: CL-2 B`

**Acceptance criteria**
- [ ] The specialist can code Blue activation and response team auto-assembly from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Crash cart medication/equipment checklist integration
> As a **specialist**, I want **crash cart medication/equipment checklist integration**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-2 B`

**Acceptance criteria**
- [x] The specialist can crash cart medication/equipment checklist integration from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Handover documentation (SBAR format) for shift change
> As a **specialist**, I want **handover documentation (sbar format) for shift change**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-2 B`

**Acceptance criteria**
- [x] The specialist can handover documentation (SBAR format) for shift change from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Seamless transition to IPD/OT/ICU admission from ER
> As a **specialist**, I want **seamless transition to ipd/ot/icu admission from er**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-2 B`

**Acceptance criteria**
- [x] The specialist can seamless transition to IPD/OT/ICU admission from ER from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Communication

### Family communication portal (limited health updates via patient portal)
> As a **specialist**, I want **family communication portal (limited health updates via patient portal)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can family communication portal (limited health updates via patient portal) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Compliance

### IRB/Ethics committee submission tracking
> As a **specialist**, I want **irb/ethics committee submission tracking**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can iRB/Ethics committee submission tracking from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### CTMS (Clinical Trial Management System) integration / data export for sponsors
> As a **specialist**, I want **ctms (clinical trial management system) integration / data export for sponsors**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can cTMS (Clinical Trial Management System) integration / data export for sponsors from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Treatment compliance tracking (missed sessions, shortened treatments)
> As a **specialist**, I want **treatment compliance tracking (missed sessions, shortened treatments)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can treatment compliance tracking (missed sessions, shortened treatments) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Digital Signature

### Aadhaar-based e-Sign (legally valid under IT Act)
> As a **specialist**, I want **aadhaar-based e-sign (legally valid under it act)**.

`Partial · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-24 B`

**Acceptance criteria**
- [ ] The specialist can aadhaar-based e-Sign (legally valid under IT Act) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Biometric consent (thumbprint with witness)
> As a **specialist**, I want **biometric consent (thumbprint with witness)**.

`Partial · Platforms: Web · Source: ACMSRC · RFC: CL-24 B`

**Acceptance criteria**
- [ ] The specialist can biometric consent (thumbprint with witness) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Digital pen signature on tablet
> As a **specialist**, I want **digital pen signature on tablet**.

`Partial · Platforms: Web · Source: ACMSRC · RFC: CL-24 B`

**Acceptance criteria**
- [ ] The specialist can digital pen signature on tablet from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Video consent recording for high-risk procedures
> As a **specialist**, I want **video consent recording for high-risk procedures**.

`Partial · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-24 B`

**Acceptance criteria**
- [ ] The specialist can video consent recording for high-risk procedures from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Consent verification HARD-BLOCK before procedure (system-enforced)
> As a **specialist**, I want **consent verification hard-block before procedure (system-enforced)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-24 B`

**Acceptance criteria**
- [x] The specialist can consent verification HARD-BLOCK before procedure (system-enforced) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Consent revocation by patient at any time (instant system update)
> As a **specialist**, I want **consent revocation by patient at any time (instant system update)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-24 B`

**Acceptance criteria**
- [x] The specialist can consent revocation by patient at any time (instant system update) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Endoscopy

### ✅ Scope tracking by serial number with HLD reprocessing log per use
> As a **specialist**, I want **scope tracking by serial number with hld reprocessing log per use**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-25 B`

**Acceptance criteria**
- [x] The specialist can scope tracking by serial number with HLD reprocessing log per use from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Scope leak testing documentation before reprocessing
> As a **specialist**, I want **scope leak testing documentation before reprocessing**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-25 B`

**Acceptance criteria**
- [x] The specialist can scope leak testing documentation before reprocessing from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ HLD parameters tracking (chemical, concentration, soak time, temperature)
> As a **specialist**, I want **hld parameters tracking (chemical, concentration, soak time, temperature)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-25 B`

**Acceptance criteria**
- [x] The specialist can hLD parameters tracking (chemical, concentration, soak time, temperature) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Scope culture surveillance result tracking
> As a **specialist**, I want **scope culture surveillance result tracking**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-25 B`

**Acceptance criteria**
- [x] The specialist can scope culture surveillance result tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Sedation documentation (pre-assessment, drugs, monitoring, Aldrete recovery)
> As a **specialist**, I want **sedation documentation (pre-assessment, drugs, monitoring, aldrete recovery)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-25 B`

**Acceptance criteria**
- [x] The specialist can sedation documentation (pre-assessment, drugs, monitoring, Aldrete recovery) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Biopsy specimen tracking with chain-of-custody to pathology
> As a **specialist**, I want **biopsy specimen tracking with chain-of-custody to pathology**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-25 B`

**Acceptance criteria**
- [x] The specialist can biopsy specimen tracking with chain-of-custody to pathology from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Evaluation

### Transplant candidate evaluation workflow (cardiac, renal, hepatic, lung)
> As a **specialist**, I want **transplant candidate evaluation workflow (cardiac, renal, hepatic, lung)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can transplant candidate evaluation workflow (cardiac, renal, hepatic, lung) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Transplant waitlist management with status tracking (active, inactive, removed)
> As a **specialist**, I want **transplant waitlist management with status tracking (active, inactive, removed)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can transplant waitlist management with status tracking (active, inactive, removed) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Multi-disciplinary transplant committee documentation (meeting notes, decisions)
> As a **specialist**, I want **multi-disciplinary transplant committee documentation (meeting notes, decisions)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can multi-disciplinary transplant committee documentation (meeting notes, decisions) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Execution

### Protocol-driven visit schedule and procedure tracking
> As a **specialist**, I want **protocol-driven visit schedule and procedure tracking**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can protocol-driven visit schedule and procedure tracking from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Adverse event reporting and SAE (Serious Adverse Event) documentation
> As a **specialist**, I want **adverse event reporting and sae (serious adverse event) documentation**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can adverse event reporting and SAE (Serious Adverse Event) documentation from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Blinded/unblinded data handling (randomization module)
> As a **specialist**, I want **blinded/unblinded data handling (randomization module)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can blinded/unblinded data handling (randomization module) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Feedback & Grievance

### ✅ Bedside/kiosk feedback (emoji-based, NABH domains)
> As a **specialist**, I want **bedside/kiosk feedback (emoji-based, nabh domains)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: CL-26 C`

**Acceptance criteria**
- [x] The specialist can bedside/kiosk feedback (emoji-based, NABH domains) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Post-discharge feedback via SMS/WhatsApp (24 hrs after discharge)
> As a **specialist**, I want **post-discharge feedback via sms/whatsapp (24 hrs after discharge)**.

`Partial · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: CL-26 C`

**Acceptance criteria**
- [ ] The specialist can post-discharge feedback via SMS/WhatsApp (24 hrs after discharge) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ NPS (Net Promoter Score) calculation
> As a **specialist**, I want **nps (net promoter score) calculation**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: CL-26 C`

**Acceptance criteria**
- [x] The specialist can nPS (Net Promoter Score) calculation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Multi-channel complaint intake (kiosk, portal, WhatsApp, email, phone)
> As a **specialist**, I want **multi-channel complaint intake (kiosk, portal, whatsapp, email, phone)**.

`Partial · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: CL-26 C`

**Acceptance criteria**
- [ ] The specialist can multi-channel complaint intake (kiosk, portal, WhatsApp, email, phone) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ SLA-based escalation (24hr dept → 48hr Quality → 72hr MS → 7d Grievance Committee)
> As a **specialist**, I want **sla-based escalation (24hr dept → 48hr quality → 72hr ms → 7d grievance committee)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: CL-26 C`

**Acceptance criteria**
- [x] The specialist can sLA-based escalation (24hr dept → 48hr Quality → 72hr MS → 7d Grievance Committee) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Complaint resolution tracking with patient notification
> As a **specialist**, I want **complaint resolution tracking with patient notification**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: CL-26 C`

**Acceptance criteria**
- [x] The specialist can complaint resolution tracking with patient notification from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Department-wise complaint trend analytics
> As a **specialist**, I want **department-wise complaint trend analytics**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: CL-26 C`

**Acceptance criteria**
- [x] The specialist can department-wise complaint trend analytics from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Google review integration
> As a **specialist**, I want **google review integration**.

`Partial · Platforms: Web · Source: RFC+ACMSRC · RFC: CL-26 C`

**Acceptance criteria**
- [ ] The specialist can google review integration from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Patient education material delivery
> As a **specialist**, I want **patient education material delivery**.

`Partial · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: CL-26 C`

**Acceptance criteria**
- [ ] The specialist can patient education material delivery from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Waiting time analytics
> As a **specialist**, I want **waiting time analytics**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: CL-26 C`

**Acceptance criteria**
- [x] The specialist can waiting time analytics from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Service recovery alerts (unhappy patient → immediate action)
> As a **specialist**, I want **service recovery alerts (unhappy patient → immediate action)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: CL-26 C`

**Acceptance criteria**
- [x] The specialist can service recovery alerts (unhappy patient → immediate action) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Follow-up

### Post-procedure follow-up protocols (catheter removal, stent check, imaging schedule)
> As a **specialist**, I want **post-procedure follow-up protocols (catheter removal, stent check, imaging schedule)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can post-procedure follow-up protocols (catheter removal, stent check, imaging schedule) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## General

### Doctor/staff content authorship — rich text editor for articles & blogs with author profile
> As a **specialist**, I want **doctor/staff content authorship — rich text editor for articles & blogs with author profile**.

`P2 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-patient-engagement`

**Acceptance criteria**
- [ ] The specialist can doctor/staff content authorship — rich text editor for articles & blogs with author profile from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Video upload & management — MP4/WebM support with titles, tags, thumbnails, transcripts
> As a **specialist**, I want **video upload & management — mp4/webm support with titles, tags, thumbnails, transcripts**.

`P2 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-patient-engagement`

**Acceptance criteria**
- [ ] The specialist can video upload & management — MP4/WebM support with titles, tags, thumbnails, transcripts from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Medical content review workflow — draft → peer review → medical director approval → publish
> As a **specialist**, I want **medical content review workflow — draft → peer review → medical director approval → publish**.

`P2 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-patient-engagement`

**Acceptance criteria**
- [ ] The specialist can medical content review workflow — draft → peer review → medical director approval → publish from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Content categorization & tagging — specialty, condition, target audience, content type taxonomy
> As a **specialist**, I want **content categorization & tagging — specialty, condition, target audience, content type taxonomy**.

`P2 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-patient-engagement`

**Acceptance criteria**
- [ ] The specialist can content categorization & tagging — specialty, condition, target audience, content type taxonomy from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Multi-language content support — create content in multiple languages with linked translations
> As a **specialist**, I want **multi-language content support — create content in multiple languages with linked translations**.

`P2 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-patient-engagement`

**Acceptance criteria**
- [ ] The specialist can multi-language content support — create content in multiple languages with linked translations from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Medical disclaimer management — auto-attach regulatory disclaimers to all educational content
> As a **specialist**, I want **medical disclaimer management — auto-attach regulatory disclaimers to all educational content**.

`P2 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-patient-engagement`

**Acceptance criteria**
- [ ] The specialist can medical disclaimer management — auto-attach regulatory disclaimers to all educational content from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Video hosting with adaptive streaming — HLS/DASH encoding for bandwidth optimization
> As a **specialist**, I want **video hosting with adaptive streaming — hls/dash encoding for bandwidth optimization**.

`P2 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-patient-engagement`

**Acceptance criteria**
- [ ] The specialist can video hosting with adaptive streaming — HLS/DASH encoding for bandwidth optimization from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Video chapters & timestamps — clickable chapter navigation within videos
> As a **specialist**, I want **video chapters & timestamps — clickable chapter navigation within videos**.

`P2 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-patient-engagement`

**Acceptance criteria**
- [ ] The specialist can video chapters & timestamps — clickable chapter navigation within videos from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Auto-generated captions & subtitles — speech-to-text transcription for accessibility
> As a **specialist**, I want **auto-generated captions & subtitles — speech-to-text transcription for accessibility**.

`P2 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-patient-engagement`

**Acceptance criteria**
- [ ] The specialist can auto-generated captions & subtitles — speech-to-text transcription for accessibility from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Video analytics dashboard — views, watch time, completion rate, drop-off points per video
> As a **specialist**, I want **video analytics dashboard — views, watch time, completion rate, drop-off points per video**.

`P2 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-patient-engagement`

**Acceptance criteria**
- [ ] The specialist can video analytics dashboard — views, watch time, completion rate, drop-off points per video from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Social media post composer — create posts for YouTube, Instagram, Facebook, LinkedIn from CMS
> As a **specialist**, I want **social media post composer — create posts for youtube, instagram, facebook, linkedin from cms**.

`P2 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-patient-engagement`

**Acceptance criteria**
- [ ] The specialist can social media post composer — create posts for YouTube, Instagram, Facebook, LinkedIn from CMS from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Social media publishing integration — auto-post to platforms via OAuth 2.0 APIs
> As a **specialist**, I want **social media publishing integration — auto-post to platforms via oauth 2.0 apis**.

`P2 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-patient-engagement`

**Acceptance criteria**
- [ ] The specialist can social media publishing integration — auto-post to platforms via OAuth 2.0 APIs from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Social media analytics dashboard — likes, shares, comments, reach aggregated per platform
> As a **specialist**, I want **social media analytics dashboard — likes, shares, comments, reach aggregated per platform**.

`P2 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-patient-engagement`

**Acceptance criteria**
- [ ] The specialist can social media analytics dashboard — likes, shares, comments, reach aggregated per platform from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Public health education library — searchable & filterable article + video library, SEO-optimized
> As a **specialist**, I want **public health education library — searchable & filterable article + video library, seo-optimized**.

`P2 · Pending · Platforms: Web, Mobile, TV · Source: MedBrains · RFC: RFC-MODULE-patient-engagement`

**Acceptance criteria**
- [ ] The specialist can public health education library — searchable & filterable article + video library, SEO-optimized from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Personalized content recommendations — suggest content based on diagnoses, visits, demographics
> As a **specialist**, I want **personalized content recommendations — suggest content based on diagnoses, visits, demographics**.

`P2 · Pending · Platforms: Web, Mobile, TV · Source: MedBrains · RFC: RFC-MODULE-patient-engagement`

**Acceptance criteria**
- [ ] The specialist can personalized content recommendations — suggest content based on diagnoses, visits, demographics from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Condition-specific education bundles — curated content packs for common conditions (e.g., Diabetes 101)
> As a **specialist**, I want **condition-specific education bundles — curated content packs for common conditions (e.g., diabetes 101)**.

`P2 · Pending · Platforms: Web, Mobile, TV · Source: MedBrains · RFC: RFC-MODULE-patient-engagement`

**Acceptance criteria**
- [ ] The specialist can condition-specific education bundles — curated content packs for common conditions (e.g., Diabetes 101) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Patient education assignment — doctor assigns specific content to patient during consultation
> As a **specialist**, I want **patient education assignment — doctor assigns specific content to patient during consultation**.

`P2 · Pending · Platforms: Web, Mobile, TV · Source: MedBrains · RFC: RFC-MODULE-patient-engagement`

**Acceptance criteria**
- [ ] The specialist can patient education assignment — doctor assigns specific content to patient during consultation from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Educational content push notifications — notify patients of new relevant content
> As a **specialist**, I want **educational content push notifications — notify patients of new relevant content**.

`P2 · Pending · Platforms: Web, Mobile, TV · Source: MedBrains · RFC: RFC-MODULE-patient-engagement`

**Acceptance criteria**
- [ ] The specialist can educational content push notifications — notify patients of new relevant content from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Maternity care package — antenatal to postnatal bundled program with pricing, doctor team, and amenities
> As a **specialist**, I want **maternity care package — antenatal to postnatal bundled program with pricing, doctor team, and amenities**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The specialist can maternity care package — antenatal to postnatal bundled program with pricing, doctor team, and amenities from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Pediatric wellness program — vaccination schedules, growth tracking, milestone alerts, well-child visit bundles
> As a **specialist**, I want **pediatric wellness program — vaccination schedules, growth tracking, milestone alerts, well-child visit bundles**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The specialist can pediatric wellness program — vaccination schedules, growth tracking, milestone alerts, well-child visit bundles from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Elderly care program — chronic disease management, fall prevention, home visit packages, caregiver support
> As a **specialist**, I want **elderly care program — chronic disease management, fall prevention, home visit packages, caregiver support**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The specialist can elderly care program — chronic disease management, fall prevention, home visit packages, caregiver support from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Cardiac rehabilitation program — post-surgery recovery plan with monitored exercise, diet, and follow-up
> As a **specialist**, I want **cardiac rehabilitation program — post-surgery recovery plan with monitored exercise, diet, and follow-up**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The specialist can cardiac rehabilitation program — post-surgery recovery plan with monitored exercise, diet, and follow-up from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Diabetes management program — continuous monitoring, diet counseling, medication optimization, HbA1c tracking
> As a **specialist**, I want **diabetes management program — continuous monitoring, diet counseling, medication optimization, hba1c tracking**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The specialist can diabetes management program — continuous monitoring, diet counseling, medication optimization, HbA1c tracking from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Orthopedic & sports medicine program — injury assessment, rehab protocol, return-to-activity planning
> As a **specialist**, I want **orthopedic & sports medicine program — injury assessment, rehab protocol, return-to-activity planning**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The specialist can orthopedic & sports medicine program — injury assessment, rehab protocol, return-to-activity planning from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Mental wellness program — counseling packages, stress management workshops, therapy session bundles
> As a **specialist**, I want **mental wellness program — counseling packages, stress management workshops, therapy session bundles**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The specialist can mental wellness program — counseling packages, stress management workshops, therapy session bundles from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Bariatric & weight management program — pre-assessment to post-surgery lifestyle plan with nutritionist
> As a **specialist**, I want **bariatric & weight management program — pre-assessment to post-surgery lifestyle plan with nutritionist**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The specialist can bariatric & weight management program — pre-assessment to post-surgery lifestyle plan with nutritionist from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Fertility & IVF program — consultation to treatment bundled package with success rate display and counseling
> As a **specialist**, I want **fertility & ivf program — consultation to treatment bundled package with success rate display and counseling**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The specialist can fertility & IVF program — consultation to treatment bundled package with success rate display and counseling from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Oncology support program — treatment planning, second opinion, palliative care, survivorship follow-up
> As a **specialist**, I want **oncology support program — treatment planning, second opinion, palliative care, survivorship follow-up**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

**Acceptance criteria**
- [ ] The specialist can oncology support program — treatment planning, second opinion, palliative care, survivorship follow-up from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Home Nursing

### Home care referral from discharge (nursing, wound care, physiotherapy)
> As a **specialist**, I want **home care referral from discharge (nursing, wound care, physiotherapy)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can home care referral from discharge (nursing, wound care, physiotherapy) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Home visit scheduling and nurse assignment with route optimization
> As a **specialist**, I want **home visit scheduling and nurse assignment with route optimization**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can home visit scheduling and nurse assignment with route optimization from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Home visit documentation — vitals, wound photo, medication compliance
> As a **specialist**, I want **home visit documentation — vitals, wound photo, medication compliance**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can home visit documentation — vitals, wound photo, medication compliance from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Remote vital monitoring integration (BP cuff, glucometer, pulse ox via Bluetooth)
> As a **specialist**, I want **remote vital monitoring integration (bp cuff, glucometer, pulse ox via bluetooth)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can remote vital monitoring integration (BP cuff, glucometer, pulse ox via Bluetooth) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Home care billing (visit-based, package-based)
> As a **specialist**, I want **home care billing (visit-based, package-based)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can home care billing (visit-based, package-based) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Caregiver education and instruction documentation
> As a **specialist**, I want **caregiver education and instruction documentation**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can caregiver education and instruction documentation from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Hostel & Welfare

### Hostel room allocation and mess management
> As a **specialist**, I want **hostel room allocation and mess management**.

`Pending · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-21 G`

**Acceptance criteria**
- [ ] The specialist can hostel room allocation and mess management from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Hostel attendance with biometric/app and parent notification
> As a **specialist**, I want **hostel attendance with biometric/app and parent notification**.

`Pending · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-21 G`

**Acceptance criteria**
- [ ] The specialist can hostel attendance with biometric/app and parent notification from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Anti-ragging complaint system (anonymous + UGC portal integration)
> As a **specialist**, I want **anti-ragging complaint system (anonymous + ugc portal integration)**.

`Pending · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-21 G`

**Acceptance criteria**
- [ ] The specialist can anti-ragging complaint system (anonymous + UGC portal integration) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ICC/POSH Act sexual harassment complaint management
> As a **specialist**, I want **icc/posh act sexual harassment complaint management**.

`Pending · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-21 G`

**Acceptance criteria**
- [ ] The specialist can iCC/POSH Act sexual harassment complaint management from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Student counseling cell with encrypted session records (ZERO external visibility)
> As a **specialist**, I want **student counseling cell with encrypted session records (zero external visibility)**.

`Pending · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-21 G`

**Acceptance criteria**
- [ ] The specialist can student counseling cell with encrypted session records (ZERO external visibility) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Mentor-mentee tracking (quarterly meetings per NMC)
> As a **specialist**, I want **mentor-mentee tracking (quarterly meetings per nmc)**.

`Pending · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-21 G`

**Acceptance criteria**
- [ ] The specialist can mentor-mentee tracking (quarterly meetings per NMC) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Disability accommodation plan management (RPWD Act)
> As a **specialist**, I want **disability accommodation plan management (rpwd act)**.

`Pending · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-21 G`

**Acceptance criteria**
- [ ] The specialist can disability accommodation plan management (RPWD Act) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Intake

### Inmate intake health screening (medical history, mental health, substance use, TB, HIV)
> As a **specialist**, I want **inmate intake health screening (medical history, mental health, substance use, tb, hiv)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can inmate intake health screening (medical history, mental health, substance use, TB, HIV) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Medication reconciliation on intake (continue pre-incarceration medications)
> As a **specialist**, I want **medication reconciliation on intake (continue pre-incarceration medications)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can medication reconciliation on intake (continue pre-incarceration medications) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Labs & Anatomy

### Cadaver management (receipt, embalming, allocation, disposal, Anatomy Act compliance)
> As a **specialist**, I want **cadaver management (receipt, embalming, allocation, disposal, anatomy act compliance)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-21 B`

**Acceptance criteria**
- [ ] The specialist can cadaver management (receipt, embalming, allocation, disposal, Anatomy Act compliance) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Teaching lab scheduling (batch-wise) across Physio/Biochem/Pharma/Micro/Pathology
> As a **specialist**, I want **teaching lab scheduling (batch-wise) across physio/biochem/pharma/micro/pathology**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-21 B`

**Acceptance criteria**
- [ ] The specialist can teaching lab scheduling (batch-wise) across Physio/Biochem/Pharma/Micro/Pathology from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Reagent and chemical inventory with MSDS tracking
> As a **specialist**, I want **reagent and chemical inventory with msds tracking**.

`Pending · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-21 B`

**Acceptance criteria**
- [ ] The specialist can reagent and chemical inventory with MSDS tracking from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Teaching equipment maintenance (120+ microscopes, analyzers, etc.)
> As a **specialist**, I want **teaching equipment maintenance (120+ microscopes, analyzers, etc.)**.

`Pending · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-21 B`

**Acceptance criteria**
- [ ] The specialist can teaching equipment maintenance (120+ microscopes, analyzers, etc.) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Student practical attendance and marks
> As a **specialist**, I want **student practical attendance and marks**.

`Pending · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-21 B`

**Acceptance criteria**
- [ ] The specialist can student practical attendance and marks from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### IAEC/CPCSEA compliance for animal experiments (Pharmacology)
> As a **specialist**, I want **iaec/cpcsea compliance for animal experiments (pharmacology)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-21 B`

**Acceptance criteria**
- [ ] The specialist can iAEC/CPCSEA compliance for animal experiments (Pharmacology) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Library

### OPAC (Online Public Access Catalog) with search and availability
> As a **specialist**, I want **opac (online public access catalog) with search and availability**.

`Pending · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-21 E`

**Acceptance criteria**
- [ ] The specialist can oPAC (Online Public Access Catalog) with search and availability from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Circulation (issue, return, renewal, reservation, fine calculation)
> As a **specialist**, I want **circulation (issue, return, renewal, reservation, fine calculation)**.

`Pending · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-21 E`

**Acceptance criteria**
- [ ] The specialist can circulation (issue, return, renewal, reservation, fine calculation) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### E-resource management with INFLIBNET/NLIST integration
> As a **specialist**, I want **e-resource management with inflibnet/nlist integration**.

`Pending · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-21 E`

**Acceptance criteria**
- [ ] The specialist can e-resource management with INFLIBNET/NLIST integration from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### NMC compliance tracking (minimum books per student per subject)
> As a **specialist**, I want **nmc compliance tracking (minimum books per student per subject)**.

`Pending · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-21 E`

**Acceptance criteria**
- [ ] The specialist can nMC compliance tracking (minimum books per student per subject) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Digital repository for theses, dissertations, faculty publications
> As a **specialist**, I want **digital repository for theses, dissertations, faculty publications**.

`Pending · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-21 E`

**Acceptance criteria**
- [ ] The specialist can digital repository for theses, dissertations, faculty publications from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## MLC Documents

### ✅ MLC registration with case numbering and police intimation auto-trigger
> As a **specialist**, I want **mlc registration with case numbering and police intimation auto-trigger**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-24 C`

**Acceptance criteria**
- [x] The specialist can mLC registration with case numbering and police intimation auto-trigger from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Wound certificate generation with body diagram
> As a **specialist**, I want **wound certificate generation with body diagram**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-24 C`

**Acceptance criteria**
- [x] The specialist can wound certificate generation with body diagram from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Age estimation documentation template
> As a **specialist**, I want **age estimation documentation template**.

`Partial · Platforms: Web · Source: ACMSRC · RFC: CL-24 C`

**Acceptance criteria**
- [ ] The specialist can age estimation documentation template from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Sexual assault documentation (POCSO Act compliance)
> As a **specialist**, I want **sexual assault documentation (pocso act compliance)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-24 C`

**Acceptance criteria**
- [x] The specialist can sexual assault documentation (POCSO Act compliance) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Death certificate generation (Form 4/4A)
> As a **specialist**, I want **death certificate generation (form 4/4a)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-24 C`

**Acceptance criteria**
- [x] The specialist can death certificate generation (Form 4/4A) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Court summons tracking and response documentation
> As a **specialist**, I want **court summons tracking and response documentation**.

`Partial · Platforms: Web · Source: ACMSRC · RFC: CL-24 C`

**Acceptance criteria**
- [ ] The specialist can court summons tracking and response documentation from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Medico-legal opinion documentation
> As a **specialist**, I want **medico-legal opinion documentation**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-24 C`

**Acceptance criteria**
- [x] The specialist can medico-legal opinion documentation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## MLC Mgmt

### ✅ MLC register with auto-numbering
> As a **specialist**, I want **mlc register with auto-numbering**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.20, CL-2 D`

**Acceptance criteria**
- [x] The specialist can mLC register with auto-numbering from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Wound certificate generation with body diagram
> As a **specialist**, I want **wound certificate generation with body diagram**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.20, CL-2 D`

**Acceptance criteria**
- [x] The specialist can wound certificate generation with body diagram from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Age estimation documentation
> As a **specialist**, I want **age estimation documentation**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.20, CL-2 D`

**Acceptance criteria**
- [x] The specialist can age estimation documentation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Sexual assault documentation (POCSO compliance)
> As a **specialist**, I want **sexual assault documentation (pocso compliance)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.20, CL-2 D`

**Acceptance criteria**
- [x] The specialist can sexual assault documentation (POCSO compliance) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Police intimation tracking with receipt confirmation
> As a **specialist**, I want **police intimation tracking with receipt confirmation**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.20, CL-2 D`

**Acceptance criteria**
- [x] The specialist can police intimation tracking with receipt confirmation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Court summons tracking
> As a **specialist**, I want **court summons tracking**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.20, CL-2 D`

**Acceptance criteria**
- [x] The specialist can court summons tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Mass Casualty

### ✅ Code Yellow (mass casualty) activation workflow
> As a **specialist**, I want **code yellow (mass casualty) activation workflow**.

`Done · Platforms: Web, Mobile, TV · Source: ACMSRC · RFC: CL-2 C`

**Acceptance criteria**
- [x] The specialist can code Yellow (mass casualty) activation workflow from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Auto-notification to all on-call consultants, admin, blood bank
> As a **specialist**, I want **auto-notification to all on-call consultants, admin, blood bank**.

`Partial · Platforms: Web, Mobile, TV · Source: ACMSRC · RFC: CL-2 C`

**Acceptance criteria**
- [ ] The specialist can auto-notification to all on-call consultants, admin, blood bank from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Batch registration for multiple casualties
> As a **specialist**, I want **batch registration for multiple casualties**.

`Done · Platforms: Web, Mobile, TV · Source: ACMSRC · RFC: CL-2 C`

**Acceptance criteria**
- [x] The specialist can batch registration for multiple casualties from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Triage tagging system for mass casualty
> As a **specialist**, I want **triage tagging system for mass casualty**.

`Done · Platforms: Web, Mobile, TV · Source: ACMSRC · RFC: CL-2 C`

**Acceptance criteria**
- [x] The specialist can triage tagging system for mass casualty from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Resource tracking during disaster (beds, ventilators, blood units)
> As a **specialist**, I want **resource tracking during disaster (beds, ventilators, blood units)**.

`Done · Platforms: Web, Mobile, TV · Source: ACMSRC · RFC: CL-2 C`

**Acceptance criteria**
- [x] The specialist can resource tracking during disaster (beds, ventilators, blood units) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Maternity/OB-GYN

### ✅ Antenatal registration & visit tracking
> As a **specialist**, I want **antenatal registration & visit tracking**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.5`

**Acceptance criteria**
- [x] The specialist can antenatal registration & visit tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ LMP/EDD calculator, ANC chart
> As a **specialist**, I want **lmp/edd calculator, anc chart**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.5`

**Acceptance criteria**
- [x] The specialist can lMP/EDD calculator, ANC chart from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### USG report integration & tracking
> As a **specialist**, I want **usg report integration & tracking**.

`Partial · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.5`

**Acceptance criteria**
- [ ] The specialist can uSG report integration & tracking from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Labor monitoring (partograph)
> As a **specialist**, I want **labor monitoring (partograph)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.5`

**Acceptance criteria**
- [x] The specialist can labor monitoring (partograph) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Delivery documentation
> As a **specialist**, I want **delivery documentation**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.5`

**Acceptance criteria**
- [x] The specialist can delivery documentation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Newborn registration
> As a **specialist**, I want **newborn registration**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.5`

**Acceptance criteria**
- [x] The specialist can newborn registration from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Birth certificate generation
> As a **specialist**, I want **birth certificate generation**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.5`

**Acceptance criteria**
- [x] The specialist can birth certificate generation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Postnatal care documentation
> As a **specialist**, I want **postnatal care documentation**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.5`

**Acceptance criteria**
- [x] The specialist can postnatal care documentation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ NICU admission integration
> As a **specialist**, I want **nicu admission integration**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: §3.5`

**Acceptance criteria**
- [x] The specialist can nICU admission integration from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ PCPNDT Form F (ultrasound record — mandatory for all USG on pregnant women)
> As a **specialist**, I want **pcpndt form f (ultrasound record — mandatory for all usg on pregnant women)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: §3.5`

**Acceptance criteria**
- [x] The specialist can pCPNDT Form F (ultrasound record — mandatory for all USG on pregnant women) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Mental Health

### Suicide risk screening and watch-list management
> As a **specialist**, I want **suicide risk screening and watch-list management**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can suicide risk screening and watch-list management from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Monitoring

### Remote dialysis session monitoring (treatment time, UF volume, BP)
> As a **specialist**, I want **remote dialysis session monitoring (treatment time, uf volume, bp)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can remote dialysis session monitoring (treatment time, UF volume, BP) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Dialysis machine data integration (Baxter, Fresenius — auto-upload treatment logs)
> As a **specialist**, I want **dialysis machine data integration (baxter, fresenius — auto-upload treatment logs)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can dialysis machine data integration (Baxter, Fresenius — auto-upload treatment logs) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Adverse reaction monitoring and emergency protocol for home infusions
> As a **specialist**, I want **adverse reaction monitoring and emergency protocol for home infusions**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can adverse reaction monitoring and emergency protocol for home infusions from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Orders

### Home infusion order management (IV antibiotics, TPN, chemotherapy, biologics)
> As a **specialist**, I want **home infusion order management (iv antibiotics, tpn, chemotherapy, biologics)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can home infusion order management (IV antibiotics, TPN, chemotherapy, biologics) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Urology-specific order sets (UTI workup, hematuria evaluation, BPH management)
> As a **specialist**, I want **urology-specific order sets (uti workup, hematuria evaluation, bph management)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can urology-specific order sets (UTI workup, hematuria evaluation, BPH management) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Other Specialties

### Pediatrics: WHO growth charts, vaccination schedule integration
> As a **specialist**, I want **pediatrics: who growth charts, vaccination schedule integration**.

`Partial · Platforms: Web, Mobile · Source: RFC · RFC: §3.5+`

**Acceptance criteria**
- [ ] The specialist can pediatrics: WHO growth charts, vaccination schedule integration from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Pediatric dosage calculator
> As a **specialist**, I want **pediatric dosage calculator**.

`Partial · Platforms: Web, Mobile · Source: RFC · RFC: §3.5+`

**Acceptance criteria**
- [ ] The specialist can pediatric dosage calculator from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Ophthalmology: VA, IOP, fundus, slit-lamp templates
> As a **specialist**, I want **ophthalmology: va, iop, fundus, slit-lamp templates**.

`Done · Platforms: Web · Source: RFC · RFC: §3.5+`

**Acceptance criteria**
- [x] The specialist can ophthalmology: VA, IOP, fundus, slit-lamp templates from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Orthopedics: Joint diagrams, fracture classification templates
> As a **specialist**, I want **orthopedics: joint diagrams, fracture classification templates**.

`Done · Platforms: Web · Source: RFC · RFC: §3.5+`

**Acceptance criteria**
- [x] The specialist can orthopedics: Joint diagrams, fracture classification templates from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Dermatology: Lesion mapping with photo documentation
> As a **specialist**, I want **dermatology: lesion mapping with photo documentation**.

`Partial · Platforms: Web · Source: RFC · RFC: §3.5+`

**Acceptance criteria**
- [ ] The specialist can dermatology: Lesion mapping with photo documentation from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Oncology: Cancer staging, chemo protocol builder, RECIST tracking, tumor board
> As a **specialist**, I want **oncology: cancer staging, chemo protocol builder, recist tracking, tumor board**.

`Done · Platforms: Web, Mobile · Source: RFC · RFC: §3.5+`

**Acceptance criteria**
- [x] The specialist can oncology: Cancer staging, chemo protocol builder, RECIST tracking, tumor board from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Dialysis: Schedule mgmt, pre/intra/post monitoring, machine assignment, consumables, adequacy
> As a **specialist**, I want **dialysis: schedule mgmt, pre/intra/post monitoring, machine assignment, consumables, adequacy**.

`Done · Platforms: Web · Source: RFC · RFC: §3.5+`

**Acceptance criteria**
- [x] The specialist can dialysis: Schedule mgmt, pre/intra/post monitoring, machine assignment, consumables, adequacy from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Dental: Chart (adult/pediatric), tooth-wise treatment, CDT coding, imaging, ortho tracking
> As a **specialist**, I want **dental: chart (adult/pediatric), tooth-wise treatment, cdt coding, imaging, ortho tracking**.

`Partial · Platforms: Web, Mobile · Source: RFC · RFC: §3.5+`

**Acceptance criteria**
- [ ] The specialist can dental: Chart (adult/pediatric), tooth-wise treatment, CDT coding, imaging, ortho tracking from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ART (IVF/IUI): Patient profile, stimulation monitoring, egg retrieval, embryo tracking, cycle outcomes
> As a **specialist**, I want **art (ivf/iui): patient profile, stimulation monitoring, egg retrieval, embryo tracking, cycle outcomes**.

`Partial · Platforms: Web · Source: RFC · RFC: §3.5+`

**Acceptance criteria**
- [ ] The specialist can aRT (IVF/IUI): Patient profile, stimulation monitoring, egg retrieval, embryo tracking, cycle outcomes from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## PMR/Audiology/Psych

### ✅ Multi-disciplinary rehab (PT, OT, Speech, Prosthetics) with outcome scoring (FIM/Barthel)
> As a **specialist**, I want **multi-disciplinary rehab (pt, ot, speech, prosthetics) with outcome scoring (fim/barthel)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: CL-25 D`

**Acceptance criteria**
- [x] The specialist can multi-disciplinary rehab (PT, OT, Speech, Prosthetics) with outcome scoring (FIM/Barthel) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Disability certificate generation per RPWD Act 2016
> As a **specialist**, I want **disability certificate generation per rpwd act 2016**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: CL-25 D`

**Acceptance criteria**
- [x] The specialist can disability certificate generation per RPWD Act 2016 from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Audiometric testing workflow (PTA, BERA, OAE) with equipment integration
> As a **specialist**, I want **audiometric testing workflow (pta, bera, oae) with equipment integration**.

`Partial · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: CL-25 D`

**Acceptance criteria**
- [ ] The specialist can audiometric testing workflow (PTA, BERA, OAE) with equipment integration from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Newborn Hearing Screening Program (NHSP) with referral tracking
> As a **specialist**, I want **newborn hearing screening program (nhsp) with referral tracking**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: CL-25 D`

**Acceptance criteria**
- [x] The specialist can newborn Hearing Screening Program (NHSP) with referral tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Psychometric test result security (raw data NEVER shared, only interpreted reports)
> As a **specialist**, I want **psychometric test result security (raw data never shared, only interpreted reports)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: CL-25 D`

**Acceptance criteria**
- [x] The specialist can psychometric test result security (raw data NEVER shared, only interpreted reports) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Therapy session documentation (CBT/DBT) with outcome tracking (PHQ-9, GAD-7)
> As a **specialist**, I want **therapy session documentation (cbt/dbt) with outcome tracking (phq-9, gad-7)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: CL-25 D`

**Acceptance criteria**
- [x] The specialist can therapy session documentation (CBT/DBT) with outcome tracking (PHQ-9, GAD-7) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Therapy plan creation & session tracking
> As a **specialist**, I want **therapy plan creation & session tracking**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: CL-25 D`

**Acceptance criteria**
- [x] The specialist can therapy plan creation & session tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Progress documentation & outcome measurement tools
> As a **specialist**, I want **progress documentation & outcome measurement tools**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: CL-25 D`

**Acceptance criteria**
- [x] The specialist can progress documentation & outcome measurement tools from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Home exercise program generation
> As a **specialist**, I want **home exercise program generation**.

`Partial · Platforms: Web · Source: RFC+ACMSRC · RFC: CL-25 D`

**Acceptance criteria**
- [ ] The specialist can home exercise program generation from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Palliative

### Hospice enrollment with prognosis documentation and comfort care plan
> As a **specialist**, I want **hospice enrollment with prognosis documentation and comfort care plan**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can hospice enrollment with prognosis documentation and comfort care plan from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Pain & symptom management tracking (Edmonton Symptom Assessment)
> As a **specialist**, I want **pain & symptom management tracking (edmonton symptom assessment)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can pain & symptom management tracking (Edmonton Symptom Assessment) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Advance directive / DNR management with family consent tracking
> As a **specialist**, I want **advance directive / dnr management with family consent tracking**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can advance directive / DNR management with family consent tracking from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Bereavement support coordination and follow-up scheduling
> As a **specialist**, I want **bereavement support coordination and follow-up scheduling**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can bereavement support coordination and follow-up scheduling from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Interdisciplinary care team notes (doctor, nurse, social worker, chaplain)
> As a **specialist**, I want **interdisciplinary care team notes (doctor, nurse, social worker, chaplain)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can interdisciplinary care team notes (doctor, nurse, social worker, chaplain) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Palliative/Mortuary/NucMed

### ✅ DNR/DNAR order workflow (clearly visible on dashboard, 48-hr review, revocable anytime)
> As a **specialist**, I want **dnr/dnar order workflow (clearly visible on dashboard, 48-hr review, revocable anytime)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-25 E`

**Acceptance criteria**
- [x] The specialist can dNR/DNAR order workflow (clearly visible on dashboard, 48-hr review, revocable anytime) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Pain assessment (WHO ladder) with opioid dose escalation tracking (NDPS compliance)
> As a **specialist**, I want **pain assessment (who ladder) with opioid dose escalation tracking (ndps compliance)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-25 E`

**Acceptance criteria**
- [x] The specialist can pain assessment (WHO ladder) with opioid dose escalation tracking (NDPS compliance) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Organ donation ROTTO/SOTTO notification integration
> As a **specialist**, I want **organ donation rotto/sotto notification integration**.

`Partial · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-25 E`

**Acceptance criteria**
- [ ] The specialist can organ donation ROTTO/SOTTO notification integration from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Mortuary — body receipt, cold storage slot tracking, temperature monitoring
> As a **specialist**, I want **mortuary — body receipt, cold storage slot tracking, temperature monitoring**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-25 E`

**Acceptance criteria**
- [x] The specialist can mortuary — body receipt, cold storage slot tracking, temperature monitoring from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ MLC body flow (police inquest → PM scheduling → viscera chain-of-custody)
> As a **specialist**, I want **mlc body flow (police inquest → pm scheduling → viscera chain-of-custody)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-25 E`

**Acceptance criteria**
- [x] The specialist can mLC body flow (police inquest → PM scheduling → viscera chain-of-custody) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Unclaimed body protocol (72hr → newspaper → municipal → disposal/anatomy dept)
> As a **specialist**, I want **unclaimed body protocol (72hr → newspaper → municipal → disposal/anatomy dept)**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-25 E`

**Acceptance criteria**
- [x] The specialist can unclaimed body protocol (72hr → newspaper → municipal → disposal/anatomy dept) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Nuclear medicine — radiopharmaceutical mgmt, AERB source inventory, patient dose tracking
> As a **specialist**, I want **nuclear medicine — radiopharmaceutical mgmt, aerb source inventory, patient dose tracking**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-25 E`

**Acceptance criteria**
- [x] The specialist can nuclear medicine — radiopharmaceutical mgmt, AERB source inventory, patient dose tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Patient Comms

### SMS gateway integration (appointments, reports ready, bill generated)
> As a **specialist**, I want **sms gateway integration (appointments, reports ready, bill generated)**.

`Partial · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: CL-26 A`

**Acceptance criteria**
- [ ] The specialist can sMS gateway integration (appointments, reports ready, bill generated) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### WhatsApp Business API (report delivery, follow-up reminders, education)
> As a **specialist**, I want **whatsapp business api (report delivery, follow-up reminders, education)**.

`Partial · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: CL-26 A`

**Acceptance criteria**
- [ ] The specialist can whatsApp Business API (report delivery, follow-up reminders, education) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Push notifications via mobile app
> As a **specialist**, I want **push notifications via mobile app**.

`Partial · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: CL-26 A`

**Acceptance criteria**
- [ ] The specialist can push notifications via mobile app from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### IVR for automated appointment booking and report status
> As a **specialist**, I want **ivr for automated appointment booking and report status**.

`Partial · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: CL-26 A`

**Acceptance criteria**
- [ ] The specialist can iVR for automated appointment booking and report status from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Patient portal (view reports, appointments, bills, consents)
> As a **specialist**, I want **patient portal (view reports, appointments, bills, consents)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: CL-26 A`

**Acceptance criteria**
- [x] The specialist can patient portal (view reports, appointments, bills, consents) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Pharmacy

### Home infusion pharmacy preparation and dispensing workflow
> As a **specialist**, I want **home infusion pharmacy preparation and dispensing workflow**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can home infusion pharmacy preparation and dispensing workflow from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Post-Op

### Post-transplant immunosuppression protocol and drug level monitoring
> As a **specialist**, I want **post-transplant immunosuppression protocol and drug level monitoring**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can post-transplant immunosuppression protocol and drug level monitoring from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Graft function monitoring (creatinine trend/renal, LFTs/hepatic, PFTs/lung)
> As a **specialist**, I want **graft function monitoring (creatinine trend/renal, lfts/hepatic, pfts/lung)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can graft function monitoring (creatinine trend/renal, LFTs/hepatic, PFTs/lung) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Program

### Hospital-at-home eligibility screening (diagnosis-based criteria)
> As a **specialist**, I want **hospital-at-home eligibility screening (diagnosis-based criteria)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can hospital-at-home eligibility screening (diagnosis-based criteria) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Remote patient monitoring dashboard (continuous vitals via IoT devices)
> As a **specialist**, I want **remote patient monitoring dashboard (continuous vitals via iot devices)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can remote patient monitoring dashboard (continuous vitals via IoT devices) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Virtual rounding — scheduled video check-ins with attending physician
> As a **specialist**, I want **virtual rounding — scheduled video check-ins with attending physician**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can virtual rounding — scheduled video check-ins with attending physician from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Home medication administration tracking (IV antibiotics, infusions)
> As a **specialist**, I want **home medication administration tracking (iv antibiotics, infusions)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can home medication administration tracking (IV antibiotics, infusions) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Emergency escalation protocol (auto-trigger ambulance if vitals breach threshold)
> As a **specialist**, I want **emergency escalation protocol (auto-trigger ambulance if vitals breach threshold)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can emergency escalation protocol (auto-trigger ambulance if vitals breach threshold) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Daily clinical progress notes by visiting nurse + remote physician
> As a **specialist**, I want **daily clinical progress notes by visiting nurse + remote physician**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can daily clinical progress notes by visiting nurse + remote physician from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Patient/family training materials and discharge criteria from home program
> As a **specialist**, I want **patient/family training materials and discharge criteria from home program**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can patient/family training materials and discharge criteria from home program from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Psychiatry

### COMPLETE DATA ISOLATION from main hospital records (Rule PSY-001)
> As a **specialist**, I want **complete data isolation from main hospital records (rule psy-001)**.

`Partial · Platforms: Web · Source: RFC+ACMSRC · RFC: CL-25 C`

**Acceptance criteria**
- [ ] The specialist can cOMPLETE DATA ISOLATION from main hospital records (Rule PSY-001) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Admission categories (Independent / Supported) per MHCA
> As a **specialist**, I want **admission categories (independent / supported) per mhca**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: CL-25 C`

**Acceptance criteria**
- [x] The specialist can admission categories (Independent / Supported) per MHCA from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Advance Directive storage with Mental Health Board verification
> As a **specialist**, I want **advance directive storage with mental health board verification**.

`Partial · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: CL-25 C`

**Acceptance criteria**
- [ ] The specialist can advance Directive storage with Mental Health Board verification from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Nominated Representative management with notification workflow
> As a **specialist**, I want **nominated representative management with notification workflow**.

`Partial · Platforms: Web · Source: RFC+ACMSRC · RFC: CL-25 C`

**Acceptance criteria**
- [ ] The specialist can nominated Representative management with notification workflow from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ ECT register (consent, sessions, laterality, stimulus, response scores)
> As a **specialist**, I want **ect register (consent, sessions, laterality, stimulus, response scores)**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: CL-25 C`

**Acceptance criteria**
- [x] The specialist can eCT register (consent, sessions, laterality, stimulus, response scores) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Seclusion & restraint documentation (max 4 hrs without review, continuous monitoring)
> As a **specialist**, I want **seclusion & restraint documentation (max 4 hrs without review, continuous monitoring)**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: CL-25 C`

**Acceptance criteria**
- [x] The specialist can seclusion & restraint documentation (max 4 hrs without review, continuous monitoring) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Substance abuse records — additional isolation layer (Rule PSY-002)
> As a **specialist**, I want **substance abuse records — additional isolation layer (rule psy-002)**.

`Partial · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: CL-25 C`

**Acceptance criteria**
- [ ] The specialist can substance abuse records — additional isolation layer (Rule PSY-002) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Mental Health Review Board notification auto-generation
> As a **specialist**, I want **mental health review board notification auto-generation**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: CL-25 C`

**Acceptance criteria**
- [x] The specialist can mental Health Review Board notification auto-generation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Psychiatric assessment forms & Mental status examination
> As a **specialist**, I want **psychiatric assessment forms & mental status examination**.

`Done · Platforms: Web, Mobile · Source: RFC+ACMSRC · RFC: CL-25 C`

**Acceptance criteria**
- [x] The specialist can psychiatric assessment forms & Mental status examination from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Counseling session tracking
> As a **specialist**, I want **counseling session tracking**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: CL-25 C`

**Acceptance criteria**
- [x] The specialist can counseling session tracking from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ HAM-D/BPRS scales
> As a **specialist**, I want **ham-d/bprs scales**.

`Done · Platforms: Web · Source: RFC+ACMSRC · RFC: CL-25 C`

**Acceptance criteria**
- [x] The specialist can hAM-D/BPRS scales from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Restricted access (ABAC — psychiatry notes hidden from non-psychiatry)
> As a **specialist**, I want **restricted access (abac — psychiatry notes hidden from non-psychiatry)**.

`Partial · Platforms: Web · Source: RFC+ACMSRC · RFC: CL-25 C`

**Acceptance criteria**
- [ ] The specialist can restricted access (ABAC — psychiatry notes hidden from non-psychiatry) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Recruitment

### Clinical trial registry with active/recruiting/completed status
> As a **specialist**, I want **clinical trial registry with active/recruiting/completed status**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can clinical trial registry with active/recruiting/completed status from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Patient-trial matching engine (diagnosis, age, labs, medications auto-screened)
> As a **specialist**, I want **patient-trial matching engine (diagnosis, age, labs, medications auto-screened)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can patient-trial matching engine (diagnosis, age, labs, medications auto-screened) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Informed consent management for trial participation (e-consent with versioning)
> As a **specialist**, I want **informed consent management for trial participation (e-consent with versioning)**.

`Done · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [x] The specialist can informed consent management for trial participation (e-consent with versioning) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Registry

### Transplant registry reporting (UNOS/NOTTO compliance submission)
> As a **specialist**, I want **transplant registry reporting (unos/notto compliance submission)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can transplant registry reporting (UNOS/NOTTO compliance submission) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Long-term transplant outcome tracking (1-yr, 3-yr, 5-yr graft/patient survival)
> As a **specialist**, I want **long-term transplant outcome tracking (1-yr, 3-yr, 5-yr graft/patient survival)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can long-term transplant outcome tracking (1-yr, 3-yr, 5-yr graft/patient survival) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Release

### Release health summary and community provider handoff
> As a **specialist**, I want **release health summary and community provider handoff**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can release health summary and community provider handoff from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Research & Ethics

### Research proposal submission portal
> As a **specialist**, I want **research proposal submission portal**.

`Pending · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-21 D`

**Acceptance criteria**
- [ ] The specialist can research proposal submission portal from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### IEC review workflow (initial → expedited → continuing → amendment)
> As a **specialist**, I want **iec review workflow (initial → expedited → continuing → amendment)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-21 D`

**Acceptance criteria**
- [ ] The specialist can iEC review workflow (initial → expedited → continuing → amendment) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ICMR Bioethics Guidelines 2017 compliance
> As a **specialist**, I want **icmr bioethics guidelines 2017 compliance**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-21 D`

**Acceptance criteria**
- [ ] The specialist can iCMR Bioethics Guidelines 2017 compliance from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### SAE (Serious Adverse Event) reporting and review
> As a **specialist**, I want **sae (serious adverse event) reporting and review**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-21 D`

**Acceptance criteria**
- [ ] The specialist can sAE (Serious Adverse Event) reporting and review from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### CTRI registration tracking
> As a **specialist**, I want **ctri registration tracking**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-21 D`

**Acceptance criteria**
- [ ] The specialist can cTRI registration tracking from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Plagiarism detection integration (Turnitin/iThenticate)
> As a **specialist**, I want **plagiarism detection integration (turnitin/ithenticate)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-21 D`

**Acceptance criteria**
- [ ] The specialist can plagiarism detection integration (Turnitin/iThenticate) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Faculty publication tracking (H-index, i10-index, NMC promotion criteria)
> As a **specialist**, I want **faculty publication tracking (h-index, i10-index, nmc promotion criteria)**.

`Pending · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-21 D`

**Acceptance criteria**
- [ ] The specialist can faculty publication tracking (H-index, i10-index, NMC promotion criteria) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Review

### Monthly nephrologist review with remote labs and treatment summary
> As a **specialist**, I want **monthly nephrologist review with remote labs and treatment summary**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can monthly nephrologist review with remote labs and treatment summary from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## SNF

### SNF admission from hospital discharge with care plan transfer
> As a **specialist**, I want **snf admission from hospital discharge with care plan transfer**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can sNF admission from hospital discharge with care plan transfer from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Minimum Data Set (MDS) assessment and documentation
> As a **specialist**, I want **minimum data set (mds) assessment and documentation**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can minimum Data Set (MDS) assessment and documentation from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Long-term medication management (90-day supply, auto-refill)
> As a **specialist**, I want **long-term medication management (90-day supply, auto-refill)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can long-term medication management (90-day supply, auto-refill) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Rehabilitation progress tracking (PT/OT/Speech therapy)
> As a **specialist**, I want **rehabilitation progress tracking (pt/ot/speech therapy)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can rehabilitation progress tracking (PT/OT/Speech therapy) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Family communication portal (care updates, visit scheduling)
> As a **specialist**, I want **family communication portal (care updates, visit scheduling)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can family communication portal (care updates, visit scheduling) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Readmission risk scoring (track patients likely to return to hospital)
> As a **specialist**, I want **readmission risk scoring (track patients likely to return to hospital)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can readmission risk scoring (track patients likely to return to hospital) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Scheduling

### Home infusion nurse scheduling and route planning
> As a **specialist**, I want **home infusion nurse scheduling and route planning**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can home infusion nurse scheduling and route planning from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Security

### Security-restricted access controls (officer vs nurse vs doctor view)
> As a **specialist**, I want **security-restricted access controls (officer vs nurse vs doctor view)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can security-restricted access controls (officer vs nurse vs doctor view) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Setup

### Home dialysis patient enrollment (PD or home HD) with training plan
> As a **specialist**, I want **home dialysis patient enrollment (pd or home hd) with training plan**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can home dialysis patient enrollment (PD or home HD) with training plan from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Simulation & OSCE

### Mannequin/simulator inventory with usage tracking
> As a **specialist**, I want **mannequin/simulator inventory with usage tracking**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-21 C`

**Acceptance criteria**
- [ ] The specialist can mannequin/simulator inventory with usage tracking from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Scenario library mapped to CBME competencies
> As a **specialist**, I want **scenario library mapped to cbme competencies**.

`Pending · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-21 C`

**Acceptance criteria**
- [ ] The specialist can scenario library mapped to CBME competencies from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### OSCE station setup, randomized student rotation, real-time scoring
> As a **specialist**, I want **osce station setup, randomized student rotation, real-time scoring**.

`Pending · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-21 C`

**Acceptance criteria**
- [ ] The specialist can oSCE station setup, randomized student rotation, real-time scoring from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Session video recording and structured debriefing documentation
> As a **specialist**, I want **session video recording and structured debriefing documentation**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-21 C`

**Acceptance criteria**
- [ ] The specialist can session video recording and structured debriefing documentation from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Competency tracking dashboard (knows → shows how → does)
> As a **specialist**, I want **competency tracking dashboard (knows → shows how → does)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-21 C`

**Acceptance criteria**
- [ ] The specialist can competency tracking dashboard (knows → shows how → does) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Student & Curriculum

### Student admission, enrollment, and batch management
> As a **specialist**, I want **student admission, enrollment, and batch management**.

`Pending · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-21 A`

**Acceptance criteria**
- [ ] The specialist can student admission, enrollment, and batch management from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### CBME competency mapping per subject and year
> As a **specialist**, I want **cbme competency mapping per subject and year**.

`Pending · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-21 A`

**Acceptance criteria**
- [ ] The specialist can cBME competency mapping per subject and year from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Internal assessment tracking (formative + summative)
> As a **specialist**, I want **internal assessment tracking (formative + summative)**.

`Pending · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-21 A`

**Acceptance criteria**
- [ ] The specialist can internal assessment tracking (formative + summative) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Examination management (scheduling, hall ticket, result processing)
> As a **specialist**, I want **examination management (scheduling, hall ticket, result processing)**.

`Pending · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-21 A`

**Acceptance criteria**
- [ ] The specialist can examination management (scheduling, hall ticket, result processing) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### PG logbook with HMS-integrated case auto-population
> As a **specialist**, I want **pg logbook with hms-integrated case auto-population**.

`Pending · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-21 A`

**Acceptance criteria**
- [ ] The specialist can pG logbook with HMS-integrated case auto-population from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Intern rotation tracking with NMC mandatory posting enforcement
> As a **specialist**, I want **intern rotation tracking with nmc mandatory posting enforcement**.

`Pending · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-21 A`

**Acceptance criteria**
- [ ] The specialist can intern rotation tracking with NMC mandatory posting enforcement from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Intern logbook with supervisor assessment per rotation
> As a **specialist**, I want **intern logbook with supervisor assessment per rotation**.

`Pending · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-21 A`

**Acceptance criteria**
- [ ] The specialist can intern logbook with supervisor assessment per rotation from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Completion certificate generation with SMC registration recommendation
> As a **specialist**, I want **completion certificate generation with smc registration recommendation**.

`Pending · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-21 A`

**Acceptance criteria**
- [ ] The specialist can completion certificate generation with SMC registration recommendation from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Supply

### Home dialysis supply ordering and delivery tracking
> As a **specialist**, I want **home dialysis supply ordering and delivery tracking**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can home dialysis supply ordering and delivery tracking from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Home infusion supply/equipment tracking (pumps, tubing, dressings)
> As a **specialist**, I want **home infusion supply/equipment tracking (pumps, tubing, dressings)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can home infusion supply/equipment tracking (pumps, tubing, dressings) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Surgery

### Donor-recipient matching documentation and crossmatch results
> As a **specialist**, I want **donor-recipient matching documentation and crossmatch results**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can donor-recipient matching documentation and crossmatch results from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Organ procurement coordination (retrieval team, cold ischemia time, transport)
> As a **specialist**, I want **organ procurement coordination (retrieval team, cold ischemia time, transport)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can organ procurement coordination (retrieval team, cold ischemia time, transport) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Triage

### ✅ Minimal data registration (name/unknown, age estimate, gender, brought-by)
> As a **specialist**, I want **minimal data registration (name/unknown, age estimate, gender, brought-by)**.

`Done · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.4, CL-2`

**Acceptance criteria**
- [x] The specialist can minimal data registration (name/unknown, age estimate, gender, brought-by) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Temporary UHID with EMERGENCY prefix
> As a **specialist**, I want **temporary uhid with emergency prefix**.

`Done · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.4, CL-2`

**Acceptance criteria**
- [x] The specialist can temporary UHID with EMERGENCY prefix from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Triage scoring system (START/ESI) with color coding (Red/Yellow/Green)
> As a **specialist**, I want **triage scoring system (start/esi) with color coding (red/yellow/green)**.

`Done · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.4, CL-2`

**Acceptance criteria**
- [x] The specialist can triage scoring system (START/ESI) with color coding (Red/Yellow/Green) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Auto-notification to casualty MO, duty doctor, and administration
> As a **specialist**, I want **auto-notification to casualty mo, duty doctor, and administration**.

`Partial · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.4, CL-2`

**Acceptance criteria**
- [ ] The specialist can auto-notification to casualty MO, duty doctor, and administration from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ MLC flag with auto-police intimation (SMS + system alert)
> As a **specialist**, I want **mlc flag with auto-police intimation (sms + system alert)**.

`Done · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.4, CL-2`

**Acceptance criteria**
- [x] The specialist can mLC flag with auto-police intimation (SMS + system alert) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Timer tracking from arrival to first doctor contact
> As a **specialist**, I want **timer tracking from arrival to first doctor contact**.

`Done · Platforms: Web, Mobile, TV · Source: RFC+ACMSRC · RFC: §3.4, CL-2`

**Acceptance criteria**
- [x] The specialist can timer tracking from arrival to first doctor contact from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Types & Generation

### ✅ General consent (admission), surgical consent, anesthesia consent, blood transfusion consent
> As a **specialist**, I want **general consent (admission), surgical consent, anesthesia consent, blood transfusion consent**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-24 A`

**Acceptance criteria**
- [x] The specialist can general consent (admission), surgical consent, anesthesia consent, blood transfusion consent from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ HIV testing consent, high-risk procedure consent, research consent
> As a **specialist**, I want **hiv testing consent, high-risk procedure consent, research consent**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-24 A`

**Acceptance criteria**
- [x] The specialist can hIV testing consent, high-risk procedure consent, research consent from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Informed refusal documentation (more detailed than consent)
> As a **specialist**, I want **informed refusal documentation (more detailed than consent)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-24 A`

**Acceptance criteria**
- [x] The specialist can informed refusal documentation (more detailed than consent) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ DAMA/LAMA consent with acknowledgment workflow
> As a **specialist**, I want **dama/lama consent with acknowledgment workflow**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-24 A`

**Acceptance criteria**
- [x] The specialist can dAMA/LAMA consent with acknowledgment workflow from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Photography/video consent, teaching/student observation consent
> As a **specialist**, I want **photography/video consent, teaching/student observation consent**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-24 A`

**Acceptance criteria**
- [x] The specialist can photography/video consent, teaching/student observation consent from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ ABDM/ABHA data sharing consent, DPDP Act data processing consent
> As a **specialist**, I want **abdm/abha data sharing consent, dpdp act data processing consent**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-24 A`

**Acceptance criteria**
- [x] The specialist can aBDM/ABHA data sharing consent, DPDP Act data processing consent from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ DNR consent and advance directive recording
> As a **specialist**, I want **dnr consent and advance directive recording**.

`Done · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-24 A`

**Acceptance criteria**
- [x] The specialist can dNR consent and advance directive recording from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Multi-language consent generation (English, Hindi, Tamil, Telugu, etc.)
> As a **specialist**, I want **multi-language consent generation (english, hindi, tamil, telugu, etc.)**.

`Partial · Platforms: Web · Source: ACMSRC · RFC: CL-24 A`

**Acceptance criteria**
- [ ] The specialist can multi-language consent generation (English, Hindi, Tamil, Telugu, etc.) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Read-aloud option for illiterate patients (audio + witness signature)
> As a **specialist**, I want **read-aloud option for illiterate patients (audio + witness signature)**.

`Partial · Platforms: Web · Source: ACMSRC · RFC: CL-24 A`

**Acceptance criteria**
- [ ] The specialist can read-aloud option for illiterate patients (audio + witness signature) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Organ donation consent (THOA compliance)
> As a **specialist**, I want **organ donation consent (thoa compliance)**.

`Done · Platforms: Web · Source: ACMSRC · RFC: CL-24 A`

**Acceptance criteria**
- [x] The specialist can organ donation consent (THOA compliance) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Video Consult

### Video consultation scheduling (patient books slot, doctor confirms)
> As a **specialist**, I want **video consultation scheduling (patient books slot, doctor confirms)**.

`Pending · Platforms: Web, Mobile · Source: MocDoc+RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can video consultation scheduling (patient books slot, doctor confirms) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### WebRTC-based video call with in-browser + mobile support
> As a **specialist**, I want **webrtc-based video call with in-browser + mobile support**.

`Pending · Platforms: Web, Mobile · Source: MocDoc+RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can webRTC-based video call with in-browser + mobile support from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Screen sharing for radiology/lab results during consult
> As a **specialist**, I want **screen sharing for radiology/lab results during consult**.

`Pending · Platforms: Web, Mobile · Source: MocDoc+RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can screen sharing for radiology/lab results during consult from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### E-prescription generation during video consult
> As a **specialist**, I want **e-prescription generation during video consult**.

`Pending · Platforms: Web, Mobile · Source: MocDoc+RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can e-prescription generation during video consult from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Payment collection before/after teleconsultation
> As a **specialist**, I want **payment collection before/after teleconsultation**.

`Pending · Platforms: Web, Mobile · Source: MocDoc+RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can payment collection before/after teleconsultation from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Waiting room with queue position display
> As a **specialist**, I want **waiting room with queue position display**.

`Pending · Platforms: Web, Mobile · Source: MocDoc+RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can waiting room with queue position display from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Recording consent + optional session recording
> As a **specialist**, I want **recording consent + optional session recording**.

`Pending · Platforms: Web, Mobile · Source: MocDoc+RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can recording consent + optional session recording from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Follow-up scheduling from within video session
> As a **specialist**, I want **follow-up scheduling from within video session**.

`Pending · Platforms: Web, Mobile · Source: MocDoc+RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can follow-up scheduling from within video session from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Chat messaging fallback when video not possible
> As a **specialist**, I want **chat messaging fallback when video not possible**.

`Pending · Platforms: Web, Mobile · Source: MocDoc+RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can chat messaging fallback when video not possible from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Integration with EMR — auto-create visit record on call end
> As a **specialist**, I want **integration with emr — auto-create visit record on call end**.

`Pending · Platforms: Web, Mobile · Source: MocDoc+RFC · RFC: §Ext`

**Acceptance criteria**
- [ ] The specialist can integration with EMR — auto-create visit record on call end from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Specialty statutes honoured (e.g. Mental Healthcare Act 2017, MTP/PCPNDT) with consent + NABH documentation.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

