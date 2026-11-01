# RFC: SOP flows ("tracks")

Status: DRAFT, awaiting approval · Owner: Domnic Amalan S · 2026-11-01

## 1. Problem

Every hospital runs the same work differently: who clears a discharge, when payment is
collected, which referrals need a senior's approval. Its SOPs say how. MedBrains cannot follow
them today, because almost every flow is written into the code:

- token and queue transitions (`tokens/src/lib.rs:1268`), referral lifecycle
  (`opd/src/referral_lifecycle.rs`), the discharge checklist (`ipd/src/lib.rs:4214`), the leave
  chain (`hr/src/leave_approval.rs:58`), lab and pharmacy status guards, admission deposit rules;
- 122 `*_status` enums fix lifecycles in the schema;
- the 29 SOPs in `docs/sops/` are documents only; nothing in the app reads them.

Changing a flow means a code change. A hospital cannot say "for insurance patients, discharge
needs the TPA desk's clearance before billing" without a developer.

The pieces for a fix already exist but sit unused: `workflow_templates` / `workflow_instances` /
`workflow_step_logs` (migration 0110), a before-event gate hook (`emit_before_event`), the live
approvals engine, versioned form templates, and the knowledge change-set engine (#5147).

## 2. The idea: railway tracks

| Railway | MedBrains |
|---|---|
| **Track** | A flow: the route a patient or task takes, e.g. "IPD discharge" |
| **Station** | A step where something happens: summary signed, pharmacy returns, bill settled |
| **Switch (points)** | A branch chosen by facts: insurance or cash, emergency or OPD, age, department |
| **Signal** | A gate that holds the train until it clears: consent, payment, sign-off, a permission |
| **Timetable** | Expected time per station; the board shows who is late (SLA) |
| **Control room** | A live board of every patient on every track, and where they are stuck |

A hospital picks a flow from a library built from SOPs, sets its switches, previews what would
change, and applies it **in one click**.

**Two kinds of people, like a railway.** Engineers lay the track; the pointsman only throws the
switch. In MedBrains:

- **Track builders** (MedBrains, and certified Developer partners) design library flows in code
  review, with every station, switch and signal tested.
- **Hospital staff** (administrators, quality officers, department heads), who are not technical,
  only **flip switches** on a switchboard: plain-language choices like "Insurance patients need
  TPA clearance before billing: On / Off" or "Who approves a referral: HOD / Medical
  superintendent". No diagrams, no conditions, no code.

## 3. Rules that make this safe

1. **Safety signals can never be switched off.** Consent, Rx safety, NDPS witness, two-ID/BCMA,
   MLC rules, permissions and separation of duty stay enforced in code. A flow can **add** signals
   and **reference** these, never remove or weaken them. The editor shows them locked.
2. **The flow drives, the domain moves.** A station calls the existing, tested domain action
   (for example `discharge::finalize`), which keeps its own checks. The engine never writes a
   status column itself, so the two cannot drift apart.
3. **Changes are reviewed, like code.** This answers the existing policy that "clinical behaviour
   should go through code review" (`default_pipelines.rs`). Every flow change goes through the
   knowledge change-set engine: preview impact ("12 patients currently in discharge would follow
   the new route"), second-person approval, apply, rollback, proof.
4. **Patients stay on the track they started.** A running instance is pinned to the flow version
   it began on. A change applies to new patients only, unless an approver explicitly migrates.
5. **One engine.** `workflow_*` tables + the approvals engine. The dormant `integration_pipelines`
   and the unwired automation crates are retired, or kept only for system/integration steps
   (decision §9).

## 4. Design

### 4.1 Station types

| Type | What it does | Built on |
|---|---|---|
| Action | Calls a registered domain action (finalize discharge, issue token) | a code registry of actions, each with its permission |
| Human task | Someone does something on a screen, optionally with a form | role + form template + SLA |
| Approval | One person, several, or a committee | the approvals engine (quorum, SoD, timeout) |
| Switch | Chooses the next station by facts | approvals `conditions::matches` (AND of eq/ne/op), extended with OR |
| Signal | Holds until a condition clears | `emit_before_event` gate hook; safety gates referenced by name |
| Wait / timer | Until a time or event | job queue |
| Notify | Message a role or person | existing notification pipeline |
| Sub-flow | Runs another flow | `workflow_instances` parent link |
| End | Complete, cancel, terminate | |

Only **registered** actions, facts and gates can be used. Each is a Rust function with a name,
inputs, and the permission it needs. A flow is a composition of tested building blocks, never
free code.

### 4.2 Data

Reuse `workflow_templates` (add `scope`, `status draft|published|retired`, `published_from`,
typed `steps` JSONB validated against the registry) and `workflow_instances` (add `version`
pinning, `subject_type`, `subject_id`). `workflow_step_logs` records each station: who, when,
outcome, SLA met. All tenant-scoped with FORCE RLS.

### 4.3 Scopes and one-click apply

A small resolver picks the active flow for a patient: department → campus → hospital → library
default, most specific wins. "Apply" publishes a flow to a scope through a change set.

### 4.4 SOP library

The 29 SOPs in `docs/sops/` and the template list in RFC-HMS-2026-002 become library flows,
each linked back to its SOP section. A hospital starts from the library, not a blank page.

## 5. Screens (UI plan, to agree before build)

**Admin → Flows** (for hospital staff)
- **Library:** flows by module, each with its SOP, what it covers, and "Use this flow".
- **Switchboard** (the main screen): one flow at a time, its switches listed as plain sentences
  with On/Off or a short choice, grouped by stage ("Before billing", "At discharge"). Locked
  safety signals are listed too, shown as "Always on: required by law/safety", so staff can see
  them but not change them.
- **The track, read-only:** a simple left-to-right picture of the stations, which redraws as
  switches change, so staff see the route their choice creates.
- **Preview:** what changes, who is affected now. Then "Propose" (opens a change set; a second
  person approves).

### 5.1 Visual design (React Flow, `@xyflow/react`, already installed)

The track is drawn like a **metro map**, not a flowchart, so non-technical staff read it at a
glance. Layout is computed, never dragged: staff can't make it messy.

- **Lines and stations:** the main route is one horizontal line; each branch is a parallel lane
  that leaves at a switch and rejoins. Stations are round markers with a short name under them
  ("Summary signed"). Computed layered layout (column = order, lane = branch); no layout library.
- **Switches** are junction markers labelled with the plain sentence, e.g. "Insurance patient?".
  The active route is drawn solid; the route not taken is a faint dotted line, so staff see both.
- **Signals** are small signal-post icons beside a station: open/held, plus text. Locked safety
  signals carry a padlock and "Required". Meaning is always icon + text, never colour alone.
- **Flip and see:** turning a switch on the switchboard animates the route change on the map
  (and announces it in text, "Route now skips TPA clearance"). Reduced motion: it simply redraws.
- **Ghost track for changes:** a proposed change shows the old route as a ghost line under the
  new one, so the approver sees exactly what moves.
- **Text alternative:** every map has a "List view" (ordered steps, switches, signals) for
  keyboard and screen-reader users, per the data-viz rules.

### 5.2 Innovative functions

1. **Control room with live trains:** each station shows how many patients are there now and
   the longest wait (numbers, with a calm/busy/overdue label). Click a station to see the
   patients. The station losing the most time is spotlighted with a sentence: "Pharmacy returns
   is adding 1 h 40 min to discharges today."
2. **What-if replay:** before approving a switch change, replay the last 30 days of real
   journeys (from step logs) through the new route: "Median discharge time would go from
   5 h 12 min to 4 h 05 min; 0 patients would skip a required signal." Data first, then decide.
3. **Patient ticket:** each patient's journey shown like a train ticket: where they are, what
   they are waiting for, who holds the signal, expected time. One click from the patient chart.
4. **SOP beside every switch:** each switch shows the SOP sentence it implements, so a quality
   officer can audit "does the software do what our SOP says?" line by line.
5. **Station timetable:** expected time per station, set by the hospital; the map marks
   stations that miss it most often across the week.
6. **Later, AI (phase 6):** "Why is discharge slow today?" answered from the control room's own
   numbers, and switch proposals read from the hospital's SOP; always labelled, always reviewed.

**Track builder** (MedBrains team and Developer partners only): defines stations, switches and
their allowed options, in code review. Not shown to hospital staff.
- **Control room:** live board per flow: how many patients at each station, who is over time,
  where the queue builds. Click through to the patient.

States: loading; empty; draft vs published; stale; error with retry (never shown as an empty
board); no permission (nothing fetched). Keyboard-operable; meaning never by colour alone.

## 6. Permissions (Rust first)

- `flows.view`: see flows, the switchboard and the control room
- `flows.switch`: change switch settings and preview (proposals go through change sets)
- `flows.publish`: approve and apply switch changes (via change sets)
- building or changing the tracks themselves is a code change, not a permission
- each registered action keeps its own permission; the engine checks it for the acting user

## 7. Phases (each ends on the screen)

1. **Engine + discharge.** The hard-coded discharge checklist becomes the first flow: switches for
   insurance vs cash, signals for summary signed, pharmacy returns, billing cleared, TPA approval.
   Control room shows discharge time per station (the NABH discharge-time KPI comes for free).
2. **Referrals and leave**: referral lifecycle onto the engine; leave approvals onto the approvals
   engine.
3. **OPD journey**: registration → token → consult → orders → billing → pharmacy.
4. **Admission, lab and pharmacy order flows.**
5. **SOP library and scopes**: library flows from the 29 SOPs, department/campus overrides.
6. **AI-assisted setup (later):** a hospital uploads its own SOP document; AI reads it and
   **proposes** switch settings for the matching library flow ("your SOP says insurance discharges
   need TPA clearance: turn this switch On"), each with the sentence from the SOP it came from.
   AI never builds or changes tracks and never applies anything: its proposal is shown with an AI
   label, a person reviews it, and it goes through a change set like any other switch change.
   The same reading can flag where a hospital's SOP and its live switches disagree.

## 8. Acceptance scenarios (phase 1)

- Given the discharge flow with an insurance switch, when an insurance patient is discharged,
  then the TPA approval signal must clear before billing; a cash patient skips it.
- Given a flow that tries to remove the "summary signed" safety signal, when previewed, then
  the editor refuses: required signals cannot be removed.
- Given 12 patients mid-discharge on version 3, when version 4 is applied, then those 12 finish
  on version 3 and new discharges use version 4.
- Given a discharge station that calls `discharge::finalize`, when its own checks fail (e.g.
  unsettled bill), then the station fails with that reason and the flow does not advance.
- Given the control room, when a patient waits at "pharmacy returns" longer than its SLA, then
  they show as overdue with the time.
- Given the discharge switchboard, when an administrator turns "Insurance patients need TPA
  clearance" Off, then the preview shows the new route and how many current patients it affects,
  and nothing changes until a second person approves.
- Given a user without `flows.view`, when they open Flows, then no flow data is fetched.

## 9. Decisions needed

1. Retire the unwired automation crates and `r8r`, or keep them only for system/integration
   steps (HTTP calls, data transforms)?
2. ~~New flows or library only?~~ **Superseded by §11:** hospitals get a full track builder,
   bounded by registered building blocks and flow-type invariants.
3. ~~Who approves?~~ **Decided:** the quality officer approves switch changes; clinical flows
   (discharge, referrals, admission, orders) also need the medical superintendent.

## 10. Not in scope

Patient-facing flow screens, free-form code in flows, cross-hospital flows, AI-built tracks (AI may only propose switch settings, phase 6).


## 11. Amendment (2026-11-01): a full track builder for hospitals

**Owner decision:** hospital admins can build and change tracks themselves, not only flip switches.
This supersedes the "tracks are built only in code review" part of §2 and §9.2. Switchboards stay
for everyday staff; the builder is for a hospital's **flow designers** (quality team, medical
administration).

### 11.1 What a designer can do
- Draw a new track or change one: add stations, branches and rejoins, reorder, remove.
- Build switch conditions from a form, never code: pick a fact (payer type, ward, age, department,
  admission type, order value…), an operator, a value. AND/OR groups allowed.
- Turn any branch into a switch for the switchboard, with its own plain sentence and options.
- Set each station's expected time, who holds it (role), and who approves changes.

### 11.2 What keeps it safe
Freedom is in *how stations are arranged*; safety lives in what stations *are* and in rules the
track must satisfy. A designer can only place **building blocks MedBrains has registered and
tested** (actions, tasks, signals, facts). Before a track can be proposed it must pass every check:

1. **Flow-type invariants (in code).** Each flow type declares rules every path must satisfy. For
   discharge: every path to "Discharge" passes "Summary signed" and the billing settlement gate;
   MLC patients pass the MLC check. A track that breaks one cannot be saved as ready.
2. **Locked signals stay.** Required safety signals can be moved later in the path only if the
   invariant still holds; never removed or bypassed.
3. **Every path ends.** No dead ends, no unreachable stations, no loops without a bound.
4. **Conditions type-check.** Facts exist, operators fit their type, no branch is always-false or
   overlapping without a default route.
5. **Every station is staffable.** Its holder role exists in this hospital and has the permission
   its action needs.
6. **Dry run must pass.** Sample patients (one per branch) run through the draft; the result shows
   each patient's route. Then **what-if replay** on the last 30 days of real journeys: how many would
   route differently, time saved or added, and confirmation that none would skip a required signal.
7. **Publishing is a change set:** quality officer + medical superintendent approve; versions are
   pinned so patients mid-journey finish on the old track; one-click rollback.

### 11.3 Builder screen
- **Canvas:** the same metro map, now editable: "+" between stations to insert a block from a
  searchable catalogue (each block shows what it does, who holds it, the permission it needs);
  drag to reorder along the line; "Add branch" opens the condition form. Layout stays computed, so
  a track never becomes a tangle.
- **Checks panel** (always visible): each rule from §11.2 with a pass/fail in words ("Every path
  to Discharge passes Summary signed: ✓"), clicking a failure highlights the station.
- **Test drive:** pick sample patients, watch them move along the draft; then run what-if replay.
- **Propose** is enabled only when every check passes and the dry run has been run.
- Draft autosaves; drafts never affect patients.

### 11.3a Data and database changes
- **No database structure changes at run time.** Building or changing a track never runs DDL.
  Data a designer adds to a station (extra fields, checklist items) lives in versioned
  **form templates** (`form_templates` / `form_template_versions`) and the journey's
  `workflow_instances.state`, both already tenant-scoped with RLS.
- **When a new building block needs a real table or column**, AI drafts the migration from the
  repo's own rules (`tenant_id` + FORCE RLS, soft delete, the migration pitfalls in ENGINEERING.md,
  regulatory fields, next free number, never editing an applied migration) together with the
  block's Rust code and tests. It arrives as a normal pull request: compile-time SQL checks, the
  repo's migration and RLS checks, and human review must pass. Nothing is applied from a screen.

### 11.4 Permission
- `flows.build`: draw and test draft tracks (new, defined in Rust first). Proposing and approving
  stay `flows.switch` / `flows.publish` via change sets.

### 11.5 Phase
**Phase 1b: track builder for discharge**: canvas editing, condition form, the six checks,
dry run, what-if replay, propose. Then phases 2–5 use the builder from day one.
