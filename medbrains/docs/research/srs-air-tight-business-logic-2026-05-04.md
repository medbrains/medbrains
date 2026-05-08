# SRS Business Logic Hardening - 2026-05-04

Source document: `/Users/apple/Downloads/Draft Software Requirements Specification 04302026 (1).docx`

Purpose: convert the SRS from a high-level feature inventory into implementation-grade business logic. This is the checklist to use before coding, refactoring, or marking any module complete.

## Executive Finding

The SRS covers the right breadth for a 600-bed multi-specialty hospital plus medical college, but most items are stated as capabilities, not rules. To make the system airtight, every module must be specified as:

1. Source of truth: which table/module owns each fact.
2. Lifecycle: statuses, allowed transitions, who can trigger them, and rollback rules.
3. Transaction boundary: what must commit together.
4. Cross-module events: what downstream modules must update automatically.
5. Safety gates: what the backend must block.
6. Compliance evidence: what is recorded for NABH/NMC/ABDM/DPDP/Drugs and Cosmetics/BMW/AERB/NACO.
7. Audit trail: who did what, from where, under which permission, and whether PHI was read or changed.
8. Exception flow: emergency, downtime, offline camp, unknown patient, death, MLC, insurance denial, refund, correction, and amendment.

The system should not add separate "capture" screens when the data already exists in a source workflow. Compliance tables should be evidence sinks populated from source events. Manual capture is allowed only for legacy entry, offline reconciliation, or incidents that genuinely start outside a source module.

## Official Standards Checked

Use these as primary anchors when expanding module RFCs:

- NABH hospital accreditation: patient safety and quality chapters AAC, COP, MOM, PRE, HIC, PSQ, ROM, FMS, HRM, IMS.
  Source: https://portal.nabh.co/Hospitals.aspx
- NABH emergency certification: emergency care, medication, infection control, quality improvement, FMS.
  Source: https://portal.nabh.co/Emergency_Intro.aspx
- NMC UG curriculum and medical college governance: competency curriculum, logbooks, assessment, skill training, disclosures.
  Source: https://www.nmc.org.in/information-desk/for-colleges/ug-curriculum
- NMC UG Medical Education Board functions: standards, infrastructure, faculty, quality, annual disclosures.
  Source: https://www.nmc.org.in/?p=4545
- ABDM/HFR/HPR ecosystem: facility identity, professional registry, health record linking and consent.
  Sources: https://facility.abdm.gov.in/ and https://doctorsbx.abdm.gov.in/apidocuments
- DPDP Act 2023: lawful processing, notice, consent, obligations, access/correction/erasure, grievance, significant fiduciary duties.
  Source: https://www.indiacode.nic.in/handle/123456789/22037
- Biomedical Waste Management Rules 2016 and amendments: segregation, storage, barcoding, reporting.
  Source: https://www.vmmc-sjh.mohfw.gov.in/bio-medical-waste-management-rules-2016
- Drugs and Cosmetics Act/Rules: drug schedules, Schedule X records, blood bank licensing/inspection records.
  Source: https://cdsco.gov.in/opencms/opencms/en/Acts-and-rules/
- NACO blood safety expectations: licensed blood banks, mandatory screening, clinical appropriateness, bedside documentation.
  Source: https://naco.gov.in/faqs
- AERB diagnostic radiology: X-ray/CT/C-arm licensing, eLORA, qualified staff, shielding and display of license.
  Source: https://www.aerb.gov.in/index.php/regulatory-facilities/radiation-facilities/application-in-medicine/diagnostic-radiology

## Enterprise Airtight Pattern

Every state-changing handler must follow this pattern:

