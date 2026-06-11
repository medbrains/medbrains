---
module: cross-module-journeys
priority: P0
status: draft
---

# Cross-Module Journey Map — MedBrains HMS

This document maps every module in the application to its SOP reference and defines 5 end-to-end journey narratives that cross multiple modules. These journeys are the basis for integration-level E2E tests that verify module handoffs work correctly.

---

## Complete Module Inventory

Modules are grouped by domain. Each has a SOP reference or is marked **needs SOP**.

### Core Clinical

| Module | Page File | SOP Reference |
|--------|-----------|---------------|
| Patient Registration | `patients.tsx` | [01-patient-registration.md](01-patient-registration.md) |
| Patient Detail | `patient-detail.tsx` | ← covered by 01 |
| Patient Edit | `patient-edit.tsx` | ← covered by 01 |
| OPD Visit | `opd.tsx` | [02-opd-visit.md](02-opd-visit.md) |
| Lab Orders & Results | `lab.tsx` | [03-lab-orders.md](03-lab-orders.md) |
| Pharmacy Dispensing | `pharmacy.tsx` | [04-pharmacy-dispensing.md](04-pharmacy-dispensing.md) |
| IPD Admission & Discharge | `ipd.tsx` | [05-ipd-admission-discharge.md](05-ipd-admission-discharge.md) |
| Emergency / Casualty | `emergency.tsx` | [06-emergency-casualty.md](06-emergency-casualty.md) |
| ICU | `icu.tsx` | **needs SOP** — ICU-specific MAR, ventilator, sedation protocol |
| Radiology | `radiology.tsx` | [08-radiology.md](08-radiology.md) |
| Operation Theatre | `ot.tsx` | [09-operation-theatre.md](09-operation-theatre.md) |
| Blood Bank | `blood-bank.tsx` | [10-blood-bank.md](10-blood-bank.md) |
| Consent Management | `consent.tsx` | **needs SOP** — procedure consent, anaesthesia consent, research consent |
| Nurse Activities | `nurse-activities.tsx` | ← covered by 05-S3 (MAR, I/O, handover) |
| Care View | `care-view.tsx` | **needs SOP** — multi-patient task board (my-tasks, patient-grid, handover, discharge tracker) |
| Doctor — My Day | `doctor/my-day.tsx` | **needs SOP** — daily clinical task aggregation for doctors |
| Doctor — Sign-offs | `doctor/signoffs.tsx` | **needs SOP** — pending signatures (discharge summaries, lab, prescriptions) |
| Bedside Portal | `bedside-portal.tsx` | **needs SOP** — patient-facing tablet at bedside |
| Order Sets | `order-sets.tsx` | **needs SOP** — clinical order bundles (e.g., "Pneumonia Bundle", "Sepsis Protocol") |

### Specialty Clinical

| Module | Page File | SOP Reference |
|--------|-----------|---------------|
| Maternity | `specialty/maternity.tsx` | **needs SOP** — antenatal OPD, labour ward, delivery, postnatal, PCPNDT |
| Psychiatry | `specialty/psychiatry.tsx` | **needs SOP** — Mental Healthcare Act 2017 compliance, ECT consent, involuntary admission |
| Cath Lab | `specialty/cath-lab.tsx` | **needs SOP** — cardiac catheterisation, PTCA, stent traceability |
| Endoscopy | `specialty/endoscopy.tsx` | **needs SOP** — procedure scheduling, sedation, biopsy sample tracking |
| PMR (Physical Medicine & Rehab) | `specialty/pmr.tsx` | **needs SOP** — functional assessment, therapy scheduling, outcomes |
| Palliative Care | `specialty/palliative.tsx` | **needs SOP** — goals-of-care documentation, do-not-resuscitate (DNR) orders |
| Other Specialties | `specialty/other.tsx` | **needs SOP** — placeholder for dialysis, oncology day care, etc. |
| Chronic Care | `chronic-care.tsx` | **needs SOP** — DM, HTN, CKD longitudinal management, recall scheduling |

### Diagnostic & Support

| Module | Page File | SOP Reference |
|--------|-----------|---------------|
| CSSD | `cssd.tsx` | [15-cssd-sterilisation.md](15-cssd-sterilisation.md) |
| Diet & Kitchen | `diet-kitchen.tsx` | [13-diet-kitchen.md](13-diet-kitchen.md) |
| Ambulance | `ambulance.tsx` | [16-ambulance.md](16-ambulance.md) |
| Pharmacy Finance | `pharmacy-finance.tsx` | ← covered by [25-financial-reporting.md](25-financial-reporting.md) S3 |
| Documents | `documents.tsx` | **needs SOP** — document upload, categorisation, linkage to encounters |

