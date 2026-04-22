# CLAUDE.md — MedBrains Hospital Management System

## Project Overview

MedBrains is a multi-tenant Hospital Management System (HMS) covering 67+ modules across clinical, administrative, financial, and infrastructure domains. The system follows a 7-layer configuration architecture with hierarchical data storage.

**Always consult the RFC documents before making domain, architectural, or tech stack decisions.**

---

## RFC Documents

All RFCs live in `RFCs/` at the project root.

| File | Description |
|------|-------------|
| `RFC-HMS-2026-001.docx` | **Core HMS specification** — 67 modules, 7-layer configuration architecture, multi-tenant design |
| `RFC-HMS-2026-UNIFIED-v2.docx` | **Unified v2 specification** — consolidated module definitions and integration patterns |
| `RFC-HMS-2026-002-Workflows.docx` / `.pdf` | **Workflows** — 120+ workflow templates, cross-module automation, form builder, rules engine |
| `RFC-HMS-v2.1-Continuation.pdf` | **Extended modules** — Psychiatry, Infrastructure, Patient Experience, Medical College; full module inventory |
| `RFC-HMS-2026-003-TechStack (1).docx` | **Tech stack DRAFT** — detailed dev standards, clippy rules, CI/CD gates, SQLx strategy |
| `RFC-HMS-2026-003-TechStack (2).docx` | **Tech stack APPROVED** — finalized stack decisions (Mantine v7, React Native CLI + Paper v5, pnpm + Turborepo) |
| `ACMSRC_HMS_Evaluation_Checklists.docx` | **Evaluation checklists** — 34 department checklists, 700+ criteria from NABH/JCI standards |

### RFC Priority

**RFC-003 "TechStack (2)" is the APPROVED version.** When the two TechStack RFCs conflict, always follow File 2 (APPROVED). File 1 is a superseded draft.

### Known Conflicts Between RFC Versions

| Decision | APPROVED (File 2) | DRAFT (File 1) |
|----------|-------------------|----------------|
| Web UI library | Mantine v7 | Shadcn/UI + Tailwind CSS 4 |
| Mobile framework | React Native CLI (bare) + Paper v5 | React Native Expo |
| TV displays | React Native (Android TV) | React Native for TV (same direction) |
| Monorepo tools | pnpm + Turborepo | Not specified |
| Linting (JS/TS) | ESLint + Prettier (overridden — using Biome) | ESLint (mentioned) |

---

## Tech Stack (Canonical — per APPROVED RFC)

### Backend

| Layer | Technology |
|-------|------------|
| Language | Rust (edition 2024, MSRV 1.85) |
| Web framework | Axum 0.8 + Tower 0.5 |
| Async runtime | Tokio (full features) |
| Serialization | serde + serde_json |
| Error handling | thiserror (library crates), anyhow (application edges) |
| Logging | tracing + tracing-subscriber (structured, JSON) |
| Auth | jsonwebtoken (JWT), argon2 (password hashing) |

### Databases

| Database | Purpose |
|----------|---------|
| PostgreSQL 16+ | Primary relational store — tenants, users, patients, departments, workflows |
| YottaDB | Hierarchical clinical data — config trees, sequences, real-time bed state, sessions |
| Redis / Dragonfly | Cache layer (future) |
| Meilisearch | Full-text search (future) |
| NATS JetStream | Event streaming (future) |

### SQL

- **SQLx** with **runtime queries** (`sqlx::query_as::<_, T>()`) — avoids compile-time DB dependency
- All types derive `FromRow` for strong typing
- Transaction-scoped RLS: `set_tenant_context(&mut tx, tenant_id)` per request
- Migrations via `sqlx::migrate!()` embedded at compile time.

### Web Frontend

| Layer | Technology |
|-------|------------|
| Framework | React 18 + TypeScript |
| Bundler | Vite |
| UI library | **Mantine v7** |
| Styling | **SCSS** (no Tailwind, no CSS-in-JS) |
| Routing | React Router v7 |
| Server state | TanStack Query v5 |
| Client state | Zustand |
| Forms | React Hook Form + Zod |
| Linting | **Biome** (lint + format) |

### Mobile

| Layer | Technology |
|-------|------------|
| Framework | React Native CLI (bare workflow, New Architecture) |
| UI library | React Native Paper v5 |
| Navigation | React Navigation v7 |
| Offline storage | WatermelonDB |

### TV Displays

| Layer | Technology |
|-------|------------|
| Framework | React Native (Android TV target) |
| Real-time | WebSocket-driven updates |

### Monorepo

