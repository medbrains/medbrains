---
module: mrd-records
priority: P1
status: draft
---

# SOP: MRD / Medical Records Department

## Overview
The Medical Records Department (MRD) module manages the lifecycle of patient health records: file creation at first registration, ongoing addition of clinical documents (case sheets, discharge summaries, operative notes, consent forms), physical file tracking, ICD-10/ICD-11 coding of diagnoses and procedures, birth and death certificate issuance, and patient requests for record copies. NABH requires case sheets to be completed, signed, and filed within 24 hours of discharge. Retention periods per NABH/state regulations range from 5 years (general) to 10 years (medico-legal/maternal/paediatric).

## Actor Matrix

| Actor (Role) | Can Perform | Notes |
|---|---|---|
| `mrd_officer` | File management, ICD coding, birth/death certificates, record issue | Primary MRD actor |
| `doctor` | Sign and finalise case sheets, discharge summaries | Cannot be done by MRD |
| `patient` | Request copy of health records | Authenticated request |
| `audit_officer` | Read-only review of records completeness | No edit access |

---

## Scenario 1: MRD Officer Closes and Codes Discharge Record — Actor: MRD Officer

**Actor**: `mrd_officer`  
**Entry point**: MRD → Pending Discharge Files queue (IPD records awaiting MRD finalisation)  
**Preconditions**: Patient discharged; discharge summary signed by doctor; case sheet flagged for MRD

**Steps**:
1. MRD officer opens discharge record from queue; checks completeness: history, examination, investigations, treatment summary, discharge summary, consent forms.
2. Flags any missing documents → sends "deficiency notice" to treating doctor (in-system notification with 24-hour SLA).
3. Once complete: MRD officer codes the record:
   - Principal diagnosis → ICD-10 code.
   - Secondary diagnoses → ICD-10 codes.
   - Procedures → ICD-10-PCS or CPT codes.
4. Verifies all signatures (doctor, consultant, anaesthesiologist if applicable).
5. Marks record `coded_and_filed`; physical file location (rack/shelf/box) recorded.
6. DRG assignment (if applicable for CGHS/NABH purposes) auto-calculated from ICD codes.

**Exit / Outcome**: Record complete, coded, and filed; DRG assigned; deficiency SLA tracked.  
**Regulatory note**: NABH MRD.1 — case sheet completion within 24h post-discharge; ICD-10 coding mandatory (MOHFW EHR 2016); record retention ≥5 years (10 years for MLC, maternal, paediatric).  
**Existing test**: `— needs test`

---

## Scenario 2: MRD Officer Issues Birth Certificate — Actor: MRD Officer

**Actor**: `mrd_officer`  
**Entry point**: MRD → Birth & Death → Pending Birth Certificates  
**Preconditions**: Delivery documented in Maternity module; mother's IPD record discharged; baby's record created

**Steps**:
1. MRD officer opens birth certificate request linked to delivery record.
2. Verifies details: baby's date and time of birth, sex (mandatory), weight, place of birth (hospital name, address, registration number).
3. Verifies mother's details: name, UHID, age, address, husband's name.
4. Confirms attending doctor/midwife name and qualification.
5. Generates birth certificate (Form 1 per Registration of Births and Deaths Act 1969).
6. Registers birth with local Municipal/Gram Panchayat Body (manual submission or e-registration portal if integrated).
7. Issues hospital certificate to parent; municipal certificate on receipt from registrar.

**Exit / Outcome**: Birth certificate Form 1 generated; registered with municipal body; hospital copy filed.  
**Regulatory note**: Registration of Births and Deaths Act 1969 — birth must be registered within 21 days; sex disclosure on birth certificate per rules (not PCPNDT — birth is post-delivery); PCPNDT Act does not restrict sex entry on birth certificate.  
**Existing test**: `— needs test`

---

## Scenario 3: Patient Requests Copy of Health Record — Actor: Patient

**Actor**: `patient` (physical request or portal)  
**Entry point**: Patient submits written request at MRD counter or via portal → "Request Records"  
**Preconditions**: Patient is the subject of the record (or legal guardian/nominee for deceased)

**Steps**:
1. Patient (or guardian) submits request: specifies date range, record type (discharge summary / lab reports / complete case sheet).
2. MRD officer receives request; verifies identity (UHID + government ID).
3. For guardian/nominee: verifies legal relationship document (power of attorney / death certificate + succession).
4. MRD officer retrieves physical file and/or prints digital copies.
5. Charges applicable copying fee (as per hospital policy).
6. Patient signs acknowledgement of receipt; copies stamped "True Copy" with MRD officer's signature.
7. Request and issue logged in MRD register.

**Exit / Outcome**: Patient receives certified copies; issue logged; original record not removed.  
**Regulatory note**: Consumer Protection Act 2019 — patients have right to their health records; IT Act 2000 §43A — data protection; NABH — defined process for record release; for deceased patients: legal heir entitlement applies.  
**Existing test**: `— needs test`
