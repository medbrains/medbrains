---
module: blood-bank
priority: P1
status: draft
---

# SOP: Blood Bank

## Overview
The Blood Bank module covers voluntary donor screening and registration, blood component preparation, cross-matching for transfusion requests, component issue, transfusion monitoring, and adverse transfusion reaction reporting. It is governed by the D&C Act Part XII-B, National Blood Policy (NACO), and state blood transfusion council regulations. ABO/Rh typing, cross-match, and TTTI (Transfusion-Transmitted Infection) screening (HIV, HBsAg, HCV, malaria, syphilis) are mandatory before any blood issue.

## Actor Matrix

| Actor (Role) | Can Perform | Notes |
|---|---|---|
| `blood_bank_tech` | Donor screening, blood grouping, TTTI testing, cross-match, component issue | Primary actor |
| `doctor` | Request blood/components, issue transfusion order, monitor reaction | Clinical requester |
| `nurse` | Administer transfusion at bedside, monitor patient, record reaction | Bedside actor |
| `billing_clerk` | Bill blood/component charges | After issue |

---

## Scenario 1: Voluntary Donor Registers and Donates — Actor: Blood Bank Tech

**Actor**: `blood_bank_tech`  
**Entry point**: Blood Bank → New Donor Registration  
**Preconditions**: Blood donation camp or hospital blood bank window open

**Steps**:
1. Tech registers donor: name, DOB, sex, address, contact, blood group (self-declared; confirmed by typing).
2. Records donor history: previous donations (check 3-month male / 4-month female interval), medical history, medication, travel.
3. Pre-donation screening: haemoglobin (≥12.5 g/dL female, ≥13.0 g/dL male), BP, pulse, weight (≥45 kg).
4. Donor signs informed consent (voluntary, non-remunerated donation — NACO policy).
5. Blood collected (450 ml ± 10%); bag labelled with unique bag ID.
6. TTTI samples drawn simultaneously; sent to serology.
7. Component preparation: whole blood separated into RBC, FFP, Platelets (as applicable).
8. TTTI results entered; if any reactive → bag quarantined and destroyed; donor notified confidentially.
9. Non-reactive units: status → `available`; stored per component temperature requirements.

**Exit / Outcome**: Donor record created; blood bag in inventory with TTTI clearance; components available for crossmatch.  
**Regulatory note**: D&C Act Part XII-B Rule 122P — donor eligibility and TTTI mandatory; NACO National Blood Policy — voluntary donation; blood bag expiry: RBC 35–42 days, platelets 5 days, FFP 1 year.  
**Existing test**: `apps/web/e2e/crud/blood-bank.spec.ts` (partial); `— needs donor-to-inventory full journey test`

---

## Scenario 2: Doctor Requests Blood for Transfusion — Actor: Doctor

**Actor**: `doctor`  
**Entry point**: IPD or Emergency patient encounter → Blood Bank Request  
**Preconditions**: Patient has active IPD/Emergency encounter; blood group on record or sample sent for typing

**Steps**:
1. Doctor opens Blood Bank Request from patient encounter.
2. Selects component type: Packed RBC / FFP / Platelets / Cryoprecipitate / Whole Blood.
3. Enters quantity (units), clinical indication (ICD-10), urgency (Routine / Emergency / Massive Transfusion Protocol).
4. If blood group not on record: cross-match sample order generated; nurse collects labelled tube.
5. Request submitted → blood bank tech notified.
6. For Emergency (life-threatening haemorrhage): O-negative released immediately without crossmatch ("Emergency O-neg") — doctor acknowledges risk in system.

**Exit / Outcome**: Transfusion request created; cross-match sample ordered if needed; blood bank queue updated.  
**Regulatory note**: NABH BLD.1 — request form must include indication and component type; IPSG Goal 1 — patient identification on crossmatch sample label is critical (wrong blood in tube = never-event).  
**Existing test**: `— needs test`

---

## Scenario 3: Blood Bank Tech Cross-Matches and Issues Component — Actor: Blood Bank Tech

**Actor**: `blood_bank_tech`  
**Entry point**: Blood Bank → Pending Requests  
**Preconditions**: Transfusion request received; cross-match sample received (except emergency O-neg)

**Steps**:
1. Tech opens pending request; retrieves cross-match sample.
2. Performs ABO/Rh grouping on patient sample; compares to recorded group.
3. Performs cross-match (major, minor) against selected donor unit.
4. If compatible: marks unit `cross-matched` and links to patient request.
5. If incompatible: marks unit `incompatible`; selects next available unit; repeats.
6. Issues compatible unit: records bag ID, component type, volume, blood group, expiry, and issue time.
7. Tags bag with patient name, UHID, bed number, and component label.
8. Nurse collects with a co-sign (two-person identity check at collection — IPSG Goal 1).

**Exit / Outcome**: Compatible unit issued to ward; bag traceable from donor to patient; issue record in blood bank log.  
**Regulatory note**: D&C Act Part XII-B — crossmatch mandatory before issue; IPSG Goal 1 — dual check at issue; NABH BLD.3 — compatibility test documented.  
**Existing test**: `— needs test`

---

## Scenario 4: Nurse Administers Transfusion and Reports Adverse Reaction — Actor: Nurse

**Actor**: `nurse`  
**Entry point**: IPD ward — nurse receives blood bag from blood bank  
**Preconditions**: Compatible unit issued; valid transfusion order from doctor; IV access confirmed

**Steps**:
1. Nurse performs bedside check with second nurse (two-person check):
   - Patient name and UHID on arm band matches bag label.
   - Blood group and unit number matches issue slip.
   - Expiry date valid.
   - No clots or discolouration in bag.
2. Records check in MAR: both nurses' names, date/time, unit number.
3. Connects blood bag via transfusion set; starts at 15 drops/min for first 15 minutes.
4. Monitors patient at 15 min, 30 min, 1 hour, and end of transfusion: BP, pulse, temperature, SpO₂.
5. If adverse reaction (fever, rigors, rash, hypotension, back pain, haemoglobinuria):
   - Stop transfusion immediately.
   - Keep IV line open with normal saline.
   - Call doctor.
   - Opens "Transfusion Reaction Report" in system; records reaction type, time, severity.
   - Blood bag and patient sample sent to blood bank for investigation.
   - Pharmacovigilance report filed.
6. Records end of transfusion; volume infused; post-transfusion Hb ordered (if applicable).

**Exit / Outcome**: Transfusion completed and documented; reaction report filed if reaction occurred; post-transfusion monitoring complete.  
**Regulatory note**: NABH BLD.5 — transfusion monitoring documented; NABH BLD.6 — adverse reaction reporting; CDSCO pharmacovigilance — transfusion reaction is reportable adverse event.  
**Existing test**: `— needs test`
