---
module: operation-theatre
priority: P1
status: draft
---

# SOP: Operation Theatre (OT)

## Overview
The Operation Theatre module manages the surgical scheduling pipeline: OT booking, pre-operative assessment, anaesthesia workup, intraoperative documentation (WHO Surgical Safety Checklist), instrument/implant tracking (linked to CSSD and procurement), post-operative care, and OT room status management. Integration points: IPD (patient must be admitted), CSSD (sterile instruments), blood bank (crossmatch for elective surgery), pharmacy (anaesthesia drugs), and billing (procedure charges).

## Actor Matrix

| Actor (Role) | Can Perform | Notes |
|---|---|---|
| `doctor` (surgeon) | Request OT booking, pre-op notes, consent, surgical notes, post-op orders | Initiates surgery workflow |
| `doctor` (anaesthesiologist) | Pre-anaesthesia check, anaesthesia record, post-op monitoring | Separate role flag `is_anaesthesiologist` |
| `ot_staff` | OT room status, instrument setup checklist, WHO checklist execution, implant entry | Perioperative team |
| `nurse` | Pre-op prep, scrub nurse duties, post-op PACU monitoring | OT and ward nursing interface |
| `cssd_technician` | Issue sterile instrument sets to OT | Linked via CSSD module |
| `billing_clerk` | Bill procedure, implants, OT time | Triggered on OT completion |

---

## Scenario 1: Surgeon Books OT and Obtains Pre-Op Consent — Actor: Doctor (Surgeon)

**Actor**: `doctor` (surgeon)  
**Entry point**: IPD patient record → OT Booking  
**Preconditions**: Patient is admitted (IPD); OT booking calendar is open; surgeon has OT privileges

**Steps**:
1. Surgeon opens OT Booking from patient's IPD record.
2. Selects procedure (CPT / ICD-10-PCS code — mandatory); specifies duration estimate and equipment needed.
3. Checks OT calendar for available slots; selects date/time.
4. Specifies anaesthesia type: GA / SAB / Regional / LA; anaesthesiologist assigned or requested.
5. Orders pre-op requirements: blood crossmatch, pre-op labs, NPO order (food/water cut-off time auto-calculated and displayed to ward nurse).
6. Pre-op consent: system generates consent form populated with procedure name, risks, alternatives.
7. Surgeon explains procedure to patient; patient signs consent electronically or on paper (scanned in).
8. Booking status → `scheduled`; OT team and CSSD notified.

**Exit / Outcome**: OT slot booked; consent signed and attached; pre-op orders issued; CSSD notified of instrument set needed.  
**Regulatory note**: NABH OT.1 — pre-operative assessment documented; NABH MOM.2 — informed consent with risks, alternatives, and name of operating surgeon; IPSG Goal 4 — correct site, procedure, patient marking.  
**Existing test**: `— needs test`

---

## Scenario 2: Anaesthesiologist Completes Pre-Anaesthesia Assessment — Actor: Doctor (Anaesthesiologist)

**Actor**: `doctor` with `is_anaesthesiologist = true`  
**Entry point**: OT → Pre-Anaesthesia Assessment queue for the day's list  
**Preconditions**: OT booking `scheduled`; patient admitted

**Steps**:
1. Anaesthesiologist opens pre-anaesthesia assessment form for patient.
2. Reviews: history, airway assessment (Mallampati grade), cardiovascular risk (ASA class), allergies, current medications, last oral intake.
3. Selects anaesthesia plan; documents in structured form.
4. Records NPO status confirmation.
5. If high-risk (ASA IV+): escalates to consultant review; documents decision.
6. Signs pre-anaesthesia record → patient cleared for surgery.
7. Anaesthesia consent signed if general / regional (separate from surgical consent).

**Exit / Outcome**: Pre-anaesthesia record complete; ASA classification documented; patient cleared for OT.  
**Regulatory note**: NABH OT.2 — pre-anaesthesia assessment by anaesthesiologist mandatory; separate anaesthesia consent required for GA/SAB.  
**Existing test**: `— needs test`

---

## Scenario 3: OT Staff Executes WHO Surgical Safety Checklist — Actor: OT Staff + Nurse + Doctor

**Actor**: `ot_staff` (circulating nurse / OT in-charge)  
**Entry point**: OT module → Active Cases → patient's OT record → WHO Checklist  
**Preconditions**: Patient is in OT; all pre-op steps complete; surgical team present

**Steps (three pause points per WHO SSC)**:

**Sign In (before anaesthesia induction)**:
1. Patient identity confirmed (name + UHID — two-point check).
2. Surgical site marked and confirmed with surgeon.
3. Anaesthesia machine and medication safety check complete.
4. Pulse oximeter functioning.
5. Known allergies reviewed.
6. All team members identified by name and role.

**Time Out (before skin incision)**:
7. Surgeon, anaesthesiologist, and scrub nurse confirm patient name, procedure, incision site.
8. Antibiotic prophylaxis confirmed given within 60 min (or documented waived).
9. Anticipated critical events reviewed (estimated blood loss, critical steps, equipment needs).
10. Sterility confirmed.

**Sign Out (before patient leaves OT)**:
11. Procedure name as performed confirmed and matches booking.
12. Instrument, swab, and needle counts completed and correct (circulating nurse records exact count).
13. Specimen labelled correctly (if any).
14. Equipment issues noted.
15. Post-op recovery plan confirmed.

16. Each section is signed off by responsible actor; all three checklist sections must be completed before OT record can be closed.

**Exit / Outcome**: Three-point WHO SSC completed; instrument count recorded; any deviation documented; OT record ready for surgeon's operative note.  
**Regulatory note**: IPSG Goal 4 — WHO SSC mandatory for all surgical procedures; NABH OT.5 — instrument/swab/needle count documented; retained surgical item is a never-event.  
**Existing test**: `— needs test`

---

## Scenario 4: Post-Operative Handover to Recovery / Ward — Actor: OT Staff + Ward Nurse

**Actor**: `ot_staff` handing over to `nurse` (recovery or ward)  
**Entry point**: OT → patient record → Post-Op Handover  
**Preconditions**: WHO Sign Out complete; surgery finished; patient being transferred to PACU/recovery or ward

**Steps**:
1. OT staff opens post-op handover form; records: procedure performed, intraoperative events, blood loss, drains placed, skin closure, implants used (batch/lot/serial number).
2. If implant used: enters implant sticker data → linked to procurement/consignment record for traceability.
3. Ward/recovery nurse receives patient; confirms vitals (BP, pulse, SpO₂, pain score, GCS if GA).
4. Nurse acknowledges handover in system — SBAR format enforced (Situation, Background, Assessment, Recommendation).
5. Post-op doctor orders activated (analgesia, IV fluids, wound care).
6. OT room status → `dirty`; housekeeping and CSSD notified (for instrument return).
7. Billing: procedure code, OT time, and implant costs submitted to billing module.

**Exit / Outcome**: Post-op handover documented; implant traceable; OT room queued for cleaning; billing triggered.  
**Regulatory note**: NABH OT.7 — post-operative monitoring documented; IPSG Goal 2 — structured handover (SBAR); implant traceability per MDA/CDSCO requirements.  
**Existing test**: `— needs test`