| Tool | Purpose |
|------|---------|
| pnpm | Package manager (all JS/TS packages) |
| Turborepo | Build orchestration, caching |
| Shared packages | `@medbrains/schemas`, `@medbrains/types`, `@medbrains/api`, `@medbrains/stores`, `@medbrains/utils` |

---

## Current Codebase vs APPROVED RFC

The codebase is being aligned to the APPROVED RFC. Known divergences:

| Current | RFC Target | Status |
|---------|------------|--------|
| React Router v7 | React Router v7 | Aligned |
| Mantine v7 + SCSS | Mantine v7 + SCSS | Aligned |
| Biome | Biome | Aligned |
| pnpm | pnpm | Aligned |
| Zustand | Zustand | Aligned |
| TanStack Query v5 | TanStack Query v5 | Aligned |
| Axum 0.8 + SQLx | Axum 0.8 + SQLx | Aligned |

---

## Project Structure

```
medbrains/
├── Cargo.toml                    # Rust workspace root
├── rust-toolchain.toml           # Stable toolchain + clippy + rustfmt
├── rustfmt.toml                  # Formatting rules
├── docker-compose.yml            # PostgreSQL 16 + YottaDB
├── .env / .env.example           # Environment configuration
├── MedBrains_Features.xlsx       # Master feature tracker (2,030+ features)
├── RFCs/                         # Specification documents
│   ├── RFC-HMS-2026-001.docx     # Core HMS specification
│   ├── RFC-HMS-2026-002-*.docx   # Workflows
│   ├── RFC-HMS-2026-003-*.docx   # Tech stack
│   └── modules/                  # Per-module RFCs
│       └── RFC-MODULE-onboarding.md  # Onboarding & Setup (IN PROGRESS)
├── crates/
│   ├── medbrains-core/           # Domain types — zero framework deps
│   ├── medbrains-db/             # PostgreSQL via SQLx, migrations, audit
│   ├── medbrains-yottadb/        # YottaDB REST client (Phase 2)
│   └── medbrains-server/         # Axum HTTP server, routes, middleware
├── apps/
│   ├── web/                      # React 18 + Mantine v7 + SCSS
│   ├── mobile/                   # React Native CLI + Paper v5 (skeleton)
│   └── tv/                       # React Native Android TV (skeleton)
└── packages/
    ├── types/                    # Shared TypeScript interfaces
    ├── api/                      # HTTP client (auth methods only currently)
    ├── stores/                   # Zustand auth store + TanStack Query client
    ├── schemas/                  # Zod schemas (placeholder)
    └── utils/                    # Utilities (placeholder)
```

---

## Coding Standards

### Rust

- **Edition 2024**, minimum Rust version **1.85**
- `unsafe` code is **forbidden**
- **Strict clippy** — `clippy::all` denied, `clippy::pedantic` + `clippy::nursery` warned
- The following are **denied** (will not compile):
  - `unwrap_used`, `expect_used`, `panic`, `todo`, `unimplemented`
  - `dbg_macro`, `print_stdout`, `print_stderr`
  - `wildcard_imports`, `string_to_string`, `clone_on_ref_ptr`
- Use `?` operator for error propagation. Return `Result<T, E>` from fallible functions.
- Use `thiserror` for defining error types. Use `anyhow` only at application boundaries (main, route handlers).
- Format with `cargo fmt` (rustfmt.toml enforces max_width=100, Unix newlines, crate-level import grouping).

### SQL

- **All queries must be compile-time verified** via `sqlx::query!()` or `sqlx::query_as!()`.
- Every tenant-scoped table has `tenant_id` column with Row-Level Security (RLS).
- Set tenant context per request: `SET LOCAL app.tenant_id = $1`.

### TypeScript / React

- Strict TypeScript (`strict: true`)
- **Biome** for linting and formatting (`biome check`, `biome format`)
- Mantine v7 components — do not use raw HTML elements when a Mantine component exists
- SCSS modules for custom styling
- All API calls through TanStack Query — no raw `fetch` in components
- Zod schemas for runtime validation of API responses

### Dead Code & Cleanup Rules

- **Remove dead code immediately** — do not leave unused imports, variables, functions, types, or commented-out code. If something is no longer referenced, delete it.
- **No backwards-compatibility shims** — do not rename unused variables with `_` prefix, re-export removed types, or add `// removed` comments. Just delete.
- **No speculative code** — do not add code "for later". If it's not used right now, it doesn't belong.

### API Contract Rule

- **Every API method** added to `packages/api/src/client.ts` MUST have a corresponding route handler in the backend `routes/mod.rs`.
- **Every route** added to `routes/mod.rs` MUST have a corresponding API method in the frontend `client.ts`.
- Run `make check-api` to verify. This is a blocking check — no module is complete until the contract passes.
- The script (`scripts/check_api_contract.py`) statically parses both files — no running server required.

