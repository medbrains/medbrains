# COMPLIANCE-GAP-2026-10 — NABH, DPDP Act 2023 + Rules 2025, ABDM

Date: 2026-10-12. Scope: the `medbrains/` codebase (crates/, migrations, apps/web/src, packages/api, apps/ios, apps/android, infra/, deploy/). This was a static, read-only review: no code was run or changed.

**Status rules.** **Met** needs three things: a concrete code pointer, a writer for the data, and a web screen that calls it. A table nothing writes, or an endpoint with no screen, is at most **Partly**. **N/A** is used only for vendor-process or contract questions (checklist §29–30) and items that don't apply.

**Criteria source.** NABH criteria come from `RFCs/old/ACMSRC_HMS_Evaluation_Checklists.docx` (text extract `…_EXTRACTED.txt`), which has 34 department checklists and 1,405 numbered rows. That checklist is the ACMSRC evaluation instrument mapped to NABH/JCI. It is **not** the NABH 5th-edition standard text, so passing it is necessary but not sufficient for NABH accreditation. DPDP and ABDM criteria were built from the current Rules and ABDM/NRCeS sources; see the Sources list in each section.

**Method.** Nine sub-agents assessed the NABH sections in parallel, plus one for DPDP and one for ABDM. Eight high-impact findings were then re-checked by hand against the code; all eight held (quality `create_incident` binds `reported_by` for anonymous reports; pharmacy `review_prescription` hard-sets `interaction_check_done = true`; ABDM `hip_relay` list/ack take no claims and read `tenant_id` from the query; the NHCX submit handler is not registered in `main.rs`).

## 1. Summary counts

| Framework | Criteria | Met | Partly | Missing | N/A | Met % (excl. N/A) |
|---|---|---|---|---|---|---|
| NABH / ACMSRC checklist (34 depts) | 1,405 | 494 | 610 | 209 | 92 | 37.6% |
| DPDP Act 2023 + Rules 2025 | 32 | 2 | 19 | 11 | 0 | 6.3% |
| ABDM (M1/M2/M3, HFR/HPR, FHIR, NHCX, certification) | 39 | 0 | 17 | 22 | 0 | 0% |

### NABH per department

| § | Department | Met | Partly | Missing | N/A |
|---|---|---|---|---|---|
| 1 | Medical (Doctors) | 26 | 14 | 2 | 0 |
| 2 | Emergency / Casualty | 13 | 9 | 1 | 0 |
| 3 | Nursing | 16 | 15 | 1 | 0 |
| 4 | Pharmacy | 14 | 15 | 1 | 0 |
| 5 | Laboratory | 22 | 9 | 1 | 0 |
| 6 | Radiology | 8 | 12 | 5 | 0 |
| 7 | Finance & Billing | 22 | 6 | 0 | 0 |
| 8 | HR & Admin | 14 | 8 | 1 | 0 |
| 9 | Materials / Store | 17 | 9 | 1 | 0 |
| 10 | Biomedical Engg | 17 | 10 | 1 | 0 |
| 11 | Infection Control | 14 | 11 | 3 | 0 |
| 12 | Quality / NABH / NMC | 12 | 14 | 7 | 0 |
| 13 | Front Office | 9 | 10 | 1 | 0 |
| 14 | ICU / HDU / NICU | 11 | 12 | 1 | 0 |
| 15 | OT | 13 | 9 | 0 | 0 |
| 16 | Blood Bank | 13 | 10 | 0 | 0 |
| 17 | Housekeeping & Linen | 10 | 5 | 2 | 0 |
| 18 | Facilities | 10 | 16 | 2 | 0 |
| 19 | IT & Systems | 8 | 16 | 4 | 0 |
| 20 | Security | 7 | 12 | 1 | 0 |
| 21 | Academic ERP | 1 | 10 | 38 | 0 |
| 22 | CSSD | 6 | 4 | 2 | 0 |
| 23 | Dietary | 4 | 7 | 1 | 0 |
| 24 | Consent & Medico-legal | 10 | 10 | 2 | 0 |
| 25 | Specialized clinical | 2 | 31 | 1 | 0 |
| 26 | Communication & Feedback | 6 | 10 | 1 | 0 |
| 27 | QA Testing | 11 | 12 | 0 | 0 |
| 28 | Printing / Forms | 78 | 97 | 36 | 0 |
| 29 | Implementation (vendor Qs) | 8 | 16 | 4 | 55 |
| 30 | Training (vendor Qs) | 4 | 22 | 8 | 22 |
| 31 | Audit trail & security monitoring | 14 | 27 | 13 | 0 |
| 32 | Storage / Backup / Archival | 11 | 30 | 20 | 1 |
| 33 | Tech stack / Infra security | 38 | 48 | 25 | 6 |
| 34 | TV / Queue / Signage | 25 | 64 | 23 | 8 |

**Recurring patterns:**
1. **The backend exists but no screen creates the data.** Most of §25 falls here (cath, endoscopy, MHCA registers, audiology, nuclear medicine), as do nursing assessments and care plans, drug recall, radiation dose and break-glass start.
2. **Safety flags are stored but enforce nothing.** Examples: `interaction_check_done`, formulary and AWaRe status, `tti_status`, `is_locked` on calibration, Morse and Braden scores, `is_restricted` on psychiatry.
3. **Alerts are recorded by hand and never sent.** Examples: MLC police intimation, mass-casualty `notifications_sent`, `security_tag_alerts`, `access_alerts`.
4. **Production runs only the single-host standalone deploy.** The high-availability, disaster-recovery and observability stacks exist only as Terraform.

## 2. Prioritized fix list

Patient-safety items come first, then legal and regulatory exposure, then certification and operations. Size: S = under 2 days, M = about 1 week, L = several weeks.

