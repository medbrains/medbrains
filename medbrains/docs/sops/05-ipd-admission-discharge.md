---
module: ipd-admission-discharge
priority: P0
status: draft
---

# SOP: IPD Admission & Discharge

## Overview
The Inpatient Department (IPD) module manages the complete inpatient lifecycle: admission from OPD/Emergency, bed assignment, daily nursing assessments, Medication Administration Record (MAR), Intake/Output (I/O) charting, multi-day clinical notes, ward rounds, nursing shift handovers, and discharge with clinical summary and billing clearance. Continuity of care across shifts is enforced via handover acknowledgement. This is the most complex module in terms of time-span and number of actors.

## Actor Matrix

| Actor (Role) | Can Perform | Notes |
|---|---|---|
| `doctor` | Admit, write orders, daily notes, discharge summary | Source of all clinical decisions |
| `nurse` | Receive patient, nursing assessment, MAR, I/O, handovers, ward vitals | Shift-bound actor |
| `billing_clerk` | Track advance, daily charges, generate final bill at discharge | Cannot edit clinical data |
| `receptionist` | Assist with admission paperwork, print arm band | Non-clinical support |
| `hospital_admin` | Override bed assignment, bed transfer | Audit trail required |

---

## Scenario 1: Doctor Admits Patient from OPD Encounter — Actor: Doctor

**Actor**: `doctor`  
**Entry point**: Doctor is in an active OPD consultation → clicks "Admit Patient"  
**Preconditions**: Patient has active OPD encounter; available inpatient bed exists in requested ward

**Steps**:
1. Doctor opens "Admit Patient" dialog from consultation.
2. Selects ward type (General / Semi-Private / Private / ICU) and reason for admission.
3. Enters provisional diagnosis (ICD-10) and initial admission orders (diet, activity, monitoring).
4. System checks available beds and suggests options; doctor confirms bed.
5. Bed status changes `available` → `occupied`; `^BEDSTATE` YottaDB global updated.
6. Admission record created in `ipd_admissions` table; admit time recorded.
7. Nurse station receives admission alert; arm band printing triggered.
8. Billing receives admission event; advance payment prompted if applicable.

**Exit / Outcome**: IPD admission record active; bed occupied; nurse ward notified; OPD encounter linked to IPD admission.  
**Regulatory note**: NABH IPD.1 — admission criteria documented; consent for admission must be obtained (NABH IPD.2); IPSG Goal 1 — arm band with two identifiers.  
**Existing test**: `apps/web/e2e/scenarios/ipd-admission.spec.ts` (partial); JNY-HOS-005 covers multi-day continuity

---

## Scenario 2: Nurse Receives Patient and Completes Nursing Assessment — Actor: Nurse

**Actor**: `nurse`  
**Entry point**: Nurse opens IPD Ward → New Admissions panel; sees new patient alert  
**Preconditions**: IPD admission record created by doctor; patient physically arrived in ward

**Steps**:
1. Nurse opens patient record → Nursing Assessment tab.
2. Records admission vitals: BP, pulse, temperature, SpO₂, weight (mandatory before any medication).
3. Completes initial nursing assessment: allergy history, current medications (reconciliation), fall risk (Morse Fall Scale — mandatory for patients ≥60 or mobility impaired), pressure ulcer risk (Braden Scale), pain score.
4. Confirms consent form(s) signed (admission consent, procedure consent if applicable).
5. Records arm band applied — two identifiers verified (name + UHID).
6. Activates MAR for doctor-ordered medications; checks first-dose timing.
7. Saves assessment → patient status `admission_complete`.

**Exit / Outcome**: Nursing assessment documented; fall risk and Braden scores saved; MAR activated; arm band confirmed.  
**Regulatory note**: NABH IPD.3 — nursing assessment within 2 hours of admission; IPSG Goal 6 — fall risk assessment mandatory; IPSG Goal 1 — two-identifier arm band; NABH MOM.3 — medication reconciliation at admission.  
**Existing test**: JNY-HOS-005 in `apps/web/e2e/scenarios/actor-perspective-journeys.spec.ts` (automated — partial; assessment fields need assertion)