1. Authenticate user and load tenant, campus, department, role, device, and break-glass state.
2. Check permission at route and entity scope.
3. Start transaction.
4. Set tenant and department RLS context.
5. Lock the source row if updating a lifecycle state.
6. Validate current state, input, ownership, and patient safety gates.
7. Write the source-of-truth row.
8. Write audit log and append outbox event inside the same transaction.
9. Mirror compliance evidence into NABH/NMC/BMW/etc. evidence tables inside the same transaction where possible.
10. Dispatch cascades in transaction for billing, stock, bed, MRD, queue, and notifications when the downstream result must be atomic.
11. Commit.
12. Async workers perform non-critical side effects only: SMS, WhatsApp, email, external APIs, PDF rendering, analytics rollups.

No module is complete until it has:

- Create, update, cancel/void, restore/amendment rules.
- Idempotency key for every non-read operation that can be retried.
- Row-level audit with previous and new values for sensitive fields.
- Permission tests for create/update/delete/approve/export.
- Source event names for cross-module updates.
- Smoke test for happy path and at least one blocked unsafe path.

## Global Invariants

These rules apply across all modules.

| Area | Airtight rule |
|---|---|
| Patient identity | Every clinical action must bind to patient_id plus encounter_id/admission_id where applicable. Unknown emergency patients get temporary identity with mandatory reconciliation workflow. |
| Deletion | Clinical, billing, pharmacy, blood bank, radiology, consent, and academic records are never hard-deleted. Use void/amend/supersede with reason and supervisor approval. |
| Time | Store UTC, display tenant/user timezone. Clinical timestamps must include recorded_at and observed_at when different. |
| Consent | Consent is scoped by purpose, language, patient/guardian, witness, version, expiry/revocation, and document hash. |
| Charge capture | Clinical/procedure/stock actions create billing events automatically. Manual bill line entry is an exception, not the default. |
| Stock | No dispense/issue/administer without batch, expiry, store, quantity, and transaction ledger row. |
| Safety | Allergy, interaction, LASA, high-alert, dose, duplicate-order, pregnancy, renal/hepatic, pediatric/neonatal checks run before prescription and again before dispense/administer. |
| Offline | Offline writes queue with source device, pack id, vector/version, and conflict policy. Restricted operations such as NDPS and high-risk irreversible actions require online mode. |
| Audit | Every PHI read/write/export is audit-logged. Break-glass logs reason, scope, expiry, and supervisor review queue. |
| Reporting | Dashboards derive from source events or evidence sinks, not from free-text notes. |
| SQL | New SQL must use SQLx compile-time macros and committed `.sqlx` metadata. Normal build/deploy remains `SQLX_OFFLINE=true`. |

## Module Hardening Matrix

### 1. Platform, Deployment, Security, Offline

Gaps in SRS: high availability, cloud, RBAC, MFA, and offline are listed, but not operationalized.

Airtight requirements:

- Define RTO/RPO by tier: Starter, Growth, Enterprise, Edge.
- Multi-tenant isolation must be enforced by RLS, not only application filters.
- MFA required for admin, export, break-glass, offline pack export, mass delete/void, discount override, controlled drugs, and user permission changes.
- Offline packs must be scoped, signed, encrypted, expiring, revocable, and device-bound.
- Production deploy must never run SQLx metadata generation. Deploy only applies embedded migrations on startup and performs post-deploy smoke checks.
- Every external integration has circuit breaker, retry policy, idempotency key, dead-letter queue, and reconciliation screen.

Acceptance tests:

- Attempt cross-tenant data read with forged tenant id -> 403/empty.
- Attempt `make prepare-sqlx` with production-looking DATABASE_URL -> blocked.
- Export offline pack, revoke permission, then sync write -> rejected.

### 2. Multi-Hospital and Patient Movement

Gaps in SRS: transfer request, bed visibility, notes, billing handover are listed without rules.

Airtight requirements:

- Unified patient ID is global, but encounter/admission remains facility-scoped.
- Transfer has states: draft, requested, accepted, bed_reserved, ambulance_assigned, departed, arrived, admitted, cancelled.
- Sending hospital cannot close transfer until receiving hospital acknowledges patient arrival or transfer is cancelled.
- Billing handover freezes source facility interim bill, transfers deposit/refund/write-off status, and creates receivable/payable linkage.
- Clinical handover must include diagnosis, allergies, active orders, medications, recent vitals, pending results, MLC flag, consent packet, and infection isolation status.
- Ambulance transfer cannot start without pickup/drop, staff, vehicle, risk level, and emergency contact.

