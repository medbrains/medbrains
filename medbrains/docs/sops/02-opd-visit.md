---
module: opd-visit
priority: P0
status: draft
---

# SOP: OPD Visit

## Overview
The Outpatient Department (OPD) module manages the full lifecycle of an outpatient encounter: token issuance, triage vitals, doctor consultation, clinical notes, orders (lab, pharmacy, radiology), and follow-up scheduling. It is the highest-volume module in the system, touching virtually every clinical role. A single OPD visit can be the entry point for lab, pharmacy, billing, and IPD admission workflows.

## Actor Matrix

| Actor (Role) | Can Perform | Notes |
|---|---|---|
| `patient` (public) | Self check-in via QR token at kiosk | Token must be pre-issued from registration |
| `receptionist` | Check-in patient, add to doctor queue, reschedule | Cannot open consultation |
| `nurse` | Enter triage vitals, update queue status | Must complete vitals before doctor starts |
| `doctor` | Open consultation, clinical notes, issue orders, refer, admit | Primary actor for encounter content |
| `hospital_admin` | Override queue, reassign doctor | Audit trail required |

---

## Scenario 1: Receptionist Checks In Registered Patient — Actor: Receptionist

**Actor**: `receptionist`  
**Entry point**: Patient arrives at front desk with UHID or token; receptionist opens OPD → Today's Queue  
**Preconditions**: Patient has an existing UHID; OPD appointment booked (same-day or scheduled)

**Steps**:
1. Receptionist searches by UHID, name, or token number.
2. Locates appointment → verifies identity (name + DOB — two-point check).
3. Changes appointment status from `scheduled` → `checked_in`.
4. Confirms department and doctor; reassigns if necessary (doctor absent).
5. Prints or displays queue token to patient.
6. Patient appears in the doctor's queue screen.

**Exit / Outcome**: Appointment status `checked_in`; patient visible in doctor's live queue; token issued.  
**Regulatory note**: NABH OPD.1 — two-identifier verification at every clinical touchpoint; IPSG Goal 1.  
**Existing test**: JNY-HOS-001 in `apps/web/e2e/scenarios/actor-perspective-journeys.spec.ts` (automated — covers receptionist→doctor handoff)

---

## Scenario 2: Doctor Opens Consultation and Issues Orders — Actor: Doctor

**Actor**: `doctor`  
**Entry point**: Doctor opens OPD → My Queue; sees checked-in patients  
**Preconditions**: Patient is `checked_in` in doctor's queue; nurse has entered triage vitals (or doctor proceeds without)

**Steps**:
1. Doctor clicks patient name → opens Consultation view.
2. Reviews chief complaint, previous visits, allergies, and current medications.
3. Records SOAP note (Subjective, Objective, Assessment, Plan) in structured fields.
4. Selects ICD-10 diagnosis code(s) from search — at least one required to complete encounter.
5. Issues lab orders (if needed) → pre-populated tests sent to Lab module.
6. Issues prescription → pre-populated to Pharmacy dispensing queue.
7. Issues radiology orders (if needed) → sent to Radiology module.
8. Selects follow-up: discharge, refer, or schedule next appointment.
9. Closes consultation → status changes to `completed`.

**Exit / Outcome**: Encounter closed with ICD-10 code; lab/pharmacy/radiology orders dispatched; clinical note saved in audit-immutable log.  
**Regulatory note**: NABH OPD.2 — structured clinical documentation; ICD-10 coding mandatory (MOHFW EHR Standards 2016); IPSG Goal 3 — medication reconciliation at every encounter.  
**Existing test**: JNY-HOS-001 in `apps/web/e2e/scenarios/actor-perspective-journeys.spec.ts` (automated)

---

## Scenario 3: Nurse Enters Triage Vitals — Actor: Nurse

**Actor**: `nurse`  
**Entry point**: Nurse opens OPD → Triage / Vitals panel; sees all checked-in patients awaiting vitals  
**Preconditions**: Patient is `checked_in`; no triage vitals recorded yet for this visit

**Steps**:
1. Nurse selects patient from the triage queue.
2. Records: temperature (°C), pulse (bpm), BP (mmHg systolic/diastolic), SpO₂ (%), respiratory rate, height (cm), weight (kg).
3. System auto-calculates BMI and flags abnormal values (e.g., SpO₂ < 94%, BP > 180/110).
4. Nurse records pain score (0–10 NRS) and chief complaint verbatim.
5. Saves vitals → patient status changes to `vitals_recorded`; doctor sees updated queue.
6. If critical value detected (SpO₂ < 90%): system prompts nurse to escalate to Emergency immediately.

**Exit / Outcome**: Triage vitals saved and visible in doctor's consultation view; queue status updated; critical-value alert fired if triggered.  
**Regulatory note**: NABH OPD.3 — triage assessment documented; IPSG Goal 6 — fall risk assessed when relevant (add Morse Fall Scale for patients ≥60 years or high-risk).  
**Existing test**: `— needs test`

---

## Scenario 4: Patient Self Check-In via QR Token at Kiosk — Actor: Patient (public)

**Actor**: `patient` (public kiosk session)  
**Entry point**: Patient scans printed QR code or enters token number at kiosk  
**Preconditions**: Patient registered and has issued OPD token; appointment is for today; doctor is present

**Steps**:
1. Kiosk displays "Check In" screen; patient scans QR or types token.
2. System verifies token validity (date, doctor, department).
3. Displays patient name and appointment details for confirmation — patient taps "Confirm".
4. Status changes from `scheduled` → `checked_in`.
5. Kiosk displays estimated wait time (position in queue) and department location.
6. Optional: kiosk asks patient to update any changes (mobile number, address) — saved to record.

**Exit / Outcome**: Patient self-checked in; position in doctor's queue assigned; wait time displayed.  
**Regulatory note**: NABH OPD.1 — identity confirmation still required (kiosk verifies name shown to patient).  
**Existing test**: JNY-PAT-001 in `apps/web/e2e/scenarios/actor-perspective-journeys.spec.ts` (automated — covers token issuance and QR check-in)
