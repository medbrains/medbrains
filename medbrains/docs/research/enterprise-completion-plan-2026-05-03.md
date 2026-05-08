# MedBrains Enterprise Completion Plan

Date: 2026-05-03

This plan merges these local inputs:

- `MedBrains_Features.xlsx`
- `RFCs/old/RFC_FINAL.txt`
- `RFCs/modules/RFC-MODULE-onboarding.md`
- `RFCs/modules/RFC-MODULE-patient-registration.md`
- `RFCs/RFC-INFRA-2026-001-CRDT-K8s-Terraform.md`
- `/tmp/medbrains-slim.md`
- `/tmp/medbrains-archive.md`
- `docs/research/srs-air-tight-business-logic-2026-05-04.md`
- `docs/research/merged-plan-srs-crosswalk-2026-05-04.md`

It also checks the current public standards and regulatory sources listed at the end of this file.

## Ground Truth

The workbook is the no-skip module source of truth.

- Sheets scanned: 13
- Feature rows: 2,799
- Distinct module labels globally: 180
- Distinct module labels by sheet: 182
- Status totals: Done 1,360, Partial 236, Pending 1,203

The generated module inventory is here:

- `docs/research/module-inventory-2026-05-03.md`

The principal-engineer conclusion is blunt: MedBrains should not be completed by randomly sweeping pages. It should be completed by proving four things for every module: forms, logs, cascades, and reports. Page sweeps still matter, but they are verification, not architecture.

## Research Conclusion

Enterprise HMS/EHR programs converge on the same operating model:

1. Patient identity and encounter context are shared everywhere.
2. Orders are central: CPOE creates lab, imaging, pharmacy, consult, procedure, nursing, and billing work.
3. Medication safety is enforced before order acceptance, not only during dispense.
4. Closed-loop medication administration uses patient, drug, dose, route, time, clinician, and barcode evidence.
5. Safety and regulatory evidence is captured as structured logs, not as free-text notes.
6. Audit, permissions, tenant isolation, backup, rollback, and release evidence are first-class product features.

MedBrains already has a large amount of module surface. The highest-risk gaps are cross-module safety and evidence capture:

- CPOE plus CDS is the biggest blocker for EMRAM, JCI medication safety, and NABH medication-management maturity.
- DPDP breach and erasure workflows need actual round-trip evidence, not placeholder screens.
- NABH Phase 2 indicators need source tables for falls, pressure ulcers, sentinel events, transfusion reactions, code blue, equipment downtime, fire drills, biomedical waste disposal, DR tests, and related captures.
- Pharmacy needs full medication-safety closure: allergies, interactions, AWaRe, NDPS/Schedule X, FEFO, batch traceability, eMAR, and barcode administration.
- Diagnostics need LOINC/DICOM/NABL evidence paths: IQC, EQAS, calibration, critical-value notification, radiation dose, PCPNDT, AERB.

## Execution Principles

Use these as hard rules:

- No module is complete unless it has forms, logs, cascades, reports, permissions, API methods, routes, migrations, tests, and audit evidence.
- No new runtime SQL and no runtime-SQL escape hatch.
- No state transition without a transaction, typed outbox event, audit row, `*_at`, `*_by`, and rollback story.
- No tenant-scoped database action without tenant context set in the transaction.
- No regulatory form as only a PDF. The form must have structured fields, validation, storage, export, and audit log.
- No clinical catalog without coding hooks: ICD, LOINC, INN, ATC, RxNorm, SNOMED CT, DICOM, or ABDM FHIR where applicable.
- No screen marked done until it passes page-load smoke, no console errors, no 4xx/5xx on load, role guard, and checklist.

## Enterprise Workstreams

### 0. Release, DB, and Linkage Hardening

Purpose: stop shipping regressions before expanding the feature surface.

Must finish:

- `make ship`, `ship-quick`, and `ship-cold` as the only release paths.
- `make check-all` with API contract, UI/API coverage, type coverage, runtime SQL ratchet, screen audit, and regulatory checks.
- `make db-doctor`: migration gaps, duplicate tables, orphan FKs, RLS policy checks, trigger checks, duplicate-purpose tables.
- `make linkage-doctor`: dead components, dead permissions, dead routes, page/API mismatches, module graph.
- SQLx offline cache and route-by-route migration to compile-time checked queries.
- Post-deploy health, login, canonical CRUD, schema diff, audit-chain verification.

Done when:

- No RED rows in screen/backend audit.
- No new runtime SQL.
- Fresh DB migration replay passes.
- Rollback drill is documented and verified.

### 1. Patient Identity and Patient Journey

Covered modules:

- Onboarding and tenant setup
- Patient registration
- MPI, duplicates, merge
- ABHA/ABDM health ID
- Consent
- OPD
- Emergency
- IPD
- ICU
- OT
- Diagnostics
- Pharmacy
- Billing
- MRD
- Discharge
- Mortuary

Must finish:

- Universal patient search with "not found -> create inline" on OPD, ER, IPD, lab, radiology, pharmacy POS, billing, insurance, visitor, and ambulance flows.
- `GET /api/patients/{id}/context`: allergies, drug allergies, chronic meds, last vitals, MLC, consents, balances, language, room preference, diet, next of kin, primary physician, insurance.
- `PatientContextBanner` on every patient-touching clinical and financial screen.
- Full golden path: register -> OPD -> lab -> Rx -> IPD -> OT/ICU if needed -> discharge -> billing close -> MRD seal.
- Unknown patient and emergency walk-in flow with later merge.

Done when:

- One full patient journey is green with zero P0/P1 issues, zero console errors, and zero RLS leaks.
- Patient context round-trips into forms instead of forcing re-entry.

### 2. CPOE and CDS

Covered modules:

- OPD orders
- IPD orders
- Emergency orders
- Lab orders
- Radiology orders
- Pharmacy/Rx
- Consult orders
- Procedure orders
- Nursing tasks
- Billing charge capture

Must finish:

- Unified CPOE order basket and order lifecycle.
- CDS engine for allergy, drug-drug interaction, duplicate order, renal/hepatic dose, pregnancy/lactation, age/weight dose, contraindication, and required consent.
- Rule registry with versioning and audit.
- CPOE-to-billing charge linkage.
- CPOE-to-lab/radiology/pharmacy work queues.
- CDS override reason, reviewer, timestamp, and audit.

Done when:

- Orders create downstream work without re-entry.
- CDS blocks unsafe orders unless a permitted override is recorded.
- Every order status change emits an outbox event and audit row.

### 3. Clinical Care Modules

Covered modules:

- OPD
- Appointments
- Emergency/casualty
- IPD
- ICU
- OT
- Nursing
- Chronic care
- Case management
- Consent
- MRD
- Mortuary
- Ambulance

Must finish:

- OPD: queue, encounter, diagnosis, order, Rx, follow-up, referral, escalation to ER/IPD.
- Emergency: triage, MLC auto-flag, stabilization, transfer, brought-dead checklist, code blue.
- IPD: admission, bed, transfer, orders, nursing plan, vitals, discharge workflow, DAMA, mortality review, post-discharge follow-up.
- ICU: ventilator, sepsis, central-line, urinary-catheter, dialysis, transfusion, scoring.
- OT: WHO surgical safety checklist, pre-op, anesthesia, time-out, instrument count, specimen tracking, post-op handoff.
- MRD: chart completion, amendment, retention, access log, seal after discharge.

Done when:

- Each module has forms, logs, cascades, and reports.
- Clinical state transitions are reversible within policy windows.

### 4. Diagnostics and Support

Covered modules:

- Laboratory
- Radiology
- Blood bank
- Sample collection
- Imaging
- Device integration
- Infection control
- Biomedical engineering

Must finish:

