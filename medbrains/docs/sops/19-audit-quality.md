---
module: audit-quality
priority: P2
status: draft
---

# SOP: Audit & Quality

## Overview
The Audit & Quality module provides cross-module read-only access for audit officers and empowers the Quality Officer to manage NABH/JCI indicators, raise and track Corrective and Preventive Actions (CAPA), run clinical audits, manage incident and near-miss reporting, and generate accreditation-readiness reports. The audit officer cannot edit any clinical or financial data — all access is read-only with an access log. Quality indicators are mapped to NABH chapter standards.

## Actor Matrix

| Actor (Role) | Can Perform | Notes |
|---|---|---|
| `audit_officer` | Read-only access to all modules, access log maintained | Cannot edit any data |
| `quality_officer` | Quality indicators, CAPA management, incident reporting, accreditation reports | Has write access to quality module only |
| `hospital_admin` | Approve CAPAs, view accreditation dashboard | Senior approver |
| Any staff | Report incident/near-miss | Self-reporting encouraged |

---

## Scenario 1: Audit Officer Reviews Cross-Module Records — Actor: Audit Officer

**Actor**: `audit_officer`  
**Entry point**: Audit module → any module view (read-only)  
**Preconditions**: Audit officer logged in; audit scope defined (date range, department, module)

**Steps**:
1. Audit officer opens Audit → Start Audit Session; records audit purpose (internal / external / accreditation / statutory).
2. Navigates to relevant module (e.g., Pharmacy → Dispensing Records); all views are read-only.
3. Reviews records; can generate and export reports (PDF/Excel).
4. Flags observations in audit log (not in clinical records — separate audit notes system).
5. Every record accessed is logged: user, timestamp, record ID, module.
6. At session end: audit officer closes session; summary report of records accessed available.
7. Observations shared with Quality Officer for CAPA initiation.

**Exit / Outcome**: Audit completed; records accessed logged; observations documented in audit notes (not clinical records).  
**Regulatory note**: NABH AAC.5 — audit trails for all record access; IT Act 2000 — access logs non-repudiable; statutory audit requirements (hospital licence renewal, CAG for government hospitals).  
**Existing test**: `apps/web/e2e/rbac/role-blocking.spec.ts` (partial — audit_officer role has read-only enforcement tested)

---

## Scenario 2: Quality Officer Raises CAPA from Incident Report — Actor: Quality Officer

**Actor**: `quality_officer`  
**Entry point**: Quality → Incidents → New Incident Report (or any staff → Report an Incident)  
**Preconditions**: Incident occurred; staff aware of reporting mechanism

**Steps**:
1. Staff (any role) or quality officer opens incident report form; fills:
   - Incident type: Near Miss / Adverse Event / Sentinel Event.
   - Date, time, location, description (factual, no names of other staff initially).
   - Immediate actions taken.
2. Submits anonymously or with name (anonymity encouraged for near-miss).
3. Quality officer reviews report; categorises by severity and NABH chapter.
4. For Sentinel Events: mandatory root cause analysis (RCA) within 45 days.
5. Initiates CAPA:
   - Corrective Action: specific fix for what happened (e.g., "Update checklist").
   - Preventive Action: systemic change to prevent recurrence.
6. Assigns CAPA owner (department head or individual); sets deadline.
7. Tracks CAPA completion; sends reminders.
8. On completion: quality officer verifies effectiveness; closes CAPA.

**Exit / Outcome**: Incident documented; CAPA created and tracked to closure; patient safety learning recorded.  
**Regulatory note**: NABH QPS.1 — incident reporting system mandatory; IPSG Goal 6 — sentinel event review and RCA; Joint Commission — sentinel events require RCA within 45 days; anonymous reporting encouraged per NABH.  
**Existing test**: `— needs test`

---

## Scenario 3: Quality Officer Generates NABH Accreditation Report — Actor: Quality Officer

**Actor**: `quality_officer`  
**Entry point**: Quality → Accreditation → NABH Dashboard  
**Preconditions**: Quality data collected for the reporting period; NABH chapter indicators configured

**Steps**:
1. Quality officer opens NABH Dashboard; selects reporting period (monthly / quarterly / annual).
2. Reviews key indicators per NABH chapter:
   - OPD: average wait time, patient satisfaction score.
   - IPD: average LOS, bed occupancy rate, readmission rate.
   - Lab: TAT compliance (routine / urgent / STAT), critical value notification rate.
   - Pharmacy: dispensing error rate, near-miss rate.
   - Infection Control: CAUTI, CLABSI, VAP rates per 1000 device days.
   - OT: SSI rate, WHO SSC compliance rate.
3. Compares indicators against NABH benchmarks; flags non-compliant indicators.
4. Generates accreditation-ready report (PDF) with chapter-wise scores and evidence mapping.
5. Shares report with hospital admin and department heads for review.
6. Initiates action plans for non-compliant indicators (links to CAPA module).

**Exit / Outcome**: NABH dashboard report generated; non-compliant indicators flagged; action plans initiated.  
**Regulatory note**: NABH Hospital Accreditation Standards (4th edition) — indicator measurement and reporting mandatory; JCI Section 1 — quality and patient safety chapter.  
**Existing test**: `— needs test`
