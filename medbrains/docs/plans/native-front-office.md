# Front office on the native staff app — UI plan and scenarios

The first module built as a **full workflow** rather than a port of the outgoing
React Native screens (user direction 2026-09-15). Same code on iOS (SwiftUI) and
Android (Compose), in lockstep, with the rules in `medbrains-clinical-core`
(`registration.rs`) reached through `medbrains-edge-rn`.

## Who and when

A receptionist on a Monday morning registers forty walk-ins standing at the
desk, sends each to a clinic with a token, and calls the floor. The phone is
for the desk that is not at a desk: the camp gate, the corridor at 8 a.m., the
ER door. Everything is one-handed, short, and read back to the patient.

## Slices (each ends on the screen, both platforms, with its journeys)

| Slice | Screens | Server | Status |
|---|---|---|---|
| **A — registration to token** | Reception home · Register · Possible duplicate · Registered (UHID read-back) · Find patient · Patient · Start visit · Token issued · Queue board | `POST /patients/match`, `POST /patients`, `GET /patients?search`, `POST /opd/encounters`, `GET /tokens/worklist?module=opd`, `POST /tokens/call-next`, `GET /setup/departments`, `GET /setup/doctors` | this PR |
| B — appointments | Today's list · Check in (issues the token) · No-show · Book from the patient screen (doctor → date → slot) | `GET/POST /opd/appointments`, `PUT …/check-in`, `…/no-show`, `GET /opd/doctors/{id}/slots` | this PR |
| C — visitors and enquiries | Visitor desk (register, pass, in/out, revoke; active vs **overdue**) · Enquiry desk (log, resolve) | `/front-office/visitors`, `/passes`, `/visitor-logs`, `/enquiries` | this PR |

## Found while building slice A — a policy question for the operator

**A receptionist can only list patients linked to them.** `GET /api/patients`
narrows a non-bypass caller to the patients ReBAC says they may view, and a
new registration links its registrar; nothing links a desk to a colleague's
walk-ins. So the front desk cannot find a returning patient another desk
registered — on this app or on the web page, which reads the same endpoint.
`POST /api/patients/match` is deliberately unfiltered, so the coherent path
today is Register → "Possible duplicate" → **Use this record** → Start visit,
and the journeys prove exactly that. The Find screen's empty state names the
scope. The fix, if wanted, is a relation in the authz grammar (a tenant-level
desk→patient viewer relation for the reception roles), not a wider gate here.
Also: `front_office_staff` holds no `patients.*` or `opd.*` code, so on this
app it sees the module with no action and is told so (`reception-no-actions`).


## Slice B — appointments

**Found and fixed while building it:** the appointment list applied no
per-record check while `check-in` and `no-show` do (they hop to the patient,
`links::APPOINTMENT`, and answer 404 without access). A desk was therefore
shown **Check in** on a colleague's booking and got "not found" — a screen
offering what the server refuses, which repo law forbids. `list_appointments`
now carries `can_manage` per row, from one bulk patient-access lookup (an
unanswerable backend refuses the list rather than showing a day with every
action missing, as the patient list already does), and both screens offer the
buttons only when it is true, saying why when it is not.


- **Appointments today** (home action, `opd.appointment.list`): today's rows
  in time order — time, patient, doctor, status tag. A row in `scheduled` or
  `confirmed` offers **Check in** and **No-show** (both `opd.appointment.update`);
  the core rule `appointment_actions(status, is_today)` decides which, so a
  row for another day or an already checked-in one offers nothing. Check-in
  is the server's own path (it creates the encounter and the OPD token); the
  answer's `token_number` is shown on the row and announced. Empty in words;
  unavailable named.
- **Book appointment** (patient screen action, `opd.appointment.create`):
  doctor (picker, prefilled with the desk's consultant), department (from the
  desk), date (default tomorrow), then the day's slots from the server; slots
  the core says are not bookable (already passed, or full) are not offered
  (`slot_is_bookable`). Tap a slot → **Book HH:MM** → confirmation card with
  date, time, doctor, and the patient's identifiers; **Done** returns to the
  patient.

Scenarios (both platforms, read back):

12. **Check-in issues the token.** Given an appointment booked today for a
    doctor provisioned this run, When the desk taps Check in, Then the server
    holds `checked_in` with an encounter, the worklist has the patient waiting,
    and the row shows the token the server issued.
13. **No-show is recorded.** Given a second booking today, When the desk taps
    No-show, Then the server holds `no_show` and the row offers nothing more.
14. **Book from the patient screen.** Given a patient the desk registered,
    When the desk books the first free slot tomorrow with a provisioned
    doctor, Then the server holds that doctor, date and slot, and the card
    shows them.
