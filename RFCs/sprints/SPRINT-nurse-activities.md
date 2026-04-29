# Sprint Plan — Nurse Daily Activities (MAR, vitals, rounds, handoff, restraints)

**Status:** Draft (architecture)
**Date:** 2026-04-28
**Depends on:** Doctor Activities Sub-Sprint A (signatures + signed_records), Active Visit + Workspace primitives, Order Basket, Outbox
**Companion:** SPRINT-doctor-activities.md (doctors); this is the nurse-side equivalent

## Context

Nurses outnumber doctors 4-5:1 in any hospital and create most of the clinical record by volume. MedBrains today has scattered surfaces — vitals here, MAR there, no nurse-centric "My Shift" view. This sprint elevates the nurse to a first-class subject of the system and builds the workflows nurses actually do every shift:

1. **MAR (Medication Administration Record)** — drug rounds: nurse goes bed-to-bed, scans patient wristband + drug barcode, administers per Rx schedule, signs off
2. **Vitals capture** — every 4-6h on every IPD/ICU patient, automated reminders, override window
3. **Intake / Output charting** — fluids in (oral/IV) and out (urine/stool/drain) per shift; computed totals flag imbalance
4. **Pain scores + sedation scales** — RASS, BPS, FLACC; per-protocol re-checks
5. **Wound care** — assessment, photo, dressing change schedule
6. **Restraint monitoring** — Q2h check on physically restrained patients (NABH/JCI mandate)
7. **Patient handoff (SBAR)** — shift change documentation; outgoing nurse hands to incoming
8. **Code blue documentation** — timeline of arrest events
9. **Equipment/supply checks** — crash cart, oxygen flow, suction, defib pad date
10. **Nurse "My Shift" dashboard** — patients assigned, pending tasks, alarms

## Real-world hospital scenarios

### N.1 Drug round at 8 AM
Day-shift nurse logs in 07:30 → "My Shift" shows 6 patients, 22 medications due 0700-0800 → opens MAR → first patient → scans wristband → scans drug barcode → 4 drugs queued → administers each → signs off → moves on. Total round: 25 min for 6 patients.

### N.2 PRN administration
Patient in pain at 14:00 → nurse sees PRN morphine 10mg ordered 4-hourly → checks last given (12:00) → safely 2h gap, but PRN spec says Q4H → blocks with "next dose available 16:00, override?" → calls doctor → override + reason logged.

### N.3 Critical lab back during round
Mid-round, nurse gets push notification: "Patient X K+ = 6.8 critical" → My Shift surfaces alert → nurse alerts doctor → ECG ordered + insulin/dextrose protocol starts → all events documented in code-blue-precursor flow.

### N.4 IV fluid running out
07:00 IV NS 0.9% started at 100ml/h, 1L bag → empty at 17:00 → at 16:30 nurse sees "IV bag near empty" reminder → either order replacement bag or stop infusion.

### N.5 Restraint Q2h check
ICU patient in physical restraint → system requires Q2h check: skin intact? circulation? need to continue? → nurse signs off; missed check after 2h 15min escalates to charge nurse.

### N.6 Shift handoff
07:00 day-shift starts → 06:55 outgoing night nurse handoff briefing per patient: SBAR template (Situation, Background, Assessment, Recommendation) → outgoing signs, incoming countersigns.

### N.7 New admission at 02:30
ER admits to ward → ward nurse receives handoff → captures admission vitals → IV access → initial pain score → assigns nursing care plan → all in one "Admission workspace".

### N.8 Code blue
Cardiac arrest 14:22 → nurse clicks "Code Blue" → system creates timeline → records every drug, defib shock, ROSC status with timestamps → automatically attached to encounter → final summary auto-generated.

### N.9 Equipment check (start of shift)
Charge nurse opens "Equipment checklist" → crash cart sealed: yes; defib pad expiry; oxygen cylinder pressure; suction working; wall O2 flow.

### N.10 Wound care
Decubitus stage-2 wound on patient X → daily dressing change scheduled → nurse opens wound entry → photo → measurements (length × width × depth) → dressing type used → next dressing due 24h.

### N.11 Patient fall risk
Morse fall scale assessed daily → fall risk high → bed-side alarm enabled + bed lowest position + non-skid socks.

### N.12 Sedation in ICU
Ventilated patient → RASS target -2 → check Q2h → adjust propofol → document.

### N.13 Charge nurse review
Charge nurse oversees 12 nurses on shift → opens charge dashboard → sees pending tasks per nurse, overdue restraints, drug rounds done %, fall risk rounds done.

