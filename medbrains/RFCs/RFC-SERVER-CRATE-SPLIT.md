# RFC — Split the `medbrains-server` monolith into domain crates (rebuild-time)

**Status:** ACTIVE loop goal · **Owner:** build/architecture · **Motivation:** compile/rebuild latency = money & flow.

## Problem

`crates/medbrains-server` is a **single ~226,588-line crate**. `routes/` alone is **202,769 lines (89%)**
across **189 route files** (billing 9.7k, ipd 7.9k, mod.rs 7.9k, pharmacy 7.8k, camp 7.8k, opd 6.0k…).

Rust compiles a crate's **front-end** (parse → type-check → borrow-check → MIR) as one unit. On stable it is
largely **serial**, and it re-runs over the *whole crate* on any edit. So editing one route recompiles the
front-end of all 202k lines of routes. Cargo's cross-crate `-j` parallelism can't split a single crate;
`-Zthreads` (now wired for dev) threads it but doesn't change the blast radius.

## Goal

Split routes into **leaf domain crates** so an edit recompiles **only that domain** (~8–10k lines + relink,
≈20× less front-end work for the common case), and cargo parallelizes the independent leaves across all cores.
**Pure moves — zero behavior change per PR.**

## Target architecture

```
medbrains-core        (exists)  domain types, zero framework deps
medbrains-db          (exists)  SQLx, migrations, RLS
medbrains-server-core (NEW)     AppState, middleware, extractors, error types,
                                require_permission / authz helpers, common response shapes.
                                SMALL + STABLE — it is the "rebuild-the-world" trigger, keep it lean.
medbrains-server-services (NEW) shared cross-domain helpers that siblings call today via `super::billing`
                                (auto_charge / invoice posting — 66 refs), nabh_evidence (14), tokens (8),
                                shared pharmacy/lab bits. This breaks the cross-domain knot.
medbrains-<domain>    (NEW ×N)  leaf route crates: camp, ipd, opd, lab, pharmacy, patients, radiology, …
                                each exposes `pub fn router() -> Router<AppState>`; depends on
                                server-core + services + core + db; NEVER on a sibling domain.
medbrains-server      (thin)    main.rs + routes/mod.rs that builds AppState and mounts each domain router().
```

`AppState` is only 81 lines / 11 imports today (generic handles: db pool, hubs, config) — **not a god object**,
so it lifts into `server-core` cleanly. That is the usual blocker and it is already fine here.

## Sequencing — one PR per loop iteration

1. **Build-speed foundation** (this iteration): `profile.dev` = `line-tables-only` + unpacked split-debuginfo;
   `-Zthreads=8` parallel front-end on the `make dev` path (`RUSTC_BOOTSTRAP=1`, stable compiler). Composes with the split.
2. **Extract `medbrains-server-core`** — AppState + middleware + extractors + error types + `require_permission`/authz helpers. No behavior change.
3. **Extract `medbrains-server-services`** — the shared helpers behind `super::billing` et al., so route modules become true leaves.
4…N. **One leaf domain crate per PR**, ordered by **size × independence** (start `camp`, `ipd`, `opd`, `lab`, `radiology`, `patients`…; do **`billing` last** — it is the shared hub). `medbrains-server` shrinks each PR.

## Per-PR method (pure move)