### 3. Patient Onboarding, Queue, Kiosk

Gaps in SRS: registration and tokens are listed, but not the no-match, duplicate, identity, and priority logic.

Airtight requirements:

- Search-on-miss must allow inline patient creation from OPD, ED, lab, pharmacy, billing, insurance, and camp workflows.
- Duplicate detection uses phone, ABHA, government ID, DOB/name, guardian phone, and fuzzy match.
- Registration states: provisional, active, merged, deceased, unknown_pending_identity, blocked.
- Token priority is deterministic: emergency > senior citizen/disabled/pregnant > scheduled appointment > walk-in, with audit when priority is overridden.
- Kiosk self-registration creates provisional records until staff verifies identity and consent.
- ABHA linking requires consent and stores consent artifact, request id, and response id.

### 4. OPD

Gaps in SRS: OPD has breadth but lacks end-to-end state rules.

Airtight requirements:

- OPD visit lifecycle: registered, checked_in, vitals_pending, waiting_doctor, in_consultation, orders_pending, billing_pending, pharmacy_pending, followup_scheduled, completed, no_show, cancelled.
- No-show must be reversible with audit. Cancellation must reverse unperformed auto-billed lines.
- Doctor can start consult only after check-in unless break-glass/emergency.
- Orders from OPD must carry diagnosis/indication, priority, ordering doctor, encounter id, and billing policy.
- Follow-up scheduling should default from clinical plan and respect doctor calendar, specialty, and patient preference.
- OPD -> ED escalation copies patient, vitals, chief complaint, provisional diagnosis, orders, and MLC suspicion.
- OPD -> IPD admission must carry source encounter, admitting diagnosis, consultant, room preference, payer, and initial orders.
- OPD -> OT direct booking must require indication, pre-anesthesia trigger, consent requirement, and estimated implant/consumable package.

### 5. EMR, CPOE, Clinical Decision Support

Gaps in SRS: EMR/CPOE are listed, but safety and data ownership are not defined.

Airtight requirements:

- Clinical notes are versioned. Signed notes are immutable; corrections are addenda.
- Diagnosis coding supports provisional, final, differential, ruled_out, and history_of.
- CPOE blocks unsafe orders: allergy conflict, duplicate active order, high-alert missing acknowledgement, controlled drug missing witness, wrong age/weight/dose range, renal/hepatic contraindication, pregnancy warning.
- CDS alerts have severity: info, soft_stop, hard_stop. Hard-stop override requires permission and reason.
- Orders are not just text. Each order has orderable_id, priority, indication, schedule, performer, billing mapping, and lifecycle.
- Result acknowledgement is tracked: normal, abnormal, critical. Critical result requires notification + readback + escalation if unacknowledged.

### 6. Nursing, Ward, IPD, Discharge

Gaps in SRS: nursing and IPD charge capture are mentioned, but handover/cascade rules are missing.

Airtight requirements:

- Admission lifecycle: planned, admitted, transferred, step_up_icu, step_down_ward, discharge_initiated, medically_cleared, billing_cleared, pharmacy_cleared, mrd_sealed, discharged, dama, absconded, expired.
- Bed transfer atomically updates bed status, admission ward, nurse pool, diet, housekeeping task, and MAR location.
- Medication administration requires 5 rights: patient, drug, dose, route, time, plus barcode verification where available.
- Missed dose, refused dose, held dose, and delayed dose are separate states with reason.
- Discharge workflow auto-cancels pending orders where clinically safe, finalizes bill, creates take-home pharmacy order, schedules follow-up, releases bed to housekeeping, seals MRD, and schedules survey.
- DAMA, death, transfer-out, and absconding are separate flows with legal evidence, witness, MLC/police hooks where applicable.

