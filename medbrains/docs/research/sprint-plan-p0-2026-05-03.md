# MedBrains P0 Sprint Plan

Date: 2026-05-03

Goal: clear the P0 blockers before broad module expansion.

Duration: 8 weeks.

## Week 1: Release And Database Safety

Deliverables:

- Confirm `make ship`, `make ship-quick`, and `make ship-cold` behavior.
- Add post-deploy health/login/CRUD check if missing.
- Harden migration checks.
- Generate latest `docs/audit/db-doctor.md`.
- Confirm runtime SQL ratchet is in `make check-all`.

Acceptance:

- `make ship-quick` passes.
- Fresh DB migration replay passes.
- No new runtime SQL can be added silently.

## Week 2: Linkage And Screen Safety

Deliverables:

- Run screen audit.
- Run dead component/permission/route checks.
- File open P0/P1 findings into `docs/audit/issues.md`.
- Generate or update page-load smoke tests.
- Sweep P0 clinical pages for load errors.

Acceptance:

- No RED screen/backend audit rows.
- Clinical P0 page-load smoke passes.
- Known unregistered route issues are either fixed or filed.

## Week 3: Patient Context Foundation

Deliverables:

- Design and implement `GET /api/patients/{id}/context`.
- Add `PatientContextBanner`.
- Wire first screens: OPD, emergency, IPD, pharmacy.
- Add backend tests for context shape and tenant isolation.

Acceptance:

- Patient allergy appears on Rx/order/dispense surfaces.
- MLC flag, balance, consents, and next-of-kin are visible where relevant.

## Week 4: Search-Or-Create And Golden Path Start

Deliverables:

- Build `SearchOrCreate<T>`.
- Wire patient search in OPD, emergency, IPD, pharmacy POS, billing, lab.
- Start golden patient journey E2E.

Acceptance:

- Unknown patient can be created inline and selected without navigation.
- E2E can register patient and start OPD visit.

## Week 5: CPOE Order Basket

Deliverables:

- Add unified order model for Rx, lab, imaging, consult, procedure, nursing task.
- Add order status lifecycle.
- Emit typed outbox events.
- Link order to billing charge capture.

Acceptance:

- OPD order creates downstream work queue item and bill line.
- Cancel order reverses/voids downstream work according to policy.

## Week 6: CDS Phase 1

Deliverables:

- Add CDS rule registry.
- Implement allergy check.
- Implement duplicate order check.
- Add drug-drug interaction hook.
- Add override reason and permission path.

Acceptance:

- Allergy conflict blocks order creation.
- Override requires reason and writes audit row.

## Week 7: Regulatory Evidence Phase 1

Deliverables:

- DPDP breach register and notification workflow.
- Erasure request and retention-aware cascade.
- NABH Phase 2 tables for falls, pressure ulcers, sentinel events, transfusion reactions, code blue, equipment downtime, fire drills, BMW disposal, utility outages.

Acceptance:

- Synthetic breach creates timer evidence and audit row.
- NABH coverage script maps new captures to indicators.

## Week 8: Regulatory Evidence Phase 2 And Closure

Deliverables:

- MTP Form II/III and opinion gates.
- ABDM consent round-trip proof.
- Complete golden patient journey E2E through discharge, billing close, MRD seal.
- Update workbook statuses for completed P0 rows.

Acceptance:

- MTP threshold gate blocks incomplete legal evidence.
- ABDM Health ID -> consent -> approval -> fetch test passes.
- Golden journey has zero P0/P1 issues and zero console errors.

## Weekly Operating Rhythm

- Monday: confirm scope and file ownership.
- Tuesday-Thursday: implementation.
- Friday morning: checks and smoke.
- Friday afternoon: close issues, update docs, update Excel status.

## Stop Conditions

Pause feature work and fix immediately if:

- migration replay fails.
- RLS leak is detected.
- audit hash-chain breaks.
- P0 page cannot load.
- compile-time SQL ratchet breaks.
- DPDP breach notification flow fails.