- `git mv` the domain's `routes/<domain>.rs` (+ submodules) into `crates/medbrains-<domain>/src/`.
- Add the crate's `Cargo.toml`; register it in the workspace `members`.
- Convert the domain's route registration into `pub fn router() -> Router<AppState>`; mount it from `medbrains-server/src/routes/mod.rs`.
- Replace `super::<sibling>` / `crate::routes::<sibling>` imports with `medbrains_server_services::…` (or the sibling's public crate API if genuinely needed — prefer routing shared logic through services).
- Keep SQLx **offline** (`.sqlx/` already committed; `SQLX_OFFLINE=true`) — works cross-crate unchanged.

## Verification gate (every PR)

`cargo clippy` **0 warnings** · `cargo build` · `make check-api` · `make check-types` · **measure the delta**:
`touch crates/medbrains-<domain>/src/lib.rs && time cargo build -p medbrains-server` before/after extraction —
record the incremental-rebuild time drop in the PR body. Feature branch → `--admin` squash → master. No behavior change.

## Complete crate map (all 189 route files → ~29 crates)

Extraction order = **independence first** (least-coupled, high file-count crates prove the pattern fast),
then self-contained domains, then the coupled clinical core, with the **`billing` hub last**. Each row is one PR.

### Foundation (must come first)
| # | Crate | Contents |
|---|-------|----------|
| 1 | `medbrains-server-core` | AppState, `middleware/`, extractors, error types, `require_permission`/authz helpers, common response shapes. Keep lean. |
| 2 | `medbrains-server-services` | shared helpers siblings call today: billing `auto_charge`/invoice-posting (the 66 `super::billing` refs), `nabh_evidence` (14), `tokens` shared bits (8), order helpers. Unblocks leaf-ness. |

### Wave 1 — least coupled, high file-count (fast, prove the harness)
| # | Crate | Route files |
|---|-------|-------------|
| 3 | `medbrains-clinical-scores` | news2, news, sofa, meows, pews, gcs, curb65, cha2ds2_vasc, has_bled, wells_pe, wells_dvt, glasgow_blatchford, child_pugh, meld, ciwa_ar, cam_icu, aldrete, anion_gap, osmolar_gap, lung_protective, cpot, sepsis, sepsis_bundle, vte, hypoglycemia, nutrition_screening, paediatric_fluid (~27 files, pure compute) |
| 4 | `medbrains-print` | print_data_clinical, print_data_billing, print_data_admin, print_data_regulatory, print_data_mrd, print_data_medicolegal, print_data_surgical, print_data_consent, print_data_academic, print_data_bme, print_data_quality, print_data_hr, print_data (~13 files, ~22k) |

### Wave 2 — self-contained domains
| # | Crate | Route files |
|---|-------|-------------|
| 5 | `medbrains-documents` | documents, documents_render, documents_render/templates, document_ingestion, signed_documents, signatures, consent, upload, storage, case_sheet_scan, roi, sharing |
| 6 | `medbrains-lab` | lab, blood_bank |
| 7 | `medbrains-radiology` | radiology |
| 8 | `medbrains-hr` | hr, payroll, aebas |
| 9 | `medbrains-materials` | indent, procurement, assets, materials, catalog_import, bme, devices, device_pairing, housekeeping |
| 10 | `medbrains-quality` | quality, nabh_indicators, infection_control, regulatory, utilization_review, retrospective |
| 11 | `medbrains-specialty` | specialty_other, specialty_interventional, specialty_psychiatry, specialty_maternity, specialty_dental, specialty_ophtho, chronic_care, long_term_care, diet, clinical_trials, lms, cms |
| 12 | `medbrains-identity` | auth, mfa, sso, sso_login, oauth, step_up, email_verification, invitations, iam, security, audit |
| 13 | `medbrains-interop` | abdm/abha, abdm/signature, abdm/hip_relay, abdm/hfr, abdm/mod, fhir, terminology, dlt, integration |
| 14 | `medbrains-analytics` | reports, dashboard, analytics |
| 15 | `medbrains-displays` | tv, tokens, stations, station_handoff, app_manifest |
| 16 | `medbrains-it-security` | it_security, vpn, client_errors |
| 17 | `medbrains-notifications` | notifications, ws, communications, news_feed, blog, microsite |
| 18 | `medbrains-ai` | ai, ckb, cds |
| 19 | `medbrains-admin-config` | setup, onboarding, facilities, infra_settings, config_transfer, custom_code, schema_registry, admin_db_topology, admin_system_state, admin_simulator, multi_hospital, mail_provisioning, geo, catalog_import |

### Wave 3 — clinical core (bigger, some inbound coupling → after services)
| # | Crate | Route files |
|---|-------|-------------|
| 20 | `medbrains-outpatient` | opd, appointments/{bookings,public,schedules,types,reminders,mod}, scheduling, front_office, doctor_profile, doctor_dashboard, telemedicine |
| 21 | `medbrains-inpatient` | ipd, ipd_post_discharge, icu, care_view, bedside_portal, med_reconciliation, nurse_vitals, nurse_handoff, nurse_clinical, sepsis? |
| 22 | `medbrains-perioperative` | ot, cssd |
| 23 | `medbrains-emergency` | emergency, command_center, ambulance |
| 24 | `medbrains-patients` | patients, mrd, case_mgmt |
| 25 | `medbrains-community` | camp, home_health, occ_health |
| 26 | `medbrains-pharmacy` | pharmacy, pharmacy_safety, pharmacy_dispense_ops, pharmacy_free_dispensing, pharmacy_repeats, ward_stock, order_basket, order_sets |
| 27 | `medbrains-pharmacy-finance` | pharmacy_finance, pharmacy_payments, pharmacy_cash_drawer, pharmacy_petty_cash |
| 28 | `medbrains-payments` | payment_gateway, insurance, nhcx_submit, nhcx_callback, nhcx_onboarding, nhcx_participants |

### Wave 4 — the shared hub, last
| # | Crate | Route files |
|---|-------|-------------|
| 29 | `medbrains-billing` | billing, coverage, patient_packages, doctor_packages |

**Stays in thin `medbrains-server`:** main.rs, `routes/mod.rs` (router wiring), health, debug, access, orchestration,
`bin/`, `seed/` (or its own `medbrains-seed`), plus anything genuinely global. `care_view`/`sepsis*`/`med_reconciliation`
land with `inpatient` unless a score, in which case `clinical-scores`.

> The exact file→crate boundary can shift by ≤1 crate when a PR reveals coupling (record the reason in the PR).
> The order is the contract: **foundation → independent → coupled → billing last.** Never extract a crate whose
> shared logic hasn't yet moved to `server-services`.

## Beyond routes — vertical slices, core split, infra crates

Routes are 202k of the 227k server lines, but **the split is not routes-only**. `medbrains-core` is itself a
**32,023-line second monolith** organised by domain file (`print_data.rs` 5.3k, `ipd.rs`, `billing.rs`, `lab.rs`,
`patient.rs`, `hr.rs`, `quality.rs`, `blood_bank.rs`…) — a shared type edit there rebuilds everything. And the
server carries non-route code: `seed/` 12.3k, `services/` 3.5k, `middleware/` 2.3k, `orchestration/` 2.2k, plus
top-level infra (`config`, `oauth`, `validation`, `error`, `signing`, `s3_presign`, `authz_patient`, `events`).

**Each domain crate is a VERTICAL slice, not just routes:** when extracting `medbrains-<domain>`, move that domain's
`core/<domain>.rs` types **and** its `services/` helpers **and** its `routes/<domain>.rs` into the one crate. A domain
change (type + logic + handler) then recompiles only that crate. `medbrains-core` shrinks to **shared primitives** that
genuinely everything needs; those stay put.

### `medbrains-core` (32k) — what moves vs stays
- **Move into the matching domain crate:** `print_data.rs`→print, `ipd.rs`→inpatient, `billing.rs`→billing,
  `lab.rs`→lab, `blood_bank.rs`→lab, `patient.rs`→patients, `hr.rs`→hr, `quality.rs`→quality, `device.rs`→materials,
  `cms.rs`→specialty, `multi_hospital.rs`→admin-config, `consultation.rs`→outpatient, `it_security.rs`→it-security,
  `clinical_events.rs`→inpatient/scores, etc.
- **Stays in `medbrains-core` (shared primitives):** `permissions.rs` (2k), `access/` (roles/boundary), `form.rs`,
  `queue.rs`, `boundary_filter.rs`, `jwt_signer/`, `object_store/`, `secrets/`, `audit_sink/`. These back `server-core`.

### Non-route infra crates (extract alongside)
| Crate | Contents | Why |
|-------|----------|-----|
| `medbrains-seed` | all of `server/src/seed/` (camp_fixtures, demo_patients, pharmacy_catalog, role_dashboards…) | 12.3k boot-only code off the request hot path; huge server-crate reduction, rarely edited. |
| `medbrains-orchestration` | `server/src/orchestration/` (scheduler, jobs, registry, connectors, lifecycle, code_executor, default_pipelines) | self-contained workflow engine. |
| → `medbrains-server-core` | `middleware/`, top-level infra (`config`, `error`, `validation`, `signing`, `s3_presign`, `authz_patient`, `events`, `oauth`), + `core::permissions`/`access` | the shared framework glue every domain imports. |
| → `medbrains-server-services` | `server/src/services/` + the cross-domain billing/nabh/token helpers | shared logic, breaks `super::billing`. |

**Revised end-state:** `medbrains-server` = `main.rs` + `routes/mod.rs` (mount every `router()`) + health/debug/access only;
~29 domain crates each a vertical slice; `core`=primitives; `seed`/`orchestration` separate; `server-core`+`server-services` shared.
Sequence unchanged (foundation → independent → coupled → billing last); when a domain PR extracts routes it takes its
core types + services **in the same PR** (still one pure move, one crate).

## Caveats / expectations

- **Linking stays serial** (one final binary). `line-tables-only` + unpacked already made it cheaper; do not regress it.
- **`server-core` is the blast-radius crate** — edits there rebuild everything downstream. Keep it minimal and change-averse.
- **No circular deps**: a leaf must never import a sibling leaf. If two domains genuinely share logic, it belongs in `services`, not in one of the leaves.
- **Not a device/loop-surface task** — this is a build-architecture track; it runs as its own loop, one extraction per PR, measured.