- Lab: LOINC mapping, specimen barcode, rejection log, IQC, EQAS, calibration, critical-value notification TAT.
- Radiology: DICOM/DICOMweb, order worklist, reporting, contrast consent, radiation dose, AERB evidence, PCPNDT controls.
- Blood bank: donor, TTI, unit barcode, crossmatch, issue, transfusion reaction, quarantine.
- Device integration: HL7 v2/DICOM/serial/BLE gateway, device auth, failure queue.

Done when:

- Critical results alert the ordering clinician and escalate if unacknowledged.
- Diagnostic reports can be exported as ABDM/FHIR-compatible documents.

### 5. Pharmacy and Medication Administration

Covered modules:

- Pharmacy catalog
- Pharmacy orders
- Formulary
- Stock/batches
- Procurement linkage
- NDPS/Schedule X
- eMAR
- Adverse drug reactions
- Antibiotic stewardship

Must finish:

- WHO INN generic names, ATC, RxNorm, CDSCO schedule, AWaRe class, LASA flag, controlled-substance flag.
- FEFO batch selection and batch-to-invoice traceability.
- NDPS and Schedule X dual-witness registers.
- Allergy and interaction checks at order creation.
- AWaRe Reserve restriction to infectious-disease or approved specialist role.
- eMAR barcode 5-rights administration.
- ADR/PvPI reporting path.

Done when:

- Prescription -> dispense -> invoice -> eMAR -> stock decrement -> audit is atomic and traceable.

### 6. Revenue Cycle and Finance

Covered modules:

- Billing
- Insurance
- TPA/pre-auth
- Packages
- Rate plans
- Advances
- Refunds
- GL postings
- Pharmacy finance
- Vendor ledger

Must finish:

- Atomic charge capture from CPOE, dispense, procedures, bed, diagnostics, and services.
- Cancel/reverse flows with GL reversal and audit.
- Insurance eligibility, pre-auth, denial, co-pay, out-of-pocket max, secondary insurance fallback.
- Package and rate-plan lifecycle with backend route parity.
- Discharge bill finalization and reopen policy.

Done when:

- Order cancel reverses bill line.
- Discharge cannot complete with unresolved financial gates unless policy override is recorded.

### 7. Operations, Supply Chain, and Facility

Covered modules:

- Inventory
- Indent
- Procurement
- Vendors
- CSSD
- Diet kitchen
- Housekeeping
- Facilities
- BME
- HR
- LMS
- Security
- Front office
- Visitor management
- Ambulance

Must finish:

- Vendor onboarding, license/cert expiry, scorecards, contracts, GRN, payments, supplier returns.
- CSSD sterilization cycle, instrument set traceability, OT handoff.
- Housekeeping bed-state integration after transfer/discharge.
- Diet orders default from patient preference and IPD care plan.
- BME equipment downtime, maintenance, calibration, QA logs.
- HR license expiry blocks clinical privileges where required.

Done when:

- Clinical flows create operational work automatically instead of via manual calls.

### 8. Quality, Compliance, and Regulatory Evidence

Covered modules:

- NABH indicators
- JCI IPSG
- DPDP
- ABDM
- Consent
- Regulatory
- Audit
- Infection control
- Biomedical waste
- MTP
- PCPNDT
- AERB
- Mental healthcare
- NDPS
- Drugs and Cosmetics
- Clinical establishments

Must finish:

- NABH 76 indicators with source-table coverage and monthly snapshot.
- DPDP breach notification, data principal requests, erasure cascade, DPO registry, DPIA.
- ABDM consent round-trip and FHIR profile conformance.
- MTP Form II/III and opinion gates.
- PCPNDT Form F, equipment Form A/B, radiologist signature, sex-determination keyword block.
- AERB RSO registry, occupational dose, equipment QA.
- BMW disposal log and annual report evidence.

Done when:

- `scripts/check_nabh_coverage.py` passes.
- `scripts/check_regulatory_forms.py` passes.
- Audit pack can be generated without manual spreadsheet assembly.

### 9. Specialty, Academic, Patient Experience, and CMS

Covered modules:

- Specialty pages
- Psychiatry
- Medical college
- Academic ERP
- PG logbook
- LMS
- Patient app
- Patient portal
- Campaigns
- CMS and blog
- Feedback/surveys

