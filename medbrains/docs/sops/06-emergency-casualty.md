---
module: emergency-casualty
priority: P0
status: draft
---

# SOP: Emergency / Casualty

## Overview
The Emergency module handles time-critical patient presentations: trauma, cardiac events, acute illness, and brought-in-dead (BID) cases. Triage is colour-coded (Red/Orange/Yellow/Green/Black) per START/SALT triage protocols. Emergency encounters can be opened before a UHID exists (retrospective registration). Medico-Legal Cases (MLC) require mandatory police notification and special documentation under IPC/CrPC. The module integrates directly with IPD (admission), OT (emergency surgery), ICU, blood bank, and pharmacy.

## Actor Matrix

| Actor (Role) | Can Perform | Notes |
|---|---|---|
| `nurse` | Triage assessment, vitals, immediate first aid documentation | First clinical actor to see patient |
| `doctor` | Open emergency encounter, orders, clinical notes, admit/refer/discharge | Primary treatment actor |
| `receptionist` | Retrospective registration, MLC paperwork | Cannot initiate clinical encounter |
| `lab_technician` | Process STAT lab orders from emergency | Responds to STAT flag |
| `pharmacist` | Dispense emergency drugs (crash cart replenishment) | Verbal order follow-up by written Rx |
| `hospital_admin` | Override triage, escalate to disaster protocol | Audit trail |

---

## Scenario 1: Nurse Triages Arriving Patient — Actor: Nurse

**Actor**: `nurse`  
**Entry point**: Patient arrives at Emergency reception area; nurse intercepts at triage counter  
**Preconditions**: Nurse logged in to Emergency module; triage station is active

**Steps**:
1. Nurse opens Emergency → New Triage.
2. If patient has UHID: search and link. If unknown: enter "Unknown" — system assigns `TEMP-YYYYMMDD-NNN`.
3. Records presenting complaint, mode of arrival (walk-in / ambulance / police / referral).
4. Assesses and assigns triage colour:
   - **Red** — Immediate: life-threatening, requires intervention within 0–10 min.
   - **Orange** — Urgent: serious, requires intervention within 10–30 min.
   - **Yellow** — Semi-urgent: stable, can wait 30–60 min.
   - **Green** — Non-urgent: minor illness/injury.
   - **Black** — Expectant / BID: no survivable injury or deceased on arrival.
5. Records initial vitals (GCS, BP, pulse, SpO₂, respiratory rate).
6. Activates appropriate resuscitation protocol if Red (code blue trigger if cardiac arrest).
7. Assigns patient to emergency bay and calls treating doctor.

**Exit / Outcome**: Triage record created; colour tag assigned; doctor alerted; emergency bay assigned; clock started for triage-to-doctor time.  
**Regulatory note**: NABH EMR.1 — triage assessment documented within minutes of arrival; IPSG Goal 1 — two identifiers as soon as possible; START triage protocol (NABH EMR.2).  
**Existing test**: `apps/web/e2e/crud/emergency.spec.ts` (partial — triage flag needs test assertion); `— needs full triage journey test`

---

## Scenario 2: Emergency Doctor Opens Encounter and Issues Rapid Orders — Actor: Doctor

**Actor**: `doctor`  
**Entry point**: Doctor receives alert; opens Emergency → Active Cases  
**Preconditions**: Triage record exists; patient assigned to doctor's bay

**Steps**:
1. Doctor opens patient's emergency encounter view; sees triage vitals and chief complaint.
2. Opens "Quick Orders" panel (streamlined — all critical order types in one screen).
3. Issues STAT lab orders (blood gas, troponin, glucose, crossmatch as needed).
4. Issues STAT medications — verbal orders allowed for critical drugs; must be documented as Rx within 30 min.
5. Orders imaging if needed (STAT radiology order → radiology notified).
6. Records rapid clinical note (GCS, ABCDE assessment, working diagnosis).
7. Decision: stabilise and admit (IPD/ICU), operate (OT), refer, or discharge.
8. If admit: IPD/ICU admission initiated from Emergency module.

**Exit / Outcome**: Emergency encounter active; STAT orders dispatched; clinical note saved; disposition recorded.  
**Regulatory note**: NABH EMR.3 — emergency encounter documented; IPSG Goal 3 — verbal medication orders must be read back and confirmed; NABH EMR.6 — documentation of time-critical interventions.  
**Existing test**: `apps/web/e2e/crud/emergency.spec.ts` (partial); `— needs STAT order chain test`

---

## Scenario 3: Receptionist Completes Retrospective Registration — Actor: Receptionist

**Actor**: `receptionist`  
**Entry point**: Receptionist opens Emergency → Pending Registration (patients with TEMP IDs)  
**Preconditions**: Patient arrived with a TEMP ID (unconscious, no documents); relative or attendant now present with identification

**Steps**:
1. Receptionist selects TEMP patient record from the pending list.
2. Opens registration form; collects full demographics from attendant (name, DOB, address, contact, relation).
3. Scans ID document (Aadhaar / passport / driving licence); system extracts data via OCR (optional).
4. Searches for existing UHID to prevent duplicate creation.
5. If no existing UHID: assigns permanent UHID; TEMP ID deprecated.
6. If existing UHID found: merges TEMP encounter to existing record; attendant confirms identity.
7. Obtains admission consent signature from attendant (if patient is unable to sign — legal guardian).
8. If MLC: flags record as Medico-Legal Case (see Scenario 4).

**Exit / Outcome**: TEMP ID promoted to permanent UHID; full demographics on record; attendant/guardian consent obtained.  
**Regulatory note**: NABH EMR.5 — consent by guardian for incapacitated patients; IPSG Goal 1 — permanent ID confirmed at earliest opportunity; Hindu Adoption and Maintenance Act / Guardianship Act for consent hierarchy.  
**Existing test**: `— needs test`

---

## Scenario 4: MLC Flag and Mandatory Reporting — Actor: Any Clinical Staff

**Actor**: `nurse` or `doctor` (whoever identifies MLC criteria first)  
**Entry point**: During triage or encounter, staff identifies MLC criteria (accident, assault, poisoning, unnatural death, etc.)  
**Preconditions**: Patient record exists (UHID or TEMP); emergency encounter open

**Steps**:
1. Staff clicks "Flag as MLC" in encounter; selects MLC type from list: Road Traffic Accident / Assault / Poisoning / Sexual Assault / Unnatural Death / Other.
2. System enforces MLC documentation form: wound description (size, shape, nature — antemortem / perimortem), examining doctor's name, date/time of examination.
3. System generates MLC number (format: `MLC-YYYY-NNNN`) and logs it against the encounter.
4. System auto-generates police intimation letter with patient details, MLC number, and hospital contact. Letter printed for physical delivery OR sent via registered post / email per tenant configuration.
5. Police station reference number recorded when available (follow-up field).
6. If patient is brought-in-dead: auto-generates death certificate initiation and notifies MRD officer.
7. All MLC records are read-only after attending doctor signs — cannot be altered.

**Exit / Outcome**: MLC number assigned; police intimation letter generated; wound documentation immutable; MRD notified if BID.  
**Regulatory note**: IPC §39 — public servant duty to inform police of cognizable offence; CrPC §174 — inquest procedure for unnatural deaths; Motor Vehicles Act §134 — RTA mandatory reporting; NABH EMR.7 — MLC documentation.  
**Existing test**: `— needs test`
