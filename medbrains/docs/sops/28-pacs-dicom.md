---
module: pacs-dicom
priority: P1
status: draft
---

# SOP: PACS & DICOM Configuration

## Overview
PACS (Picture Archiving and Communication System) configuration defines how MedBrains connects to the hospital's DICOM imaging infrastructure. MedBrains acts as a DICOM worklist provider (MWL SCU) and optionally as a DICOM store SCU (sending orders to modalities) or store SCP (receiving studies from modalities). Configuration covers: PACS server connection, DICOM Application Entity (AE) titles, modality registration, DICOM Modality Worklist (DMWL) setup, PACS viewer integration (URL launch from within MedBrains), and DICOM study retrieval for report viewing. PCPNDT restrictions apply to antenatal ultrasound DICOM studies — sex-determination tags must be suppressed.

## Actor Matrix

| Actor (Role) | Can Perform | Notes |
|---|---|---|
| `hospital_admin` | PACS server configuration, AE title management, viewer URL setup | System-level PACS config |
| `super_admin` | Platform-level PACS defaults, DICOM conformance statement | Multi-tenant defaults |
| `radiology_tech` | Modality-level test (ping PACS, verify worklist), DICOM send test | Operational verification |
| `biomed_engineer` | Physical modality network setup, IP/port configuration | Network/hardware layer |
| `doctor` (radiologist) | Viewer preferences, report template config | Reporting workflow |

---

## Scenario 1: Hospital Admin Configures PACS Server Connection — Actor: Hospital Admin

**Actor**: `hospital_admin`  
**Entry point**: Admin → Integrations → PACS / DICOM  
**Preconditions**: PACS server is running on hospital network; DICOM port (default 104) is accessible from MedBrains server; IT has provided AE titles and IP/port

**Steps**:
1. Admin opens PACS Configuration panel; clicks "Add PACS Server".
2. Enters PACS server details:
   - **AE Title (Called)**: the PACS server's AE title (e.g., `HOSPITAL_PACS`).
   - **AE Title (Calling)**: MedBrains' own AE title (e.g., `MEDBRAINS_WL`).
   - **Hostname / IP**: PACS server IP address or hostname on hospital LAN.
   - **Port**: DICOM port (default 104; may be 11112 for some PACS).
   - **TLS**: enabled / disabled (recommended enabled if PACS supports TLS DICOM).
3. Clicks "Test C-ECHO" → MedBrains sends a DICOM C-ECHO request to the PACS server.
4. If C-ECHO succeeds: green badge "PACS Reachable"; AE title handshake confirmed.
5. If C-ECHO fails: error displayed with code — common causes: wrong IP, firewall blocking port 104, wrong AE title.
6. Saves configuration; PACS server appears in the active integrations list.
7. Sets PACS server role: **Primary** (all studies) / **Secondary** (failover) / **Archive** (long-term retrieval).

**Exit / Outcome**: PACS server registered; C-ECHO verified; MedBrains can send/receive DICOM to this server.  
**Regulatory note**: AERB — DICOM transmission over hospital network must be within secured LAN or VPN; HIPAA / IT Act — DICOM studies contain PHI; TLS encryption for DICOM required for any WAN transmission.  
**Existing test**: `— needs test`

---

## Scenario 2: Admin Configures DICOM Modality Worklist for a Modality — Actor: Hospital Admin + Radiology Tech

**Actor**: `hospital_admin` (config) → `radiology_tech` (verifies on modality)  
**Entry point**: Admin → Integrations → PACS / DICOM → Modalities  
**Preconditions**: PACS server configured (Scenario 1 complete); modality (CT/MRI/X-ray machine) is on the hospital network

**Steps**:
1. Admin clicks "Add Modality"; fills:
   - **Modality AE Title**: the machine's AE title (set on the machine itself — e.g., `CT_SCANNER_1`).
   - **Modality type**: CT / MR / CR / DX / US / MG / RF (fluoroscopy) / OT.
   - **IP address and port** of the modality.
   - **Department**: links to radiology department in MedBrains.
   - **Worklist SCP AE Title**: the AE title that serves the worklist (usually PACS or MedBrains itself if acting as MWL SCP).
2. Configures DICOM Modality Worklist (DMWL):
   - MedBrains generates a DMWL entry for each accepted radiology order.
   - DMWL fields populated: Patient Name, Patient ID (UHID), DOB, Sex, Accession Number (lab order ID), Study Description, Modality, Scheduled Date/Time, Requesting Physician.