### 7. ICU, NICU, PICU

Gaps in SRS: device integration and scores are listed, but clinical risk logic is thin.

Airtight requirements:

- ICU admission has reason, severity score, consultant, nurse ratio, isolation flag, ventilator status, and escalation contact.
- Device data is tagged with device id, calibration status, patient/admission binding, and plausibility checks.
- SOFA/APACHE/neonatal scores must be timestamped, reproducible, and not overwritten.
- NICU dose rules require gestational age, birth weight, current weight, corrected age, and maternal data where relevant.
- ICU -> OT, OT -> ICU, ICU -> ward step-down must be transactionally linked to admissions, orders, MAR, bed, and billing.

### 8. Emergency, Ambulance, Break-Glass

Gaps in SRS: emergency lists triage and break-glass but not legal/clinical constraints.

Airtight requirements:

- Triage lifecycle: arrived, triaged, waiting, assigned, under_treatment, admitted, transferred, discharged, deceased, left_without_being_seen.
- Triage must capture arrival mode, chief complaint, vitals, ESI/acuity, pain score, MLC suspicion, infectious risk, pregnancy, and pediatric flag.
- Door-to-triage and door-to-doctor clocks start from arrival, not registration completion.
- Unknown patient flow creates temporary identity and locks non-essential demographic requirements.
- Break-glass grants time-limited access to a patient/context only, requires reason, and creates supervisor review.
- Accident/assault/burn/poisoning/RTA keywords trigger MLC workflow unless explicitly ruled out.
- Ambulance trip links dispatch, GPS, crew, patient, vitals, handover, consumables, billing, and outcome.

### 9. LIS, RIS/PACS, OT, Blood Bank

Gaps in SRS: standards are named, but safety state machines are missing.

Airtight requirements:

- Lab order lifecycle: ordered, billed/authorized, sample_required, label_printed, collected, received, accepted, rejected, processing, resulted, verified, released, acknowledged, cancelled.
- Sample rejection must reverse or hold billing according to policy and create recollect notification.
- Critical lab values require call/readback workflow.
- Radiology requires AERB license metadata per modality, pregnancy/radiation check, contrast allergy/renal check, and DICOM accession trace.
- OT booking requires indication, consent, pre-op checklist, anesthesia clearance, implant plan, blood availability if required, and post-op handover.
- Blood bank requires donor eligibility, mandatory screening, component traceability, crossmatch, issue, bedside verification, transfusion monitoring, reaction workflow, and full audit.

### 10. Pharmacy

Gaps in SRS: pharmacy is strong conceptually, but regulatory and closed-loop rules need precision.

Airtight requirements:

- Drug master must carry INN/generic, brand, strength, route, dosage form, ATC, RxNorm/SNOMED where available, schedule H/H1/X/G/OTC, NDPS flag, LASA flag, high-alert flag, AWaRe class, storage requirements.
- Prescription, dispense, issue, return, waste, recall, expiry, and stock adjustment are separate ledgers.
- FEFO is enforced by default. Manual batch override needs reason and permission.
- Controlled/NDPS/Schedule X needs dual custody, register, witness, balance proof, no offline dispensing, and strict corrections.
- Dispense posts billing line with batch and expiry. Return reverses stock and billing proportionally.
- Drug recall identifies patients, invoices, prescriptions, and stock batches affected.
- Substitution requires same generic/strength/form or explicit prescriber approval.

### 11. Billing, Finance, Insurance

Gaps in SRS: billing sources and outputs are listed, but reversals, packages, approvals, and payer rules are not airtight.

Airtight requirements:

- Every bill line has source_module, source_record_id, patient_id, encounter/admission id, payer, tax policy, package policy, and reversal link.
- Manual bill lines require reason and permission.
- Void/cancel creates reversal entries, never deletes original lines.
- Package billing needs inclusion/exclusion rules, quantity caps, time windows, payer-specific terms, and exception approval.
- Discounts are tiered by amount/percent and role; every discount has reason, approver, and impact visible to finance.
- Insurance workflow: eligibility, pre-auth, enhancement, denial, final approval, claim submission, query, settlement, shortfall, write-off, patient conversion to self-pay.
- Final discharge bill locks after patient acknowledgement; later changes require amendment workflow.
- GST/healthcare tax handling must be service-line aware, not global.

