# RFC-MODULE — Configurable Token Queues (hospital + camps, online + offline)

Status: **AGREED 2026-09-26** — building P0
Owner decisions recorded: see §1.

## 1. What the operator asked for

One token engine that a **hospital admin configures per queue** — no developer,
no deploy — for anything that needs a line: a department, a doctor, a room, a
pharmacy or lab counter, billing, and **temporary queues** such as a medical
camp set up at short notice in any place, which must behave like the hospital
(registration → vitals → doctor → pharmacy) immediately.

Decisions (2026-09-26):

| Question | Answer |
|---|---|
| What is configurable per queue | numbering · categories & priority · counters & who calls · hours & limits |
| Channels | staff desk + native staff app · self-service (kiosk, patient QR) · TV board + voice · SMS/WhatsApp · **extensible** to new devices (token printers next) |
| Offline | **both** — online normally, and a camp keeps issuing and calling with no internet, syncing later |
| Who creates/changes queues | **hospital admin only by default**, but as a permission, not a hard-coded role, so it can be granted to a coordinator later |

## 2. What exists (inventory 2026-09-26)

Works: `tokens` table + `medbrains-tokens` engine (advisory-locked daily seq,
priority weights with ageing and escalate-only, visit-shared number,
refer/return, requeue policy, per-module on/off), auto-issue from registration,
OPD, appointments, camp, lab, pharmacy, billing; `token_scopes` view
(department · camp counter · station · location); web board with WebSocket +
browser voice; TV boards (polling); camp offline outbox; Loro/iroh edge core;
Twilio + WhatsApp outbox handlers.

Hard-coded today, must become configuration: prefix per module (`token_prefix`,
`R/T/P/B/L/X/D/Q`), `{prefix}-{seq:03}` format, daily reset by server date,
priority list and weights (in SQL **and** Rust), English-only voice string.

Live defects found (fixed first, §8 P0):

1. `call_next` picks and calls in two transactions — two desks can call the
   same patient.
2. `transition()` accepts any status from any status (completed → waiting).
3. `/ws/queue/{id}` resolves the tenant only from `departments`, so counter,
   station and location queues never get live updates.
4. `sms.token_called` has no registered handler — the opt-in token SMS is never
   delivered.
5. Camp tokens are issued into the **hospital's** OPD department queue: camp and
   hospital patients share numbers and positions; the camp board reads
   `opd_queues` and shows hospital patients.
6. Camp registration numbers `CR-{code}-{count+1}` are computed without a lock.
7. Kiosk, patient QR status page and the thermal slip all run on legacy
   `queue_tokens`; a walk-in or camp patient gets no QR or slip.
8. A paired TV cannot read `camp-board` (needs `front_office.queue.list`).

Legacy still live: `queue_tokens`, `opd_queues`, `queue_display_config`
(language/announce columns read by nothing), `queue_priority_rules` (ignored by
the engine). Appointment check-in writes three rows with three numbers.

## 3. Regulatory and safety norms

| Norm | What it means here |
|---|---|
| NABH / IPSG-1 patient identification | A token number is **not** an identifier. Calling a token must still lead to 2-ID confirmation at the counter; the console shows name + UHID/camp reg no. |
| DPDP Act 2023 (data minimisation) | Public boards and voice default to **number only**; name/initials on a board is a per-queue opt-in. SMS carries no diagnosis. |
| RPwD Act 2016, senior-citizen priority (MWPSC Act 2007, state health directives) | Elderly / disabled / pregnant categories exist by default and cannot be ranked below "normal"; the kiosk offers them. |
| WCAG 2.2 AA | Every call is both **visual and spoken**; board contrast and size per TV rules; kiosk targets ≥ 44 px. |
| TRAI DLT (commercial SMS) | Token SMS uses registered DLT templates; the existing Twilio handler already enforces template ids. |
| Clinical Establishments Act 2010 (camps) | A camp's register (who was seen, when, by whom) is kept after the camp closes — closing a temporary queue archives, never deletes. |

## 4. Model

A **queue** becomes a real row. Every token belongs to exactly one queue.

