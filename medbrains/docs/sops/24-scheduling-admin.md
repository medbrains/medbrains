---
module: scheduling-admin
priority: P1
status: draft
---

# SOP: Scheduling Administration

## Overview
The Scheduling Administration module enables capacity management for OPD and procedural services: doctor schedule creation and maintenance, slot configuration (consultation duration, maximum patients per session), waitlist management, no-show tracking and prediction, and appointment optimisation. It is operated by the Scheduling Admin role in coordination with department heads and front office. The module feeds directly into OPD token issuance, kiosk booking, and patient reminder workflows.

## Actor Matrix

| Actor (Role) | Can Perform | Notes |
|---|---|---|
| `scheduling_admin` | Create/edit doctor schedules, manage waitlist, run no-show reports | Primary scheduling operator |
| `hospital_admin` | View scheduling efficiency metrics, approve schedule changes | Strategic oversight |
| `receptionist` | Override single appointment, add urgent slot | Day-of operational changes |
| `doctor` | Mark self as unavailable (leave, emergency), request schedule change | Self-managed availability |
| `front_office_staff` | View schedule to answer patient queries | Read-only scheduling data |

---

## Scenario 1: Scheduling Admin Creates and Publishes Doctor Schedule — Actor: Scheduling Admin

**Actor**: `scheduling_admin`  
**Entry point**: Scheduling → Doctor Schedules → New Schedule  
**Preconditions**: Doctor record exists; department and OPD room assigned

**Steps**:
1. Scheduling admin opens New Schedule for a doctor; selects doctor and department.
2. Configures weekly recurring schedule: days of week, start time, end time, lunch break.
3. Sets slot parameters: consultation duration (e.g., 10 min), maximum patients per session (e.g., 30).
4. Configures appointment types: New Patient (longer slot) vs Follow-up (shorter) — different durations configurable.
5. Sets advance booking window: e.g., patients can book up to 14 days ahead.
6. Adds exceptions: holidays, leaves (sourced from HR module if integrated), half-day sessions.
7. Publishes schedule → slots become available for booking (kiosk, receptionist, portal).
8. Sends confirmation to doctor; doctor can flag conflicts within 24 hours.

**Exit / Outcome**: Schedule published; slots open for booking; doctor notified.  
**Regulatory note**: Clinical Establishments Act — OPD timing must be displayed; Consumer Protection Act — published schedule must be honoured; NABH OPD.1 — appointment system documented.  
**Existing test**: `— needs test`

---

## Scenario 2: Scheduling Admin Manages Waitlist for Full Schedule — Actor: Scheduling Admin

**Actor**: `scheduling_admin`  
**Entry point**: Scheduling → Waitlist Management  
**Preconditions**: Doctor's session is fully booked; patients requesting appointment added to waitlist

**Steps**:
1. Patient (via receptionist or portal) requests appointment for a fully booked session → added to waitlist with timestamp.
2. Scheduling admin opens Waitlist panel; sees all waiting patients by department and doctor, sorted by wait time.
3. When a slot opens (cancellation or scheduling admin adds an emergency slot):
   - System auto-notifies first patient on waitlist via SMS.
   - Patient has 2-hour window to confirm.
   - If no response: next patient on list notified.
4. Scheduling admin can manually promote a patient (e.g., urgent clinical case) — documents reason.
5. Waitlist cleared daily for lapsed slots.
6. Reports: average waitlist length by doctor, average wait time to appointment.

**Exit / Outcome**: Waitlist managed fairly with audit trail; patients notified when slots open; no-fill slots minimised.  
**Regulatory note**: Consumer Protection Act 2019 — fair access to services; NABH OPD.1 — appointment waiting time documented as quality indicator.  
**Existing test**: `— needs test`

---

## Scenario 3: Scheduling Admin Reviews No-Show Rate and Adjusts Overbooking — Actor: Scheduling Admin

**Actor**: `scheduling_admin`  
**Entry point**: Scheduling → No-Show Analytics  
**Preconditions**: Appointment data for ≥ 4 weeks exists; no-show definition configured (patient did not check in within X minutes of slot time)

**Steps**:
1. Admin opens No-Show Analytics; selects period and filters by doctor, department, day of week.
2. Views:
   - **No-show rate by doctor** (% appointments not attended).
   - **No-show rate by day / time slot** (identifies patterns — Monday morning vs Saturday afternoon).
   - **Cancellation vs no-show**: cancelled with notice (manageable) vs pure no-show (revenue loss).
3. For doctors with no-show rate > 20%: system suggests overbooking factor (e.g., add 2 buffer slots per 10-slot session).
4. Admin adjusts schedule configuration: adds buffer slots or implements double-booking for last 2 slots.
5. Reviews impact over next 2 weeks; adjusts overbooking factor.
6. Tracks: overbooking incidents (when all patients show up — wait time spikes) vs revenue improvement.

**Exit / Outcome**: No-show patterns quantified; overbooking factor applied and monitored; revenue loss from no-shows reduced.  
**Regulatory note**: Consumer Protection Act — overbooking must not result in unacceptable wait times; NABH OPD.1 — patient wait time monitored; transparent communication to patients if delays occur.  
**Existing test**: `— needs test`

---

## Scenario 4: Doctor Blocks Unavailability for Leave — Actor: Doctor

**Actor**: `doctor`  
**Entry point**: My Schedule → Mark Unavailable  
**Preconditions**: Doctor is logged in; upcoming leave approved in HR module

**Steps**:
1. Doctor opens My Schedule; sees upcoming appointments for each day.
2. Selects date(s) to mark as unavailable; adds reason: Leave / Conference / Emergency / Other.
3. System checks: are there existing appointments on those dates?
4. If appointments exist: system offers options:
   - **Cancel and notify patients** (auto-SMS + email with next available slot suggestion).
   - **Transfer to colleague** (select covering doctor — patients rescheduled with covering doctor).
5. Doctor confirms action; system executes in bulk.
6. Scheduling admin receives notification; reviews if patient volume exceeds covering doctor's capacity.
7. Unavailability recorded; schedule shows blocked dates in admin view.

**Exit / Outcome**: Affected patients notified and rescheduled; unavailability documented; no orphaned appointments.  
**Regulatory note**: Consumer Protection Act — patients must be notified of cancellations with adequate notice and alternative provision; NABH OPD.4 — continuity of care during doctor absence.  
**Existing test**: `— needs test`