### 11A. Administrative, HR, Payroll, RCM, Supply Chain

Gaps in SRS: RCM, supply chain, HR, biometric attendance, geofencing, shifts, payroll, PO/GRN, vendor portal, and reorder levels are named but not constrained.

Airtight requirements:

- HR identity is the source for staff, doctor, student, contractor, and vendor-user access. Deactivation immediately revokes login, offline packs, device sessions, and signing privileges.
- Attendance has states: scheduled, checked_in, late, absent, on_leave, overtime_pending_approval, overtime_approved, corrected. Manual correction requires reason and supervisor approval.
- Payroll consumes attendance, leave, shift, allowance, deduction, advance, and statutory components; it must not edit clinical identity or permissions.
- Shift scheduling must enforce minimum staffing, credential requirements, department scope, fatigue rules, and ICU/NICU nurse ratio constraints where configured.
- RCM work queues must separate coding, pre-auth, claim submission, query response, denial, settlement, shortfall, refund, and write-off states.
- Supply chain requires PR -> approval -> RFQ/quote -> PO -> GRN -> QC -> stock ledger -> supplier invoice -> payment. Skipping steps needs configured permission.
- Vendor portal can view only own POs, RFQs, invoices, and payment status; never patient data.
- Reorder calculations must consider consumption velocity, lead time, safety stock, criticality, expiry, active contracts, and available budget.

### 11B. Day Care Treatment

Gaps in appendix E: the SRS correctly treats day care as neither pure OPD nor full IPD, but it needs its own state machine.

Airtight requirements:

- Day care lifecycle: registered, clinically_cleared, financial_cleared, pre_procedure_ready, in_procedure, recovery, discharge_ready, pharmacy_pending, final_bill_pending, discharged, converted_to_ipd, cancelled.
- Day care has its own encounter/admission type so bed occupancy, billing, package rules, and NMC/IPD metrics do not get polluted.
- Conversion to IPD must create an admission, carry forward orders/medications/procedure notes, and link day-care bill lines.
- Package billing must define inclusions, exclusions, time limits, complications, consumable caps, and conversion-to-IPD rules.
- Discharge cannot complete until procedure note, recovery vitals, discharge advice, take-home medication, final bill, and follow-up are resolved.
- Insurance pre-auth for day care must be separate from OPD cash billing and must track approval, denial, enhancement, and settlement.

### 12. Support Services: CSSD, Diet, Housekeeping, BMW

Gaps in SRS: support services are listed but not operationally connected.

Airtight requirements:

- CSSD tracks instrument set lifecycle: dirty, received, washed, packed, sterilized, released, used, recalled, failed_cycle.
- OT cannot start if required sterile set is not released or has failed cycle.
- Diet order defaults from patient allergies/preferences, diagnosis, room, and nursing status; changes must be time-bounded.
- Housekeeping bed-cleaning is event-driven from discharge/transfer/isolation and cannot mark clean until checklist is complete.
- BMW records must originate from source areas with color/category, weight/count, barcode/bag id, handover, storage, pickup, CBWTF acknowledgement, breach, and corrective action.

### 12A. Fleet and Ambulance

Gaps in SRS: GPS, intelligent dispatch, onboard inventory, fuel, and maintenance are listed but not tied to emergency and billing.

Airtight requirements:

- Dispatch lifecycle: requested, assigned, en_route_pickup, patient_onboard, en_route_facility, handed_over, completed, cancelled.
- Dispatch priority uses acuity, pickup distance, vehicle type, crew skill, oxygen/ventilator need, and current fleet availability.
- Ambulance consumables are an onboard store. Usage posts stock ledger and billing where applicable.
- GPS trace, handover time, vitals, crew, vehicle, and receiving clinician are locked after completion; corrections are amendments.
- Vehicle maintenance blocks assignment when safety-critical PM, insurance, permit, or equipment checks are expired.