### useEffect Policy

- **Avoid `useEffect` unless absolutely necessary.** Most state synchronization can be handled declaratively.
- **Allowed uses**: external system integration (WebSocket listeners, DOM event listeners, third-party library init), one-time setup on mount (`useEffectOnce` from `react-use`).
- **Prefer `useEffectOnce`** (from `react-use`) over `useEffect(() => { ... }, [])` for mount-only side effects.
- **Never use `useEffect` for**: derived state (use `useMemo` or compute inline), state sync between React state variables (lift state up or use a single source of truth), data fetching (use TanStack Query), navigation side effects (use React Router loaders/actions or event handlers).
- When tempted to write `useEffect`, first ask: "Can this be an event handler, a `useMemo`, or a TanStack Query instead?"

---

## Senior Architect Guidelines

**This codebase must be built to the standards of a senior or principal software architect.** Every file, function, and component should demonstrate professional craftsmanship, foresight, and attention to detail.

### Architectural Mindset

1. **Think in systems, not features** — Before implementing anything, understand how it fits into the larger system. Consider data flow, dependencies, failure modes, and scaling implications.

2. **Design for change** — Healthcare requirements evolve. Build abstractions at the right level — not too early (YAGNI), not too late (technical debt).

3. **Optimize for readability** — Code is read 10x more than it's written. Optimize for the next developer (who may be you in 6 months).

4. **Single Responsibility at every level** — Files, functions, components, and modules should each do one thing well.

### Code Quality Standards

#### Naming Conventions

- **Functions**: verb + noun — `createPatient`, `validatePrescription`, `calculateBillTotal`
- **Booleans**: `is`/`has`/`can`/`should` prefix — `isActive`, `hasInsurance`, `canPrescribe`
- **Collections**: plural nouns — `patients`, `labOrders`, `vitals`
- **Handlers**: `on` + event — `onSubmit`, `onPatientSelect`, `onClose`
- **Hooks**: `use` prefix — `usePatientSearch`, `useQueuePolling`
- **Constants**: SCREAMING_SNAKE_CASE — `MAX_RETRIES`, `DEFAULT_PAGE_SIZE`
- **Types/Interfaces**: PascalCase, no `I` prefix — `Patient`, `LabOrder`, `BillingConfig`

#### Function Design

- **Maximum 20 lines** per function (excluding type definitions). If longer, extract helper functions.
- **Maximum 3 parameters**. If more, use an options object: `createOrder({ patientId, items, priority })`
- **Early returns** for guard clauses — reduce nesting, improve readability
- **Pure functions** where possible — same input always produces same output, no side effects
- **Explicit error handling** — never swallow errors silently; log and rethrow or handle gracefully

```typescript
// Good: Early returns, clear flow
function getPatientStatus(patient: Patient): string {
  if (!patient.isActive) return "Inactive";
  if (patient.currentAdmission) return "Admitted";
  if (patient.hasAppointmentToday) return "Scheduled";
  return "Registered";
}

// Bad: Nested conditionals, hard to follow
function getPatientStatus(patient: Patient): string {
  if (patient.isActive) {
    if (patient.currentAdmission) {
      return "Admitted";
    } else {
      if (patient.hasAppointmentToday) {
        return "Scheduled";
      } else {
        return "Registered";
      }
    }
  } else {
    return "Inactive";
  }
}
```

#### Component Design (React)

- **One component per file** — except for tightly coupled internal components
- **Props interface at top** — clearly document what the component accepts
- **Destructure props** — improves readability and makes dependencies explicit
- **Separate concerns**: data fetching (hooks) → presentation (components) → styling (SCSS)
- **Memoize expensive computations** — `useMemo` for derived data, `useCallback` for stable references

```typescript
// Good: Clear structure, typed props, single responsibility
interface PatientCardProps {
  patient: Patient;
  onSelect?: (patient: Patient) => void;
  showActions?: boolean;
}

export function PatientCard({ patient, onSelect, showActions = true }: PatientCardProps) {
  const fullName = `${patient.firstName} ${patient.lastName}`;

  return (
    <Card onClick={() => onSelect?.(patient)}>
      <Text fw={600}>{fullName}</Text>
      <Text c="dimmed">{patient.uhid}</Text>
      {showActions && <PatientCardActions patient={patient} />}
    </Card>
  );
}
```

#### API Design (Backend)

