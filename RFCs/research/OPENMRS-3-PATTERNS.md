# OpenMRS 3 (O3) — Patterns to Steal for MedBrains

Research synthesis from O3 docs, the `openmrs-esm-patient-chart` repo, the O3 extension/workspace docs, and OpenMRS Talk threads. The live demo at `https://o3.openmrs.org/openmrs/spa/patient/.../chart/Medications` returns a JS-shell with no SSR markup, so most concrete UI claims below are sourced from the docs and source repos rather than the rendered page.

---

## 1. What OpenMRS 3 gets right

### 1.1 Patient banner as a first-class, sticky, configurable widget
- The patient header sits above all chart content and "uninvasive notifications also appear in this area following actions such as form submissions" (OpenMRS Talk: Responsive patient header design review).
- Visit attributes are explicitly configurable into the banner via JSON (`displayInThePatientBanner: true`) — implementers decide what shows up without code changes (O3 docs — Configuring the Patient Chart).
- Patient flags (allergies, alerts, MLC, custom rules) are surfaced as banner pills; a dedicated `Flags` microfrontend computes and renders them (`openmrs-esm-patient-chart/packages/esm-patient-flags-app`).
- The banner was eventually moved into the `@openmrs/esm-styleguide` so every app shows the same identity (PR O3-2831).

### 1.2 The "Workspace" pattern (slide-in side panel, not a modal)
- A Workspace is "the interactive layer of the Patient Chart. It opens on the right side of the screen on a desktop computer, or in a drawer over the screen on smaller screens" (O3 docs — Workspaces).
- It is "where data entry, form filling, and ordering takes place" — never a full-screen route change. The chart context (banner + nav) stays visible while you act.
- Workspaces can be **stacked, minimized, and resumed**. Multiple unsaved workspaces (e.g. partially filled vitals + an in-progress order) can co-exist; users get a "you have unsaved work" prompt before the workspace can be closed (`@openmrs/esm-framework` `launchWorkspace` API + `useWorkspaces` hook).
- Three styleguide variants (narrow form, standard form, wide tabular) — visual consistency without inventing new layouts per feature.

### 1.3 Patient chart left-nav = data-driven slot system
- Left nav items (Summary, Visits, Allergies, Conditions, Medications, Orders, Results, Forms, Notes, Programs, Immunizations, Attachments, Programs, Tests) are populated from the `patient-chart-dashboard-slot` extension slot. Each module ships its own dashboard registration; admins toggle/group them in JSON (O3 docs — Configuring the Patient Chart).
- Active visit is surfaced as a **persistent banner row beneath the patient header** ("Active visit: OPD started 09:14, Location: Outpatient — End Visit") — clinical actions are scoped to it implicitly (Talk: Difference between Visits and Encounters).

### 1.4 Medications widget — inline row actions, no modal escape hatch
- The medications microfrontend "provides a tabular overview of the active and past medications recorded for a patient" with row-level actions to **modify, renew or discontinue**, plus an **order basket** for new prescriptions (`packages/esm-patient-medications-app` README).
- Active vs. past are split into two tables on the same page; past defaults collapsed.
- The "order basket" is itself a workspace — you can open it, add several drugs across tabs (labs + meds), and submit as one batch; this matches a real visit's mental model.

### 1.5 Visit-scoped encounters
- Every clinical action requires an open Visit. "Start Visit" → modal asks visit type + location → creates a `Visit` row → all subsequent encounters auto-link to it via the **Encounter Visit Handler** (OpenMRS guide — Configuring Visits, VisitService API).
- Auto-close visit setting prevents stale visits from accumulating.
- This is the single biggest UX simplification in O3: there is no "where does this note live?" ambiguity, because the active visit is always the answer.

### 1.6 Form simplicity via the React Form Engine
- `@openmrs/esm-form-engine-lib` is JSON-schema-driven (page → section → question), with conditional rendering, expression-based validation, multilingual labels, and drug/lab-order question types (form-engine-lib README).
- Forms launch **inside a workspace**, not as a route, and most are short (5-10 fields). Rather than one giant OPD consultation form, O3 splits work into many small workspace-scoped forms (vitals, allergy add, condition add, note, order). Sequential, not nested.
- Same engine renders enter/edit/view/embedded modes — no parallel read-only renderer.