---

## Scenario 3: Nurse Manages Multi-Day MAR, I/O, and Shift Handover — Actor: Nurse

**Actor**: `nurse`  
**Entry point**: Nurse logs in at start of shift; opens IPD Ward → MAR / I/O for assigned patients  
**Preconditions**: Patient is admitted with active MAR; previous shift nurse completed handover; current time is within nurse's shift window

**Steps (repeated each shift across multiple days)**:
1. **MAR Administration**:
   - Nurse opens MAR for patient; sees scheduled medications for current shift.
   - For each due medication: confirms patient identity (name + arm band), scans barcode if available.
   - Records administration: status (given / held / refused / missed), actual time, route, dose given, administering nurse.
   - For held medications: records reason (patient fasting, refusal, unavailability).
2. **I/O Charting**:
   - Nurse opens I/O chart; records oral intake (ml), IV fluids (ml, rate), urine output (ml), drain/tube output (ml).
   - System calculates running 24h balance.
3. **Clinical Notes**:
   - Nurse records shift observation note: behaviour, wound status, IV site, patient complaints.
4. **Shift Handover**:
   - Outgoing nurse opens Handover panel; selects incoming nurse.
   - Enters handover note (pending tasks, warnings, concerns).
   - Incoming nurse must acknowledge handover within the system before outgoing nurse can close shift.
5. Repeat for each subsequent shift/day until discharge.

**Exit / Outcome**: MAR entries timestamped per shift; I/O balance computed per 24h; handover acknowledged; complete nursing care record across all inpatient days.  
**Regulatory note**: NABH IPD.7 — nursing care plan documented; IPSG Goal 2 — shift handover standardised communication (SBAR); NABH MOM.5 — MAR for every administered drug; IPSG Goal 1 — identity check before every medication.  
**Existing test**: JNY-HOS-005 in `apps/web/e2e/scenarios/actor-perspective-journeys.spec.ts` (automated — covers MAR, I/O, handover over 3 simulated days)

---

## Scenario 4: Doctor + Billing Clerk Complete Discharge — Actor: Doctor + Billing Clerk

**Actor**: `doctor` then `billing_clerk`  
**Entry point**: Doctor opens IPD → patient record → Discharge  
**Preconditions**: Patient is clinically stable; all pending orders resolved; MAR closed for final shift

**Steps**:
1. **Doctor (discharge summary)**:
   - Opens Discharge Summary form; reviews full inpatient course.
   - Records: admission diagnosis, final diagnosis (ICD-10), procedures performed, clinical course summary, discharge condition, follow-up instructions, medications at discharge.
   - Signs discharge summary electronically → status `discharge_summary_signed`.
2. **Billing Clerk (final bill)**:
   - Opens Billing → IPD tab → locate admission by patient/UHID.
   - Reviews all charges: room, nursing, doctor visits, lab, pharmacy, procedures, consumables.
   - Applies discounts/TPA settlement if applicable.
   - Generates final invoice; records payment (cash / card / insurance settlement).
   - Issues "No Dues Certificate" → patient cleared for physical discharge.
3. **Nurse (physical discharge)**:
   - Confirms "No Dues Certificate" received.
   - Removes arm band; records discharge time; updates bed status `occupied` → `dirty` (for housekeeping).
4. Bed enters housekeeping queue for cleaning before next admission.

**Exit / Outcome**: Discharge summary signed; final bill settled; arm band removed; bed released for housekeeping; IPD admission status `discharged`.  
**Regulatory note**: NABH IPD.8 — discharge summary within 24h; NABH OPD.5 — discharge instructions to patient in writing; D&C Act — if NDPS drugs at discharge, record in register; IPSG — medication list given to patient.  
**Existing test**: JNY-HOS-005 in `apps/web/e2e/scenarios/actor-perspective-journeys.spec.ts` (automated — billing summary assertion present)
