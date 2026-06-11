---
module: command-center
priority: P0
status: draft
---

# SOP: Command Center (Live Hospital Dashboard)

## Overview
The Command Center is the hospital's real-time operational nerve centre. It aggregates live data from all clinical and operational modules into a single dashboard visible to hospital administration and department heads. Key panels: census (beds occupied/available by ward/ICU), Emergency status (triage queue, waiting room count, average wait time), pending lab/radiology orders, pharmacy stock alerts, staffing levels, and critical escalations. Data refreshes every 30–60 seconds via WebSocket. This is a read-heavy, decision-support module — no clinical actions are taken directly here.

## Actor Matrix

| Actor (Role) | Can Perform | Notes |
|---|---|---|
| `hospital_admin` | View all panels, drill down to any ward/dept, acknowledge escalations | Full access |
| `facilities_manager` | View bed board, bed status, housekeeping queue, maintenance alerts | Operational panels |
| `quality_officer` | View quality indicator tiles (NABH KPIs), incident count | Quality overlay |
| `doctor` (department head) | View their department's panel only | Department-scoped |
| `nurse` (charge nurse) | View ward census and pending orders for their ward | Ward-scoped |

---

## Scenario 1: Hospital Admin Reviews Morning Census — Actor: Hospital Admin

**Actor**: `hospital_admin`  
**Entry point**: Navigation → Command Center (default landing page for admin users)  
**Preconditions**: Hospital has active admissions; bed state updated via `^BEDSTATE` YottaDB global

**Steps**:
1. Admin opens Command Center → sees headline metrics strip at top:
   - Total beds: occupied / available / dirty / blocked (maintenance).
   - Emergency: patients waiting / average wait time (minutes) / triage Red count.
   - OPD: patients checked in today / consultations completed / pending.
   - IPD: admissions today / discharges today / expected discharges today.
2. Opens Census panel → ward-by-ward breakdown: General / Surgical / Maternity / ICU / Paediatric.
3. Drills into ICU panel → sees each bed with patient name, diagnosis, LOS, ventilator status.
4. Identifies beds that are `dirty` (awaiting housekeeping) for > 60 minutes → triggers escalation to housekeeping supervisor.
5. Reviews "Expected Discharges Today" list → flags patients with incomplete discharge summaries (doctor not signed).
6. Exports morning census snapshot (PDF / Excel) for daily management meeting.

**Exit / Outcome**: Daily census reviewed; delayed housekeeping flagged; incomplete discharge summaries escalated to doctors.  
**Regulatory note**: NABH HIC.1 — facility management including bed management monitored; NABH IPD.8 — discharge summary completion tracked.  
**Existing test**: `apps/web/e2e/scenarios/ui-journeys.spec.ts` (partial); `— needs command center drill-down test`

---

## Scenario 2: Facilities Manager Monitors Bed Turnaround — Actor: Facilities Manager

**Actor**: `facilities_manager`  
**Entry point**: Command Center → Bed Board panel (or Facilities module → Bed Board)  
**Preconditions**: IPD discharges have occurred; housekeeping tasks auto-created

**Steps**:
1. Facilities manager opens Bed Board view: colour-coded grid showing every bed across all wards.
   - Green: available/clean.
   - Blue: occupied.
   - Yellow: dirty (cleaning pending).
   - Orange: dirty > SLA threshold (configurable — default 90 min).
   - Grey: blocked (maintenance/infection isolation).
2. Identifies orange beds; drills into task detail: which housekeeping staff assigned, when task started.
3. If unassigned: manually assigns to available housekeeping staff.
4. Reviews average bed turnaround time for the day vs target (e.g., target ≤ 60 min).
5. If target breached: views root cause (staff shortage, complex isolation clean, equipment issue).
6. Sets "maintenance block" on beds reported for repair; marks expected re-availability date.

**Exit / Outcome**: All dirty beds assigned; turnaround SLA compliance visible; maintenance blocks set with ETA.  
**Regulatory note**: NABH HIC.2 — bed management and housekeeping SLAs documented; turnaround time is a NABH quality indicator.  
**Existing test**: `— needs test`

---

## Scenario 3: Quality Officer Reviews Live Quality Indicator Tiles — Actor: Quality Officer

**Actor**: `quality_officer`  
**Entry point**: Command Center → Quality overlay / KPI tiles  
**Preconditions**: Quality indicators configured in Quality module; data feeds from Lab, Pharmacy, OT, Infection Control

**Steps**:
1. Quality officer opens Quality tiles panel on Command Center:
   - **Lab TAT**: % orders within TAT (Routine ≤4h, Urgent ≤2h, STAT ≤1h).
   - **Critical value notification**: % acknowledged within 30 min.
   - **WHO SSC compliance**: % OT cases with all 3 checklist sections complete.
   - **Hand hygiene compliance**: % observed moments compliant (rolling 7-day average).
   - **Medication error rate**: incidents per 1000 dispenses.
   - **Fall events this month**: count and trend.
2. Red tiles (below threshold) flagged immediately; quality officer drills to root cause.
3. Clicks "Lab TAT" red tile → opens Lab module in read-only mode → sees which department has highest TAT breach.
4. Creates quality action note linked to the indicator; assigns to lab head.
5. Tiles automatically refresh every 5 minutes.

**Exit / Outcome**: Quality officer has real-time view of NABH KPI compliance; non-compliant indicators trigger action notes.  
**Regulatory note**: NABH QPS.3 — quality indicators monitored and reported; IPSG Goals — compliance rates monitored continuously.  
**Existing test**: `— needs test`

---

## Scenario 4: Charge Nurse Views Ward-Scoped Pending Orders — Actor: Nurse (Charge Nurse)

**Actor**: `nurse` (charge nurse role or senior nurse)  
**Entry point**: Command Center → Ward Panel (filtered to their assigned ward)  
**Preconditions**: Charge nurse assigned to ward; pending orders exist for patients in the ward

**Steps**:
1. Charge nurse opens Command Center; sees only their ward's panel (ward-scoped by default).
2. Views:
   - Patients with pending lab orders not yet collected (> 2 hours old) — flags for phlebotomist follow-up.
   - Patients with overdue MAR doses (scheduled medication not given within ±1 hour of due time).
   - Patients with pending consent forms (surgery scheduled today without signed consent).
   - Patients flagged for discharge without completed nursing discharge checklist.
3. Assigns tasks to junior nurses; marks follow-up required.
4. Refreshes panel after 15 minutes to confirm resolution.

**Exit / Outcome**: Ward-level pending actions identified and assigned; patient safety gaps addressed before they escalate.  
**Regulatory note**: NABH MOM.5 — MAR compliance monitored; IPSG Goal 1 — consent verified before procedures; NABH NIS.3 — nursing workload monitoring.  
**Existing test**: `— needs test`
