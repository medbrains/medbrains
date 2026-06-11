# User Journey Test Matrix

This matrix defines how E2E journey coverage is selected. The main goal is broad actor-perspective coverage across the hospital ecosystem. Multi-day coverage is mandatory for workflows that naturally cross days, shifts, approvals, or external handoffs, but it is one dimension of the journey model, not the only focus.

## Generalized Gap Rule

When a journey exposes a missing capability, permission, fixture, or helper, fix it at the reusable layer first:

- Prefer a shared journey helper, seed resolver, service, or role-template correction over a one-off test workaround.
- Prefer actor-correct credentials over admin-only setup once the workflow step belongs to a real role.
- Keep regulatory evidence in the workflow: two identifiers, medication safety, MAR, I/O, handover, discharge readiness, audit trail, and interoperability where applicable.
- If a workflow spans more than one day or shift, represent the elapsed dates or handovers in test data and assertions.

## Actor Groups

| Actor group | Examples | Journey focus |
| --- | --- | --- |
| Patient/public | Walk-in, online appointment patient, kiosk user, bedside portal user | Public booking, kiosk check-in, bedside visibility, report/feedback/consent access |
| Hospital users | Receptionist, doctor, nurse, lab tech, pharmacist, billing clerk, MRD, procurement/store, audit | Role-owned handoffs from registration through clinical orders, dispense, billing, IPD, discharge, records |
| External users | Vendor, TPA/insurer, referral doctor, corporate sponsor, outsourced service provider | Approval, acknowledgement, fulfillment, claims, sample pickup, vendor delivery and reconciliation |
| External systems | FHIR/ABDM clients, bridge agents, devices, LIS/PACS/DICOM, payment/SMS/WhatsApp gateways | Readiness metadata, secure exchange, heartbeat/ingest, data mapping, auditability |

## Current Scenario Coverage

| File | Coverage |
| --- | --- |
| `apps/web/e2e/scenarios/golden-patient-journey.spec.ts` | Admin-assisted cross-module patient path: OPD, lab, Rx, pharmacy, billing, IPD, discharge, MRD |
| `apps/web/e2e/scenarios/multi-role-journeys.spec.ts` | Role page-access smoke coverage |
| `apps/web/e2e/scenarios/indent-procurement-linking.spec.ts` | Store/procurement handoff from indent to purchase order |
| `apps/web/e2e/scenarios/actor-perspective-journeys.spec.ts` | Patient/public booking, hospital role handoffs, external vendor fulfilment, multi-day IPD continuity, FHIR/bridge external systems |
| `apps/web/e2e/journeys/catalog.ts` | Structured journey test case catalog across patient/public, hospital users, external users, and external systems |
| `apps/web/e2e/scenarios/user-journey-catalog.spec.ts` | Catalog guard that registers every journey case as a Playwright/TCMS-visible test case and enforces breadth, assertions, and regulatory anchors |

## Corpus Model

The SQLite-style target is a large systematic test corpus, not hundreds of thousands of hand-authored browser scripts. MedBrains journey coverage should scale in layers:

- Catalog cases: every meaningful actor journey is named, classified, and tied to assertions and regulatory anchors.
- Contract/API cases: reusable helpers execute the stable route-level portions of a catalog case.
- Hybrid/UI cases: selected P0/P1 journeys execute the real user path through role credentials and UI where needed.
- Permutation cases: high-risk catalog cases expand across tenant, role, facility, status, date/shift, and regulatory variants.

This keeps the test corpus broad while avoiding brittle browser-only duplication.

## Required Journey Backlog

| Priority | Journey | Actors | Multi-day required |
| --- | --- | --- | --- |
| P0 | OPD public booking to check-in to consultation to billing | Patient, receptionist, doctor, billing clerk | No |
| P0 | IPD admission to daily rounds to nursing handover to discharge readiness | Patient, doctor, nurse, pharmacist, billing clerk, MRD | Yes |
| P0 | Prescription to pharmacy review, dispense, return, and billing capture | Doctor, pharmacist, billing clerk, patient | Sometimes, for refill/return |
| P0 | Lab order to sample collection to result review to patient report | Doctor, nurse/phlebotomy, lab tech, patient | Sometimes, for outsourced or delayed tests |
| P1 | Insurance pre-auth to bill closure and claim packet | Doctor, billing clerk, insurance officer, TPA | Yes |
| P1 | Procurement indent to PO to GRN to stock issue | Store keeper, procurement officer, vendor, pharmacy/department | Yes |
| P1 | Vendor dispatch to GRN to supplier payment acknowledgement | Procurement officer, store keeper, vendor | Sometimes, for delayed fulfilment |
| P1 | External system exchange readiness | FHIR/ABDM client, bridge agent, device/LIS/PACS | No for metadata, yes for queued ingest |
| P2 | Post-discharge follow-up and readmission watch | Patient, nurse/call center, doctor, quality/audit | Yes |

## IPD Multi-Day Minimum Evidence

A multi-day IPD journey should assert at least these reusable evidence points:

- Day 0: admission, patient identification, nursing assessment, MAR schedule/administer, I/O baseline, SBAR handover.
- Day 1 or later: doctor progress note, risk assessment such as Braden/fall risk, care plan update, I/O balance, handover acknowledgement.
- Discharge readiness: billing summary, pharmacy clearance or medication reconciliation, counseling/follow-up plan, MRD/discharge document path where available.
- Interoperability: patient or encounter can be exported/read through FHIR when the journey produces clinical records.

## Regulatory Anchors

Journey tests must preserve these hospital safety and compliance checks where relevant:

- NABH/IPSG: two patient identifiers, safe communication handover, medication safety, fall/pressure-injury prevention, discharge counseling.
- Pharmacy: Drugs and Cosmetics Act, Schedule H/H1/X handling, FEFO/batch traceability, LASA/high-alert handling where applicable.
- Lab/radiology: LOINC/DICOM readiness and critical result routing where applicable.
- Data exchange: FHIR R4/ABDM-compatible resource surfaces and auditability for external reads.
