# MedBrains P0/P1 Execution Backlog

Date: 2026-05-03

Source plan:

- `docs/research/enterprise-completion-plan-2026-05-03.md`
- `docs/research/module-inventory-2026-05-03.md`
- `docs/research/srs-air-tight-business-logic-2026-05-04.md`
- `docs/research/merged-plan-srs-crosswalk-2026-05-04.md`
- `docs/research/codex-execution-goals-2026-05-04.md`
- `/tmp/medbrains-slim.md`

This backlog converts the research into implementation order. It is intentionally narrower than the master plan: these are the blockers to clear before broad module expansion.

## 2026-05-04 SRS Merge Decisions

- The SRS hardening research is now the business-logic acceptance standard.
- NABH/quality data should be populated from source workflows as evidence sinks. Separate capture screens are only for legacy/offline corrections or events that truly start outside another source module.
- No new runtime SQL and no runtime-SQL escape hatch.
- Day care, HR/payroll/supply chain, fleet/ambulance, workflow engine governance, and NMC medical-college evidence are explicit backlog items, not vague future modules.

## P0: Stop Regression and Prove the Base

### P0.1 Ship Pipeline Gate

Goal: one build/test/deploy path that operators trust.

Work:

- Confirm `make ship`, `make ship-quick`, and `make ship-cold` run the intended chain.
- Ensure `make check-all` includes API contract, UI/API coverage, type coverage, screen audit, runtime SQL ratchet, and migration checks.
- Add post-deploy check for `/health`, login, one CRUD round-trip, schema diff, and audit-chain verification.

Verification:

- `make ship-quick` passes locally.
- Post-deploy script fails non-zero on health/login/CRUD failure.

### P0.2 Migration and DB Doctor

Goal: no new schema bugs like wrong table/column names.

Work:

- Run and harden `scripts/check_migrations.py`.
- Add checks for migration gaps, duplicate table/enum creation, unresolved FKs, RLS columns, trigger functions, orphan tables, orphan columns, and duplicate-purpose tables.
- Generate latest `docs/audit/db-doctor.md`.

Verification:

- Fresh DB migration replay passes.
- Known duplicate-risk list is resolved or documented: supplier payments, discharge summaries, admissions naming.

### P0.3 Compile-Time SQL Ratchet

Goal: new SQL must be compile-time checked.

Work:

- Keep current runtime baseline.
- Block new `query_as::<_, _>`, `query_scalar`, and runtime query additions. No runtime-SQL escape hatch.
- Start `.sqlx/` offline cache workflow.
- Convert first high-risk route group: patients, OPD, IPD, billing, pharmacy.

Verification:

- SQL ratchet check passes.
- First converted route group passes `cargo sqlx prepare --check`.

## P0: Patient Journey and Safety

### P0.4 Patient Context API and Banner

Goal: stop re-entry and missed safety context.

Work:

- Add `GET /api/patients/{id}/context`.
- Include drug allergies, known allergies, chronic meds, last vitals, MLC flag, pending consents, balance, language, diet, room preference, next of kin, primary physician, insurance.
- Add `PatientContextBanner`.
- Wire into OPD, IPD, emergency, lab, radiology, pharmacy, billing, consent, MRD, OT.

Verification:

- Patient with allergy shows warning on Rx/order/dispense screens.
- Existing next-of-kin/diet/language fields default into downstream forms.

### P0.5 Search Not Found -> Create Inline

Goal: eliminate dead-end searches.

Work:

- Build reusable `SearchOrCreate<T>` wrapper.
- Start with patient search in OPD, emergency, IPD, lab, pharmacy POS, billing, insurance.
- Gate create actions by existing permissions.

Verification:

- Search unknown patient in OPD, create from mini-form, selected patient stays in current flow.

### P0.6 Golden Patient Journey E2E

Goal: one full clinical-business route stays green.

Scenario:

- Register patient.
- Start OPD visit.
- Order lab.
- Prescribe Rx.
- Admit IPD.
- Add discharge summary.
- Dispense discharge meds.
- Finalize bill.
- Seal MRD record.

Verification:

- No P0/P1 issue.
- No console errors.
- No 4xx/5xx except intentional validation.
- No RLS leak.

## P0: CPOE and CDS

### P0.7 Unified CPOE Order Basket

Goal: all clinical orders share one lifecycle.

Work:

