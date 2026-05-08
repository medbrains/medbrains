# MedBrains Consolidated Master Plan

Date: 2026-05-03

Purpose: preserve and rationalize the user's full master-plan text into one executable roadmap.

This document does not replace the detailed docs. It is the high-level index and execution order.

## Ground Truth

- Product source of truth: `MedBrains_Features.xlsx`
- Generated inventory: `docs/research/module-inventory-2026-05-03.md`
- SRS business-logic hardening: `docs/research/srs-air-tight-business-logic-2026-05-04.md`
- Merged master-plan/SRS crosswalk: `docs/research/merged-plan-srs-crosswalk-2026-05-04.md`
- Feature rows: 2,799
- Global module labels: 180
- Done: 1,360
- Partial: 236
- Pending: 1,203

## Completed Or Already In Motion

The earlier session log says these are shipped or locally built:

- screen checklist generator.
- dead component checker.
- dead permission checker.
- runtime SQL ratchet.
- `make ship`, `ship-quick`, `ship-cold`.
- screen/backend audit parser fixes.
- bedTransfer POST-to-PUT bug fixed.
- audit issue registry seeded.
- invoice item batch/expiry traceability.
- pharmacy batch/expiry to invoice lines.
- auto-billing default on.
- drug allergy cross-check at order creation.
- discharge auto-bag.
- IPD drawer actions menu.
- DAMA and death modals.
- vendor ledger endpoint.
- NABH indicators phase 1 with 11 live indicators.
- post-discharge IPD workflow tables and handlers.
- patient form expansion.
- pharmacy stock pre-check and consumption-report filter.

These need verification before they are treated as fully closed:

- post-deploy health/login/CRUD.
- pharmacy consumption auto-update.
- IPD drawer actions reachability.
- NABH dashboard route/permission.
- patient field round-trip.

## Track 0: Stabilize The Product Before Expansion

### Track 0.alpha: Screen Sweep

Goal: every screen, field, button, table, modal, drawer, filter, and action is manually or smoke verified.

Priority:

1. P0 clinical patient-touching pages.
2. P1 operations pages.
3. P2 admin, quality, specialty, settings.
4. P3 onboarding and low-traffic pages.

Deliverables:

- per-screen checklist files.
- page-load smoke.
- form round-trip smoke for feasible forms.
- open issues in `docs/audit/issues.md`.
- done tracker in `docs/audit/done-pages.md`.

### Track 0.bis: IPD Drawer Overhaul

Goal: make the admission drawer behave like a real admission command center.

Must include:

- status-aware action menu.
- discharge workflow.
- DAMA/LAMA.
- mark death.
- wristband/barcode.
- transfer out.
- quick Rx/lab/imaging.
- interim bill.
- consent.
- mortuary.
- attendant passes.
- code blue.
- alert chips for MLC, allergy, consents, unread labs, overdue tasks.

### Track 0.ter: Pharmacy Follow-Ups

Goal: close pharmacy, IPD, billing, procurement, and supplier finance loops.

Immediate wins:

- auto-bill on dispense.
- drug-allergy check at Rx/order creation.
- discharge meds auto-bag.
- batch ID propagation to billing.
- supplier ledger.
- supplier invoice entry.
- GRN PDF.
- supplier return to ledger.

Later:

- stock reservation.
- substitute suggestions.
- NDPS witness gate at creation.
- indent receive creates pharmacy batch.
- rate contracts.
- vendor KPIs.
- CDSCO license verification.
- RFQ flow.

### Track 0.gamma: Infra / DB / Linkage Hygiene

Goal: prove migrations, schema, route/page linkages, and redeploy paths.

Must include:

- migration idempotency.
- version gap check.
- duplicate table/enum check.
- FK/RLS/trigger check.
- orphan table/column check.
- duplicate-purpose table check.
- dead route/component/permission check.
- module linkage graph.
- cold-start, upgrade, rollback, and DR drills.
- offline mode verification.

### Track 0.delta: Compile-Time SQL

Goal: new query bugs are caught before runtime.

Must include:

- SQLx CLI and `.sqlx/` offline cache.
- CI prepare check.
- no-new-runtime-query ratchet.
- route-by-route conversion.
- no runtime-SQL escape hatch for new code.
- contributor workflow update.

### Track 0.epsilon: Ship Pipeline

Goal: one release path for local and CI.

Required chain:

1. lint.
2. typecheck.
3. unit tests.
4. contract tests.
5. audit checks.
6. DB doctor.
7. build.
8. smoke tests.
9. E2E tests.
10. deploy.
11. post-deploy health/login/CRUD.

### Track 0.eta: Business Logic UX And Data Linkage

Goal: make modules work as one hospital workflow, not isolated pages.

Sub-tracks:

- A: Search not found -> create inline.
- B: cross-module field auto-population.
- C: reversible workflows and undo.
- D: state-change cascades.
- E: hand-drawn journey wiring.
- F: department/role-aware queues.
- G: bulk actions.
- H: templates, recents, favorites, SmartPhrases.
- I: context-aware validation.
- J: Print Center.
- K: ClinicalEventProvider and live event bus.
- L: timezone consistency.
- M: field-linkage matrix.

## Track 1: Backend And Module Completion

Goals:

- zero schema/runtime mismatch.
- complete modules from Excel.
- hardware adapters for open protocols.

Priority module work:

- ER triage TAT.
- IPD assessment timestamps.
- lab/imaging quality audit tables.
- MR audit tracker.
- falls and pressure ulcer registers.
- equipment downtime.
- NABH 76 dashboard completion.
- all pending Excel module rows by priority.

## Track 1A.bis: IPD Post-Discharge

Must include:

