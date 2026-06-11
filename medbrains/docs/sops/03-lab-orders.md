---
module: lab-orders
priority: P0
status: draft
---

# SOP: Lab Orders & Results

## Overview
The Laboratory module handles the full diagnostic cycle: order placement (by doctors from any clinical module), sample collection scheduling, phlebotomy/specimen receipt, result entry by lab technicians, quality control, critical value notification, and result delivery to clinicians and patients. All tests are mapped to LOINC codes per NABL and MOHFW EHR Standards. Critical values trigger immediate alerts to the ordering physician.

## Actor Matrix

| Actor (Role) | Can Perform | Notes |
|---|---|---|
| `doctor` | Place lab orders, review results, acknowledge critical values | Orders from OPD, IPD, Emergency |
| `nurse` | View ordered tests, collect sample at bedside (IPD), record collection time | Cannot enter results |
| `lab_technician` | Receive orders, record sample receipt, enter results, flag QC failures | Primary actor for result entry |
| `patient` (portal) | View released results | Read-only; results released only after doctor review |
| `receptionist` | Register walk-in lab patients (external / camp samples) | No clinical access |

---

## Scenario 1: Doctor Orders Lab Tests from OPD Consultation — Actor: Doctor

**Actor**: `doctor`  
**Entry point**: Doctor is in an active OPD consultation (encounter `in_progress`)  
**Preconditions**: Patient has an open OPD encounter; lab test catalog populated with LOINC-mapped tests

**Steps**:
1. Doctor opens the "Lab Orders" panel within the consultation view.
2. Searches for test(s) by name or LOINC code (e.g., "CBC", "HbA1c", "Lipid Profile").
3. Selects tests; system checks for duplicate orders in the same encounter and warns.
4. Specifies urgency: Routine / Urgent / STAT.
5. Adds clinical indication (ICD-10 code pre-filled from diagnosis; editable).
6. Submits order → order status `pending_collection`; lab department notified.
7. Lab order number generated (format: `LAB-YYYYNNNNNN`).

**Exit / Outcome**: Lab order created with LOINC codes; lab module receives order; patient directed to phlebotomy counter (OPD) or nurse collects (IPD).  
**Regulatory note**: NABL ISO 15189 §5.4 — order must include clinical indication; LOINC code required (MOHFW EHR 2016); NABH LAB.1.  
**Existing test**: JNY-HOS-002 in `apps/web/e2e/scenarios/actor-perspective-journeys.spec.ts` (automated — covers lab order issuance)

---

## Scenario 2: Lab Technician Receives Sample and Enters Result — Actor: Lab Technician

**Actor**: `lab_technician`  
**Entry point**: Lab module → Pending Orders queue  
**Preconditions**: Lab order is `pending_collection`; sample received at lab counter

**Steps**:
1. Lab technician opens Pending Orders; sees order with patient name, UHID, tests ordered, urgency.
2. Scans or manually enters sample tube barcode → links barcode to order.
3. Records sample type (blood, urine, swab, etc.), collection time, and collector (auto-filled if nurse collected in ward).
4. Changes order status `pending_collection` → `sample_received`.
5. Performs analysis; enters numeric or coded result for each test parameter.
6. System validates result against reference range (age/sex-adjusted); flags abnormal values.
7. Flags critical values if outside defined panic ranges (e.g., K⁺ > 6.5 mEq/L, Hb < 6 g/dL).
8. Lab technician saves result → status `result_entered`; supervisor review queued if required by QC policy.
9. On supervisor approval (or auto-release for routine tests without QC hold): status → `released`.
10. Ordering doctor receives in-app notification.

**Exit / Outcome**: Result released; ordering doctor notified; result visible in patient record under encounter.  
**Regulatory note**: NABL ISO 15189 §5.8 — result review and authorization; NABH LAB.7 — critical value reporting ≤30 min from result entry.  
**Existing test**: JNY-HOS-002 in `apps/web/e2e/scenarios/actor-perspective-journeys.spec.ts` (automated — partial; result entry step needs assertion)

---

## Scenario 3: Doctor Reviews Critical Lab Value and Acknowledges — Actor: Doctor

**Actor**: `doctor`  
**Entry point**: Doctor receives critical value alert (in-app notification or SMS)  
**Preconditions**: Lab result is `released` with at least one critical-value flag; ordering doctor is identified

**Steps**:
1. Doctor opens critical value notification → lands on patient's lab result panel.
2. System displays result, reference range, and "CRITICAL" badge.
3. Doctor reviews result in the context of the patient's current condition.
4. Records action taken: "Patient reviewed — oral potassium supplement ordered" (free text + structured action type).
5. Clicks "Acknowledge Critical Value" → timestamps acknowledgement.
6. If doctor not reachable within 30 min, system escalates to covering doctor / department head.

**Exit / Outcome**: Critical value acknowledged with documented action; acknowledgement timestamp saved for audit; escalation chain halted.  
**Regulatory note**: NABH LAB.7 — critical value reporting must be acknowledged within defined TAT; IPSG Goal 2 — results communicated to responsible clinician.  
**Existing test**: `— needs test`

---

## Scenario 4: Patient Views Released Results via Portal — Actor: Patient (portal)

**Actor**: `patient` (authenticated portal session)  
**Entry point**: Patient logs in to patient portal → My Reports  
**Preconditions**: Lab result status is `released`; patient portal is enabled for the tenant

**Steps**:
1. Patient logs in using UHID + mobile OTP.
2. Opens "My Reports" tab → sees list of released lab results sorted by date.
3. Selects a result → PDF-formatted lab report displayed (logo, patient name, UHID, test values, reference ranges, lab director signature).
4. Patient can download PDF or share via WhatsApp (if enabled).
5. Unreleased / held results are hidden from patient view.

**Exit / Outcome**: Patient views/downloads their lab report; access logged in audit trail.  
**Regulatory note**: IT Act 2000 §43A — patient data privacy; NABH — patients have right to health records; results never shown before doctor release.  
**Existing test**: `— needs test`
