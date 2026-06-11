---
module: ambulance
priority: P2
status: draft
---

# SOP: Ambulance

## Overview
The Ambulance module manages the hospital's fleet of ambulances: trip dispatch, live tracking, handover documentation, billing integration, maintenance scheduling, and driver management. Ambulances respond to: hospital-initiated transfers (inter-facility), emergency pick-ups (community calls), and planned transfers (post-discharge, dialysis patients). Integration with Emergency (patient arrival), IPD (transfer-out), and billing (trip charges).

## Actor Matrix

| Actor (Role) | Can Perform | Notes |
|---|---|---|
| `ambulance_driver` | Accept trip, update trip status, record patient handover | Mobile-first actor |
| `front_office_staff` | Dispatch ambulance, log call details | Dispatch coordinator |
| `nurse` | Accompany patient in ambulance (if critical transfer), document patient status | Clinical escort |
| `billing_clerk` | Bill trip charges to patient/insurance | After trip completion |

---

## Scenario 1: Front Office Dispatches Ambulance for Community Pick-Up — Actor: Front Office Staff

**Actor**: `front_office_staff`  
**Entry point**: Ambulance module → New Dispatch  
**Preconditions**: Call received from patient or family; at least one ambulance available

**Steps**:
1. Front office staff opens New Dispatch; records caller details, patient name (if known), pickup address, and chief complaint.
2. Views fleet status: available ambulances with current location (GPS if integrated), ALS vs BLS type.
3. Selects appropriate ambulance; assigns driver.
4. Driver notified (in-app push + SMS); trip status → `dispatched`.
5. Records expected arrival time; communicates to caller.
6. Notifies Emergency department: "Incoming — chest pain, ETA 15 min, ALS ambulance."
7. Driver updates status: `en_route`, `at_pickup`, `patient_loaded`, `at_hospital`.
8. On arrival: Emergency triage team ready; patient handed over.

**Exit / Outcome**: Ambulance dispatched and trip tracked; Emergency pre-alerted; patient handed over at hospital.  
**Regulatory note**: Motor Vehicles Act — ambulance must display registration and be equipped per type (ALS/BLS); driver must hold valid ambulance driving licence; NABH EMR.9 — pre-hospital care documented.  
**Existing test**: `— needs test`

---

## Scenario 2: Driver Records Trip and Patient Handover — Actor: Ambulance Driver

**Actor**: `ambulance_driver`  
**Entry point**: Ambulance module (mobile app) → My Trips  
**Preconditions**: Trip assigned; driver has accepted

**Steps**:
1. Driver opens trip on mobile; sees patient details, pickup location, and destination.
2. Updates status in real-time: `en_route` → `at_pickup` → `patient_loaded` → `at_hospital`.
3. At pickup: records patient condition, vitals if paramedic on board (ALS), and interventions given (oxygen, IV access, ECG).
4. Records odometer at start and end; fuel consumption.
5. At hospital: hands patient to Emergency team; records handover with nurse/doctor name and time.
6. Marks trip `completed`; trip record available for billing.

**Exit / Outcome**: Trip record complete; patient handover documented; odometer and fuel data captured for maintenance scheduling.  
**Regulatory note**: NABH — ambulance trip log required; Motor Vehicles Act §66 — vehicle fitness certificate and insurance mandatory.  
**Existing test**: `— needs test`

---

## Scenario 3: Billing Clerk Bills Ambulance Trip Charges — Actor: Billing Clerk

**Actor**: `billing_clerk`  
**Entry point**: Billing → Ambulance Charges (or linked to patient encounter)  
**Preconditions**: Trip status `completed`; patient record exists

**Steps**:
1. Billing clerk opens completed trip record; sees distance, trip type (ALS/BLS), and duration.
2. System calculates charges per configured rate card: base charge + per-km rate + ALS surcharge if applicable.
3. Links trip charges to patient encounter (OPD, IPD, Emergency).
4. If insurance/TPA: verifies ambulance coverage in policy; raises pre-auth if required.
5. Generates invoice line item; patient or guarantor billed.

**Exit / Outcome**: Ambulance trip billed; charges linked to patient encounter; insurance claim initiated if applicable.  
**Regulatory note**: CGHS rate card specifies ambulance rates; insurance coverage varies by policy; GST may apply on ambulance services (5% as per GST notification for non-government providers).  
**Existing test**: `— needs test`