### 12B. Workflow Engine and Dashboard Customization

Gaps in SRS: dynamic forms, journeys, rule engines, and specialty templates are listed but need governance so they do not bypass code-level safety.

Airtight requirements:

- Dynamic forms are versioned. Submitted records keep the form version and field schema used at the time.
- Rules engine actions are allowlisted and permission-scoped; it cannot execute arbitrary SQL or bypass validation.
- Workflow transitions must call the same backend domain handlers as normal UI actions.
- Template changes require approval when they affect clinical, billing, consent, legal, or regulatory fields.
- Dashboards expose metric definitions, numerator, denominator, source table/event, refresh cadence, and owner.
- Drill-down must respect PHI permissions independently from the aggregate dashboard permission.

### 13. Maintenance, Facilities, Inventory

Gaps in appendices B/C: good module list, but source event rules and healthcare impact are under-specified.

Airtight requirements:

- Asset lifecycle: procured, installed, commissioned, active, under_pm, breakdown, under_repair, standby, decommissioned, disposed.
- Critical equipment downtime triggers clinical impact, replacement request, department notification, and NABH evidence.
- PM schedules must be locked once generated; missed PM needs reason and escalation.
- Inventory stock ledger is append-only: receive, issue, transfer, consume, adjust, return, scrap, expire.
- Reorder uses min/max, lead time, consumption velocity, criticality, vendor contract, and budget approval.
- Consumption from OT/IPD/procedure should post to stock and billing automatically.

### 14. Medical Camp and Offline

Gaps in appendix A: offline and referrals are listed but conflict and safety rules are missing.

Airtight requirements:

- Camp pack export defines scope: camp, staff, patients/expected beneficiaries, catalog, price policy, formulary, devices.
- Camp registration uses temporary UUIDs and reconciles with main UHID/ABHA after sync.
- Offline clinical writes must include device id, user id, pack id, local timestamp, vector/version, and sync status.
- Paid camp billing uses separate price list and reconciliation batch.
- Referral conversion creates OPD appointment/order with source camp id and tracking SLA.
- Emergency camp referral creates ambulance/ER pre-arrival note and does not wait for full demographic completion.

### 15. Barcode Scanner Module

Gaps in appendix F: scanner use cases are broad, but scan failure and identity rules are missing.

Airtight requirements:

- Barcode types are versioned: patient wristband, visit, admission, sample, drug batch, blood unit, asset, inventory item, document.
- Scan validates entity type, active state, tenant, location, expiry, and current workflow step.
- Wrong-patient/wrong-drug/wrong-sample scan is a hard-stop and safety event.
- Manual override needs reason, permission, and second check for medication/blood.
- Scanning does not replace clinical judgement; it records verification evidence.

### 16. Medical College and NMC

Gaps in SRS: academic modules are broad but need linkage to hospital evidence.

Airtight requirements:

- Student and faculty identities link to HPR/employee records and role-scoped clinical access.
- Attendance, postings, logbook cases, procedures, skills, and assessments are tamper-evident.
- Student patient access is supervised, purpose-bound, and PHI-minimized.
- OPD/IPD/OT/ICU exposure reports derive from actual encounter/admission/procedure data, not manual counts.
- NMC dashboards need faculty, infrastructure, bed occupancy, OPD/IPD load, case mix, teaching schedules, logbook completion, and assessment evidence.

### 17. Print, Documents, Mobile, Dashboards

Airtight requirements:

- Every generated document has template version, data snapshot hash, generated_by, generated_at, source record, and signature state.
- Reprint is audited; amended document supersedes original without deleting it.
- Mobile app obeys same permission model and audit trail as web.
- Dashboards use role-specific datasets and must never expose raw PHI to executive views unless explicitly permitted.
- Analytics predictions must label model/version/data window and should not drive irreversible actions without human confirmation.

