---
module: pharmacy-dispensing
priority: P0
status: draft
---

# SOP: Pharmacy Dispensing

## Overview
The Pharmacy module covers the full drug dispensing cycle: prescription receipt (from doctor orders or paper), Drug-Drug Interaction (DDI) and allergy cross-check, controlled-substance handling under NDPS Act and D&C Act Schedule H/H1/X, batch/lot tracking, FEFO (First Expiry First Out) dispensing, and patient acknowledgement. Every dispensed drug must be traceable by batch and linked to the prescribing encounter. The AWaRe (Access, Watch, Reserve) antibiotic framework applies to antibiotic dispensing.

## Actor Matrix

| Actor (Role) | Can Perform | Notes |
|---|---|---|
| `doctor` | Issue electronic prescription from any clinical encounter | Source of all valid prescriptions |
| `pharmacist` | Receive prescription, verify, dispense, record NDPS register | Primary dispensing actor |
| `nurse` | Administer dispensed drugs at bedside (IPD — MAR) | Cannot dispense; can request from pharmacy |
| `patient` (portal/kiosk) | Acknowledge receipt, view dispense history | Read-only after dispense |
| `billing_clerk` | Bill pharmacy items against encounter | Sees dispense records; cannot edit |

---

## Scenario 1: Doctor Issues Prescription from Consultation — Actor: Doctor

**Actor**: `doctor`  
**Entry point**: Doctor is in an active OPD or IPD encounter, opens "Prescriptions" panel  
**Preconditions**: Patient has an open encounter; pharmacy catalog populated with INN names, ATC codes, and drug schedule flags

**Steps**:
1. Doctor searches for drug by INN name, brand name, or ATC code.
2. Selects drug → system displays: drug schedule (H / H1 / X / G), formulary status (on/off formulary), AWaRe category (Access / Watch / Reserve).
3. Doctor fills: dose, frequency, route, duration, and indication.
4. System runs DDI check against current medication list and flags interactions (severity: Major / Moderate / Minor).
5. System runs allergy cross-check against patient's recorded allergies and LASA flag check.
6. Doctor acknowledges any warnings and confirms prescription.
7. Prescription dispatched to pharmacy queue; status `pending_dispense`.

**Exit / Outcome**: Prescription created with INN name, ATC code, drug schedule, and AWaRe category; pharmacy notified; DDI/allergy checks logged.  
**Regulatory note**: D&C Act 1940 — prescriptions for Schedule H/H1/X require registered practitioner; CDSCO Schedule H1 — written Rx required; IPSG Goal 3 — medication reconciliation; AWaRe stewardship (WHO/CDSCO).  
**Existing test**: JNY-HOS-003 in `apps/web/e2e/scenarios/actor-perspective-journeys.spec.ts` (automated — covers prescription creation)

---

## Scenario 2: Pharmacist Dispenses Standard Drug — Actor: Pharmacist

**Actor**: `pharmacist`  
**Entry point**: Pharmacy → Pending Prescriptions queue  
**Preconditions**: Prescription status `pending_dispense`; drug in stock with valid batch

**Steps**:
1. Pharmacist opens prescription; verifies patient identity (UHID + name — two-point check).
2. Reviews prescription: drug, dose, frequency, duration, prescriber name, and schedule flag.
3. System selects batch automatically using FEFO (earliest expiry first); pharmacist can override with reason.
4. Pharmacist confirms quantity to dispense → system decrements stock in `pharmacy_stock` table.
5. Labels generated (drug name, dose, frequency, patient name, UHID, expiry, batch number).
6. Pharmacist hands over drug to patient / ward nurse; records "dispensed" confirmation.
7. Patient (OPD) or nurse (IPD) acknowledges receipt.
8. Dispense status → `dispensed`; encounter billing line item created.

**Exit / Outcome**: Drug dispensed; stock decremented; batch lot traceable; billing item created; audit record complete.  
**Regulatory note**: D&C Act — dispensing only against valid Rx; FEFO mandatory (CDSCO); batch traceability (GMP Rule 74).  
**Existing test**: JNY-HOS-003 in `apps/web/e2e/scenarios/actor-perspective-journeys.spec.ts` (automated)

---

## Scenario 3: Pharmacist Dispenses Controlled (Schedule X / NDPS) Drug — Actor: Pharmacist

**Actor**: `pharmacist`  
**Entry point**: Pharmacy → Pending Prescriptions — prescription flagged "CONTROLLED / NDPS"  
**Preconditions**: Prescription for a Schedule X or NDPS drug; NDPS register feature enabled for tenant; drug stored in dual-lock cabinet

**Steps**:
1. Pharmacist opens prescription; system displays a red "CONTROLLED SUBSTANCE" banner with drug schedule and NDPS flag.
2. System enforces that a second pharmacist (witness) must be present — prompts to select witness from active pharmacist list.
3. Both pharmacist and witness authenticate (login or PIN).
4. Pharmacist retrieves drug from dual-lock cabinet and records retrieval in NDPS register (drug name, batch, quantity retrieved, patient UHID, prescription ID, prescriber name, date/time).
5. Quantity dispensed recorded against prescription; stock decremented.
6. Witness confirms dispense in the register.
7. Dispense record linked to NDPS register entry; both entries immutable.
8. Labels applied; drug handed to patient or nurse.

**Exit / Outcome**: NDPS register entry created and linked to dispense; dual-witness authentication logged; drug dispensed; stock decremented.  
**Regulatory note**: NDPS Act 1985 §§8, 9 — NDPS register mandatory; dual-custody for Schedule X; D&C Act — Schedule H1 requires written Rx retained for 3 years.  
**Existing test**: `— needs test`

---

## Scenario 4: Patient Collects and Acknowledges — Actor: Patient (OPD)

**Actor**: `patient` (physical collection at OPD pharmacy counter)  
**Entry point**: Patient presents at pharmacy counter with OPD token / UHID  
**Preconditions**: Prescription status `dispensed` or `ready_for_collection`

**Steps**:
1. Pharmacist confirms patient identity one more time (name + UHID).
2. Explains each drug: name, dose, frequency, food interactions, storage requirements.
3. Patient signs digital acknowledgement (or paper) confirming receipt and counselling.
4. System records acknowledgement timestamp and pharmacist ID.
5. If patient has questions: pharmacist documents counselling notes in the prescription record.
6. For discharge packs (IPD): nurse co-signs on behalf of patient if patient is being wheeled out.

**Exit / Outcome**: Acknowledgement recorded; prescription lifecycle closed; counselling notes saved.  
**Regulatory note**: D&C Act Rule 65 — pharmacist must counsel patient on medication use; consumer Protection Act — informed consent on medication risks.  
**Existing test**: `— needs test`
