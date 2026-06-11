---
module: facilities-front-office
priority: P1
status: draft
---

# SOP: Facilities Management & Front Office Operations

## Overview
The Facilities module covers physical infrastructure operations: bed board management, planned preventive maintenance (PPM) of biomedical and general equipment, utility monitoring, and asset management. The Front Office module handles non-clinical patient-facing operations: visitor management, gate pass issuance, queue token display boards (TV displays), lost & found, and general enquiries. Both modules serve the hospital's operational continuity and visitor experience. The Front Office token boards feed the TV Display system showing live OPD queue status to waiting patients.

## Actor Matrix

| Actor (Role) | Can Perform | Notes |
|---|---|---|
| `facilities_manager` | Bed board, maintenance scheduling, PPM, asset management | Facilities primary actor |
| `front_office_staff` | Visitor passes, gate passes, enquiries, lost & found | Front office primary actor |
| `security_guard` | Gate pass verification, visitor log, CCTV incident log | Physical security at gate |
| `biomed_engineer` | BME maintenance tasks, calibration records, breakdown log | Equipment maintenance |
| `hospital_admin` | Facilities dashboard, maintenance compliance reports | Management oversight |

---

## Scenario 1: Facilities Manager Reviews and Schedules Planned Preventive Maintenance — Actor: Facilities Manager

**Actor**: `facilities_manager`  
**Entry point**: Facilities → PPM Schedule  
**Preconditions**: Equipment asset register populated; PPM frequency configured per equipment type

**Steps**:
1. Facilities manager opens PPM Schedule; sees calendar view of all equipment due for maintenance.
2. Views overdue PPM tasks (highlighted in red): equipment that has passed scheduled maintenance date.
3. For each overdue task: assigns to biomedical engineer (for medical equipment) or general maintenance staff (for HVAC, generators, lifts).
4. Assigns tasks with deadline and priority (Critical / High / Medium).
5. Biomedical engineer receives task notification; performs maintenance and records:
   - Date performed, technician name.
   - Findings: normal / defect found (described).
   - Calibration result (for measuring equipment: BP monitors, weighing scales, thermometers) — calibration certificate attached.
   - Next scheduled maintenance date.
6. Facilities manager reviews completed tasks; marks PPM cycle closed.
7. Generates monthly PPM compliance report: % equipment maintained on schedule.

**Exit / Outcome**: PPM tasks assigned and tracked; calibration records on file; compliance report generated.  
**Regulatory note**: NABH BME.1 — biomedical equipment PPM mandatory; AERB — radiation-emitting equipment (X-ray, CT) requires annual AERB calibration certificate; NABL — measuring equipment calibration traceable to national standard.  
**Existing test**: `— needs test`

---

## Scenario 2: Front Office Staff Issues Visitor Gate Pass — Actor: Front Office Staff + Security Guard

**Actor**: `front_office_staff` (issues pass) → `security_guard` (verifies at gate)  
**Entry point**: Front Office → Visitor Management → New Visit  
**Preconditions**: Patient is admitted in IPD; visitor presents at front desk

**Steps**:
1. Front office staff opens New Visit form; records:
   - Visitor name, contact number, government ID number (Aadhaar / passport — mandatory).
   - Patient name and UHID (searches existing patient).
   - Relationship to patient.
   - Visit purpose: General Visit / Relative for procedure / Medical Attendant.
2. System checks visitor blacklist (security incident history).
3. Issues gate pass: time-limited (e.g., valid 2 hours), ward-specific.
4. Gate pass has QR code; printed or sent to visitor's mobile.
5. Visitor proceeds to main gate.
6. Security guard scans QR code at gate → verifies validity (not expired, not blacklisted).
7. Security guard logs entry time; visitor proceeds to ward.
8. On exit: visitor scans QR at exit gate; exit time recorded.
9. After hours or post-visiting-time: system auto-expires pass; security can extend if needed.

**Exit / Outcome**: Visitor registered; gate pass issued and scanned; entry/exit times logged; ward access controlled.  
**Regulatory note**: NABH FMS.5 — visitor management and facility security; JCI FMS — restricted access to vulnerable patient areas (paediatric, ICU, maternity); POCSO Act — children's wards require stricter visitor verification.  
**Existing test**: `— needs test`

---

## Scenario 3: Front Office Token Board Feeds TV Display Queue — Actor: Front Office Staff → System → TV Display

**Actor**: `front_office_staff` (manages queue) → system auto-pushes to TV  
**Entry point**: Front Office → Token Board configuration (admin); TV display shows live queue  
**Preconditions**: OPD tokens issued; TV display devices registered in TV Display module; WebSocket server running

**Steps**:
1. Token board configured per OPD department: maps department → doctor(s) → display board number.
2. As patients check in and receive tokens, token board state updates in real-time (WebSocket event broadcast).
3. TV displays in waiting area show:
   - **Now Calling**: current token being served (e.g., "T-042 — Dr Sharma — Room 3").
   - **Next 3 tokens**: upcoming tokens in queue.
   - **Estimated wait time**: calculated from average consultation duration and queue depth.
   - **Department-specific announcements** (scrolling text configured by front office).
4. Front office staff can push an announcement (e.g., "Dr Sharma delayed 20 minutes — apologies for inconvenience").
5. If doctor marks consultation complete for a token: board auto-advances to next.
6. At end of session: board shows "Session Complete — Thank you for your patience."

**Exit / Outcome**: Live queue status broadcast to all waiting area TV screens; patients informed without staff intervention; announcements pushed as needed.  
**Regulatory note**: Consumer Protection Act 2019 — patients informed of wait times; NABH OPD.1 — patient flow management includes queue visibility; accessibility — TV display must be readable at a distance (large font, high contrast).  
**Existing test**: `apps/web/src/pages/front-office-token-boards.test.ts` (unit test exists); `— needs E2E WebSocket broadcast test`

---

## Scenario 4: Facilities Manager Runs Asset Management Report — Actor: Facilities Manager

**Actor**: `facilities_manager`  
**Entry point**: Facilities → Asset Management → Reports  
**Preconditions**: Asset register populated; maintenance history exists

**Steps**:
1. Facilities manager opens Asset Report; filters by asset type (Medical Equipment / IT / Furniture / Vehicle) and department.
2. Views each asset:
   - Asset ID, description, department, date of purchase, cost, expected life, current condition (Good / Fair / Poor / Condemned).
   - Last maintenance date and next scheduled.
   - Total maintenance cost to date (running cost of ownership).
   - Warranty expiry date — system flags assets with expiring warranties.
3. Identifies assets approaching end-of-life (age > expected life, condition "Poor").
4. Generates Capital Expenditure (CapEx) request for replacement: asset details, justification, estimated cost, vendor quotes.
5. CapEx request routed to Hospital Admin for approval.
6. Annual asset audit: physical verification checklist generated; staff confirm asset location and condition.

**Exit / Outcome**: Asset register current; CapEx requests initiated for aging equipment; annual audit checklist generated.  
**Regulatory note**: NABH BME.2 — equipment inventory and condition records maintained; AERB — radiation equipment licence renewal requires equipment details; Companies Act / Income Tax — asset depreciation schedule requires asset register.  
**Existing test**: `— needs test`