### 1.7 Microfrontend boundary (concept, not the implementation)
- Each concern (allergies, conditions, medications, vitals, notes, orders, immunizations, programs, attachments) is a separate npm package with its own build, tests, translations, and config schema.
- Coupling is by **slot name** (string) and shared data via `@openmrs/esm-framework` hooks — never direct imports.
- Single-spa + SystemJS is the runtime, but the **module-boundary discipline** matters more than the runtime mechanism.

### 1.8 CIEL concept dictionary as the source of truth
- Every concept (drug, diagnosis, lab test, finding) is a UUID resolved against CIEL — 54,000 concepts mapped to ICD-10, SNOMED CT, LOINC, RxNORM, CVX, in 18 languages (OpenMRS Wiki — Getting and Using the CIEL Concept Dictionary; OCL).
- Implementers don't invent local masters; they subscribe to CIEL via Open Concept Lab (OCL) and override only what's locally needed.
- A drug picker auto-gives you RxNORM + ATC + WHO INN for free.

### 1.9 Carbon Design System under everything
- All UI primitives come from IBM Carbon — accessibility, density, focus rings, data tables, modals, tabs (O3 academy — The O3 Design System and UI Tools). Each app is forced into the same component vocabulary; visual drift is structurally impossible.

---

## 2. Live-demo observations

Direct fetch of the `/chart/Medications` URL returned only the SPA shell — the page is fully client-rendered behind login. From source, screenshots in the docs (Sonder Collective case study, Designer Onboarding wiki, Talk threads), and the `esm-patient-medications-app` README, the medications tab looks like:

- **Top:** patient banner (name, ID, age/sex, allergy pills, "Active visit" row).
- **Left rail:** dashboard nav (Summary at top, then Visits, Allergies, Conditions, Immunizations, Medications [active], Orders, Results, Forms, Attachments, Programs, Notes).
- **Main pane:** "Active medications" Carbon `DataTable` (drug, dose, frequency, duration, indication, prescriber, status pill). Row overflow menu = Modify / Renew / Discontinue. Below it, a collapsed "Past medications" panel (expand on click).
- **Top-right:** primary button `Add` opens the **Order basket** workspace from the right; you can add multiple drug orders + lab orders, see drug-allergy / dose-range warnings inline, then `Sign and close` to commit them all to the active encounter.

The point isn't pixel detail — it's that the entire screen is **one read view + one action workspace**. No tabs-of-tabs, no nested modals.

---

## 3. MedBrains adoption recommendations

### 3.1 Adopt now (low cost, high value)

