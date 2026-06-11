---
module: housekeeping-linen
priority: P1
status: draft
---

# SOP: Housekeeping & Linen

## Overview
The Housekeeping module manages cleaning task assignment, room turnaround (post-discharge / post-procedure), bio-medical waste (BMW) segregation logging, and linen lifecycle (issue, soiled collection, laundry, quality check, condemnation). It integrates with IPD (bed release triggers cleaning task) and OT (post-surgery room turnaround). BMW management follows BMW Rules 2016 (MoEFCC). Infection control indicators (cleaning compliance, turnaround time) are visible to the Infection Control Officer.

## Actor Matrix

| Actor (Role) | Can Perform | Notes |
|---|---|---|
| `housekeeping_staff` | Log cleaning tasks, BMW segregation, linen movement | Field execution actor |
| `facilities_manager` | Assign tasks, review compliance, approve condemnation | Supervisory role |
| `nurse` | Trigger room cleaning request (post-discharge / post-procedure) | Clinical initiator |
| `infection_control_officer` | View BMW logs, cleaning compliance reports | Read-only monitoring |

---

## Scenario 1: Nurse Triggers Room Cleaning After Patient Discharge — Actor: Nurse → Housekeeping Staff

**Actor**: `nurse` (trigger) → `housekeeping_staff` (execution)  
**Entry point**: Nurse completes discharge process; bed status → `dirty`  
**Preconditions**: Patient physically discharged from ward; arm band removed

**Steps**:
1. Nurse confirms discharge in system → bed status auto-changes `occupied` → `dirty`.
2. System auto-creates a housekeeping task: "Terminal Cleaning — Bed [X], Ward [Y]" with priority based on next admission demand.
3. Housekeeping staff receives task on their module queue (or mobile device if integrated).
4. Staff performs terminal cleaning per protocol: bed, mattress, IV pole, call button, floor, bathroom.
5. Records task completion: start time, end time, cleaning agent used, staff ID.
6. For rooms with confirmed infection (isolation rooms): records enhanced cleaning (sporicidal agent) — flags infection control officer.
7. Facilities manager spot-checks (random sample); records inspection result (pass/fail).
8. On pass: bed status → `clean_available` → automatically visible for new admissions.

**Exit / Outcome**: Bed available for new admission; cleaning record complete; turnaround time calculated.  
**Regulatory note**: NABH IC.4 — terminal cleaning protocol documented; BMW 2016 — proper disposal of bio-waste in room; IPSG Goal 5 — HAI prevention; isolation room enhanced cleaning per CDC/NABH protocol.  
**Existing test**: `— needs test`

---

## Scenario 2: Housekeeping Staff Logs Bio-Medical Waste Segregation — Actor: Housekeeping Staff

**Actor**: `housekeeping_staff`  
**Entry point**: Housekeeping → BMW Log → New Entry  
**Preconditions**: Ward has generated biomedical waste; waste segregated at source by nursing/clinical staff

**Steps**:
1. Staff opens BMW log entry form; selects ward/department.
2. Records quantity for each category:
   - Yellow bag (infectious/pathological waste): weight (kg).
   - Red bag (recyclable contaminated plastic): weight (kg).
   - Blue/white puncture-proof (sharps): count and weight.
   - Black bag (general solid waste): weight (kg).
   - Cytotoxic/pharmaceutical waste (yellow with black stripe): weight (kg).
3. Records collection time and transporter name (authorised Common Bio-Medical Waste Treatment Facility — CBWTF).
4. Generates daily manifest for CBWTF (printed or digital as per CBWTF agreement).
5. CBWTF vehicle arrival time and signature recorded for chain-of-custody.
6. Monthly summary report auto-generated for Pollution Control Board submission.

**Exit / Outcome**: BMW log complete; manifest generated; chain-of-custody recorded.  
**Regulatory note**: BMW Rules 2016 (MoEFCC) — mandatory daily log, separate colour-coded bags, CBWTF contract required, annual report to State Pollution Control Board.  
**Existing test**: `— needs test`

---

## Scenario 3: Facilities Manager Condemns Worn Linen — Actor: Facilities Manager

**Actor**: `facilities_manager`  
**Entry point**: Housekeeping → Linen Management → Condemnation  
**Preconditions**: Linen items have been flagged as worn/damaged by housekeeping staff during quality check

**Steps**:
1. Housekeeping staff flags linen item as "damaged" during inspection: records item ID, type, and damage description.
2. Facilities manager opens condemnation queue; reviews flagged items.
3. Inspects samples physically; approves or rejects condemnation.
4. For approved condemnation: records reason (worn beyond repair, torn, stained permanently, infection risk).
5. Condemned items written off from linen inventory; stock decremented.
6. Physical disposal: items cut to prevent re-entry into supply chain; disposal method recorded (BMW if contaminated, general waste if not).
7. Generates condemnation report for accounts (asset write-off).

**Exit / Outcome**: Condemned linen removed from inventory; write-off report generated; physical disposal documented.  
**Regulatory note**: NABH — linen management policy documented; BMW 2016 — contaminated linen disposal per infectious waste protocol; accounts write-off per hospital financial policy.  
**Existing test**: `— needs test`