| P | Fix | Why (risk) | Touches | Size |
|---|---|---|---|---|
| 1 | **Run the drug-interaction and allergy checks for real, at review and at dispense.** Stop `review_prescription` hard-setting `interaction_check_done/allergy_check_done = true`. Call the DDI and allergy engine and block or require an override reason on major interactions. | A false safety attestation: the record claims a check ran when it never did. | `crates/medbrains-pharmacy/src/lib.rs` (~6514 review, dispense path); `pharmacy_prescriptions`; `pages/pharmacy/drug-interaction-modal.tsx`, dispense screen | M |
| 2 | **Enforce restricted antibiotics and the formulary when prescribing and dispensing.** AWaRe Reserve needs an approved stewardship request; non-formulary drugs need approval. | AMS (NABH antimicrobial stewardship) and DTC requirements; the check is currently only a client toggle that defaults to false. | `crates/medbrains-opd/src/lib.rs` (Rx create); `crates/medbrains-pharmacy/src/lib.rs` (~1424, ~3587); `medbrains-infection-control/src/infection_control.rs` (~498-624); `pharmacy_catalog.aware_category/formulary_status`; `features/prescription/RxDoctor.tsx` | M |
| 3 | **Blood bank: record TTI results per marker (HIV, HBV, HCV, syphilis, malaria) and block release unless all are non-reactive. Check donor deferral and donation interval in `create_donation`. Scan the patient wristband at bedside and require a second blood-group typing.** | Transfusion-transmitted infection and wrong-blood risk. Statutory under D&C Act Part XII-B and NACO. | `crates/medbrains-blood-bank/src/lib.rs` (~300), `bedside_transfusion.rs`; `blood_donations`, `blood_components`; `pages/blood-bank/donors-tab.tsx`, `inventory-tab.tsx`; `components/Nurse/StartTransfusionModal.tsx` | M |
| 4 | **CSSD: block issue of expired packs and of loads with a failed biological indicator; add recall of a whole load.** | Non-sterile instruments reaching surgery. | `crates/medbrains-cssd/src/lib.rs` (~678 issue, ~745 recall); `cssd_issuances`, `cssd_indicator_results`; `pages/cssd/issuance-tab.tsx`, `LoadContentsDrawer.tsx` | S |
| 5 | **OT consent must match the booked procedure, not just any signed consent for the patient.** | Wrong-procedure consent; legal exposure on informed consent. | `crates/medbrains-ot/src/lib.rs` (:741, :885); add `procedure_consents.ot_booking_id`; `pages/ot/preop-tab.tsx` | S |
| 6 | **Medication administration (MAR):**<br>• Gate chemo administration on a chemo-certified staff credential.<br>• Make `prn_reason` required and actually saved.<br>• Add an overdue sweep for the 30-minute restraint checks. | IPSG-3 medication safety; MHCA requirements on restraint. | `crates/medbrains-ipd/src/lib.rs` (~2910 `update_mar`); `ipd_medication_administration.prn_reason` (`0220_ipd.sql:1761`); `medbrains-hr` credentials; `components/Nurse/AdministerModal.tsx`; `services/nurse_call_escalation.rs` pattern | M |
| 7 | **Nursing:**<br>• Build write screens for the admission assessment and care plans.<br>• Make high Morse and Braden scores raise a nurse task and a prevention care plan. | Falls and pressure injury (IPSG-6). The assessment is the core NABH nursing record and currently has no screen that writes it. | `pages/ipd/nursing.tsx` (wire `createNursingAssessment`, `createCarePlan`, `updateCarePlan`); `crates/medbrains-ipd/src/lib.rs` (~2628) | M |
| 8 | **Lock out-of-calibration equipment automatically, and warn or block lab and radiology results recorded on locked equipment.** | Results from uncalibrated analysers. | `crates/medbrains-bme/src/lib.rs` plus a daily job; `bme_calibrations.is_locked`; `pages/bme/calibration-tab.tsx`; lab and radiology result entry | M |
| 9 | **Code Pink and newborn safety:**<br>• Check the mother–baby ID band match.<br>• Turn infant, wander and elopement tag events into `security_tag_alerts` and an automatic Code Pink. | Infant abduction. | `crates/medbrains-security/src/lib.rs` (tag ingest); `crates/medbrains-emergency/src/lib.rs` (~1324 code activation); `icu_neonatal_records.id_band_number`; `pages/security/patient-safety-tab.tsx`, `icu/neonatal-tab.tsx` | M |
| 10 | **Anonymous incident reports must actually be anonymous.** Write NULL for `reported_by` when `is_anonymous` is set, keep the reporter out of the outbox event, and mask it in the UI. | Breaks a just-culture promise, and staff can be identified and retaliated against. | `crates/medbrains-quality/src/lib.rs` (~845-872 `create_incident`); `quality_incidents.reported_by`; `pages/quality/*` | S |
| 11 | **MLC and emergency notifications must be sent, not hand-recorded.** MLC creation should send outbox SMS and notifications to the police-station contact and duty MO. Code Yellow should alert on-call staff, admin and the blood bank. | Statutory police-intimation duty (CrPC/BNSS) on MLC cases; mass-casualty readiness. | `crates/medbrains-emergency/src/lib.rs` (:562 MLC, :2254 MCI); outbox; `notifications_sent`; `pages/emergency/mlc*.tsx` | M |
| 12 | **Close the ABDM callback relay holes.**<br>• `list_pending_callbacks` and `ack_callback` take no claims, set no tenant context, and read `tenant_id` from the query string. Add `require_permission` and tenant context.<br>• Move `receive_callback` to a public router with real JWS signature verification against the gateway certificates.<br>• Remove the `x-medbrains-tenant-id` dev-header fallback. | Possible cross-tenant exposure of ABDM payloads; spoofed callbacks. | `crates/medbrains-server/src/routes/abdm/hip_relay.rs` (:138, :172), `signature.rs`; `routes/mod.rs` (:362-371); `abdm_gateway_callbacks` | S |
| 13 | **DPDP personal-data breach workflow (Rule 7).**<br>• Add breach type, list of affected principals, an initial Board notice "without delay", a 72-hour detailed-report timer, and bulk notice to patients.<br>• Also fix the broken IT-security incident insert: it writes columns that do not exist (`title`, `incident_type`, `detected_at`, `affected_data_types`) and fails at runtime. | Penalties up to ₹200 cr for failing to notify; CERT-In 6-hour reporting as well. | `crates/medbrains-it-security/src/lib.rs` (~1685); `security_incidents` (`0160_facilities.sql:2034`); `pages/security/incidents-tab.tsx` | M |
| 14 | **DPDP notice and consent at registration.** Show a multilingual Rule 3 notice, capture purposes, write the `dpdp_consents` table (no code writes it today), and let patients withdraw consent from the portal and apps. Publish the DPO or grievance contact in `pages/legal.tsx`. | Act s.5–6. Consent is currently never recorded. | `PatientRegisterForm.tsx`; `dpdp_consents` (`0040_auth.sql:264`); `createPatientConsent`; `pages/legal.tsx`; i18n locales (only en, hi, ta, ar exist) | M |
| 15 | **DPDP data-principal rights desk.** Add access summary, export, correction requests, erasure with 48-hour prior notice (respecting medical-record retention law), nominee, and a privacy grievance category with a 90-day timer. Wire up the placeholder iOS tiles. | Act s.11–14, Rule 14; due ~May 2027. | patient portal `pages/*portal*`, `/portal/*` routes; `comm_complaints`; `apps/ios/MedBrainsPatient/Features/PatientHomeView.swift:74-76`; Android patient app | L |
| 16 | **Isolate psychiatric records (PSY-001/002, MHCA 2017).**<br>• Honour `is_restricted` and `substance_abuse_flag` on reads.<br>• Stop `SELECT *` returning `raw_data_encrypted`.<br>• Require break-glass for out-of-team access.<br>• Add create forms for the ECT, seclusion/restraint and MHRB notice registers. | MHCA 2017 s.23 confidentiality; mandatory registers. | `crates/medbrains-specialty/src/specialty_psychiatry.rs`; `crates/medbrains-specialty-other/src/lib.rs` (~550); `medbrains-authz-gate`; `psych_*` (`0380_specialty.sql`); `pages/specialty/psychiatry.tsx` | M |
| 17 | **Audit integrity and coverage.**<br>• Log 403 denials and every failed login with IP (today `audit_layer` drops non-2xx and failed logins aren't recorded).<br>• REVOKE UPDATE and DELETE on audit tables.<br>• Connect the S3 Object Lock `AuditSink` archive.<br>• Hash-chain `billing_audit_log`.<br>• Keep logs ≥1 year; CloudWatch currently keeps 30 days. | DPDP Rule 6 (1-year logs); NABH IMS; forensic value of the audit trail. | `middleware/audit.rs` (:79); `crates/medbrains-auth/src/lib.rs` (61-100, 455); `crates/medbrains-core/src/audit_sink`; `billing_audit_log` (`0050_billing.sql:177`); `infra/terraform/modules/observability/main.tf:66`; `pages/audit.tsx` | M |
| 18 | **Data residency and processors.**<br>• Move the `alagappa` client env off us-east-1.<br>• Redact patient data before calls to the US-hosted LLM, or route them to an India region.<br>• Keep a processor and sub-processor register with DPA references. | DPDP s.16 cross-border transfer, s.8(2) processor contracts; NABH/IT Act expectations. | `infra/terraform/envs/clients/alagappa/main.tf:59`; `crates/medbrains-server-services/src/llm.rs`; new processor register under admin | M |
| 19 | **Backups and DR in production.** Add WAL archiving / PITR (pgBackRest template exists) and schedule and prove the restore test. Today recovery is a nightly `pg_dump` (up to 24h of data lost) whose restore has never been tested. | Data loss on clinical records; NABH IMS continuity. | `deploy/standalone/medbrains-pg-backup` (:120-130); `infra/packer` `pgbackrest.conf.tmpl`; `backup_history` (never written) | M |
| 20 | **Radiation dose capture.** Add screens for `recordRadiationDose`, cath-lab DAP/air kerma and the STEMI door-to-balloon time. Today the cumulative-dose check reads an empty table. | AERB dose records; cardiac quality KPI. | `crates/medbrains-radiology` (`record_dose` ~1553); `crates/medbrains-specialty-interventional` `cath_*`; `pages/radiology/order-detail-drawer.tsx`, `pages/specialty/cath-lab.tsx` | M |
| 21 | **Drug recall and vigilance reporting.**<br>• Add a recall screen for the existing `medbrains-pharmacy-safety` endpoints.<br>• Generate real PvPI, haemovigilance and materiovigilance forms; today `submit_adr_to_pvpi` only sets a flag. | CDSCO recall and PvPI obligations. | `crates/medbrains-pharmacy-safety/src/lib.rs`; `crates/medbrains-regulatory/src/lib.rs` (~952); print-data; `pages/regulatory/adr-tab.tsx`, pharmacy screens | M |
| 22 | **Break-glass and sensitive-record monitoring.**<br>• Add a dialog to start break-glass (`startBreakGlass` has no caller) that records IP and user agent and notifies the treating doctor, HOD and security.<br>• Run a job that turns `access_log` patterns (VIP, after-hours, bulk) into `access_alerts`. | NABH IMS and DPDP security safeguards. | `crates/medbrains-it-security/src/lib.rs` (:248); `packages/api/src/client.ts`; `sensitive_patients`, `access_alerts`; patient-detail, `pages/audit.tsx` | M |
| 23 | **Outbreak detection and visitor controls.**<br>• Run a cluster-detection job and set an outbreak flag.<br>• Make visitor-pass issue enforce visiting hours, the per-patient visitor limit and the outbreak flag.<br>• Feed antibiotic DDD from dispensing data. | HAI control (NABH HIC). | `medbrains-infection-control/src/infection_control.rs`; `crates/medbrains-ancillary/src/front_office.rs` (:418); `antibiotic_consumption_records`; `infection-control/outbreak-tab.tsx`, `front-office/visitor-management-tab.tsx` | M |
| 24 | **ABDM M1 to completion.**<br>• ABHA v3 enrolment (Aadhaar OTP, mobile, DL) and ABHA address creation, with screens for the existing login-OTP routes.<br>• Scan & Share.<br>• HFR registration (enqueue `abdm.hfr.register`, register its handler, write `tenants.abdm_facility_id`).<br>• HPR.<br>• Register the NHCX `ClaimSubmitHandler` with JWE/JWS. | Certification prerequisite and DHIS incentives; NHCX claims currently never leave the system. | `crates/medbrains-abdm/src/abha.rs`; `crates/medbrains-outbox/src/handlers/{abdm_stub,nhcx}.rs`; `crates/medbrains-server/src/main.rs` (registry ~752-835); `crates/medbrains-facilities/src/nhcx_submit.rs`; front-office registration, admin ABDM screen | L |
| 25 | **ABDM M2/M3 (HIP/HIU).**<br>• Care-context and consent-artefact tables.<br>• Discover, link, consent-notify and health-information-request handlers.<br>• Fidelius ECDH Curve25519 encryption.<br>• NRCeS bundles with `meta.profile` and validation: OPConsult, Prescription, DiagnosticReport, DischargeSummary, Immunization, Wellness, Invoice.<br>• Then functional testing, WASA (CERT-In) and Safe-to-Host. | Required for ABDM production go-live. | `crates/medbrains-fhir`, `medbrains-fhir-api`; new migrations; ABDM admin and patient consent screens | L |

Lower-priority but wide gaps:
- **Academic ERP (§21).** 38 criteria are missing: NMC MSR, attendance, exams, hostel and so on.
- **Printing (§28).**
  - About 115 registry prints carry no letterhead, signature block or `document_outputs` trail.
  - Consent forms print in English only (`crates/medbrains-print-data/src/consent.rs:159`).
  - These forms are missing: PCPNDT Form F, ICU flowsheet, death certificate in Form 4/4A, and the MHCA forms.
- **Native TV app.** It is absent: `apps/android/settings.gradle.kts` has no tv module.
- **Lab and radiology TV queues** return placeholder data (`crates/medbrains-tv/src/lib.rs:1534-1575`).
- **Uploads** have no antivirus scan and no size limit (`crates/medbrains-upload`).
- **Web sessions** have no idle timeout.

---

# 3. NABH / ACMSRC checklist — per-criterion tables

### 1. Medical Department (Doctors)

| # | Criterion (short) | Status | Evidence | Gap | Fix |
|---|---|---|---|---|---|
| 1 | Patient search UHID/name/phone/Aadhaar/ABHA | Partly | medbrains-patients/src/lib.rs:1121 (uhid/name/phone ILIKE), :3410 fuzzy | ABHA/Aadhaar not searchable | S |
| 2 | Queue: doctor calls next | Met | medbrains-tokens/src/lib.rs:1708 `call_next`; pages/token-console.tsx | | |
| 3 | Auto-load history/allergies/meds | Met | pages/opd/LastVisitHint.tsx, components/Patient/PatientContextSummary.tsx | | |
| 4 | Pre-consult vitals visible | Met | pages/opd/vitals.tsx, vitals-counter.tsx; /api/nurse/vitals | | |
| 5 | 16 specialty casesheet templates | Partly | specialty_templates (specialty-other/src/lib.rs:1223), pages/specialty/other.tsx "templates"; ~9 specialty modules | No 16 seeded specialty casesheets | M |
| 6 | ICD-10 diagnosis auto-suggest | Met | /opd/icd10/search (opd/src/lib.rs:4401, icd10_codes); components/Clinical/DiagnosisPanel.tsx + Icd11CodeSelect | | |
| 7 | Differential diagnosis | Partly | soap-sections.tsx:52 hint text; 0950_reference_data.sql:89 template | Free text only, no structured DDx | S |
| 8 | Rx DDI + allergy + formulary | Partly | opd/src/lib.rs:300-312 server-required override reasons (allergy, interaction, duplicate); PrescriptionWriter checkDrugSafety | Formulary (`pharmacy_catalog.formulary_status`) not enforced at Rx | S |
| 9 | Electronic lab/rad ordering | Met | pages/opd/investigations.tsx; order-basket; lab/radiology auto_charge | | |
| 10 | Referral w/ reason, urgency, bi-directional | Met | opd/src/referral_lifecycle.rs accept/decline/complete; pages/opd/referral-actions.tsx | | |
| 11 | Follow-up + SMS/WhatsApp reminder | Met | pages/opd/follow-up.tsx bookAppointment; server services/appointment_reminders.rs (SMS outbox) | WhatsApp template configured but SMS-only send | S |
| 12 | Auto-billing consult + investigations | Met | server-services/src/billing.rs:241 auto_charge; lab/src/lib.rs:707, radiology/src/lib.rs:797 | | |
| 13 | Admission with bed picker | Met | pages/ipd/admission-form.tsx BedSelect; opd/admit-to-ipd-button.tsx | | |
| 14 | OPD history carried to IPD | Met | opdService.admitFromOpd; one case-sheet ledger (clinical-notes) | | |
| 15 | Ward round + voice-to-text | Partly | clinical-notes ledger (case-sheet) | No speech-to-text anywhere | M |
| 16 | Timestamped progress notes | Met | medbrains-clinical-notes; components/Clinical/case-sheet/NoteCard.tsx | | |
| 17 | Treatment chart dose/route/freq/duration | Met | pages/ipd/admission-prescriptions.tsx; ipd_medication_administration | | |
| 18 | Co-sign resident orders | Partly | clinical-notes/src/cosign.rs (notes); telehealth cds.rs:1699 co_signature_requests; VerbalOrderRegister | Countersign covers notes/verbal orders, not resident med orders | M |
| 19 | Inline lab/rad results in casesheet | Met | pages/ipd/investigations.tsx | | |
| 20 | Discharge summary auto-gen editable | Met | ipd discharge-summary + finalize routes; generate-discharge-summary-modal.tsx | | |
| 21 | DAMA/LAMA with consent | Met | /api/ipd/admissions/{id}/dama; components/Ipd/DamaModal.tsx (patient/relative/witness) | | |
| 22 | Death summary | Met | ipd/src/lib.rs:6870 ipd_death_summaries; pages/ipd/death-summary.tsx | | |
| 23 | Inter-dept transfer w/ summary | Met | ipd/src/lib.rs:6792 inter_department + clinical_summary; pages/ipd/transfer-log.tsx | | |
| 24 | DDI alerts at Rx | Met | drug_interactions (0320_pharmacy.sql:63); opd override reason; telehealth cds.rs:319 | | |
| 25 | Allergy alerts prominent | Met | patient_allergies; utils/allergyMatch.ts; PatientCard banner | | |
| 26 | Duplicate order detection (configurable) | Partly | order-basket/src/lib.rs:1294 DUPLICATE_LAB_TODAY; lib/advisoryCheck.ts | Window fixed to "today", not configurable | S |
| 27 | Renal dose alerts | Met | telehealth/src/cds.rs:70 RenalDoseAlert (eGFR); features/prescription/RxDoctor.tsx:266 | | |
| 28 | Critical lab values on doctor dashboard | Met | pages/doctor/my-day.tsx:103; services/critical_alert_escalation.rs | | |
| 29 | Protocols (sepsis, DVT) | Met | care-view SepsisBundleTab, VteTab, WellsDvtTab; medbrains-vte | | |
| 30 | Restricted antibiotic approval | Partly | infection_control.rs:498-624 antibiotic requests; pages/infection-control/stewardship-tab.tsx | Not gating Rx — `enforce_antibiotic_stewardship` client-only, false | M |
| 31 | PG logbook auto-entry | Partly | pg_logbook_entries; pages/pg-logbook.tsx (manual create) | No auto-entry from cases/procedures | M |
| 32 | Intern logging + supervisor verify | Met | verifyPgLogbookEntry; pages/pg-logbook.tsx | | |
| 33 | Student view-only + anonymisation | Missing | no student role / anonymiser found | No student role or de-identified view | L |
| 34 | Supervision hierarchy enforcement | Partly | components/admin/UserSupervisorField.tsx; countersign to supervisor | Not enforced intern→resident→consultant | M |
| 35 | Ophthalmology VA/IOP/fundus/slit-lamp | Met | pages/specialty/ophtho.tsx createOphthoExam | | |
| 36 | Cardiology ECG/Echo/stress | Partly | pages/specialty/cath-lab.tsx (hemodynamics, STEMI) | No ECG viewer/echo/TMT | M |
| 37 | Peds growth charts + vaccination | Missing | only PEWS/paed fluids; occ_health_vaccinations is staff-only | No WHO growth chart, no child immunisation schedule | M |
| 38 | OB ANC/LMP-EDD/USG | Met | pages/specialty/maternity.tsx (anc, labor, newborn); specialty_maternity.rs | | |
| 39 | Ortho joint diagrams/fracture class | Partly | components/BodySite/BodySitePicker.tsx (generic) | No fracture classification templates | M |
| 40 | Psych MSE, HAM-D/BPRS, MHCA | Partly | pages/specialty/psychiatry.tsx (HAM-D/BPRS cols, restraint, MHRB) | No MSE; assessments list-only (no create on screen) | M |
| 41 | Oncology staging/chemo/RECIST | Met | specialty-other/src/lib.rs:1541,1836; pages/specialty/other.tsx chemo/staging tabs | | |
| 42 | Derm lesion map + photos | Partly | BodySitePicker; patient documents upload | No lesion map with linked serial photos | M |

### 2. Emergency / Casualty

| # | Criterion (short) | Status | Evidence | Gap | Fix |
|---|---|---|---|---|---|
| 1 | Minimal/unknown registration, brought-by | Met | patients/src/lib.rs:1425 is_unknown_patient/temporary_name; emergency/src/lib.rs:143 brought_by; PatientRegisterForm | | |
| 2 | Temp UHID with EMERGENCY prefix | Partly | patients/src/lib.rs:1426 normal generate_uhid | No ER-prefixed temporary UHID | S |
| 3 | Triage scoring + colour | Met | triage_level enum (immediate…expectant); /api/emergency/visits/{id}/triage; pages/emergency/triage-log.tsx | | |
| 4 | Auto-notify casualty MO/admin | Partly | emergency/src/lib.rs:923 publish_surface_board_signal (board only) | No push/SMS to duty MO/admin | M |
| 5 | MLC flag + auto police intimation SMS | Partly | /api/emergency/mlc/{id}/police-intimations (manual record) | No automatic SMS/system intimation | M |
| 6 | Arrival→doctor timer | Partly | door_to_doctor_mins (lib.rs:966, client-supplied); WaitTimeBadge in visits.tsx | Not server-computed from first doctor contact | S |
| 7 | Resus bay allocation + timer | Partly | /api/emergency/bays; pages/emergency/resuscitation.tsx | No bay occupancy timer | S |
| 8 | Resus meds/fluids documentation | Met | /api/emergency/visits/{id}/resuscitation; resuscitation-visit-panel.tsx | | |
| 9 | Code Blue + team assembly | Met | emergency/src/lib.rs:1324 (code_blue_team break-glass group); /api/nurse/code-blue/responders,/respond; nurse-activities/code-blue-tab.tsx | | |
| 10 | Crash cart checklist | Met | er_code_activations.crash_cart_checklist; pages/emergency/codes.tsx CrashCartChecklist | | |
| 11 | SBAR handover | Met | nursing/src/nurse_handoff.rs shift_handoffs; handoff-workflow-panel.tsx | | |
| 12 | ER → IPD/OT/ICU | Met | /api/emergency/visits/{id}/admit (admit_from_er) | | |
| 13 | Code Yellow activation | Partly | mass_casualty_events (lib.rs:2254); pages/emergency/mass-casualty.tsx | Event register only, no workflow | M |
| 14 | Auto-notify consultants/admin/blood bank | Partly | notifications_sent column (manual JSON) | No fan-out on activation | M |
| 15 | Batch casualty registration | Missing | — | No bulk registration | M |
| 16 | MCI triage tagging | Partly | triage_level incl. expectant per visit | Not linked to MCI event | S |
| 17 | Disaster resource tracking | Partly | separate bed dashboard, blood inventory, ICU devices | No MCI resource board | M |
| 18 | MLC register auto-number | Met | emergency/src/lib.rs:562 MLC-number; pages/emergency/mlc.tsx | Timestamp-based, not running serial | |
| 19 | Wound certificate | Met | emergency/src/mlc_injuries.rs; 1032_mlc_injuries.sql; mlc-injuries-panel.tsx; print-data medicolegal.rs | | |
| 20 | Age estimation doc | Met | mlc document_type age_estimation; mlc-case-detail.tsx:553 | | |
| 21 | Sexual assault / POCSO | Met | 0150_emergency.sql; field_class.rs; P.EMERGENCY.MLC_DOCUMENTS POCSO; mlc-case-detail.tsx | | |
| 22 | Police intimation receipt confirm | Met | /api/emergency/mlc/police-intimations/{id}/confirm | | |
| 23 | Court summons tracking | Met | COURT_SUMMONS_CREATE doc type (lib.rs:205); mlc-case-detail.tsx MlcCourtSummons form | | |

### 3. Nursing Services

| # | Criterion (short) | Status | Evidence | Gap | Fix |
|---|---|---|---|---|---|
| 1 | Initial head-to-toe assessment | Partly | /api/ipd/admissions/{id}/nursing-assessments (client.ts:6818) | No web screen calls createNursingAssessment | S |
| 2 | Care plan create/modify | Partly | /api/ipd/admissions/{id}/care-plans; pages/ipd/nursing.tsx list-only | No create/update UI | S |
| 3 | Vitals with graphical trend | Partly | /api/nurse/vitals; opd/vitals.tsx arrow deltas; ICU flowsheets chart | No vitals trend chart on ward/IPD | S |
| 4 | I/O with auto balance | Met | /api/ipd/admissions/{id}/io/balance; /api/nurse/io-entries/.../balance; ipd/io-chart.tsx | | |
| 5 | Pain NRS/VAS + trend | Partly | /api/nurse/pain-entries; nurse-activities/safety-tab.tsx history | No trend chart | S |
| 6 | Morse + high-risk auto-alert | Partly | ipd_clinical_assessments; ipd/assessments.tsx; safety-tab badge | Badge only, no alert/notification | S |
| 7 | Braden + prevention protocol trigger | Partly | ipd/src/lib.rs:2628 mirrors to NABH pressure-ulcer register | No prevention care-plan/task trigger | S |
| 8 | GCS tracking | Partly | /api/clinical/gcs compute-only; ER triage gcs_score | Not persisted/trended on IPD | S |
| 9 | Wound care + photo | Partly | /api/nurse/wounds; createWound in safety-tab | No photo upload (only home-care wound_photo_url) | S |
| 10 | MAR order display | Met | /api/ipd/admissions/{id}/mar; nurse-activities/mar-tab.tsx listMarDueNow | | |
| 11 | Barcode patient+drug verify | Met | ipd/src/lib.rs:3106 verify_mar_barcode; components/Nurse/AdministerModal.tsx:59 | | |
| 12 | Admin timestamp + nurse ID | Met | ipd_medication_administration administered_by/at; updateMarRound | | |
| 13 | PRN with reason | Partly | ipd_medication_administration.prn_reason (0220_ipd.sql:1761) | Column never written by any handler | S |
| 14 | Missed dose with reason | Met | ipd/src/lib.rs ~3048 "hold/refuse/missed require a reason and notify prescriber" | | |
| 15 | High-alert double check | Met | ipd/src/lib.rs ~3048 high-alert needs witness ≠ giver | | |
| 16 | Chemo admin needs chemo cert (ABAC) | Missing | — | No nurse credential check for chemo | M |
| 17 | SBAR handover | Met | nursing/src/nurse_handoff.rs; createHandoff/acceptHandoff in handoff-workflow-panel.tsx | | |
| 18 | Pending task carryover | Met | analytics/src/care_view.rs; care-view/HandoverTab.tsx:101 pending_tasks | | |
| 19 | Critical patient flag for next shift | Met | care-view/HandoverTab.tsx:64-82 is_critical | | |
| 20 | Nurse call integration + response time | Partly | bedside-portal nurse call; ward board timings | No hardware call-bell integration | M |
| 21 | Nurse call escalation 2/5 min | Met | server/src/services/nurse_call_escalation.rs (two tenant thresholds) | | |
| 22 | Wristband barcode verify | Met | verify_mar_barcode (wristband=UHID) | | |
| 23 | Consent verify by scan pre-procedure | Partly | pages/consent/verification-tab.tsx; OT checklist | No patient+consent barcode scan | M |
| 24 | Transfusion checklist + reaction monitor | Met | blood-bank/src/bedside_transfusion.rs two-person verify; TransfusionMonitorDrawer.tsx reaction_suspected | | |
| 25 | Incident reporting, anonymous | Met | pages/quality/incidents-tab.tsx:388 is_anonymous | | |
| 26 | Restraint log q30min | Partly | restraint_monitoring_events (nurse_clinical.rs); ipd/clinical-docs.tsx restraint checks | No 30-min schedule/overdue alert | S |
| 27 | Elopement risk assessment | Partly | sec_patient_tag_type 'elopement_risk'; security/patient-safety-tab.tsx | Tag only, no scored assessment | S |
| 28 | ICU hourly flowsheet | Met | facilities/src/icu.rs; pages/icu/flowsheets-tab.tsx | | |
| 29 | NICU assessment/feeding/phototherapy | Partly | pages/icu/neonatal-tab.tsx bilirubin/phototherapy | No feeding chart | S |
| 30 | OT WHO checklist/instrument count/specimen | Met | pages/ot/checklist-tab.tsx sign_in/time_out/sign_out; case-record-tab.tsx counts + specimens | | |
| 31 | Dialysis pre/intra/post | Partly | specialty-other dialysis; other.tsx pre/post weight, UF | No intra-dialytic monitoring | S |
| 32 | Endoscopy sedation + Aldrete | Met | pages/specialty/endoscopy.tsx sedation/aldrete; clinical-scores/src/aldrete.rs | | |



### 4. Pharmacy
| # | Criterion (short) | Status | Evidence | Gap | Fix |
|---|---|---|---|---|---|
| 1 | E-prescription receipt OPD/IPD/ER | Met | medbrains-pharmacy list_rx_queue/review_prescription (lib.rs:6203,6462); pages/pharmacy/rx-queue.tsx | | |
| 2 | Rx validation dose/freq/route/duration | Partly | validate_order lib.rs:3506 (formulary + max_dose_per_day warning lib.rs:1435) | No freq/route/duration rules; dose is a text warning | M |
| 3 | DDI alert at dispensing | Partly | check_drug_interactions lib.rs:6005; pharmacy/drug-interaction-modal.tsx (manual) | dispense_order never checks DDI; review sets interaction_check_done=true without running it (lib.rs:6514) | M |
| 4 | Allergy cross-check before dispense | Met | dispense_order drug_allergy_conflicts + override log pharmacy_allergy_check_log (lib.rs:2850) | | |
| 5 | Barcode dispensing + patient verify | Met | pharmacy-fulfilment verify_line scanned_code (lib.rs:469-551); pharmacy/verify-view.tsx; token collect | | |
| 6 | Substitution w/ doctor notification | Partly | pharmacy-dispense-ops create_substitution -> pharmacy_substitutions; components/Pharmacy/SubstituteModal.tsx | No prescriber notification/ack | S |
| 7 | IP unit-dose vs bulk dispensing | Partly | pages/ward-stock.tsx (par/replenish/consume); dispensing_type on orders | No unit-dose/cart-fill workflow | M |
| 8 | Discharge meds linked to discharge summary | Partly | create_discharge_dispensing lib.rs:3882, /pharmacy/discharge-dispensing | createDischargeMeds has no web caller | S |
| 9 | Real-time stock across locations | Met | location_stock_dashboard lib.rs:4807; pharmacy/stock.tsx | | |
| 10 | Reorder level alerts per drug | Met | catalog reorder_level; stock.tsx:112,323 low_stock badge | reorder-suggestions API unused (minor) | |
| 11 | FEFO enforcement | Met | try_decrement_fefo_batch_stock_for_dispense_in_tx (lib.rs:~3065); select_fefo_batch | | |
| 12 | Batch tracking procurement->dispense | Met | pharmacy_batches; batch_number/expiry stamped on order items (lib.rs:~3085); batch-ledger-view.tsx | | |
| 13 | Near-expiry dashboard 30/60/90 configurable | Partly | near_expiry_report lib.rs:4972; near-expiry-view.tsx:17 | UI hard-codes 90d, not configurable | S |
| 14 | Dead stock identification | Met | dead_stock_report lib.rs:5009; dead-stock-view.tsx | | |
| 15 | Inter-location transfer | Met | create/approve/dispatch/receive_transfer lib.rs:5254-5460; transfers-view.tsx, transfer-create-drawer.tsx | | |
| 16 | Formulary management | Met | catalog formulary_status; pharmacy/catalog.tsx; formulary-check-modal.tsx | | |
| 17 | Non-formulary request -> DTC approval | Partly | non_formulary flag warns in validate_order lib.rs:3587 | No request/approval workflow or table | M |
| 18 | Restricted antibiotic approval (AMS) | Partly | aware_category + "restricted" warning lib.rs:1424; infection-control/stewardship-tab.tsx | No approval gate before dispense | M |
| 19 | NDPS register / controlled tracking | Met | pharmacy_ndps_register auto-entry in dispense (lib.rs:~3150); ndps-register.tsx; schedule H/H1/X enforce lib.rs:519 | | |
| 20 | Opioid register ward/patient-wise | Partly | pharmacy_ndps_register.patient_id; ndps_report lib.rs:4643 | No ward-wise / patient-wise opioid report | S |
| 21 | Drug recall management | Partly | pharmacy-safety list/create/complete_recall, affected-patients (lib.rs:172-274) | No web screen calls recall APIs | S |
| 22 | Auto-billing on dispense | Met | ensure_pharmacy_billing_indent_for_order_in_tx in dispense_order (lib.rs:~3220); unpaid gate | | |
| 23 | Returns with credit note | Met | create_return/process_return lib.rs:5544-5699; /pharmacy/credit-notes; returns-workspace.tsx | | |
| 24 | Insurance/TPA drug approval | Partly | pharmacy-dispense-ops create_coverage_check (/pharmacy/coverage-checks) | No screen; not a dispense gate | M |
| 25 | Package-based dispensing | Partly | pharmacy_orders.billing_package_id (lib.rs:86,1982) | No UI sets it; no package consumption | M |
| 26 | ABC/VED/XYZ analysis | Partly | abc_ved_analysis lib.rs:5901; abc-ved-view.tsx | No XYZ | S |
| 27 | Drug utilization review | Met | drug_utilization_review lib.rs:5954; utilization-view.tsx | | |
| 28 | ADR reporting to PvPI | Partly | medbrains-regulatory submit_adr_to_pvpi (lib.rs:952) adr_reports; regulatory/adr-tab.tsx | Only flips submitted_to_pvpi; no PvPI form/XML export | M |
| 29 | CDSCO compliance reporting | Partly | submit_mv_to_cdsco regulatory lib.rs:1163 (materiovigilance only) | No CDSCO drug/schedule returns | M |
| 30 | DTC report generation | Missing | no dtc/committee tables or routes | No DTC module | M |

### 5. Laboratory
| # | Criterion (short) | Status | Evidence | Gap | Fix |
|---|---|---|---|---|---|
| 1 | E-ordering OPD/IPD/ER | Met | medbrains-lab create_order; createLabOrder from investigations.tsx, lab/order-create.tsx | | |
| 2 | Barcode label at order | Partly | lab_orders.sample_barcode set at collect (lab lib.rs:806-871) | Label keyed at draw, not generated/printed at order | S |
| 3 | Collection ack w/ time + collector | Met | collect_sample w/ positive patient ID, collected_by; order-detail.tsx | | |
| 4 | Rejection criteria + reason | Met | reject_sample, rejection_reason; order-detail.tsx | | |
| 5 | Sample tracking collect->transport->receipt->report | Partly | statuses ordered/sample_collected/processing/completed | No transport/lab-receipt stage | M |
| 6 | Phlebotomy queue | Met | list_phlebotomy_queue/assign_phlebotomist; lab/phlebotomy.tsx | | |
| 7 | Outsourced test mgmt | Met | create/update_outsourced_order; lab/outsourced.tsx | | |
| 8 | Manual entry w/ normal range | Met | add_results; lab/reference_range.rs; order-detail.tsx | | |
| 9 | Auto-validation within range | Partly | auto_validate_result; button in order-detail.tsx | User-triggered, not automatic on result arrival | S |
| 10 | Critical value flag + alert doctor | Met | list_critical_alerts/list_doctor_critical_alerts; CriticalValueInbox.tsx | | |
| 11 | Delta check | Met | catalog delta_check_percent; add_results delta logic lab lib.rs:1562-1600 | | |
| 12 | Tech -> pathologist verification | Met | verify_results requires lab.results.VERIFY (lib.rs:1115); order-detail.tsx | | |
| 13 | Cumulative report | Met | get_cumulative_report; lab/cumulative-drawer.tsx | | |
| 14 | Report format customization | Partly | /lab/report-templates CRUD | No create/edit screen (only listed in MasterDataStatusSettings) | S |
| 15 | Auto-delivery to doctor + portal | Met | /api/portal/lab-reports (routes/mod.rs:765); iOS PatientHomeView; report dispatch dispatch.tsx | | |
| 16 | Bi-directional HL7/ASTM | Partly | medbrains-bridge hl7_listener.rs (MLLP inbound + ACK) | No order download (ORM/ASTM host query); no ASTM | L |
| 17 | Supported analyzer list | Partly | /api/devices/catalog; seed device_integration_fixtures.rs (Roche, Sysmex demo) | Demo adapters only, unverified on real models | M |
| 18 | Auto result capture | Met | /api/device-ingest/{module} -> INSERT lab_results (devices lib.rs:925); admin/devices.tsx | | |
| 19 | Analyzer worklist from pending orders | Partly | get_analyzer_worklist lib.rs:5391; lab/bench-worklist.tsx | Bench list only; not pushed to analyzer | M |
| 20 | Multi-analyzer failover per test | Missing | none | No test->analyzer routing/failover | M |
| 21 | IQC Levey-Jennings + Westgard | Met | lab/westgard.rs; create_qc_result/review; qc-results.tsx:88,264 | | |
| 22 | EQAS tracking | Met | create/update_eqas; lab/eqas.tsx | | |
| 23 | Calibration tracking | Met | create_calibration; lab/calibrations.tsx | | |
| 24 | Reagent lot + expiry | Met | create/update_reagent_lot; lab/reagent-lots.tsx | | |
| 25 | NABL document control | Met | create/update_nabl_document; lab/nabl-documents.tsx | | |
| 26 | TAT per test w/ SLA alerts | Partly | get_tat_monitoring is_breached; lab/tat-analytics.tsx | Breach shown, no proactive alert | S |
| 27 | Proficiency testing | Met | create_proficiency_test; lab/proficiency-testing.tsx (in qc-compliance.tsx) | | |
| 28 | Micro C/S + antibiogram | Partly | antibiogram parsed from free-text results in infection-control/stewardship-tab.tsx:58 | No structured organism/susceptibility entry in lab | M |
| 29 | Histopath gross/micro/stains/IHC/synoptic | Met | create_histopath_report (special_stains, synoptic_data lib.rs:3728); lab/histopath.tsx | | |
| 30 | Blood bank cross-match link | Met | get_order_crossmatch /lab/orders/{id}/crossmatch; order-detail.tsx | | |
| 31 | Cytology reporting | Met | create_cytology_report; lab/cytology.tsx | | |
| 32 | Molecular/PCR | Met | create_molecular_report; lab/molecular.tsx | | |

### 6. Radiology
| # | Criterion (short) | Status | Evidence | Gap | Fix |
|---|---|---|---|---|---|
| 1 | E-order w/ clinical indication | Met | medbrains-radiology create_order; radiology/create-order-drawer.tsx | | |
| 2 | Modality worklist (MWL) | Missing | no worklist/MWL in radiology crate | No DICOM MWL SCP feed | L |
| 3 | Scheduling CT/MRI/USG | Met | create_radiology_appointment; radiology/appointments-tab.tsx | | |
| 4 | STAT priority | Met | priority on orders; create-order-drawer.tsx, radiology-orders-tab.tsx | | |
| 5 | Pregnancy check before radiation | Met | pregnancy_checked (radiology lib.rs:406,666); create-order-drawer.tsx | | |
| 6 | Contrast allergy flag | Met | contrast_screening (/radiology/contrast-screening); create-order-drawer.tsx | | |
| 7 | DICOM storage/retrieval | Partly | radiology_dicom_studies (orthanc_id, viewer_url); dicom-studies-tab.tsx | Table written only by seed; no Orthanc/C-STORE ingest | L |
| 8 | Web DICOM viewer | Partly | viewer_url link in dicom-studies-tab.tsx; /public/radiology/viewer | No embedded viewer (OHIF etc.) | M |
| 9 | Prior study comparison | Partly | get_prior_studies; used in imaging-tab.tsx | List only, no side-by-side | M |
| 10 | Multi-modality support | Met | radiology_modalities CRUD; modalities-tab.tsx | | |
| 11 | Share via viewer link | Partly | create_share_link/validate_share_link (lib.rs:~1897) | No screen calls createRadiologyShareLink | S |
| 12 | CD/USB burn w/ viewer | Partly | get_download_package /radiology/download-package/{id} | No screen; no viewer bundle | M |
| 13 | Orthanc/PACS integration | Partly | get/update_pacs_config; orthanc_id column | No sync job; update has no screen | L |
| 14 | Structured templates per modality | Partly | radiology_reports.template_name (free text) | No template master/structured fields | M |
| 15 | Voice dictation | Missing | none | No speech-to-text | M |
| 16 | Prelim (resident) -> final (consultant) | Met | create_report status preliminary; verify_report; order-detail-drawer.tsx | | |
| 17 | Critical finding alert | Met | is_critical -> alert + notify clinician (lib.rs:1170) | Ack API has no screen (minor) | |
| 18 | Report to doctor + patient portal | Partly | list_patient_reports (patientDetail.service.ts) | No /api/portal radiology route | S |
| 19 | TAT per modality w/ SLA alerts | Partly | get_radiology_tat; tat-analytics-tab.tsx | No SLA thresholds/alerts | S |
| 20 | Cumulative patient dose | Partly | cumulative_dose used in create-order-drawer.tsx; record_dose INSERT radiation_dose_records lib.rs:1553 | recordRadiationDose has no screen -> doses never captured | S |
| 21 | CT DLP/CTDIvol auto-capture | Missing | dlp/ctdi columns, manual only | No RDSR/MPPS ingest | L |
| 22 | Fluoro DAP/time cath/IR | Partly | specialty-interventional fluoroscopy_time_seconds,total_dap (lib.rs:53,312); specialty/cath-lab.tsx | Manual, not rolled into patient dose | S |
| 23 | AERB nuclear source inventory | Missing | none (only modalities.aerb_license_number) | No source/isotope inventory | M |
| 24 | Personnel dosimetry | Partly | list/create_dosimetry_record /radiology/dosimetry | No screen | S |
| 25 | AERB compliance report | Missing | none | No AERB report | M |



### 7. Finance & Billing
| # | Criterion (short) | Status | Evidence | Gap | Fix |
|---|---|---|---|---|---|
| 1 | OPD bill auto from orders | Met | auto_charge in medbrains-opd/lab/radiology lib.rs; server-services/billing.rs; billing pages | | |
| 2 | IPD room/consumables/pharmacy auto | Met | server/src/services/room_rent.rs (hourly bed-day lines); pharmacy/indent auto_charge | | |
| 3 | Interim bill | Partly | POST /api/billing/invoices/interim; is_interim badge in invoice-detail.tsx:599 | createInterimInvoice unused, no screen can raise one | S |
| 4 | Final bill at discharge | Met | ipd/src/lib.rs:2239 drafts->issued on discharge; block_discharge_unsettled | | |
| 5 | Payment modes | Met | enum payment_mode (cash,card,upi,bank_transfer,cheque); recordPayment in invoice-detail | | |
| 6 | Advance/deposit | Met | /api/billing/advances(+adjust,refund); pages/billing/advances.tsx | | |
| 7 | Refund with approval | Partly | billing/src/adjustments.rs:262 create_refund (payments.VOID perm) ; refunds-credits.tsx | single step, no approve/maker-checker | M |
| 8 | Concession with auth levels | Partly | billing/src/concessions.rs approve/reject; auto-rules | one approver, no amount-tiered levels | M |
| 9 | Package billing | Met | /api/billing/packages; pages/billing/packages.tsx | | |
| 10 | ER deferred billing | Met | invoices.is_er_deferred (billing lib.rs:712); /api/billing/er-invoice used | | |
| 11 | TPA pre-auth | Met | /api/insurance/prior-auths submit/respond; insurance/prior-auth-tab.tsx | PA document attach unused | |
| 12 | Cashless claim tracking | Met | /api/billing/insurance-claims, submit-to-nhcx; insurance-claims.tsx, billing-tpa-pipeline.tsx | | |
| 13 | Reimbursement docs | Partly | /api/billing/insurance-claims/{id}/reimbursement-docs | generate/updateReimbursementDocs unused | S |
| 14 | CGHS/ECHS/ESI/PMJAY | Partly | /api/billing/scheme-rate; NHCX route; seed insurance_providers | getSchemeRate unused; no scheme portal integration | L |
| 15 | Claim rejection/resubmit | Met | /api/insurance/appeals; insurance/appeals-tab.tsx | | |
| 16 | TPA rate negotiation | Met | /api/billing/tpa-rate-cards; billing/rate-plans.tsx | update unused (delete+create) | |
| 17 | Co-pay/deductible | Met | /api/billing/copay/calculate (calculateCopay used) | | |
| 18 | Revenue dashboard | Met | /api/billing/reports/summary,daily; billing/reports.tsx | | |
| 19 | Receivables patient+TPA | Met | reports/aging, insurance-receivables/aging, credit-patients/aging | | |
| 20 | Dept revenue | Met | reports/department-revenue | | |
| 21 | Doctor revenue | Met | reports/doctor-revenue | | |
| 22 | Bad debt write-off | Met | /api/billing/write-offs + approve | | |
| 23 | Credit patients | Met | /api/billing/credit-patients; billing/credit-patients.tsx | | |
| 24 | GST invoicing/returns | Met | /api/billing/gst-returns generate/file; reports/hsn-summary | | |
| 25 | TDS | Met | /api/billing/tds deposit/certificate | | |
| 26 | Tamper-proof fin. audit | Partly | billing_audit_log (0050_billing.sql:177); billing/audit-log.tsx | no hash chain (unlike audit_log); UPDATE allowed | S |
| 27 | Day/month-end recon | Met | /api/billing/day-closes+verify; reports/reconciliation; bank auto-reconcile | | |
| 28 | Financial MIS | Met | reports/financial-mis, profit-loss; accounting-tabs.tsx | | |

### 8. HR & Administration
| # | Criterion (short) | Status | Evidence | Gap | Fix |
|---|---|---|---|---|---|
| 1 | Employee master | Met | employees (0190_hr.sql); hr/employees-tab.tsx; regn in employee_credentials | | |
| 2 | Credentialing + renewal | Met | employee_credentials(registration_no,expiry_date); hr lib.rs:2457 90-day expiry; compliance-tab.tsx | updateCredential unused | |
| 3 | Document mgmt | Partly | employee_credentials.document_url | no appointment-letter/certificate store | M |
| 4 | Dept/designation hierarchy | Met | /api/hr/designations; employees.reporting_to | | |
| 5 | Onboarding workflow | Missing | none | no onboarding checklist/flow | M |
| 6 | Separation/exit | Partly | date_of_leaving; hr lib.rs:811 revokes access on terminal status | updateEmployee unused; no exit/F&F flow | M |
| 7 | Biometric integration | Partly | device category biometric_reader (0130_devices.sql) | no device punch ingestion | L |
| 8 | AEBAS compliance | Partly | infra-utils/src/aebas.rs POST /api/aebas/period-summary; hr/aebas-import-drawer.tsx | summary import only | M |
| 9 | Multi-shift | Met | /api/hr/shifts; roster-tab.tsx | | |
| 10 | Late/early tracking | Partly | attendance_records.is_late/late_minutes/early_minutes | nothing computes them (no writer sets) | S |
| 11 | Overtime | Met | hr lib.rs:1608 overtime_minutes on shift extend; duty-hours-tab.tsx | | |
| 12 | Roster + swap | Met | /api/hr/rosters, approve-swap; roster-tab.tsx | | |
| 13 | Payroll w/ attendance | Met | payroll/src/lib.rs:272 counts attendance; payslips.lop_days; hr/payroll.tsx | | |
| 14 | Leave types | Met | enum leave_type (casual,earned,medical,maternity,paternity...) ; leave-tab.tsx | | |
| 15 | Leave approval chain | Met | leave_requests hod_id/admin_id; /api/hr/leaves/{id}/action | | |
| 16 | Salary slip | Partly | payslips table; listPayslips on payroll.tsx | no printable slip | S |
| 17 | PF/ESI/TDS | Met | payslips pf,esi,pt,tds; salary_structures *_applicable | | |
| 18 | Arrears/increment | Partly | salary_structures.effective_from | no arrears computation | M |
| 19 | On-call schedule | Met | /api/hr/on-call (createOnCall used) | | |
| 20 | Mandatory training | Met | /api/hr/training-programs, training/compliance; training-tab.tsx | | |
| 21 | Appraisal | Met | /api/hr/appraisals; employee-detail-drawer | | |
| 22 | Statutory/POSH records | Met | /api/hr/statutory-records; compliance-tab.tsx | | |
| 23 | Access card + zones | Partly | security_access_cards (security/src/lib.rs:457); security/access-control-tab.tsx | not auto-provisioned from employee role | M |

### 9. Materials & Inventory / Store
| # | Criterion (short) | Status | Evidence | Gap | Fix |
|---|---|---|---|---|---|
| 1 | Dept indent w/ catalog | Met | /api/indent/requisitions; indent/create-indent-panel.tsx | | |
| 2 | Multi-level indent approval | Partly | indent lib.rs:565 approve (submitted->approved) | single level, no committee stage | M |
| 3 | PO from indent | Met | purchase_orders.indent_requisition_id; purchase-order-panel.tsx:238 | | |
| 4 | Vendor comparison | Met | /api/procurement/vendor-comparison (used) | | |
| 5 | Rate contract validity | Met | /api/procurement/rate-contracts; rate-contract-panel.tsx | | |
| 6 | Emergency purchase | Partly | procurement.rs:1725 create_emergency_po; po.is_emergency | createEmergencyPo unused | S |
| 7 | GRN with QC | Partly | procurement.rs:1073 create_grn (accepted/rejected qty); grn-panel.tsx | complete_grn (inspected_by) unused, no QC sign-off on screen | S |
| 8 | Batch/expiry at receipt | Met | grn_items batch/expiry -> batch_stock; batch-stock-panel.tsx | | |
| 9 | FEFO enforcement | Missing | indent lib.rs:896 issue decrements store_catalog.current_stock only | store issue not batch-level, no FEFO (pharmacy only) | M |
| 10 | Multi-location stores | Met | store_locations; store-location-panel.tsx | | |
| 11 | Bin/rack | Partly | store_catalog.bin_location (indent lib.rs:1143) | not on any screen | S |
| 12 | Cold chain | Partly | requires_temperature_log flag (pages/assets.tsx:801) | no temp log/excursion for stores | M |
| 13 | Dept issue + stock deduct | Met | /requisitions/{id}/issue (indent lib.rs:896) | createDepartmentIssue unused | |
| 14 | Patient consumables->bill | Met | /api/indent/patient-consumables is_chargeable + auto_charge; PatientConsumablesPanel.tsx | | |
| 15 | Return to store | Partly | POST /api/indent/returns | createReturnToStore unused | S |
| 16 | Consumption analysis | Met | indent/analytics/consumption; analytics-panel.tsx | | |
| 17 | Reorder alerts | Partly | reorder_alerts routes; createReorderIndent used | list/ack/check alerts unused | S |
| 18 | Dead/slow stock | Met | analytics/dead-stock, fsn | | |
| 19 | Consignment | Met | consignment-stock, consignment-usage (used) | | |
| 20 | High-value serial/barcode | Met | batch_stock.serial_number/barcode; store_catalog.is_high_value; batch-stock-panel.tsx | | |
| 21 | Implant registry | Met | /api/indent/implant-registry; assets-implants-panel.tsx | update unused | |
| 22 | Condemnation committee | Partly | equipment_condemnations (committee_remarks, approved_by); /condemnations/{id}/status | single approver, no committee members | M |
| 23 | ABC/VED/XYZ | Partly | analytics/abc, ved, fsn | no XYZ | S |
| 24 | Vendor performance | Met | vendor-performance-panel.tsx | | |
| 25 | Purchase vs consumption | Met | analytics/purchase-vs-consumption | | |
| 26 | Valuation | Met | analytics/valuation | | |
| 27 | NMC/NABH compliance rpt | Met | analytics/compliance (getComplianceReport used) | | |

### 10. Biomedical Engineering
| # | Criterion (short) | Status | Evidence | Gap | Fix |
|---|---|---|---|---|---|
| 1 | Equipment database | Met | bme_equipment; bme/equipment-tab.tsx | | |
| 2 | QR/barcode tag | Partly | bme_equipment.asset_tag/barcode_value | no QR print/scan on BME screens | S |
| 3 | Critical/risk category | Met | risk_category,is_critical; equipment-tab.tsx:171 | | |
| 4 | Installation/commissioning | Partly | installation_date,commissioned_date,commissioning_notes cols | not in equipment-tab UI | S |
| 5 | Warranty + vendor | Met | warranty_*; vendor_id; equipment-tab.tsx:174 | | |
| 6 | Lifecycle tracking | Partly | status (condemned), purchase/disposal cols | no procurement->condemnation linkage view | M |
| 7 | PM schedule generation | Met | bme_pm_schedules.frequency; bme lib.rs:836 rolls next_due on completion; pm-tab.tsx | | |
| 8 | PM checklist per type | Partly | bme_pm_schedules.checklist, work_orders.checklist_results | not on pm-tab | S |
| 9 | PM compliance dashboard | Met | /api/bme/stats pm_overdue; pm-tab.tsx:286 | | |
| 10 | Work orders | Met | /api/bme/work-orders + status | | |
| 11 | PM tech sign-off | Met | bme lib.rs:812 technician_sign_off_by on completed | | |
| 12 | PM history | Met | work orders by equipment_id | | |
| 13 | Calibration schedule | Met | bme_calibrations.frequency,next_due_date; calibration-tab.tsx | | |
| 14 | Calibration due alerts | Partly | stats calibration_overdue | no notification/job | S |
| 15 | Certificate storage | Partly | certificate_number, certificate_url cols | UI shows number only, no upload | S |
| 16 | Out-of-cal auto-lock | Partly | bme_calibrations.is_locked shown (calibration-tab.tsx:150) | no auto-lock, no use block in lab/radiology | M |
| 17 | Cal. vendor mgmt | Met | calibration_vendor_id; /api/bme/vendor-evaluations | | |
| 18 | AMC/CMC coverage/exclusions | Met | bme_contracts coverage_details,exclusions; contracts-tab.tsx | | |
| 19 | Renewal alerts 30/60/90 | Partly | renewal_alert_days; contracts-tab.tsx:124 badge | screen badge only, no alert | S |
| 20 | Vendor SLA response | Partly | sla_response_hours; breakdowns.vendor_response_at | vendor_response_at never written | S |
| 21 | Contract vs breakdown cost | Missing | contract_value, total_repair_cost cols only | no analysis | S |
| 22 | Vendor evaluation | Met | bme_vendor_evaluations; contracts-tab.tsx | | |
| 23 | Breakdown reporting | Met | /api/bme/breakdowns reported_at; breakdowns-tab.tsx | | |
| 24 | Priority classification | Met | bme_breakdowns.priority | | |
| 25 | Downtime tracking | Met | downtime_minutes (bme lib.rs:1258); breakdowns-tab.tsx:121 | | |
| 26 | Repair documentation | Partly | spare_parts_used/cost, vendor_cost (lib.rs:1262) | breakdowns-tab doesn't capture parts/cost | S |
| 27 | MTBF | Met | /api/bme/analytics/mtbf; analytics-tab.tsx | | |
| 28 | Uptime % for NABH | Met | /api/bme/analytics/uptime; analytics-tab.tsx | | |



### 11. Infection Control

| # | Criterion (short) | Status | Evidence | Gap | Fix |
|---|---|---|---|---|---|
| 1 | CLABSI tracking + device-days | Met | `HaiType::Clabsi` (core/infection_control.rs:12); IC:363 `infection_surveillance_events`, IC:453 `infection_device_days`; IC:1373 `hai_rates` per 1000 days; surveillance-tab.tsx | — | |
| 2 | CAUTI tracking | Met | Same as #1 (`Cauti`) + `indwelling_devices` IC:2036, InvasiveDevicesPanel.tsx | — | |
| 3 | VAP tracking | Met | Same as #1 (`Vap`), ventilator_days IC:1448 | — | |
| 4 | SSI per procedure type | Met | `Ssi` + procedure type field (surveillance-tab.tsx:138); IC:1512 surgical_prophylaxis | — | |
| 5 | HAI rate per unit + benchmark | Partly | IC:1373 `hai_rates` (per department); analytics-tab.tsx | No benchmark (NHSN/national) comparison | S |
| 6 | IC dashboard + real-time alerts | Partly | analytics-tab.tsx (rates, DDD, MDRO IC:1617) | No real-time alerts or push notifications | M |
| 7 | Restricted antibiotic approval | Met | IC:533 `antibiotic_stewardship_requests`, IC:560 review, IC:607 timeout review; stewardship-tab.tsx | — | |
| 8 | Escalation/de-escalation tracking | Met | `escalation_reason` IC:133; de_escalate option stewardship-tab.tsx:416 | — | |
| 9 | Antibiogram from micro data | Partly | stewardship-tab.tsx:59 builds it in the browser from `culture_surveillance.result` parsed as "drug:S" | Not built from lab microbiology AST results | M |
| 10 | Antibiotic duration monitoring | Partly | `duration_days`, `auto_stop_date` IC:535 | No overdue-duration alert | S |
| 11 | DDD per department | Partly | IC:1469 antimicrobial_consumption read by analytics-tab.tsx; writer IC:692 | No screen writes `antibiotic_consumption_records`, and pharmacy dispensing does not feed it | M |
| 12 | Colour-coded segregation per dept/day | Met | IC:771 `biowaste_records.waste_category`; biowaste-tab.tsx | — | |
| 13 | Weight-based waste monitoring | Met | `weight_kg` in biowaste_records; housekeeping bmw-tab.tsx | — | |
| 14 | Transporter manifest/challan | Partly | `manifest_number` field (biowaste-tab.tsx:300) | Manifest number is typed in by hand; no challan document is generated | S |
| 15 | Sharps container fill-level | Partly | `/api/housekeeping/bmw/sharp-replacement` (materials/housekeeping.rs:1112) logs replacement count | No per-container registry or fill level | M |
| 16 | NSI linked to container/ward | Partly | IC:851 `needle_stick_incidents` (location_id, dept, PEP); sharps-safety-tab.tsx | Linked to the ward only, not to a container | S |
| 17 | SPCB Form IV return | Met | `/api/print-data/spcb-bmw-returns/{quarter}` (print-data/regulatory.rs:506) from `nabh_bmw_disposal_log` mirrored by nabh/lib.rs:540; biowaste-tab.tsx:180 | — | |
| 18 | Mercury phase-out tracking | Missing | No hits for "mercury" in crates or the web app | No mercury inventory or phase-out tracking | M |
| 19 | 5-moments compliance | Met | IC:942 `hand_hygiene_audits.moment_breakdown`; hygiene-tab.tsx | — | |
| 20 | HH audit tool | Met | Same as #19 (staff_category, findings) | — | |
| 21 | Endoscope HLD per scope serial | Met | specialty-interventional/lib.rs:961 `endoscopy_reprocessing` (scope_id, HLD chemical/time/result); `endoscopy_scopes.serial_number`; specialty/endoscopy.tsx | — | |
| 22 | Scope culture surveillance | Partly | `endoscopy_scopes.last_culture_result` (0380_specialty.sql:883) is displayed on endoscopy.tsx:171 | No code writes the culture columns | S |
| 23 | Environmental culture tracking | Met | IC:1014 `culture_surveillance` (culture_type, sample_site); hygiene-tab.tsx:212 | — | |
| 24 | Outbreak detection alerts | Missing | Outbreaks are only created by hand (IC:1079); no cluster detection exists | No pathogen clustering alert | M |
| 25 | Line listing | Partly | `outbreak_contacts` IC:1221; outbreak-tab.tsx:51 | No case line-list export | S |
| 26 | Contact tracing | Met | IC:1202 add_outbreak_contact; outbreak-tab.tsx | — | |
| 27 | Outbreak mode (visitors, precautions) | Missing | No outbreak_mode or visitor restriction anywhere | No outbreak mode | M |
| 28 | HICC meeting trigger | Partly | IC:1741 create_ic_meeting → `quality_committee_meetings`; meetings-tab.tsx | Scheduled by hand; an outbreak or threshold breach does not trigger a meeting | S |

### 12. Quality Management & NABH/NMC Compliance

| # | Criterion (short) | Status | Evidence | Gap | Fix |
|---|---|---|---|---|---|
| 1 | Clinical indicators (mortality, readmit, SSI, ALOS) | Met | reports/nabh_indicators.rs `SAFETY_MORTALITY`, `SAFETY_READMISSION_30D`, `OPS_ALOS` computed; SSI via IC `hai_rates`; `/api/nabh/indicators` → components/Reports/NabhIndicatorMatrix.tsx | NABH SSI KPI-16 is catalogue-only (no value computed) | |
| 2 | Safety indicators (falls, med error, PU) | Met | `SAFETY_FALLS_RATE`, `SAFETY_PRESSURE_ULCER_HAI`; Q:2431 patient_safety_indicators (from quality_incidents) → analytics-reviews-tab.tsx | — | |
| 3 | Operational (OPD wait, door-to-doctor, OT util) | Partly | `ACCESS_OPD_WAIT`, `ACCESS_ER_TRIAGE_TAT` computed | No OT utilisation KPI | S |
| 4 | Benchmark comparison | Partly | Static catalogue targets with a red/amber/green colour (NabhIndicatorMatrix.tsx:52) | No national/international benchmark data | M |
| 5 | Auto-calculated from clinical data | Partly | 17 indicators are computed; about 50 NABH_KPI_* are catalogue-only (`append_pending_catalog`, nabh_indicators.rs:579); Q:1779 `calculate_indicator` only COUNTs existing values | Most NABH KPIs are not computed; the custom-indicator "auto" calculation is fake | L |
| 6 | Trend dashboards | Partly | indicators-tab.tsx:411 LineChart (manual values); the matrix shows only current vs previous month | No multi-month trend of the computed KPIs | S |
| 7 | Doc lifecycle Draft→…→Obsolete | Met | `DocumentStatus` (core/quality.rs:10); Q:618 update_document_status; documents-tab.tsx:96 | — | |
| 8 | Version history preserved | Partly | `current_version` column; the `quality_document_versions` table exists (0340_quality.sql:1707) | Nothing writes the versions table | S |
| 9 | Read acknowledgment tracking | Met | Q:706 `quality_document_acknowledgments`, Q:1849 pending acks; documents-tab.tsx:51,104 | — | |
| 10 | Non-ack escalation to HOD | Missing | No escalation code | No escalation job | S |
| 11 | CONTROLLED/UNCONTROLLED watermark | Missing | No watermark for quality documents | No controlled-copy print | S |
| 12 | Training flag for SOPs | Met | `is_training_required` Q:597; documents-tab.tsx:74 filter | — | |
| 13 | External auditor time-limited access | Missing | No time-limited auditor role or access grant | No auditor access | M |
| 14 | Anonymous reporting (technical) | Partly | `is_anonymous` stored, but Q:827 still binds `reported_by = claims.sub` | Reporter identity is still stored, so anonymity is not enforced | S |
| 15 | Incident classification | Met | incident_type + severity incl. near_miss/sentinel (incidents-tab.tsx:257,322) | — | |
| 16 | Auto-route to HOD + QM | Partly | Q:~896 queues the `QualityIncidentReported` clinical event | No guaranteed assignment to the HOD or Quality Manager | S |
| 17 | RCA template (NABH) | Partly | `root_cause` field; IC:1895 outbreak RCA | No structured NABH RCA template (5-whys/fishbone) | M |
| 18 | CAPA with due dates | Met | Q:1056 `quality_capa`, Q:2267 overdue CAPAs; incidents-tab.tsx:149 | — | |
| 19 | Incidents never deletable | Met | No delete route in Q; a soft-delete guardrail trigger on `quality_incidents` (0340_quality.sql:1886) | — | |
| 20 | PvPI / Hemovigilance / Materiovigilance | Partly | regulatory/lib.rs:952 submit_adr_to_pvpi sets a flag; materiovigilance handlers; regulatory/adr-tab.tsx; blood-bank/reports-tab.tsx | Only marks the report as submitted; no PvPI/NACO/CDSCO form or e-submission | M |
| 21 | Committees configurable | Met | Q:1166 `quality_committees`; committees-tab.tsx | — | |
| 22 | Auto-schedule per charter | Met | Q:1898 auto_schedule_meetings (by frequency); committees-tab.tsx:136 | — | |
| 23 | Agenda auto-populated | Missing | `agenda` is only copied from the request body (Q:1231) | Pending incidents and findings are not pulled into the agenda | M |
| 24 | Attendance + minutes | Partly | Q:1273 update_meeting (minutes, attendees) | No screen calls update_meeting | S |
| 25 | Action items w/ assignee/deadline | Partly | Q:1406 `quality_action_items`; committees-tab lists them only | No screen creates or follows up action items | S |
| 26 | Committee compliance dashboard | Met | Q:2297 committee_dashboard → analytics-reviews-tab.tsx:57 | — | |
| 27 | NABH standard-wise RAG | Met | Q:1481/1563 standards + compliance (`ComplianceStatus`); accreditation-tab.tsx (statusColorTone) | — | |
| 28 | NMC MSR tracking + alerts | Missing | Only the `nmc` body enum (core/quality.rs:71) | No MSR parameters | L |
| 29 | Evidence auto-compilation | Partly | Q:1977 compile_evidence counts compliant standards; accreditation-tab.tsx:51 | Evidence is not pulled from the HMS modules | M |
| 30 | Gap analysis + action plan | Partly | `gap_description`, `action_plan`, `target_date` columns (manual entry) | Not generated | S |
| 31 | Mock inspection scheduling | Partly | Q:2135 schedule_audits; audits-tab.tsx:94 | No mock-inspection type or assessor panel | S |
| 32 | NMC NARF self-assessment | Missing | No NARF data collection | No NARF | L |
| 33 | NAAC SSR aggregation | Missing | Only the `naac` body enum | No SSR aggregation | L |

### 13. Front Office & Reception

| # | Criterion (short) | Status | Evidence | Gap | Fix |
|---|---|---|---|---|---|
| 1 | Registration + photo + UHID | Met | crates/medbrains-patients (photo_url, photo_captured_at), uhid sequences; pages/patients/register-page-inner.tsx; PatientAcquisitionCard photo | — | |
| 2 | Duplicate detection (fuzzy) | Met | `POST /api/patients/match`, pg_trgm on name+DOB+phone (patients/lib.rs:3206-3307); register-page-inner.tsx | — | |
| 3 | ABHA creation via ABDM OTP | Partly | abdm/abha.rs login request/verify OTP; server routes/abdm/abha.rs:133; client types | No web screen calls the OTP flow; no enrolment (ABHA creation); components/Patient/AbhaLinkPanel.tsx only shows a status | M |
| 4 | Patient card QR (UHID+ABHA) | Partly | components/Patients/PatientCard.tsx QR (UHID); pages/patient-detail/print-card.ts | ABHA is neither in the QR nor on the card | S |
| 5 | Returning patient search/update | Met | patients list/search + edit (patients pages) | — | |
| 6 | Emergency minimal reg (EMERGENCY prefix) | Partly | `is_unknown_patient` (clinical-core/registration/request.rs:59) | No EMERGENCY UHID prefix or temporary-ID merge | S |
| 7 | Slot vs token configurable per doctor | Partly | Slot booking (appointments/book-modal.tsx:124); doctor schedules (admin/doctor-schedules.tsx); tokens crate | No per-doctor booking-mode switch | S |
| 8 | Real-time doctor availability | Partly | available-slots query in book-modal.tsx | No live in/out/on-break status display | S |
| 9 | Walk-in vs scheduled | Met | appointments.tsx:57 walk_in type; tokens | — | |
| 10 | Token + estimated wait | Met | tokens lib.rs:1162 `ahead`, avg_wait; front-office/board-wait-estimate.tsx | — | |
| 11 | Waiting-area queue display | Met | pages/token-display.tsx, token-board.tsx; tokens/board.rs | — | |
| 12 | SMS/WhatsApp 3 before turn | Partly | SMS is sent when the patient is called (tokens lib.rs:605) | No "N ahead" pre-alert | S |
| 13 | Priority queue (elderly etc.) | Met | queue_categories.rs lanes ("senior", "elderly" lib.rs:1273); front-office/queue-config-tab.tsx | — | |
| 14 | Lab/radiology/pharmacy queues | Met | tokens counters/queue_admin per-module queues; token-console.tsx | — | |
| 15 | Visitor reg photo + ID | Partly | FO:320 visitor_registrations (id_type, id_number, photo_url); visitor-management-tab.tsx:328 | No photo capture in the UI | S |
| 16 | Visitor pass (time, ward, QR) | Met | FO:418 visitor_passes (valid_until, ward, qr_code); ancillary/pass_check.rs; visitor-management-tab.tsx:173 | — | |
| 17 | Visiting-hours enforcement | Partly | `visiting_hours` table (FO:196) | Pass issue does not check the visiting hours | S |
| 18 | Max visitors per patient | Partly | `max_visitors_per_patient` config (FO:225) | Not enforced when a pass is issued | S |
| 19 | Outbreak mode visitor restriction | Missing | No restriction or override | No outbreak mode | M |
| 20 | Special categories (legal/religious/VIP) | Partly | `VisitorCategory` LegalCounsel/Religious/Vip (core/front_office.rs:19); category select in the UI | Categories are recorded but have no category-specific rules or protocol | S |

### 14. ICU / HDU / CCU / NICU / PICU

| # | Criterion (short) | Status | Evidence | Gap | Fix |
|---|---|---|---|---|---|
| 1 | Hourly flowsheet | Met | ICU:170 `icu_flowsheets` (vitals, I/O, infusions); flowsheets-tab.tsx | — | |
| 2 | Ventilator params + ABG | Met | ICU:242 `icu_ventilator_records` (mode, FiO2, PEEP, TV, pH/PaO2/PaCO2); ventilator-tab.tsx | — | |
| 3 | Hemodynamic integration | Partly | MAP and CVP fields; HemodynamicChart (flowsheets-tab.tsx:60) | Manual entry; no cardiac output and no monitor integration | L |
| 4 | Infusion pump tracking | Partly | `infusions` JSON (drug, rate_ml_hr) in the flowsheet | Manual entry; no pump integration and no running-duration tracking | M |
| 5 | RASS + sedation vacation | Partly | `IcuScoreType::Rass` (core/icu.rs:15); scores-tab.tsx | No sedation-vacation (SAT) documentation | S |
| 6 | Nutrition w/ calories | Partly | ICU:548 `icu_nutrition` (calories_kcal, protein); nutrition-tab.tsx | Calories are typed in; no calculation against a target | S |
| 7 | APACHE II/IV calc | Partly | Score types ApacheIi/ApacheIv stored via ICU:314 | Value is typed in by hand; no APACHE calculator | M |
| 8 | SOFA daily | Met | clinical-scores/sofa.rs `/api/clinical/sofa` → care-view/SofaTab.tsx; `icu_scores` with trend in scores-tab.tsx | No reminder for the daily score | |
| 9 | GCS trend | Met | clinical-scores/gcs.rs → care-view/GcsTab.tsx; `/api/print-data/gcs-chart` | — | |
| 10 | PRISM / SNAPPE | Partly | Score types Prism and Snappe exist (manual value) | No calculator | M |
| 11 | Predicted vs actual mortality | Partly | `icu_scores.predicted_mortality` (manual); `NABH_KPI_09_ICU_SMR` is catalogue-only | SMR is not computed | M |
| 12 | ICU LOS + readmission | Met | ICU:656 get_los_analytics → icu/analytics-tab.tsx:81 | — | |
| 13 | Central line bundle + necessity | Met | ICU:488 `icu_bundle_checks` (is_compliant, still_needed, checklist); devices-tab.tsx | — | |
| 14 | Line days auto from insertion | Met | ICU:710 device days from `inserted_at`/`removed_at`; devices-tab.tsx | — | |
| 15 | Catheter days + necessity | Met | `DeviceType::UrinaryCatheter` + bundle checks | — | |
| 16 | Vent days + VAP bundle | Met | `DeviceType::Ventilator` + bundle checklist | — | |
| 17 | Restraint w/ 4-h review | Partly | nursing/nurse_clinical.rs:75 `restraint_monitoring_events`; ipd/lib.rs:6672; nurse-activities.tsx | No enforced 4-hour review cycle or overdue alert | S |
| 18 | Device infection rate auto | Met | ICU:710 get_device_infection_rates → icu/analytics-tab.tsx:17 | — | |
| 19 | Neonatal vitals w/ GA normative ranges | Missing | `icu_neonatal_records` stores GA and weight only | No reference ranges by gestational age | M |
| 20 | Breast milk management | Partly | `breast_milk_type`, `breast_milk_volume_ml` | No labelling, storage or expressed-breast-milk (EBM) bank tracking | M |
| 21 | Phototherapy + bilirubin trend | Met | `bilirubin_total`, `phototherapy_active/hours`; neonatal-tab.tsx:34 LineChart | — | |
| 22 | Neonatal sepsis screening | Partly | `sepsis_screen_result` field | No protocol or score | S |
| 23 | Mother-baby matching (Code Pink) | Partly | `mother_patient_id` (ICU:612); specialty_maternity.rs:110 `id_band_number` | No band-scan match check and no Code Pink trigger | M |
| 24 | NHSP hearing screening | Partly | `hearing_screen_result` field | No NHSP workflow or follow-up | S |



### 15. Operation Theatre (OT)
| # | Criterion (short) | Status | Evidence | Gap | Fix |
|---|---|---|---|---|---|
| 1 | Elective scheduling + slot mgmt | Met | `ot_bookings`, POST /api/ot/bookings (medbrains-ot/src/lib.rs:596, room-overlap lock :629); pages/ot/bookings-tab.tsx, schedule-tab.tsx | | |
| 2 | Emergency booking w/ priority override | Partly | `priority` enum (lib.rs:603), badge bookings-tab.tsx:436 | Emergency still hits the room-conflict block (:651); no bumping or override | M |
| 3 | Pre-op assessment checklist | Met | `ot_preop_assessments`, /bookings/{id}/preop; pages/ot/preop-tab.tsx | | |
| 4 | PAC documentation | Met | same preop record (ASA/fitness/fasting); fasting gate lib.rs:247 | | |
| 5 | Blood reservation to blood bank | Partly | `blood_arranged` bool (lib.rs:123) | Not linked to `crossmatch_requests` | M |
| 6 | OT prep checklist (equipment/instr/positioning) | Partly | WHO sign-in items, `ot_surgeon_preferences`, preop-handoff | No dedicated prep checklist | S |
| 7 | WHO checklist + hard block | Met | `ot_surgical_safety_checklists`; status gate lib.rs:846-906; pages/ot/checklist-tab.tsx | | |
| 8 | Anesthesia record | Met | `ot_anesthesia_records`, /anesthesia; anesthesia-tab.tsx | | |
| 9 | Operative note | Met | `ot_case_records`; case-record-tab.tsx | | |
| 10 | Instrument/sponge count + mismatch alert | Met | `count_closure_blocked` lib.rs:199 blocks closure | | |
| 11 | Implant tracking, barcode + patient link | Partly | `implant_registry` (medbrains-indent); components/Ot/OtImplantRegisterPanel.tsx | Serial/lot typed in; no barcode scan or UDI parse | S |
| 12 | Specimen chain-of-custody to pathology | Partly | `specimens` JSONB on case record; "specimen_labelled" WHO item | No handoff/receipt in lab | M |
| 13 | Blood product usage | Partly | `blood_products` JSONB on anesthesia record (lib.rs:258) | Not linked to blood bank units/transfusions | M |
| 14 | PACU Aldrete | Met | `ot_postop_records.aldrete_score_*`; postop-tab.tsx:108 | | |
| 15 | Post-op order set | Partly | `postop_orders` JSONB (lib.rs:284) | Free text, no CPOE order set | M |
| 16 | OT to ward/ICU handover | Met | `ot_postop_handoffs`, /postop-handoff; handoff-cards.tsx | | |
| 17 | Site marking verification | Met | `site_marked` on booking + WHO sign_in item | | |
| 18 | OT turnaround tracking | Partly | `turnaround_minutes` read in utilization (lib.rs:2505) | Nothing writes it; no room-clean events | S |
| 19 | Utilization report (sched vs actual, cancellations) | Met | GET /api/ot/analytics/utilization; reports-tab.tsx | | |
| 20 | Surgeon case load | Met | /api/ot/analytics/surgeon-caseload; pages/ipd/reports.tsx:224 | | |
| 21 | Anesthesia complication tracking | Met | /analytics/anesthesia-complications; pages/ipd/anesthesia-complications.tsx | | |
| 22 | SSI vs OT environment correlation | Partly | SSI rate per ot_bookings (medbrains-infection-control/src/infection_control.rs:1511) | No OT air/environment data to correlate | L |

### 16. Blood Bank & Transfusion Medicine
| # | Criterion (short) | Status | Evidence | Gap | Fix |
|---|---|---|---|---|---|
| 1 | Donor registration + screening | Met | `blood_donors`, /api/blood-bank/donors; pages/blood-bank/donors-tab.tsx | | |
| 2 | Deferral auto-check | Partly | `is_deferred` flag only | create_donation (medbrains-blood-bank/src/lib.rs:300) does not check deferral or donation interval | S |
| 3 | Donation record | Met | `blood_donations` (type, volume); donors-tab.tsx:136 | | |
| 4 | Donor adverse reaction | Met | `adverse_reaction` update lib.rs:402; donors-tab.tsx:146 | | |
| 5 | Repeat donor + recruitment | Met | `last_donation` lib.rs:341; `bb_recruitment_campaigns`; compliance-tab.tsx:316 | | |
| 6 | Component preparation | Met | `blood_components`; inventory-tab.tsx:496 | | |
| 7 | Grouping/Rh double-check | Partly | blood_group stored once | No second independent typing | M |
| 8 | TTI screening (HIV/HBV/HCV/syphilis/malaria) | Partly | single `tti_status` varchar; /tti-report | No per-marker results; release not gated on TTI | M |
| 9 | ISBT 128 / barcode labelling | Partly | `bag_number` | No ISBT 128 or label print | M |
| 10 | Cold chain IoT alerts | Partly | `bb_cold_chain_readings`, alert level computed server-side lib.rs:1427; cold-chain-tab.tsx | Readings typed in by hand; no sensor ingest or push alert | M |
| 11 | Expiry / FEFO | Partly | list ordered by expiry (lib.rs:462); expired units blocked at transfusion (lib.rs:771) | Issue does not enforce FEFO | S |
| 12 | Stock dashboard by component/group | Met | inventory-tab.tsx (by group) | | |
| 13 | Electronic crossmatch order from IPD/OT/ER | Partly | `crossmatch_requests` POST lib.rs:625; crossmatch-tab.tsx | Ordered only from the blood bank screen; no source encounter or OT link | M |
| 14 | ABO/Rh hard block | Met | lib.rs:783-809; bedside_transfusion.rs:294 | | |
| 15 | Crossmatch result entry | Met | PUT /crossmatch/{id} status/result; crossmatch-tab.tsx:115 | | |
| 16 | Issue with double ID (wristband + bag) | Partly | bag number resolved to this patient's unit + second nurse (bedside_transfusion.rs:150-320); components/Nurse/StartTransfusionModal.tsx | No wristband scan | S |
| 17 | Unused return + temperature check | Met | `bb_blood_returns.temperature_acceptable`; returns-msbos-tab.tsx:51 | | |
| 18 | MSBOS enforcement | Partly | `bb_msbos_guidelines` master; returns-msbos-tab.tsx:67 | Not checked on the crossmatch request | S |
| 19 | Bedside transfusion checklist | Met | `transfusions` (bedside_transfusion.rs); BedsideTransfusionsPanel.tsx; observations in TransfusionMonitorDrawer.tsx | | |
| 20 | Reaction monitoring/reporting | Met | /transfusions/{id}/reaction, /hemovigilance; reports-tab.tsx:100 | | |
| 21 | Hemovigilance report to NACO | Partly | hemovigilance summary on screen | No NACO HvPI format or export | M |
| 22 | Lookback/traceback | Met | `bb_lookback_events`; compliance-tab.tsx:84 | | |
| 23 | SBTC compliance report | Met | GET /api/blood-bank/sbtc-report; compliance-tab.tsx:247 | | |

### 17. Housekeeping & Linen Management
| # | Criterion (short) | Status | Evidence | Gap | Fix |
|---|---|---|---|---|---|
| 1 | Room turnaround (discharge to ready) | Met | /api/housekeeping/turnarounds (+complete); pages/housekeeping/room-bed-tab.tsx:98 | | |
| 2 | Bed status dashboard | Met | `bed_states`, bed_status enum incl. maintenance/blocked; pages/ipd/bed-dashboard.tsx | | |
| 3 | Cleaning schedule per area type | Met | `cleaning_schedules` area_type + frequency_hours; schedules-tab.tsx:90 | | |
| 4 | Cleaning checklist + supervisor sign-off | Met | /tasks/{id}/verify; room-bed-tab.tsx:90 | | |
| 5 | Pest control schedule | Met | `pest_control_schedules`/`_logs`; schedules-tab.tsx:104,113 | | |
| 6 | BMW collection schedule per ward | Partly | GET /bmw/schedule (medbrains-materials/src/housekeeping.rs:1056) | Only sums past records; no forward schedule | S |
| 7 | Weight per bag per ward, mobile barcode | Partly | `biowaste_records.weight_kg` per dept/day; bmw-tab.tsx:178 | Per day not per bag; no bag barcode; no mobile | M |
| 8 | Colour-coded segregation verification | Partly | `waste_category` | No segregation audit/verification | S |
| 9 | Transport to central storage | Missing | `manifest_number` covers vendor disposal only | No internal transport log | S |
| 10 | Sharps container replacement request | Met | POST /bmw/sharp-replacement (housekeeping.rs:1113); bmw-tab.tsx:199 | | |
| 11 | Linen lifecycle per item (barcode/RFID) | Partly | `linen_items.barcode`, `linen_movements`; linen-tab.tsx | No RFID; wash count never incremented | M |
| 12 | Ward soiled collection with weight | Met | `linen_movements.weight_kg`; linen-tab.tsx:115 | | |
| 13 | Infection classification | Met | `contamination_type` on movements/batches | | |
| 14 | Wash process (formula/temp/cycle) | Met | `laundry_batches.wash_formula/temperature/cycle_minutes`; linen-tab.tsx:123 | | |
| 15 | Clean distribution + par levels | Met | `linen_par_levels`; par-audit-tab.tsx:36 | | |
| 16 | Linen loss audit | Missing | par-audit-tab lists par only | No collected-vs-returned reconciliation | S |
| 17 | Condemnation at wash life | Partly | `linen_condemnations`, POST /condemnations (housekeeping.rs:1008); list in par-audit-tab | No create screen; no max_washes trigger | S |

### 18. Facilities & Maintenance
| # | Criterion (short) | Status | Evidence | Gap | Fix |
|---|---|---|---|---|---|
| 1 | PSA O2 plant monitoring | Partly | `fms_gas_readings` purity/pressure/flow/temp; pages/facilities/mgps-tab.tsx:74 | Typed in by hand; `is_alarm` is set by the client, not by threshold | M |
| 2 | LMO tank level IoT alerts | Partly | `tank_level_percent` | No IoT ingest or alert | M |
| 3 | Manifold status/switchover | Partly | `manifold_side`, `cylinder_count` | No switchover event or alert | M |
| 4 | Zone valve status | Missing | none | No zone valve entity | M |
| 5 | Pipeline pressure at key points | Partly | `pressure_bar` + location_id | No 3.5-4 bar thresholds or alerts | S |
| 6 | Daily O2 consumption per dept | Partly | `department_id`, `flow_lpm` | No consumption aggregation | S |
| 7 | Gas purity analyzer integration | Missing | none | No device interface | L |
| 8 | PESO + drug licence tracking | Met | `fms_gas_compliance` peso_/drug_license_; mgps-tab.tsx:82 | | |
| 9 | Fire equipment inventory + QR | Partly | `fms_fire_equipment.qr_code_value`; fire-safety-tab.tsx:61 | No QR label print or scan | S |
| 10 | Fire inspection schedule | Partly | `fms_fire_inspections` (list only in fire-safety-tab.tsx:48) | No create screen; no due tracking | S |
| 11 | Mock drill + report | Met | `fms_fire_drills` (report url, next_drill_due); fire-drills-section.tsx:37 | | |
| 12 | Fire NOC renewal alerts | Partly | `fms_fire_noc.renewal_alert_days` | List only on web; nothing fires the alert | S |
| 13 | Code Red + zone evacuation | Partly | generic code activation `er_code_activations` (medbrains-emergency/src/lib.rs:1324) | No RACE steps or zone evacuation plan | M |
| 14 | Water testing schedule + results | Met | `fms_water_tests`, `fms_water_schedules`; water-quality-tab.tsx:94,102 | | |
| 15 | Dialysis RO water (IoT) | Partly | test_type endotoxin/conductivity, source ro_plant | Typed in by hand; no sensors | M |
| 16 | Legionella prevention | Partly | schedule_type legionella_testing | No hot-water temperature monitoring | S |
| 17 | Tank cleaning 6-monthly | Met | schedule_type tank_cleaning, next_due_date | | |
| 18 | STP treated water + reuse | Partly | source `stp_recycled` tests | No reuse volume tracking | S |
| 19 | Grid/DG/UPS/solar dashboard | Met | `fms_energy_readings`, /energy/analytics; energy-tab.tsx | | |
| 20 | DG runtime/fuel/load | Met | runtime_hours, fuel_level_percent, load_percent | | |
| 21 | UPS battery health | Met | battery_health_percent, backup_minutes | | |
| 22 | Switchover test <15s | Partly | `switchover_time_seconds` | No 15 s threshold or per-area test log | S |
| 23 | CEA safety compliance | Partly | generic `facility_regulatory_compliance` | No CEA-specific items | S |
| 24 | Dept maintenance request | Met | POST /api/facilities/work-orders; work-orders-tab.tsx:120 | | |
| 25 | WO assignment/tracking | Met | /work-orders/{id}/status; work-orders-tab.tsx:128 | | |
| 26 | Completion with sign-off | Partly | `sign_off_by/at` columns | Nothing writes sign_off; status form has no sign-off | S |
| 27 | Vendor service report | Partly | `vendor_report` written by update (facilities.rs:1223) | Not shown on the WO screen | S |
| 28 | Infrastructure PM schedule | Met | POST /api/facilities/pm/schedule; work-orders-tab.tsx:139 | | |

### 19. IT & Systems
| # | Criterion (short) | Status | Evidence | Gap | Fix |
|---|---|---|---|---|---|
| 1 | Cloud/on-prem/hybrid | Met | infra/terraform/modules (aurora), modules-onprem, modules-onprem-baremetal | | |
| 2 | Tenant data isolation | Met | `tenant_id` + RLS `tenant_isolation` policies; `set_tenant_context` | | |
| 3 | Scale for 420+ beds | Partly | crates/medbrains-loadtest | No recorded 420-bed concurrency run | M |
| 4 | Mobile apps (doctor/nurse/patient/admin) | Partly | apps/ios (Staff, Patient), apps/android (app-staff, app-patient) | Native apps still being built; no admin app | L |
| 5 | Browser compatibility | Partly | apps/web/playwright.config.ts (chromium only) | Edge/Safari/Firefox untested | S |
| 6 | Offline for critical modules | Partly | crates/medbrains-clinical-offline, medbrains-edge | Web has no offline mode | L |
| 7 | ABDM/ABHA + consent | Partly | /api/abdm/abha/*, /hfr, gateway callbacks; components/Patient/AbhaLinkPanel.tsx | No HIU consent-manager flow or care-context linking UI | L |
| 8 | HL7/FHIR exchange | Partly | /api/fhir/metadata, Patient, Encounter, Composition (medbrains-fhir-api) | Only a few resources | M |
| 9 | DICOM/PACS | Partly | radiology study registry with orthanc_id/viewer_url (medbrains-radiology/src/lib.rs:1798); radiology/dicom-studies-tab.tsx | Stores metadata only; no DICOMweb/C-STORE ingest | M |
| 10 | Lab analyzer HL7/ASTM bidirectional | Partly | crates/medbrains-bridge/src/hl7_listener.rs (inbound ORU) | No ASTM; no outbound orders | L |
| 11 | Biometric devices | Missing | none (no device punch in medbrains-hr) | No attendance/access device integration | M |
| 12 | SMS/WhatsApp | Partly | Twilio SMS outbox (services/appointment_reminders.rs) | WhatsApp only in marketing paths | S |
| 13 | Payment gateway | Met | crates/medbrains-payment-gateway; components/PaymentModal.tsx, VirtualAccountPanel.tsx | | |
| 14 | eHospital NIC | Missing | none | No integration | L |
| 15 | RBAC + ABAC | Met | crates/medbrains-authz (ReBAC/classification), `require_permission`, `require_patient_access` | | |
| 16 | Break-glass + audit | Met | `break_glass_events` (medbrains-it-security); pages/login.tsx, pages/audit.tsx | | |
| 17 | Psychiatric data isolation (PSY-001) | Missing | psych_* tables share the same RLS as everything else | No separate encrypted partition | L |
| 18 | Audit logging (who/when/what/where) | Met | partitioned `audit_log`, `access_log` middleware (server-core/middleware/access_log.rs); pages/audit.tsx | | |
| 19 | Encryption at rest/in transit | Met | aurora `storage_encrypted=true` + KMS (infra/terraform/modules/aurora/main.tf:139); TLS via Caddy; crates/medbrains-crypto | | |
| 20 | DPDP consent for processing | Partly | crates/medbrains-consent; patient contact consent | No DPDP notice/withdrawal/erasure flow | M |
| 21 | Anonymization for research | Partly | `permissions::research` de-identified triage extract (core/permissions.rs:1544) | Covers one dataset; no general de-identification tool | M |
| 22 | Session mgmt + auto-timeout | Partly | 15-minute JWT + `refresh_tokens` (medbrains-auth/src/lib.rs:404) | No idle auto-logout on web (kiosk only) | S |
| 23 | Automated backups | Partly | Patroni/pgBackRest in infra/terraform/modules-onprem*; Aurora backups | `backup_history` has no writer; no backup status screen | S |
| 24 | DR plan with RTO/RPO | Partly | docs/backlog/04-infra.md mentions RTO/RPO | No approved DR runbook or drill | M |
| 25 | 99.9% uptime SLA | Missing | none | No SLO or uptime monitoring evidence | M |
| 26 | Response-time benchmarks | Partly | apps/web/e2e/smoke/latency-report.jsonl | No targets or gate | S |
| 27 | Load-test evidence | Partly | crates/medbrains-loadtest | No published results | M |
| 28 | DB maintenance + archival | Met | monthly `audit_log` partitions, services/retention.rs, bin/medbrains-archive.rs | | |

### 20. Security Department
| # | Criterion (short) | Status | Evidence | Gap | Fix |
|---|---|---|---|---|---|
| 1 | Door access integration | Partly | `security_access_logs.device_id`; access logs entered on access-control-tab.tsx:233 | No controller/device feed | L |
| 2 | Zone definitions by level | Met | `security_zones.level`; access-control-tab.tsx:90 | | |
| 3 | Zone access log | Met | `security_access_logs`; access-control-tab.tsx:221 | | |
| 4 | Cards linked to HR, auto-deactivate | Partly | `security_access_cards.employee_id`, manual deactivate (access-control-tab.tsx:164) | Separation in medbrains-hr does not deactivate cards | S |
| 5 | After-hours tracking + alerts | Partly | zone after_hours_*, log `is_after_hours` | No alert raised | S |
| 6 | Camera inventory | Met | `security_cameras`; pages/security/cctv-tab.tsx:54 | | |
| 7 | Incident-linked video | Partly | incident `camera_ids`, `video_timestamp_start/end` | Entered by hand; no VMS link | M |
| 8 | Recording retention policy | Partly | `security_cameras.retention_days` | No "keep permanently when linked to an incident" | S |
| 9 | Incident reporting + classification | Met | `security_incidents` (severity/category/resolution); incidents-tab.tsx:89,103 | | |
| 10 | Infant RFID mother-baby match | Partly | `security_patient_tags` tag_type infant_rfid + mother_id; patient-safety-tab.tsx:70 | Tag registry only; no RFID reader or match check | L |
| 11 | Zone alert if infant tag exits | Missing | `security_tag_alerts` exists but nothing inserts into it | No alert source | L |
| 12 | Code Pink workflow | Partly | generic code_pink activation (emergency/src/lib.rs:1337); tag_alert.code_activation_id | No lockdown steps | M |
| 13 | Absconder/elopement protocol | Partly | tag type elopement_risk | No protocol/workflow or police/MLC escalation | M |
| 14 | Wander guard (dementia) | Partly | tag type wander_guard | No alerting | M |
| 15 | Code Blue activation + team | Met | `code_blue_events`/`code_blue_responses`; responder alerts (workflow/orchestration/default_pipelines.rs:692); emergency/codes tab | | |
| 16 | Code Red RACE + evacuation | Partly | generic code_red activation | No RACE/evacuation steps | M |
| 17 | Code Pink lockdown | Partly | generic activation | No lockdown procedure | M |
| 18 | Code Silver/Orange/Black | Partly | code types accepted (emergency/src/lib.rs:1337) | No per-code protocol | M |
| 19 | Code Yellow + ER (MCI) | Met | /api/emergency/mass-casualty; pages/emergency/mass-casualty.tsx | | |
| 20 | Post-event debrief | Met | `security_code_debriefs`; pages/security/code-debriefs-tab.tsx:46 | | |



### 21. Academic ERP & Medical College
| # | Criterion (short) | Status | Evidence | Gap | Fix |
|---|---|---|---|---|---|
| 1 | Student admission/batch | Missing | no student tables | no student entity | L |
| 2 | CBME competency map | Missing | none | not built | L |
| 3 | Internal assessment | Missing | lms_quizzes are for staff only | no student assessment | L |
| 4 | Exam mgmt / hall ticket | Missing | none | not built | L |
| 5 | PG logbook HMS auto-populate | Partly | pg_logbook_entries (MIG 0080_clinical.sql:2384, encounter_id FK); WEB pg-logbook.tsx create+verify; writer telehealth/src/cds.rs:1604 | entries are manual, no case auto-populate | M |
| 6 | Intern rotation NMC | Missing | none | not built | L |
| 7 | Intern logbook + supervisor | Missing | none (PG logbook only) | no intern logbook | M |
| 8 | Completion cert + SMC | Missing | none | not built | M |
| 9 | Cadaver mgmt (Anatomy Act) | Missing | none | not built | L |
| 10 | Teaching lab scheduling | Missing | none | not built | M |
| 11 | Reagent inventory + MSDS | Partly | lab_reagent_lots (clinical lab) | no MSDS, not for teaching labs | M |
| 12 | Teaching equipment maintenance | Partly | BME module (WEB bme/pm-tab.tsx) is generic | not tagged as teaching equipment | S |
| 13 | Practical attendance/marks | Missing | none | not built | M |
| 14 | IAEC/CPCSEA | Missing | none | not built | M |
| 15 | Mannequin inventory | Missing | none | not built | M |
| 16 | Scenario library to CBME | Missing | none | not built | M |
| 17 | OSCE stations/scoring | Missing | none | not built | L |
| 18 | Sim video + debrief | Missing | none | not built | M |
| 19 | Competency dashboard | Missing | none | not built | M |
| 20 | Research proposal portal | Partly | clinical_trials + WEB clinical-trials/create-trial-modal.tsx | sponsor trials only, no investigator proposal portal | M |
| 21 | IEC review workflow | Partly | trial_irb_submissions types initial/amendment/renewal/sae_report/closure (MIG 0090_clinical_trials.sql:90); irb-modal.tsx | no expedited/continuing review tracks | S |
| 22 | ICMR 2017 compliance | Partly | IRB submissions + trial consents | no ICMR checklist/rules | M |
| 23 | SAE reporting/review | Met | trial_adverse_events.is_serious; ancillary/src/clinical_trials.rs; WEB clinical-trials/ae-modal.tsx | | |
| 24 | CTRI registration | Missing | clinical_trials has no CTRI field | no CTRI number/status | S |
| 25 | Plagiarism integration | Missing | none | not built | M |
| 26 | Faculty publications/H-index | Missing | none | not built | M |
| 27 | OPAC | Missing | none | no library module | L |
| 28 | Circulation/fines | Missing | none | not built | L |
| 29 | E-resources INFLIBNET | Missing | none | not built | M |
| 30 | NMC books per student | Missing | none | not built | S |
| 31 | Thesis repository | Missing | none | not built | M |
| 32 | CME events + QR cert | Partly | lms_certificates (certificate_no), training_programs (MIG 0190_hr.sql) | no CME event, no QR verification | M |
| 33 | CME credit hours/SMC | Partly | training_programs.duration_hours, training_records | no per-doctor credit tally vs SMC | M |
| 34 | FDP BCME/ACMET renewal | Partly | training_programs.frequency_months, training_records.expiry_date | no BCME/ACMET types or alerts | S |
| 35 | Faculty teaching hours | Missing | none | not built | M |
| 36 | Conference abstracts | Missing | none | not built | M |
| 37 | Hostel/mess | Missing | none | not built | L |
| 38 | Hostel attendance + parent notify | Missing | none | not built | M |
| 39 | Anti-ragging | Missing | none | not built | M |
| 40 | ICC/POSH complaints | Missing | no staff grievance table | POSH Act case mgmt missing | M |
| 41 | Student counselling (encrypted) | Missing | psych_counseling_sessions covers patients only | not built | M |
| 42 | Mentor-mentee | Missing | none | not built | S |
| 43 | Disability accommodation (RPWD) | Missing | none | not built | M |
| 44 | Stipend by attendance | Missing | medbrains-payroll covers staff only | no stipend | M |
| 45 | Service bond | Missing | none | not built | M |
| 46 | Scholarship/fee waiver | Missing | none | not built | M |
| 47 | NMC NARF self-assessment | Missing | none | not built | L |
| 48 | NAAC SSR | Missing | none | not built | L |
| 49 | Inspection readiness RAG | Partly | medbrains-nabh (hospital NABH) | no NMC inspection view | M |

### 22. CSSD
| # | Criterion (short) | Status | Evidence | Gap | Fix |
|---|---|---|---|---|---|
| 1 | Instrument barcode tracking | Met | cssd_instruments.barcode (MIG 0410_theatre.sql); /api/cssd/instruments; WEB cssd/instruments-tab.tsx | no RFID | |
| 2 | Set composition | Met | cssd_instrument_sets, cssd_set_items; /api/cssd/sets/{id}/items | | |
| 3 | Decontamination log | Missing | no table or field | pre-clean/enzymatic wash not recorded | M |
| 4 | Autoclave cycle log | Met | cssd_sterilization_loads (temperature_c, pressure_psi, cycle_time); WEB cssd/sterilization-tab.tsx | | |
| 5 | CI per load | Met | cssd_indicator_results indicator_type=chemical; /api/cssd/loads/{id}/indicators | | |
| 6 | BI with lot | Met | cssd_indicator_results.indicator_lot, result_pass; sterilization-tab.tsx:409 | | |
| 7 | Issue + expiry | Partly | cssd_load_items.pack_expiry_date; cssd_issuances; issuance-tab.tsx | issue not blocked on expired pack or failed BI (cssd/src/lib.rs:678) | S |
| 8 | Recall on failure | Partly | /api/cssd/issuances/{id}/recall (lib.rs:745); LoadContentsDrawer.tsx | manual per pack; no recall of a whole load when BI fails | M |
| 9 | Flash sterilisation + reason | Met | is_flash, flash_reason (lib.rs:455); sterilization-tab.tsx:168 | | |
| 10 | Patient to set to load to BI trace | Partly | issued_to_patient_id via PatientSearchSelect; load_items to indicators | no OT case/booking link; patient optional | M |
| 11 | Lifecycle/repair | Partly | cssd_instruments.lifecycle_uses/max_uses; maintenance logs are for sterilisers only | no instrument repair/sharpening log | S |
| 12 | Workload/TAT report | Missing | no cssd report in medbrains-reports | not built | S |

### 23. Dietary / Kitchen
| # | Criterion (short) | Status | Evidence | Gap | Fix |
|---|---|---|---|---|---|
| 1 | Diet order integrated | Met | diet_orders (admission_id) MIG 0140_diet.sql; diet/src/lib.rs:360; WEB diet-kitchen/diet-orders-tab.tsx; ipd/diet.tsx | | |
| 2 | Therapeutic templates | Met | diet_templates; lib.rs:214; diet-templates-tab.tsx | | |
| 3 | Allergy flagging | Partly | diet-orders-tab.tsx:155 shows patient allergies; allergies_flagged json | client-supplied, no server cross-check vs menu allergens | S |
| 4 | Calorie/macro tracking | Partly | targets on diet_orders/menu items | no per-meal intake tracking | M |
| 5 | NPO alert nursing+kitchen | Partly | diet_orders.is_npo (lib.rs:340); ipd/diet.tsx NPO badge | no alert push; kitchen npo_count is manual | S |
| 6 | Day care diets | Missing | none | not built | S |
| 7 | Menu rotation/season | Met | kitchen_menus.week_number/season; kitchen_menu_items; kitchen-tab.tsx | | |
| 8 | Meal count from occupancy | Partly | meal_counts (lib.rs:723) | entered by hand, not from bed occupancy | S |
| 9 | Religious/cultural diet | Partly | diet_orders.preferences, menu is_vegetarian | no UI to capture preferences | S |
| 10 | Kitchen inventory | Partly | kitchen_inventory; inventory-tab.tsx | no procurement/consumption ledger | M |
| 11 | Food feedback | Partly | meal_preparations.feedback_rating (lib.rs:660); shown kitchen-tab.tsx:238 | no screen captures patient feedback | S |
| 12 | FSSAI hygiene audit | Met | kitchen_audits (temperature_log, hygiene_score); lib.rs:889; audits-tab.tsx | | |

### 24. Consent & Medico-Legal
| # | Criterion (short) | Status | Evidence | Gap | Fix |
|---|---|---|---|---|---|
| 1 | General/surgical/anaesthesia/blood | Met | consent category enum (MIG 0001); consent_templates; procedure_consents (opd/src/lib.rs:5313); WEB consent/templates-tab.tsx | | |
| 2 | HIV/high-risk/research | Partly | research category only | no HIV-test consent type | S |
| 3 | Informed refusal | Partly | 'refusal' category; procedure_consents.refusal_reason | no structured refusal form (risks explained, witness) | S |
| 4 | DAMA/LAMA | Met | ipd_dama_records (ipd-post-discharge/src/lib.rs:452); components/Ipd/DamaModal.tsx | | |
| 5 | Photo/teaching consent | Met | photography/teaching categories; patient_consents (patients/src/lib.rs:3088) | | |
| 6 | ABDM + DPDP consent | Partly | abdm_linking consent type | dpdp_consents never written (print-data/src/consent.rs:1099) | M |
| 7 | DNR + advance directive | Met | dnr_orders (specialty-other); WEB specialty/palliative.tsx; advance_directives WEB home-healthcare/advance-directives-panel.tsx | | |
| 8 | Multi-language consent | Missing | consent_templates has no language column | single-language body_text | M |
| 9 | Read-aloud + witness | Partly | consent_templates.is_read_aloud_required, requires_witness | no audio capture | M |
| 10 | Aadhaar e-Sign | Missing | consent_signature_metadata.aadhaar_esign_ref (text only) | no ESP integration | L |
| 11 | Biometric thumb + witness | Partly | biometric_hash/device_id columns; signatures-tab.tsx | no device capture | M |
| 12 | Digital pen on tablet | Partly | signatures-tab.tsx:258 has URL TextInputs | no signature pad | S |
| 13 | Video consent | Partly | video_consent_url as a text field | no recording/upload | M |
| 14 | Consent hard-block | Partly | ot/src/lib.rs:741,885 needs a signed procedure_consents row | any signed consent for the patient passes; not tied to this procedure | S |
| 15 | Revocation | Met | procedure consent withdraw (opd/src/lib.rs:5428); consent/verification-tab.tsx | | |
| 16 | MLC reg + police auto-trigger | Partly | auto MLC from ER (emergency/src/lib.rs:552); mlc_police_intimations; close blocked without intimation (lib.rs:1795) | intimation is not auto-generated | S |
| 17 | Wound cert + body diagram | Met | mlc_injuries (emergency/src/mlc_injuries.rs); emergency/mlc-injuries-panel.tsx | | |
| 18 | Age estimation | Met | mlc_documents type age_estimation (lib.rs:203); mlc-case-detail.tsx:553 | | |
| 19 | POCSO documentation | Met | mlc_cases.is_pocso; pocso_report doc with field restriction (lib.rs:380); mlc-case-detail.tsx:564 | | |
| 20 | Death cert Form 4/4A | Met | ipd death summary form_4/form_4a (ipd/src/lib.rs:6900); WEB ipd/death-summary.tsx:219 | | |
| 21 | Court summons tracking | Partly | mlc_documents court_summons; mlc-case-detail.tsx:575 | no hearing dates, response status or reminders | S |
| 22 | Medico-legal opinion | Met | mlc_cases.medical_opinion; consent/medico-legal-opinion-form.tsx | | |

### 25. Specialized Clinical
| # | Criterion (short) | Status | Evidence | Gap | Fix |
|---|---|---|---|---|---|
| 1 | STEMI D2B | Partly | cath_procedures door_time/balloon_time/door_to_balloon_minutes; cath_stemi_timeline | cath-lab.tsx has no door/balloon input; createStemiEvent has no screen | S |
| 2 | Haemodynamics | Partly | cath_hemodynamics; specialty-interventional writer | createCathHemodynamic has no screen | S |
| 3 | Device barcode | Partly | cath_devices.barcode/lot | createCathDevice has no screen | S |
| 4 | Contrast cumulative | Partly | contrast_volume_ml in cath-lab.tsx | no cumulative/eGFR risk | S |
| 5 | Radiation dose AERB | Partly | fluoroscopy_time_seconds, total_dap, total_air_kerma columns | UI captures fluoro time only | S |
| 6 | Consignment billed on use | Partly | cath_devices.is_consignment, billed | no device-entry screen, no billing hook | M |
| 7 | Post-procedure monitoring | Partly | cath_post_monitoring | no screen writer | S |
| 8 | Scope serial + HLD log | Partly | endoscopy_scopes (serial) via endoscopy.tsx; endoscopy_reprocessing | createEndoscopyReprocessing has no screen | S |
| 9 | Leak test | Partly | endoscopy_reprocessing.leak_test_passed | no screen | S |
| 10 | HLD parameters | Partly | hld_chemical/concentration/soak/temperature | no screen; no block when reprocessing fails | S |
| 11 | Scope culture | Partly | endoscopy_scopes.last_culture_result (display) | no culture history/writer | S |
| 12 | Sedation + Aldrete | Partly | sedation_drugs, aldrete pre/post in endoscopy.tsx | no pre-assessment or monitoring log | S |
| 13 | Biopsy chain of custody | Partly | endoscopy_biopsy_specimens.chain_of_custody | createBiopsySpecimen has no screen; no lab link | M |
| 14 | Psych data isolation PSY-001 | Partly | psych_patients.is_restricted; require_patient_access (specialty_psychiatry.rs:195) | flag not enforced on reads | M |
| 15 | MHCA admission categories | Met | psych_admission_category enum; psychiatry.tsx admission_category | | |
| 16 | Advance directive + MHB verify | Partly | psych_patients.advance_directive_text | no MHB verification | S |
| 17 | Nominated representative + notify | Partly | nominated_rep_* fields | no notification workflow | S |
| 18 | ECT register | Partly | psych_ect_register (laterality, stimulus) | createEctSession has no screen | S |
| 19 | Seclusion/restraint 4h review | Partly | psych_seclusion_restraint.review_due_at (specialty_psychiatry.rs:580); nursing restraint checks | createRestraint has no psychiatry screen | S |
| 20 | Substance abuse isolation PSY-002 | Partly | substance_abuse_flag (filter only) | no extra access layer | M |
| 21 | MHRB auto-notification | Partly | psych_mhrb_notifications | manual, no screen writer, not auto-generated | M |
| 22 | Rehab with FIM/Barthel | Met | rehab_plans fim/barthel; specialty/pmr.tsx createRehabPlan/Session | | |
| 23 | RPWD disability cert | Missing | none | not built | M |
| 24 | Audiometry PTA/BERA/OAE | Partly | audiology_tests | createAudiologyTest has no screen; no device integration | M |
| 25 | NHSP referral | Partly | audiology_tests.is_nhsp, nhsp_referral_needed | no screen, no referral tracking | S |
| 26 | Psychometric raw data secured | Partly | psychometric_tests.raw_data_encrypted | list returns SELECT * (specialty-other/src/lib.rs:550); no screen | S |
| 27 | Therapy + PHQ-9/GAD-7 | Partly | psych_counseling_sessions.outcome_rating | no PHQ-9/GAD-7 instruments, no screen writer | M |
| 28 | DNR visible / 48h review / revocable | Partly | dnr_orders 48h review (specialty-other lib.rs:647); revoke in palliative.tsx | not shown on patient banner/ward board | S |
| 29 | WHO ladder + opioid NDPS | Partly | pain_assessments who_ladder_step, opioid_dose_morphine_eq; palliative.tsx | no link to the NDPS register | M |
| 30 | ROTTO/SOTTO | Partly | mortuary_records.organ_donation_status | no notification integration | M |
| 31 | Mortuary slot + temperature | Partly | mortuary_records.cold_storage_slot (palliative.tsx:582) | temperature_log has no UI or monitoring | S |
| 32 | MLC body flow / viscera | Partly | mortuary_records is_mlc, pm_*, viscera_chain_of_custody | UI does not capture PM or viscera | M |
| 33 | Unclaimed body protocol | Partly | unclaimed_notice_date/disposal_date | no 72h workflow or UI | M |
| 34 | Nuclear med AERB | Partly | nuclear_med_sources (aerb_license), nuclear_med_administrations | create endpoints have no screen | M |

### 26. Communication & Feedback
| # | Criterion (short) | Status | Evidence | Gap | Fix |
|---|---|---|---|---|---|
| 1 | SMS gateway | Met | outbox handlers/twilio.rs; sms.appointment_*, sms.lab_report_ready (server main.rs:778); WEB communications/dlt-tab.tsx | | |
| 2 | WhatsApp Business API | Met | outbox handlers/whatsapp.rs (Meta Graph); whatsapp.lab_report_ready/discharge_summary | | |
| 3 | Push notifications | Partly | device_push_tokens; Expo push in services/notification_listener.rs:125 | Expo only (legacy RN); native apps have no APNs/FCM | M |
| 4 | IVR | Missing | marketing/src/telephony.rs is screen-pop only | no IVR booking/status | L |
| 5 | Patient portal | Partly | WEB portal/views.tsx (reports, appointments, bills) | consents not shown | S |
| 6 | Critical value ack | Met | lab_critical_alerts readback (lab/src/lib.rs:2666); components/Doctor/CriticalValueInbox.tsx | | |
| 7 | Secure clinical messaging | Met | comm_clinical_messages; communications/clinical-tab.tsx createClinicalMessage | | |
| 8 | SBAR handover | Partly | ipd_handover_reports SBAR (ipd/src/lib.rs:4016); ipd/nursing.tsx lists them | no screen creates a handover | S |
| 9 | Referral bi-directional | Met | referrals (opd); opd/referral-actions.tsx accept/complete | | |
| 10 | Discharge comms to GP | Partly | sms/whatsapp.discharge_summary go to the patient | nothing to the referring doctor | S |
| 11 | Bedside/kiosk emoji feedback | Partly | bedside_realtime_feedback (care-mgmt bedside_portal.rs) | not NABH domains; no kiosk | S |
| 12 | Post-discharge feedback 24h | Partly | send_survey (ipd-post-discharge lib.rs:568) only sets survey_sent_at | no message sent, no 24h schedule | S |
| 13 | NPS calc | Met | get_feedback_stats promoters/detractors (communications lib.rs:1007); feedback-tab.tsx:110 | | |
| 14 | Multi-channel complaint intake | Partly | comm_complaints.source; complaints-tab.tsx:249 | staff entry only, no portal or WhatsApp intake | M |
| 15 | SLA tiered escalation | Partly | comm_complaints sla_deadline, escalation_level; comm_escalation_rules | no job escalates; rules table has no writer | M |
| 16 | Resolution + patient notify | Partly | resolve_complaint | patient not notified | S |
| 17 | Dept complaint trends | Partly | report catalogue entry (reports/src/reports.rs:1200) | no dept trend query or screen | S |



### 27. QA Testing Team
| # | Criterion (short) | Status | Evidence | Gap | Fix |
|---|---|---|---|---|---|
| 1 | Common tasks <3 clicks | Partly | No click-path measurement; patient directory + command routes | No measured task paths | M |
| 2 | Form validation messages | Met | RHF+Zod forms; e2e journeys/registration-errors-clear.spec.ts, registration-rules.spec.ts |  |  |
| 3 | Patient/drug/investigation search | Met | patients trigram GIN idx 0300_patient.sql:1362; patient directory screens |  |  |
| 4 | Tablet/phone bedside use | Partly | Native apps apps/ios, apps/android; e2e accessibility/reflow.spec.ts | Native bedside modules partial | L |
| 5 | English + Tamil UI | Partly | apps/web/public/locales/ta (14 of 16 namespaces) | Tamil namespaces incomplete; prints English-only | M |
| 6 | Accessibility (contrast, SR) | Met | e2e accessibility/theme-contrast.spec.ts, wcag-aaa-ui-journeys.spec.ts; Biome a11y |  |  |
| 7 | Mandatory field enforcement | Met | Zod schemas + server validation; registration-rules.spec.ts |  |  |
| 8 | Data type validation | Met | Zod + typed Rust request structs |  |  |
| 9 | Duplicate detection | Partly | Patient dup check medbrains-patients, clinical-core/registration | Employee/drug duplicate checks not evident | M |
| 10 | Cross-module data integrity | Partly | auto_charge billing; linkage_* server tests | No billing-vs-orders / stock-vs-dispense reconciliation report | M |
| 11 | Audit trail before/after | Met | audit_log old_values/new_values 0030_audit.sql:69; pages/audit.tsx |  |  |
| 12 | E2E Reg->OPD->Lab->Bill->Discharge | Partly | e2e journeys walk-in, opd-one-consultation, case-sheet | No single end-to-end discharge journey spec | M |
| 13 | ABAC denial verified | Met | e2e rbac/cross-role-writes.spec.ts, layer-coverage.spec.ts; server api_not_found_test.rs |  |  |
| 14 | Break-glass with audit | Met | break_glass_events INSERT medbrains-it-security; UI pages/audit.tsx, admin/access-requests.tsx |  |  |
| 15 | Consent hard-block | Met | medbrains-ot/src/lib.rs:871 start blocked w/o signed procedure_consents; :729 flag verify |  |  |
| 16 | Critical value reaches doctor in time | Met | services/critical_alert_escalation.rs (main.rs:644); lab_critical_alerts; lab_critical_value_report_test.rs |  |  |
| 17 | Timeout escalation | Met | services verbal_order_escalation.rs, enquiry_sla_escalation.rs, critical_alert_escalation.rs |  |  |
| 18 | Page load <2s | Partly | e2e/smoke/latency-report.jsonl | No enforced latency budget | S |
| 19 | Search >100K patients | Partly | Trigram indexes on patients | No large-dataset benchmark | M |
| 20 | 50+ concurrent users | Partly | crates/medbrains-loadtest (goose), Makefile:690 default 4 users | No 50-user run/result on record | M |
| 21 | Report generation time | Partly | reports crate; no timing tests | Not measured | M |
| 22 | Network interruption behaviour | Partly | admin/settings/OfflineModeSettings.tsx; camp_offline_sync_parity_test.rs; native offline store | Web app has no general offline mode | L |
| 23 | Backup + restore verified | Partly | backup_history table (no writer); patroni/pgbackrest infra templates | No restore drill or recorded verification | M |

### 28. Printing, Dynamic Forms & Document Output
Note on print rendering: two paths exist. (a) Server Tera+Gotenberg templates (medbrains-print/src/templates.rs, 12 templates, branded letterhead, watermark, document number) mounted via components/DocumentActions.tsx on 8 screens. (b) Generic client print (apps/web/src/lib/print/printDocument.ts) for ~115 registry docs: key-value sheet, no logo, no signature block, no QR, no footer, no audit row. Registry docs whose idKind no screen mounts are counted Partly. ~34 print-data handlers are not in the registry at all (15 academic return 501).

| # | Criterion (short) | Status | Evidence | Gap | Fix |
|---|---|---|---|---|---|
| 1 | Visual drag-drop form designer | Missing | form_fields table, no writer; no builder screen | No form designer | L |
| 2 | Template library | Partly | 12 Tera templates medbrains-print/src/templates.rs; ~115 registry docs lib/print/print-registry*.ts | Most docs print as generic key-value sheet | L |
| 3 | HOD self-service forms | Partly | admin/document-templates.tsx (HTML override in document_templates) | Requires raw HTML editing | L |
| 4 | Form versioning w/ audit | Partly | document_template_versions (no writer); quality_document_versions for SOPs | Print template edits not versioned | M |
| 5 | Multi-language form render | Partly | consent_templates.body_text keyed by lang (consent/template-form.tsx) | print-data consent.rs:159 hardcodes "en" | M |
| 6 | Auto-fill from HMS data | Met | print-data handlers join patient/UHID/doctor; POST /api/documents/render binds live data |  |  |
| 7 | Conditional sections | Partly | Tera {% if %} in system templates | Not configurable by user | M |
| 8 | Paper sizes | Met | medbrains-print/src/paper.rs A4/A5/Thermal80/Label50x25/Wristband; print_format enum; documents/templates-tab |  |  |
| 9 | Draft->review->approve->active | Partly | quality_documents status flow (medbrains-quality lib.rs:634; quality/documents-tab.tsx) | Not applied to print templates | M |
| 10 | Obsolete watermark + redirect | Missing | 'obsolete' status only on quality_documents | No OBSOLETE watermark/redirect | M |
| 11 | Logo on ALL prints, position config | Partly | base.html letterhead logo_url (medbrains-print/src/engine.rs); BrandingSettings.tsx | Generic printDocument.ts has no letterhead; position fixed | M |
| 12 | Multi-entity branding | Missing | Single tenant letterhead (tenant_settings print_templates) | No per-entity logos | M |
| 13 | Name/address/phone/email/web/NABH no. | Partly | engine.rs letterhead: name, address, phone, registration_no | No email/website/NABH no. fields | S |
| 14 | Doctor block w/ reg no + qualification | Partly | features/prescription/RxPrint.tsx:130; lab template pathologist reg no | Generic prints have no signature block | M |
| 15 | Scanned signature auto-placed | Partly | doctor_signature_credentials; base.html signature.display_image_url | Only server-rendered templates | M |
| 16 | Aadhaar e-Sign on consent | Partly | medbrains-consent lib.rs:153 aadhaar_esign_ref field | No ESP/eSign integration | L |
| 17 | Multiple signatures per form | Partly | document_output_signatures; medbrains-documents/signatures.rs | Not rendered on consent/OT prints | M |
| 18 | Dept header (NABL / drug licence) | Met | lab_report template nabl_certificate_number; invoice_gst drug_licence; lab/order-detail.tsx:684, billing/invoice-detail.tsx:653 |  |  |
| 19 | Footer ID, time, printed-by, page X/Y | Partly | base.html doc-footer: document_number, generated_at, generated_by_name | No page X of Y; generic prints no footer | S |
| 20 | Watermarks DRAFT/COPY/DUPLICATE/UNCONTROLLED | Partly | watermark_type enum; base.html .watermark; RenderRequest.watermark | No watermark choice in DocumentActions UI | S |
| 21 | QR back to record | Partly | RxPrint verify QR; invoice verify_qr_svg (/verify/bill) | Not on most forms | M |
| 22 | Registration card | Met | registration-card/patient-card [patient]; components/Patients/PatientCard.tsx QR |  |  |
| 23 | IPD wristband | Met | patient_wristband template; ipd/admission-detail.tsx:887; Ipd/WristbandPrintModal.tsx (Code128+QR) |  |  |
| 24 | NICU infant wristband | Partly | infant-wristband [newborn] generic sheet | No barcode/RFID, not band format | M |
| 25 | Queue token slip | Met | token-slip [token]; queue_token_slip template (Thermal80) |  |  |
| 26 | Appointment slip | Met | appointment-slip [appointment] mounted |  |  |
| 27 | Visitor pass w/ QR | Met | FrontOffice/VisitorPassPrintModal.tsx qr_svg; GET /api/front-office/passes/scan |  |  |
| 28 | OPD prescription full format | Met | features/prescription/RxPrint.tsx (qual, reg, generic, follow-up, QR); pages/opd/prescriptions.tsx |  |  |
| 29 | Consultation summary in patient language | Partly | Clinical/VisitSummaryPrint.tsx | English only | M |
| 30 | IPD treatment chart w/ nurse grid | Partly | treatment-chart [admission] generic sheet | No initials grid layout | M |
| 31 | Discharge summary | Met | discharge_summary template; ipd/admission-detail.tsx:888 |  |  |
| 32 | Death summary | Partly | death-declaration [patient], death-certificate [admission] | No dedicated death summary | M |
| 33 | Death certificate Form 4/4A | Partly | death-certificate generic; consent/death-certificate-form.tsx | Not RBD Form 4/4A layout | M |
| 34 | Transfer summary | Met | transfer-summary [transfer_log] mounted |  |  |
| 35 | Referral letter | Missing | Referral data exists; no print key | No referral letter print | M |
| 36 | Follow-up slip | Partly | Follow-up line on RxPrint only | No standalone slip | S |
| 37 | Take-home meds w/ pictograms, language | Partly | Discharge meds in discharge_summary | No pictograms/vernacular | M |
| 38 | Patient education material | Missing | Print deleted in #4754 | None | M |
| 39 | General consent | Partly | consent.general [admission] print-registry.ts | English-only generic sheet | M |
| 40 | Surgical consent | Partly | consent.surgical [booking] | English-only generic sheet | M |
| 41 | Anaesthesia consent | Partly | consent.anesthesia [booking] | English-only generic sheet | M |
| 42 | Blood transfusion consent | Partly | consent.blood [admission] | English-only generic sheet | M |
| 43 | HIV consent | Partly | consent.hiv [patient] | English-only generic sheet | M |
| 44 | High-risk consent w/ % | Partly | consent_templates.risks_section jsonb | No risk-% rendering | M |
| 45 | AMA/DAMA/LAMA | Partly | consent.ama + ama-form [admission] | English-only | S |
| 46 | Photo/video/telemedicine consent | Partly | consent.photo [patient]; video-consent [consent_signature] | No telemedicine consent print | S |
| 47 | Teaching consent | Partly | consent.teaching [admission] | English-only | S |
| 48 | Research consent (IEC) | Partly | consent.research [consent] | No IEC format | S |
| 49 | ABDM consent | Partly | consent.abdm [patient] | English-only | S |
| 50 | DNR / advance directive | Partly | consent.dnr [admission] | No advance-directive form | S |
| 51 | Organ donation (THOA) | Partly | consent.organ_donation [patient] | Not THOA Form 7 layout | M |
| 52 | DPDP consent | Partly | dpdp-consent [dpdp_consent] registered | No screen mounts it | S |
| 53 | Auto multi-language from one template | Missing | print-data/src/consent.rs:159 language "en" | No translation pipeline | L |
| 54 | Read-aloud/audio + witness | Partly | witness_name/designation medbrains-opd lib.rs:5317; consent_templates.requires_witness | No audio option | M |
| 55 | Video consent QR on print | Partly | video_consent_url medbrains-consent lib.rs:152 | No QR on print | S |
| 56 | Lab report full | Met | lab_report template (NABL, reg no, flags, sig); lab/order-detail.tsx:684 |  |  |
| 57 | Cumulative lab report | Partly | cumulative-lab-report [patient] generic | No side-by-side trend layout | M |
| 58 | Culture sensitivity report | Missing | Print deleted #4754 | No organism/MIC/SIR print | M |
| 59 | Histopath synoptic | Partly | histopath-report [lab_order] generic | No synoptic format | M |
| 60 | Radiology report w/ logo, images, sig | Partly | radiology-report-full [radiology_order] generic | No letterhead/key images/sig | M |
| 61 | Crossmatch report | Met | crossmatch-report [crossmatch_request] mounted |  |  |
| 62 | Component issue slip w/ bag barcode | Partly | component-slip [transfusion_record] generic | No bag barcode | S |
| 63 | Investigation requisition | Met | investigation-requisition [lab_order] |  |  |
| 64 | OPD bill/receipt GST | Met | invoice_gst template; billing/invoice-detail.tsx:653 |  |  |
| 65 | IPD interim bill | Met | ipd_consolidated_bill template ipd/billing.tsx:78; ipd-interim-bill |  |  |
| 66 | IPD final itemised bill | Met | ipd-final-bill [invoice]; invoice_gst |  |  |
| 67 | Advance receipt | Met | advance-receipt [advance] |  |  |
| 68 | Refund receipt | Met | refund-receipt [refund] |  |  |
| 69 | TPA pre-auth form | Met | insurance-preauth [insurance_preauth] |  |  |
| 70 | Cashless claim form | Met | cashless-claim [claim]; insurance_cashless_claim template |  |  |
| 71 | Credit note | Met | credit-note [credit_note] |  |  |
| 72 | Package bill | Met | package-bill [package_subscription] |  |  |
| 73 | Estimate/proforma | Met | estimate [invoice], package-estimate [billing_package] |  |  |
| 74 | CGHS/ECHS/ESI/PMJAY forms | Missing | No scheme claim formats | None | L |
| 75 | TDS Form 16A | Partly | tds_certificates table; print deleted #4754 | No printable 16A | M |
| 76 | GST invoice | Met | invoice_gst (GSTIN, HSN/SAC) templates.rs:190 |  |  |
| 77 | Case sheet cover | Met | case-sheet-cover [admission] |  |  |
| 78 | H&P structured per dept | Partly | clinical_notes template via Clinical/case-sheet/CaseSheet.tsx:167 | No per-dept templates | M |
| 79 | Progress notes sheet | Met | mrd.progress-note [admission] |  |  |
| 80 | Nursing assessment | Met | mrd.nursing-assessment [admission] |  |  |
| 81 | MAR printable grid | Partly | mrd.mar generic sheet | Not a drug x time grid | M |
| 82 | Vitals graphical chart | Partly | mrd.vitals-chart generic table | No graph | M |
| 83 | Intake-output chart | Met | mrd.io-chart [admission] |  |  |
| 84 | Fluid balance chart | Met | fluid-balance-chart [admission] |  |  |
| 85 | Pain assessment | Met | pain-assessment [admission] |  |  |
| 86 | Morse fall risk | Met | fall-risk-assessment [admission] |  |  |
| 87 | Braden | Met | pressure-ulcer-risk [admission] |  |  |
| 88 | GCS chart | Met | gcs-chart [admission] |  |  |
| 89 | Restraint documentation | Met | restraint-documentation [restraint] |  |  |
| 90 | Pre-op checklist | Met | preop-assessment [booking] |  |  |
| 91 | WHO surgical safety checklist | Met | surgical-safety-checklist [booking]; nested phases printDocument.ts |  |  |
| 92 | Anaesthesia record w/ vitals grid | Partly | anesthesia-record [booking] generic | No vitals grid | M |
| 93 | Operation notes | Met | operation-notes [booking] |  |  |
| 94 | Post-op orders | Met | postop-orders [booking] |  |  |
| 95 | Transfusion requisition | Met | transfusion-requisition [crossmatch_request] |  |  |
| 96 | Transfusion monitoring | Met | transfusion-monitoring [bedside_transfusion] |  |  |
| 97 | ICU flowsheet | Missing | icu_flowsheets table; no print key | No print | M |
| 98 | Discharge checklist | Met | mrd.discharge-checklist [admission] |  |  |
| 99 | AMA form | Met | ama-form [admission] |  |  |
| 100 | MLC register entry | Met | emergency/mlc-case-detail.tsx MLC packet (#4754) |  |  |
| 101 | Wound certificate | Met | wound-certificate [mlc_case] |  |  |
| 102 | Age estimation | Met | age-estimation [mlc_document] |  |  |
| 103 | Death declaration | Met | death-declaration [patient] |  |  |
| 104 | MLC documentation | Met | get_mlc_documentation_print_data; mlc_documentation_print_test |  |  |
| 105 | Hand hygiene audit sheet | Partly | hand_hygiene_audits table | No print | S |
| 106 | BMW segregation log | Partly | biowaste_records | No daily ward-wise print | S |
| 107 | BMW manifest/challan | Missing | No manifest print | None | M |
| 108 | Needle-stick report | Partly | needle_stick_incidents | No print | S |
| 109 | HAI surveillance form | Partly | infection_surveillance_events | No print | S |
| 110 | Incident report | Met | incident-report [incident] |  |  |
| 111 | RCA template | Met | rca-template [incident] |  |  |
| 112 | CAPA form | Met | capa-form [capa] |  |  |
| 113 | ADR (PvPI) | Partly | adr-report [adr_report] registered | No screen mounts it | S |
| 114 | Transfusion reaction | Met | transfusion-reaction [transfusion_record] |  |  |
| 115 | Materiovigilance | Partly | materiovigilance registered | No screen mounts it | S |
| 116 | Fire mock drill | Partly | fire-mock-drill [fire_drill] registered | No screen mounts it | S |
| 117 | Restricted antibiotic request | Partly | antibiotic_stewardship_requests | No print | S |
| 118 | Employee ID card | Met | employee-id-card [user] |  |  |
| 119 | Duty roster print | Partly | duty_rosters; get_duty_roster_print_data not in registry | Handler broken/unmounted | M |
| 120 | Leave application | Partly | leave-application [leave_request] registered | No screen mounts it | S |
| 121 | Monthly attendance report | Partly | get_staff_attendance_print_data unregistered (bad column attendance_date) | Broken handler | M |
| 122 | Training certificate | Partly | training-certificate [training_record] registered | No screen mounts it | S |
| 123 | Credential verification | Met | staff-credentials [employee] |  |  |
| 124 | Visitor register | Met | visitor-register PrintRegisterButton |  |  |
| 125 | Indent form | Partly | indent-form [indent] registered | No screen mounts it | S |
| 126 | Purchase order | Partly | purchase-order [po] registered | No screen mounts it | S |
| 127 | GRN | Partly | grn [grn] registered | No screen mounts it | S |
| 128 | Material issue voucher | Partly | material-issue-voucher [indent] | No screen mounts it | S |
| 129 | Stock transfer voucher | Partly | get_stock_transfer_note_print_data unregistered | No print button | S |
| 130 | NDPS register | Met | ndps-register PrintRegisterButton |  |  |
| 131 | Drug expiry list | Met | drug-expiry-alert [store] |  |  |
| 132 | Equipment condemnation | Partly | equipment-condemnation [condemnation] | No screen mounts it | S |
| 133 | AMC/CMC summary | Partly | amc-contract [contract] | No screen mounts it | S |
| 134 | Maintenance work order | Met | work-order [fms_work_order] |  |  |
| 135 | PM checklist | Partly | pm-checklist [bme_work_order] | No screen mounts it | S |
| 136 | Calibration record | Met | calibration-certificate [calibration] |  |  |
| 137 | Breakdown report | Met | equipment-breakdown [breakdown] |  |  |
| 138 | Equipment history card | Met | equipment-history [equipment] |  |  |
| 139 | MGPS daily log | Met | mgps-log [gas_reading] |  |  |
| 140 | Water quality | Met | water-quality [water_test] |  |  |
| 141 | DG/UPS log | Partly | dg-ups-log handler returns 501 (#4754) | Not implemented | M |
| 142 | Fire equipment inspection | Partly | fire-inspection [fire_inspection] | No screen mounts it | S |
| 143 | OT register | Partly | get_ot_register_print_data unregistered | No print button | S |
| 144 | Donor registration | Met | blood-donor-form [donor] |  |  |
| 145 | Crossmatch requisition | Met | cross-match-requisition [crossmatch_request] |  |  |
| 146 | Dialysis run sheet | Partly | dialysis_sessions | No print | M |
| 147 | Endoscopy report w/ images | Partly | endoscopy_procedures | No print | M |
| 148 | Endoscope HLD log | Partly | endoscopy_reprocessing | No print | S |
| 149 | Cath lab report | Partly | cath_procedures, cath_hemodynamics | No print | M |
| 150 | Cath device log | Partly | cath_devices | No print | S |
| 151 | ECT register (MHCA) | Partly | psych_ect_register | No print | M |
| 152 | Psych seclusion/restraint | Partly | psych_seclusion_restraint; restraint-documentation is nursing | No psych print | M |
| 153 | Palliative plan + DNR | Partly | consent.dnr only | No palliative plan | M |
| 154 | Disability cert (RPWD) | Missing | No table/print | None | M |
| 155 | PCPNDT Form F | Partly | pcpndt_forms table | No Form F print | M |
| 156 | Mortuary receipt register | Partly | mortuary_records | No print | S |
| 157 | Body release form | Partly | mortuary_records | No print w/ ID verification | M |
| 158 | Post-mortem requisition | Missing | None | None | M |
| 159 | Viscera chain-of-custody | Missing | None | None | M |
| 160 | Unclaimed body protocol | Missing | None | None | M |
| 161 | Student admission form | Missing | print-data academic.rs 501 | NotImplemented | M |
| 162 | Intern rotation/posting | Missing | academic.rs 501 | NotImplemented | M |
| 163 | PG logbook entry | Partly | pg_logbook_entries; get_pg_logbook_entry unregistered | No print | S |
| 164 | Intern logbook | Missing | None | None | M |
| 165 | Internal assessment marks | Missing | academic.rs 501 | NotImplemented | M |
| 166 | Exam hall ticket | Missing | academic.rs 501 | NotImplemented | M |
| 167 | OSCE sheet | Missing | academic.rs 501 | NotImplemented | M |
| 168 | Simulation debrief | Missing | academic.rs 501 | NotImplemented | M |
| 169 | CME/FDP certificate w/ QR | Missing | academic.rs 501 | NotImplemented | M |
| 170 | IEC approval certificate | Missing | academic.rs 501 | NotImplemented | M |
| 171 | Research proposal form | Missing | academic.rs 501 | NotImplemented | M |
| 172 | Hostel allotment | Missing | academic.rs 501 | NotImplemented | M |
| 173 | Anti-ragging undertaking | Missing | academic.rs 501 | NotImplemented | M |
| 174 | Disability accommodation plan | Missing | academic.rs 501 | NotImplemented | M |
| 175 | Internship completion cert | Missing | academic.rs 501 | NotImplemented | M |
| 176 | Service bond | Missing | academic.rs 501 | NotImplemented | M |
| 177 | Stipend advice | Missing | academic.rs 501 | NotImplemented | M |
| 178 | NABH QI report | Met | nabh-quality-report PrintRegisterButton |  |  |
| 179 | NMC compliance report | Met | nmc-compliance-report |  |  |
| 180 | NABL quality report | Met | nabl-quality-report |  |  |
| 181 | SPCB BMW Form IV | Met | spcb-bmw-returns |  |  |
| 182 | AERB radiation report | Partly | radiology_dosimetry_records, radiation_dose_records | No report print | M |
| 183 | PESO compliance | Partly | peso-compliance; regulatory.rs references reading_at/last_inspection_date not in schema | Likely errors | S |
| 184 | Drug licence reports | Met | drug-license-report [license] |  |  |
| 185 | PCPNDT Form G | Met | pcpndt-report |  |  |
| 186 | Birth register | Met | birth-register (Mrd/BirthsTab) |  |  |
| 187 | Death register | Met | death-register (Mrd/DeathsTab) |  |  |
| 188 | MLC register | Met | mlc-register-summary |  |  |
| 189 | AEBAS attendance | Met | aebas-attendance |  |  |
| 190 | NMC NARF report | Missing | Print deleted #4754 | None | M |
| 191 | Thermal printer support | Partly | paper.rs Thermal80/Label50x25/Wristband via Gotenberg PDF | Browser print only, no ESC/POS | M |
| 192 | Barcode/QR on all forms | Partly | medbrains-print/src/codes.rs qr_svg/code128_svg | Few templates use it | M |
| 193 | Laser A4/A5 | Met | paper.rs A4/A5; Gotenberg PDF |  |  |
| 194 | Dot matrix multi-copy | Missing | None | None | M |
| 195 | Pre-printed stationery | Partly | branding.show_letterhead toggle engine.rs | Server templates only | S |
| 196 | Blank-paper full form | Partly | base.html letterhead+footer | Generic printDocument has neither | M |
| 197 | PDF for digital distribution | Partly | POST /api/documents/render -> S3 + document_outputs; documents/outputs-tab.tsx | No email/WhatsApp/portal push | M |
| 198 | Bulk print | Missing | None | No batch print | M |
| 199 | Print queue per printer/dept | Partly | print_jobs + documents/print-queue-tab.tsx | No print agent dispatch | L |
| 200 | Reprint DUPLICATE audited | Partly | watermark enum + document_outputs | No automatic DUPLICATE on reprint | S |
| 201 | Print preview | Met | DocumentPreview/DocumentPreviewModal.tsx; /documents/render/templates/:code/preview |  |  |
| 202 | Mobile printing | Missing | No print in apps/ios, apps/android | None | L |
| 203 | Dept->printer mapping | Partly | documents/printers-tab.tsx, print-routing-tab.tsx (printer_configs) | Routing not used at print time | M |
| 204 | Only-latest-active versions | Partly | document_templates.is_active; versions table unwritten | No version history | M |
| 205 | Print usage audit | Partly | document_outputs.generated_by/patient_id (server render) | Generic printDocument.ts prints unlogged | M |
| 206 | Archival marked obsolete | Partly | quality_documents obsolete status | Not for print forms | M |
| 207 | CONTROLLED COPY w/ copy no. | Missing | No 'controlled' watermark/copy number | None | M |
| 208 | UNCONTROLLED watermark | Partly | watermark_type 'uncontrolled' | No UI to choose | S |
| 209 | Form compliance dashboard | Partly | documents/review-schedule-tab.tsx | No dept overdue dashboard | S |
| 210 | Annual review tracking | Met | document_form_review_schedule INSERT medbrains-documents/documents.rs; review-schedule-tab markReviewed |  |  |
| 211 | External auditor time-limited access | Missing | No auditor access table/role | None | M |



### 29. Implementation Plan & Project Delivery

| # | Criterion (short) | Status | Evidence | Gap | Fix |
|---|---|---|---|---|---|
| 1-10 | Methodology, phase plan, timelines, PM framework, dedicated PM | N/A | RFC phases; docs/GO-LIVE-READINESS.md | delivery process, not software | |
| 11-19 | Team, SPOC, escalation, reporting, risk register, CR process, backup | N/A | — | delivery process | |
| 20-26 | Requirement gathering, gap analysis, HOD workflow mapping, UAT sign-off | N/A | MedBrains_Features.xlsx is the internal tracker | delivery process | |
| 27 | Migrate from Excel/old HMS/paper | Partly | CSV imports for masters only (client.ts importLabCatalog/importPharmacyCatalog/importChargeMaster/importUsers) | no transactional or legacy-HMS import | L |
| 28 | Formats (CSV/XML/JSON/HL7/FHIR/SQL) | Partly | CsvImportRequest; importTenantConfig JSON (ConfigTransferButtons.tsx) | no HL7/FHIR bulk import | L |
| 29 | Patient master migration (UHID map, ABHA, insurance) | Missing | no patient import route; `data_migrations` (it-security/lib.rs:1220) only records a request, nothing processes it, and no screen | no importer | L |
| 30 | Historical clinical data migration | Missing | — | no importer | L |
| 31 | Financial migration (balances, advances, TPA AR) | Missing | — (importBankTransactions is reconciliation only) | no opening-balance import | M |
| 32 | HR master migration | Partly | importUsers (onboarding/UsersStep.tsx); importAebasPeriodSummary | no staff history or credentials import | M |
| 33 | Master data migration (drug, test, rate, vendor) | Met | lab/catalog.tsx, pharmacy/catalog.tsx, MasterDataStatusSettings.tsx (charge master), importProcedureCatalog | — | |
| 34 | Post-migration validation and reconciliation | Partly | dry_run on importTenantConfig | no count/reconciliation report | M |
| 35 | Parallel-run duration | N/A | — | process | |
| 36 | Migration rollback plan | Partly | runbooks/wal-recovery.md, hybrid-cutover.md | no per-import undo | M |
| 37-38 | Data cleaning ownership, history depth | N/A | — | contract | |
| 39 | % configurable vs code | Partly | ~45 admin/settings/*.tsx screens | no measured % | S |
| 40 | Dept config (OPD templates, IPD forms, lab catalog, billing rules) | Met | ConsultationTemplatesSettings.tsx, ClinicalNotesSettings.tsx, lab/catalog.tsx, BillingTaxSettings.tsx | — | |
| 41 | Master data setup ownership | Met | onboarding wizard (pages/onboarding), CSV imports | — | |
| 42 | Pre-defined and custom roles | Met | 11 built-in roles (access/roles.rs); admin/roles.tsx custom roles plus permission tree | — | |
| 43 | No-code approval chains | Partly | approvals crates + pages/approvals; integration-builder | no generic chain-designer screen found | M |
| 44 | Self-service report builder | Partly | pages/reports (fixed catalogue report-catalog.ts) | no ad-hoc builder | L |
| 45 | Dashboard builder | Met | components/dashboard/WidgetPicker.tsx; dashboard widgets (#4696) | — | |
| 46 | Configurable alert engine (who/what/channel) | Partly | CriticalValueRulesSettings.tsx | no generic recipient/channel rule screen | M |
| 47 | Form/template customisation without vendor | Met | admin/document-templates.tsx, PrintTemplateSettings.tsx, ConsultationTemplatesSettings.tsx | — | |
| 48 | Billing rule engine (rates, packages, insurance, concessions) | Met | rate plans (billing/page-inner.tsx), billing/packages.tsx, insurance pages, BillingTaxSettings.tsx | — | |
| 49-51 | Go-live approach, on-site staff, 24/7 hypercare | N/A | — | process | |
| 52 | Go-live readiness checklist | Partly | docs/GO-LIVE-READINESS.md; onboarding progress (`onboarding_progress`) | internal document; lists open hard blockers | S |
| 53-54 | Stabilisation period, bug SLA | N/A | — | contract | |
| 55 | Performance benchmarking | Partly | crates/medbrains-loadtest (goose, generated.rs) | load test not run or reported | M |
| 56 | User adoption tracking | Partly | audit/UserActivityTab.tsx, AuditStatsTab.tsx | no adoption dashboard (logins and feature use per dept) | M |
| 57 | Go-live fallback | Partly | OfflineModeSettings.tsx, camp/offline mode, runbooks | no paper-downtime kit | M |
| 58-64 | Warranty, AMC, support model, hours, bug SLAs | N/A | — | contract | |
| 65 | Ticket log/track/escalate | Missing | no ticket/helpdesk table | no in-product support ticketing | M |
| 66-67 | Account manager, quarterly reviews | N/A | — | contract | |
| 68 | Release cadence | N/A | — | process | |
| 69 | Upgrade process and downtime | Partly | embedded sqlx migrations; runbooks/patroni-failover.md, sprint-b-cutover.md | no zero-downtime upgrade procedure documented | M |
| 70-71 | Upgrade cost, skippable | N/A | — | contract | |
| 72 | Upgrades preserve config | Met | config held in DB (`tenant_settings`, written by the admin/settings screens); additive migrations | — | |
| 73 | Product roadmap | Partly | docs/backlog, MedBrains_Features.xlsx | internal only | S |
| 74-75 | Regulatory change handling and turnaround | N/A | — | process | |
| 76-77 | Lock-in, exit clause | N/A | — | contract | |
| 78 | Full data export in standard formats | Partly | config export (ConfigTransferButtons.tsx); per-patient FHIR $everything; audit CSV | no whole-tenant export | L |
| 79-83 | Escrow, data ownership, transition, AMC lapse, IP | N/A | — | contract | |

### 30. Training Plan & Knowledge Transfer

| # | Criterion (short) | Status | Evidence | Gap | Fix |
|---|---|---|---|---|---|
| 1 | Training methodology | N/A | — | process | |
| 2 | Role-based curriculum | Partly | LMS learning paths (`lms_learning_paths`, lms/learning-paths-tab.tsx); docs/sops/01-29 | no per-role track content | M |
| 3-7 | Needs assessment, calendar, hours, man-days, batch size | N/A | — | process | |
| 8 | Training in Tamil | Partly | apps/web/public/locales/ta (UI strings) | guide and SOPs are English only | M |
| 9 | Separate sandbox with dummy data | Partly | medbrains-seed demo_patients.rs/canonical_fixtures.rs; /admin/simulator | no turnkey training tenant | M |
| 10 | Realistic scenario data | Partly | seed fixtures; LLM simulator | not packaged as training scenarios | S |
| 11 | User manuals and online help | Partly | docs/sops (29 SOPs); apps/docs in-app /help (8 pages) | guide covers only about 4 workflows | L |
| 12 | Quick reference cards per role | Missing | — | none | S |
| 13 | Video tutorials | Missing | — | none | M |
| 14 | In-app guided walkthrough | Partly | /help Docusaurus (apps/docs) | no step-by-step tour | M |
| 15 | Materials in Tamil | Missing | — | none | M |
| 16 | Sample patients for practice | Partly | demo_patients.rs | same as #9 | S |
| 17-21, 23 | Train-the-trainer program, counts, scope, certification, refreshers, internal onboarding | N/A | LMS could host it | process | |
| 22 | Internal trainer toolkit (slides, worksheets, tests) | Missing | LMS quizzes exist; no toolkit content | none | M |
| 24 | Doctors content | Partly | sops/02-opd-visit, 05-ipd; apps/docs clinical/* | no curriculum | S |
| 25 | Nurses content (MAR, handover, incidents) | Missing | no nursing SOP or guide page | none | M |
| 26 | Lab content | Partly | sops/03-lab-orders; apps/docs lab/from-order-to-report | — | S |
| 27 | Pharmacy content (NDPS, DDI) | Partly | sops/04-pharmacy-dispensing | — | S |
| 28 | Radiology/PACS content | Partly | sops/08-radiology, 28-pacs-dicom | — | S |
| 29 | Billing content | Partly | sops/07-billing, 20-insurance-tpa | — | S |
| 30 | Front office content | Partly | sops/01, 26; apps/docs front-desk/* | — | S |
| 31 | Store/inventory content | Partly | sops/11-procurement-indent | — | S |
| 32 | HR/Admin content | Partly | sops/18-hr-attendance | — | S |
| 33 | Quality content | Partly | sops/19-audit-quality | — | S |
| 34 | IT admin content | Partly | sops/27-system-settings; docs/sso-entra-setup.md | no backup/monitoring admin guide | S |
| 35 | Management content | Partly | sops/21-command-center, 22-analytics-reports | — | S |
| 36 | Post-training assessment | Met | `lms_quizzes`/`lms_quiz_attempts` (lms/lib.rs:1025); lms/quizzes-tab.tsx | — | |
| 37 | Minimum pass score before system access | Missing | `lms_quizzes.pass_percentage` exists, but login and permissions never check it | no access gate | M |
| 38 | Re-training on failure, cost | N/A | — | contract | |
| 39 | Dept go-live readiness (critical staff passed) | Partly | lms/compliance-tab.tsx (completion %) | no go-live gate | M |
| 40 | Completion certificates | Met | `lms_certificates` (lms/lib.rs:1403); lms/certificates-tab.tsx | — | |
| 41 | Training records (who, when, what, score) | Met | `lms_enrollments`, `lms_quiz_attempts`; compliance-tab.tsx | — | |
| 42 | New-employee onboarding training | N/A | — | process | |
| 43 | Refresher schedule | Partly | LMS due_date on enrollment | no recurring re-enrolment | S |
| 44 | New-feature training on upgrade | Missing | — | no release notes or "what's new" | S |
| 45 | Training for new phases | N/A | — | process | |
| 46 | Self-paced e-learning 24/7 | Met | lms/my-learning-tab.tsx, course-catalog-tab.tsx | — | |
| 47-48 | Training cost, webinars | N/A | — | contract | |
| 49 | Knowledge base / FAQ | Partly | apps/docs /help (8 pages) | thin | M |
| 50-53 | Change management, champions, resistance, pilot | N/A | — | process | |
| 54 | User feedback during training | Missing | `comm_feedback_surveys` is patient-facing | no staff feedback capture | S |
| 55 | Floor support | N/A | — | process | |
| 56 | Adoption metrics (logins, feature use, workarounds) | Partly | audit/UserActivityTab.tsx; audit_log by module | no adoption dashboard | M |

### 31. Audit Trail, Access Logs & Security Monitoring

| # | Criterion (short) | Status | Evidence | Gap | Fix |
|---|---|---|---|---|---|
| 1 | Every CREATE logged (who/what/when/IP/device) | Partly | server-core/middleware/audit.rs `audit_layer` logs every 2xx POST with user, IP and user agent; `audit_trigger_func` row snapshots on 31 tables | written by a fire-and-forget task, so a row can be lost (audit.rs:110); new record id not captured from the path; the trigger covers only 31 of ~870 tables | M |
| 2 | Every READ/VIEW logged | Met | audit.rs: detail GETs (UUID anywhere in path) and PHI lists; middleware/access_log.rs → `access_log`; screens audit/AccessLogTab.tsx, Patient/PatientAccessLogSection.tsx | access_log PHI_PREFIXES skips specialty/psych (audit_log still catches them); written async | |
| 3 | UPDATE with old vs new values | Partly | `audit_log.old_values/new_values` via `audit_trigger_func` (0001:2745) on 31 tables (patients, users, roles, invoices, lab_results...) | HTTP-layer rows carry no before/after; most tables (eMAR, NDPS, OT, ICU...) have no diff | M |
| 4 | DELETE logged / soft-delete only | Met | `soft_delete_guardrail` BEFORE DELETE trigger (0001:3049) on ~711 tables; DELETE requests are audited | `app.allow_physical_delete` GUC bypass exists | |
| 5 | Audit log immutable even for admin/DBA | Partly | FORCE RLS with only INSERT/SELECT policies (0030_audit.sql:97-119, 0983); SHA-256 hash chain (`audit_log_hash_chain` trigger) plus hourly verify (`audit_chain_verifications`, ChainIntegrityTab.tsx) | table owner/DBA can still UPDATE/DELETE (no REVOKE/WORM); runbooks/audit-chain-verify.md admits legacy rows fail verification | M |
| 6 | Stored separately (tamper-proof) | Partly | `AuditSink` trait + LocalFs, S3 Object Lock design (core/audit_sink/mod.rs); infra observability/logs.tf Firehose→S3 | `archive_segment` has no caller, so audit rows live only in the OLTP DB | M |
| 7 | Fields: user, role, IP, device, ms timestamp, module, action, record, before/after | Partly | `audit_log` columns: user_id, ip_address, user_agent, module, action, entity_id, created_at (µs), old/new | no role column; session_id is always NULL (audit.rs "when session middleware lands"); login/lockout rows have ip_address None (auth/lib.rs:90,466) | S |
| 8 | Retention ≥7 years | Partly | monthly partitions to 2027-07 plus DEFAULT `audit_log_legacy_archive`; nothing purges | no declared or enforced 7-year policy; partitions not auto-created | S |
| 9 | Search/filter (user, date, module, action, patient) | Met | GET /audit/log filters (client.ts listAuditLog); AuditLogTab.tsx; access-log by patient_id | — | |
| 10 | Export CSV/PDF | Partly | GET /audit/export (routes/audit.rs:419, CSV/JSON); AuditLogTab.tsx:139 | hard LIMIT 10000 silently truncates; no PDF | S |
| 11 | Login/logout logged | Met | auth/lib.rs:455 "login", :831 "logout", :907 "logout_all"; visible in UserActivityTab | login row has no IP | |
| 12 | Failed login logged with IP and lockout after N | Partly | lockout after 5 for 15 min (auth/lib.rs:56-100) plus "account_locked" audit | individual failed attempts not audited; IP not recorded | S |
| 13 | Concurrent session detection | Partly | cap of 5 refresh tokens, oldest revoked (auth/lib.rs:428); token_reuse_detected, device_fingerprint_mismatch audits | no detection or alert for simultaneous devices | S |
| 14 | Inactivity auto-logout, per role, logged | Missing | no idle-timeout in apps/web or stores | none | S |
| 15 | Password change/reset logged (self vs admin) | Met | auth/lib.rs:1126 "change_password", :1353 "password_reset"; force-password-change.tsx | — | |
| 16 | Role change logged (old/new, approver) | Partly | `audit_trigger_func` on `users`/`roles`; `iam_access_requests` (reviewed_by) + admin/access-requests.tsx | direct role edits by admin have no approver | S |
| 17 | User creation and deactivation logged | Met | audit trigger on `users` (is_active, deactivated_at); admin/users.tsx | — | |
| 18 | Access card/biometric provisioning linked to user | Partly | `security_access_cards` (employee_id, issued_by; security/lib.rs:495); security/access-control-tab.tsx | linked to employee, not HMS user; no biometric | S |
| 19 | Patient record access log | Met | `access_log`; Patient/PatientAccessLogSection.tsx; GET /audit/access-log/patient/{id} | — | |
| 20 | VIP access alerting | Missing | `sensitive_patients` + `access_alerts` tables and routes (it-security/lib.rs:551-690) | nothing ever INSERTs `access_alerts`; sensitive flag drives no check; no web screen | M |
| 21 | Cross-department access tracking | Partly | access_log/audit_log record the viewer; dept tuples (1043_patient_department_access.sql) | no cross-dept report or flag | M |
| 22 | After-hours access alerting | Missing | (`after_hours_*` in security.rs is physical zones only) | none | M |
| 23 | Bulk access detection | Missing | PHI list reads are logged; authz/context.rs forbids bulk export for some classes | no volume threshold or alert | M |
| 24 | Psychiatric records (PSY-001: break-glass only) | Partly | ReBAC parent links PSYCH_* (authz-gate/lib.rs:254); detail reads in audit_log | not isolated to break-glass; no dedicated monitor | M |
| 25 | Substance-abuse isolation (PSY-002) | Missing | — | no extra class or isolation | M |
| 26 | Counselling records counsellor-only (STU-002) | Missing | `psych_counseling_sessions` uses the general psych gate | no counsellor-only rule | M |
| 27 | Print/export/download tracking | Partly | print-data GETs land in audit_log (UUID path); `print_jobs` (documents-render/lib.rs:407); reprint audit for receipts | not tagged as print/export; client-side prints are invisible | M |
| 28 | Break-glass fully logged (who, reason, duration, data seen) | Partly | `break_glass_events` (it-security/lib.rs:248) with justification, step-up, expiry; review rolls up PHI accessed (:486) | **no web/native screen starts break-glass** (client.ts startBreakGlass unused); ip_address/user_agent never set | M |
| 29 | Auto-notify treating doctor, HOD, IT security, MS | Missing | — | no notification on break-glass | M |
| 30 | Auto-expiry (configurable) | Met | `expires_at` default 4h, expires_in_minutes; relation tuple expires_at (it-security/lib.rs:194,304) | depends on #28 being reachable | |
| 31 | Post-break-glass review workflow | Met | POST /break-glass/{id}/review; audit/BreakGlassReviewTab.tsx | — | |
| 32 | Break-glass abuse detection | Missing | — | no repeat-trigger alert | S |
| 33 | Monthly break-glass report for NABH | Partly | list filtered by date and reviewed (BreakGlassReviewTab) | no summary report | S |
| 34 | Access-denied events logged | Missing | audit_layer skips non-2xx (audit.rs:79) | no denial log | M |
| 35 | Policy change audit | Partly | audit trigger on `roles`; `relation_tuples.granted_by/reason` | tuple, field-access and dept-policy changes not audited | M |
| 36 | Role assignment audit with approver chain | Partly | `iam_access_requests` + admin/access-requests.tsx | direct assignment bypasses approval | S |
| 37 | Privilege escalation detection | Missing | — | no alert on extra/override grants | M |
| 38 | Segregation of duties | Met | maker-checker: materials/procurement.rs:856 (PO creator cannot approve); pharmacy-finance/lib.rs:810; approvals-core controls.rs | enforced, not reported | |
| 39 | Expired vendor access still active alert | Partly | time-bound tuples (`relation_tuples.expires_at`), `iam_access_requests.requested_expires_at` | users have no expiry; no alert | S |
| 40 | External users time-limited | Partly | API keys/shadow accounts; tuple expiry | no external-user type with expiry | M |
| 41 | Incident reports never deletable (INC-002) | Met | `quality_incidents`: no delete route in medbrains-quality; soft_delete_guardrail; screens under pages/quality | — | |
| 42 | Anonymous reporter identity encrypted (INC-001) | Missing | quality/lib.rs:855-869 stores `reported_by = claims.sub` in plain text even when is_anonymous | identity exposed | S |
| 43 | Medication-error auto-notification log | Partly | QualityIncidentReported event (quality/lib.rs:896); sentinel/fall mirrors | no medication_error-specific notify or log | S |
| 44 | Consent view/print audit | Met | `consent_audit_log`; GET reads under /consent in access_log; consent/audit-tab.tsx | — | |
| 45 | Consent revocation logged in real time | Met | revoke writes `consent_audit_log` in the same tx (consent/lib.rs:648); consent/verification-tab.tsx | — | |
| 46 | Reprint detection plus DUPLICATE watermark | Partly | is_reprint with reason (print-data/billing.rs:110); "Duplicate / reprint" (billing/shared.tsx:363); CaseSheetsTab, Wristband | receipts, case sheets, wristbands, certificates only | M |
| 47 | Real-time security dashboard | Partly | audit/AuditStatsTab.tsx, security/incidents-tab.tsx | no sessions, failed-login or break-glass live view | M |
| 48 | Automated anomaly detection | Missing | — | none | L |
| 49 | SIEM integration | Missing | — | no Splunk/ELK/Wazuh connector | M |
| 50 | Log forwarding (syslog/JSON/CEF) | Partly | infra/terraform/modules/observability/logs.tf (Loki+Promtail, CloudWatch→Firehose→S3) | audit_log rows not forwarded; no CEF/syslog | M |
| 51 | Security-event alert engine | Partly | PagerDuty on chain break (runbooks/audit-chain-verify.md) | no alerts for lockouts, break-glass or anomalies | M |
| 52 | Periodic security audit reports | Partly | security_incidents + CERT-In report (it-security/lib.rs:1792); `vulnerabilities` | no scheduled monthly report | S |
| 53 | DPDP data-subject access log | Partly | per-patient access log (PatientAccessLogSection.tsx) | not exposed to the patient/portal; no DSAR workflow | M |
| 54 | Forensic user timeline | Met | GET /audit/user/{id}/activity (UserActivityTab.tsx), /audit/timeline/{type}/{id} (EntityTimelineTab.tsx), correlation_id | session_id null | |



### 32. Storage, Backup, Archival & Data Management
| # | Criterion (short) | Status | Evidence | Gap | Fix |
|---|---|---|---|---|---|
| 1 | Storage estimate Y1/3/5 | Missing | deploy/standalone/STORAGE.md (says "~5 TB pilot", nothing more) | no sizing model | S |
| 2 | Structured data size/growth | Missing | — | no estimate | S |
| 3 | Unstructured size | Missing | — | no estimate | S |
| 4 | DICOM storage estimate | Missing | — | no PACS sizing | S |
| 5 | Lab analyzer/waveform storage | Missing | — | no waveform store | M |
| 6 | Audit log storage estimate | Partly | audit_log PARTITION BY RANGE (0030_audit.sql:85) | partitioned, no estimate | S |
| 7 | Hot SSD vs cold tier | Met | object_storage_policies (0110_core.sql:579), storage_archive/mod.rs sweeper, medbrains-archive.timer, pages/admin/storage.tsx | | |
| 8 | Add storage without downtime | Partly | S3 backend option in STORAGE.md | prod: one root volume (medbrains-host-check) | M |
| 9 | Redundancy/RAID/replication | Partly | modules/patroni-cluster, modules/aurora reader | prod single host, no replica | M |
| 10 | Cloud storage for archival | Met | medbrains-pg-backup → `aws s3 cp`; modules/s3/main.tf:158 GLACIER lifecycle; medbrains-upload presign | | |
| 11 | DB engine | Met | postgres:17-alpine (deploy/standalone/docker-compose.prod.yml:27) | | |
| 12 | Version/edition | Met | PG17 community | | |
| 13 | DB replication | Partly | patroni-onprem / aurora IaC | not deployed in prod | M |
| 14 | Read replica for reporting | Partly | aurora/main.tf:171 reader | reports read primary | M |
| 15 | Connection pooling | Met | sqlx pool acquire/idle timeouts (medbrains-server/src/main.rs:129) | | |
| 16 | Partitioning strategy | Met | audit_log RANGE created_at (0030_audit.sql:85); HASH tenant_id (0040_auth.sql:621) | only high-volume tables | |
| 17 | Encryption at rest | Partly | aurora storage_encrypted (aurora/main.tf:139); KMS module | standalone EBS/PG volume unproven | S |
| 18 | Encryption in transit to DB | Partly | — | no sslmode=require on standalone DB URL | S |
| 19 | Psych data isolated/encrypted (PSY-001) | Missing | psych_* tables have only tenant RLS (0380_specialty.sql:1412) | no separate encrypted partition | L |
| 20 | Maintenance windows | Missing | autovacuum defaults | not documented | S |
| 21 | DB monitoring | Partly | observability/dashboards/patroni.json, Performance Insights (aurora) | standalone: disk only | M |
| 22 | DBA cannot see PHI | Missing | RLS only (superuser bypasses); no column encryption | DBA reads PHI | L |
| 23 | DICOM engine | Partly | dicom_studies w/ orthanc_id (medbrains-radiology/src/lib.rs:1765-1799) | no Orthanc deployed | L |
| 24 | Short-term online DICOM | Missing | — | no PACS store | L |
| 25 | Long-term DICOM archive | Missing | — | | L |
| 26 | DICOM compression | Missing | — | | L |
| 27 | DICOM dedup | Missing | — | | L |
| 28 | Study lifecycle auto-archive | Missing | tiering covers patient_documents only | | M |
| 29 | DICOM integrity hash | Missing | — | | M |
| 30 | PACS DR | Missing | — | | L |
| 31 | Full backup frequency | Met | nightly 02:30 pg_dump (medbrains-pg-backup.timer:7) | | |
| 32 | Incremental backups | Partly | pgbackrest.conf.tmpl (packer), patroni IaC | prod: nightly full only | M |
| 33 | WAL/log backup 15 min | Partly | patroni archive_command; runbooks/wal-recovery.md | prod none → RPO 24h | M |
| 34 | 3-2-1 rule | Partly | local dump + S3 | no 2nd media/region | M |
| 35 | Backup encryption | Partly | S3 bucket SSE (modules/bootstrap); script has no client-side encrypt | no --sse/KMS on cp | S |
| 36 | Automatic restore testing | Partly | infra/k8s/cronjobs/pgbackrest-restore-test.yaml | script admits restore never proven on standalone (medbrains-pg-backup:120-130) | M |
| 37 | Backup failure alert | Met | OnFailure=medbrains-alert@ (medbrains-pg-backup.service:14); backup freshness in medbrains-host-check | | |
| 38 | RPO defined | Partly | implied 24h | not stated/agreed | S |
| 39 | RTO defined | Partly | runbooks only | not stated | S |
| 40 | PITR | Partly | aurora/patroni WAL | not in prod | M |
| 41 | App-consistent backup | Met | pg_dump snapshot (medbrains-pg-backup:62) | | |
| 42 | DICOM backup | Missing | — | | L |
| 43 | Audit log immutable backup | Partly | S3 Object Lock COMPLIANCE 7y (modules/s3/main.tf:53); hash chain | nothing ships audit rows to that bucket (audit_sink/local.rs only) | M |
| 44 | DR site | Partly | aurora cross-region refs in IaC | none live | L |
| 45 | DR replication mode | Partly | patroni/aurora IaC | none live | L |
| 46 | Replication lag monitoring | Partly | patroni.json dashboard | not live | M |
| 47 | Failover auto/manual | Partly | runbooks/patroni-failover.md | prod has no standby | L |
| 48 | Failback process | Missing | — | no runbook | S |
| 49 | DR testing | Partly | infra/test/patroni/patroni_cluster_test.go | no drill record | M |
| 50 | DR scope | Missing | — | undefined | S |
| 51 | Network failover/ISP | N/A | hospital network procurement | | |
| 52 | DR runbook | Met | runbooks/patroni-failover.md, wal-recovery.md, hybrid-cutover.md | | |
| 53 | MR retention policy | Met | mrd_retention_policies (0250_mrd.sql:935), INSERT in medbrains-mrd/src/lib.rs, components/Mrd/RetentionTab.tsx | | |
| 54 | Active-data retention before archival | Partly | object_storage_policies for documents | DB rows never archived | M |
| 55 | Archived data searchable | Partly | tiered docs restorable | no DB-row archive/search | M |
| 56 | DICOM 7-10y retention | Missing | — | | M |
| 57 | Financial 8y retention | Partly | retention policy configurable by record type | not enforced on billing tables | S |
| 58 | Audit log 7y retention | Partly | Object Lock 7y bucket defined | not fed | M |
| 59 | Consent retention | Partly | via mrd_retention_policies | not linked to consent tables | S |
| 60 | Purge authorised + audited | Partly | sweeper `deleted` tier hash-chained (object_storage_transitions) | no approval workflow | M |
| 61 | Standard archive format | Partly | pg_dump custom; medbrains-fhir export | no bulk FHIR export | M |
| 62 | DPDP right to erasure | Missing | dpdp_consents table (0040_auth.sql:264) has no writer; no erasure flow | | M |

### 33. Tech Stack, Server, Network, Firewall, VPC & Infrastructure Security
| # | Criterion (short) | Status | Evidence | Gap | Fix |
|---|---|---|---|---|---|
| 1 | Backend language | Met | Rust + Axum (Cargo.toml) | | |
| 2 | Framework version/LTS | Met | Axum 0.8, rust-toolchain.toml stable | | |
| 3 | Frontend | Met | React 18 + Mantine (apps/web) | | |
| 4 | Mobile native/cross | Met | apps/ios SwiftUI, apps/android Compose | | |
| 5 | REST/GraphQL/gRPC | Partly | REST + FHIR REST (medbrains-fhir-api) | RFC gRPC/GraphQL absent | M |
| 6 | API versioning | Missing | unversioned /api/* | no compat guarantee | M |
| 7 | Modular monolith | Met | ~140 crates, one server binary | | |
| 8 | Message queue | Partly | Postgres outbox (medbrains-outbox) | no NATS | M |
| 9 | Cache layer | Missing | no redis/dragonfly dep | | M |
| 10 | Search engine | Met | pg_trgm (0001_extensions_types_functions.sql:65) | | |
| 11 | FHIR engine R4 | Met | crates/medbrains-fhir, medbrains-fhir-api | | |
| 12 | DICOM integration | Partly | dicom_studies metadata only | no Orthanc | L |
| 13 | PDF generation | Met | gotenberg 8.21 (docker-compose.prod.yml:15), medbrains-printing | | |
| 14 | From scratch / licence | Met | LICENSE (AGPL) + COMMERCIAL-LICENSE.md, deny.toml | | |
| 15 | RDBMS + version | Met | PostgreSQL 17 | | |
| 16 | NoSQL | Met | none; JSONB in PG | | |
| 17 | Hierarchical DB | Met | YottaDB removed; PG tenant_settings/sequences | | |
| 18 | Time-series for IoT | Missing | no Timescale/Influx | | M |
| 19 | DICOM storage | Partly | object store tiers; no PACS | | L |
| 20 | ORM/pooling | Met | SQLx + sqlx pool | | |
| 21 | Migration tool | Met | crates/medbrains-db-migrations (sqlx migrate) | | |
| 22 | Full-text search | Met | PG native | | |
| 23 | Deployment model | Met | deploy/standalone, deploy/onprem, EKS/k3s modules | | |
| 24 | On-prem server spec | Partly | modules-onprem-baremetal | no spec sheet | S |
| 25 | Min server for 420 beds | Missing | — | no sizing doc | S |
| 26 | App instances / LB | Partly | infra/k8s/hpa, helm chart | prod single instance | M |
| 27 | Dedicated DB server | Partly | aurora/patroni IaC | prod shares host | M |
| 28 | PACS server | Missing | — | | L |
| 29 | Separate reporting server | Partly | aurora reader IaC | not wired | M |
| 30 | Dev/Staging/UAT/Prod | Partly | infra/terraform/envs/dev, tenants | no staging/UAT env | M |
| 31 | Container orchestration | Met | deploy/helm/medbrains-server, modules/eks, standalone-vm/aws-k3s | | |
| 32 | Auto-scaling | Partly | infra/k8s/hpa, keda, karpenter | not in prod | M |
| 33 | Hardening / CIS | Partly | Bottlerocket packer, Kyverno policy.tf, Falco runtime.tf | no CIS checklist | M |
| 34 | OS | Met | Linux (Bottlerocket/AL/Ubuntu) | | |
| 35 | Patch management | Missing | — | no process doc | S |
| 36 | Topology diagram | Missing | — | | S |
| 37 | VLAN segmentation | N/A | hospital LAN | | |
| 38 | Bandwidth requirements | Missing | — | not published | S |
| 39 | Redundant network paths | N/A | hospital LAN | | |
| 40 | WiFi requirements | Missing | — | not published | S |
| 41 | Medical device isolation | Partly | medbrains-bridge / edge agent, headscale | no guidance | S |
| 42 | Guest WiFi isolation | N/A | hospital LAN | | |
| 43 | Network monitoring | Partly | modules/uptime-route53, Prometheus IaC | | M |
| 44 | DNS/DHCP/NTP | Partly | modules/dns (7 providers) | DHCP/NTP not covered | S |
| 45 | Perimeter firewall | Partly | AWS SGs (modules/vpc) | no NGFW | M |
| 46 | NGFW IPS/IDS | Partly | Falco (EKS only) | none on standalone | M |
| 47 | VPC/subnet design | Met | modules/vpc (private_subnet_ids) | | |
| 48 | SGs per tier | Met | aws_security_group in vpc/aurora/fargate | | |
| 49 | DMZ for public services | Partly | public subnet + Pingora proxy | patient portal on same host | M |
| 50 | App→DB only | Met | aurora SG; standalone PG in docker on host | | |
| 51 | DB port not public | Met | publicly_accessible=false (aurora/main.tf:165) | | |
| 52 | PACS traffic segmented | Missing | — | no PACS | M |
| 53 | IoT outbound rules | Partly | modules/bridge-ingress | | M |
| 54 | FW rule review | Missing | — | no process | S |
| 55 | FW logging/alerts | Missing | no VPC flow logs | | S |
| 56 | HTTPS enforced | Met | PingoraProxy.toml.tmpl:2,99 (443 + certs) | | |
| 57 | TLS 1.2+ | Met | rustls (1.2/1.3 only); ssl_policy in bridge-ingress | | |
| 58 | SSL certificate | Met | Let's Encrypt via certbot | | |
| 59 | Auto renewal | Met | certbot.timer + expiry check in medbrains-host-check | | |
| 60 | Internal traffic TLS | Partly | — | app→DB/SpiceDB plaintext on host | M |
| 61 | Encryption at rest AES-256 | Partly | KMS + aurora/S3 SSE | standalone volume unproven | S |
| 62 | Key management | Met | modules/kms, aws-sdk-secretsmanager | | |
| 63 | Key rotation | Met | enable_key_rotation=true (kms/main.tf:24) | asymmetric keys manual | |
| 64 | DICOM TLS | Missing | — | | M |
| 65 | Backup encryption | Partly | bucket SSE | no client-side encrypt | S |
| 66 | WAF | Missing | no aws_wafv2 anywhere | | M |
| 67 | OWASP Top 10 | Partly | parameterised SQLx, CORS allowlist, rate limits | no WAF/CSP audit | M |
| 68 | DDoS mitigation | Partly | CloudFront for website only | app origin exposed | M |
| 69 | API rate limiting | Met | server-core/middleware/rate_limit.rs; login limiter routes/mod.rs:79; tiered :703 | | |
| 70 | API auth + refresh | Met | Ed25519 JWT + refresh rotation (medbrains-auth/src/lib.rs:415,643) | | |
| 71 | Input validation | Met | typed serde + Zod schemas | | |
| 72 | CORS policy | Met | allowlist CORS_ORIGIN (medbrains-server/src/main.rs:413) | | |
| 73 | File upload security | Partly | presign w/ mime + expiry (medbrains-upload/src/lib.rs:54) | no AV scan, no size cap | M |
| 74 | Bot/CAPTCHA | Missing | public-booking.tsx, public-enquiry.tsx no captcha | | S |
| 75 | MFA | Met | crates/medbrains-mfa, auth MFA gate (auth/lib.rs:345), pages/mfa-enroll.tsx | | |
| 76 | Password policy | Partly | min 8 only (auth/lib.rs:1266) | no complexity/expiry/history | S |
| 77 | SSO | Met | OIDC+SAML (medbrains-identity/src/sso.rs, medbrains-sso-login) | | |
| 78 | Session mgmt | Partly | max 5 sessions + device fingerprint (auth/lib.rs:428) | no idle timeout in web | S |
| 79 | VPN remote access | Met | deploy/headscale, crates/medbrains-vpn | | |
| 80 | MDM | N/A | hospital procurement | | |
| 81 | USB restriction | N/A | endpoint policy | | |
| 82 | No local cache | Partly | web SPA thin client | native apps cache offline by design | |
| 83 | Endpoint AV/EDR | N/A | endpoint policy | | |
| 84 | APM | Partly | Prom/Grafana/Tempo (modules/observability) | EKS-only | M |
| 85 | Server CPU/RAM/disk alerts | Partly | medbrains-host-check (disk/backup/cert) | no CPU/RAM | S |
| 86 | DB monitoring | Partly | patroni dashboard | standalone none | M |
| 87 | Error tracking | Partly | AppErrorBoundary crash report | no Sentry/spike alert | M |
| 88 | Uptime synthetic | Met | modules/uptime-route53 | | |
| 89 | Health endpoints | Met | medbrains-server/src/routes/health.rs, tests/health_test.rs | | |
| 90 | IT health dashboard | Partly | Grafana dashboards (EKS) | none on standalone | M |
| 91 | Alert channels | Partly | SNS via medbrains-alert@.service | no SMS/PagerDuty | S |
| 92 | Log aggregation | Partly | Loki/CloudWatch (observability/logs.tf) | standalone journald | M |
| 93 | Capacity alerts | Partly | host-check disk threshold | no growth trend | S |
| 94 | ISO 27001 | Missing | docs/CERTIFICATION-READINESS.md:21 (engagement pending) | | L |
| 95 | SOC 2 Type II | Missing | — | | L |
| 96 | HIPAA capability | Partly | RLS, audit hash chain, KMS | no BAA/process | M |
| 97 | DPDP built in | Partly | dpdp_consents table, read-access logging (0300_patient.sql:1126) | consent table no writer, no erasure | M |
| 98 | VAPT conducted | Missing | — | | M |
| 99 | VAPT frequency | Missing | — | | S |
| 100 | 3rd-party code audit | Partly | cargo-deny (deny.toml), internal AI scans | no external audit | M |
| 101 | OWASP ASVS level | Missing | — | | M |
| 102 | Incident response plan | Partly | ../SECURITY.md | no IR runbook | S |
| 103 | Breach notification (CERT-In 6h) | Missing | CERTIFICATION-READINESS.md:185 "not built" | | M |
| 104 | Responsible disclosure | Met | ../SECURITY.md (3-day ack) | | |
| 105 | Security patch SLA | Partly | SECURITY.md 7-day assessment | no patch SLA | S |
| 106 | India data residency | Partly | envs/clients/alagappa/main.tf:59 region us-east-1 | client tenant outside India | M |
| 107 | Sub-processor list | Missing | — | | S |
| 108 | Uptime SLA | Missing | — | | S |
| 109 | Maintenance window | Missing | — | | S |
| 110 | Zero-downtime deploy | Partly | helm rolling (EKS) | standalone restart | M |
| 111 | Failover | Partly | patroni IaC | not live | L |
| 112 | Load balancing | Partly | medbrains-proxy (Pingora), ALB in IaC | single backend | M |
| 113 | DB auto-failover | Partly | Patroni/Aurora IaC | not live | L |
| 114 | Performance SLA | Partly | e2e/smoke/latency-report.jsonl | no SLA targets | S |
| 115 | Concurrent users tested | Partly | crates/medbrains-loadtest | no 300-user result | M |
| 116 | Load test report | Missing | — | | M |
| 117 | Graceful degradation | Partly | tiered rate limit, 15s timeout (main.rs:608) | | M |

### 34. TV Display, Queue Token System & Digital Signage
| # | Criterion (short) | Status | Evidence | Gap | Fix |
|---|---|---|---|---|---|
| 1 | Self-service kiosk check-in | Partly | pages/kiosk/self-checkin.tsx → POST /api/public/kiosk/checkin (routes/appointments/public.rs) | appointment QR only; no UHID/phone | M |
| 2 | Kiosk token printing | Partly | token slip print (tests/token_slip_print_test.rs) | kiosk shows QR, no thermal print | M |
| 3 | Reception counter token | Met | issue_token in bookings.rs/pharmacy/opd; pages/token-console.tsx | | |
| 4 | Digital token on phone | Met | pages/queue-status.tsx (kiosk QR handle) | | |
| 5 | WhatsApp check-in | Missing | — | | L |
| 6 | Appointment-linked token | Met | kiosk checkin issues token (routes/appointments/bookings.rs) | | |
| 7 | Walk-in vs appointment | Partly | lanes (medbrains-tokens/src/queue_categories.rs) | no explicit merge rule | S |
| 8 | Priority categories | Met | queue_categories.rs; pages/token-escalate-modal.tsx | | |
| 9 | Priority rules configurable | Met | front-office/queue-config-tab.tsx upsertQueuePriorityRule; Queues/QueueLanesDrawer.tsx | | |
| 10 | Re-issue missed token | Met | /api/tokens/{id}/requeue; front-office/came-back-panel.tsx | | |
| 11 | Multi-department single token | Partly | station_flow.rs (camp only), transfer.rs | not for hospital OPD→lab→pharmacy | M |
| 12 | Waiting-area TV per dept | Partly | pages/token-display.tsx + components/TokenBoardLive.tsx | browser only; no native Compose-for-TV app (apps/android has no tv module) | L |
| 13 | Name display configurable | Met | queues.board_shows initials (medbrains-tokens/src/board.rs:34-50); tv show_patient_name | | |
| 14 | Colour-coded status | Partly | TokenBoardLive status rendering | green/yellow/white scheme not confirmed | S |
| 15 | Auto-scroll | Partly | tv_displays.scroll_speed (medbrains-tv/src/lib.rs:62) | renderer not proven | S |
| 16 | Multi-doctor split screen | Partly | doctors_per_screen field | layout not built | M |
| 17 | Dept-wise TV assignment | Met | tv_displays CRUD + pages/tv-displays/displays-tab.tsx; ?module=&scope_id= | | |
| 18 | Single-doctor mode | Met | doctor_room display_type | | |
| 19 | Avg wait per doctor/dept | Met | front-office/board-wait-estimate.tsx, /api/tokens/service-times | | |
| 20 | Waiting count | Met | board metrics, queue-dashboard-tab.tsx | | |
| 21 | Missed-token on-screen notice | Partly | no_show status | no "report to counter" banner | S |
| 22 | Announcements/ticker | Partly | broadcast_announcement + tv-displays/announcements-tab.tsx | no scrolling ticker | S |
| 23 | Multi-language display | Partly | voice_languages (TokenBoardLive.tsx:184), i18n | bilingual text not simultaneous | S |
| 24 | Room-door display | Partly | doctor_room type | no tablet app | M |
| 25 | Current token "Please enter" | Partly | board view | not room-specific | S |
| 26 | Next 2-3 tokens | Partly | board list | | S |
| 27 | Call next/recall/skip/hold/transfer | Met | token-console.tsx call-next, call, no-show, requeue; Queues/TransferVisitModal.tsx | hold missing | |
| 28 | Audio announcement configurable | Met | lib/board-voice.ts speechSynthesis, per-queue languages/repeat | voice gender not set | |
| 29 | Plays on speakers + TV | Partly | browser audio on board device | no PA integration | M |
| 30 | Repeat announcement | Partly | repeat count + re-call | no timed auto-repeat | S |
| 31 | Out-of-sequence call | Met | POST /api/tokens/{id}/call | | |
| 32 | Doctor on break indicator | Missing | — | | S |
| 33 | Doctor running late notice | Missing | — | | S |
| 34 | Lab collection queue display | Partly | /api/tv/queue/lab is a placeholder (medbrains-tv/src/lib.rs:1534-1551) | stub returns empty | M |
| 35 | Lab token on order/arrival | Partly | generic module tokens | not auto from lab order | M |
| 36 | Lab display fields | Partly | stub | | M |
| 37 | Lab priority (fasting/paeds) | Missing | — | | S |
| 38 | Phlebotomy counter distribution | Partly | medbrains-tokens/src/counters.rs | no auto-distribute | M |
| 39 | Collection ack updates queue | Partly | LabSampleCollected event | not wired to token | S |
| 40 | Lab ETA | Partly | stub avg 0 | | S |
| 41 | Lab report-ready SMS/app | Partly | LabResultVerified event | no patient notification pipeline | M |
| 42 | Pharmacy queue display | Met | get_pharmacy_queue (medbrains-tv/src/lib.rs:1327) real query; front-office/token-boards-tab.tsx | | |
| 43 | Pharmacy token from e-Rx | Partly | issue_token in medbrains-pharmacy | trigger not confirmed | S |
| 44 | Preparing/Ready/Dispensed | Partly | pharmacy board | status set partial | S |
| 45 | Pharmacy audio call | Partly | generic token_called voice | | S |
| 46 | Est prep time | Missing | — | | M |
| 47 | IP vs OP pharmacy queues | Partly | multi-pharmacy stores | not separate boards | S |
| 48 | Night pharmacy display | Partly | queue sessions (sessions.rs) | | S |
| 49 | Radiology queue display | Partly | /api/tv/queue/radiology/{modality} placeholder (lib.rs:1556) | stub | M |
| 50 | Per-modality queue | Partly | stub | | M |
| 51 | Radiology status fields | Partly | stub | | M |
| 52 | Prep instructions on display | Missing | — | | S |
| 53 | Wait per modality | Missing | avg_scan_minutes hard 0 | | S |
| 54 | Radiology report-ready notify | Partly | RadiologyReportVerified event | no patient pipeline | M |
| 55 | ER triage display | Met | get_er_queue real query (lib.rs:1579-1596), Emergency board in token-boards-tab | | |
| 56 | Triage colour coding | Met | triage_level (lib.rs:1212) | | |
| 57 | No names on ER display | Met | protected_display_show_patient_name forces off (lib.rs:167, test :190) | | |
| 58 | Wait per triage category | Partly | ER board | no per-category stat | S |
| 59 | Auto-escalate red/orange overdue | Partly | manual escalate modal | no threshold alert | M |
| 60 | Resus bay status (staff) | Partly | ER module | no staff board | S |
| 61 | Bed waiting list display | Partly | bed_waiting_entry (lib.rs:174) | no web caller | M |
| 62 | Waiting list fields | Partly | same | | S |
| 63 | Admission priority order | Partly | same | | S |
| 64 | Bed-available auto-notify | Missing | — | | M |
| 65 | Bed occupancy TV | Partly | /api/tv/queue/beds/{ward} (getBedAvailabilityDisplay unused on web); IPD bed board | no TV view | M |
| 66 | Bed availability ward/floor/gender | Partly | IPD bed board | | S |
| 67 | Billing queue display | Met | get_billing_queue real query (lib.rs:1747); token-boards-tab | | |
| 68 | Billing/discharge token | Partly | billing board | not auto at discharge | S |
| 69 | Billing display fields | Met | BillingQueueToken | | |
| 70 | Separate billing queues | Partly | OPD billing rows | no deposit/insurance lanes | S |
| 71 | Billing audio call | Partly | generic voice | | S |
| 72 | Billing ETA | Partly | | | S |
| 73 | Central queue dashboard | Met | front-office/queue-dashboard-tab.tsx, queue-metrics-tab.tsx | | |
| 74 | Flow heatmap | Partly | front-office/patient-flow-hub.tsx | no heatmap | M |
| 75 | Wait trend by hour/day | Partly | /api/tv/queue/analytics/{dept} (lib.rs:2026) | no screen calls it | S |
| 76 | Peak hour | Partly | peak_hour in analytics (lib.rs:2081) | no screen | S |
| 77 | Bottleneck detection | Partly | metrics tab | no ranking | S |
| 78 | Throughput/hour | Partly | analytics endpoint | no screen | S |
| 79 | Abandonment tracking | Partly | no_shows count (lib.rs:2052) | no screen | S |
| 80 | SLA % seen within target | Missing | — | | S |
| 81 | Queue performance reports | Partly | metrics tab | no daily/weekly report | S |
| 82 | Load-balancing suggestion | Missing | — | | M |
| 83 | Screen size recommendation | N/A | hardware guidance | | |
| 84 | Resolution support | N/A | browser renders any | | |
| 85 | Display connection | Partly | browser URL on any box | native Android TV app not built | L |
| 86 | Dedicated device vs smart TV app | Partly | web only | no TV app | L |
| 87 | Wired vs WiFi | N/A | site network | | |
| 88 | UPS for displays | N/A | site power | | |
| 89 | Remote display management | Partly | tv_displays config central (displays-tab.tsx) | no push/restart/heartbeat | M |
| 90 | Auto-recovery after power loss | Partly | board polls + WS reconnect | no autostart app | M |
| 91 | Audio system | N/A | site hardware | | |
| 92 | Speaker zoning | Partly | voice plays only on that board | | |
| 93 | Auto-dim day/night | Missing | — | | S |
| 94 | Hospital info display | Missing | — | | M |
| 95 | Doctor availability board | Missing | — | | M |
| 96 | OT schedule display | Missing | — | | M |
| 97 | Wayfinding | Missing | — | | M |
| 98 | Health content rotation | Missing | — | | M |
| 99 | Emergency codes on all displays | Met | broadcast_announcement (/api/tv/announcements) + emergency banner and voice (TokenBoardLive.tsx:18-35,97) | | |
| 100 | Accreditation display | Missing | — | | S |
| 101 | Scheduled content | Missing | — | | M |
| 102 | Signage CMS | Partly | 0100_cms.sql (website CMS) | not for displays | M |
| 103 | Multi-zone layout | Missing | — | | M |
| 104 | SMS on issue (position/ETA) | Partly | only on call | no issue-time SMS | S |
| 105 | SMS 3 tokens before turn | Missing | — | | S |
| 106 | SMS when called | Met | sms.token_called queued on every token call (all queues), DLT template_scope + variables, tenant opt-in token_call_sms, SMS withdrawal honoured; template status + refusals on Settings → Tokens (medbrains-workflow/src/orchestration/token_call_sms.rs) | | |
| 107 | WhatsApp queue notify | Partly | WhatsApp used for discharge/payment | not queue | S |
| 108 | App push for queue | Partly | queue-status web page | no native push | M |
| 109 | Check position from phone | Met | pages/queue-status.tsx | | |
| 110 | Delay updates | Missing | — | | S |
| 111 | Lab ready notification | Partly | event only | | M |
| 112 | Pharmacy ready notification | Partly | PharmacyOrderDispensed event | no patient SMS | S |
| 113 | Kiosk hardware specs | N/A | hardware guidance | | |
| 114 | Kiosk large UI, multi-language | Partly | big targets (self-checkin.tsx:9-13) | no language switch | S |
| 115 | Kiosk wheelchair height | N/A | hardware | | |
| 116 | Kiosk functions (pay/book/reports) | Partly | check-in only | no booking/payment/report | L |
| 117 | Kiosk uptime monitoring | Missing | — | | M |
| 118 | Kiosk usage analytics | Missing | — | | S |
| 119 | Kiosk count recommendation | N/A | hardware guidance | | |
| 120 | Vendor-agnostic kiosk | Met | browser + HID wedge scanner (self-checkin.tsx:11-13) | | |



---

# 4. DPDP Act 2023 + DPDP Rules 2025

Commencement (Rule 1): Rules 1, 2, 17-21 in force on notification (13/14 Nov 2025); Rule 4 (Consent Managers) after 1 year (~Nov 2026); Rules 3, 5-16, 22-23 after 18 months (~13 May 2027). So most fiduciary duties bite **May 2027**. Hospitals using MedBrains are the Data Fiduciaries; MedBrains (SaaS/hosted) is their Data Processor. Some duties (published notice, DPO, Board filing) are organisational, but the software has to provide the means.

### Sources
- MeitY Rules summary (Mondaq): https://www.mondaq.com/india/data-protection/1708164/digital-personal-data-protection-rules-2025-notified (Rule 3 notice, Rule 4 CM 7-yr records, Rule 6 safeguards + 1-yr log retention, Rule 7 breach, Rule 8 erasure + 48h notice, Rule 13 SDF, Rule 15 transfers, processor contracts, commencement)
- Rule text, Rule 7: https://dpdpa.com/dpdparules/rule7.html (DP intimation without delay, contents (a)-(e); Board initial without delay + detailed report within 72h)
- Rule text, Rule 10 + rule index: https://dpdpa.com/dpdparules/rule10.html (verifiable parental consent; Rule 11 PwD lawful guardian)
- Rule text, Rule 12 / Fourth Schedule: https://dpdpa.com/dpdparules/rule12.html (clinical/mental-health establishments and healthcare professionals exempt from s.9(1)/(3), but only while processing is restricted to health services for the child)
- Rule text, Rule 14: https://dpdpa.com/dpdparules/rule14.html (publish means for requests + identifiers, grievance response ≤ 90 days, nominee)
- Commencement + Fourth Schedule commentary: https://www.scconline.com/blog/post/2025/11/14/meity-notified-digital-personal-data-protection-rules-2025/
- Breach summaries: https://www.matters.ai/article/dpdp-breach-notification ; https://www.scrut.io/post/dpdp-rules
- Tranche dates: https://amlegals.com/dpdp-rules-notified-immediate-actions/

Caveat: the verbatim Gazette was not fetched; the 2026 consent-manager tranche date and Fourth Schedule wording come from secondary sources.

### 1. DPDP Act 2023 + Rules 2025

| # | Criterion (with Act/Rule section) | Status | Evidence | Gap | Fix |
|---|---|---|---|---|---|
| 1 | Notice before/at consent: itemised data, purposes, withdrawal/rights/DPB links (s.5, Rule 3) | Partly | `apps/web/src/pages/legal.tsx:66-117` generic privacy template; `mkt_consents.notice_version` (0996) | Static template with a "finalize with counsel" banner; no itemised notice at patient registration (`PatientRegisterForm.tsx` has none); no version stored per patient | M |
| 2 | Notice in English + Eighth Schedule languages (s.5(3)) | Missing | locales `apps/web/public/locales/{en,hi,ta,ar}`; legal.tsx strings hardcoded EN | Notice not i18n'd; only hi/ta exist anyway | M |
| 3 | Consent record: free, specific, purpose-tagged, provable (s.6) — patient data-sharing/ABDM/research | Partly | `patient_consents` (enum `consent_type` incl. data_sharing, abdm_linking, research; writer `medbrains-patients/src/lib.rs:3088`); `createPatientConsent` in client.ts:4027 | No web/native screen calls `createPatientConsent`; `dpdp_consents` (0040_auth.sql:264) has no writer at all (comment `print-data/src/consent.rs:1099`) | M |
| 4 | Consent record for marketing/communications (s.6, s.7 basis) | Met | `mkt_consents` (0996: purpose, legal_basis, notice_version, evidence_ref, append-only grant/withdraw), writer `medbrains-marketing/src/consent.rs:388`, screen `pages/marketing/consent-panel.tsx`; `patient_contact_consents` (1019) writer `patients/src/contact_consent.rs:74`, `ContactConsentCard.tsx` | — | |
| 5 | Withdrawal as easy as giving (s.6(4)) | Partly | Staff revoke: `consent/src/lib.rs:603` → `consent_status='withdrawn'`, screen `pages/consent/verification-tab.tsx:46`; marketing withdraw in consent-panel | Patient cannot withdraw themselves: web portal has no consent screen; iOS `PatientHomeView.swift:74-76` "Revoke a consent" is an unwired placeholder tile | M |
| 6 | Legitimate uses without consent recorded (s.7 — medical emergency, care) | Partly | `mkt_consents.legal_basis` ∈ s7_medical_emergency/s7_care_delivery | Only in marketing; clinical processing has no recorded lawful basis | S |
| 7 | Purpose limitation: data tagged with purpose/class and reused only for that purpose (s.4, s.6) | Partly | DataClass + `make check-field-classes`; marketing "clinical wall" CHECK (0996) | No purpose recorded on clinical access/export; print/share endpoints don't record a purpose | M |
| 8 | Data minimisation in lists/exports (s.6(1) "necessary") | Partly | Aadhaar stored masked/last4 (`patients/src/lib.rs:745-800`); slim list DTOs; `check-unbounded-reads` | No systematic per-role field masking on lists; print-data endpoints return full PHI | M |
| 9 | Right of access: summary of data + processing + sharing (s.11) | Partly | Portal read-only `/portal/{appointments,bills,lab-reports,prescriptions}` (`pages/portal/*`) | No "my data" summary, no list of processors/recipients shared with, no export | M |
| 10 | Data export/portability for own records | Missing | iOS "Export my data" tile is a placeholder (`PatientHomeView.swift:76`); no `/portal/export` route | No export endpoint or screen | M |
| 11 | Right to correction/completion/updating (s.12(1-2)) | Missing | no `correction_request` / amendment table (grep 0 hits outside lab/trials) | Patient cannot request a correction; no clinician review/amend workflow with audit | M |
| 12 | Right to erasure, balanced with medical-record retention law (s.12(3), s.8(7)) | Partly | Soft-delete guardrail trigger on ~711 tables; MRD `mrd_retention_policies` + `RetentionTab.tsx`; `server/src/services/retention.rs` flags MRD for human destruction | No erasure-request intake, no "legal hold / retention reason" reply to patient; soft-deleted rows retained indefinitely (not real erasure) | M |
| 13 | Erase when purpose ends / consent withdrawn; 48h prior notice to DP (s.8(7), Rule 8(2), Third Schedule) | Missing | retention.rs purges only tokens/OTPs/outbox; MRD destruction is manual | No patient-facing pre-erasure notice; non-clinical personal data (marketing contacts, enquiries, camp data) has no purpose-end erasure job | M |
| 14 | Grievance redressal published; respond ≤ 90 days (s.13, Rule 14(3)) | Partly | `comm_complaints` with SLA (`0270_notifications.sql:136`), writer `communications/src/lib.rs:799`, screen `pages/communications/complaints-tab.tsx` | No "privacy/DPDP" category or 90-day SLA; patients can't file from portal; no DP-facing status | S |
| 15 | DPO/contact person published + contact in notices/breach messages (s.8(9), Rule 9) | Missing | legal.tsx says "contact the Grievance Officer" with no name/email; grep `dpo|grievance_officer` = 0 settings | No tenant setting for DPO/grievance officer contact, nothing to render it | S |
| 16 | Nominee for rights on death/incapacity (s.14, Rule 14(4)) | Missing | grep `nominee` = 0; iOS "familyShare" placeholder | No nominee registration or exercise flow | M |
| 17 | Means and identifiers to exercise rights published (Rule 14(1)) | Missing | portal OTP login exists (`/portal/auth/*`) | No rights-request entry point (access/correct/erase/nominate) on portal or app | M |
| 18 | Children: verifiable parental consent; no tracking/targeted ads (s.9, Rule 10) | Partly | Guardian name/relation optional on registration (`PatientRegisterForm.tsx:1721`); `procedure_consents.guardian_*` (0300:148) | No age-derived minor flag forcing guardian identity/consent; marketing (`medbrains-marketing`) has no minor exclusion, and the Rule 12 health exemption does not cover marketing | M |
| 19 | Healthcare exemption scope recorded (Rule 12, Fourth Schedule) | Partly | Clinical processing of minors happens under the care purpose | No guard keeping minors' data out of non-health purposes (marketing, campaigns, research exports) | S |
| 20 | Persons with disability: lawful guardian consent, guardian verified (s.9, Rule 11) | Partly | patient contacts `is_legal_guardian` (0300_patient.sql:691) | No disability/incapacity flag, no record of guardianship proof (court/RPwD Act), no consent routing to the guardian | M |
| 21 | Security safeguards: encryption at rest, masking/tokenisation (s.8(5), Rule 6(1)(a)) | Partly | Aurora `storage_encrypted=true` + KMS (`infra/terraform/modules/aurora/main.tf:139`); `make check-encryption-at-rest`; AEAD for OAuth tokens (0040_auth.sql:413); Aadhaar masked | No field-level encryption of high-sensitivity PHI (HIV, psychiatry, MTP/PCPNDT); `medbrains-crypto` is for NHCX/ABDM transport only | M |
| 22 | Access control + access logging/monitoring (Rule 6(1)(b-c)) | Partly | RLS + SpiceDB ReBAC (`authz-gate`); `audit_log` hash-chained (0030_audit.sql:114); read log `patient_record_access_log` writer `patients/src/lib.rs:4288`, `mrd/src/access.rs:67`; `PatientAccessLogSection.tsx` | Read logging is opt-in per endpoint, not every PHI read (`check-phi-audit-coverage` exists, coverage unproven); no anomaly alerting | M |
| 23 | Logs + personal data retained ≥ 1 year (Rule 6(1)(e)) | Partly | `audit_log` monthly partitions, soft-delete guardrail, no retention row found → kept indefinitely | CloudWatch app logs default **30 days** (`observability/main.tf:66-70`), Fargate 30d (`aws-fargate/main.tf:236`), EKS 90d — below the 1-year floor unless the Firehose archive is proven | S |
| 24 | Backups / continuity (Rule 6(1)(d)) | Partly | Aurora + backup scripts per deploy docs | Restore drill and backup encryption not evidenced in-repo for standalone/bare-metal | S |
| 25 | Breach register + DP intimation without delay (s.8(6), Rule 7(1)) | Partly | `security_incidents` (0160_facilities.sql:2034) with CERT-In fields; screen `pages/security/incidents-tab.tsx`; writer `medbrains-security/src/lib.rs:757` | Register is physical-security oriented; no "personal data breach" type, affected-patient list, or bulk patient notification with the Rule 7(1)(a-e) contents | M |
| 26 | Board intimation: initial without delay + detailed report ≤ 72h (Rule 7(2)) | Missing | No DPB fields/timer; `medbrains-it-security/src/lib.rs:1685` INSERTs columns (`title, incident_type, detected_at, affected_data_types…`) that are not in `security_incidents` → that cyber-incident path fails at runtime | No 72h clock, report template, or submission log; the broken IT-security incident insert has to be fixed | M |
| 27 | Processor contracts/register; fiduciary responsible for processors (s.8(1-2), Rule 6(1)(f)) | Missing | legal.tsx §4 prose only; grep `data_processor|subprocessor|dpa` = 0 | No register of processors (SMS/WhatsApp, payment, LLM, labs, cloud) with DPA status and data categories | S |
| 28 | Cross-border transfer controls (s.16, Rule 15) | Partly | AWS ap-south-1 pinning + `make check-region-pinning`, `check-egress-allowlist`; LLM sends a "de-identified" snapshot (`medbrains-ai/src/lib.rs:94-112`); `BoundaryFilter` fail-closed (`core/src/boundary_filter.rs`) | Default LLM is Anthropic (US) via `server-services/src/llm.rs:20`; free-text redactor "later phase", so clinician chat text can carry PHI abroad; 2 us-east-1 refs in terraform; no transfer log | M |
| 29 | Consent Manager / ABDM consent artefacts (s.6(7-9), Rule 4, from ~Nov 2026) | Missing | `outbox/src/handlers/abdm_stub.rs` pushes HIE bundles; no consent-request/notify/artefact handling (grep 0) | HIE push is not bound to a validated ABDM CM consent artefact (purpose, date range, expiry); no DPDP CM integration | L |
| 30 | Break-the-glass with justification + retrospective review | Met | `break_glass_events` (0040_auth.sql), writer `medbrains-it-security/src/lib.rs:270`, screen `pages/audit/BreakGlassReviewTab.tsx` | — | |
| 31 | Patient visibility of who accessed their record (transparency, s.11) | Partly | `GET /api/patients/{id}/access-log` (`patients/src/lib.rs:4423`) shown to staff in `PatientAccessLogSection.tsx` | Not exposed in portal/iOS ("Access audit" tile is a placeholder) | S |
| 32 | SDF duties if notified: DPIA + annual independent audit, algorithmic due diligence, India-based DPO, localisation (s.10, Rule 13) | Missing | none (grep `dpia|impact_assessment` = 0); AI copilot has no model-risk register | No DPIA/audit artefacts, no algorithm due-diligence record for AI features (relevant for large chains/platform) | M |



---

# 5. ABDM (ABHA / HIP / HIU / HFR / HPR / FHIR / NHCX)

### Sources
- NRCeS FHIR IG for ABDM, profiles: https://www.nrces.in/ndhm/fhir/r4/profiles.html ; artifacts: https://nrces.in/ndhm/fhir/r4/3.0.0/artifacts.html ; examples: https://nrces.in/ndhm/fhir/r4/all-examples.html
- NHCX ClaimBundle / HCX profile: https://nrces.in/ndhm/fhir/r4/hcx-profile.html , https://nrces.in/ndhm/fhir/r4/StructureDefinition-ClaimBundle.html
- ABHA v3 enrolment flow (session → public cert → Aadhaar OTP → enrol → ABHA address): https://devforum.abdm.gov.in/t/apis-flow-for-create-abha-address-and-attach-to-abha-number/8708 , https://devforum.abdm.gov.in/t/creation-of-abha-number-using-aadhaar-otp/8276 , https://pypi.org/project/abha/1.0.0/
- ABHA via Aadhaar or Driving Licence (state portal): https://health.uk.gov.in/?p=7931
- HIU data push, keyMaterial ECDH/Curve25519, Fidelius: https://devforum.abdm.gov.in/t/fetch-patient-data-for-hiu/506 , https://pub.dev/packages/abdm_fidelius , https://devforum.abdm.gov.in/t/not-receiving-encrypted-data-in-the-datapush-url/6462
- DHIS operational guidelines (HFR registration + ABDM-enabled software + ABHA-linked records; caps 1/day, 5/month per ABHA): https://abdm.gov.in:8081/uploads/Operational_Guidelines_DHIS_0500f58100.pdf , https://abdm.gov.in:8081/uploads/DHIS_Webinar_PPT_bf6e011fd2_5b1e99a795.pdf
- Certification path (sandbox → milestones M1/M2/M3 → functional test by NHA-empanelled agency → WASA by CERT-In-empanelled auditor → Safe-to-Host → prod keys); "two milestones to exit sandbox" (vendor blogs citing the ABDM forum; secondary, not official): https://nirmitee.io/blog/abdm-certification-process-sandbox-to-production-guide/ , https://nirmitee.io/blog/abdm-m1-only-certificate-minimum-two-milestones-rule/ , https://qualysec.com/abdm-integration-checklist/ , https://www.getastra.com/blog/compliance/abha-web-application-security-certificate

Note: the official sandbox docs (sandbox.abdm.gov.in) need a login and could not be fetched. Milestone boundaries and the driving-licence v3 endpoint come from forum and vendor sources.

### ABDM / NHCX

| # | Criterion | Status | Evidence | Gap | Fix |
|---|---|---|---|---|---|
| 1 | ABDM client: real HTTP to gateway (not a stub) | Partly | `crates/medbrains-abdm/src/abha.rs:5-12` reqwest client on `abhasbx.abdm.gov.in` / `dev.abdm.gov.in/api/hiecm/gateway/v3/sessions` | Only covers session, cert and profile-login; HIE in `outbox/handlers/abdm_stub.rs` is a stub | M |
| 2 | Uses the v3 APIs | Partly | `/v3/profile/login/*`, gateway `v3/sessions` | v3 is only used for login; the enrolment, HIP and HIU v3 APIs are missing | M |
| 3 | Sandbox/production configuration | Partly | `routes/abdm/abha.rs:180-230` reads `tenant_settings abdm.abha_config` or `ABDM_CLIENT_ID/SECRET` env | The request body chooses `environment` (`abha.rs:156`), so a client can pick production; the ABDM access token also comes from the body | S |
| 4 | Create ABHA via Aadhaar OTP (M1) | Missing | No `/v3/enrollment/*` path in `medbrains-abdm` | No enrolment flow and no screen | L |
| 5 | Create ABHA via mobile / driving licence | Missing | — | Not implemented | M |
| 6 | Create or select an ABHA address (PHR address) | Missing | Only a free-text `abha_address` field (`PatientRegisterForm.tsx:575`) | No call to the address suggest or set APIs | M |
| 7 | Verify an existing ABHA (OTP login) | Partly | Routes `/api/abdm/abha/login/request-otp`, `/verify` (`routes/mod.rs:354-358`) and client methods `requestAbhaLoginOtp`/`verifyAbhaLoginOtp` | No web screen calls them; the verified profile is not saved to the patient | M |
| 8 | Link an ABHA to the patient record | Partly | `patient_abha_links` INSERT at `medbrains-patients/src/lib.rs:966`, written from registration | Typed by hand with `kyc_verified=false`; no linking token is ever set | M |
| 9 | Validate the ABHA number | Partly | `normalize_abha_number` (`patients/lib.rs:750`) checks for 14 digits | No check-digit and no ABDM existence check | S |
| 10 | ABHA card / QR display and download | Missing | — | No profile card or QR fetch | S |
| 11 | Scan & Share (facility QR, profile share, token) | Missing | No `hip/profile/share` handler | Whole OPD-desk flow missing | M |
| 12 | Care-context model (visit to ABHA link) | Missing | No `care_context` table in the migrations | No entity at all | M |
| 13 | HIP-initiated care-context linking (link token, `link/carecontext`) | Missing | — | No linking after a visit or discharge | L |
| 14 | User-initiated discovery (`on-discover`) | Missing | Callbacks are stored as raw JSON only (`hip_relay.rs:63`) | Nothing reads or answers them | L |
| 15 | Link init/confirm with OTP (`on-init` / `on-confirm`) | Missing | — | Not implemented | M |
| 16 | Consent notification as HIP (store the consent artefact) | Missing | No `consent_artefact` table | Consents granted by ABDM are not recorded | M |
| 17 | Health-information request, then encrypted push to the data-push URL | Missing | `abdm_stub::HieBundlePushHandler` only logs | No transfer of records | L |
| 18 | Fidelius ECDH Curve25519 + AES-GCM encryption | Missing | No x25519 crate; the word appears only in `abdm_stub.rs` comments | No E2EE | M |
| 19 | Data-flow `notify` / transfer acknowledgement | Missing | — | Not implemented | S |
| 20 | FHIR R4 core resources (Patient, Encounter, Observation, Composition) | Partly | `crates/medbrains-fhir/src/r4/*`, `mapper.rs:49-215`; `/api/fhir/Patient`, `$everything`, `Encounter`, `Composition` | No MedicationRequest, DiagnosticReport, Immunization, Condition, Practitioner or Organization resources | M |
| 21 | NRCeS document bundles: OPConsultRecord, PrescriptionRecord, DiagnosticReportRecord, DischargeSummaryRecord | Missing | No `meta.profile` for nrces.in in the fhir crates | Nothing builds a document bundle with the record type | L |
| 22 | ImmunizationRecord, HealthDocumentRecord, WellnessRecord, InvoiceRecord | Missing | — | Not built | M |
| 23 | Profile validation (NRCeS validator / IG conformance tests) | Missing | No validator or golden tests for ABDM profiles | Conformance is unproven | M |
| 24 | Terminology coding (SNOMED, LOINC, ICD-10) in bundles | Partly | `mapper.rs:22-25`; LOINC is guessed with a heuristic (`mapper.rs:217`) | Picks the system by heuristic; no SNOMED codes in clinical data | M |
| 25 | HIU: consent request (`consent-requests/init`) | Missing | — | No HIU role | L |
| 26 | HIU: fetch, decrypt and display records | Missing | — | No viewer and no decryption | L |
| 27 | Gateway callback endpoint reachable and signature-verified | Partly | `POST /api/abdm/gateway/callback` (`routes/mod.rs:362`) | Mounted in the **protected** (JWT) router, so ABDM cannot reach it. `signature.rs` checks the JWS structure only and does no cryptographic verification. Unknown tenants fall back to the `x-medbrains-tenant-id` dev header | S |
| 28 | Callback relay pull is tenant-scoped and permissioned | Missing | `list_pending_callbacks` / `ack_callback` (`hip_relay.rs:137-200`): no Claims, no `require_permission`, no `set_tenant_context`, and `tenant_id` comes from the query string | Possible cross-tenant read of health-record payloads | S |
| 29 | HFR facility registration, end to end | Partly | `abdm_hfr_registrations` INSERT (`routes/abdm/hfr.rs:79`); handler in `outbox/handlers/abdm_hfr.rs` | The route never queues `abdm.hfr.register` and the handler is not registered in `main.rs`, so rows stay `queued`. The web screen (`StandardsSettings.tsx:221-231`) only reads; nothing calls `createAbdmHfr` | M |
| 30 | Facility ID / HIP ID / HCX sender code stored per tenant | Partly | `tenants.abdm_facility_id`, `abdm_hcx_sender_code`, `abdm_facility_active` (`0110_core.sql:1185`) | No code or screen ever writes them | S |
| 31 | HPR: professional ID on doctors, signer identity in bundles | Missing | No hpr column or code anywhere | Practitioner identity cannot be asserted | M |
| 32 | HPR/HFR bridge registration (software bridge / HIP service registration) | Missing | — | Not implemented | M |
| 33 | ABDM data-sharing consent captured from the patient | Partly | Print template `/api/print-data/consent/abdm/{patient_id}` (`print-data/consent.rs:1062`) | Paper form only; not tied to consent artefacts | S |
| 34 | NHCX ClaimBundle (Claim/Coverage, profile + security tag) | Partly | `facilities/src/nhcx_submit.rs:120-230` builds a `collection` bundle with `meta.profile`; screen `SubmitToNhcxModal` in `billing/insurance-claims.tsx:32` | Bundle is built and queued but never sent (see #35) | S |
| 35 | NHCX outbound submit (JWE/JWS, gateway POST) | Missing | `outbox/handlers/nhcx.rs` `ClaimSubmitHandler` is not registered in `main.rs` (only `tpa_stub` is), so `abdm.nhcx.claim_submit` falls to `pipeline_fallback`; the handler also posts plain JSON with no JWE | Claims never reach NHCX | M |
| 36 | NHCX callback receiver (JWE decrypt, JWS verify) | Partly | Public `/api/integrations/nhcx/callback` (`nhcx-callback/src/lib.rs:62-141`); history in the claim drawer (`insurance-claims.tsx:114`) | Upstream submit is dead, so nothing correlates | S |
| 37 | NHCX participant onboarding / payer directory | Partly | `nhcx_participants` table and screen `NhcxPayerDirectory`; `medbrains-nhcx-onboarding` crate | The onboarding crate has no routes mounted (`routes/nhcx_onboarding.rs` has no `.route`) | S |
| 38 | Sandbox exposure, M1/M2/M3 functional testing, WASA (CERT-In) audit, Safe-to-Host, prod keys | Missing | `docs/CERTIFICATIONS.md:100-103` says M1 is partway and M2/M3 are not started | The vendor process has not started. M1 alone cannot exit the sandbox (forum rule) | L |
| 39 | DHIS readiness (count ABHA-linked records per facility, within the caps) | Missing | — | Depends on care-context linking (#12-13) | M |