```
queues                       -- the definition an admin edits
  id, tenant_id, code, name, module            -- module: registration|opd|lab|pharmacy|billing|radiology|camp|custom
  scope, scope_id                              -- validated against token_scopes (dept/location/station/counter)
  camp_id NULL                                 -- set for camp queues
  lifecycle: permanent | temporary
  valid_from, valid_until NULL                 -- temporary: opens/closes itself
  status: draft | active | paused | closed     -- closed = archived, history kept
  numbering: prefix, start_at, pad_width, reset_rule(daily|session|never), share_visit_number bool
  limits: max_tokens_per_period NULL, slot_minutes NULL, close_behaviour(expire|carry_over|transfer)
  close_transfer_queue_id NULL
  board: show_name(none|initials|full), languages[], announce_template, repeat_count
  channels: kiosk bool, patient_qr bool, sms_on_issue bool, notify_when_ahead INT NULL
  offline: allow_offline bool, device_block_size INT
queue_hours       (queue_id, weekday|date, opens, closes)          -- sessions; "session" reset uses these
queue_categories  (queue_id, code, label, weight, ageing_minutes, requires_reason, kiosk_selectable)
queue_counters    (queue_id, label, location_id NULL, active)      -- desks/rooms serving the queue
queue_counter_staff (counter_id, user_id | role)                   -- who may call at that counter
queue_templates   (code, name, stations jsonb)                     -- e.g. "General camp": registration→vitals→doctor→pharmacy
tokens.queue_id   FK, + UNIQUE (queue_id, period_key, number)
```

Existing implicit queues (module + scope) are backfilled into `queues` rows with
today's behaviour (current prefix, daily reset, default categories), so nothing
changes for a hospital until an admin edits a queue.

**Numbering.** `period_key` comes from the queue's reset rule and the
**tenant's timezone** (not the server date). The number is
`prefix + [device block] + zero-padded seq`. The uniqueness constraint replaces
"trust the lock" as the guarantee.

**Priority.** Weights come from `queue_categories`, not the SQL constant.
Default categories reproduce today's order exactly (stat, urgent, emergency
referral, elderly/disabled/pregnant, carried-over, VIP, normal), with ageing
per category and escalate-only kept.

**Station flow (camps and any multi-step visit).** A template lists stations.
Completing a token at station N issues the patient's token at station N+1,
reusing the existing refer/return mechanism and the visit-shared number, so the
patient keeps one number through the camp.

## 5. Offline

Two levels, both needed at camps:

1. **Single device, no network.** The server hands each device a numbered
   **block** when it syncs (e.g. device `B` gets `B001–B200` for the camp
   queue). Tokens are issued and called locally, queued in the outbox with
   idempotency keys, and merged on reconnect; the unique constraint rejects
   any collision instead of silently duplicating it.
2. **Camp LAN, no internet.** A laptop at the camp runs `medbrains-edge` (it
   already exists: Loro docs, WSS, iroh peer sync). Staff devices and the TV
   talk to it over the local network, so the camp has **one shared queue**,
   a live board and voice with no internet; the hub syncs to the server when
   a connection appears.

Tokens are append-only events, not last-write-wins CRDT fields — matching the
edge tier design already written in `medbrains-edge`.

## 6. Permissions (defined in Rust first)

| Code | Purpose | Default holders |
|---|---|---|
| `queues.config.manage` (new) | Create, edit, pause, close queues, counters, categories, templates; start a camp from a template | super_admin, hospital_admin only |
| `queues.config.view` (new) | Read queue definitions (setup screen read-only) | admins, front office, camp coordinator |
| existing `front_office.queue.manage` / `opd.token.manage` | Issue / call / serve at a counter | unchanged |
| per-counter staff list | Further narrows who may call at *that* counter | set per queue by admin |
| existing `display.board.read` (paired device) | Boards, **now including camp boards** | display_device |

## 7. Screens (UI ships with every phase)

- **Admin → Queues** (new, `queues.config.view`; edit controls gated on
  `.manage`): list with status/lifecycle filters; queue editor in tabs —
  General · Numbering (with a live preview "next token: CAMP-B-017") · Categories
  (drag order) · Counters & staff · Hours & limits · Board & voice · Channels ·
  Offline. States: empty, loading, error (never blank), paused/closed banners.
- **Start a camp** (on the camp detail page): pick template + location + dates →
  one click creates the camp's queues, counters and a board link; shows QR codes
  to pair a TV and devices.
- **Counter console** (web + native staff app module): call next, recall,
  skip, hold, transfer, no-show, serve, complete; shows name + ID for 2-ID.
- **Board**: bound to a queue by pairing; language/voice from queue config;
  number-only by default.
- **Kiosk / patient QR / portal "my token"**: on unified tokens.

## 8. Phases (each ends on the screen)

