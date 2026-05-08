# Codex Execution Goals

Date: 2026-05-04

Source:

- `docs/research/merged-plan-srs-crosswalk-2026-05-04.md`
- `docs/research/srs-air-tight-business-logic-2026-05-04.md`
- `docs/research/p0-p1-execution-backlog-2026-05-03.md`

Purpose: make the merged master plan executable by Codex one goal at a time. Each goal has a narrow scope, likely files, acceptance checks, and command gates.

## Operating Rules

- One goal at a time unless file ownership is disjoint.
- No runtime SQL in new code.
- No separate compliance capture page when source workflow data exists.
- Every state-changing backend change must be transactional, audited, permission-checked, and tenant-contexted.
- Every new route must have frontend API contract parity, or be explicitly backend-only and documented.
- Every implementation goal ends with `cargo fmt`, `cargo check -p medbrains-server`, `python3 scripts/check_runtime_sqlx.py`, and relevant frontend/type/API checks.

## Goal 0 - Keep SQLx Strict

Objective: preserve the SQLx hardening now in place.

Scope:

- Build/check/deploy defaults.
- SQLx prepare guard.
- Runtime SQL ratchet.
- Contributor docs.

Likely files:

- `medbrains/Makefile`
- `.cargo/config.toml`
- `scripts/check_runtime_sqlx.py`
- `AGENTS.md`
- `CLAUDE.md`
- `docs/research/*`

Acceptance:

- `SQLX_OFFLINE=true` is default.
- `make prepare-sqlx` refuses production-looking URLs.
- No runtime-SQL escape hatch.
- `.sqlx/` is refreshed only from local/CI/staging schema DB.

Commands:

```bash
python3 scripts/check_runtime_sqlx.py
cd medbrains && cargo check -p medbrains-server
```

## Goal 1 - NABH Evidence Sink Wiring

Objective: finish Phase 2 NABH evidence as source-event mirroring, not standalone capture CRUD.

Status on 2026-05-04:

- Done: fall incidents mirror from `quality_incidents` into `nabh_falls_register`.
- Done: IPD Braden assessments mirror from `ipd_clinical_assessments` into `nabh_pressure_ulcer_assessments`.
- Done: BMW manifests and sharp-container replacements mirror from `biowaste_records` into `nabh_bmw_disposal_log`.
- Done: source UI cues added on Quality incident, IPD assessment, and Housekeeping BMW screens.
- Done: no new runtime SQL; one existing runtime SQL call site was removed.
- Done: medical-gas utility alarms mirror from `fms_gas_readings` into `nabh_equipment_downtime_log`; no separate NABH capture screen/table was added.
- Remaining: browser/API smoke of the FMS gas alarm evidence row after a seeded alarm is created.

Scope:

- Falls.
- Pressure ulcer / Braden.
- BMW disposal.
- Utility outage if not already represented by facilities source.

Likely files:

- `crates/medbrains-server/src/routes/nabh_evidence.rs`
- `crates/medbrains-server/src/routes/nurse_*`
- `crates/medbrains-server/src/routes/facilities.rs`
- `crates/medbrains-server/src/routes/quality.rs`
- `crates/medbrains-db/src/migrations/0111_nabh_source_event_links.sql`
- `.sqlx/*`

Acceptance:

- Each evidence row has `source_module` and `source_record_id`.
- Mirroring is idempotent on `(tenant_id, source_module, source_record_id)`.
- Source handler commits source row and evidence row in the same transaction where safety/reporting requires it.
- No `nabh_captures` API/page.

Commands:

```bash
cd medbrains && make prepare-sqlx
cd medbrains && cargo check -p medbrains-server
python3 scripts/check_runtime_sqlx.py
python3 scripts/check_migrations.py
```

## Goal 2 - Cross-Module Event Contract

Objective: create a typed event contract used by cascades, evidence sinks, dashboards, and live UI refresh.

Status on 2026-05-04:

