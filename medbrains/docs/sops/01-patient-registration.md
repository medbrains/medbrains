---
module: patient-registration
priority: P0
status: draft
---

# SOP: Patient Registration

## Overview
Patient Registration is the entry point for all clinical care in MedBrains. It creates the master patient record, assigns a system-wide Unique Health ID (UHID), and links the patient to subsequent encounters across OPD, IPD, Emergency, and other modules. Registration can be initiated by the patient themselves (kiosk / web portal), by front-desk staff, by a nurse in an emergency, or pre-populated via ABDM Health ID linkage. Every registered patient must have at least two identifiers per NABH and IPSG standards.

## Actor Matrix

| Actor (Role) | Can Perform | Notes |
|---|---|---|
| `patient` (public/unauthenticated) | Self-register at kiosk or online portal | Generates UHID; no staff intervention needed |
| `receptionist` | Walk-in registration, edit demographics, print token | Full access to patient master |
| `front_office_staff` | Walk-in registration, phone pre-registration | Same page access as receptionist |
| `nurse` | Emergency bedside registration with minimal data | Can create record without photo ID if patient is critical |
| `hospital_admin` / `super_admin` | All of the above + merge duplicate records | Merge requires audit trail |

---

## Scenario 1: Self-Registration at Kiosk — Actor: Patient (public)

**Actor**: `patient` (unauthenticated, public kiosk session)  
**Entry point**: Patient walks up to kiosk, taps "New Registration"  
**Preconditions**: Kiosk is online; tenant has at least one active OPD department and one doctor schedule

**Steps**:
1. Patient enters full name, date of birth, sex, and mobile number.
2. System checks for existing record by mobile number; if found, prompts "Existing record found — log in or continue as new".
3. Patient confirms no existing record → system generates UHID (format: `UHID-YYYYNNNNNN` via `^SEQUENCE` YottaDB global).
4. Patient selects department and preferred doctor (or "Any Available").
5. System issues OPD token (format: `T-NNN`) and appointment slot confirmation.
6. Kiosk prints or displays QR code for token.

**Exit / Outcome**: UHID created, OPD appointment token issued, patient record in `patients` table with `registration_source = 'kiosk'`.  
**Regulatory note**: NABH OPD.1 — two-identifier check (name + DOB or mobile); IPSG Goal 1 patient identification.  
**Existing test**: JNY-PAT-001 in `apps/web/e2e/scenarios/actor-perspective-journeys.spec.ts` (automated)

---

## Scenario 2: Walk-in Registration by Receptionist — Actor: Receptionist

**Actor**: `receptionist`  
**Entry point**: Front desk staff opens Patients → New Patient from the sidebar  
**Preconditions**: Staff is logged in with `receptionist` role; OPD department exists

**Steps**:
1. Receptionist opens the New Patient form (route: `/patients/new`).
2. Enters mandatory fields: full name, date of birth, sex, primary mobile, address.
3. Optionally scans Aadhaar / ABHA card → auto-populates demographics via ABDM lookup.
4. Attaches photo (webcam capture or upload).
5. Selects registration type: General / Corporate / TPA / Government.
6. System validates no duplicate by mobile + DOB combination; warns if near-match found.
7. Receptionist confirms and submits → UHID generated and printed on registration slip.
8. Patient is queued for selected OPD department.

**Exit / Outcome**: UHID assigned, physical registration slip printed, patient record status `active`.  
**Regulatory note**: NABH OPD.1; Clinical Establishments Act 2010 §38 (patient records); PCPNDT — sex field mandatory.  
**Existing test**: `apps/web/e2e/forms/patient-register.spec.ts` (partial — form validation only); `— needs full journey test`

---

## Scenario 3: Emergency Bedside Registration — Actor: Nurse

**Actor**: `nurse`  
**Entry point**: Patient arrives at Emergency / Casualty; nurse opens Emergency module → New Encounter → "Register New Patient"  
**Preconditions**: Nurse logged in; Emergency department exists; patient cannot self-register (unconscious, critical)

**Steps**:
1. Nurse selects "Emergency Registration" which launches a minimal-field form.
2. Enters available info: estimated age, sex, chief complaint, arrival mode (walk-in / ambulance / police).
3. If no ID available, system assigns a temporary identifier `TEMP-YYYYMMDD-NNN`.
4. Triage level assigned immediately (colour tag: Red / Orange / Yellow / Green) — mandatory before proceeding.
5. Emergency encounter opened; doctor and bed assigned.
6. Full demographic data collected later (by receptionist or patient's relative) and linked to the TEMP record.
7. Once full data collected, TEMP record promoted to permanent UHID; merge logged in audit trail.

**Exit / Outcome**: Emergency encounter open with triage tag; TEMP or permanent UHID linked; bed assigned.  
**Regulatory note**: MLC documentation required if police/accident case (IPC §39 / CrPC §174); IPSG Goal 1 — both ID points documented at earliest opportunity.  
**Existing test**: `— needs test` (JNY-HOS-001 covers OPD registration, not emergency fast-track)

---

## Scenario 4: Phone Pre-Registration by Front Office Staff — Actor: Front Office Staff

**Actor**: `front_office_staff`  
**Entry point**: Staff receives phone call from patient; opens Patients → Pre-Registration  
**Preconditions**: Staff logged in; patient calling to book an appointment ahead of arrival

**Steps**:
1. Staff opens pre-registration form; enters name, mobile, DOB, and reason for visit.
2. System checks for existing UHID by mobile → if found, links appointment to existing record.
3. If new patient: creates a record with status `pre_registered`; no UHID issued yet.
4. Staff books OPD slot for requested doctor/department and confirms with patient verbally.
5. System sends SMS confirmation with appointment time and directions.
6. On arrival: receptionist searches by mobile / pre-registration reference, upgrades status to `active`, issues UHID and prints registration slip.

**Exit / Outcome**: Pre-registration record created with `status = pre_registered`; appointment slot held; SMS sent.  
**Regulatory note**: NABH OPD.1; Consumer Protection Act 2019 — accurate appointment info must be communicated.  
**Existing test**: `— needs test`