- Add `cpoe_orders`.
- Support Rx, lab, imaging, consult, procedure, nursing task.
- Emit outbox events for created, accepted, cancelled, completed.
- Link order to billing charge item.

Verification:

- OPD order creates correct lab/pharmacy/radiology work queue item and bill line.

### P0.8 CDS Engine Phase 1

Goal: block unsafe orders at creation.

Work:

- Add CDS rules table and evaluator.
- Implement allergy, duplicate order, drug-drug interaction hook, renal/hepatic dose placeholders with strict audit.
- Require override reason and permission for unsafe override.

Verification:

- Patient allergy blocks matching drug order unless override reason is supplied.
- Override writes audit row.

## P0: Regulatory Evidence

### P0.9 DPDP Breach and Erasure

Goal: DPDP workflows are real, not placeholder screens.

Work:

- Add breach register.
- Add breach notification workflow with 72-hour timer evidence.
- Add erasure request and cascade policy.
- Add DPO registry and DPIA table.

Verification:

- Synthetic breach creates audit row, notification job, and dashboard status.
- Erasure request redacts/deletes according to retention policy and logs every action.

### P0.10 NABH Phase 2 Data Captures

Goal: quality dashboard has source data for the missing indicators.

Work:

- Add falls register.
- Add pressure-ulcer/Braden assessment.
- Add sentinel event register.
- Add transfusion reaction log.
- Add code blue activation log.
- Add equipment downtime log.
- Add fire drill log.
- Add biomedical waste disposal log.
- Add utility outage log.

Verification:

- `scripts/check_nabh_coverage.py` maps each added capture to an indicator.
- Dashboard shows live/pending coverage accurately.

### P0.11 MTP Act Forms

Goal: MTP workflows enforce legal gates.

Work:

- Add Form II consent.
- Add Form III register.
- Add opinion gate for gestational-age thresholds.
- Add medical board decision tracking.

Verification:

- MTP action above threshold cannot proceed without required opinion/board evidence.

### P0.12 ABDM Consent Round Trip

Goal: ABDM consent flow works end to end.

Work:

- Replace stubs with Health ID linkage, consent request, callback, consent grant, record fetch.
- Validate ABDM FHIR profile compatibility for OP consult, prescription, diagnostic report, discharge summary, invoice, document bundle.

Verification:

- Test patient Health ID -> consent request -> approval -> record fetch round-trip.

## P1: Regulatory and Enterprise Parity

### P1.1 PCPNDT and AERB

Work:

- PCPNDT Form F with radiologist signature.
- USG equipment Form A/B registry.
- Sex-determination keyword block.
- AERB RSO registry.
- Occupational dose log.
- Equipment annual QA log.

Verification:

- USG report cannot save prohibited content.
- Occupational dose report compares against configured annual limit.

### P1.2 eMAR Closed-Loop Medication Administration

Work:

- Barcode patient scan.
- Barcode drug/batch scan.
- Five-rights check.
- Administration error log.
- Link dispense -> MAR -> administered stock/audit.

Verification:

- Wrong patient/drug/dose/route/time is blocked or logged as override.

### P1.3 Lab IQC and Critical Values

Work:

- IQC with Westgard rule flags.
- EQAS results and CAPA.
- SOP version acknowledgement.
- Critical-value notification and escalation TAT.

Verification:

- Critical value creates alert, acknowledgement log, and escalation after timeout.

### P1.4 OT Safety and Specimen Tracking

Work:

- WHO surgical safety checklist sign-in/time-out/sign-out.
- Instrument count log.
- Specimen tracking.
- SSI surveillance handoff.

Verification:

- Post-op completion blocked if required checklist/count/specimen fields are missing.

### P1.5 Security and Reliability Evidence

Work:

- MFA/WebAuthn for privileged users.
- IT security incident log.
- Change-management log.
- DR test log with RTO/RPO actuals.
- Vendor security assessment.
- SLO dashboard.

Verification:

- DR drill evidence exists in last 90 days before audit-ready status.

## Execution Order

1. P0.1, P0.2, P0.3
2. P0.4, P0.5, P0.6
3. P0.7, P0.8
4. P0.9, P0.10, P0.11, P0.12
5. P1.1 through P1.5

Do not start broad P2 module expansion until P0.1-P0.12 are either complete or explicitly accepted as deferred risk.
