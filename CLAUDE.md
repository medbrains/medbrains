# CLAUDE.md — MedBrains Hospital Management System

## Project Overview

MedBrains is a multi-tenant Hospital Management System (HMS) covering 67+ modules across clinical, administrative, financial, and infrastructure domains. The system follows a 7-layer configuration architecture, stored in PostgreSQL.

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
| PostgreSQL 16+ | **Single source of truth** — tenants, users, patients, departments, workflows, config (`tenant_settings`), sequences/UHID, bed state. Declarative partitioning + retention for high-volume tables; Citus-ready sharding by `tenant_id`. |
| Redis / Dragonfly | Cache layer + hot real-time state (future) |
| DuckDB / columnar warehouse | Analytics & research, off the OLTP path (future) |
| Meilisearch | Full-text search (future) |
| NATS JetStream | Event streaming / async (future) |

> **YottaDB was removed.** Every workload it was speced for (config trees, UHID sequences, real-time bed state) is served by PostgreSQL — `tenant_settings`, the `sequences` table (atomic `UPDATE … RETURNING`), and `bed_states`. See `memory/project_oss_and_datastore_decisions.md`.

### SQL

- **SQLx** with compile-time checked macros (`sqlx::query!`, `sqlx::query_as!`, `sqlx::query_scalar!`)
- `.sqlx/` offline metadata is committed; normal build/check/test/deploy runs with `SQLX_OFFLINE=true`
- `cargo sqlx prepare` runs only against local/CI/staging schema databases, never production
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
| Fonts | **Inter Tight** (UI), **Fraunces** (display/editorial), **JetBrains Mono** (code/metadata) |

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

## Design System — Forest + Copper (LOCKED)

The visual identity is **Forest + Copper** — deep institutional green, white canvas, copper reserved accent. Designed for clinical gravitas and institutional warmth (peers: Mayo Clinic, Roche, Patagonia-medical).

### Brand Palette

| Token | Hex | Role |
|-------|-----|------|
| `--fc-brand` (primary-5) | `#1F4332` | Primary fill, CTAs, active nav, links, focus rings |
| `--fc-brand-hover` (primary-6) | `#153325` | Hover state |
| `--fc-brand-deep` (primary-7) | `#0d2417` | Pressed, deep ink on tint |
| `--fc-ink` | `#0F1412` | Body text, headings (never `#000`) |
| `--fc-canvas` | `#FFFFFF` | White-first institutional body |
| `--fc-panel` | `#f7f8f6` | Fog — hover bg, rail panels |
| `--fc-rule` | `#e7ebe8` | Hairline borders (always 1px) |
| `--fc-copper` | `#B8924A` | **Reserved accent** — changed values, unread counts, single hero moment only |
| `--fc-tint` | `#e4ede9` | Active nav pills, hover cards |

**Copper is NEVER decoration.** Use only for: changed values, unread counts, "new since last visit", one KPI hero card.

### Typography

- **Fraunces** (display) — hero headlines (regular weight, italic accent word in forest), serif KPI numerals, pull quotes. Never in dense UI.
- **Inter Tight** (UI) — all body, buttons, inputs, tables, labels, nav, toasts, modal content.
- **JetBrains Mono** (metadata) — eyebrow labels (11px, 0.14em tracking, uppercase), code blocks, UHIDs, timestamps.
- Font packages: `@fontsource-variable/inter-tight`, `@fontsource-variable/fraunces`, `@fontsource/jetbrains-mono`
- Imported in `main.tsx` before Mantine styles.

### Signature UI Details

- **ECG Loader** — emerald cardiac monitor (`#34d399`), sweep-mask reveal, ghost trace + bright active trace. Used as default Mantine Loader.
- **TopProgressBar** — single PQRST heartbeat centered on screen, scan window slows at spike, glowing dot at beat start, phosphor trail. Memoized with trace cache.
- **Stat cards** — Fraunces serif numerals, JetBrains Mono eyebrow labels, forest left-accent on hover.
- **Buttons** — 5 tiers (filled/default/light/outline/subtle), radial glow on press, loading pulse animation, tactile scale on active.
- **Shadows** — dual-layer (design system spec), no blue tint. Cards `sm`, menus `md`, modals `xl`.
- **Active sidebar** — 3px forest pill indicator on left edge.
- **Hero titles** — Fraunces at regular weight, one italic clause in forest green per headline.