## Cross-Module Event Contract

These events should exist and be consumed consistently:

| Event | Required consumers |
|---|---|
| patient.created | audit, CRM, ABHA consent, duplicate review |
| opd.visit.checked_in | queue, billing consultation charge, doctor worklist |
| opd.visit.no_show | queue, billing reversal if charged, audit |
| order.created | billing charge/reservation, lab/radiology/pharmacy queue |
| order.cancelled | billing reversal/hold, queue removal, audit |
| lab.result.critical | clinician alert, patient banner, NABH evidence |
| prescription.created | pharmacy queue, allergy/CDS, billing estimate |
| pharmacy.dispensed | stock ledger, billing, medication history, NABH batch trace |
| admission.created | bed map, nursing worklist, diet, billing, MRD |
| bed.transferred | bed map, MAR routing, housekeeping, billing room charge |
| discharge.completed | billing finalization, MRD seal, bed release, survey, follow-up |
| incident.sentinel | NABH sentinel register, RCA task, leadership alert |
| code_blue.started | emergency dashboard, NABH evidence, audit |
| transfusion.reaction | blood bank evidence, patient safety alert, NABH evidence |
| equipment.breakdown | BME work order, clinical impact alert, NABH downtime evidence |
| bmw.bag.handed_over | BMW evidence, monthly report, compliance dashboard |

## Implementation Order

P0 - lock the safety-critical backbone:

1. Source-event evidence model: no separate captures except legacy/offline corrections.
2. Cross-module patient context: allergies, MLC, balance, consents, last vitals, insurance, next-of-kin.
3. CPOE safety checks: allergy, dose, high-alert, duplicate, controlled drug, renal/pediatric basics.
4. Billing charge capture and reversals for OPD, lab/radiology, pharmacy, IPD, OT.
5. Discharge cascade: bill, pharmacy, bed, MRD, survey, follow-up.
6. Emergency MLC and break-glass state machine.
7. Pharmacy batch/expiry/FEFO/controlled-drug gates.
8. Blood bank bedside verification and reaction workflow.

P1 - close operational leakage:

1. Search-on-miss inline create across patient/vendor/drug/test/bed/doctor.
2. Queue scoping by department/doctor role.
3. Inventory append-only stock ledger and procurement linkage.
4. Maintenance critical equipment downtime -> clinical impact alerts.
5. BMW barcode evidence from source departments.
6. Medical camp offline pack export/sync/reconciliation.

P2 - enterprise maturity:

1. NMC academic exposure dashboards from real hospital data.
2. Role-based executive dashboards without PHI leakage.
3. Predictive analytics with model governance.
4. Print center with document versioning and reprint audit.
5. Mobile/TV parity for high-volume workflows.

## Definition of Done Per Module

A module is airtight only when all are true:

- It has a lifecycle state machine with allowed transitions.
- Every transition has permission, validation, transaction, audit, event, and reversal rules.
- It owns or subscribes to a documented set of source events.
- It has no duplicate manual compliance capture when a source event exists.
- It has patient-safety hard stops where applicable.
- It has regulatory evidence fields and reports mapped to official standards.
- It has backend tests for unsafe blocked paths.
- It has page-level permission guards and element-level action guards.
- It has generated smoke coverage and at least one manual E2E scenario.
- It uses compile-time SQL and passes offline build with committed `.sqlx`.

## Immediate Next Code Targets

1. Finish strict SQLx policy in Makefile and docs. Done in this turn.
2. Keep `nabh_evidence.rs` as the evidence sink and wire remaining source events:
   - nurse fall actual event -> falls register
   - Braden/skin assessment -> pressure ulcer evidence
   - BMW handover/disposal -> BMW evidence
3. Add `events`/outbox names for the cross-module contract above.
4. Convert P0 source modules to call evidence/cascade helpers inside transactions.
5. Add tests for idempotent mirroring and cancellation/reversal behavior.