### Administrative & Operational

| Module | Page File | SOP Reference |
|--------|-----------|---------------|
| Billing & Payments | `billing.tsx` | [07-billing-payments.md](07-billing-payments.md) |
| Insurance / TPA | `insurance.tsx` | [20-insurance-tpa.md](20-insurance-tpa.md) |
| Procurement & Indent | `procurement.tsx` / `indent.tsx` | [11-procurement-indent.md](11-procurement-indent.md) |
| Housekeeping | `housekeeping.tsx` | [14-housekeeping-linen.md](14-housekeeping-linen.md) |
| Facilities | `facilities.tsx` | [26-facilities-front-office.md](26-facilities-front-office.md) |
| Front Office | `front-office.tsx` | [26-facilities-front-office.md](26-facilities-front-office.md) |
| MRD | `mrd.tsx` | [12-mrd-records.md](12-mrd-records.md) |
| HR & Attendance | `hr.tsx` | [18-hr-attendance.md](18-hr-attendance.md) |
| Security | `security.tsx` | **needs SOP** — incident logging, CCTV, access control, visitor blacklist |
| Biomedical Engineering | `bme.tsx` | ← covered by 26-S1 (PPM, calibration) |
| Occupational Health | `occupational-health.tsx` | **needs SOP** — employee health screening, vaccination, fitness certificate |
| Camp | `camp.tsx` | **needs SOP** — outreach camp registration, screening, lab linkage, follow-up |
| Appointments | `appointments.tsx` | ← covered by 02, 24 |

### Management & Analytics

| Module | Page File | SOP Reference |
|--------|-----------|---------------|
| Dashboard | `dashboard.tsx` | ← covered by 21 (command center) |
| Command Center | `command-center.tsx` | [21-command-center.md](21-command-center.md) |
| Analytics | `analytics.tsx` | [22-analytics-reports.md](22-analytics-reports.md) |
| Reports | `reports.tsx` | [22-analytics-reports.md](22-analytics-reports.md) |
| Utilization Review | `utilization-review.tsx` | [23-utilization-review.md](23-utilization-review.md) |
| Case Management | `case-management.tsx` | ← covered by 23-S3 (discharge barriers) |
| Scheduling Admin | `scheduling.tsx` | [24-scheduling-admin.md](24-scheduling-admin.md) |
| Financial Reporting | (analytics Revenue tab) | [25-financial-reporting.md](25-financial-reporting.md) |
| Audit | `audit.tsx` | [19-audit-quality.md](19-audit-quality.md) |
| Quality | `quality.tsx` | [19-audit-quality.md](19-audit-quality.md) |
| Regulatory | `regulatory.tsx` | **needs SOP** — NABH/JCI document management, compliance register |
| Infection Control | `infection-control.tsx` | [17-infection-control.md](17-infection-control.md) |
| Retrospective | `retrospective.tsx` | **needs SOP** — post-discharge clinical review, coding correction, query management |
| TV Displays | `tv-displays.tsx` | ← covered by 26-S3 (token board → TV feed) |

### Configuration & Setup

| Module | Page File | SOP Reference |
|--------|-----------|---------------|
| System Settings | `admin/settings.tsx` (+ 25 sub-pages) | [27-system-settings.md](27-system-settings.md) |
| PACS / DICOM Config | `admin/settings/DeviceIntegrationsSettings.tsx` | [28-pacs-dicom.md](28-pacs-dicom.md) |
| Onboarding Wizard | `onboarding/` (16 steps) | ← covered by 27-S1 |
| Admin — Users | `admin/users.tsx` | ← covered by 27-S2 |
| Admin — Roles | `admin/roles.tsx` | ← covered by 27-S2 |
| Admin — Integration Hub | `admin/integration-hub.tsx` | ← covered by 27-S4 |
| Admin — NABH Indicators | `admin/nabh-indicators.tsx` | ← covered by 19-S3, 22-S4 |

### Education & Training

| Module | Page File | SOP Reference |
|--------|-----------|---------------|
| LMS (Learning Mgmt) | `lms.tsx` | **needs SOP** — CME tracking, training module assignment, completion certificates |
| PG Logbook | `pg-logbook.tsx` | **needs SOP** — resident procedure log, supervisor sign-off, competency milestones |