- **RESTful resource naming** — `/patients`, `/patients/{id}`, `/patients/{id}/visits`
- **Consistent response structure** — always return `{ data, meta }` or `{ error, details }`
- **Pagination on all list endpoints** — `?page=1&per_page=20`, return total count in meta
- **Idempotent operations** — PUT/DELETE should be safe to retry
- **Meaningful HTTP status codes** — 200 OK, 201 Created, 400 Bad Request, 404 Not Found, 422 Validation Error

#### Error Handling

- **Typed errors** — Use `thiserror` enums in Rust, typed error classes in TypeScript
- **User-friendly messages** — Technical details for logs, human-readable messages for UI
- **Graceful degradation** — Show cached data if network fails, partial results if one sub-query fails
- **Never expose stack traces** — Log full error, return sanitized message to client

### Patterns to Follow

| Pattern | When to Use | Example |
|---------|-------------|---------|
| **Repository pattern** | Data access abstraction | `PatientRepository.findById(id)` |
| **Service layer** | Business logic orchestration | `PrescriptionService.createWithValidation()` |
| **Factory pattern** | Complex object creation | `LabOrderFactory.fromTemplate(template)` |
| **Strategy pattern** | Swappable algorithms | `BillingCalculator.withStrategy(insuranceStrategy)` |
| **Observer pattern** | Event-driven updates | WebSocket subscriptions, queue updates |
| **Composition over inheritance** | Code reuse | React hooks, Rust traits |

### Patterns to Avoid

| Anti-Pattern | Why It's Bad | Better Approach |
|--------------|--------------|-----------------|
| **God objects** | Single class doing everything | Split into focused services |
| **Prop drilling** | Passing props through many layers | Context, Zustand, or composition |
| **Premature optimization** | Optimizing before measuring | Profile first, optimize bottlenecks |
| **Magic numbers/strings** | Hard-coded values scattered | Named constants, config files |
| **Copy-paste code** | Duplicated logic | Extract shared utilities |
| **Deep nesting** | Hard to read and test | Early returns, extract functions |

### Code Review Checklist

Before considering any code complete, verify:

- [ ] **Types are explicit** — No `any`, no implicit returns, no untyped parameters
- [ ] **Errors are handled** — Every async operation has error handling
- [ ] **Edge cases covered** — Empty states, loading states, error states
- [ ] **No console.log** — Use proper logging or remove debug statements
- [ ] **No commented code** — Delete it; git preserves history
- [ ] **No TODO comments** — Create a ticket or fix it now
- [ ] **Tests exist** — Critical paths have test coverage
- [ ] **Documentation updated** — API changes reflected in types and comments
- [ ] **Security considered** — Input validation, SQL injection prevention, XSS protection
- [ ] **Performance acceptable** — No N+1 queries, reasonable bundle size, lazy loading where appropriate

### Technical Debt Management

- **Fix as you go** — If you touch a file, improve it incrementally (Boy Scout Rule)
- **Document known issues** — If you must defer a fix, create a GitHub issue with context
- **Never increase debt** — New code must meet standards; no "we'll fix it later"
- **Refactor in small steps** — Large rewrites are risky; prefer incremental improvements

---

### Testing Rules

- **Static checks** (`make check-all`): Must pass before a module is considered complete.
  Includes: `check-api` (path matching), `check-ui-api` (page↔method coverage), `check-types` (field contracts).
- **Smoke tests** (`make smoke-test`): Run against a live dev server after adding new endpoints.
  Auto-generated — re-run `make generate-smoke` after adding API methods.
- **E2E tests**: Each major module should have at least one E2E scenario test.
  Skeletons generated via `make generate-e2e` — fill in assertions manually.
- **Test helpers**: Shared helpers in `apps/web/e2e/helpers.ts` — `routeApiDirect()`, `ensureAuthenticated()`, `navigateTo()`, `getAuthToken()`.
- **Generated files**: Smoke test specs (`e2e/smoke/*.smoke.spec.ts`) are auto-generated and gitignored. Do not edit them directly — modify the generator script instead.

---

## Permission-Based UI Patterns

The system uses a multi-layer permission architecture. Every page and action must follow these patterns.

### Permission Definitions

- **Single source of truth**: `packages/types/src/permissions.ts`
- **111 permissions** across 8 modules: dashboard, patients, opd, lab, pharmacy, billing, ipd, admin
- **Typed constant**: Import `P` for autocomplete — `P.ADMIN.USERS.CREATE` instead of `"admin.users.create"`
- **Hierarchical codes**: dot-separated — `module.resource.action` (e.g., `admin.users.create`, `opd.visit.update`)

### Permission Store (Zustand)

- **Store**: `packages/stores/src/permission-store.ts` — `usePermissionStore`
- **Bypass roles**: `super_admin` and `hospital_admin` return `true` for ALL permission checks
- **Loaded on login**: `ProtectedRoute` calls `GET /auth/me` → `setPermissions(role, permissions[])`
- **Resolution formula**: `effective = (role_permissions ∪ user.access_matrix.extra) − user.access_matrix.denied`

