# MedBrains Implementation Ticket Seeds

Date: 2026-05-03

These are ticket-ready seeds for P0/P1 work. They are not code changes. File paths are likely ownership areas and must be rechecked before implementation starts.

## P0.1 Ship Pipeline Gate

Scope:

- make release path deterministic.
- make post-deploy checks mandatory.

Likely files:

- `Makefile`
- `scripts/post_deploy_check.sh`
- `.github/workflows/*`
- `docker-compose.smoke.yml`

Acceptance:

- `make ship-quick` passes.
- post-deploy check fails non-zero on health/login/CRUD failure.

Risk:

- Do not modify while deploy pipeline is actively being edited by another agent.

## P0.2 DB Doctor

Scope:

- harden migration and schema hygiene checks.

Likely files:

- `scripts/check_migrations.py`
- `scripts/check_orphan_tables.py`
- `scripts/check_orphan_columns.py`
- `scripts/check_dup_purpose.py`
- `docs/audit/db-doctor.md`

Acceptance:

- migration replay passes on fresh DB.
- duplicate-purpose findings are reported with table names.

Risk:

- Fresh DB run may need local Postgres or Docker.

## P0.3 Compile-Time SQL Ratchet

Scope:

- block new runtime SQL.
- start `.sqlx/` offline cache workflow.

Likely files:

- `scripts/check_runtime_sqlx.py`
- `Cargo.toml`
- `.github/workflows/*`
- `.sqlx/*`
- route files as converted.

Acceptance:

- no new runtime SQL.
- first route group passes SQLx prepare check.

Risk:

- Requires schema/database availability for SQLx prepare.

## P0.4 Patient Context API

Scope:

- one endpoint returns safety and handoff context for a patient.

Likely files:

- `crates/medbrains-server/src/routes/patients.rs`
- `packages/api/src/client.ts`
- `packages/types/src/index.ts`
- `apps/web/src/components/Patient/PatientContextBanner.tsx`
- OPD/IPD/emergency/pharmacy/billing pages.

Acceptance:

- allergy, MLC, balance, consent, next-of-kin, language, diet, room preference visible from one query.
- tenant isolation test passes.

Risk:

- Many pages consume patient data; start with read-only banner before form-default wiring.

## P0.5 Search-Or-Create

Scope:

- no search field should dead-end when an allowed user can create the missing entity.

Likely files:

- `apps/web/src/components/SearchOrCreate.tsx`
- patient/doctor/drug/test/bed/vendor select components.
- `packages/api/src/client.ts`

Acceptance:

- OPD unknown patient search opens mini registration form.
- successful create selects patient without route navigation.

Risk:

- Must gate each inline create by permission.

## P0.6 Golden Patient Journey E2E

Scope:

- create one scenario test for the full clinical-business route.

Likely files:

- `apps/web/e2e/scenarios/patient-journey.spec.ts`
- `apps/web/e2e/helpers.ts`
- seed/test fixture scripts.

Acceptance:

- register -> OPD -> lab -> Rx -> IPD -> discharge -> billing -> MRD seal passes.
- zero console errors.

Risk:

- Test data setup can be flaky; keep fixtures deterministic.

## P0.7 Unified CPOE Order Basket

Scope:

- common order lifecycle for Rx, lab, imaging, consult, procedure, nursing.

Likely files:

- new migration for `cpoe_orders`.
- `crates/medbrains-core/src/*`
- `crates/medbrains-server/src/routes/orders.rs`
- `crates/medbrains-server/src/orchestration/*`
- `packages/api/src/client.ts`
- CPOE/order basket UI.

Acceptance:

- OPD order creates downstream queue item and bill line.
- order cancel reverses downstream work according to policy.

Risk:

- Cross-module blast radius is high. Design migration/API before UI.

## P0.8 CDS Engine Phase 1

Scope:

- order creation safety rules.

Likely files:

- migration for `cds_rules`, `cds_check_logs`.
- `crates/medbrains-server/src/routes/orders.rs`
- `crates/medbrains-server/src/routes/pharmacy.rs`
- `crates/medbrains-core/src/*`
- Rx/order UI override modal.

Acceptance:

- allergy conflict blocks order.
- override requires reason and audit row.

Risk:

- Avoid false blocking for incomplete allergy data; show clear override path for authorized clinicians.

## P0.9 DPDP Breach And Erasure

Scope:

- data protection workflows with evidence.

Likely files:

- migration for breach, erasure, DPIA, DPO registry.
- `crates/medbrains-server/src/routes/data_protection.rs`
- admin data protection page.
- audit/orchestration jobs.

Acceptance:

- synthetic breach creates notification timer and audit.
- erasure request follows retention policy.

Risk:

- Deleting clinical data can violate retention. Implement retention-aware redaction, not naive delete.

## P0.10 NABH Phase 2 Captures

Scope:

- source tables for missing quality indicators.

Likely files:

- migrations for falls, pressure ulcers, sentinel events, transfusion reactions, code blue, equipment downtime, fire drills, BMW disposal, utility outage.
- `crates/medbrains-server/src/routes/nabh_indicators.rs`
- quality/admin pages.
- `scripts/check_nabh_coverage.py`

Acceptance:

- each capture maps to at least one indicator.
- dashboard coverage count is accurate.

Risk:

- Do not create dashboard-only mock metrics; indicators need source data.

## P0.11 MTP Forms

Scope:

- legally gated MTP workflow.

Likely files:

- migration for Form II, Form III, opinions, medical board.
- consent/OT/regulatory routes and pages.

Acceptance:

- threshold action cannot proceed without required opinion/board evidence.

Risk:

- Sensitive records need strict permissions and audit.

## P0.12 ABDM Consent Round Trip

Scope:

- real Health ID and consent exchange path.

Likely files:

- ABDM/NHCX integration routes.
- FHIR crate/package.
- consent pages.
- callback handlers.

Acceptance:

- Health ID -> consent request -> approval -> record fetch test passes.

Risk:

- External sandbox availability may be unstable; mock only for local tests, not production evidence.

## P1.1 PCPNDT And AERB

Scope:

- radiology statutory evidence.

Acceptance:

- Form F required where applicable.
- prohibited content is blocked.
- dose/equipment QA evidence exists.

## P1.2 eMAR Closed-Loop Medication Administration

Scope:

- barcode five-rights medication administration.

Acceptance:

- wrong patient/drug/dose/route/time is blocked or override-audited.

## P1.3 Lab IQC And Critical Values

Scope:

- laboratory quality evidence and critical alerts.

Acceptance:

- failed IQC flags release policy.
- critical value escalation creates TAT evidence.

## P1.4 OT Safety And Specimen Tracking

Scope:

- surgical checklist, instrument counts, specimens.

Acceptance:

- post-op cannot complete with missing required safety evidence.

## P1.5 Security And Reliability Evidence

Scope:

- MFA/WebAuthn, incident/change/DR logs, SLO dashboard.

Acceptance:

- privileged flow requires MFA.
- DR evidence exists for audit-ready status.