Must finish:

- Specialty workflows tied into the same patient, order, billing, and MRD model.
- Psychiatry compliance with Mental Healthcare Act consent, advance directives, restraint, and confidentiality.
- Academic ERP/PG logbook tied to case exposure, procedures, faculty signoff, and competency.
- Patient app/portal with appointments, reports, prescriptions, bills, consent, and surveys.
- CMS kept separate from clinical PHI and tenancy boundaries.

Done when:

- Specialty modules do not fork patient or encounter models.
- Patient-facing data is consented, redacted, and auditable.

### 10. Mobile, TV, Desktop, Offline, and Edge

Covered modules:

- Mobile Apps sheet
- TV Displays and Queue sheet
- Desktop/Tauri
- PWA fallback
- Offline sync
- Edge tier
- Universal app platform

Must finish:

- Mobile staff shell with auth, device binding, offline-safe clinical views, barcode scan, push, biometric unlock.
- Patient mobile app with reports, appointments, bills, consent, and notifications.
- Android TV queue boards, bed boards, code alerts, and high-contrast layouts.
- Tauri desktop bridge for printers, scanners, USB serial, cash drawer, and local hardware.
- Offline pack export/pull/push with signed manifest, field redaction, device binding, and conflict review.
- Edge clinic mode for low-connectivity sites.

Done when:

- Offline pack export is permissioned and audited.
- Offline writes cannot bypass controlled-substance or high-risk regulatory rules.

### 11. Data, Interoperability, and Open Formats

Covered modules:

- FHIR
- ABDM/NHCX
- HL7 v2
- DICOM/DICOMweb
- OpenAPI
- Analytics builder
- Data warehouse
- Reports
- Exports

Must finish:

- OpenAPI 3.1 published and contract-tested.
- FHIR R4/ABDM profiles for patient, encounter, prescription, diagnostic report, discharge summary, invoice, document bundle.
- DICOMweb QIDO/WADO/STOW bridge for imaging.
- HL7 v2 adapter for lab analyzers and instruments.
- LOINC for labs/observations, ICD-10/ICD-11 for diagnoses, WHO INN/ATC/RxNorm for drugs.
- CSV/NDJSON/PDF-A export policy.

Done when:

- External interchange is standards-based and does not require proprietary formats.

### 12. Platform, Security, Reliability, and Enterprise Operations

Covered modules:

- IT, security, infrastructure
- Technical infrastructure
- K8s platform
- DB topology
- Observability
- Backup/DR
- Authz/RBAC
- SpiceDB/ReBAC
- Audit chain
- Multi-hospital/vendor

Must finish:

- SpiceDB/ReBAC for scoped and time-bound permissions.
- MFA/WebAuthn for privileged actions and pack export.
- Audit log hash chain for PHI reads/writes and state changes.
- Prometheus/Grafana/OTLP/Loki or CloudWatch integration.
- SLOs for availability, latency, error rate, backup success, and patient-facing workflows.
- DORA metrics for delivery health.
- Starter, Growth, Enterprise-k3s, Enterprise/EKS, and Edge deployment runbooks.
- DR restore drill in sibling environment at least quarterly.

Done when:

- Production deploy has rollback, backup, audit, and post-deploy verification evidence.

## Critical Path

### Phase 0: Current Stabilization, 1-2 weeks

- Finish Track 0.alpha/gamma/delta/epsilon tooling.
- Regenerate page checklists and file known P0/P1 issues.
- Make screen audit strict.
- Make compile-time SQL ratchet strict for new code.
- Confirm 0107-0109 migrations and deployed fixes.
- Run P0 clinical page sweep: patients, OPD, appointments, IPD, emergency, lab, radiology, blood bank, pharmacy, billing, consent, MRD, OT.

### Phase 1: P0 Audit Blockers, 8 weeks

- CPOE plus CDS.
- DPDP breach and erasure.
- NABH Phase 2 data captures.
- MTP Form II/III.
- ABDM Consent Manager real round-trip.
- Patient context API and banner.
- Full patient journey scenario test.

