---
module: infection-control
priority: P2
status: draft
---

# SOP: Infection Control

## Overview
The Infection Control module enables the Infection Control Officer (ICO) to track Healthcare-Associated Infections (HAIs), manage antimicrobial stewardship (AMS) alerts, monitor hand hygiene compliance, oversee isolation protocols, generate surveillance reports, and coordinate outbreak response. It pulls data from Lab (culture results), Pharmacy (antibiotic consumption), and IPD (patient diagnoses, ward transfers). BMW management, CSSD compliance, and OT SSI (Surgical Site Infection) rates feed into the dashboard.

## Actor Matrix

| Actor (Role) | Can Perform | Notes |
|---|---|---|
| `infection_control_officer` | HAI logging, AMS review, isolation orders, outbreak alerts, compliance reports | Primary ICO actor |
| `doctor` | Acknowledge AMS alert, document rationale for Reserve antibiotic use | Clinical response |
| `nurse` | Log hand hygiene compliance observations, implement isolation protocol | Bedside implementation |
| `lab_technician` | Flag culture results with unusual organisms to ICO | Alert source |

---

## Scenario 1: ICO Logs Healthcare-Associated Infection — Actor: Infection Control Officer

**Actor**: `infection_control_officer`  
**Entry point**: Infection Control → HAI Surveillance → New Case  
**Preconditions**: Lab culture report identifies an HAI-defining organism; patient has been admitted > 48 hours (CDC HAI definition)

**Steps**:
1. ICO opens New HAI Case; selects patient and links to their IPD record.
2. Selects HAI type: CAUTI (catheter-associated UTI), CLABSI (central line BSI), VAP (ventilator-associated pneumonia), SSI (surgical site infection), CDAD (C. difficile), Other.
3. Records organism identified (from lab culture — LOINC code auto-linked), antibiogram (susceptibility profile).
4. Records date of event, diagnostic criteria met (CDC/NHSN criteria checklist).
5. Identifies risk factors present: device (catheter, line, ventilator), procedure date, immunosuppression.
6. Notifies treating doctor and ward nurse; documents notification.
7. Implements enhanced precautions: contact/droplet/airborne isolation as required.
8. HAI case registered in monthly surveillance report.

**Exit / Outcome**: HAI case documented with CDC criteria; organism and antibiogram recorded; enhanced precautions activated; treating team notified.  
**Regulatory note**: NABH IC.3 — HAI surveillance mandatory; CDC/NHSN HAI definitions; BMW 2016 — enhanced waste disposal for isolation rooms; ICMR AMR surveillance submission for carbapenem-resistant organisms.  
**Existing test**: `— needs test`

---

## Scenario 2: ICO Triggers AMS Alert for Reserve Antibiotic — Actor: ICO → Doctor

**Actor**: `infection_control_officer` (trigger) → `doctor` (response)  
**Entry point**: Pharmacy consumption report shows Reserve antibiotic (Colistin, Carbapenem, etc.) prescribed without AMS approval  
**Preconditions**: AMS programme active; AWaRe antibiotic categorisation loaded in pharmacy catalog

**Steps**:
1. ICO reviews antibiotic consumption report (daily or triggered by threshold alert).
2. Identifies Reserve antibiotic prescribed without documented culture justification or AMS committee approval.
3. Opens AMS Alert; selects patient, prescriber, drug, and indication.
4. Sends alert to prescribing doctor: "Reserve antibiotic — culture justification or AMS approval required."
5. Doctor receives in-app notification; opens alert and responds:
   - Provides culture justification (links lab result), OR
   - Requests AMS committee review (escalates), OR
   - Agrees to de-escalate antibiotic.
6. ICO documents outcome; tracks de-escalation rate as KPI.

**Exit / Outcome**: AMS alert documented; doctor response recorded; de-escalation or approval chain completed.  
**Regulatory note**: WHO AWaRe framework; ICMR National AMR Action Plan 2017; NABH IC.7 — AMS programme with Reserve antibiotic restriction; CDSCO Schedule H1 — some Reserve antibiotics require written Rx.  
**Existing test**: `— needs test`

---

## Scenario 3: Nurse Implements Isolation Protocol — Actor: Nurse

**Actor**: `nurse`  
**Entry point**: IPD Ward → Patient record → Isolation alert (auto-triggered or ICO-initiated)  
**Preconditions**: ICO has ordered isolation; isolation room available

**Steps**:
1. Nurse receives isolation order notification on ward dashboard.
2. Arranges single room or cohort isolation (same organism) as directed.
3. Places isolation precaution sign outside room: Contact / Droplet / Airborne (specific PPE instructions visible).
4. Records room assignment in system; bed status updated with isolation flag.
5. Implements PPE protocol per isolation type:
   - Contact: gloves + gown on entry; dispose on exit.
   - Droplet: surgical mask + gloves + gown.
   - Airborne: N95 respirator + gloves + gown + eye protection.
6. Documents daily: PPE compliance (self-audit), room cleaning performed, patient education given.
7. Records hand hygiene compliance observations for the shift (5-moment method).
8. On ICO clearance (organism eradicated, criteria met): isolation discontinued; room terminal-cleaned.

**Exit / Outcome**: Isolation implemented and documented; PPE compliance recorded; hand hygiene observations logged.  
**Regulatory note**: NABH IC.2 — standard and transmission-based precautions; WHO 5-Moments of Hand Hygiene; IPSG Goal 5 — hand hygiene compliance monitored and reported.  
**Existing test**: `— needs test`