15. **A past slot is never offered.** Proved on the core rule.
16. **Gate.** `front_office_staff` sees no Appointments action.


## Slice C — visitors and enquiries

**Who the building believes is inside it.** A pass has three stored states —
active, expired, revoked — and nothing sweeps the table, so a pass whose hours
ran out an hour ago still reads `active` while the person is very likely still
upstairs. The desk therefore gets a fourth state of its own, **overdue**, and
those people are still counted as inside. The rule lives in the core
(`visitors.rs`: `pass_state`, `pass_is_inside`, `pass_actions`), not on two
screens that could drift.

- **Visitor desk** (home action, `front_office.passes.list`): two counts at the
  top — inside now, and of those, overdue. Then the passes, overdue first,
  each showing visitor, pass number, ward/bed and until when. A pass offers
  only what the server will accept: **Check in** or **Check out** (whichever
  the person's state calls for) and **Revoke**, and a revoked or expired pass
  offers nothing at all. Revoke asks for a reason and records it.
  **Register a visitor** (`front_office.visitors.create`) takes name, phone,
  relationship, who they are visiting and why, then issues the pass in the
  same act — registering without issuing was the drudgery the old desk had.
- **Enquiry desk** (home action, `front_office.enquiry.list`): open enquiries
  first, then resolved. **Log an enquiry** (`…enquiry.create`) records caller,
  phone, type and what they were told; **Resolve** (`…enquiry.manage`) closes
  it with what was said. `front_office_staff` holds `enquiry.list` only, so it
  reads the desk and is told it cannot log or resolve rather than being shown
  buttons the server refuses.

Scenarios (both platforms, read back):

17. **Register a visitor and issue their pass in one act.** Given a patient,
    When the desk registers a visitor and issues a pass, Then the server holds
    the registration and a pass against it, and the pass appears on the board.
18. **Check in, then check out.** The count of people inside rises by one on
    check-in and falls on check-out, and the log on the server carries both
    times.
19. **An overdue pass is distinguished from an expired one.** Given a pass
    whose hours have run out but which was never revoked, Then the board calls
    it overdue, still counts that person as inside, and offers the way to end
    it. (The state rule is proved in the core; the device proves the wording
    and the count.)
20. **A revoked pass offers nothing.** Given a revoked pass, Then no check-in
    or check-out is offered and the reason is on the record.
21. **Log an enquiry and resolve it.** Given a caller, When the desk logs the
    enquiry and later resolves it, Then the server holds it resolved and it
    leaves the open list.
22. **Gate.** `front_office_staff` sees the enquiry desk without the log or
    resolve action, and is told why.

## Placement

Module `reception` in the staff registry, gated on `front_office.queue.list`
(both `receptionist` and `front_office_staff` hold it). Each home action is
gated on its own permission and hidden without it: Register `patients.create`,
Find `patients.list`, Queue board `opd.queue.list`. `front_office_staff` holds
no `patients.*`/`opd.*` code, so on this app it sees the module with no action
and is told so — a role gap in `roles.rs`, not a UI decision, recorded here
rather than papered over with a wider gate.

## Layout (phone-first)

- **Home**: page header · one stat tile "Waiting now" (worklist waiting count)
  · action rows in the order the desk works: Register, Find, Queue board.
- **Register** (one screen, no sections to scroll through — journey MJ-REC-006):
  Person: first name, last name, gender (segmented), phone, date of birth *or*
  age. Safety: medico-legal switch → MLC number; VIP switch. Optional: ABHA
  number. **Desk** (kept for the next walk-in): department, consultant,
  source (walk-in / referral → referred by). One primary action:
  **Check and register**.
- **Possible duplicate** (sheet over Register): the candidates from
  `/patients/match` — UHID, name, DOB, phone — each with **Use this record**;
  below, **Register as new anyway**. When the check could not run, the sheet
  is replaced by an inline warning "Duplicate check unavailable — nobody was
  compared" and the action reads **Register unverified**.
- **Registered**: the UHID in display type, name, DOB, phone — the two
  identifiers the desk reads back — then **Start visit** and **Next walk-in**
  (clears the person, keeps the desk).
- **Find**: search field (UHID, name, phone) · rows: name, `UHID · DOB · phone`,
  MLC/VIP tags · empty state in words · unavailable state named.
- **Patient**: identity card (the two identifiers), flags, last visit,
  outstanding balance · **Start OPD visit**.
- **Start visit**: department, consultant (prefilled from the desk), chief
  complaint (optional) · **Start visit and issue token**.
- **Token issued**: the token number in display type, "Tell them token N",
  patient name, department; announced to VoiceOver/TalkBack · **Queue board**,
  **Done**.
- **Queue board**: rows (token, name, status tag) · one **Call next (N waiting)**
  — the server picks under its lock; never a call per row.

## Components

iOS: `CarbonPageHeader`, `CarbonField`, `CarbonRow`, `CarbonTag`, `CarbonTile`,
`CarbonNotification`, `RemoteContentView`, `Eyebrow`, primary/tertiary/ghost
button styles. New primitive: **`CarbonPicker`** (menu picker with the Carbon
label/underline), used for department and consultant. Android: the same names
plus `CarbonActionRow`, `CarbonStatTile`; new **`CarbonPicker`** on an
`ExposedDropdownMenuBox`.

## States

Every list: loading · **unavailable** (named, with retry; the queue board says
"Do not read this as an empty floor") · empty (in words) · populated. Forms:
field refusal from the core rule before the tap; server refusal in words with
values kept; busy disables the one primary action.

## Data

Plain async calls through `ApiClient` (no cache layer on the phone); the
worklist polls every 5 s while the board is open. Desk context lives in the
module session for the run of the app, never in the secret store.

## Permissions

Registry gate `front_office.queue.list`. Actions: `patients.create`,
`patients.list`, `patients.view` (open a record), `opd.visit.create` (start a
visit), `opd.queue.list` (board), `opd.token.manage` (call next). Reads gate the
query: a screen without the permission is never reached, so it never fetches.

## Accessibility and safety

Every control labelled; targets ≥ 44 pt / 48 dp; the token and the UHID are
announced, not only shown; MLC and VIP are tags with words, never colour alone;
the duplicate sheet never hides that a match exists behind a scroll.

## Scenarios (the journeys, both platforms)

Given/When/Then, each read back from the server:

1. **Register a clean walk-in.** Given no patient with this phone, When the desk
   fills the person and taps Check and register, Then the match answers nobody,
   the record is created, and the UHID on screen equals the server's; the
   attributes record `duplicate_check: "none"`.
2. **A possible duplicate is confirmed, not silently created.** Given a patient
   seeded this run with the same name and phone, When the desk taps Check and
   register, Then the sheet lists that UHID; **Use this record** opens it and
   creates nothing; **Register as new anyway** creates a second record with
   `duplicate_check: "overridden"` and the matched UHID recorded.
3. **The check being down is not a clean check.** Given the match endpoint is
   unreachable (journey runs the form against an unreachable host for that
   call), Then the warning names it and the action reads Register unverified.
   (Proved on the core rule; the device journey proves the copy.)
4. **The second identifier is required.** Given no date of birth and no age,
   Then the field refuses before any request; with an age, the record carries
   `is_dob_estimated: true` and 1 January of the birth year.
5. **Medico-legal needs its number.** Given the switch on and no number, Then
   the field refuses; with a number, the record carries both.
6. **The desk survives the next walk-in.** Given a department chosen, When the
   desk taps Next walk-in, Then the department is still chosen and the name and
   phone are empty.
7. **Find by phone.** Given the seeded patient, When the desk searches the
   phone, Then the row shows the UHID; a nonsense search says so in words.
8. **Walk-in to token.** Given a registered patient, When the desk starts a
   visit in GEN-MEDICINE, Then the token on screen equals the server's queue
   `token_number` and the worklist holds the patient as waiting.
9. **Call next is the server's choice.** Given two waiting tokens, When the desk
   taps Call next, Then exactly one token is `called` on the server and the
   board shows it.
10. **Gates.** A `front_office_staff` identity sees the queue board and neither
    Register nor Find; a receptionist lands on Reception.
11. **Outage.** The board against an unreachable host names it and says not to
    read it as an empty floor.

---

## Slice D — the desk's own lookup (`patients.find`)

**The finding this closes.** `GET /api/patients` is ReBAC-scoped: it returns
patients the caller has a relationship with. That is right for a browse and
wrong for a desk. A returning patient walks up, gives a UHID or a phone number,
and the receptionist who registered them last year is not on shift — so the
search came back empty and the desk registered the same human a second time.
Scenario 7 above was *written around the bug*: it seeded the patient as the desk
itself so that Find would work at all.

**Why not widen `patients.list`.** Widening grants a tenant-wide browse to
everyone already holding the code, which is the mistake the repo's authz law
names explicitly. A missing permission is created, not borrowed.

**What shipped.**

- `patients.find` — defined in Rust with its reasoning, generated into the TS
  catalogue, granted to `receptionist`.
- `GET /api/patients/find?q=` — tenant-wide, one bounded query (exact UHID,
  exact phone, prefix of either, then trigram on the name; `LIMIT 20`), and
  **identity only**: name, UHID, phone, date of birth, sex. Never a chart,
  never a diagnosis. It reuses `MatchResult`, the shape `/patients/match`
  already returns for duplicate detection, and inherits the same
  field-level masking. Audited by the `/api/patients` PHI prefix.
- Under three characters returns nothing — a desk lookup is a lookup for
  someone in particular, not a way to page through the register.
- Both apps' Find screens call it, and the Find action is gated on
  `patients.find` rather than `patients.list`, so the control matches the
  permission its call requires.
- The empty-state copy no longer says "within your access" — it was describing
  the limit that has just been removed.

**Scenarios (12–13, both platforms)**

12. **The desk finds a patient it did not register.** Given a patient seeded by
    another identity, When the desk searches their UHID, Then the row appears
    and Start visit is offered from it.
13. **Two characters are not a search.** Given a two-character query, Then the
    desk answers empty rather than opening the register.

**Still open, deliberately not in this slice.** Starting a visit writes tuples
on the *encounter* (department, attending) and none for the desk that created
it, so a receptionist who finds and starts a visit still cannot open that
patient's chart. That is correct for now — the desk does not need the chart to
book a visit, and the card it shows comes from the find result already in
memory, not from a second fetch. But it means "find → open record" is not a
path, only "find → start visit". Granting the desk a standing relation to a
patient it touched is a decision about standing access and belongs in the
grammar work, not here.

**Web still has the bug.** `apps/web/src/pages/patients.tsx` searches through
`listPatients`, so a receptionist on the web app cannot find a colleague's
registration either. The endpoint and the client method (`findPatients`) exist
for it; what is missing is the screen decision — hospital-wide results are a
slimmer row than the directory's columns (identity only, no VIP/MLC flags, no
balance), so they need their own presentation rather than being poured into the
same table. That is a UI plan, per **Plan UI before build**, and it is the next
slice rather than an improvisation at the end of this one.