3. For **PCPNDT compliance on antenatal US modalities**: tick "PCPNDT mode" — MedBrains suppresses Patient Sex in DMWL entry and strips it from any C-FIND response.
4. Admin clicks "Test C-FIND from Modality perspective" → simulates modality querying worklist; verifies patient demographics returned correctly.
5. Radiology tech goes to physical modality → performs a worklist query → confirms patient data appears for a test order.

**Exit / Outcome**: Modality registered; DMWL entries appear on modality's worklist; PCPNDT suppression active for US machines.  
**Regulatory note**: PCPNDT Act 1994 — DMWL for antenatal USG must not expose sex; AERB — modality-specific settings documented; DICOM Conformance Statement specifies what tags are supported by each modality.  
**Existing test**: `— needs test`

---

## Scenario 3: Admin Configures DICOM Viewer Integration — Actor: Hospital Admin

**Actor**: `hospital_admin`  
**Entry point**: Admin → Integrations → PACS / DICOM → Viewer  
**Preconditions**: PACS server configured; DICOM viewer deployed (OHIF / 3Dicom / Horos web viewer or hospital-provided viewer)

**Steps**:
1. Admin opens Viewer Configuration; selects viewer type from dropdown:
   - **OHIF Viewer** (open-source; self-hosted) — most common for web-based viewing.
   - **DICOMweb (WADO-RS)** — PACS supports DICOMweb standard; studies accessed via URL.
   - **Custom URL launch** — proprietary PACS viewer; MedBrains launches it with patient/study parameters.
2. For **OHIF / DICOMweb**:
   - Enters WADO-RS base URL (e.g., `https://pacs.hospital.local/wado`).
   - Enters QIDO-RS base URL for study search.
   - Enters STOW-RS URL for study upload.
   - Tests with a sample Study Instance UID → viewer launches and displays study.
3. For **Custom URL launch**:
   - Enters URL template with placeholder tokens: `{studyInstanceUid}`, `{patientId}`, `{token}` (SSO JWT).
   - MedBrains replaces tokens at launch time.
   - Tests launch with a sample order.
4. Configures SSO token passthrough: MedBrains generates a short-lived JWT for the user session; viewer validates it against MedBrains auth endpoint.
5. Sets default viewer per modality type (e.g., OHF for CT/MR, simple viewer for X-ray).

**Exit / Outcome**: Viewer integration configured; radiologist can open studies from within MedBrains radiology report panel; SSO prevents re-login.  
**Regulatory note**: IT Act — study access authenticated and logged; AERB — access to radiation study data restricted to authorised clinical staff; session token expiry enforced (no persistent open access).  
**Existing test**: `apps/web/e2e/scenarios/demo-dicom-fixtures.spec.ts` (exists — demo DICOM viewer test); `— needs WADO-RS config + viewer launch integration test`

---

## Scenario 4: Radiology Tech Verifies DICOM Study Flow End-to-End — Actor: Radiology Tech

**Actor**: `radiology_tech`  
**Entry point**: Radiology module → Test DICOM Flow (or ad-hoc after config change)  
**Preconditions**: PACS configured; modality configured; viewer configured; a test patient and radiology order exist

**Steps**:
1. Tech ensures a test radiology order exists for a test patient (UHID: TEST-0001 or similar sandbox patient).
2. On the physical modality: queries worklist → confirms test patient appears with correct demographics and accession number.
3. Acquires a test image (or uses a pre-loaded DICOM test file).
4. Sends DICOM C-STORE to PACS; confirms C-STORE SCU response is "Success (0000)".
5. In MedBrains Radiology module: opens the order → clicks "View Images" → viewer launches.
6. Confirms images are visible in viewer; correct patient and study information shown in DICOM header.
7. Verifies PCPNDT fields: if modality is US, confirms no sex field visible in study header or viewer.
8. Documents test result: pass / fail with date and tech name.
9. Any failure: raises a support ticket with error code and logs to facilities manager.

**Exit / Outcome**: Full DICOM flow verified (worklist → acquisition → C-STORE → viewer launch); PCPNDT compliance confirmed; test logged.  
**Regulatory note**: AERB — equipment commissioning test required before clinical use; PCPNDT — pre-use verification of sex-suppression mandatory for USG machines; NABL — modality calibration certificate available before live imaging.  
**Existing test**: `— needs test`
