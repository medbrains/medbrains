---
module: radiology
priority: P1
status: draft
---

# SOP: Radiology

## Overview
The Radiology module covers imaging order placement, modality scheduling, DICOM image acquisition and PACS integration, radiologist reporting, and result delivery. Modalities include X-ray, CT, MRI, Ultrasound, Mammography, and Fluoroscopy. Radiation safety is governed by AERB (Atomic Energy Regulatory Board) for ionising modalities. PCPNDT Act restrictions apply strictly to fetal sex determination — the system must enforce documentation and disable sex reporting for antenatal ultrasound unless via authorised channels.

## Actor Matrix

| Actor (Role) | Can Perform | Notes |
|---|---|---|
| `doctor` | Order imaging, review reports, acknowledge results | Any clinical encounter |
| `radiology_tech` | Schedule patient, acquire image, upload DICOM, tag study | Modality-specific access |
| `doctor` (radiologist) | Read study, dictate and sign report | Specific `is_radiologist` flag on doctor record |
| `patient` (portal) | View released reports, download DICOM CD | After radiologist sign-off |
| `billing_clerk` | Bill imaging charges | Triggered on order placement |

---

## Scenario 1: Doctor Orders Imaging from Clinical Encounter — Actor: Doctor

**Actor**: `doctor`  
**Entry point**: Active OPD, IPD, or Emergency encounter → Radiology Orders panel  
**Preconditions**: Radiology catalog populated; radiology department configured; modality available

**Steps**:
1. Doctor searches for study (e.g., "Chest X-Ray PA", "CT Head Plain", "USG Abdomen").
2. Selects study; system shows modality, approximate radiation dose (for ionising), and prep instructions.
3. Doctor fills: clinical indication (mandatory), urgency (Routine / Urgent / STAT), and any special instructions.
4. For antenatal ultrasound: system enforces PCPNDT form (Form F) — doctor must complete; sex determination output blocked.
5. Order submitted → status `pending_scheduling`; radiology department notified.
6. Patient directed to radiology reception (OPD) or porter called (IPD).

**Exit / Outcome**: Radiology order created with indication; PCPNDT form completed if antenatal; patient directed to radiology.  
**Regulatory note**: AERB Safety Code — radiation justification documented; PCPNDT Act 1994 §6 — Form F mandatory for every antenatal USG; sex of foetus never communicated.  
**Existing test**: `apps/web/e2e/crud/radiology.spec.ts` (partial); `— needs full order chain test`

---

## Scenario 2: Radiology Tech Acquires Study and Uploads DICOM — Actor: Radiology Technician

**Actor**: `radiology_tech`  
**Entry point**: Radiology module → Worklist (pending studies)  
**Preconditions**: Order is `pending_scheduling`; patient has arrived at radiology

**Steps**:
1. Radiology tech opens worklist; identifies patient by name + UHID (two-point check).
2. Confirms preparation completed (fasting for contrast CT, full bladder for pelvic USG, etc.).
3. Performs acquisition on modality; acquires DICOM images.
4. Uploads DICOM study to PACS via HL7 / DICOM store SCU; or imports from modality directly.
5. Tags study with patient UHID, order ID, date, modality, and body part.
6. Marks study `acquired`; radiologist notified.
7. For STAT studies: radiologist receives priority alert.

**Exit / Outcome**: DICOM study uploaded to PACS; order status `acquired`; radiologist queue updated.  
**Regulatory note**: AERB — DICOM header must include radiation dose (DLP for CT); NABH RAD.2 — modality-specific QC documented; PCPNDT Act — acquisition log for antenatal USG.  
**Existing test**: `— needs test`

---

## Scenario 3: Radiologist Reports Study and Signs — Actor: Doctor (Radiologist)

**Actor**: `doctor` with `is_radiologist = true`  
**Entry point**: Radiology → Reporting Queue  
**Preconditions**: DICOM study is `acquired` and available in PACS/viewer

**Steps**:
1. Radiologist opens study in integrated DICOM viewer (OHIF or similar).
2. Reviews images; uses structured report template (e.g., CT Chest template with predefined fields).
3. Dictates or types findings and impression.
4. If incidental finding requiring urgent attention (e.g., aortic aneurysm on abdominal CT for appendicitis): flags as "Urgent Incidental Finding" — treating doctor alerted.
5. Signs report electronically → status `reported`; report released to treating doctor.
6. For PCPNDT studies: system prevents entering or displaying fetal sex in report.

**Exit / Outcome**: Signed radiology report visible to treating doctor and in patient record; PDF report generated; PACS archived.  
**Regulatory note**: NABH RAD.3 — radiologist sign-off mandatory; AERB — report must include radiation dose for CT; PCPNDT — sex of foetus never in report.  
**Existing test**: `— needs test`

---

## Scenario 4: Patient Collects Report and DICOM CD — Actor: Patient / Radiology Tech

**Actor**: `patient` (physical collection) or `radiology_tech` (for DICOM burn)  
**Entry point**: Patient arrives at radiology reception with order slip / UHID  
**Preconditions**: Report is `signed`; study archived in PACS

**Steps**:
1. Radiology tech retrieves signed report for patient.
2. Prints report (with hospital header, patient details, radiologist name and registration number).
3. If patient requests DICOM CD: tech burns CD from PACS with DICOM viewer embedded.
4. Patient signs acknowledgement of report collection.
5. Portal release: if patient portal enabled, report also available as PDF download online.

**Exit / Outcome**: Report handed to patient with radiologist credentials; CD burned if requested; acknowledgement recorded.  
**Regulatory note**: NABH — patients have right to health records; AERB — radiation records retained per AERB directive; PCPNDT — all antenatal USG reports and Forms F retained for minimum 2 years.  
**Existing test**: `— needs test`