### Page-Level Guards

Every page component MUST call `useRequirePermission()` at the top. This redirects unauthorized users to `/dashboard`.

```tsx
export function UsersPage() {
  useRequirePermission(P.ADMIN.USERS.LIST);  // guard — redirects if denied
  // ... rest of page
}
```

- **Hook**: `apps/web/src/hooks/useRequirePermission.ts`
- **One permission per page** — use the `.LIST` or `.VIEW` permission for the module

### Element-Level Visibility

Use `useHasPermission()` to conditionally show/hide buttons, action icons, and form elements:

```tsx
const canCreate = useHasPermission(P.ADMIN.USERS.CREATE);
const canUpdate = useHasPermission(P.ADMIN.USERS.UPDATE);
const canDelete = useHasPermission(P.ADMIN.USERS.DELETE);

// Conditionally render
{canCreate && <Button>Add User</Button>}
{canUpdate && <ActionIcon><IconPencil /></ActionIcon>}
{canDelete && <ActionIcon color="red"><IconTrash /></ActionIcon>}
```

**Available hooks** (from `@medbrains/stores`):

| Hook | Purpose |
|------|---------|
| `useHasPermission(code)` | Check single permission |
| `useHasAllPermissions(codes[])` | Check ALL required (AND) |
| `useHasAnyPermission(codes[])` | Check ANY sufficient (OR) |

### Standard Page Pattern

Every module page follows this structure:

```tsx
export function ModulePage() {
  // 1. Page guard
  useRequirePermission(P.MODULE.LIST);

  // 2. Element-level permissions
  const canCreate = useHasPermission(P.MODULE.CREATE);
  const canUpdate = useHasPermission(P.MODULE.UPDATE);
  const canDelete = useHasPermission(P.MODULE.DELETE);

  // 3. Data queries
  const { data, isLoading } = useQuery({ queryKey: [...], queryFn: ... });

  // 4. Page layout with PageHeader (actions gated)
  return (
    <div>
      <PageHeader
        title="Module Name"
        subtitle="Description"
        actions={canCreate ? <Button>Add</Button> : undefined}
      />
      <DataTable columns={columns} data={data} ... />
      {/* Modals/Drawers for CRUD */}
    </div>
  );
}
```

### Permission Tree UI (Admin Pages)

For role/user permission editing, use the `PermissionGroupNode` component pattern:

- **`buildPermissionTree(PERMISSIONS)`** converts flat permission codes into a hierarchical accordion tree
- **`PermissionGroupNode`** renders recursive accordions with checkboxes, select-all, filter, and count badges
- Used in: `admin/roles.tsx` (role permission editor) and `admin/users.tsx` (per-user override drawer)
- **Per-user overrides**: `UserPermissionOverrideDrawer` has two sections — Extra Permissions (green) and Denied Permissions (red)

### Built-In Roles & Seeding

- **11 built-in roles** are seeded into the `roles` table with `is_system = true` on tenant creation
- Permissions for each role are defined in `crates/medbrains-server/src/seed.rs` (must stay in sync with frontend `ROLE_TEMPLATES`)
- **Bypass roles** (super_admin, hospital_admin): stored with empty permissions array — the frontend/backend bypasses checks entirely
- **Custom roles**: created via Admin → Roles page, stored in `roles` table, permissions editable via accordion tree

### Backend Permission Checks

- **Route-level**: `require_permission(&claims, "admin.users.list")?;` — returns 403 if denied
- **Permission resolution** (`routes/auth.rs:resolve_permissions`): queries `roles` table for role permissions, then applies `users.access_matrix` overrides (extra/denied)

---

## When to Consult RFCs

- **Module specifications** (what a module does, its entities, its workflows) → `RFC-HMS-2026-001.docx`, `RFC-HMS-2026-UNIFIED-v2.docx`
- **Workflow design** (step sequences, form builders, automation rules) → `RFC-HMS-2026-002-Workflows.docx`
- **Extended/specialty modules** (Psychiatry, Medical College, Patient Experience) → `RFC-HMS-v2.1-Continuation.pdf`
- **Tech stack decisions** (libraries, tools, CI/CD, deployment) → `RFC-HMS-2026-003-TechStack (2).docx` (APPROVED)
- **Quality/compliance criteria** (NABH, JCI, department checklists) → `ACMSRC_HMS_Evaluation_Checklists.docx`

---

## Regulatory & Compliance Norms (MANDATORY)

