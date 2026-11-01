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
2. ~~New flows or library only?~~ **Decided:** hospital staff only flip switches on library
   flows; tracks are built by MedBrains and Developer partners in code review.
3. Who approves a flow change: quality officer, medical superintendent, or both?

## 10. Not in scope

Patient-facing flow screens, free-form code in flows, cross-hospital flows, AI-generated flows.
