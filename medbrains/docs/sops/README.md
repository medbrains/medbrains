# Actor-Perspective SOPs — MedBrains HMS

Each file in this folder is a Standard Operating Procedure for one module cluster. Every SOP lists the actors who interact with that module and defines 3–4 concrete scenarios showing what each actor does, in what order, and what the outcome must be.

These documents are the **source-of-truth for test authoring**. When you add or fix an E2E test, the scenario it implements must exist here first.

---

## Template

```markdown
---
module: slug
priority: P0 | P1 | P2
status: draft | review | approved
---

# SOP: Module Name

## Overview
One paragraph describing the module, its users, and its clinical/operational significance.

## Actor Matrix
| Actor (Role) | Can Perform | Notes |
|---|---|---|
| role_slug | action description | any constraint |

---

## Scenario N: Action Title — Actor: Role
**Actor**: role_slug
**Entry point**: where/how the actor begins
**Preconditions**: what must already exist in the system
**Steps**:
1. step one
2. step two
**Exit / Outcome**: what is produced or confirmed
**Regulatory note**: NABH §x / IPSG / NDPS / D&C Act reference
**Existing test**: JNY-xxx in path/to/spec.ts — OR — `— needs test`
```

---

## Module Index

| # | File | Module | Priority | Status | Scenarios |
|---|------|--------|----------|--------|-----------|
| 01 | [01-patient-registration.md](01-patient-registration.md) | Patient Registration | P0 | draft | 4 |
| 02 | [02-opd-visit.md](02-opd-visit.md) | OPD Visit | P0 | draft | 4 |
| 03 | [03-lab-orders.md](03-lab-orders.md) | Lab Orders & Results | P0 | draft | 4 |
| 04 | [04-pharmacy-dispensing.md](04-pharmacy-dispensing.md) | Pharmacy Dispensing | P0 | draft | 4 |
| 05 | [05-ipd-admission-discharge.md](05-ipd-admission-discharge.md) | IPD Admission & Discharge | P0 | draft | 4 |
| 06 | [06-emergency-casualty.md](06-emergency-casualty.md) | Emergency / Casualty | P0 | draft | 4 |
| 07 | [07-billing-payments.md](07-billing-payments.md) | Billing & Payments | P0 | draft | 4 |
| 08 | [08-radiology.md](08-radiology.md) | Radiology | P1 | draft | 4 |
| 09 | [09-operation-theatre.md](09-operation-theatre.md) | Operation Theatre | P1 | draft | 4 |
| 10 | [10-blood-bank.md](10-blood-bank.md) | Blood Bank | P1 | draft | 4 |
| 11 | [11-procurement-indent.md](11-procurement-indent.md) | Procurement & Indent | P1 | draft | 4 |
| 12 | [12-mrd-records.md](12-mrd-records.md) | MRD / Medical Records | P1 | draft | 3 |
| 13 | [13-diet-kitchen.md](13-diet-kitchen.md) | Diet & Kitchen | P1 | draft | 3 |
| 14 | [14-housekeeping-linen.md](14-housekeeping-linen.md) | Housekeeping & Linen | P1 | draft | 3 |
| 15 | [15-cssd-sterilisation.md](15-cssd-sterilisation.md) | CSSD Sterilisation | P2 | draft | 3 |
| 16 | [16-ambulance.md](16-ambulance.md) | Ambulance | P2 | draft | 3 |
| 17 | [17-infection-control.md](17-infection-control.md) | Infection Control | P2 | draft | 3 |
| 18 | [18-hr-attendance.md](18-hr-attendance.md) | HR & Attendance | P2 | draft | 3 |
| 19 | [19-audit-quality.md](19-audit-quality.md) | Audit & Quality | P2 | draft | 3 |
| 20 | [20-insurance-tpa.md](20-insurance-tpa.md) | Insurance & TPA | P2 | draft | 4 |
| 21 | [21-command-center.md](21-command-center.md) | Command Center (Live Dashboard) | P0 | draft | 4 |
| 22 | [22-analytics-reports.md](22-analytics-reports.md) | Analytics & Reports | P0 | draft | 4 |
| 23 | [23-utilization-review.md](23-utilization-review.md) | Utilization Review | P1 | draft | 4 |
| 24 | [24-scheduling-admin.md](24-scheduling-admin.md) | Scheduling Administration | P1 | draft | 4 |
| 25 | [25-financial-reporting.md](25-financial-reporting.md) | Financial Reporting & Revenue Cycle | P1 | draft | 4 |
| 26 | [26-facilities-front-office.md](26-facilities-front-office.md) | Facilities & Front Office Ops | P1 | draft | 4 |
| 27 | [27-system-settings.md](27-system-settings.md) | System Settings & Configuration | P0 | draft | 4 |
| 28 | [28-pacs-dicom.md](28-pacs-dicom.md) | PACS & DICOM Configuration | P1 | draft | 4 |
| 29 | [29-cross-module-journeys.md](29-cross-module-journeys.md) | Cross-Module Journey Map (Master) | P0 | draft | 5 journeys |

---

## Existing Test Cross-Reference

| Journey Case | SOP Scenarios |
|---|---|
| JNY-PAT-001 (public kiosk booking) | 01-S1, 02-S4 |
| JNY-HOS-001 (receptionist→doctor) | 02-S1, 02-S2 |
| JNY-HOS-002 (lab order) | 03-S1, 03-S2 |
| JNY-HOS-003 (pharmacy dispense) | 04-S1, 04-S2 |
| JNY-HOS-005 (multi-day IPD) | 05-S3, 05-S4 |
| JNY-EXTU-001 (vendor PO→GRN) | 11-S2, 11-S3 |
| JNY-EXTS-001/003 (FHIR+bridge) | system-to-system, not in SOP scope |