**Before implementing ANY feature, you MUST check applicable regulatory norms, industry standards, and legal requirements.** This is not optional — a Hospital Management System operates in a heavily regulated domain. Non-compliance can result in legal liability, failed accreditation, and patient safety risks.

### Pre-Implementation Checklist

For EVERY feature, before writing code, answer these questions:

1. **Legal requirements**: Does this feature fall under any Indian law or regulation?
   - NDPS Act 1985 (narcotic/psychotropic substances)
   - Drugs and Cosmetics Act 1940 (drug scheduling, labeling, storage)
   - CDSCO rules (Schedule H, H1, X, G classification)
   - Clinical Establishments Act 2010
   - PNDT Act (Pre-Conception and Pre-Natal Diagnostic Techniques)
   - MTP Act (Medical Termination of Pregnancy)
   - Mental Healthcare Act 2017
   - Biomedical Waste Management Rules 2016
   - PCPNDT Act (sex determination prohibition)
   - Consumer Protection Act 2019 (patient rights)

2. **Accreditation standards**: Does NABH/JCI mandate specific behavior?
   - Check `ACMSRC_HMS_Evaluation_Checklists.docx` for the relevant department
   - 34 department checklists, 700+ criteria cover most clinical and admin workflows
   - Key standards: patient identification, medication safety, infection control, informed consent

3. **Clinical coding standards**: Does this feature handle clinical terminology?
   - **Drug names**: Use WHO INN (International Nonproprietary Names) as canonical generic name
   - **Drug classification**: WHO ATC (Anatomical Therapeutic Chemical) classification system
   - **Drug codes**: RxNorm (US NLM), SNOMED CT for interoperability
   - **Diagnosis codes**: ICD-10 / ICD-11 (WHO International Classification of Diseases)
   - **Procedure codes**: CPT, ICD-10-PCS, or NABH-specified coding
   - **Lab tests**: LOINC (Logical Observation Identifiers Names and Codes)

4. **Pharmacology norms** (for ANY drug/medication feature):
   - **Drug scheduling**: Every drug must carry its CDSCO schedule (H, H1, X, G, OTC)
   - **NDPS compliance**: Controlled substances need separate register, dual-lock tracking, consumption logs
   - **Formulary control**: Hospital formulary (approved drug list) with DTC approval workflow
   - **Antibiotic stewardship**: WHO AWaRe classification (Access/Watch/Reserve) for antimicrobials
   - **Drug interactions**: Drug-drug interaction checks before prescribing/dispensing
   - **Allergy cross-check**: Patient allergy history vs drug class matching
   - **LASA flags**: Look-Alike Sound-Alike drug warnings
   - **Dose validation**: Min/max dose ranges by age, weight, renal/hepatic function
   - **Batch/lot tracking**: Traceability from procurement to patient administration
   - **Expiry management**: FEFO (First Expiry First Out) enforcement

5. **Data standards & interoperability**:
   - **HL7 FHIR R4**: Structure clinical resources for export/import compatibility
   - **ABDM (Ayushman Bharat Digital Mission)**: Health ID, health records exchange
   - **DICOM**: Medical imaging data format
   - **HL7 v2**: Legacy integration with lab instruments, radiology

6. **Patient safety standards**:
   - **IPSG (International Patient Safety Goals)**: Patient identification, medication safety, surgical safety, fall prevention, infection prevention, communication
   - **Informed consent**: Document type, witness requirements, language considerations
   - **Incident reporting**: Near-miss and adverse event tracking requirements

### How to Apply

