<div align="center">

<img src=".github/readme/banner.svg" alt="MedBrains — software that runs a whole hospital. Free, forever. Made with love for patients, hospitals and well-made software." width="100%">

[![Free forever](https://img.shields.io/badge/💚_Free-forever-24A148?style=for-the-badge)](#why-is-it-free)
[![For every patient](https://img.shields.io/badge/❤️_For-every_patient-DA1E28?style=for-the-badge)](#why-is-it-free)
[![For every hospital](https://img.shields.io/badge/🏥_For-every_hospital-0F62FE?style=for-the-badge)](#who-its-for)
[![Batteries included](https://img.shields.io/badge/🔋_Batteries-included-851B7F?style=for-the-badge)](#medbrains-os-a-hospital-in-a-box)
[![Made with love](https://img.shields.io/badge/✨_Made_with-love-8A3FFC?style=for-the-badge)](#credits-and-contact)
[![Website: medbrains.in](https://img.shields.io/badge/🌐_Website-medbrains.in-0F62FE?style=for-the-badge)](https://www.medbrains.in)

# MedBrains

**Software that runs a whole hospital: registration, OPD, wards, pharmacy, lab, radiology, billing.**

**It is free. No licence fee, no per-user fee, ever.**

**Batteries included:** the hospital software, its own operating system, built-in security, control of every machine, and compliance with each country's health rules. One install, nothing else to buy.

*Every patient deserves safe care, and every hospital, big or small, rich or poor, deserves the tools to give it. Built with love for patients, for hospitals, and for well-made software, so cost never stands between them.*

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-0F62FE.svg)](./LICENSE)
[![CI](https://github.com/medbrains/medbrains/actions/workflows/ci.yml/badge.svg)](https://github.com/medbrains/medbrains/actions/workflows/ci.yml)
[![Quality gate](https://sonarcloud.io/api/project_badges/quality_gate?project=medbrains_medbrains)](https://sonarcloud.io/summary/new_code?id=medbrains_medbrains)
[![Error tracking: Sentry](https://img.shields.io/badge/Error_tracking-Sentry-362D59?logo=sentry&logoColor=white)](./medbrains/deploy/standalone/README.md#optional-error-tracking-rustrak)
[![Security scans](https://github.com/medbrains/medbrains/actions/workflows/security.yml/badge.svg)](https://github.com/medbrains/medbrains/actions/workflows/security.yml)
[![Security policy](https://img.shields.io/badge/Security-policy-0F62FE.svg)](./SECURITY.md)
[![Latest release](https://img.shields.io/github/v/release/medbrains/medbrains?label=Release&color=851B7F)](https://github.com/medbrains/medbrains/releases/latest)
[![Rust](https://img.shields.io/badge/Rust-2024_·_1.95+-0F62FE?logo=rust&logoColor=white)](#why-rust)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-0F62FE.svg)](./CONTRIBUTING.md)

[![OS strength](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/medbrains/medbrains/main/.github/badges/readiness-os.json)](#readiness)
[![Paperless](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/medbrains/medbrains/main/.github/badges/readiness-paperless.json)](#readiness)
[![AI clinical flows](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/medbrains/medbrains/main/.github/badges/readiness-ai.json)](#readiness)

[![HIPAA readiness](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/medbrains/medbrains/main/.github/badges/readiness-hipaa.json)](#regulation-readiness)
[![GDPR readiness](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/medbrains/medbrains/main/.github/badges/readiness-gdpr.json)](#regulation-readiness)
[![DPDP readiness](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/medbrains/medbrains/main/.github/badges/readiness-dpdp.json)](#regulation-readiness)
[![ABDM readiness](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/medbrains/medbrains/main/.github/badges/readiness-abdm.json)](#regulation-readiness)
[![NABH readiness](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/medbrains/medbrains/main/.github/badges/readiness-nabh.json)](#regulation-readiness)
[![CERT-In readiness](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/medbrains/medbrains/main/.github/badges/readiness-cert-in.json)](#regulation-readiness)
[![EU CRA readiness](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/medbrains/medbrains/main/.github/badges/readiness-eu-cra.json)](#regulation-readiness)
[![EHDS readiness](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/medbrains/medbrains/main/.github/badges/readiness-ehds.json)](#regulation-readiness)
[![FHIR readiness](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/medbrains/medbrains/main/.github/badges/readiness-fhir.json)](#regulation-readiness)
[![Medical device (SaMD) controls](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/medbrains/medbrains/main/.github/badges/readiness-samd.json)](#regulation-readiness)

[Website](https://www.medbrains.in) · [Features](#features) · [Releases](#release-status) · [Quick start](#quick-start) · [MedBrains OS](#medbrains-os-a-hospital-in-a-box) · [Roadmap](#roadmap) · [Sponsor](#sponsor-the-work) · [Contribute](#contributing)

</div>

<!-- TODO: add screenshot — main dashboard (docs/screenshots/dashboard.png) -->

---

## In one minute

- **For doctors and nurses:** register a patient, see the OPD queue, write notes and prescriptions, admit to a ward, give medicines with barcode checks, order labs and scans. One patient record across every department.
- **For hospital owners:** the software costs nothing to use, on as many computers, staff and branches as you like. You can run it on your own server, and your data stays yours.
- **For IT heads:** one Rust server, one PostgreSQL database, a web app, and staff apps for iPhone and Android. The code is public, so you can check every line.

## Release status

MedBrains is released. Each version is on the [Releases page](https://github.com/medbrains/medbrains/releases), and the
[Download page](https://medbrains.in/download) lists every file. Each release has:

- MedBrains OS disk images for x86-64 and arm64 (ISO, VMware, Hyper-V, KVM/Proxmox, Azure and AWS)
- the server for Linux (x86-64 and arm64) and the container image `ghcr.io/medbrains/medbrains`
- the desktop app for Windows, Mac and Linux
- the Android staff app
- signed SHA-256 checksums for checking every download

Before you put real patients on it, try it with your own sample data, and tell us what breaks.
The [readiness meters](#readiness) below show how far each part has come.

## Readiness

Measured from the checklist in [`medbrains/docs/readiness.json`](medbrains/docs/readiness.json); an item counts only when merged with evidence.
Done counts in full and partial counts half, by each item's weight. `scripts/readiness.py` writes the badges and this table, and CI refuses an item without evidence or a stale table.

<!-- readiness:start -->
| Meter | Measured | Done | Partial | Not started |
|---|---|---|---|---|
| OS strength | **45%** | 9 | 0 | 9 |
| Paperless | **38%** | 4 | 1 | 7 |
| AI clinical flows | **38%** | 4 | 0 | 7 |

<details><summary>OS strength: 45%</summary>

| Item | Weight | State | Evidence |
|---|---|---|---|
| A bootable OS image built from source, checked by tests that boot it | 2 | Done | #5211, #5219, #5315, `medbrains/os/qemu-run.sh` |
| Default-deny firewall, authenticated time and first Linux hardening | 2 | Done | #5217 |
| Data disk encrypted, with every key accounted for | 3 | Done | #5230, `medbrains/os/tests/disk-setup.sh` |
| Signed A/B updates with trial boots and rollback; tampered and rolled-back updates refused | 3 | Done | #5279, `medbrains/os/tests/make-update-bundles.py` |
| Built-in identity provider (Kanidm); the first administrator enrols an authenticator at setup | 2 | Done | #5242, #5316, #5317, `medbrains/os/tests/kanidm-attacks.py` |
| A machine joins the main machine only by approval, over encrypted links | 2 | Done | #5226, `medbrains/os/tests/two-machines.sh` |
| Memory-safe front proxy (Pingora) in place of Caddy | 1 | Done | #5234, `medbrains/os/tests/front-attacks.py` |
| Append-only, hash-chained audit log of every change and record opened | 2 | Done | #4771, `medbrains/crates/medbrains-db-migrations/src/migrations/1082_audit_append_only.sql` |
| Backups sealed to an offline key, with a restore drill that proves they restore | 2 | Done | #5066, #5132, `medbrains/deploy/standalone/medbrains-restore-drill` |
| Wipe an OS machine's data disk, restore it and verify (ransomware test) | 2 | Not started | open: medbrains/docs/architecture/OS-THREATS.md row 3 |
| Sealed, read-only system partition (dm-verity) | 3 | Not started | open: #5451 |
| Kernel, service sandbox and AppArmor hardening, scored against CIS | 3 | Not started | open: #5449, #5453 |
| Release signing keys kept offline before the update feed opens | 3 | Not started | open: #5498 |
| Secure Boot with our own key and a signed boot image | 3 | Not started | open: medbrains/docs/architecture/OS-THREATS.md H2 |
| Room to grow on the system partition (8 MB left today) | 1 | Not started | open: #5519 |
| Release shipped as an installer ISO, VM and cloud disks | 2 | Not started | open: #5525 |
| Tests passed on real hardware, not only virtual machines | 3 | Not started | - |
| External penetration test report | 3 | Not started | open: medbrains/docs/architecture/OS-THREATS.md row 10 |

</details>

<details><summary>Paperless: 38%</summary>

| Item | Weight | State | Evidence |
|---|---|---|---|
| One case sheet per visit: written, signed and filed to the medical record | 3 | Done | #4715, #4717, #4718 |
| Medical records custodian: opens every chart, each opening logged | 2 | Done | #4719 |
| Signed prints carry a QR that lets an outsider check the record is unchanged; signing needs a fresh step-up | 3 | Done | #5241 |
| A meter of how paperless the hospital is, by department and day | 1 | Done | #5269, `medbrains/crates/medbrains-analytics/src/paperless.rs`, `medbrains/crates/medbrains-db-migrations/src/migrations/1424_paperless_meter.sql` |
| Every clinical record type signable by its author (21 types); partial because signing keys still sit on the server | 3 | Partial | #5259, `medbrains/crates/medbrains-documents/src/signable.rs` |
| Each doctor signs with their own hardware key (badge or FIDO2); the server cannot sign as them | 3 | Not started | open: RFCs/modules/RFC-MODULE-paperless-records.md 4.1 |
| Legal electronic signatures (remote DSC, eSign) through providers | 3 | Not started | open: RFCs/modules/RFC-MODULE-paperless-records.md 4.2 |
| Patient e-consent with capacity, witness and separate purposes | 2 | Not started | open: RFCs/modules/RFC-MODULE-paperless-records.md 4.3 |
| One-click court certificate from the seal chain and audit log | 1 | Not started | open: RFCs/modules/RFC-MODULE-paperless-records.md 4.4 |
| Transfer to another hospital with signatures kept and checkable | 2 | Not started | open: RFCs/modules/RFC-MODULE-paperless-records.md 4.5 |
| Downtime mode: a read-only snapshot and offline entry when the server is down | 2 | Not started | - |
| Connector that runs beside another hospital system (HL7 and FHIR in) | 3 | Not started | open: RFCs/modules/RFC-MODULE-paperless-records.md 8.5 |

</details>

<details><summary>AI clinical flows: 38%</summary>

| Item | Weight | State | Evidence |
|---|---|---|---|
| Doctor records or uploads dictation; it becomes note sections and medicines, each reviewed before saving | 3 | Done | #5258, `medbrains/apps/web/src/components/Clinical/dictation/DictationPanel.test.tsx` |
| Every model call goes through one pseudonymising redaction layer | 2 | Done | #5030, `medbrains/crates/medbrains-ai/src/redaction.rs` |
| Every AI answer is labelled, and reaches a record only when a clinician accepts it (audited) | 2 | Done | #4907, #5258 |
| Dictated medicines become a prescription only through the allergy, interaction and dose checks | 2 | Done | #5258, #5244, `medbrains/apps/web/src/components/Clinical/dictation/dictated-rx-store.ts` |
| Local speech and language models shipped as an OS service on the appliance | 3 | Not started | - |
| Kernel AI interface with permissions, consent and audit on every call | 3 | Not started | open: medbrains/RFCs/RFC-HOSPITAL-OS.md 8h |
| MCP server so outside assistants work under the same permissions | 2 | Not started | open: medbrains/RFCs/RFC-HOSPITAL-OS.md 8f |
| Voice capture in the native iOS and Android apps | 2 | Not started | - |
| Speech in local languages and mixed-language dictation | 2 | Not started | - |
| Patient consent captured before a consultation is recorded | 2 | Not started | - |
| Dictation that works with no network | 1 | Not started | - |

</details>
<!-- readiness:end -->

### Regulation readiness

These meters measure how much of each regulation's requirements MedBrains implements, with evidence merged for every item; they are not certifications or legal advice, and each hospital stays responsible for its own compliance.
They are counted the same way as the meters above. A grey "not assessed" badge means we have not yet mapped that regulation to evidence, so it shows no number rather than a guess. The SaMD meter is different: it counts the controls that keep AI and decision features assistive, so a clinician always decides.

<!-- regulation:start -->
| Meter | Measured | Done | Partial | Not started |
|---|---|---|---|---|
| HIPAA readiness | **72%** | 8 | 5 | 2 |
| GDPR readiness | **67%** | 6 | 6 | 1 |
| DPDP readiness | **74%** | 6 | 5 | 1 |
| ABDM readiness | **72%** | 8 | 1 | 2 |
| NABH readiness | not assessed | - | - | - |
| CERT-In readiness | **68%** | 4 | 2 | 1 |
| EU CRA readiness | **70%** | 7 | 2 | 2 |
| EHDS readiness | not assessed | - | - | - |
| FHIR readiness | **43%** | 4 | 2 | 5 |
| Medical device (SaMD) controls | **53%** | 4 | 1 | 3 |

<details><summary>HIPAA readiness: 72%</summary>

| Item | Weight | State | Evidence |
|---|---|---|---|
| Unique user identification: one login per person, unique within the hospital (164.312(a)(2)(i)) | 2 | Done | `medbrains/crates/medbrains-db-migrations/src/migrations/0040_auth.sql` |
| Emergency access: break the glass with a reason, reviewed afterwards (164.312(a)(2)(ii)) | 2 | Done | #4772 |
| Automatic logoff after inactivity (164.312(a)(2)(iii)); today a 7-day refresh token keeps an idle session alive | 2 | Not started | - |
| Encryption at rest (164.312(a)(2)(iv)); partial because only the OS appliance encrypts its own disk, other installs rely on the host | 2 | Partial | #5230 |
| Audit controls: append-only, hash-chained log of changes, refusals and failed sign-ins (164.312(b)) | 3 | Done | #4771, `medbrains/crates/medbrains-db-migrations/src/migrations/1082_audit_append_only.sql` |
| Integrity: signed records an outsider can check are unchanged (164.312(c)) | 2 | Done | #5241 |
| Person authentication: TOTP second factor and a fresh step-up before signing (164.312(d)) | 2 | Done | `medbrains/crates/medbrains-mfa/src/lib.rs`, #5241 |
| Transmission security: TLS at the front and between database nodes (164.312(e)) | 2 | Done | #5234, #5495 |
| Minimum necessary access: role permissions plus per-patient checks; partial until every module passes the authorization ledger | 3 | Partial | `medbrains/crates/medbrains-authz-gate/src/lib.rs` |
| Contingency plan: sealed backups with a restore drill (164.308(a)(7)) | 2 | Done | #5066, #5132 |
| Patient right of access: a copy of their record, downloadable from the portal (164.524) | 1 | Done | #4779, #4773 |
| Accounting of disclosures (164.528); partial: who opened the record and which insurers received it, not every disclosure | 1 | Partial | #4773 |
| Breach notification within 60 days (164.404-410); partial: a breach register with clocks, but for the DPDP and CERT-In deadlines, not HIPAA's | 2 | Partial | #4758, `medbrains/crates/medbrains-security/src/breach.rs` |
| Security risk analysis (164.308(a)(1)); partial: an OS threat model, no HIPAA risk analysis | 2 | Partial | `medbrains/docs/architecture/OS-THREATS.md` |
| Business associate agreement template for hosted installs (164.308(b)) | 1 | Not started | - |

</details>

<details><summary>GDPR readiness: 67%</summary>

| Item | Weight | State | Evidence |
|---|---|---|---|
| Lawful basis per purpose for health data (Art. 6, 9); partial: consent per purpose and care as a legitimate use, not an Art. 9(2) basis per processing | 3 | Partial | #4769 |
| Transparent notice at collection (Art. 13); partial: a versioned notice in English, Hindi and Tamil, none in EU languages | 2 | Partial | #4769 |
| Withdraw consent as easily as giving it, by the patient (Art. 7(3)) | 2 | Done | #4777, #4778 |
| Right of access: what the hospital holds and who received it (Art. 15) | 2 | Done | #4773, #4777 |
| Rectification, erasure and restriction (Art. 16-18); partial: requests recorded and answered with a reason, changes made by hand, no restriction request | 2 | Partial | #4773 |
| Portability: the patient downloads their record as FHIR (Art. 20) | 1 | Done | #4779 |
| Breach notice to the authority within 72 hours and to the people affected (Art. 33-34); partial: the clocks name India's Board, not an EU supervisory authority | 2 | Partial | #4758 |
| Processor register with the agreement, data and country of each (Art. 28) | 2 | Done | #4775 |
| Records of processing activities (Art. 30); partial: processors are registered, the hospital's own processing is not | 1 | Partial | #4775 |
| Data protection officer named and published (Art. 37-39) | 1 | Done | #5095 |
| Data protection impact assessment record (Art. 35) | 2 | Not started | - |
| International transfers under safeguards (Chapter V); partial: processor countries recorded and AI calls pseudonymised, no transfer mechanism record | 2 | Partial | #4775, #5030 |
| Security and privacy by design: encryption, pseudonymisation, audit (Art. 25, 32) | 2 | Done | #5230, #5030, #4771 |

</details>

<details><summary>DPDP readiness: 74%</summary>

| Item | Weight | State | Evidence |
|---|---|---|---|
| Itemised notice at registration and consent recorded purpose by purpose (s.5-6, r.3) | 3 | Done | #4769, `medbrains/crates/medbrains-server/tests/dpdp_consent_test.rs` |
| Notice in English and any Eighth Schedule language (s.5(3)); partial: Hindi and Tamil only | 1 | Partial | #4769 |
| Withdrawal as easy as consent, by the patient from the portal and apps (s.6(4)) | 2 | Done | #4777, #4778 |
| Rights requests (access, correction, erasure, nominee, grievance) answered within 90 days (s.11-14, r.14) | 3 | Done | #4773, #4777, `medbrains/crates/medbrains-server/tests/privacy_requests_test.rs` |
| DPO and grievance officer named and published to patients (r.9) | 1 | Done | #5095 |
| Breach intimation to the Board and each person affected, with the 72-hour report clock (s.8(6), r.7) | 3 | Done | #4758, `medbrains/crates/medbrains-server/tests/security_breach_register_test.rs` |
| Register of processors with their agreement (s.8(2)) | 1 | Done | #4775 |
| Verifiable guardian consent for children and no tracking of them (s.9, r.10); partial: a guardian is named, but age does not force it and marketing does not exclude minors | 2 | Partial | #4769 |
| Erase when the purpose ends, with 48 hours' notice to the person (s.8(7), r.8) | 2 | Not started | - |
| Security safeguards and access logs kept a year (r.6); partial: encryption and the audit log, but log retention differs by install | 2 | Partial | #4771, #5230 |
| Consent Manager integration (s.6(7-9), r.4); partial: ABDM consent artefacts are kept, no DPDP Consent Manager | 2 | Partial | #4836 |
| Cross-border transfers only where allowed (s.16); partial: processor countries recorded and AI calls pseudonymised, no transfer log | 1 | Partial | #4775, #5030 |

</details>

<details><summary>ABDM readiness: 72%</summary>

| Item | Weight | State | Evidence |
|---|---|---|---|
| M1: create an ABHA by Aadhaar OTP, with the Aadhaar number sent encrypted and never kept | 2 | Done | #4831, #4966, `medbrains/crates/medbrains-abdm/src/enrol.rs` |
| M1: find and verify an ABHA, show its QR and card, link it to the patient | 2 | Done | #4833, #4974 |
| Scan & Share: counter QR, token on profile share, desk queue, on web and the staff app | 2 | Done | #4840, #4869 |
| M2: link each visit's records to the ABHA and share them under consent, Fidelius-encrypted | 3 | Done | #4836, `medbrains/crates/medbrains-crypto/src/fidelius.rs` |
| M3: request and view a patient's records from other hospitals, with consent | 3 | Done | #4837, #4853 |
| NRCeS IG 6.5.0 record bundles passing the official validator; partial: HealthDocument and Invoice records held until the terminology run passes | 2 | Partial | #4962, #4988, #5078 |
| Gateway callbacks open only with the gateway's token, each hospital seeing only its own | 2 | Done | #4780, #4966, `medbrains/crates/medbrains-server/tests/abdm_callback_auth_test.rs` |
| Facility (HFR) and professional (HPR) registry identities | 1 | Done | #4831, `medbrains/crates/medbrains-server/tests/abdm_hfr_hpr_test.rs` |
| NHCX: eligibility, pre-auth and final claims sent and followed up | 2 | Done | #4835, #4838, #4965 |
| Passed the ABDM sandbox functional test for M1-M3 | 3 | Not started | - |
| ABDM certification and production keys | 3 | Not started | - |

</details>

<details><summary>CERT-In readiness: 68%</summary>

| Item | Weight | State | Evidence |
|---|---|---|---|
| An incident assessed as reportable starts a 6-hour clock from discovery, escalated when overdue (direction ii) | 3 | Done | #4758, `medbrains/crates/medbrains-server/tests/security_breach_register_test.rs` |
| The CERT-In report is recorded once, with its date and reference | 1 | Done | #4758, `medbrains/apps/web/src/pages/security/breach-notices.tsx` |
| Point of contact named (direction vi) | 1 | Done | #5095 |
| ICT logs kept 180 days in India (direction iv); partial: standalone installs keep 180 days, the OS image keeps 3 months | 3 | Partial | `medbrains/deploy/standalone/medbrains-log-archive.service`, `medbrains/os/mkosi.extra/etc/systemd/journald.conf.d/10-medbrains.conf` |
| Clocks synced to NIC or NPL time (direction i); partial: authenticated NTS time, but from other national and public servers | 2 | Partial | #5217, `medbrains/os/mkosi.extra/usr/lib/medbrains/time-role` |
| Incident response plan, with breach drills recorded | 2 | Done | #5095, `medbrains/docs/compliance/INCIDENT-RESPONSE.md` |
| Security audit by a CERT-In empanelled auditor | 2 | Not started | - |

</details>

<details><summary>EU CRA readiness: 70%</summary>

| Item | Weight | State | Evidence |
|---|---|---|---|
| Software bill of materials for every build (Annex I part II(1)) | 2 | Done | #5285 |
| Coordinated vulnerability disclosure policy and a published contact (Annex I part II(5-6)) | 2 | Done | `SECURITY.md`, `medbrains/docs/SECURITY-RELEASE-PROCESS.md` |
| No known exploitable vulnerabilities: locked builds and dependency audits as gates (Annex I part I(2)(a)) | 2 | Done | #4972, #5512 |
| Security updates signed, with rollback, and tampered updates refused (Annex I part I(2)(c)) | 3 | Done | #5279 |
| Support period declared (Art. 13(8)) | 1 | Done | `medbrains/docs/COMPATIBILITY.md` |
| Secure by default configuration (Annex I part I(2)(b)): default-deny firewall, integrations off without their keys | 2 | Done | #5217, #4970 |
| Limit attack surface (Annex I part I(2)(j)); partial: kernel and service hardening merged, CIS scoring open | 2 | Partial | #5449, open: #5453 |
| Confidentiality and integrity of stored data (Annex I part I(2)(e-f)) | 2 | Done | #5230, #4771 |
| Cybersecurity risk assessment in the technical file (Art. 13(2-3)); partial: a threat model for the OS only | 2 | Partial | `medbrains/docs/architecture/OS-THREATS.md` |
| Report actively exploited vulnerabilities and severe incidents within 24 hours (Art. 14) | 2 | Not started | - |
| Conformity assessment, EU declaration of conformity and CE marking (Art. 28-32) | 3 | Not started | - |

</details>

<details><summary>FHIR readiness: 43%</summary>

| Item | Weight | State | Evidence |
|---|---|---|---|
| A CapabilityStatement that says what the server supports | 1 | Done | #5092 |
| Read core resources; partial: Patient, Encounter, Observation and DiagnosticReport, not Condition, MedicationRequest, AllergyIntolerance or Practitioner | 3 | Partial | #4785, `medbrains/crates/medbrains-fhir-api/src/lib.rs` |
| Document bundles (Composition) for case sheets and ABDM records | 2 | Done | #4716, #4962 |
| Bundles gated on the official HL7 validator, and checked again at send time | 2 | Done | #5078, #5084 |
| A patient's whole record as a FHIR bundle ($everything and the portal download) | 1 | Done | #4779 |
| Coded with SNOMED CT, LOINC and UCUM; partial: membership is proven only by a nightly terminology run not yet seen green | 2 | Partial | #5078 |
| Search interactions on the REST API | 2 | Not started | - |
| Create and update through the REST API | 2 | Not started | - |
| SMART on FHIR authorization for outside apps | 2 | Not started | - |
| Bulk data export ($export) | 1 | Not started | - |
| Conformance to an international profile set (IPS or US Core) | 2 | Not started | - |

</details>

<details><summary>Medical device (SaMD) controls: 53%</summary>

| Item | Weight | State | Evidence |
|---|---|---|---|
| AI text reaches a record only when a clinician accepts, edits or rejects each item | 3 | Done | #5258, `medbrains/apps/web/src/components/Clinical/dictation/DictationPanel.test.tsx` |
| Every screen that shows AI output labels it, checked in CI | 2 | Done | #4907, `medbrains/scripts/check_ai_label.py` |
| Every accept, edit or reject is kept as an AI-governance record | 2 | Done | #5258, `medbrains/crates/medbrains-dictation/src/review.rs` |
| AI-suggested medicines become a prescription only through the clinician and the allergy, interaction and dose checks | 2 | Done | #5258, #5244 |
| Intended use written per AI capability; partial: dictation is written down as a documentation aid, not yet signed off by a regulatory adviser | 2 | Partial | `medbrains/RFCs/modules/RFC-MODULE-ai-dictation.md` |
| One strict AI component seam (draft cards, flags, never pre-selected, override needs a reason), enforced by a CI check and the server | 3 | Not started | open: medbrains/docs/DECISIONS.md 2026-11-12, RFCs/RFC-AI-CLINICAL-FLOWS.md 10.0 |
| Claim gate: intended-use statement and risk register before any diagnostic, triage or monitoring claim | 3 | Not started | open: scripts/check_cert_readiness.py (samd-intended-use.md, samd-risk-register.md) |
| Written classification under CDSCO, EU MDR and US FDA before any device-like feature is built | 2 | Not started | - |

</details>
<!-- regulation:end -->

## Why is it free?

People reasonably ask what the catch is. Here is the whole answer:

- **The software is free forever** under the [GNU AGPL-3.0](./LICENSE). Any hospital, clinic or pharmacy can use it, change it and run it, without asking us. If you change it and let people use it over a network, you share your changes under the same licence.
- **Selling it or building a closed product on it?** Take a [commercial licence](./COMMERCIAL-LICENSE.md) instead.
- **The code is public.** Anyone can read how it checks a drug interaction or who can see a record.
- **Every release's source stays public, and that is a pledge.** The source of every MedBrains release, including the ones subscribers and commercial licensees run, is published in this repository and never put behind a login, a paywall or a customer portal. No contract we sign, subscription, support or commercial, will ever contain a term against sharing that source. We sell updates, support and warranty, never access to the code.
- **No licence fees, no per-user fees, no selling your data.** We never see your data unless you ask us to host it.
- **How the team earns:** only from *optional* setup, training, hosting and support for hospitals that want help ([pricing](https://www.medbrains.in/pricing)). If you can run it yourself, you owe us nothing.

**Why we are doing this:** good hospital software is expensive and locks hospitals in. The places that need it most (small, rural and charitable hospitals) can least afford it. Patient-safety rules such as drug checks, consent and controlled-drug registers should be open to inspection, and free for anyone to run. MedBrains aims to be a [Digital Public Good](#digital-public-good) for health.

## Who it's for

| | |
|---|---|
| **Small and rural hospitals** | Run the full hospital on one small server, with no licence budget. |
| **Charitable and trust hospitals** | Money goes to patients, not software fees. |
| **Multi-specialty hospitals** | Many departments, roles and branches, with fine-grained access control. |
| **Developers and health-tech teams** | A real, tested hospital codebase to learn from, extend, or build on. |

## Features

These features are built end to end: database, server and screen. Things that are only partly done are listed under [Roadmap](#roadmap) instead.

**Registration and front office**
- Patient registration with automatic UHID, photo, contacts, insurance and allergies
- Duplicate-patient check while you type (fuzzy name match), plus merge and unmerge
- OPD token queue (call, start, complete, no-show) and token display boards

**OPD (outpatient)**
- Case sheet / clinical notes with sign, countersign and revision history
- Prescriptions with drug-interaction checks
- Diagnosis search with ICD-10 and ICD-11 codes
- Duplicate-investigation warning, referrals, certificates and consents

**IPD (wards)**
- Admission, live bed board, discharge summary
- eMAR: medication rounds with barcode verification at the bedside
- Nursing charts: vitals, intake/output, pain, wounds, fall risk, shift handover, code blue

**Emergency**
- ER visits and triage
- Medico-legal cases (MLC) with injury records and police intimation

**Operation theatre**
- OT bookings and schedule, WHO-style safety checklist, anaesthesia record

**Pharmacy**
- Prescription queue and dispensing, stock with batches and expiry (first-expiry-first-out)
- NDPS register for narcotics; Schedule H / H1 / X rules enforced on the server
- Drug-interaction check; allergy conflicts block dispensing on the server
- Counter sales (OTC) and returns

**Laboratory**
- Orders, results, verification and amendments
- Critical-value alerts sent to the doctor's inbox
- Quality control (Westgard rules)

**Radiology**
- Orders and reports
- PACS link with [Orthanc](https://www.orthanc-server.com/) (open source): worklist and studies matched to orders

**Blood bank**
- Donors and eligibility, crossmatch with issue checks, transfusions and reaction reporting

**Billing and insurance**
- Invoices, packages, credit notes, refunds, GST returns
- Insurance / TPA claims and rate cards

**Stores, HR and payroll**
- Procurement and indents
- Staff, duty roster, attendance and duty hours
- Basic payroll: salary structures, payroll runs, payslips

**Reports and admin**
- Dashboards, report catalogue with CSV export, NABH quality indicators
- Self-service hospital onboarding
- Roles and permissions down to single actions, plus field-level access (hide a field from a role)
- Tamper-evident audit log (hash-chained, append-only) with export

**Patient portal**
- Patients can see their records, request refills, use teleconsultation, and manage privacy requests

**Staff mobile apps (native iPhone and Android)**
- Reception: register and find patients, OPD queue
- Doctor: consultation notes, IPD rounds
- Nurse: MAR schedule, give doses with barcode check, transfusion monitoring, code blue, shift handover

## Customise it for your hospital

You don't need a developer for most of this:

- **Roles and permissions.** Create your own roles and choose exactly what each one can see and do.
- **Field-level access.** Hide sensitive fields (for example, HIV status) from roles that don't need them.
- **Departments, wards, beds, services and prices.** All set up from the admin screens.
- **Your language.** The interface text is translatable.

Developers can go further, because the code is open: add a module, change a workflow, or connect your own devices.

## Standards and compliance

Only what the code does today. MedBrains is **built to** these standards; it does not claim a certification it has not been given.

| Standard | Status |
|---|---|
| **ICD-10 / ICD-11** | Diagnosis coding. ICD-11 uses the WHO ICD API container. |
| **HL7 v2** | MLLP listener on the on-site bridge, for lab analysers and devices. |
| **DICOM** | Through Orthanc: worklist and studies linked to radiology orders. |
| **HL7 FHIR R4** | Read API for `Patient` (including `$everything`), `Encounter`, `Observation`, `DiagnosticReport` and `Composition`. Write and search are on the roadmap. |
| **ABDM** | ABHA (M1), health-record linking as a provider (M2, HIP), consent requests as a user of records (M3, HIU), Scan & Share and NHCX claims are in the code. They need your ABDM credentials, and MedBrains has not yet been through ABDM's certification. |
| **LOINC** | Lab tests carry a LOINC code field. The LOINC dataset is not bundled. |
| **SNOMED CT** | Optional. A loader script imports RF2 files you obtain yourself. SNOMED needs a licence: free through your country's national release centre where one exists, otherwise an affiliate licence. No SNOMED content ships with MedBrains. |

**Privacy (DPDP Act, 2023):** MedBrains records patient consent, and tracks access, correction, erasure, nominee and grievance requests with due dates. It keeps a full audit trail, separates hospitals with database row-level security, and lets you restrict fields by role. Erasure requests are decided by a person, because medical records have legal retention periods. The software helps you comply; your hospital is still the data fiduciary.

## Your data is yours

- **Open database.** All data sits in a normal PostgreSQL database that you control. The schema is in the repo.
- **Patient download.** A patient can download their record as a FHIR R4 Bundle (JSON) from the portal.
- **CSV exports** for reports, analytics and the audit log.
- **Backups** with standard PostgreSQL tools; scripts and a restore guide are in [`medbrains/docs/ops/BACKUP-RESTORE.md`](medbrains/docs/ops/BACKUP-RESTORE.md).
- **No lock-in.** If you stop using MedBrains, your database is still yours, in an open format.

## Quick start

> Today the quick start is for developers. A single-command Docker setup for hospitals is on the [roadmap](#roadmap).

**You need:** macOS or Linux, Docker, Rust 1.85+ (`rustup`), Node 24 and pnpm 10. The first Rust build is large and takes a while; 16 GB RAM and about 60 GB of free disk are recommended.

```bash
git clone https://github.com/medbrains/medbrains.git
cd medbrains/medbrains
cp .env.example .env
make db              # PostgreSQL, SpiceDB, Gotenberg, mail server (Docker)
make dev-db-roles    # creates the app's database roles
make dev-backend     # builds and runs the server on :3000; migrations run automatically
```

In a second terminal:

```bash
cd medbrains/medbrains
pnpm install
pnpm dev:web         # web app on http://localhost:5173
```

**Sign in:** hospital code `DEFAULT`, username `admin`. In development, the password is shown on the sign-in page under "Dev credentials". Set `MEDBRAINS_SEED_ADMIN_PASSWORD` before the first start to choose your own. In production, the server refuses to start without it and asks for a new password at first sign-in. Set `MEDBRAINS_SEED_DEMO_DATA=true` for sample data.

To install at a hospital, see the on-site deployment kits in [`medbrains/deploy/`](medbrains/deploy/).

## Architecture

Full design: [MedBrains OS architecture](medbrains/docs/architecture/HOSPITAL-OS-ARCHITECTURE.md).

```mermaid
flowchart LR
  subgraph Clients
    W[Web app<br/>React + Mantine]
    M[Staff apps<br/>SwiftUI / Jetpack Compose]
    P[Patient portal]
  end
  W & M & P -->|HTTPS / JSON| S[MedBrains server<br/>Rust · Axum]
  S --> DB[(PostgreSQL<br/>row-level security per hospital)]
  S --> Z[SpiceDB<br/>permissions, optional]
  S --> O[Orthanc<br/>DICOM / PACS]
  S --> G[Gotenberg<br/>PDF printing]
  B[On-site bridge<br/>HL7 v2 / devices] --> S
```

- **One server, many hospitals.** Each hospital's rows are kept apart by PostgreSQL row-level security, set per request.
- **SQL checked at compile time** with SQLx. A query that doesn't match the schema doesn't build.
- **Split into about 119 Rust crates** by department, so one department's change doesn't touch the rest.
- **Open dependencies.** PostgreSQL, Orthanc, SpiceDB and Gotenberg are all open source. Paid services such as SMS, email, payment gateways and AI are optional add-ons, and file storage can be S3 or local disk.

## MedBrains OS: a hospital in a box

MedBrains is also its own operating system: a small, open OS on Debian Linux that runs every
machine in the hospital, so a hospital without an IT team can plug in and start. It is cheap by
design (only the server needs real hardware), simple out of the box (setup is a few plain screens,
no command line), and built so a local IT firm can install and look after it.

**One image per processor type** (x86-64 and arm64). The same OS runs on every machine; you choose
its role on the first-boot screen. One server manages everything. Every other machine is a node on
the smallest hardware that does its job and holds no system of record, so it can be replaced in
minutes. Keep a standby server: one server is a single point of failure.

| Role | What it does | Patient data on it |
|---|---|---|
| Server | database, sign-in (Kanidm, with an authenticator app), certificates, the Nodes screen | yes, on an encrypted disk where there is a TPM |
| Workstation | staff sign in and work | none, or only what offline mode needs |
| Display | queue board or TV (joins today; the board is not built) | none |
| Ward backup | keeps a ward running if the server or network fails (planned) | yes, encrypted |

**Joining a machine:** the new machine finds the server (local discovery or a typed address) and
shows a code; an administrator approves it on the server, and the approval is audited. A second
code lets the new machine check that it found the real server. Removing a machine ends its access at
once (an offline machine learns this when it reconnects). Changing a role is a deliberate reset.

**Not locked to one app.** The OS opens to a desktop with a dock and a launcher, and each app runs in
its own sandboxed view. MedBrains is one of them.

**Secure by default:** firewall and kernel hardening before the first boot, the data disk sealed to
the TPM where there is one, a single Rust front (Pingora) for HTTPS, and no Docker: every service
runs directly on Linux under systemd.

**Hardware (recommendations, not tested kits).** Worked out from virtual-machine measurements. None
of this has run on a real Raspberry Pi or PC yet, and sizing a hospital server for a large site waits
on a load test. The same table, with a diagram, is on [medbrains.in/os](https://www.medbrains.in/os).

| Machine | Minimum | Recommended | Why |
|---|---|---|---|
| Server, small clinic | 4 cores, 8 GB RAM, 64 GB SSD | Raspberry Pi 5 8 GB with an NVMe SSD | the whole machine uses about 1.2 GB with a user signed in; the database, sign-in and server all run here |
| Server, hospital | 8 cores, 16 GB RAM, 512 GB NVMe SSD | 16–32 GB RAM, mirrored SSDs, a TPM, a UPS, plus a standby server | the database grows with patients; the server program itself is 88 MB |
| Workstation | 2 cores, 4 GB RAM, 32 GB storage | any small PC or arm64 board that drives the screen | the node desktop uses about 300 MB, plus about 320 MB for an open page |
| Display or TV board | 2 cores, 2–4 GB RAM | a Pi-class board | holds no patient data |
| Optional | a GPU or AI chip | used when present, never required | on-box AI, imaging hints |

**Measured sizes** (one run each, in virtual machines; details in
[`medbrains/os/README.md`](medbrains/os/README.md#measured)):

| What | Size |
|---|---|
| Download (compressed with zstd) | 478 MB |
| Installed system | 1,158 MB (the ≤ 1 GB target is not met yet) |
| Data disk after first boot | 216 MB |
| Web app first page | about 308 KB with zstd, 328 KB with gzip |

**Measured so far** (virtual machines on a laptop, one run each): a workstation node uses about
300 MB of memory at its desktop; removing a machine ends its access within about 2 s. Hardware
tiers in the plan: [RFC-HOSPITAL-OS §8a and §8p](medbrains/RFCs/RFC-HOSPITAL-OS.md).

**Status, and what is not done yet:** the image builds and boots in virtual machines (QEMU and UTM),
including the TPM-sealed disk on x86-64. Not done: signed A/B updates with rollback (in review); the
display board and the ward backup role; verified boot and machine keys in the TPM; nightly backups on
the OS. It has not run on real hardware or a Raspberry Pi, had no outside penetration test, and no
hospital runs it in production yet.

How to build and boot it: [`medbrains/os/README.md`](medbrains/os/README.md). The plan:
[RFC-HOSPITAL-OS](medbrains/RFCs/RFC-HOSPITAL-OS.md).

## Why Rust

- **Memory safety.** Rust rules out whole classes of crashes and security holes. `unsafe` code is forbidden in this project.
- **No surprise crashes.** Lints forbid `unwrap`, `expect`, `panic` and `todo`, so every error is handled.
- **Small and fast.** A single compiled server runs comfortably on modest hardware.

Measured numbers we have so far: across 16,779 requests from our automated smoke tests, the median API response was **7 ms**, p95 **54 ms** and p99 **97 ms**. These come from single-user test runs on a developer machine, not a load test. Load-test results will be published when we have them.

The test suite has about 1,500 Rust tests, 206 Playwright browser specs and 177 web unit-test files.

## MedBrains vs a typical commercial hospital system

| | MedBrains | Typical commercial system |
|---|---|---|
| Licence cost | Free | Upfront licence, often large |
| Per-user / per-bed fees | None | Common |
| Source code | Public, you can audit it | Closed |
| Your data | Open PostgreSQL, FHIR and CSV export | Often a vendor format; export may cost extra |
| Customisation | Change anything yourself, or hire anyone | Through the vendor only |
| Hosting | Your server, any cloud, or ours (optional) | Usually the vendor decides |
| Support | Community free; paid support optional | Bundled into the contract |

## Roadmap

**Partly built**
- **ABDM:** M1–M3, Scan & Share and NHCX claims are merged. They still need testing on the ABDM sandbox and certification.
- **MedBrains OS:** test on real hardware and build the Raspberry Pi image.
- **FHIR:** add search, write, and whole-hospital bulk `$export`.
- **LOINC:** load and map the LOINC dataset, beyond today's code field.
- **SNOMED CT:** connect the terminology client to the screens.
- **Inventory screens:** stores inventory is thin compared with procurement.
- **Payroll:** statutory PF / ESI filing.
- **Online payments:** only one payment gateway today. A provider-neutral layer is planned.
- **Native apps:** pharmacy, lab, radiology, OT and blood bank screens.
- **Allergy check on screen:** show the warning while prescribing, not only when dispensing.

**Planned**
- One-command Docker install for hospitals (server plus web in one compose file)
- Published load-test results
- Registration with the Digital Public Goods Alliance

## Digital Public Good

We are building MedBrains to meet the [Digital Public Goods Standard](https://digitalpublicgoods.net/standard/) and plan to apply for registration. It serves **SDG 3: Good Health and Well-being**, uses an open licence (AGPL-3.0), runs on an open stack, and documents how it handles privacy. See [GRANTS.md](./GRANTS.md) for how it maps to each criterion.

## Get help

- **Community (free):** [GitHub Issues](https://github.com/medbrains/medbrains/issues) for bugs, [Discussions](https://github.com/medbrains/medbrains/discussions) for questions and ideas.
- **For hospitals (paid, optional):** setup, data migration, staff training, hosting and support contracts. See [pricing](https://www.medbrains.in/pricing) or [book a demo](https://www.medbrains.in/#demo).
- **Install MedBrains for hospitals near you:** join the [partner programme](https://www.medbrains.in/partners).
- **Security issues:** please don't open a public issue. Follow [SECURITY.md](./SECURITY.md).

## Sponsor the work

Sponsorship keeps MedBrains free for hospitals that can't pay. You can sponsor:

- **A module.** Fund a feature from the roadmap, such as ABDM M2/M3, LOINC mapping or the one-command install.
- **A hospital.** Pay for setup and training at a rural or charitable hospital.
- **A language.** Fund translation into a regional language.
- **A security audit** or ABDM certification.

<!-- TODO: add sponsorship link (GitHub Sponsors / Open Collective) -->
See [medbrains.in/sponsors](https://www.medbrains.in/sponsors) for how sponsorship works, or write to hello@medbrains.in.

## Contributing

You don't have to write code to help. We need:

- **Clinicians, pharmacists, nurses and administrators** to tell us where a workflow or rule is wrong. This is the most valuable help of all.
- **Translators** for regional languages.
- **Developers.** Good places to start:
  - Show the allergy warning on the prescribing screen (the API already exists)
  - FHIR search and write endpoints
  - LOINC dataset import and mapping
  - Native pharmacy or lab screens (SwiftUI / Jetpack Compose)
  - Accessibility fixes (WCAG 2.2 AA)
  - Documentation and setup guides
- **Testers** to try it in a real department and report back.

Read [CONTRIBUTING.md](./CONTRIBUTING.md) to get started. Pull requests are merged after you sign the [contributor licence agreement](./CLA.md); until then, open an issue. Never put real patient data in an issue, commit or test.

## License

MedBrains is dual-licensed: the [GNU Affero General Public License, version 3 only](./LICENSE) (`AGPL-3.0-only`), free for everyone, or a [commercial licence](./COMMERCIAL-LICENSE.md) for those who cannot meet the AGPL's terms. See [NOTICE](./NOTICE). Versions released before 2026-11-12 were licensed under Apache 2.0. The client SDKs (`packages/sdk`, `sdks/python`) stay under Apache 2.0, so integrating with MedBrains never forces a licence on your code.

**Trademarks:** "MedBrains" and the MedBrains logo are trademarks (™) of Domnic Amalan S. Neither licence covers them. You may say you run MedBrains, redistribute it unchanged, and call a modified fork "based on MedBrains" under your own name. Product names, "official" or "certified" claims, "MedBrains Compatible", the logo in your marketing and domains need written permission. See the [trademark policy](./TRADEMARKS.md).

## Credits and contact

Created by **Domnic Amalan S** ([@DomnicAmalan](https://github.com/DomnicAmalan)), with thanks to everyone who contributes.

Built on the shoulders of open source: Rust, PostgreSQL, React, Mantine, Kanidm, Pingora and many more, and shaped by the work of the WHO, HL7, openEHR and many others. Thank you. The full list is in [ACKNOWLEDGEMENTS.md](./ACKNOWLEDGEMENTS.md).

Website: [medbrains.in](https://www.medbrains.in) · [Health blog](https://www.medbrains.in/blog) · [Partners](https://www.medbrains.in/partners) · [Sponsor](https://www.medbrains.in/sponsors)