- Done: `ClinicalEventName`, `ClinicalEventSourceModule`, and `ClinicalEventEnvelope` added in `medbrains-core`.
- Done: shared TypeScript event-name/source-module unions and required payload-key map added in `@medbrains/types`.
- Done: server helper added for typed in-process emission and transaction-scoped outbox queueing.
- Done: default hardcoded pipelines now match typed event names instead of raw source event strings.
- Done: architecture contract documented in `docs/architecture/cross-module-events.md`.
- Done: typed outbox events queued transactionally for patient created, OPD encounter created, quality incident reported, blood transfusion reaction reported, BME downtime recorded, code blue activated/completed, BMW disposal recorded, lab/radiology completion, billing invoice created/finalized/payment received, IPD bed assigned/transferred, IPD discharge initiated/completed, and lab/radiology/pharmacy order cancellation.
- Done: structured IPD bed-transfer now writes to canonical `ipd_transfer_logs` instead of the invalid `ip_bed_transfers` table.
- Remaining: extend typed events into any long-tail order-cancel endpoints outside lab/radiology/pharmacy and add browser/live-UI smoke for WebSocket refresh consumers.

Scope:

- Event names.
- Required payload keys.
- Rust enum/types.
- TS shared types.
- Outbox publish helper.

Likely files:

- `crates/medbrains-core/src/events.rs` or new `crates/medbrains-core/src/clinical_events.rs`
- `crates/medbrains-server/src/events.rs`
- `crates/medbrains-server/src/routes/*`
- `packages/types/src/index.ts`
- `docs/architecture/cross-module-events.md`

Acceptance:

- Every event has tenant_id, source_module, source_record_id, actor_id, occurred_at.
- Event names cover patient, visit, order, billing, dispense, bed, discharge, incident, code blue, transfusion, equipment, BMW.
- No stringly-typed event names in new route code.

Commands:

```bash
cd medbrains && cargo check -p medbrains-server
cd medbrains && pnpm typecheck
python3 scripts/check_type_contract.py
```

## Goal 3 - Patient Context Everywhere

Objective: remove re-entry and missed safety context from patient-touching screens.

Status on 2026-05-04:

- Done: patient context banner added to Emergency ER visit and MLC registration.
- Done: patient context banner added to Lab order creation and order detail.
- Done: patient context banner added to Radiology order creation and order detail.
- Done: patient context banner added to Pharmacy order creation, order detail, interaction check, and Rx review detail.
- Done: patient context banner added to Billing invoice creation and invoice detail.
- Done: patient context banner added to Consent audit/verification patient filters.
- Done: patient context banner added to MRD indexing, birth register, and death register forms.
- Done: patient context banner added to OT booking creation and booking detail.
- Done: changed touched-file key usage so the targeted Biome check passes.
- Remaining: run a browser visual pass on desktop/mobile widths once the dev server is available.

Scope:

- Remaining high-traffic screens after patient-detail/IPD/OPD.
- Emergency, lab, radiology, pharmacy, billing, consent, MRD, OT.

Likely files:

- `apps/web/src/components/Patient/PatientContextBanner.tsx`
- `apps/web/src/hooks/usePatientContext.ts`
- `apps/web/src/pages/emergency.tsx`
- `apps/web/src/pages/lab.tsx`
- `apps/web/src/pages/radiology.tsx`
- `apps/web/src/pages/pharmacy.tsx`
- `apps/web/src/pages/billing.tsx`
- `apps/web/src/pages/consent.tsx`
- `apps/web/src/pages/mrd.tsx`
- `apps/web/src/pages/ot.tsx`

Acceptance:

- Allergy/MLC/balance/consent/next-of-kin context is visible where patient care or billing decisions happen.
- Pages use TanStack Query hook, not raw fetch.
- No layout overlap on desktop/mobile widths.

Commands:

```bash
cd medbrains && pnpm typecheck
cd medbrains && pnpm --filter=@medbrains/web exec biome check src/
```

## Goal 4 - Search Not Found -> Create Inline

Status: patient + catalog + master selector slices shipped.

Objective: eliminate dead-end patient searches.

Scope:

- Shared patient selector upgraded first; all current `PatientSearchSelect` call sites inherit it.
- Generic `SearchOrCreate` component added and adopted by patient, drug, and lab-test selectors.
- Patient mini-registration now opens from the no-match state, creates a patient, and selects it in place.
- Duplicate preview check runs before create and requires explicit confirmation when probable matches exist.
- Drug search no-match now offers stock-manager-gated `Add to formulary`, creates the catalog row, and selects it in place.
- Lab-test search no-match now offers lab-order-permission-gated `Add lab test`, creates the catalog row, and selects it in place.
- Department search no-match now offers permission-gated `Add department`, creates the setup department, and selects it in place.
- Doctor search no-match now offers admin-user-gated `Create doctor`, creates a setup user with doctor profile fields, and selects it in place.
- Vendor search no-match now offers procurement-gated `Add vendor`, captures GST/drug-license data, and selects it in place.
- Bed search no-match now offers permission-gated `Add bed`; backend bed-location creation now initializes `bed_states`, and ward assignment uses `location_id` instead of the invalid `bed_id` column.
- Remaining: browser visual pass on protected OPD/Lab/Pharmacy/IPD/Procurement selectors.