- **Step 0 in Module Build Workflow**: Before Step 1, research applicable norms for the module
- **Database design**: Include regulatory fields from the start (don't bolt on later)
  - Example: `pharmacy_catalog` must have `drug_schedule`, `is_controlled`, `inn_name`, `atc_code` columns
  - Example: `lab_test_catalog` should have `loinc_code` column
  - Example: `diagnoses` table already has `icd_code` — this is correct
- **Frontend**: Show regulatory badges/warnings (Schedule H badge, controlled substance icon, LASA warning)
- **Business rules**: Enforce at backend level (reject Schedule X prescription without duplicate record, block NDPS dispensing without register entry)
- **Audit trail**: All regulatory actions must be logged (who prescribed, who dispensed, who witnessed)

### Domain-Specific Norm References

| Domain | Key Norms | Reference |
|--------|-----------|-----------|
| Pharmacy | NDPS Act, D&C Act, Schedule H/H1/X, WHO INN, ATC, AWaRe | CDSCO, WHO |
| Laboratory | NABL accreditation, LOINC codes, critical value reporting | NABL, LOINC.org |
| Radiology | DICOM, AERB radiation safety, PCPNDT Act | AERB, MoHFW |
| Blood Bank | Drugs & Cosmetics Act (Part XII-B), National Blood Policy | NACO, CDSCO |
| IPD/Nursing | Medication administration (5 Rights), fall risk assessment | NABH, IPSG |
| OPD | Patient identification (2 identifiers), consent, referral protocols | NABH, IPSG |
| Billing | GST on healthcare services, CGHS/ECHS rates, insurance TPA formats | GST Council |
| Admin | AEHR (Electronic Health Records) standards, data privacy | MoHFW, IT Act |
| Emergency | MLC (Medico-Legal Case) documentation, mandatory reporting | IPC, CrPC |
| Infection Control | BMW Rules 2016, antimicrobial stewardship, HAI surveillance | CPCB, WHO |

### Non-Compliance Consequences

If you skip regulatory checks and implement a feature that violates norms:
- **Legal**: Hospital license revocation, criminal liability (especially NDPS, PNDT)
- **Accreditation**: NABH/JCI certification failure or suspension
- **Patient safety**: Adverse drug events, diagnostic errors, identity mix-ups
- **Financial**: Insurance claim rejections, TPA disputes, GST penalties
- **Reputational**: Trust erosion, litigation, media exposure

**When in doubt, over-comply rather than under-comply.** It is always easier to relax a strict check than to add one retroactively after data has been created without it.

---

## Module Build Workflow (Repeatable)

Every module follows this exact process. Do NOT skip steps.

### Step 0 — Check Regulatory Norms

**MANDATORY before any coding begins.** Consult the "Regulatory & Compliance Norms" section above:

1. Identify all applicable laws, regulations, and accreditation standards for this module
2. Check `ACMSRC_HMS_Evaluation_Checklists.docx` for the relevant department checklist
3. List required regulatory fields that must exist in the database schema
4. List required business rules that must be enforced at the backend
5. List required UI indicators (badges, warnings, alerts) for the frontend
6. Document findings in the module RFC (`RFCs/RFC-MODULE-<name>.md`)

### Step 1 — Pick Module from Excel

1. Read `MedBrains_Features.xlsx` (root directory)
2. Identify the next module to build based on priority:
   - **P0**: Auth + App Shell (DONE — skeleton in place)
   - **P1**: Patient Management → OPD → Billing
   - **P2**: Lab/LIS → Pharmacy → IPD
   - **P3**: Remaining modules
3. Extract ALL features for that module (module name, sub-modules, features, platform flags)

### Step 2 — Identify Module Masters

Every module has specialized master/configuration data. Before coding, list:
- **Master tables** needed (e.g., Patient Categories, Document Types, Visit Types)
- **Lookup data** (enums, dropdown options)
- **Configuration** (module-level settings)
- **Dependencies** on other modules' masters

### Step 3 — Write Module RFC

Create `RFCs/RFC-MODULE-<name>.md` with:
- Module overview & scope
- **Regulatory & compliance requirements** (from Step 0 findings)
- Entity definitions (tables, fields, types) — including all regulatory fields
- Master data definitions
- API endpoints (REST routes)
- **Business rules with regulatory enforcement** (what the backend must reject/require)
- Frontend pages & components — including regulatory UI indicators
- Workflow integrations
- Platform scope (Web/Mobile/TV)

### Step 4 — Mark In Progress in Excel

Update `MedBrains_Features.xlsx`:
- Set **Status = "In Progress"** for all features of this module
- Use Python/openpyxl script to update programmatically

### Step 5 — Build Database Layer

1. Write migration SQL (`crates/medbrains-db/src/migrations/NNN_<module>.sql`)
2. Add master tables first, then transactional tables
3. Add RLS policies on all tenant-scoped tables
4. Add indexes for common query patterns

### Step 6 — Build Backend (Rust/Axum)

1. Add domain types in `crates/medbrains-core/src/<module>.rs`
2. Add route handlers in `crates/medbrains-server/src/routes/<module>.rs`
3. Register routes in `routes/mod.rs`
4. Include masters CRUD + module-specific endpoints
5. Run `cargo clippy` — must pass with 0 warnings

### Step 7 — Build Frontend (React/Mantine)

1. Add TypeScript types in `packages/types/src/index.ts`
2. Add API methods in `packages/api/src/client.ts`
3. Build page in `apps/web/src/pages/<module>.tsx`
4. Each module page includes:
   - Main operational view (list/detail/queue)
   - Masters tab or sub-route for module-specific configuration
5. Add routes in `App.tsx`
6. Run `pnpm typecheck` and `pnpm build` — must pass
7. Run `make check-api` — verify all new API methods have matching backend routes

### Step 7b — Build Mobile (React Native) if Mobile=Y

1. Check Excel platform column — only build if **Mobile=Y** for this module's features
2. Add screens in `apps/mobile/src/screens/<Module>/`
3. Use React Native Paper v5 components
4. Add navigation routes in `apps/mobile/src/navigation/`
5. Offline-first with WatermelonDB sync where needed
6. Share types from `@medbrains/types`, API from `@medbrains/api`

### Step 7c — Build TV Display (React Native Android TV) if TV=Y

1. Check Excel platform column — only build if **TV=Y** for this module's features
2. Add screens in `apps/tv/src/screens/<Module>/`
3. Focus-based navigation (D-pad friendly, no touch)
4. WebSocket-driven real-time updates
5. Large fonts, high contrast, auto-refresh displays
6. Typical TV features: queue boards, bed status, dashboards, digital signage

### Step 8 — Run Static Checks

1. Run `make check-all` — verify all static contracts:
   - `check-api` — path matching (every frontend call has a backend route)
   - `check-ui-api` — page↔method coverage (no dead API methods, no missing references)
   - `check-types` — field contracts (TS interfaces match Rust structs)
2. Run `make generate-smoke` — regenerate smoke tests for new endpoints

### Step 9 — Run Smoke Tests (if server available)

1. Start server: `make dev-backend`
2. Run `make smoke-test` — verify endpoints respond correctly (no 500s)

### Step 10 — Mark Complete in Excel

Update `MedBrains_Features.xlsx`:
- Set **Status = "Done"** for completed features
- Set **Status = "Partial"** for features needing future work

### Step 11 — Verify & Capture

1. Run full build: `cargo clippy && pnpm typecheck && pnpm build`
2. Optionally capture pages into Figma via MCP for design review

---

## Feature Tracking

- **Master spreadsheet**: `MedBrains_Features.xlsx` (2,030+ features across 12 sheets)
- **Sheets**: Onboarding & Setup, Clinical, Diagnostics & Support, Admin & Operations, Specialty & Academic, IT Security & Infrastructure, TV Displays & Queue, Printing & Forms, Mobile Apps, Technical Infrastructure, Regulatory & Compliance, Multi-Hospital & Vendors
- **Columns**: S.No, Module, Sub-Module, Feature, Source, Priority, Status, RFC Ref, Web, Mobile, TV
- **Status values**: Pending, In Progress, Done, Partial, Deferred

### Excel Editing

- **Tool**: Python 3 + `openpyxl` (always use openpyxl for reading/writing .xlsx files)
- **Scripts**: `scripts/` directory for Excel update scripts
- **Pattern**: Write a Python script in `scripts/`, run with `python3 scripts/<name>.py`
- **Never** edit Excel manually — always use openpyxl scripts for traceability
- **Styling**: Module headers use `D6E4F0` fill + bold, sub-module headers use `E9EFF7` fill + bold, features use thin borders + wrap text

---

## Current Codebase State (Skeleton)

The codebase has been cleared to skeleton. Only infrastructure remains:

| Layer | What's Kept | What's Cleared |
|-------|-------------|----------------|
| **Frontend** | Login, App Shell, routing, theme, auth store | All module pages (empty placeholders) |
| **Backend** | Auth routes, health check, middleware, seed | All module routes (empty files) |
| **Database** | Migrations 001 + 002 (35 tables exist) | No new migrations yet |
| **Packages** | Auth types, auth API methods, stores | Module types & API methods removed |
| **Core** | All Rust domain types preserved | — |

---

## Key Architectural Patterns

1. **Multi-tenancy**: Every tenant-scoped table uses `tenant_id` + PostgreSQL RLS. Tenant context is set per-request via middleware.
2. **7-layer configuration**: Global → Tenant → Campus → Building → Floor → Department → User. Stored hierarchically in YottaDB globals.
3. **Workflow engine**: Templates define step sequences as JSONB. Instances track execution state. Step logs provide audit trails.
4. **YottaDB globals**: `^CONFIG(tenantId,layer,module,key)` for config, `^SEQUENCE(tenantId,type)` for atomic counters (UHID), `^BEDSTATE(tenantId,locationId)` for real-time bed state.
5. **Compile-time safety**: All SQL queries verified at compile time. Strict clippy lints catch common errors before runtime.
6. **Permission system**: 111 permissions across 8 modules. `P.MODULE.ACTION` typed constants. Page guards via `useRequirePermission()`, element visibility via `useHasPermission()`. Roles stored in `roles` table with JSONB permissions array. Per-user overrides via `users.access_matrix` (`{ extra: [], denied: [] }`). `super_admin`/`hospital_admin` bypass all checks.
