# NABH Case Sheet and MRD Linkage

This is the working implementation map for NABH-style case-sheet completeness, MRD control, and cross-module evidence links.

## Sources Checked

Official baseline:

- NMC Rules & Regulations page: the active official index lists Minimum Standard Requirement items under both PG and UG boards, including PGMSR 2023/2024 and UGMSR 2023/amendments (`https://www.nmc.org.in/rules-regulations-nmc/`).
- NMC PGMSR 2023 official PDF: postgraduate teaching hospitals need adequate OPD examination cubicles, teaching rooms for clinical case discussions, in-house lab/imaging, digital investigation records, and bed occupancy evidence (`https://www.nmc.org.in/MCIRest/open/getDocument?path=%2FDocuments%2FPublic%2FPortal%2FLatestNews%2FPGMSR-2023+FOR+WEBSITE+WITH+E-SIGN.pdf`).
- NMC CBME/log-book guidance: learner case records include relevant investigations, treatment and rationale, hospital course, family/patient discussions, discharge summary, and outpatient records (`https://www.nmc.org.in/MCIRest/open/getDocument?path=%2FDocuments%2FPublic%2FPortal%2FLatestNews%2FCBME+1-8-2023.pdf`).
- NABH Hospital Accreditation Standards 6th Edition, January 2025: medical record must include reason for admission, diagnosis and care plan, assessments/reassessments/consultations, investigations, care provided, operative/procedure details, transfer details, signed discharge summary, and medical certificate of cause of death when applicable (`https://portal.nabh.co/images/Standards/NABH%20Hospital%20Accreditation%20Standard%206th%20Edition%20January%202025.pdf`).
- NABH Digital Health Standards for HIS/EMR Systems: HIS/EMR products are assessed for safe, secure, interoperable, clinically useful systems aligned to national digital-health frameworks (`https://nabh.co/programmes/digital-health-standards-his-emr-systems/`).
- NABH Information Management System expectations: confidentiality, integrity, and security of records, with care providers able to access current and past records.
- NRCeS / MoHFW EHR Standards for India: health records are held by the provider in trust for the patient, patient access/amendment/disclosure must be controlled and audited, and records should support longitudinal retrieval.
- NRCeS ABDM NHCX FHIR Implementation Guide v6.5.0: NHCX claim exchange should support payer/provider discovery, eligibility, pre-auth, claim request/response, payment notices, payment acknowledgement, status checks, and auditable machine-readable bundles (`https://www.nrces.in/ndhm/fhir/r4/hcx-profile.html`).
- PIB MoHFW NHCX update, 26 July 2024: NHCX is an ABDM gateway for standardized, auditable health-claim exchange among insurers, TPAs, healthcare providers, beneficiaries, and other entities (`https://www.pib.gov.in/Pressreleaseshare.aspx?PRID=2037634`).
- NABH mark policy: hospital logo/letterhead is a tenant branding concern; NABH mark usage is separate and must be enabled only for accredited/certified units with certificate and validity controls.
- AIIMS Patna Medical Records SOP, 28 May 2025: MRD process includes assembly, completeness review, coding/indexing, digitization before filing, compactor/rack filing, tracer/issue register control, 48-hour return expectation, privacy-controlled release, and retention/disposal rules.

Local sample checked:

- `/Users/apple/Projects/MedBrains/ilide.info-nabh-workflow-sheet-1-pr_3bdea460b0043bfd26921fad6babd861.pdf`
- It is a 9-page NABH workflow spreadsheet. Page 3 contains medical and surgical case-sheet receipt packs. The sample is useful for checklist inventory, not as an official standard.

## Case Sheet Packs Added

The sample PDF has been translated into seedable IPD admission checklists:

| Pack | Items | Code |
| --- | ---: | --- |
| Medical Case Sheet Pack | 10 | `medical-case-sheet-10` |
| Surgical Case Sheet Pack | 13 | `surgical-case-sheet-13` |

These sit alongside the existing pre-op, admission-advice, and MRD-deficiency templates in `apps/web/src/data/checklist-templates.ts`.

## Required Cross-Module Linkage