| Pattern | Why now | MedBrains shape |
|---|---|---|
| Sticky patient banner with allergy/MLC/flag pills | Banner already exists in scattered form across IPD/OPD/Care View; one component eliminates duplication | Build `<PatientBanner patient flags activeVisit />` in `apps/web/src/components/Patient/`, render at top of `pages/patients/[id].tsx` and inside IPD/OPD encounter screens |
| Workspace = right-side slide-in for data entry | We already use Mantine `Drawer` ad-hoc; formalize it. Stacking + dirty-state + minimize needs explicit primitives | Add `useWorkspace()` Zustand slice in `@medbrains/stores`. One `<WorkspaceHost />` in `AppLayout`. Drawer with `position="right"`, `size="md"`, dirty-state guard (Mantine `useDisclosure` + `confirmOnClose`) |
| Active visit sticky bar | "Where does this note belong?" is currently ambiguous in our code | Add `activeVisitStore` + `<ActiveVisitBar />` shown when an OPD/IPD/Emergency encounter is open. Auto-attach all clinical mutations to `activeVisit.encounterId` |
| Inline row actions on medications/orders/labs | Replaces the modal-per-action pattern | Standard `<RowActionsMenu>` on `DataTable` — already aligns with our DataTable Column convention |
| Split big forms into small workspace-scoped forms | Today's OPD consultation page is one mega-form; users complain | Carve the consultation into: vitals, complaint, exam, diagnosis (ICD-10), prescription (workspace), advice, follow-up. Each opens as a workspace |
| CIEL/SNOMED/LOINC/RxNORM/ICD-10 mapping columns on existing masters | We already have `icd_code` on diagnoses; extend the pattern | Add `loinc_code` to `lab_test_catalog`, `rxnorm_code` + `atc_code` + `inn_name` (already memo'd as MUST in CLAUDE.md) to `pharmacy_catalog`, `snomed_code` to `diagnoses` and `procedures`. Backfill from CIEL via OCL API as a future job |

### 3.2 Defer (valuable but bigger lift)

- **Extension/slot system** — building a real slot registry is 2-3 sprints of plumbing. We don't need it until 3+ parties extend the same screen. Today our nav is data-driven (`config/navigation.ts`) which is 80% of the value.
- **JSON form engine** — `@medbrains/expressions` is the right place for this; we already have the rules-engine half. Wait until at least 5 forms exist that obviously want it before generalizing. Do not adopt `esm-form-engine-lib` directly (Carbon-coupled).
- **Order basket** that batches orders across modules (drug + lab + radiology + diet) — high clinical value, but only after individual order workspaces exist.
- **Visit auto-close task** — Rust scheduler job that closes visits with no encounters in 24h. Easy, but not urgent until visit data is bigger.

### 3.3 Skip / over-engineered for our stack

- **single-spa + SystemJS** — Turborepo + React Router lazy routes already give us module boundaries with zero runtime overhead. Adopting single-spa would re-architect the whole web app for ~no user-visible benefit.
- **Carbon Design System** — Mantine v7 + Forest+Copper is locked and ahead of where Carbon is on visual identity. Steal Carbon's *patterns* (data table density, banner anatomy) without swapping the library.
- **OCL as a runtime dependency** — keep CIEL as a *seed/import source*, not a live API call. OCL latency and uptime aren't acceptable for prescription validation.
- **Patient Flags v1 module's regex/SQL approach** — our automation hub + rules engine is already more capable. We'd be downgrading.

---

## 4. Concrete suggestions per MedBrains page

### 4.1 `apps/web/src/pages/patients/[id].tsx` (patient chart)
- Replace current per-page banner usages with a single `<PatientBanner />` component fed from a `usePatient(id)` query. Pin via `position: sticky; top: 0; z-index: 100;` SCSS.
- Below banner, add `<ActiveVisitBar />` — only renders when `useActiveVisit(patientId)` returns non-null. Buttons: `End Visit`, `Switch Encounter`, `View Visit Summary`.
- Left rail = data-driven from a new `PATIENT_CHART_TABS` config (mirrors `NAV_GROUPS`): Summary, Visits, Allergies, Conditions, Medications, Orders (Lab/Rad/Procedure), Results, Forms, Notes, Programs, Documents.
- Main pane uses `<Outlet />` and React Router child routes — `/patients/:id/chart/medications` etc.

### 4.2 Medications inside IPD/OPD encounter
- Build `PrescriptionTable` with Carbon-style row overflow menu: `Modify`, `Renew`, `Discontinue`, `Print`. Each opens the **Prescription workspace** with the row pre-filled.
- Active vs Past = two `<Accordion>` items, Past collapsed by default.
- Add LASA / drug-allergy / dose-range warnings inline as a yellow `<Banner>` *inside the workspace*, not as a blocking modal — clinician sees + confirms in flow.
- Order basket: a workspace that holds N drug orders + N lab orders + N rad orders, all signed atomically. Use existing `orchestration` module to commit as a transaction.

### 4.3 Visit workflow
- Today: scattered "create encounter" buttons. Target: one `Start Visit` button on patient chart → modal (visit type, department, location, billing class) → creates `visits` row → sets `activeVisitStore` → all subsequent actions auto-stamp `visit_id`.
- Add `End Visit` button on `<ActiveVisitBar />`. Confirmation listing what was done in the visit (vitals, orders, notes counts).
- Backend: Rust scheduler closes visits older than 24h with no recent activity (matches OpenMRS auto-close).

### 4.4 Form simplification
- Today's OPD consultation is one giant form. Break it into:
  1. `Vitals` workspace (existing — keep)
  2. `Chief Complaint + HPI` workspace
  3. `Examination` workspace (template-driven)
  4. `Diagnosis` workspace (ICD-10 picker)
  5. `Prescription` workspace (drug picker + order basket)
  6. `Investigations` workspace (lab + radiology)
  7. `Advice + Follow-up` workspace
- Each workspace ≤ 10 fields, posts immediately to its endpoint, doesn't block the others. Saved drafts kept in `activeVisitStore`.
- Validation stays Zod + RHF (do not import O3's form engine).

### 4.5 Banner flag rules
- Hook `usePatientFlags(patientId)` returns `{ allergies, mlc, vipFlag, infectious, ndpsHistory, financialHold, ... }`.
- Backend: a `patient_flags_view` PostgreSQL view aggregating from allergy table, MLC table, financial-hold flag on `patients.access_matrix`, etc. Cheap, refreshes on read.

---

## 5. Where MedBrains is already ahead of OpenMRS 3

Be honest about this — these are real differentiators worth defending:

| Capability | MedBrains | OpenMRS 3 |
|---|---|---|
| Multi-tenancy | First-class (`tenant_id` + transaction-scoped RLS on every table) | Single-tenant; multi-tenancy is a forked-deployment problem |
| Row-level security | PostgreSQL RLS, set per-request | App-layer access checks |
| Permission system | 111 typed permissions, role + per-user override (`access_matrix.extra/denied`) | Privilege strings, simpler |
| Regulatory/compliance built-in | NDPS register, PCPNDT, ADR/PvPI, materiovigilance, NABL, NABH dashboards | Mostly module add-ons |
| Workflow + automation hub | Rules engine + orchestration + integration builder + node graph | Encounter Visit Handlers + form schema |
| Billing depth | Universal billing, GST/TDS/GSTR, journal entries, bank recon, financial MIS, P&L by dept | Bahmni/odoo bolt-on |
| Modules outside clinical core | CSSD, BMW, MGPS, fire safety, water/energy, camp management, HR, facilities, queue/visitor | Not in the reference distribution |
| Design identity | Forest+Copper, Fraunces+Inter Tight+JetBrains Mono, ECG loader signature | IBM Carbon — competent but generic |
| Type/contract safety | `make check-api` + `check-ui-api` + `check-types` enforces frontend↔backend match | Not enforced |
| Indian regulatory coverage | NDPS, PCPNDT, MTP, MHCA, BMW, GST, AERB, ABDM | Not localized for India |

The takeaway: **adopt O3's chart UX patterns, don't adopt its scope or stack.** OpenMRS 3 is good at "one patient, one visit, one form." MedBrains has to be good at that *and* run a hospital's books, regulators, and infrastructure.

---

## 6. Concrete tickets (post Sprint A)

Prioritized for cumulative user-visible improvement. Each is sized to ≤ 1 sprint.

1. **[P0] Patient banner unification** — Build `<PatientBanner />` + `usePatientFlags()`. Render in `patients/[id].tsx`, IPD admission view, OPD encounter view, Care View, Emergency. Delete duplicated banner code. *(~3 days)*

2. **[P0] Workspace primitive** — `useWorkspace()` Zustand slice + `<WorkspaceHost />` + dirty-state guard + minimize-to-tray. Migrate 3 existing drawers (vitals, allergy add, prescription) to it as proof. *(~5 days)*

3. **[P0] Active visit store + sticky bar** — `activeVisitStore`, `<ActiveVisitBar />`, `useStartVisit` / `useEndVisit` hooks. Wire OPD + IPD + Emergency to set/clear it. Backend scheduler for auto-close. *(~5 days)*

4. **[P1] Patient chart left-rail config** — Move chart sub-routes to `config/patient-chart-tabs.ts` mirroring `NAV_GROUPS`. Permission-filtered tab list. *(~2 days)*

5. **[P1] Inline row-action menu standard** — `<RowActionsMenu>` component + adopt across medications, orders, labs, prescriptions tables. *(~2 days)*

6. **[P1] OPD consultation form split** — Refactor mega-form into 7 workspace-scoped sub-forms, each posting independently. Drafts persisted in `activeVisitStore`. *(~1 sprint)*

7. **[P2] Order basket** — Cross-module batched orders (drug + lab + rad + procedure) signed atomically via orchestration. *(~1 sprint)*

8. **[P2] CIEL/SNOMED/LOINC/RxNORM seed** — Add code columns to `pharmacy_catalog` (rxnorm/atc/inn — partially memoed), `lab_test_catalog` (loinc), `diagnoses` (snomed), `procedures` (snomed). One-time import job from OCL CIEL dump. *(~1 sprint)*

9. **[P3] Drug-interaction + LASA inline warnings** — Computed in prescription workspace, displayed as non-blocking warnings. Requires CIEL/RxNORM seed first. *(~1 sprint)*

10. **[P3] Visit summary print/export** — On End Visit, generate a one-page summary (vitals, dx, rx, investigations, advice). *(~3 days)*

---

## Sources

- [O3 Docs landing](https://o3-docs.openmrs.org/)
- [O3 Docs — Workspaces](https://o3-docs.openmrs.org/docs/workspaces/workspaces) (404 currently — content cited from search snippets and Talk thread)
- [O3 Docs — Configuring the Patient Chart](https://o3-docs.openmrs.org/docs/configure-o3/configure-the-patient-chart)
- [O3 Docs — The extension system](https://o3-docs.openmrs.org/docs/extension-system)
- [O3 Docs — The Configuration System](https://o3-docs.openmrs.org/docs/configuration-system)
- [openmrs-esm-patient-chart (GitHub)](https://github.com/openmrs/openmrs-esm-patient-chart)
- [openmrs-esm-form-engine-lib (GitHub)](https://github.com/openmrs/openmrs-esm-form-engine-lib)
- [openmrs-esm-core (GitHub)](https://github.com/openmrs/openmrs-esm-core)
- [O3 Design System and UI Tools](https://openmrs.org/academy/intro-to-openmrs-3/lesson/the-o3-design-system-and-ui-tools/)
- [Sonder Collective — OpenMRS 3.x case study](https://www.sonderdesign.org/projects/openmrs-3-x)
- [Designer Onboarding to OpenMRS 3](https://openmrs.atlassian.net/wiki/spaces/docs/pages/26938255/Designer+Onboarding+to+OpenMRS+3)
- [Workspaces in O3 — Talk thread](https://talk.openmrs.org/t/workspaces-in-o3/48735)
- [Responsive patient header design review — Talk](https://talk.openmrs.org/t/responsive-patient-header-design-review/29226)
- [O3: Plan for Patient Tags / Flags? — Talk](https://talk.openmrs.org/t/o3-plan-for-patient-tags-flags/36501)
- [Configuring Visits — OpenMRS Guide](https://guide.openmrs.org/configuration/configuring-visits/)
- [OpenMRS Information Model](https://guide.openmrs.org/getting-started/openmrs-information-model/)
- [Getting and Using the CIEL Concept Dictionary](https://openmrs.atlassian.net/wiki/spaces/docs/pages/25470028/Getting+and+Using+the+CIEL+Concept+Dictionary)
- [Open Concept Lab — CIEL org](https://app.openconceptlab.org/#/orgs/CIEL)
- [Carbon design component ui — Talk](https://talk.openmrs.org/t/carbon-design-component-ui/35720)
- [PR O3-2831 Move patient banner into styleguide](https://github.com/openmrs/openmrs-esm-patient-chart/pull/1645)
