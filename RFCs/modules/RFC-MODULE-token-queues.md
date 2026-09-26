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

## 10. Decided (2026-09-26)

- Plan agreed; **P0 first**, then P1.
- Board default: **number only**; initials/full name is a per-queue opt-in.
- Voice: **English** first; languages stay a per-queue list so more can be added.
- Camp devices: **native staff app, camp module**; RN `mobile-camp` is not extended.