### N.14 Drug administration discrepancy
Patient X has metformin Rx but allergy was just added → MAR blocks administration with "BLOCK: drug allergy" → nurse cancels + alerts MD.

### N.15 Look-alike drug warning at admin
Nurse scans "Insulin R" but Rx says "Insulin N" → MAR blocks with LASA warning → nurse re-scans correct drug.

## Architecture — six subsystems

### 3.1 Nurse Profile + Assignments
`nurse_profiles` (bedside vs charge nurse, specialty, shift type), `nurse_shift_assignments` (per-shift patient list).

### 3.2 MAR (Medication Administration Record)
`medication_administration_records` — one row per scheduled administration. Columns:
- `prescription_id`, `dose_index` (1st, 2nd of N), `scheduled_at`, `administered_at`, `administered_by`, `dose_administered`, `route`, `status` (pending|administered|held|refused|missed), `hold_reason`, `wristband_scan`, `drug_scan`, `is_prn`, `prn_indication`, `signed_record_id` (optional Ed25519 sig for medico-legal).

Status transitions:
- pending → administered (default path; requires both scans)
- pending → held (with reason; doesn't decrement next dose)
- pending → refused (patient refused)
- pending → missed (after grace window, auto)

CDS at administer time:
- DRUG_ALLERGY_BLOCK
- LASA_WARN (drug-name similarity to other patient meds)
- PRN_TOO_EARLY (gap below frequency minimum)
- NDPS_REQUIRES_WITNESS (Schedule X / NDPS — second nurse co-sign)
- LATE_ADMINISTRATION (>30min late from scheduled)

### 3.3 Vitals
Already exists. Add:
- `vitals_capture_schedules` per encounter — frequency (Q4H, Q1H, etc.) — auto-creates pending vitals tasks
- `vitals_overdue_view` for charge dashboard

### 3.4 Intake/Output
`intake_output_entries`:
- `encounter_id`, `recorded_at`, `recorded_by`, `category` (oral|iv|tube|blood|other), `direction` (intake|output), `volume_ml`, `notes`
- View: `io_balance_8h_view` computes net per 8-hour window, flags imbalance > threshold

### 3.5 Restraints, Pain, Wounds
- `restraint_orders` (existing IPD migration likely has this)
- `restraint_monitoring_events` — Q2h checks
- `pain_score_entries` — scale, score, location, intervention, recheck due
- `wound_assessments` — body site, stage, dimensions, photo_url, dressing_change_due

### 3.6 Handoff (SBAR) + Code Blue
- `shift_handoffs` — outgoing→incoming, per patient, SBAR fields, both nurses sign
- `code_blue_events` — start_time, location, leader, recovered/transferred/expired, medications_given JSONB, shocks_given, total_duration

## Schema — migration `133_nurse_activities.sql`

(Partial outline; full DDL ~700 lines. Same RLS + `update_updated_at` + `apply_tenant_rls` patterns as 132.)

```sql
-- Nurse profile
CREATE TABLE nurse_profiles (
  id UUID PK, tenant_id, user_id UNIQUE, specialty,
  shift_pattern, license_number, employment_type, is_active);

-- Per-shift patient assignments
CREATE TABLE nurse_shift_assignments (
  id, tenant_id, nurse_user_id, ward_id, shift_date, shift_type,
  patient_ids UUID[], primary_assigned, charge_nurse_user_id);

-- MAR — one row per scheduled administration
CREATE TABLE medication_administration_records (
  id, tenant_id, prescription_id, patient_id, encounter_id,
  scheduled_at, administered_at, administered_by, dose_index,
  status (pending|administered|held|refused|missed), dose_administered,
  route, hold_reason, refusal_reason,
  wristband_scan_at, drug_scan_at, witness_user_id, is_prn,
  prn_indication, prn_requested_at, signed_record_id, late_minutes,
  notes);
CREATE INDEX mar_pending_due ON mar (tenant_id, status, scheduled_at)
  WHERE status = 'pending';
CREATE INDEX mar_patient_recent ON mar (tenant_id, patient_id, scheduled_at DESC);

-- Vitals capture schedule (auto-task generator)
CREATE TABLE vitals_capture_schedules (
  id, tenant_id, encounter_id, frequency_minutes, started_at, ended_at,
  next_due_at, last_captured_at, created_by);

-- Intake/Output
CREATE TABLE intake_output_entries (
  id, tenant_id, encounter_id, recorded_at, recorded_by,
  category (oral|iv|tube|blood|tpn|urine|stool|emesis|drain|other),
  direction (intake|output), volume_ml, notes);

-- Restraint monitoring
CREATE TABLE restraint_monitoring_events (
  id, tenant_id, restraint_order_id, encounter_id, monitored_at,
  monitored_by, skin_intact, circulation_normal, distress_observed,
  continue_restraint, witness_user_id, notes);
CREATE INDEX restraint_overdue ON restraint_monitoring_events
  (tenant_id, restraint_order_id, monitored_at DESC);

-- Pain
CREATE TABLE pain_score_entries (
  id, tenant_id, encounter_id, recorded_at, recorded_by,
  scale (numeric|wong_baker|flacc|bps|cpot|comfort), score INT,
  location, character, intervention_taken, recheck_due_at);

-- Wound assessment
CREATE TABLE wound_assessments (
  id, tenant_id, encounter_id, body_site, classification,
  stage, length_cm, width_cm, depth_cm, exudate, odor,
  photo_urls JSONB, dressing_type, dressing_changed_at,
  dressing_change_due_at, recorded_at, recorded_by);

-- Shift handoff (SBAR)
CREATE TABLE shift_handoffs (
  id, tenant_id, encounter_id, outgoing_nurse_id, incoming_nurse_id,
  outgoing_signed_at, incoming_signed_at, situation, background,
  assessment, recommendation, alerts JSONB, completed_at);

-- Code Blue
CREATE TABLE code_blue_events (
  id, tenant_id, patient_id, encounter_id, location, started_at,
  ended_at, leader_user_id, outcome (rosc|transferred|expired|stable),
  recorder_user_id, medications JSONB, shocks JSONB, ecg_rhythm_log JSONB);

-- Fall risk assessment
CREATE TABLE fall_risk_assessments (
  id, tenant_id, encounter_id, scale (morse|hendrich|stratify),
  score INT, risk_level, interventions JSONB, recorded_at, recorded_by);

-- Equipment checklist (crash cart, etc.)
CREATE TABLE equipment_checks (
  id, tenant_id, location_id, checklist_template_id,
  checked_by, checked_at, items JSONB, all_passed,
  next_check_due_at);
```

## Backend routes (sub-sprint A focus)

### MAR
- `POST /api/mar/generate` — cron: from active prescriptions, generate scheduled admin rows for next 24h
- `GET /api/mar/me/due-now` — nurse's MAR rows due within next 30min
- `POST /api/mar/{id}/administer` — atomic: scan validation + CDS + insert signed_record + flip status
- `POST /api/mar/{id}/hold`, `/refuse`, `/missed`
- `GET /api/mar/patient/{id}` — full chart per patient

### Vitals scheduling
- `POST /api/encounters/{id}/vitals-schedule` — admin Q4H schedule
- `GET /api/vitals/me/overdue` — nurse's overdue vitals capture
- (vitals capture endpoint already exists)

### Intake/Output
- `POST /api/io-entries`
- `GET /api/io-entries/encounter/{id}/balance?window=8h`

### Restraints
- `POST /api/restraints/{order_id}/monitor`
- `GET /api/restraints/overdue` — Q2h overdue list

### Pain, Wound, Fall
- Standard CRUD + recheck-due alerts

### Handoff
- `POST /api/handoffs` — start (outgoing populates SBAR)
- `PUT /api/handoffs/{id}/accept` — incoming countersigns

### Code Blue
- `POST /api/code-blue/start` — patient_id, location
- `POST /api/code-blue/{id}/log-event` — drug given, shock, rhythm, etc.
- `POST /api/code-blue/{id}/end` — outcome + auto-summarize

### Nurse "My Shift" dashboard
- `GET /api/nurses/me/shift` — composite payload: assignments, MAR due, vitals due, restraints overdue, alerts, handoff incoming/outgoing

## Frontend — sub-sprint shape

### `<MyShiftDashboard />`
Sections: assigned patients (with quick links to chart), MAR due in next 30min, vitals overdue, restraints overdue, code blue alert button, handoff status, charge nurse review (if charge).

### `<MARRound />` mobile-friendly workspace
- Step 1: scan wristband (camera or manual UHID)
- Step 2: see drugs due
- Step 3: scan each drug barcode → confirm → administer
- Step 4: warnings inline (allergy, LASA, PRN-too-early)
- Step 5: sign-off (e-signature)

### `<CodeBlueRecorder />`
- Big START button → timer counts up
- Quick-tap buttons: Compressions, Shock, Adrenaline, Amiodarone, Atropine
- Each tap creates timestamped event → live timeline
- END button → outcome dropdown

### `<HandoffSBAR />`
- Per-patient SBAR template
- Outgoing fills, signs
- Incoming reviews, signs (countersign creates locked record)

### `<IORunningBalance />`
- 8-hour window default, configurable
- Color-coded by direction (intake green, output red)
- Totals per category, net balance
- Flag if abs(net) > 1500ml

## Tests

- MAR atomic administer: scans + CDS + status flip + signed_record all in one tx
- DRUG_ALLERGY_BLOCK at administer: blocks until resolved (no override allowed)
- PRN_TOO_EARLY warns; admin signs override → recorded
- Restraint Q2h overdue alert: 2h 15min after last check → row in alerts feed
- Handoff round-trip: outgoing creates → incoming accepts → record locks
- Code blue timeline: 5 events captured → final summary lists all in order
- Vitals schedule: Q4H schedule generates next 6 due-times correctly

## Acceptance criteria

1. Nurse can complete a 6-patient drug round in ≤25 min on tablet (NFR)
2. Drug allergy block prevents administration entirely (no override)
3. PRN window enforces minimum gap; override requires reason
4. NDPS / Schedule X drugs require witness co-sign
5. Restraint Q2h overdue alerts charge nurse
6. SBAR handoff requires both signatures to lock
7. Code Blue timeline preserves event order, exportable as PDF
8. I/O balance computed live; threshold breach surfaces alert
9. Charge nurse dashboard shows team-wide compliance % per task type
10. CI: cargo clippy/test, pnpm typecheck/build green

## Effort estimate

| Phase | Hours |
|-------|-------|
| Migration 133 (10 tables + RLS + indexes) | 14 |
| MAR backend (generate, administer, hold/refuse/missed, CDS) | 24 |
| Vitals scheduling backend | 8 |
| Intake/Output backend | 6 |
| Restraints, Pain, Wound, Fall backend | 14 |
| Handoff (SBAR) backend | 8 |
| Code Blue backend | 12 |
| Nurse "My Shift" dashboard backend | 8 |
| Frontend: MyShift dashboard | 12 |
| Frontend: MARRound (barcode-friendly) | 16 |
| Frontend: CodeBlueRecorder | 10 |
| Frontend: HandoffSBAR | 8 |
| Frontend: IO + restraint + pain + wound + fall forms | 16 |
| Tests (10 scenarios) | 20 |
| Permissions + i18n + integration with active visit | 6 |
| **Total** | **~182h ≈ 4.5 dev-weeks** |

Recommend split into 3 PRs:
- **PR-1 (foundation)**: schema + MAR backend + MyShift backend + permissions
- **PR-2 (clinical events)**: handoff + code blue + restraint + pain + wound + fall
- **PR-3 (frontend)**: all UI

## Out of scope (this sprint)

- Vital sign device integration via HL7 (Phase 2 — needs device middleware)
- Bedside QR/barcode scanner hardware (Phase 2)
- Push notifications to nurse phones (Phase 2 — needs FCM/APNS)
- Nurse productivity analytics (Phase 3)
- AI-assisted note auto-population (Phase 4)

## Critical files

### New
- `migrations/133_nurse_activities.sql`
- `routes/nurse_profile.rs`
- `routes/mar.rs` (Medication Administration Record)
- `routes/vitals_schedule.rs`
- `routes/intake_output.rs`
- `routes/restraints_monitoring.rs`
- `routes/pain_scores.rs`
- `routes/wound_care.rs`
- `routes/fall_risk.rs`
- `routes/equipment_checks.rs`
- `routes/handoffs.rs`
- `routes/code_blue.rs`
- `routes/nurse_dashboard.rs`
- `services/cds/mar_check.rs`
- `apps/web/src/pages/nurse/my-shift.tsx`
- `apps/web/src/components/Nurse/MARRound.tsx`
- `apps/web/src/components/Nurse/CodeBlueRecorder.tsx`
- `apps/web/src/components/Nurse/HandoffSBAR.tsx`
- `apps/web/src/components/Nurse/IORunningBalance.tsx`
- `apps/web/src/components/Nurse/RestraintCheckList.tsx`

### Reused
- Doctor Activities `signed_records` for MAR / handoff signatures
- Order Basket pattern for "stage multiple wound dressings + reassign" workflows
- `outbox_events::queue_in_tx` for late-administration alert emails

## Compliance posture

- **NABH MOM.4c**: medication safety — MAR captures all 5 Rights enforcement points (right patient/drug/dose/route/time)
- **NABH NUR.5**: restraint policy — Q2h documented monitoring evidence
- **JCI IPSG.1**: patient identification — wristband scan recorded per administration
- **NDPS Act §42**: controlled substances — witness co-sign mandatory
- **JCI IPSG.6**: fall risk — Morse scale + interventions logged daily