### Communication

| Module | Page File | SOP Reference |
|--------|-----------|---------------|
| Communications | `communications.tsx` | **needs SOP** — internal messaging, broadcast alerts, discharge instructions to patients |

---

## End-to-End Journey Narratives

Each journey below spans multiple modules. Actors, modules touched, and critical handoff points are identified. Use these as the specification for multi-module E2E tests.

---

### Journey A: Standard OPD → Lab → Pharmacy → Billing (Same Day, 5 Actors)

**Trigger**: Patient walks in for a new consultation.  
**Duration**: Same day (2–4 hours end-to-end).

```
[Patient arrives]
    ↓
01 · REGISTRATION — Receptionist registers patient → UHID issued
    ↓
02 · OPD CHECK-IN — Receptionist checks patient in → token issued
    ↓
02 · TRIAGE — Nurse records vitals → queue status updated
    ↓
02 · CONSULTATION — Doctor opens encounter → SOAP note → ICD-10 diagnosis
    ↓       ↓            ↓
03 LAB   04 PHARMACY   08 RADIOLOGY
order   prescription   imaging order
    ↓       ↓            ↓
03 · Lab tech receives → sample → result → critical value check
04 · Pharmacist receives Rx → dispense → batch tracking → patient collection
08 · Tech acquires image → radiologist reports
    ↓
07 · BILLING — Billing clerk generates invoice (consult + lab + pharmacy + radiology)
    ↓
Patient pays (cash / UPI / card)
    ↓
[Encounter closed. Records in MRD.]
```

