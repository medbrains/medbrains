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
3. The witness types their own password at the dispensing screen; the server checks it (see "What the dispense checks" below). For Schedule X the pharmacist also enters the reference of the retained duplicate prescription.
4. Pharmacist retrieves drug from dual-lock cabinet and records retrieval in NDPS register (drug name, batch, quantity retrieved, patient UHID, prescription ID, prescriber name, date/time).
5. Quantity dispensed recorded against prescription; stock decremented.
6. Witness confirms dispense in the register.
7. Dispense record linked to NDPS register entry; both entries immutable.
8. Labels applied; drug handed to patient or nurse.

**Exit / Outcome**: NDPS register entry created and linked to dispense; dual-witness authentication logged; drug dispensed; stock decremented.  
**Regulatory note**: NDPS Act 1985 §§8, 9 — NDPS register mandatory; dual-custody for Schedule X; D&C Act — Schedule H1 requires written Rx retained for 3 years.  
**Existing test**: `— needs test`

---

## What the dispense checks, and what it does not (2026-11-09)

The counter dispense (`PUT /api/pharmacy/orders/{id}/dispense`), the pick of
a pack-and-collect order and a camp's synced offline dispense run the same
Schedule H/H1/X and NDPS gate (`crates/medbrains-pharmacy/src/schedule_gate.rs`).
A line is gated when its drug is Schedule H, H1, X or NDPS, or controlled. A
refusal names every reason and, at the counter and the pick, is filed on the
order's Safety record (`SCHEDULE_DISPENSE_REFUSED`). A camp's H/H1 dispense
had already happened when it syncs, so a gate refusal there does not fail the
event: the dispense is posted (the stock left the shelf), filed on the order as
`CAMP_DISPENSE_EXCEPTION`, and returned as the event's note; a pharmacist
reviews it under Pharmacy → Orders → **Camp exceptions to review** (needs
`pharmacy.safety.view`) and the order's Safety record. Schedule X, NDPS and
controlled lines, and lines with no catalogue item, are still refused at camp
sync and the event fails.