| # | Scope | Ends when |
|---|---|---|
| P0 | Fix defects 1–4, 6, 8 (race, transition guard, WS scopes, SMS handler, camp reg numbering, camp board for TVs) | each defect has a failing-then-passing test and is seen on the console/board |
| P1 | `queues` + categories + hours; engine reads config; backfill; **Admin → Queues** screen | an admin changes a prefix/reset/category and the next token shows it |
| P2 | Counters + counter staff; console actions recall/skip/hold/transfer | two desks call from the same queue with no double call |
| P3 | Board & voice config; board bound by pairing; languages | a paired TV speaks the configured language for its queue |
| P4 | Camp templates + station flow; camp queues separate from hospital OPD | a camp started from a template runs registration → vitals → doctor → pharmacy with one number |
| P5 | Kiosk, QR status, slip, portal on unified tokens; SMS/WhatsApp on issue + "N ahead" | a walk-in gets a QR and an SMS, and the slip prints |
| P6 | Offline: device blocks (native staff app camp module) → camp edge hub + TV | airplane-mode camp issues and calls, reconnects, no duplicates |
| P7 | Retire `queue_tokens` / `opd_queues` duplication and dead config tables | one row, one number per patient per queue |
| later | Printer device class (ESC/POS), other token devices | — |

## 9. Acceptance scenarios

1. **Given** OPD queue prefix `T`, **when** the admin changes it to `GEN` with
   start 100, **then** the next OPD token is `GEN-100` and earlier tokens keep
   their numbers.
2. **Given** a queue with reset rule *session* (09:00–13:00, 14:00–17:00),
   **when** the 14:00 session opens, **then** numbering restarts at the start
   number and morning tokens not served follow the close behaviour.
3. **Given** max 60 tokens/day, **when** the 61st is requested at the desk,
   **then** issue is refused with "Queue full for today — 60 of 60", and the
   kiosk shows the same message, not an error.
4. **Given** a temporary camp queue valid 27–28 Sep, **when** 28 Sep ends,
   **then** the queue closes itself, waiting tokens expire, and the camp
   register still lists every token.
5. **Given** an admin starts "General camp" at Village X, **when** they press
   Start, **then** registration, vitals, doctor and pharmacy queues exist,
   separate from hospital OPD numbering, with a board link and pairing QR.
6. **Given** a camp patient `C-012` completes vitals, **when** vitals marks
   complete, **then** the patient appears in the doctor queue as `C-012`.
7. **Given** two receptionists press *Call next* at the same moment, **then**
   they call two different patients (never the same one).
8. **Given** a completed token, **when** anyone tries to set it back to
   *waiting*, **then** it is refused (use *recall* or *requeue*).
9. **Given** a pregnant patient and ten normal patients waiting, **when** call
   next, **then** she is called first; **given** a VIP category, **then** it can
   never outrank emergency referral.
10. **Given** a receptionist without `queues.config.manage`, **when** they open
    Admin → Queues, **then** they see it read-only (or not at all without
    `.view`), and the API answers 403 on edit.
11. **Given** a counter staff list of Dr A only, **when** Dr B calls at that
    counter, **then** it is refused.
12. **Given** a board set to Tamil + English, number-only, **when** `T-014` is
    called, **then** it shows `T-014` (no name) and speaks both languages.
13. **Given** a camp device in airplane mode holding block `B001–B200`,
    **when** it issues 30 tokens and reconnects, **then** all 30 appear on the
    server once, with no collision with device `A`.
14. **Given** the camp hub laptop and TV on a LAN with no internet, **when** a
    token is called on a phone, **then** the TV updates and speaks within 2 s.
15. **Given** SMS on issue is on for pharmacy, **when** a token is issued,
    **then** the patient gets the DLT-template SMS with number and counter;
    **when** 3 people are ahead, **then** a "you're next soon" message is sent
    once.
16. **Given** the server is unreachable, **when** a board polls, **then** it
    shows the last known queue with a "connection lost" banner — never an empty
    queue.

17. **Given** a console left open showing a patient as waiting, **when** a
    colleague has already seen the patient through and the stale screen presses
    *Call*, **then** it is refused with "Token is already completed" and the
    token stays completed (found comparing P0 with a real desk).
18. **Given** a patient called once who did not come, **when** the desk presses
    *Call* again, **then** it is re-announced (called → called is allowed) —
    repeating a call is the most common thing a desk does.

