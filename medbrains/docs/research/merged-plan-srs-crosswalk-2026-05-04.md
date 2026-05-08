# Merged Master Plan + SRS Crosswalk

Date: 2026-05-04

Inputs merged:

- `docs/research/consolidated-master-plan-2026-05-03.md`
- `docs/research/enterprise-completion-plan-2026-05-03.md`
- `docs/research/p0-p1-execution-backlog-2026-05-03.md`
- `docs/research/srs-air-tight-business-logic-2026-05-04.md`
- `docs/research/codex-execution-goals-2026-05-04.md`
- `/Users/apple/Downloads/Draft Software Requirements Specification 04302026 (1).docx`

Purpose: cross-check the earlier execution plan against the SRS business-logic research, remove conflicts, and turn both into one implementation queue.

## Merge Decisions

1. The previous master plan remains the execution spine.
2. The SRS hardening document becomes the business-logic acceptance standard for every module.
3. Page-by-page sweep is verification, not architecture. The architecture must be source events, state machines, cascades, evidence, and audit.
4. NABH/quality tables are evidence sinks. Do not create separate manual capture screens when a source workflow already owns the data.
5. New SQL is compile-time SQL only. No runtime SQL escape hatch.
6. Deployment must never run SQLx metadata generation against production. Production only runs embedded migrations and post-deploy smoke checks.
7. A module is not complete unless it has forms, logs, cascades, reports, permissions, audit, tests, and source-event links.

## Conflict Resolution

| Conflict | Old plan text | Merged decision |
|---|---|---|
| Runtime SQL | Ratchet allowed an escape for dynamic SQL. | No new runtime SQL and no escape hatch. Use SQLx macros, typed helpers, or move dynamic variation out of route SQL. |
| NABH captures | Add separate CRUD/admin pages for eight NABH tables. | Do not make separate primary capture screens. Wire source modules into evidence sinks. Manual entry only for legacy/offline correction. |
| Screen sweep | Fix all screens field-by-field. | Still required, but after source-of-truth rules are clear. Sweeping cannot replace module state machines. |
| Medical college | Listed as later platform work. | Promote NMC evidence to P1 because SRS is explicitly hospital + medical college. |
| Day care | Not prominent in earlier master plan. | Add independent state machine and billing model between OPD and IPD. |
| HR/supply/fleet | Existing as modules, less detailed in Track 0. | Add lifecycle and source-event rules from SRS so these modules are not treated as simple CRUD. |

## SRS Section to Execution Track Crosswalk

| SRS area | Existing plan track | SRS hardening delta | Implementation queue |
|---|---|---|---|
| Core architecture, security, offline | Track 0.gamma, 0.delta, 0.epsilon, Track 3/4/5/8 | Add production guard for SQLx prepare, offline pack revocation, MFA gates for sensitive actions | P0.1, P0.2, P0.3, then Offline Pack |
| Multi-hospital and transfer | Track 0.eta.E, Track 1A.bis, Track 8 | Add transfer lifecycle, billing handover, clinical handover packet, ambulance dependency | P1 after IPD discharge cascade |
| Patient onboarding, queue, kiosk | Track 0.eta.A/F/I, Track 1 | Add duplicate/unknown/provisional states, deterministic token priority | P0.4, P0.5, P0.6 |
| OPD | Track 0.alpha, 0.eta.E/F, Track 1 | Add OPD visit lifecycle, reversible no-show, OPD -> ED/IPD/OT handoffs | P0.6, then P1 OPD state machine |
| EMR/CPOE/CDS | Track 0.eta.B/D/K, Track 1/2 | Add signed-note immutability, orderable lifecycle, hard/soft stop rules | P0.7, P0.8 |
| Nursing/IPD/discharge | Track 0.bis, Track 1A.bis.4, Track 0.eta.D/E | Add ADT state machine, MAR routing on bed transfer, discharge cascade | P0 discharge cascade |
| ICU/NICU/PICU | Track 1, Track 9 | Add device binding, scoring provenance, neonatal dosing context | P1 clinical safety |
| Emergency/ambulance/break-glass | Track 0.eta.E/I, Track 1 | Add arrival-clock rules, MLC auto-trigger, scoped break-glass review | P0 emergency MLC and break-glass |
| LIS/RIS/OT/blood bank | Track 1, Track 7A, Track 9 | Add lab/radiology/blood bank lifecycle and AERB/NACO rules | P1 diagnostics safety |
| Pharmacy | Track 0.ter, Track 0.eta.B/D, Track 5 | Add full drug master regulatory fields, controlled-drug corrections, recall trace | P0/P1 medication safety |
| Billing/finance/insurance | Track 0.ter, Track 0.eta.D, Track 6 | Add source_module/source_record_id on every bill line, reversal links, payer lifecycle | P0 charge capture/reversal |
| Day care | New SRS delta | Independent day-care lifecycle, conversion to IPD, package and insurance rules | New P1.0 |
| HR/payroll/supply chain | Track 1B, Track 0.gamma | Add attendance/payroll separation, PR -> PO -> GRN -> QC -> invoice -> payment lifecycle | P1 operations |
| Support services/CSSD/diet/housekeeping/BMW | Track 0.eta.D, Track 7A | Add source-area BMW evidence, CSSD set states, diet defaults, bed clean gates | P1 operations + NABH |
| Maintenance/facilities/inventory | Track 0.gamma, Track 7A | Add asset lifecycle, clinical impact for downtime, append-only stock ledger | P1 operations + NABH |
| Medical camp/offline | Track 3, Track 0.eta.E | Add camp pack scope, temp UUID reconciliation, paid-camp reconciliation | Offline Pack phase |
| Barcode scanner | Track 9, Track 0.bis | Add barcode type registry, wrong-scan hard stops, manual override rules | P1 BCMA / sample safety |
| Medical college/NMC | Track 2, Track 7, Track 11 | Add real-data logbook, OPD/IPD exposure, NMC dashboard evidence | P1 promoted |
| Print/docs/mobile/dashboards | Track 0.eta.J/L, Track 2, Track 11 | Add document snapshot hash, reprint audit, aggregate PHI controls | P1/P2 |

