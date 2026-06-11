---
module: hr-attendance
priority: P2
status: draft
---

# SOP: HR & Attendance

## Overview
The HR module covers the employee lifecycle: onboarding (joining formalities, credential verification), roster and shift management, biometric/portal attendance, leave management, training and CME tracking, performance appraisal, and separation (resignation/termination/retirement). It integrates with payroll (attendance → salary calculation), credentialing (doctor/nurse licence verification), and department scheduling (OT, ICU, OPD rosters). Statutory compliance: PF, ESI, Gratuity, Shops & Establishments Act, and professional nursing/medical council re-registration requirements.

## Actor Matrix

| Actor (Role) | Can Perform | Notes |
|---|---|---|
| `hr_officer` | Onboard employee, manage leave, update records, run payroll input | Primary HR actor |
| `hospital_admin` | Approve offers, promotions, terminations, view HR reports | Senior approver |
| Staff (any role) | Mark attendance, apply for leave, update profile | Self-service |
| Department head | Approve leave for their team, view roster | Department-scoped |

---

## Scenario 1: HR Officer Onboards New Employee — Actor: HR Officer

**Actor**: `hr_officer`  
**Entry point**: HR → Employees → New Employee  
**Preconditions**: Offer letter accepted; joining date confirmed

**Steps**:
1. HR officer creates employee record: personal details, designation, department, reporting manager, join date, employment type (permanent / contract / intern).
2. Uploads documents: ID proof, educational certificates, professional council registration (Medical Council / Nursing Council — certificate number + expiry date mandatory for clinical staff).
3. System flags certificate expiry dates; auto-reminds HR 60 days before expiry for renewal.
4. Assigns role in MedBrains (maps employee designation to system role — e.g., "Staff Nurse" → `nurse`).
5. HR officer configures payroll details: salary structure, PF contribution, ESI eligibility.
6. Enrols in biometric system (if configured); or portal attendance enabled.
7. Sends welcome email with credentials; employee portal access activated.
8. Documents joining formalities checklist (induction, ID card, locker assignment, policy acknowledgement) — each item checked off.

**Exit / Outcome**: Employee record active; system credentials issued; payroll configured; credential expiry alerts set.  
**Regulatory note**: Medical Council Act — doctor's registration number verified against state/MCI database; Indian Nursing Council Act — nurse registration verified; PF Act — enrolment within 1 month of joining; ESI Act — enrolment if salary ≤ ₹21,000/month.  
**Existing test**: `— needs test`

---

## Scenario 2: Staff Member Marks Attendance and Applies for Leave — Actor: Any Staff

**Actor**: Any authenticated staff user  
**Entry point**: HR portal → Attendance / Leave section  
**Preconditions**: Employee record active; shift assigned

**Steps**:
**Attendance**:
1. Staff logs in; biometric terminal (if physical) auto-records punch-in.
2. Portal-based: staff opens HR → Mark Attendance → confirms location (geofencing if enabled).
3. System records punch-in time; calculates against shift schedule.
4. Late arrival / early departure flagged; overtime auto-calculated.

**Leave Application**:
5. Staff opens Leave → Apply; selects leave type (CL / SL / EL / Maternity / Paternity / On-Duty).
6. Selects dates; adds reason; attaches medical certificate if sick leave > 3 days.
7. Submits → department head receives approval request.
8. Department head approves/rejects with comment.
9. HR officer notified; leave balance decremented.
10. Staff receives confirmation SMS/email.

**Exit / Outcome**: Attendance recorded; leave approved and balance updated; payroll input reflects accurate attendance.  
**Regulatory note**: Shops & Establishments Act (state-specific) — leave entitlement; Maternity Benefit Act 2017 — 26 weeks maternity leave mandatory; Paternity leave per hospital policy (no central mandate yet).  
**Existing test**: `— needs test`

---

## Scenario 3: HR Officer Tracks Expiring Professional Licences — Actor: HR Officer

**Actor**: `hr_officer`  
**Entry point**: HR → Compliance → Expiring Credentials  
**Preconditions**: Clinical staff records have professional registration numbers and expiry dates entered

**Steps**:
1. HR officer opens Expiring Credentials dashboard; views all clinical staff (doctors, nurses, pharmacists, lab technicians) with credentials expiring in the next 90 days.
2. For each: sends renewal reminder to staff member (auto-email + in-app notification).
3. Staff uploads renewed certificate; HR officer verifies and updates record.
4. If credential expired and not renewed: system flags staff member's clinical role access as `credential_expired` — cannot log clinical actions until resolved.
5. HR officer reports compliance status to Hospital Admin monthly.

**Exit / Outcome**: Expiry alerts sent and tracked; credential updates verified; expired credentials block clinical access per regulatory requirement.  
**Regulatory note**: Medical Council Act — doctor registration must be current for practice; Indian Nursing Council — nurse registration renewal every 5 years (state-specific); Pharmacy Act — pharmacist registration renewal.  
**Existing test**: `— needs test`