**Critical handoffs**:
- OPD encounter → Lab order (doctor submits order; patient directed to phlebotomy).
- OPD encounter → Pharmacy Rx (automatic dispatch on consultation close).
- Lab result release → Doctor notification (critical value must be acknowledged ≤30 min).
- All services → Billing queue (auto-populated from each module's completed transaction).

**Existing tests**: JNY-HOS-001/002/003 (actor-perspective-journeys.spec.ts — automated).

---

### Journey B: Emergency → ICU → IPD → OT → Discharge (Multi-Day, 8 Actors)

**Trigger**: Patient brought by ambulance with RTA (Road Traffic Accident).  
**Duration**: 5–10 days.

```
[Ambulance call received]
    ↓
16 · AMBULANCE — Dispatcher assigns; driver dispatches → Emergency pre-alerted
    ↓
06 · EMERGENCY TRIAGE — Nurse triages (Red — immediate)
    ↓ (MLC flag triggered — IPC mandatory reporting)
06 · EMERGENCY ENCOUNTER — Doctor opens encounter → STAT orders → initial stabilisation
    ↓       ↓
03 STAT   10 BLOOD BANK crossmatch request (trauma protocol)
    ↓
06 → ICU ADMISSION — Doctor admits to ICU
    ↓
[ICU — Day 1-2]
    Nurse: nursing assessment, ventilator monitoring, MAR, I/O charting
    Doctor: daily ICU rounds, clinical notes, ventilator weaning
    Blood Bank: compatible units issued → Nurse administers transfusion (two-person check)
    ↓
09 · OT BOOKING — Surgeon books emergency surgery (fracture fixation)
    ↓
09 · PRE-OP — Anaesthesiologist pre-anaesthesia check → anaesthesia consent
15 · CSSD — Issues sterile instrument set to OT
    ↓
09 · OT — WHO checklist (Sign In → Time Out → Sign Out) → surgery performed
    ↓ (implant used → procurement traceability)
09 · POST-OP HANDOVER — OT → Recovery nurse (SBAR)
    ↓
[IPD — Day 3-N]
05 · IPD nursing: MAR, I/O, Braden scale, pressure area care, shift handovers
    Dietitian prescribes high-protein diet (13-diet-kitchen)
    Physiotherapist (PMR module) schedules rehabilitation
    ↓
05 · DISCHARGE — Doctor writes discharge summary → ICD-10 + ICD-10-PCS coded
    ↓
20 · INSURANCE — TPA claim submitted (trauma package pre-auth from day 1)
07 · BILLING — Final bill: room + nursing + OT + implant + pharmacy + lab + ICU charges
    ↓
12 · MRD — Case sheet reviewed, coded, filed. Trauma records retained 10 years.
    ↓
[Patient discharged. Follow-up: ortho OPD in 2 weeks.]
```

**Critical handoffs**:
- Emergency → ICU: admission order; bed state `^BEDSTATE` updated.
- ICU → OT: anaesthesiologist sign-off required before surgery proceeds.
- CSSD → OT: sterile set issue linked to surgical case.
- OT → IPD: post-op handover acknowledged by ward nurse.
- IPD → MRD: discharge summary signed before MRD can code.
- Billing → Insurance: claim package assembled from all module charges.

**Existing tests**: JNY-HOS-005 (multi-day IPD — partial); `— needs full trauma journey test`.

---

### Journey C: Maternity — Antenatal to Postnatal (Multi-Week, 6 Actors)

**Trigger**: Pregnant patient registers for antenatal care at 12 weeks.  
**Duration**: Weeks to months; delivery episode is multi-day.

```
[Patient registers at OPD]
    ↓
01 · REGISTRATION — UHID issued; antenatal booking flag set
    ↓
02 · OPD (Antenatal) — OB/GYN doctor → booking visit → EDD calculated → ANC schedule
    ↓
03 · LAB — ANC blood panel (Hb, blood group, VDRL, HIV, HbsAg, rubella IgG, urine)
08 · RADIOLOGY — Dating scan (USG); PCPNDT Form F completed; sex NOT disclosed
    ↓
[Recurring monthly → fortnightly → weekly OPD visits]
    Lab tests, growth scans (all PCPNDT-compliant), BP monitoring, supplements prescribed (pharmacy)
    ↓
[Week 38-40 — Labour onset]
    ↓
06 or 05 · ADMISSION — Direct IPD admission to Labour Ward
    ↓
    Nurse: partograph monitoring, vital signs, fetal heart rate
    Doctor: active management of labour
    ↓ (if C-section needed)
09 · OT — Emergency or elective C-section booked
10 · BLOOD BANK — Crossmatch ready (2 units RBC on hold for obstetric emergency)
15 · CSSD — Sterile drape set for OT
    ↓
[Delivery]
    Neonatal team present; baby resuscitation tray ready
    Baby record created immediately (UHID issued for newborn)
    PCPNDT — baby sex recorded on birth record; NOT on USG report
    ↓
[Postnatal — Day 1-3]
    Mother: vitals, lochia check, breastfeeding support, haemoglobin check
    Baby: birth weight, APGAR, newborn examination, BCG + Hepatitis B vaccine
    13 · DIET — Post-delivery diet plan by dietitian
    ↓
05 · DISCHARGE — Mother and baby discharge summary; infant vaccination schedule given
07 · BILLING — Maternity package billing (package rate if applicable) or itemised
12 · MRD — Birth certificate (Form 1 under RBD Act 1969); case sheet filed
    ↓
[Follow-up: OPD at 6 weeks postnatal]
```

**Critical handoffs**:
- Every USG → PCPNDT Form F must be filed before image taken; sex suppressed in DICOM and report.
- Labour → OT: rapid escalation path (< 30 min from decision to incision for emergency C-section).
- Delivery → Newborn record creation: UHID for baby must exist before any clinical actions on newborn.
- Discharge → MRD: birth certificate must be registered within 21 days (RBD Act).

**Existing tests**: `apps/web/e2e/scenarios/maternity-journey.spec.ts` (partial); `— needs full OPD→delivery→discharge chain test`.

---

### Journey D: Vendor → Purchase Order → GRN → Pharmacy Stock → Patient Dispensing (Procurement Chain, 5 Actors)

**Trigger**: Pharmacy pharmacist notices low stock of a critical drug; raises indent.  
**Duration**: 3–7 days (procurement TAT).

```
[Stock alert triggered]
    ↓
11 · INDENT — Pharmacist raises indent for drug (INN name, quantity, urgency: Urgent)
    ↓
11 · PROCUREMENT — Procurement Officer approves indent → creates PO
    Vendor selected from approved list (Drug Licence verified)
    PO includes: INN name, ATC code, quantity, delivery date
    PO approved (Hospital Admin for high-value) → sent to vendor
    ↓
[Vendor delivers goods]
    ↓
11 · GRN — Store Keeper receives delivery
    Verifies PO vs delivery challan
    Records batch number, expiry date (FEFO rule)
    QC check: count, packaging intact
    Stock incremented in pharmacy_stock table
    ↓
25 · VENDOR PAYMENT — Billing Clerk three-way match (PO = GRN = invoice) → payment processed
    ↓
[Days later — Patient prescription received]
    ↓
04 · PHARMACY DISPENSE — Pharmacist dispenses from newly received batch
    FEFO applied: oldest expiry dispensed first
    Batch traceable from PO → GRN → patient dispense
    If NDPS drug: NDPS register entry, dual witness
    ↓
[Audit trail: Batch X → PO-YYYY → GRN-YYYY → Patient UHID/Encounter]
```

**Critical handoffs**:
- Indent → PO: approval workflow (amount threshold routes to hospital admin).
- PO → GRN: three-way match must pass before payment (PO quantity = delivered quantity = invoice).
- GRN → Pharmacy stock: FEFO batch metadata persists to dispensing.
- Dispensing → NDPS register: controlled drug dispense creates immutable register entry.

**Existing tests**: JNY-EXTU-001 (actor-perspective-journeys.spec.ts — automated, covers PO→GRN→payment); `— needs pharmacy dispense end-of-chain assertion`.

---

### Journey E: New Hospital Setup → First Patient → Management Report (Full System Lifecycle, Admin + All Actors)

**Trigger**: Hospital signs up for MedBrains; first patient registered; management reviews first-day metrics.  
**Duration**: Day 0 (setup) + Day 1 (first patient) + Day 1 EOD (management review).

```
[Day 0 — Setup]
    ↓
27 · SYSTEM SETTINGS — Super Admin creates tenant → Hospital Admin completes onboarding wizard
    Departments created, beds configured, users created, roles assigned
    Drug formulary imported, lab catalog loaded, rate cards set
    Integrations configured: SMS, payment gateway, PACS
    ↓
28 · PACS CONFIG — PACS server registered → C-ECHO verified
    Modality registered → DMWL tested → Viewer configured
    ↓
[Day 1 — First Patient]
    ↓
01 · REGISTRATION — Receptionist registers first patient → UHID-2026-000001 issued
    ↓
24 · SCHEDULING — OPD slot confirmed (schedule published on Day 0)
    ↓
02 · OPD VISIT — Nurse vitals → Doctor consultation → ICD-10 → Lab order + Rx
    ↓
03 · LAB — Sample collected → result entered → released
04 · PHARMACY — Prescription dispensed → batch recorded
    ↓
07 · BILLING — Invoice generated → patient pays online (payment gateway) → receipt issued
    ↓
[Day 1 EOD — Management]
    ↓
21 · COMMAND CENTER — Hospital Admin reviews Day 1 census (1 patient, 1 encounter)
22 · ANALYTICS — OPD/Bed tab shows first data points
25 · FINANCIAL REPORT — Revenue tab shows first collection
19 · AUDIT — Audit officer reviews access log for Day 1
    ↓
[System is live. All modules exercised at least once.]
```

**Critical handoffs**:
- Onboarding → First patient: all mandatory masters (departments, beds, users, rate cards) must be complete before first registration.
- Payment gateway webhook → Invoice status: async payment confirmation must update invoice before receipt is issued.
- All day-1 transactions → Analytics: data pipeline must surface on Day 1 (no lag for same-day data).

**Existing tests**: `apps/web/e2e/scenarios/admin-setup.spec.ts` (partial — setup only); `— needs full Day-0-setup-to-Day-1-patient chain test`.

---

## Module Coverage Summary

| Status | Count |
|--------|-------|
| Has SOP (01–28) | 28 module clusters (~70 individual scenarios) |
| Covered within another SOP | ~20 sub-pages/tabs |
| **Needs SOP** | 14 modules |

### Modules That Need SOPs (backlog)

1. ICU (critical care protocols, ventilator management, sedation scoring)
2. Consent Management (procedure consent, research consent, withdrawal)
3. Care View (multi-patient task board for doctors and nurses)
4. Doctor My Day / Sign-offs (daily clinical workflow aggregation)
5. Order Sets (clinical bundles — sepsis, cardiac, post-op protocols)
6. Maternity (full antenatal-to-postnatal — partially in Journey C above)
7. Psychiatry (Mental Healthcare Act 2017 compliance)
8. Cath Lab (PTCA, stent traceability)
9. Endoscopy (procedure scheduling, sedation, biopsy)
10. Chronic Care (DM/HTN/CKD longitudinal management)
11. Occupational Health (employee health, vaccination, fitness)
12. Camp (outreach registration, screening, follow-up)
13. LMS / PG Logbook (training, CME, resident sign-offs)
14. Communications (internal messaging, discharge instructions, broadcasts)