| Source module | Evidence produced | MRD / case-sheet linkage |
| --- | --- | --- |
| OPD | Encounter, diagnosis, prescription, investigation orders, referral/admission advice | If admitted, OPD-to-IPD copy must preserve diagnosis, notes, prescriptions, and pharmacy status into the admission case sheet. |
| OPD SOAP | Datewise consultation SOAP with doctor, department, subjective, objective, assessment/diagnosis, plan, and update timestamp | MRD OPD packets include a datewise SOAP consolidation page and snapshot evidence. |
| IPD | Admission, assessments, progress notes, MAR, vitals, I/O, nursing notes, consents, OT records, discharge summary | Case-sheet checklist tracks required pages; print-data endpoints produce branded pages for MRD compilation. |
| IPD SOAP / progress notes | Datewise progress notes with note type, author, subjective, objective, assessment, plan, addendum flag, parent note, and timestamp | MRD IPD packets include a datewise SOAP/progress-note consolidation page and snapshot evidence. |
| Pharmacy | Prescription review, dispense order, batch/expiry, substitutions, returns, medication safety checks | Drug chart and MAR must show prescribed versus dispensed status, batch/expiry where dispensed, and pharmacist review status. |
| Billing | Billing chart, advance/receipt, concessions, insurance/TPA documents | Billing chart becomes part of MRD deficiency pack and final case-sheet closure. |
| Insurance / TPA | Eligibility, pre-auth, claim bundle, query response, denial/appeal, settlement, payment notices, NHCX correlation ids | MRD and billing claim packets must carry clinical evidence links, not duplicate uncontrolled copies. |
| MRD | Medical record index, movement register, retention policy, birth/death registers, morbidity/mortality | MRD owns completeness, issue/return, retention, and audit of printed/electronic records. |
| Documents / Print Editor | Templates, branded outputs, print jobs, reprints, signatures | Case-sheet pages must use tenant logo/letterhead, template version, watermark, print metadata, and reprint reason controls. |

## Permission Entities To Track

Every case-sheet and MRD surface needs page, table, row-action, drawer, and field-level permissions:

| Surface | View | Create | Update/Manage | Sensitive fields |
| --- | --- | --- | --- | --- |
| MRD records | `mrd.records.list` | `mrd.records.create` | `mrd.records.manage` | shelf, retention, destruction, movement issue/return |
| Birth register | `mrd.births.list` | `mrd.births.create` | `mrd.records.manage` | mother/baby identity, certificate number |
| Death register | `mrd.deaths.list` | `mrd.deaths.create` | `mrd.records.manage` | cause of death, MLC flag, municipality report |
| IPD checklist | `ipd.admissions.view` | `ipd.admissions.create` | `ipd.admissions.manage` | deficiency status, reviewer, completion evidence |
| Case-sheet print | `ipd.admissions.view` | `documents.outputs.print` | `documents.outputs.manage` | reprint reason, watermark, signatures |
| Pharmacy drug chart linkage | `pharmacy.prescriptions.view` | `pharmacy.dispensing.create` | `pharmacy.rx_queue.review` | substitutions, batch, expiry, safety overrides |

## Implementation Status

Done:

- Medical and surgical case-sheet pack templates added to IPD checklist seeding.
- Case-sheet cover print-data now includes tenant hospital name and logo URL.
- Existing MRD routes already cover indexing, issue/return movement, retention policy, birth/death register, morbidity/mortality, and admission/discharge stats.
- Existing print-data routes already cover MRD forms including progress notes, nursing assessment, MAR, vitals, I/O, discharge checklist, and case-sheet cover.
- MRD case-sheet completeness endpoint now checks live OPD/IPD/pharmacy/lab/radiology/billing/consent evidence for a generated packet.
- MRD case-sheet generation now adds datewise SOAP consolidation pages for OPD and IPD and stores the SOAP/progress-note timeline in the packet source snapshot.
- Camp operational planning now exposes a control summary for budget, sponsor receivable, free issue, paid issue, pharmacy batch traceability, stock shortages, approval blockers, and asset-return closeout.

Next enforcement gaps:

- Add print-job reprint approval and reprint reason enforcement for case-sheet pages.
- Add per-field permission metadata for cause of death, MLC, shelf/destruction, and controlled-drug medication fields.
- Prevent NABH mark rendering unless tenant accreditation scope, certificate number, and validity are configured.
- Add rendered/printable datewise SOAP packet templates and verify page order against medical/surgical MRD case-sheet assembly.
- Add NHCX/TPA claim-bundle generation from MRD case-sheet evidence without leaking hidden fields.