### Phase 2: Regulatory and Enterprise Parity, 12-16 weeks

- PCPNDT Form F and equipment registry.
- AERB RSO/dose/equipment QA.
- AWaRe Reserve restriction.
- ICD-11 dual coding.
- Security incident, change management, DR-test logs.
- MFA/WebAuthn.
- SmartPhrases, clinician inbox, SOFA/NEWS2/qSOFA.
- WHO surgical safety checklist.
- Lab IQC/Westgard and critical-value TAT.
- eMAR barcode 5-rights.

### Phase 3: All-Module Completion, 16-28 weeks

- Work down the 1,203 pending and 236 partial workbook rows by sheet priority.
- Each module gets forms, logs, cascades, reports, route/API parity, permissions, tests, and audit evidence.
- Page sweeps close all P0/P1 items.
- P2 polish follows by domain.

### Phase 4: Stage 6/Enterprise Maturity

- FHIR Bulk Data export.
- SMART on FHIR and CDS Hooks.
- Population health cohort builder.
- IHE XDS document sharing.
- Advanced analytics and clinician storyboard.
- Ambient AI only via vetted partner, not custom build.

## Acceptance Gates

### Module Complete

- RFC updated.
- Regulatory requirements documented.
- Migration exists and replays.
- Backend route exists.
- API client method exists.
- Frontend page uses permission guard.
- Element permissions applied.
- Tests cover at least one happy path and one denied/validation path.
- Smoke test exists.
- Audit rows are emitted for state changes.
- Workbook status updated.

### Audit Ready

- Zero open P0/P1 issues.
- All NABH 76 indicators mapped to source data or explicit pending rationale.
- DPDP breach notification round-trip tested.
- ABDM consent round-trip tested.
- Audit-chain verification passes.
- DR restore drill completed in last 90 days.
- Full patient journey green.
- No cross-tenant RLS leak.

### Stop Conditions

- Hash-chain break.
- RLS leak.
- Migration replay failure.
- Compile-time SQL ratchet failure.
- DPDP breach notification failure.
- Any P0 blocker slips more than two weeks.

## Source References

- HL7 FHIR R4 modules: https://hl7.org/fhir/R4/modules.html
- ABDM FHIR R4 Implementation Guide: https://nrces.in/ndhm/fhir/r4/index.html
- NABH Hospital Accreditation Programme: https://nabh.co/programmes/hospitals-accreditation-programme-hco/
- HIMSS EMRAM: https://www.himss.org/maturity-models/emram/
- JCI International Patient Safety Goals: https://www.jointcommission.org/en/standards/international-patient-safety-goals
- Clinical Establishments Act portal: https://www.clinicalestablishments.mohfw.gov.in/en/about-us
- DPDP Act 2023 official PDF: https://www.meity.gov.in/static/uploads/2024/02/Digital-Personal-Data-Protection-Act-2023.pdf
- CDSCO Drugs and Cosmetics Act page: https://cdsco.gov.in/opencms/opencms/en/Acts-and-rules/Drugs-and-Cosmetics-Act/
- Bio-Medical Waste Management Rules 2016: https://dhr.gov.in/document/guidelines/bio-medical-waste-management-rules-2016
- WHO AWaRe 2025: https://www.who.int/publications/i/item/B09489
- WHO INN: https://www.who.int/teams/health-product-and-policy-standards/inn%EF%BB%BF
- RxNorm overview: https://www.nlm.nih.gov/research/umls/rxnorm/overview.html
- LOINC overview: https://loinc.org/get-started/what-loinc-is/
- DICOMweb: https://www.dicomstandard.org/using/dicomweb
- NIST SSDF SP 800-218: https://csrc.nist.gov/pubs/sp/800/218/final
- OWASP ASVS: https://owasp.org/www-project-application-security-verification-standard/
- Google SRE SLO guidance: https://sre.google/sre-book/service-level-objectives/
- DORA metrics: https://dora.dev/guides/dora-metrics/