19. **Given** OPD queues in eight departments, **when** a desk views "All
    departments", **then** every token is distinguishable — today every row
    reads `T-001` because each department numbers from 001 with the same prefix
    (seen on the console in the P0 Playwright run). P1's per-queue prefix, and a
    queue/room column on combined views, fix it.
20. **Given** a queue whose visits complete in under a minute, **then** the
    console says "under 1 min", not "Typically 0 min per patient".

21. **Given** the desk console, **then** every token shows the patient's name
    (the name half of 2-ID); **given** any board or the public socket, **then**
    only the number — found in the simulator journey: every automatic path
    issued tokens with no name, so the console showed "—" on every row.

22. **Given** OPD tokens are given out 09:00–13:00 and 16:00–19:00, **when**
    the desk registers a walk-in at 13:30, **then** the patient is registered
    and the desk is told "General OPD is closed — tokens from 15:00", instead of
    a UHID with no number and no reason.
23. **Given** patients line up at 07:30 for a 09:00 OPD, **then** tokens are
    given out from `early_issue_minutes` (default 60) before opening, in the
    order people came.
24. **Given** a queue that restarts its numbers each session, **when** two
    sessions share a prefix, **then** the hours are refused — leftover morning
    patients and new evening ones would both hold `M-005`.
25. **Sessions govern issuing, never serving**: a doctor finishing the morning
    list after 13:00 is normal, so a session ending touches no waiting token
    (the nightly rollover still expires yesterday's).
26. *Not built:* a dated closure (public holiday) — today the admin pauses the
    queue. *Not built:* an overnight session (night pharmacy 20:00–08:00) —
    refused with "a session ends on the day it starts".
27. *Known:* `token_date` is the database's UTC date, so a 24-hour queue's day
    turns at 05:30 IST. Configured queues number by the hospital's local date
    (`period_key`); moving every token query to local time is a system-wide
    change (set the time zone per transaction) and needs its own PR.

28. **Given** a pharmacy with Window 1 and Window 2 serving its queue, **when**
    the desk presses *Call next* without choosing a window, **then** it is
    refused with "Choose your counter — Pharmacy is served at Window 1, Window
    2"; **when** it calls at Window 2, **then** the board shows the token with
    "Window 2" under it.
29. Station names repeat across a hospital (three "Closed Counter"s in the dev
    tenant), so a queue's counters must have distinct names — the call names
    the counter, and "which window" must never be ambiguous.
30. **Given** a counter kept for Dr Rao, **when** Dr Rao leaves and the admin
    re-saves with a stale staff id, **then** the save is refused — dropping the
    unknown id would silently open the room to everyone.

31. **Given** A, B and C waiting, **when** A is sent for an ECG and the desk
    puts A on hold, **then** Call next calls B, the board still shows A's
    number as "On hold", and **when** A is back, A is called before C. A held
    patient who walks up to the counter can be called at once; a hold nobody
    releases closes with the day.
32. *Skip* is not a separate action: a called patient who is not there is a
    **No-show**, and **Requeue** puts them back by the hospital's recall policy.
    A second button for the same thing would split one statistic in two.

33. **Given** a walk-in registered to General Medicine who needs
    Orthopaedics, one Ortho patient who arrived before them and one after,
    **when** the desk moves the visit, **then** the visit, its queue row and its
    token are in Ortho, the new department (and a named doctor) can open it,
    and Ortho calls the earlier patient, then them, then the later one — the
    registration mistake was the hospital's, so they are not sent to the back.
    **Given** the doctor has already called them, **then** the move is refused:
    that is a referral.

34. **Given** a named patient waiting, **when** a paired waiting-room screen
    (a display, not a desk) reads the board, **then** it is sent the number and
    no name — or initials, only if the queue opts in. Found in P3: the board
    endpoint sent every waiting patient's full name to the TV and relied on
    the screen not to show it.
35. **Given** a TV on a wall that nobody has touched, **then** the browser will
    not speak, so the board says "Voice is off until someone presses a key or
    taps this screen once" — never a silent board with no explanation.
36. **Given** a queue speaking English and Tamil on a screen with no Tamil voice
    installed, **then** it speaks English only and says the Tamil voice is
    missing — a Tamil sentence read by an English voice is noise.
37. A call is read one character at a time ("T 0 1 4"), which is what a
    patient matches against the slip in their hand in a noisy hall.

38. **Given** a TV showing a pairing code, **when** the administrator approves
    it for the OPD board of one department, **then** the screen knows its board
    without anyone touching it, reads it without patient names, and is refused
    everything else — it acts as the hospital's display account, never as the
    administrator who approved it. Approving a screen without choosing its
    board is refused.

## P0 progress (2026-09-26)

Done on `feature/token-queues-p0`, each with a server test and a desk-view
Playwright journey (`e2e/journeys/token-queue-p0.spec.ts`):
double call-next race · transition guard (409) · live updates for every scope
kind · token-call SMS sender + Admin → Settings → Tokens switch · locked camp
registration numbers · paired TV reads the camp board.

Found while testing: **every Call on every queue answered 400 on master** since
#4648 — `opd.queue.called` was emitted without the keys its registry requires.
Now emitted only for OPD encounter tokens, with them. Not deployed, so
production never had it.

**Done early (was carried to P3):** the public `/ws/queue/{scope}` feed no
longer carries the patient's name in `token_called` — it sends the
"Token only" placeholder, matching the number-only board decision (§10). Tokens
themselves now carry the name, for the desk console.

## P1 slices (2026-09-26)

- **P1a — queue definitions**: `queues` row per (module, scope) with prefix,
  start number, pad width, reset rule (daily | never), daily limit, status
  (active | paused | closed), optional valid_from/valid_until; `tokens.queue_id`.
  **No backfill**: a scope with no row keeps today's behaviour exactly, so no
  hospital changes until an admin configures a queue. Admin → Queues screen
  (list, create, edit, pause, close) with a live "next token" preview.
  *Built 2026-09-26:* `queues` (migration 1020), `front_office.queue.config.{view,manage}`
  (view granted to receptionist + front-office staff), engine placement shared
  by auto and manual issue (auto-issue skips a closed/full queue, manual issue
  answers 409 with the reason), Admin → Queues with a live first-slip preview.
  Server tests `token_queue_config_test.rs` 5/5.
- **P1b — categories**: per-queue priority categories and weights replacing the
  hard-coded `token_priority_weight`.
  *Built 2026-09-26:* `queue_categories` (migration 1021) with ranks 3–9 under
  the locked clinical tiers; `token_queue_weight` drives board, call-next,
  requeue and "ahead" counts; protected lanes (elderly/disabled/pregnant)
  can never rank after normal; custom lanes accepted on issue and shown by
  their own name (`priority_label`). Admin → Queues → Lanes editor. Found in
  the journey: the assistant launcher sat above open drawers, covering Save —
  now just beneath the modal layer.
- **P1c — hours & sessions**: opening hours, session reset rule, close
  behaviour at the end of a session.
  *Built 2026-09-26:* `queue_sessions` (migration 1022: days, opens, closes,
  optional per-session prefix), `queues.early_issue_minutes`, reset rule
  `session`, and `tokens.period_key` — the numbering period on the hospital's
  clock, kept on the token so editing hours mid-day never restarts numbers.
  No sessions = all day (unchanged). Admin → Queues → **Hours** drawer; the list
  says "Closed — tokens from 15:00". Registration outside hours now tells the
  desk why there is no token (`token_refused`). Close behaviour: waiting
  patients stay (scenario 25); an "expire at session end" option was not
  built — no hospital asked for it. Tests: 6 unit, 2 server scenarios, the
  `queue-hours` journey 3/3.
  *Found while proving it:* the registration review read the department's
  UUID aloud ("Dept f5546e25-…") — now the name, checked in every journey;
  `token_referral_test` had failed since P0 (it completed waiting tokens);
  28 server tests picked `tenants LIMIT 1`, wrong once a second tenant exists;
  `device_node_key_test` targets the route #4630 moved (not fixed here).

## P2 slices (2026-09-26)

- **P2a — counters and counter staff** *(built 2026-09-26)*: counters are the
  existing `stations`; `queue_counters` (migration 1023) says which serve a
  queue and, optionally, who may call at each. A queue with counters takes
  calls (call, call next, advance to called) only at one of them, from the
  listed staff (scenario 11 — a data rule, so bypass roles do not skip it).
  Admin → Queues → **Counters** drawer, which can also create a new counter
  (the first screen that makes a station). The console's counter picker offers
  exactly the queue's counters. Tests: 3 unit, 2 server, the `queue-counters`
  journey 3/3.
  *Found:* the console's department picker was gated on
  `admin.settings.departments.list`, which no receptionist holds — the desk
  could not choose a department at all. The department list now also admits
  `front_office.queue.manage`, and the console gates on the same codes. The
  console's counter picker repeated station names (duplicate options).
  *Follow-up:* the doctor's *Call patient* on `/opd` goes through the encounter
  path and names no counter; an OPD queue with rooms needs the room there too.
- **P2b — console actions**: *Call again* (recall), *No-show* and *Move up*
  already exist; skip is No-show + Requeue (scenario 32).
  *Hold built 2026-09-26:* status `on_hold` (waiting → on hold → back to
  waiting in the same place, or called straight from hold), Hold / Back on the
  console for the six patient queues, "On hold" on the board, expired by the
  nightly rollover. Tests: 2 server + 1 rollover (each fails without the
  change), the `queue-hold` journey 3/3.
  *Found:* receptionists got 403 on `GET /api/stations`, so the console's
  counter picker was empty unless the queue had counters — now also admitted
  for `front_office.queue.manage`, and the fetch is gated on the same codes.
  The picker offered every station while a queue's counters were still
  loading (a desk could pick one the server refuses) — it now waits. Admin →
  Queues gained a search box: with dozens of queues the one just created sat on
  page 2.
  *Transfer built 2026-09-26:* `opd.visit.transfer` (receptionist, front
  office), `POST /api/opd/encounters/{id}/transfer`, *Move* on the console for
  waiting / on-hold OPD visits. The visit keeps its visit-wide number unless the
  new department numbers its own queue, and the desk is told which. Tests: 1
  server scenario (fails without the endpoint), the `queue-transfer` journey 3/3.
  *Found:* changing a visit's department (`PUT /api/opd/encounters/{id}`) moved
  only the encounter — the queue row and token stayed in the old department,
  a patient waiting in a queue that would never call them — and nothing on
  screen called it; the handler also ran its access check twice.
  *Follow-up:* the old department's `dept_member` grant is not revoked (the
  authz facade has no raw revoke); it keeps read access to a visit it
  registered.