| Rule | Where | Refusal |
|---|---|---|
| Each gated line is an item on the order's prescription: by catalogue id where the prescription line has one, else by the catalogue's full name (which carries the strength), never the generic name alone; 0.25 mg does not release 2 mg | gate | "not on the prescription" |
| This order plus earlier orders on the same prescription stay within what each item prescribes, one item's quantity shared by every catalogue item it matches (stated quantity, else dose x frequency x duration; one fill per issued repeat, none for X, NDPS or controlled) | gate | "the prescription allows N and M already went out" |
| A line with no quantity and a frequency the cap cannot count: weekly, monthly, PRN, SOS, "if needed", or an unknown spelling. "stat" is one dose; "every N hours" and `qNh` are 24/N a day, "every N days" 1/N. X, NDPS and controlled drugs need a stated quantity | gate | "prescribed quantity cannot be read" / "no quantity stated" |
| The prescription is signed (`is_signed`) and in date (`valid_until`) | gate | "not signed by the doctor" / "expired on" |
| X, NDPS and controlled: a written order only, never verbal or telephone | gate | "need a written prescription" |
| Schedule X: prescriber with `can_prescribe_schedule_x`, a witness who is not the prescriber, and the retained duplicate's reference (Rule 65(11)), trimmed, at least 6 characters, stored as `pharmacy_orders.schedule_x_duplicate_ref`; a blank field uses the one already stored | gate | named per condition |
| A visit or admission alone is never a prescription; H/H1 may stand on a verified upload (one order per drug for one uploaded file) or a recent doctor-signed discharge summary that lists the drug (every order on the summary together within the listed quantity); X, NDPS and controlled never do | gate | "no prescription for this patient" / "already backed an earlier order" / "the discharge summary allows" |
| A camp's synced dispense never carries Schedule X, NDPS or controlled lines | camp sync | "cannot be dispensed through camp offline sync" |
| A camp dispense line carries its catalogue item (camp stock is the catalogue's) | camp sync | "choose the drug from the catalogue" |
| A camp dispense naming a prescription names one on record for this patient; otherwise that event alone fails and the rest of the sync goes on | camp sync | "not on record for this patient" |
| A free-text line (no catalogue item) on any order through the schedule gate (a counter dispense, a pack-and-collect pick, a camp dispense), with or without a prescription: refused whatever it names. Free text is for OTC and POS sales only | counter, pick, camp | "Choose the drug from the catalogue" |
| A free-text line at an OTC or POS sale is cleaned (zero-width and other format characters deleted, NFKC) and refused if a letter outside A-Z remains; then, normalised (lowercase, punctuation to spaces), it is refused when it contains, as a whole word or phrase anywhere, a Schedule H, H1, X, NDPS or controlled row's catalogue name or any part of its generic name split on `+`, `,` or `/` (strength dropped): "50mg tramadol", "Chlorpheniramine syrup" | OTC, POS | "Choose the drug from the catalogue" |
| A camp prescription names its doctor (`doctor_id`), or the event is refused; it is never signed at sync, and stays unsigned for that doctor to sign from the sign-off inbox on the review screen. A camp H/H1 dispense on it before then is posted as a camp exception; signing later does not clear the exception, which the pharmacist closes on review | camp sync | "Prescription saved unsigned"; "prescription sync requires doctor_id" |
| A quantity is counted from dose x frequency x duration only for a dose in a discrete unit (tab, cap, sachet, suppository, patch, vial, ampoule); ml, drops, puffs, g, mg and units need a stated quantity. "N hours" is an interval only as "every N hours", "qN h" or "N hourly" ("once daily at 8 hrs" is once a day) | gate | "prescribed quantity cannot be read" |
| Controlled (`is_controlled`, which a Schedule X or NDPS drug always carries, migration 1450) needs a witness who types their own password, or a reason from a holder of `pharmacy.ndps.witness_override`, granted by name only (no built-in role; a super or hospital admin's bypass does not carry it; never for X) | dispense | filed as `NDPS_WITNESS_MISSING` |
| A witness whose sign-in is locked, or whose account is disabled, cannot witness | dispense | "sign-in is locked" |
| Wrong witness passwords: their own counter (`witness_password_failed` on the audit chain, with the dispenser and their address); 5 in 15 minutes stops the dispenser, 5 against one witness pauses that witness; sign-in is never locked by it | dispense | 429 |
| Allergy status unknown (no drug allergy recorded, "no known allergies" never noted) needs the pharmacist's acknowledgement, at the counter and at the pick (the fulfilment queue asks) | dispense, pick | filed as `ALLERGY_STATUS_UNKNOWN` |
| The NDPS register is posted under a per-drug lock and never goes below zero | dispense | 409 |

Text matching cannot catch a misspelt drug name or a brand the catalogue does
not stock, so a free-text line naming a drug is audited: the pharmacist in
charge reviews the day's OTC and POS free-text lines.

An unknown frequency spelling is shown on the dispensing view and the label as
"Frequency not recognised — read the prescription", never as "as needed".

### Opening balance before the first controlled dispense

Controlled stock already on the shelf when this release goes in, with no
receipt in the NDPS register, cannot be dispensed: the register would go below
zero and the dispense is refused (409, "Record the receipt in the register").
Before the first controlled dispense, for each controlled drug on the shelf:

1. Count the stock physically, with a second pharmacist.
2. Pharmacy → NDPS register → **Manual Entry**: action **Adjustment**, the
   counted quantity, and a note "Opening balance, counted by A and B on
   <date>". The entry needs a fresh sign-in (step-up) and
   `pharmacy.ndps.manage`.
3. Check the drug's balance on the register's balance view matches the count.

Receipts recorded through goods receipt after that post to the register on
their own.

**Verified uploads.** An uploaded prescription backs an H/H1 order only once
a pharmacist has verified it (`pharmacy_store_orders.verified_at`), and the
gate does not read its lines or cap its quantities: the verifying pharmacist
reads the drug, strength and quantity off the image and answers for it. Verify
an upload only after checking each line against it.

**Camp devices (requirement, not yet built).** The native staff apps do not
dispense at camps today (iOS and Android cover camp registration and station
tokens only). When camp dispensing is added, the device must refuse to hand
over a Schedule H or H1 drug offline unless the prescription it is against is
signed on the device, and must never offer Schedule X, NDPS or controlled
drugs; the server's sync rules above stay the backstop.

**Not checked, follow-ups:** dose against weight, renal function or age
(there are no dose checks of any kind); the witness confirming from their own
session; an append-only, hash-chained NDPS record with the witness's user id;
a quantity cap on a verified upload (the pharmacist reads its lines; it is
limited to one order per drug); closing a camp exception once reviewed (it
stays on the list); the POS
counter sale of H/H1 against an outside paper prescription (Rule 65(9)) is a
separate path and keeps its own checks.

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