## No-Skip Implementation Queue

### Batch 0 - Already Done Or In Progress

- `SQLX_OFFLINE=true` default.
- Production-looking SQLx prepare guard.
- Runtime SQL escape hatch removed from ratchet.
- SRS hardening research created.
- NABH evidence-sink principle established.
- Source-event mirroring started for sentinel incidents, transfusion reactions, code blue, equipment downtime, and fire drills.

### Batch 1 - Merge-Critical P0

1. Finish NABH source-event mirroring.
   - Falls actual event -> `nabh_falls_register`.
   - Braden/skin assessment -> `nabh_pressure_ulcer_assessments`.
   - BMW bag handover/disposal -> `nabh_bmw_disposal_log`.
   - Utility outage -> add evidence table only if no existing facilities source can produce it.
2. Add cross-module event contract to the codebase.
   - Define event names and payload fields for patient, visit, order, billing, dispense, bed, discharge, incident, code blue, transfusion, equipment, BMW.
   - Every event must include tenant_id, source_module, source_record_id, actor_id, occurred_at.
3. Start patient journey proof.
   - Wire PatientContextBanner to remaining high-traffic pages: emergency, lab, radiology, pharmacy, billing, consent, MRD, OT.
   - Build search-on-miss for patient selectors.
4. Implement charge-capture/reversal backbone.
   - Every bill line gets source_module/source_record_id/reversal_of.
   - Order cancel reverses or holds source-generated charge.
   - Pharmacy return reverses source-generated charge and stock.
5. Lock emergency safety.
   - Unknown-patient registration.
   - MLC trigger.
   - Break-glass scoped access and supervisor review.

### Batch 2 - Clinical Core P0/P1

1. Unified CPOE order lifecycle.
2. CDS phase 1: allergy, duplicate order, high-alert, controlled-drug, pediatric/weight placeholder.
3. OPD state machine and handoffs to ED/IPD/OT.
4. IPD ADT state machine and discharge cascade.
5. eMAR/BCMA skeleton: patient scan, drug scan, five-rights check.
6. Blood bank bedside verification and reaction evidence.
7. Lab critical value acknowledgement/escalation.
8. Radiology pregnancy/contrast/AERB gates.

### Batch 3 - Operational Backbone P1

1. Day care module state machine.
2. CSSD instrument lifecycle.
3. Diet defaults from patient context.
4. Housekeeping bed-clean gates.
5. Inventory append-only stock ledger.
6. Procurement PR -> PO -> GRN -> QC -> invoice -> payment lifecycle.
7. Fleet dispatch lifecycle and ambulance onboard inventory.
8. Maintenance asset lifecycle and critical downtime clinical-impact alert.
9. HR identity, attendance, shift, and payroll separation.

### Batch 4 - Compliance And College P1

1. DPDP breach, erasure, DPO, DPIA.
2. ABDM consent round-trip.
3. PCPNDT/AERB radiology evidence.
4. NMC dashboard from real hospital data: faculty, infrastructure, bed occupancy, OPD/IPD load, case exposure, logbooks, assessments.
5. Student supervised access and PHI minimization.
6. Medical college inspection evidence pack.

### Batch 5 - Product Maturity P2

1. Print Center with document snapshot hash and reprint audit.
2. Mobile parity for doctor/nurse/patient/field workflows.
3. TV queue and alert displays.
4. Predictive analytics governance.
5. Role-safe executive dashboards.
6. Offline pack sync and conflict review.

## Per-Module Airtight Template

Use this before opening code for any module:

```text
Module:
Source-of-truth tables:
Owned lifecycle states:
Allowed transitions:
Who can transition:
Hard-stop validations:
Soft-stop warnings:
Required linked records:
Auto-created downstream records:
Events emitted:
Events consumed:
Billing impact:
Stock impact:
Bed/location impact:
MRD/document impact:
Compliance evidence:
Audit fields:
Void/reversal/amendment flow:
Offline behavior:
Reports/dashboards:
Smoke/E2E scenarios:
```

## Immediate Code Tasks From The Merge

These are the first code-level tasks to execute, in this order. The Codex-ready goal details live in `docs/research/codex-execution-goals-2026-05-04.md`.

1. Keep SQLx strict.
   - `make prepare-sqlx` only local/CI/staging.
   - `cargo check -p medbrains-server` must pass offline.
   - `python3 scripts/check_runtime_sqlx.py` must remain at or below baseline.
2. Finish source-event evidence wiring, not separate NABH screens.
3. Add the event contract as a typed Rust/TS shared manifest.
4. Add patient search-on-miss and context banner to remaining patient-touching screens.
5. Add billing source/reversal columns if missing and wire order cancel -> bill reversal.
6. Build the golden patient journey E2E after the above so it verifies real business logic, not just pages.

## Acceptance Gate For This Merge

The merged plan is accepted when:

- Every SRS section maps to a track and queue above.
- No old plan says runtime SQL is allowed.
- No old plan treats NABH data as primarily separate manual capture.
- P0/P1 backlog references the SRS hardening deltas.
- The next implementation batch can start without re-reading the full DOCX.