- discharge card.
- medication reconciliation.
- take-home pharmacy dispense.
- patient counseling.
- DAMA/LAMA.
- absconded patient workflow.
- death summary and civil registration.
- inter-hospital transfer.
- OPD follow-up creation.
- final bill reconciliation.
- TPA final settlement.
- insurance claim packet.
- bed release to housekeeping.
- survey trigger.
- readmission risk flag.
- mortality review queue.
- continuity of care handoff.
- frozen records after discharge.

## Track 1A.bis.5: Patient Journey Wiring

Canonical walk-in path:

- patient entry -> OPD -> casualty/diagnostics -> lab/radiology/TMT/physio -> pharmacy -> IPD -> OT -> ICU -> IPD -> billing -> MRD -> discharge.

Canonical emergency path:

- accident/attack -> casualty -> emergency OT/OT -> ICU -> pharmacy -> IPD -> diagnosis -> billing -> MRD -> discharge.

Missing or partial handoffs:

- OPD to casualty escalation.
- TMT/cardiology diagnostics.
- physiotherapy scheduling.
- OPD to OT booking.
- OT to ICU step-up.
- ICU to IPD step-down.
- billing auto-finalize on discharge.
- MRD seal event.
- MLC auto-flag.
- emergency OT urgency tag.

## Track 2: Frontend Clients

### Web

- harden CSP.
- add E2E golden paths.
- add field redaction.

### Desktop

- Tauri 2 wrapper.
- native installers.
- auto-updater.
- print/device bridge.
- all-in-one clinic edition.

### Mobile

- React Native CLI.
- Paper v5.
- WatermelonDB.
- staff, doctor/nurse, patient, vendor apps.
- BLE, barcode, biometric, push, background sync.
- encrypted storage.

### TV

- Android TV queue boards.
- bed boards.
- code-blue alerts.
- focus/D-pad support.
- WebSocket updates.

### PWA

- service worker.
- manifest/icons.
- reference-data caching.
- update toast.

## Track 3: Offline, Sync, CRDT, Authz

Must include:

- pack export.
- pack pull.
- pack push.
- signed authz manifest.
- device binding.
- field redaction.
- SpiceDB bulk checks.
- conflict review.
- encryption at rest.
- pack sync audit.
- no offline controlled-substance writes.

## Track 4: Security

Must include:

- threat model.
- TLS 1.3.
- Ed25519 signing.
- AES-256-GCM.
- PBKDF2-SHA256.
- Argon2id.
- TOTP.
- WebAuthn.
- mobile biometric.
- audit forensics.
- S3 Object Lock.
- SIEM/log forwarding.
- secrets manager.
- key rotation.

## Track 5: Authorization

Must include:

- SpiceDB schema completeness.
- camp permissions.
- patient consent sharing.
- time-bound permissions.
- bulk check optimization.
- Redis permission cache.
- offline manifest as advisory, server as authority.

## Track 6: Open Formats

Must include:

- JSON + OpenAPI 3.1.
- typed WebSocket JSON envelopes.
- Loro binary plus JSON manifest.
- FHIR R4.
- LOINC.
- WHO INN/ATC/RxNorm.
- ICD-10/ICD-11.
- DICOM/DICOMweb.
- PDF/A-3 and PDF/UA.
- CSV/NDJSON.
- open-format lint.

## Track 7: Compliance

Must include:

- NABH 76 indicators.
- DPDP consent, breach, erasure, DPO, DPIA.
- ABDM HIE consent and FHIR export.
- HIPAA-equivalent controls.
- NDPS.
- PCPNDT.
- MTP.
- BMW.
- Mental Healthcare Act.
- AERB.
- NABL.

## Track 8: Infrastructure

Must include:

- Starter tier.
- Growth tier.
- Enterprise k3s.
- Enterprise EKS.
- Edge tier.
- Object Lock backups.
- cross-region replication.
- DR restore drills.
- metrics, tracing, logs, dashboards, alerting.
- mobile/desktop CI.
- Helm releases.
- schema diff CI.
- security scans.

## Track 9: Hardware Integration

Must include:

- BLE vitals.
- USB serial devices.
- DICOM gateway.
- barcode/QR scanners.
- label printers.
- HL7 v2 listener.
- nurse call/code blue/fire alarm adapters.
- card readers.
- cash drawer and receipt printer.

## Track 10: Tests

Must include:

- Rust unit/integration tests.
- TS/Vitest tests.
- Playwright smoke.
- Playwright scenario tests.
- page-load tests.
- form round-trip tests.
- Goose load tests.
- OWASP ZAP.
- cargo-audit.
- pnpm audit.
- Trivy.
- axe-core accessibility.

## Track 11: Documentation

Must include:

- format guarantees.
- threat model.
- disaster recovery.
- breach runbook.
- operator onboarding.
- OpenAPI docs.
- JSON schemas.
- NABH monthly report runbook.
- quarterly DR drill runbook.
- key rotation runbook.
- mobile RFC.
- desktop RFC.
- offline pack RFC.
- authz manifest RFC.

## Recommended Execution Order

1. Verify current Claude Code changes compile and deploy.
2. Ship pipeline.
3. Compile-time SQL ratchet.
4. DB/infra/linkage doctor.
5. Screen sweep P0/P1 pages.
6. IPD drawer and pharmacy follow-ups.
7. Patient journey wiring and business logic linkage.
8. NABH Phase 2 and regulatory evidence.
9. Desktop/mobile/TV/offline.
10. Security/authz/open formats.
11. Infrastructure tiers, hardware, load/security/a11y tests, documentation.

## Parallelization Rule

While Claude Code is actively editing code, Codex should stay in docs and planning. Code work starts only after ownership is clear.