Files:

- `apps/web/src/components/PatientSearchSelect.tsx`
- `apps/web/src/components/Patient/MiniRegisterPatient.tsx`
- `apps/web/src/components/SearchOrCreate.tsx`
- `apps/web/src/components/DrugSearchSelect.tsx`
- `apps/web/src/components/Pharmacy/MiniAddDrug.tsx`
- `apps/web/src/components/LabTestSearchSelect.tsx`
- `apps/web/src/components/Lab/MiniAddLabTest.tsx`
- `apps/web/src/components/DepartmentSelect.tsx`
- `apps/web/src/components/admin/MiniAddDepartment.tsx`
- `apps/web/src/components/DoctorSearchSelect.tsx`
- `apps/web/src/components/admin/MiniCreateDoctor.tsx`
- `apps/web/src/components/BedSelect.tsx`
- `apps/web/src/components/Ipd/MiniAddBed.tsx`
- `apps/web/src/components/VendorSearchSelect.tsx`
- `apps/web/src/components/Procurement/MiniAddVendor.tsx`
- `apps/web/src/pages/procurement.tsx`
- `crates/medbrains-server/src/routes/setup.rs`
- `crates/medbrains-server/src/routes/ipd.rs`
- `.sqlx/*`

Acceptance:

- Search unknown patient in OPD -> create inline -> selected in same flow. Done through shared selector.
- Create button is permission-gated with `patients.create`.
- Duplicate warning appears before saving probable duplicates.
- Search unknown drug in Pharmacy -> stock manager sees `Add to formulary` -> created drug is selected in the same form.
- Search unknown lab test in OPD/Lab -> permitted user sees `Add lab test` -> created test is selected in the same form.
- Search unknown department/doctor/vendor/bed -> permitted user sees inline create -> created row is selected in the same form.
- Bed creation creates an available bed-state row; ward-bed assignment no longer references a non-existent `bed_id` column.

Commands:

```bash
cd medbrains && pnpm typecheck
cd medbrains && make check-api
cd medbrains && python3 ../scripts/check_runtime_sqlx.py
```

## Goal 5 - Billing Source/Reversal Backbone

Status: first backend backbone slice shipped.

Objective: make charge capture and reversals reliable across OPD, lab/radiology, pharmacy, IPD, OT.

Scope:

- Bill lines carry source and reversal references. Migration 0112 adds item-level reversal metadata.
- Migration 0113 adds reversal action keys so partial returns can be idempotent per source event.
- Invoice item void now creates an offsetting reversal row instead of deleting the original.
- Lab/radiology cancellations now call billing reversal idempotently for any existing source charge.
- Pharmacy return processing now reverses exactly the returned quantity against the charged dispense item.

Likely files:

- `crates/medbrains-db/src/migrations/NNNN_billing_source_reversal.sql`
- `crates/medbrains-server/src/routes/billing.rs`
- `crates/medbrains-server/src/routes/lab.rs`
- `crates/medbrains-server/src/routes/radiology.rs`
- `crates/medbrains-server/src/routes/pharmacy.rs`
- `crates/medbrains-server/src/cascades/*` if cascade module is added.

Acceptance:

- No clinical/source-generated bill line is orphaned from source.
- Voids create reversal rows, never delete originals. Done for invoice item void.
- Cancellation is idempotent. Done for source-charge reversal helper.
- Pharmacy return reverses stock and charge. Done for pharmacy order-item returns; POS return billing is separate counter-sale finance.

Commands:

```bash
cd medbrains && make prepare-sqlx
cd medbrains && cargo check -p medbrains-server
cd medbrains && python3 ../scripts/check_runtime_sqlx.py
cd medbrains && python3 ../scripts/check_migrations.py
```

## Goal 6 - Emergency MLC + Break-Glass