### Emergency Code Layer (fixed, safety-critical)

Six codes, fixed hexes, identical on every deployment regardless of theme:
`--code-blue` `#1E63B8` (cardiac), `--code-red` `#C8102E` (fire), `--code-pink` `#E24C94` (abduction), `--code-black` `#0a0a0a` (bomb), `--code-yellow` `#E6B422` (disaster), `--code-orange` `#E86A1F` (hazmat).

---

## Git Workflow

- **Feature branches**: `feature/<name>` branched from `master`
- Each feature developed in isolation, merged via PR
- Do NOT commit directly to `master` — always use feature branches
- Commit messages: imperative, concise, explain "why" not "what"

---

## Project Structure

```
medbrains/
├── Cargo.toml                    # Rust workspace root
├── rust-toolchain.toml           # Stable toolchain + clippy + rustfmt
├── rustfmt.toml                  # Formatting rules
├── docker-compose.yml            # PostgreSQL 16
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

#### Cross-compilation

- **`cargo-zigbuild` is the only cross-compile path.** No `cross` (cross-rs), no docker emulation, no QEMU. Operator's mac (arm64) → server (x86_64) is the common direction; zigbuild handles glibc ABI cleanly.
- Setup: `brew install zig && cargo install cargo-zigbuild`.
- Canonical command: `cargo zigbuild --release --target=x86_64-unknown-linux-gnu -p <crate>`. Output lands at `target/x86_64-unknown-linux-gnu/release/`.
- Build locally on the operator's mac, scp the ELF to the server. Never run `cargo build` on the production EC2 — keeps server CPU/RAM focused on serving requests, not compilation.
- The deploy.sh script (`deploy.sh`) and the standalone-deploy `make build-starter` target both follow this pattern.

### SQL

- **Compile-time SQL only** via `sqlx::query!`, `sqlx::query_as!`, and `sqlx::query_scalar!`.
- Normal build/check/test/deploy uses committed `.sqlx/` metadata with `SQLX_OFFLINE=true`.
- Run `make prepare-sqlx` only against a migrated local/CI/staging schema database after query or migration changes. Never run SQLx metadata generation against production.
- Every tenant-scoped table has `tenant_id` column with Row-Level Security (RLS).
- Set tenant context per request via `set_tenant_context(&mut tx, &tenant_id)`.
- **Migration pitfalls**: no `NOW()` in index predicates (use `IS NULL`), no duplicate enum names across migrations, wrap seed INSERTs in `IF EXISTS (SELECT 1 FROM tenants)` guard.

### TypeScript / React

- **Plan UI before build** — for any story that adds/changes a screen, write a short UI plan (placement, layout, primitives, surface, all states, permissions) and agree it BEFORE coding. Use plan mode for non-trivial screens. See `medbrains/docs/ui-plan-before-build.md`. Pairs with the design rules in `medbrains/docs/UI_GUIDELINES.md`.
- Build UI from the **`@/components/ui` seam** (Button/IconButton/Badge/Alert/Card/Input/Select/Switch/Checkbox/Table/Tooltip/Modal/Drawer/Panel/ThemeIcon/SignatureHero), not raw `@mantine/core`. Buttons/badges use semantic `tone=...`. New page leaks are blocked by `make check-ui-seam`.
- **NEVER hand-roll raw HTML elements — always use a component.** This is a hard rule, including when porting a design/mockup. Order of preference: (1) the **`@/components/ui` seam** primitive; (2) if the seam lacks it, the **Mantine component**, customised via `classNames`/`styles`/`theme` (e.g. `Chip` for selectable chips, `NumberInput`/seam `NumberField` for steppers, `SegmentedControl` for toggles) — never a hand-built `<button>`/`<input>`/`<select>`/`<table>`. No raw `<button>`, `<input>`, `<select>`, `<textarea>`, `<table>`, or custom +/- steppers.
- **Layout uses Mantine layout primitives, not raw `<div>`** — `Box` (styled surface / `component="aside"` etc.), `Stack` (vertical), `Group` (horizontal), `SimpleGrid`/`Grid` (grids), `Flex`. A bare `<div>` in a component is a smell; reach for `Box` at minimum. Keep the module `classNames` on these for SCSS layout/positioning.
- **Icons come from `@tabler/icons-react` components — never inline `<svg>`/`<path>` in TSX.** For a genuinely custom glyph with no tabler equivalent, add the `.svg` to `apps/web/src/assets/` and import it (wire `vite-plugin-svgr` for `import Icon from "./x.svg?react"` if a React-component import is needed). Inline SVG markup is not allowed.
- **Custom components follow the Mantine pattern** ([custom-components](https://mantine.dev/styles/styles-api/), [polymorphic](https://mantine.dev/guides/polymorphic-components/)). When adding a `@/components/ui` primitive: **wrap** the Mantine component (don't reimplement), use the **`factory`/`forwardRef`** API so `ref` + all native props pass through, expose Mantine's **`classNames`/`styles`/`vars`** so callers can theme parts, make it **polymorphic** via `createPolymorphicComponent` where an element swap makes sense (e.g. Button as `a`/`Link`), and drive colour **only from theme tokens** (`--mb-*` / semantic `tone`), never inline hexes or gradients. No per-component colour in SCSS — SCSS is layout only; the **theme is the single source of truth**.
- **Accessibility is mandatory (WCAG 2.2 AA)** — for everyone, including specially-abled users; it's a patient-safety requirement. Keyboard-operable everything (no `div`/`span` `onClick` — use `<button>` or `role`+`tabIndex`+`onKeyDown`), visible ≥2px focus indicator (WCAG 2.2 SC 2.4.13 — don't remove `outline`), ≥24px target size (SC 2.5.8), accessible auth/allow paste (SC 3.3.8), `aria-label` on every icon-only control, real labels + wired errors on inputs, never colour-alone for meaning, honour `prefers-reduced-motion`. Enforced by **strict Biome a11y rules** (all `error`) + the `@/components/ui` seam. **Full WCAG 2.2 rules: `medbrains/docs/WCAG-2.2-RULES.md`**; ARIA index: `medbrains/docs/ACCESSIBILITY.md`.
- **Carbon layout + motion + iconography are LAW** — spacing/grid follow `medbrains/docs/CARBON-LAYOUT-RULES.md` (8px mini-unit, 2x grid, sharp corners, token spacing — never literal px; layout via Mantine primitives not `<div>`). Motion follows `medbrains/docs/CARBON-MOTION-RULES.md` (productive vs expressive, duration/easing tokens, ≤240ms UI feedback, reduced-motion fallback required, pausable auto-play). Icons follow `medbrains/docs/CARBON-ICONOGRAPHY-RULES.md` (one family = tabler, sizes 16/20/24/32, monochrome from tokens, real glyphs not letter-abbreviations, `aria-label` on icon-only controls; UI-icons vs app-icons distinction). Photography follows `medbrains/docs/CARBON-PHOTOGRAPHY-RULES.md` (authentic/human/dignified, no generic stock, patient privacy — no identifiable patients/PHI, scrim behind text). Data viz follows `medbrains/docs/CARBON-DATAVIZ-RULES.md` (right chart for the question, honest zero-baseline scales + clinical reference ranges, Carbon palettes, colour-blind-safe + never colour-alone, text/data-table alternative; use `@carbon/charts`, don't hand-roll). Colour follows `medbrains/docs/CARBON-COLOR-RULES.md` (semantic `--mb-*` tokens only, never raw hex; layer elevation; support + fixed emergency colours; light theme only). Typography follows `medbrains/docs/CARBON-TYPOGRAPHY-RULES.md` (IBM Plex; 14px body clinical density; tokens not px; sentence-case hierarchy). Content/voice follows `medbrains/docs/CARBON-CONTENT-RULES.md` (plain + human + sentence case, fix-oriented errors, clinical accuracy, inclusive/accessible content, i18n). **Index: `medbrains/docs/DESIGN-RULES.md`.**
- **Light theme only** — `forceColorScheme="light"`; do not add dark-mode styles or `data-mantine-color-scheme="dark"` branches.
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

## Code Quality Bar

Senior-architect standard. Project-specific rules:

- **Naming**: functions `verb+noun` (`createPatient`); booleans `is/has/can/should`; hooks `use*`; types PascalCase no `I` prefix.
- **Function design**: ≤20 lines, ≤3 params (else options object), early returns, no swallowed errors.
- **Components**: one per file, props interface at top, separate data/presentation/styling, memoize derived data.
- **API**: RESTful resources, `{ data, meta }` or `{ error, details }`, pagination on lists, meaningful HTTP codes.
- **Errors**: typed (thiserror / TS classes), user-friendly UI msg, never expose stack traces.
- **Avoid**: god objects, prop drilling, premature optimization, magic numbers, copy-paste, deep nesting.
- **Boy Scout Rule** — improve files you touch; never increase tech debt.

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

`useHasPermission(code)` / `useHasAllPermissions(codes[])` (AND) / `useHasAnyPermission(codes[])` (OR) — all from `@medbrains/stores`. Gate buttons, ActionIcons, form elements: `{canCreate && <Button>...}`.

### Standard Page Pattern

```tsx
export function ModulePage() {
  useRequirePermission(P.MODULE.LIST);
  const canCreate = useHasPermission(P.MODULE.CREATE);
  const { data, isLoading } = useQuery({ queryKey: [...], queryFn: ... });
  return (
    <div>
      <PageHeader title="..." actions={canCreate ? <Button>Add</Button> : undefined} />
      <DataTable columns={columns} data={data} ... />
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

**Before any feature, check applicable norms.** Hospital domain — non-compliance = legal/accreditation/safety risk. When in doubt, over-comply.

### Pre-Implementation Checklist

1. **Indian law**: NDPS Act 1985 (narcotics), D&C Act 1940 (drug scheduling), CDSCO Schedule H/H1/X/G, Clinical Establishments Act 2010, PNDT/PCPNDT, MTP Act, Mental Healthcare Act 2017, BMW Rules 2016, Consumer Protection Act 2019.
2. **Accreditation**: NABH/JCI — see `ACMSRC_HMS_Evaluation_Checklists.docx` (34 dept checklists). Key: patient ID, medication safety, infection control, consent.
3. **Clinical coding**: Drugs → WHO INN + ATC + RxNorm/SNOMED. Diagnoses → ICD-10/11. Procedures → CPT/ICD-10-PCS. Labs → LOINC.
4. **Pharmacology**: drug schedule, NDPS register + dual-lock, formulary/DTC, AWaRe stewardship, DDI checks, allergy cross-check, LASA flags, dose validation, batch/lot tracking, FEFO expiry.
5. **Interop**: HL7 FHIR R4, ABDM Health ID, DICOM, HL7 v2.
6. **Safety**: IPSG (ID, med safety, surgery, falls, infection, comms), informed consent, incident/near-miss reporting.

### How to Apply

- **Step 0 of Module Workflow**: research norms before coding
- **Schema**: regulatory fields from start (e.g. `pharmacy_catalog` needs `drug_schedule, is_controlled, inn_name, atc_code`; `lab_test_catalog` needs `loinc_code`; `diagnoses.icd_code`)
- **Frontend**: regulatory badges (Schedule H, controlled-substance icon, LASA warning)
- **Backend**: enforce — reject Schedule X without duplicate record, block NDPS dispensing without register entry
- **Audit**: log who prescribed/dispensed/witnessed

### Domain Norm References

| Domain | Key Norms |
|--------|-----------|
| Pharmacy | NDPS, D&C, Schedule H/H1/X, INN, ATC, AWaRe (CDSCO/WHO) |
| Laboratory | NABL, LOINC, critical-value reporting |
| Radiology | DICOM, AERB, PCPNDT |
| Blood Bank | D&C Part XII-B, National Blood Policy (NACO) |
| IPD/Nursing | 5 Rights, fall risk (NABH/IPSG) |
| OPD | 2-ID, consent, referral (NABH/IPSG) |
| Billing | GST healthcare, CGHS/ECHS, TPA formats |
| Admin | EHR standards, IT Act privacy |
| Emergency | MLC docs, mandatory reporting (IPC/CrPC) |
| Infection Control | BMW 2016, AMS, HAI surveillance |

---

## Ticket / Story Execution Workflow

When picking up a ticket or story (incl. the generated stories in `medbrains/docs/backlog/stories/`), do NOT jump straight to code. Always:

1. **Research the real-world scenario first** — who actually uses this, in what hospital workflow, and what are the real business rules and edge cases? Read the relevant RFC(s), the existing code paths (`ccc search`), the regulatory norms, and how similar features behave. Confirm what exists vs what's missing (many backlog tickets are already partly done).
2. **Expand into scenario-based, business-logic acceptance criteria** — the generated stories carry only generic module-tailored AC. Rewrite them as concrete **Given/When/Then scenarios** grounded in real-world use, covering the actual business logic and edge cases: happy path, conflict/error states, permission-denied, the regulatory rule, boundary values, and what the system does to which records/users. Not a generic checklist — real scenarios (e.g. "Given a Schedule-X drug with no duplicate record, When the pharmacist dispenses, Then the system blocks it and logs the attempt"). Agree them if non-trivial (plan mode).
3. **Then start** — implement to the scenario AC, following the Module Build Workflow below; verify each scenario; ship one focused PR.

## Module Build Workflow

Every module follows this. No skipping.

0. **Regulatory norms** — laws, NABH/JCI checklist, regulatory fields/rules/UI indicators. Document in `RFCs/RFC-MODULE-<name>.md`.
1. **Pick from Excel** — `MedBrains_Features.xlsx`. Priority P1 Patient→OPD→Billing, P2 Lab→Pharmacy→IPD, P3 rest.
2. **Identify masters** — master tables, enums, configs, deps on other modules.
3. **Write Module RFC** — scope, regulatory reqs, entities (with regulatory fields), masters, REST endpoints, backend rules, frontend pages + indicators, workflow integrations, platform scope.
4. **Mark In Progress** in Excel via openpyxl script.
5. **DB layer** — migration `crates/medbrains-db/src/migrations/NNN_<module>.sql`, masters first, RLS, indexes.
6. **Backend** — types in `medbrains-core/src/<module>.rs`, handlers in `medbrains-server/src/routes/<module>.rs`, register in `routes/mod.rs`. `cargo clippy` clean.
7. **Frontend** — types in `packages/types/src/index.ts`, API methods in `packages/api/src/client.ts`, page in `apps/web/src/pages/<module>.tsx` (operational view + masters tab), routes in `App.tsx`. `pnpm typecheck && pnpm build && make check-api`.
   - **7b Mobile (if Mobile=Y)**: `apps/mobile/src/screens/<Module>/`, RN Paper v5, React Navigation, WatermelonDB offline.
   - **7c TV (if TV=Y)**: `apps/tv/src/screens/<Module>/`, D-pad focus nav, WebSocket realtime, large fonts.
8. **Static checks** — `make check-all` (check-api, check-ui-api, check-types). `make generate-smoke`.
9. **Smoke tests** — `make dev-backend && make smoke-test`.
10. **Mark Done/Partial** in Excel.
11. **Final verify** — `cargo clippy && pnpm typecheck && pnpm build`.

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
2. **7-layer configuration**: Global → Tenant → Campus → Building → Floor → Department → User. Stored in PostgreSQL (`tenant_settings`, hierarchical keys resolved by layer).
3. **Workflow engine**: Templates define step sequences as JSONB. Instances track execution state. Step logs provide audit trails.
4. **PostgreSQL primitives** (formerly YottaDB globals): config in `tenant_settings`, atomic counters/UHID via the `sequences` table (`UPDATE … RETURNING`), real-time bed state in `bed_states` — all tenant-scoped under RLS.
5. **Compile-time safety**: All SQL queries verified at compile time. Strict clippy lints catch common errors before runtime.
6. **Permission system**: 111 permissions across 8 modules. `P.MODULE.ACTION` typed constants. Page guards via `useRequirePermission()`, element visibility via `useHasPermission()`. Roles stored in `roles` table with JSONB permissions array. Per-user overrides via `users.access_matrix` (`{ extra: [], denied: [] }`). `super_admin`/`hospital_admin` bypass all checks.
