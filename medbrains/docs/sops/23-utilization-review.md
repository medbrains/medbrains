---
module: utilization-review
priority: P1
status: draft
---

# SOP: Utilization Review

## Overview
Utilization Review (UR) monitors the appropriateness and efficiency of inpatient care: admission criteria, continued-stay reviews, discharge readiness, Length of Stay (LOS) outliers, and payer-side scrutiny. The module is used by the Utilization Reviewer and Case Manager to ensure patients are admitted at the right level of care, are progressing toward discharge, and that payer requirements (TPA, CGHS, insurance) are met. It links to IPD (clinical data), Billing (cost per case), and Insurance (pre-auth/claim status).

## Actor Matrix

| Actor (Role) | Can Perform | Notes |
|---|---|---|
| `utilization_reviewer` | Admission review, concurrent review, LOS monitoring, payer queries | Primary UR role |
| `case_manager` | Discharge planning, barrier tracking, referral coordination | Care coordination focus |
| `doctor` | Respond to UR queries, document medical necessity | Clinical justification |
| `billing_clerk` | View UR-approved LOS for billing | Read-only UR data |
| `hospital_admin` | UR dashboard, LOS outlier reports | Management oversight |

---

## Scenario 1: Utilization Reviewer Performs Admission Review — Actor: Utilization Reviewer

**Actor**: `utilization_reviewer`  
**Entry point**: Utilization Review → Pending Admission Reviews  
**Preconditions**: Patient admitted to IPD; admission review not yet completed (typically within 24h of admission)

**Steps**:
1. UR opens pending admission; reviews: admitting diagnosis, clinical notes, vital signs, and investigation results.
2. Applies admission criteria (InterQual / Milliman Care Guidelines or hospital-defined criteria): does the patient meet criteria for inpatient care vs observation vs outpatient?
3. Documents decision: **Approved** / **Needs Clarification** / **Not Meeting Criteria**.
4. If "Needs Clarification": sends query to admitting doctor with specific question (e.g., "Please document oxygen requirement or ambulation limitation to support admission").
5. Doctor responds in system; UR reviews response and makes final determination.
6. If insurance/TPA case: pre-auth linked; UR approval triggers or supports pre-auth documentation.
7. Approval stamped on admission with UR officer name, date, and criteria version used.

**Exit / Outcome**: Admission reviewed and approved (or escalated); criteria documentation on record; TPA-ready.  
**Regulatory note**: IRDAI — insurance claim validity requires documented medical necessity; NABH — UR is part of Clinical Audit programme; InterQual/MCG criteria as evidence base.  
**Existing test**: `— needs test`

---

## Scenario 2: Utilization Reviewer Monitors LOS Outliers — Actor: Utilization Reviewer

**Actor**: `utilization_reviewer`  
**Entry point**: Utilization Review → LOS Dashboard  
**Preconditions**: IPD admissions exist; Geometric Mean LOS benchmarks configured per DRG or diagnosis group

**Steps**:
1. UR opens LOS Dashboard; sees all current inpatients sorted by LOS (longest at top).
2. Views each patient's:
   - Actual LOS vs Geometric Mean LOS for their DRG/diagnosis group.
   - LOS outlier flag: "Expected Discharge Date" (EDD) — set at admission based on diagnosis benchmark.
   - Days beyond EDD (negative number = ahead of schedule, positive = overdue).
3. Drills into outlier cases (LOS > 1.5× GMLOS):
   - Reviews clinical notes for justification of extended stay.
   - Checks for discharge barriers (see Scenario 3).
4. Sends "Concurrent Review" query to doctor for outlier cases: "Patient LOS exceeds benchmark by X days. Please document clinical necessity for continued stay."
5. Doctor responds; UR approves continued stay or flags for physician advisor review.
6. Generates weekly LOS outlier report for Medical Director.

**Exit / Outcome**: LOS outliers identified and reviewed; continued-stay justification documented; report generated for medical leadership.  
**Regulatory note**: IRDAI — prolonged stay claims scrutinised; CGHS package rates — LOS within package expected; NABH — LOS as a quality indicator (QPS.2).  
**Existing test**: `— needs test`

---

## Scenario 3: Case Manager Identifies and Resolves Discharge Barriers — Actor: Case Manager

**Actor**: `case_manager`  
**Entry point**: Utilization Review → Active Cases → patient record → Discharge Barriers  
**Preconditions**: Patient identified as approaching or exceeding expected discharge date; discharge barriers exist

**Steps**:
1. Case manager opens patient's UR record; opens Discharge Barriers panel.
2. Reviews flags auto-generated or manually raised:
   - Clinical barrier: patient clinically not ready (doctor must document specific criteria still met for stay).
   - Social barrier: no caregiver at home; patient lives alone.
   - Financial barrier: patient cannot pay; requires social work referral or charity care.
   - Payer barrier: TPA awaiting additional documents before approving continued stay.
   - Placement barrier: patient needs nursing home / rehab facility but placement not arranged.
3. For each barrier: case manager assigns action and owner with deadline.
4. Coordinates with: social worker (social barriers), insurance officer (payer barriers), rehab/nursing home liaisons (placement).
5. Documents resolution progress daily until all barriers cleared.
6. Flags patient for discharge planning conference if barriers persist > 48 hours.

**Exit / Outcome**: Discharge barriers documented with action plan; interdisciplinary coordination triggered; discharge timeline updated.  
**Regulatory note**: NABH COP.10 — discharge planning documented from admission; IPSG Goal 2 — discharge information communicated to receiving facility; consumer Protection Act — patient must be informed of discharge plan.  
**Existing test**: `— needs test`

---

## Scenario 4: Hospital Admin Reviews Payer Mix and Denial Rate — Actor: Hospital Admin

**Actor**: `hospital_admin`  
**Entry point**: Utilization Review → Management Reports  
**Preconditions**: UR reviews and insurance claim data for the period exist

**Steps**:
1. Admin opens UR Management Report; selects period.
2. Views:
   - **Admission approval rate**: % admissions meeting criteria on first review vs requiring clarification.
   - **Denial rate by payer**: % claims denied by each TPA / insurer; reason categories (not medically necessary, non-covered service, documentation incomplete, etc.).
   - **LOS efficiency**: average LOS vs GMLOS by department and DRG.
   - **Readmission rate**: unplanned readmissions within 30 days (clinical quality signal).
   - **Revenue at risk**: total value of claims in denied or pending-dispute status.
3. Identifies TPA with high denial rate; schedules review meeting with TPA medical team.
4. Identifies clinical department with persistent LOS outliers; schedules physician advisory review.
5. Exports report for Finance Committee and Medical Audit Committee.

**Exit / Outcome**: Management has quantified picture of UR efficiency, payer performance, and revenue at risk; action plan initiated.  
**Regulatory note**: IRDAI — denial reasons must be documented; NABH — UR data feeds into hospital quality programme; Board-level reporting requires payer mix and denial rate visibility.  
**Existing test**: `— needs test`