### Web — the picker, not the directory

The web fix went somewhere better than the patients page. Every patient field
on the web app — OPD visit, IPD admission, pharmacy, appointments, merge — is
the same `PatientSearchSelect`, and all of them were searching the
relationship-scoped list. So a receptionist could not *select* a returning
patient either, in any form, not just fail to find one in the directory.

The picker now prefers `findPatients` when the caller holds `patients.find`
and stays on the scoped list otherwise, so a caller without the code is never
silently sent at an endpoint that will 403 and read on screen as "no such
patient". It renders identity only either way, which is exactly what the wide
lookup returns, so nothing about the row changed. Three characters is the floor
when wide, two when scoped, matching the server.

`PatientSearchSelect.test.tsx` encodes the decision — which endpoint, under
which permission, and the character floor — and was mutation-checked: forcing
the scoped branch fails the first case.

The patients directory page itself still lists scoped rows. That is defensible
(it is a directory of your own patients, and the picker is where selection
happens), but if a desk is meant to browse the hospital there, it needs its own
presentation for slimmer rows — not the same table with VIP, MLC and balance
columns silently empty.

### Slice E — the desk can open the visit it started

`schema.zed` has always said `encounter.owner` is "FK: `encounters.created_by`".
Neither side was ever written by a hospital path. Locally: 914 encounters, 369
with a creator, and every one of those 369 came from the camp app — the only
code that filled the column. OPD walk-ins, appointment check-ins, ER arrivals
and both admission paths left it NULL.

Two costs, one of them not about authorization at all:

1. **No record of who started a visit.** For a hospital system that is an audit
   answer missing, independent of any access question.
2. **The desk could not open the record it had just created.**
   `require_patient_access` reaches a patient through their recent encounters,
   and the receptionist held no relation to any of them.

All five paths now record `created_by` and grant `encounter#owner` through
`medbrains_authz_gate::grant_encounter_owner`. The grant is on the encounter,
never the patient: it names the visit that user actually handled, and it falls
out of reach as newer encounters push it past `MAX_FANOUT`, instead of becoming
standing access to a person. Both backends agree — SpiceDB resolves
`encounter.view = owner + …`, and the Postgres backend expands Viewer to include
Owner.

**Scenario 14 (both platforms).** As the desk's own identity,
`GET /api/patients/{id}` is *not* 200 before the visit and *is* 200 after
starting one through the screen. Asserting only the second half would pass just
as well in a system where everyone can read everyone.

**No backfill.** The 545 existing encounters with a NULL creator cannot be
repaired: who started those visits was never recorded anywhere. They stay
reachable the way they always were — department and attending — and the column
starts telling the truth from here.