Objective: make emergency/legal access safe and auditable.

Status on 2026-05-04:

- Done: ER visit creation infers MLC from accident/RTA/assault/burn/poison/self-harm terms and creates an idempotent `mlc_cases` row in the same transaction.
- Done: ER triage can promote an existing visit to MLC when the medico-legal trigger is captured during triage.
- Done: break-glass now requires a patient scope, reason, and 5-240 minute expiry.
- Done: break-glass writes a time-limited `patient#viewer@user` relation tuple instead of a broad/global access grant.
- Done: break-glass end/review rolls up PHI-access evidence from `access_log` into modules accessed, count, and last access timestamp.
- Done: break-glass route queries converted to SQLx compile-time macros; runtime SQL ratchet improved.
- Done: Audit Trail now has a Break-glass supervisor review tab with queue filters, lifecycle/review badges, evidence drawer, and gated review submission.

Scope:

- Unknown patient flow.
- MLC trigger.
- Break-glass scoped access.
- Supervisor review queue.

Likely files:

- `crates/medbrains-server/src/routes/emergency.rs`
- `crates/medbrains-server/src/middleware/authz_*`
- `crates/medbrains-db/src/migrations/*`
- `apps/web/src/pages/emergency.tsx`
- `apps/web/src/pages/security.tsx` or admin review page.

Acceptance:

- Accident/assault/burn/poison/RTA can trigger MLC workflow.
- Break-glass requires reason and expires.
- Break-glass access is patient/context scoped, not global.
- Supervisor review sees reason, actor, patient, scope, expiry, and PHI accessed.

Commands:

```bash
cd medbrains && cargo check -p medbrains-server
cd medbrains && pnpm typecheck
python3 scripts/check_runtime_sqlx.py
```

## Goal 7 - CPOE + CDS Phase 1

Objective: stop unsafe orders at creation.

Status: Phase 1 backend enforcement shipped.

Scope:

- Unified order lifecycle.
- Allergy, duplicate, high-alert, controlled-drug, basic dose hooks.
- Override with reason and permission.

Shipped:

- Migration `0115_cpoe_safety_audit.sql` adds a tenant/RLS-scoped CPOE safety audit table.
- `pharmacy.rs` now runs shared medication safety checks at direct pharmacy order creation.
- `order_basket.rs` reuses the same medication safety evaluator before basket signing.
- Medication blocks now cover drug allergy conflicts, duplicate active medication orders, duplicate basket drugs, insufficient stock, controlled/scheduled drugs, LASA/black-box high-risk drugs, restricted formulary drugs, and max-dose review warnings.
- Override requires `pharmacy.safety.override`, a non-empty reason, and writes `cpoe_safety_audit`.
- Non-overrideable stock and missing Schedule X paper serial blocks must be fixed, not acknowledged away.
- Pharmacy order creation queues typed `order.created` clinical events.
- Pharmacy UI exposes the medication-safety override reason only to users with override permission and surfaces backend block messages inline.

Acceptance:

- Patient allergy blocks matching medication order unless permitted override reason is supplied.
- Duplicate active order warns or blocks by severity.
- Override writes audit row.
- Order creation emits typed event.

Commands:

```bash
cd medbrains && make prepare-sqlx
cd medbrains && cargo check -p medbrains-server
cd medbrains && pnpm typecheck
python3 scripts/check_runtime_sqlx.py
python3 scripts/check_migrations.py
cd medbrains && make check-api
```

## Goal 8 - Golden Patient Journey E2E

Objective: prove the business workflow after Goals 1-7.

Status: shipped and passing.

Scenario:

1. Register patient.
2. Start OPD visit.
3. Order lab.
4. Prescribe Rx.
5. Dispense Rx.
6. Admit IPD.
7. Transfer bed if needed.
8. Discharge with take-home meds.
9. Finalize bill.
10. Seal MRD.

Likely files:

- `apps/web/e2e/scenarios/golden-patient-journey.spec.ts`
- `apps/web/e2e/helpers.ts`
- seed fixtures as needed.

Acceptance:

- Zero console errors.
- No unexpected 4xx/5xx.
- Charge capture works.
- Safety context appears.
- MRD seal happens after discharge.

Commands:

```bash
cd medbrains && pnpm exec playwright test apps/web/e2e/scenarios/golden-patient-journey.spec.ts
```