**P2 done** (counters, hold, transfer). Next: **P3** — board and voice.

## P3 slices (2026-09-26)

- **P3a — board and voice config** *(built 2026-09-26)*: `queues.board_shows`
  (number | initials), `voice_languages` (en, hi, ta; 1-3, in order),
  `announce_repeat` (1-3), migration 1024; Admin → Queues → Edit → board and
  voice. `GET /api/tokens/board/config`; the board speaks each language, that
  many times, one character at a time (scenarios 34-37). Tests: 1 server
  privacy scenario (fails without the redaction), 3 unit, the
  `queue-board-voice` journey.
  *Found:* the board endpoint sent full names to displays (scenario 34). The
  dev server did not proxy `/ws`, so on it no board ever announced a call —
  every earlier journey saw calls only through polling.
- **P3b-1 — pairing binds the board** *(built 2026-09-26)*: approving a
  display records its board and department (migration 1025) and the paired
  device carries them; `GET /api/device/board` tells a screen what it shows.
  Admin → Paired devices → **Screens waiting to be paired** (the list and
  approve endpoints existed with no screen — nobody could approve a TV on the
  web); the device list shows each screen's board. Tests: 1 server scenario
  (display account, board, no names, 403 on patients), 1 unit, the
  `screen-pairing` journey 3/3.
  *Found — security:* a TV approved by code acted as **the approving
  administrator** by default: a public screen holding a full admin session
  (every record, every action, and the board's name redaction skipped). A
  display now acts as the hospital's `display_boards` service account, which
  cannot sign in and holds no grants; the auth middleware gives a
  service-account device exactly what it was paired as (a display:
  `display.board.read`). *Screens paired before this act as whoever approved
  them: revoke and re-pair them.* Also: no user could ever hold the built-in
  `display_device` role (`users.role` is an enum without it).
- **P3b-2 — the TV side**: the web board, opened on a TV with no session,
  shows its pairing code, waits for approval, and opens its own board. *Next.*

**Found by the walk-in journey (2026-09-26):** the doctor's *Call patient* on
`/opd` needs no access to the encounter, while *Start consultation* checks it —
a doctor can call a patient whose record they cannot open. Align call and
no-show with `require_encounter_access` (follow-up, needs a second-doctor
journey to prove the refusal).

## 10. Decided (2026-09-26)

- Plan agreed; **P0 first**, then P1.
- Board default: **number only**; initials/full name is a per-queue opt-in.
- Voice: **English** first; languages stay a per-queue list so more can be added.
- Camp devices: **native staff app, camp module**; RN `mobile-camp` is not extended.
