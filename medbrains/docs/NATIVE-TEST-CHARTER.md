# Native test charter — what a journey must prove before a module is done

A journey is not "the screen opened". Every module's suite, on **each platform
separately**, covers the rows below with seeded data and **server read-back**:
the assertion is what the hospital's record now says, not what the screen
looked like. Runs are reported per platform with the failure text, never as
one combined count.

| Axis | Every module proves | How |
|---|---|---|
| **Seed** | The screen shows the rows seeded for this run, by name/UHID, not "something" | API seed as admin in `setUp`, unique suffix per run |
| **States** | loading → **unavailable** (named outage + retry, never an empty list), **empty** (in words), populated | unavailable: launch against an unreachable base URL; empty: a fresh identity with nothing |
| **Gate** | a role lacking the permission sees neither the control nor the fetch | second identity without the code; assert absence |
| **Write** | a mutation changes the server and the screen refetches | read back through the API after the tap |
| **Refusal** | the server's refusal reaches the screen in words, values kept | invalid input, conflict, or a rule (BCMA mismatch, witness missing) |
| **Session** | a 401 signs out; a kept session hydrates; sign-out clears; **a deactivated or deleted account is signed out on its next request, not at token expiry** | retire the identity server-side while the app holds a token, then tap anything |
| **Safety copy** | every outage message says "do not read this as …" where a blank would mislead | string assertion on the unavailable state |
| **Evidence** | a screenshot per state, named, attached to the run | XCTAttachment / `screencap` per step |
| **Clean device** | every run starts on a device that holds only the app under test — never the developer's shared simulator, which carries every app on the machine | `scripts/native_test_env.sh ios\|android` creates the dedicated `MedBrainsPhone` once and erases it before each run |

## Module rows (staff app)

**Sign-in**: wrong password refused in words; correct lands on the role's first module; kept session hydrates on relaunch; sign-out returns to the form; a revoked token (server-side) signs out on the next request; unreachable server says so.

**Nurse**: call board shows the seeded call by bed with escalation tone; *Seen* sets `acknowledged_at` on the server and the row stays; *Done* completes it and the row leaves; a nurse without `bedside.sessions.manage` sees no buttons; admissions shows the seeded patient; MAR shows both seeded doses with high-alert marked; taking a dose to the bedside offers the scanner and no *Give now*; a typed wristband + wrong drug is **refused** with both rights named and no *Give now*; a matching pair verifies and *Give now* records `status=given` on the server; a high-alert dose keeps *Give now* disabled until a witness is chosen; *Hold* with a typed reason writes `hold_reason`; vitals with pulse 999 is refused on the field, with 76 is written; I/O returns the 8h balance; transfusion chart lists the seeded unit with the fifteen-minute phase overdue after start; code blue lists the seeded arrest and *Responding* creates a responder row; the flash covers every screen while an arrest is open and a triple-tap silences it without responding.

**Doctor**: queue shows the seeded token; *Call next* moves it to `called` on the server and confirms; *Recall* restamps `called_at`; *No-show* moves to `no_show`; *Patient is in* → *Mark complete* walks serving → completed; a doctor without `opd.token.manage` sees no transitions; consultation refuses an empty note on the field; a saved note reads back with the four fields; reopening shows *Recorded*; rounds list the seeded admission; My clinic orders the seeded appointments by time with walk-in last.

**Patient app**: unregistered number gets the same reply as registered, with no wording that says which; wrong code refused in words with the number kept; an unreachable hospital names itself and never blames the number; the seeded code signs in (one sign-in per run — the seeded code is spent by it, so the signed-in scenarios share one test); a bill raised at the desk this run shows by invoice number with the server's total and "due", and the headline equals the sum of the server's balances; Health tab hidden while `module_config.companion` is disabled, present after the hospital enables it and a relaunch (the session survives the relaunch), gone again when disabled; sign-out returns to the phone step and nothing survives the next launch. Still to prove: seeded appointment, released result with a flag word, prescription; consent/family tiles present.

## Reporting

`scripts/native_test_report.py <platform> <result>` prints one table per
platform: test, duration, outcome, failure text, screenshots attached. The
loop reads both tables before saying anything passed.

## Found by these suites (2026-09-15)

Kept here so the next author knows what a "strong" journey pays for.

- **A deactivated or deleted account kept its session until the token expired.** The per-request check compared only `perm_version`; deletion soft-deletes and leaves it untouched. Fixed in `verify_perm_version`; regression `apps/web/e2e/linkages/deactivated-user-revoked.spec.ts`. Found by the iOS sign-in journey.
- **The emergency flash took touches while fading out.** The tap after a silence landed on "I'm responding" and recorded an arrival. The overlay now appears and goes without a transition, and carries an explicit "Silence on this phone" control (a gesture-only path is not accessible). Found by the iOS code-blue journey, proved from the server's `responded_at`.
- **A stale 401 signed out a newer session.** A poll started under a retired token answered after a fresh sign-in and kicked the new user out. Both clients now sign out only when the token the request carried is still the current one. Found by the Android hold-a-dose journey (evidence: the login screen where the workspace should be).
- **Typing the code was unreachable on a phone with a camera until the permission prompt was answered.** The typed path is now always offered. Found by the Android MAR journey.
- **"Send me a code" blamed the number for an outage.** Now "Could not reach the hospital server." Found by the patient outage journey.
- **A module with no permission was visible to every role**, so "nothing assigned to you here" could never be reached. Device sync is gated until phase 6 defines its permission.

- **A receptionist's patient list is scoped to the patients linked to them**, so the desk cannot find a returning patient a colleague registered (phone and web read the same endpoint), while the unfiltered duplicate check offers that record. Not widened here: the Find empty state names the scope, the journeys walk Register → Use this record → token, and `docs/plans/native-front-office.md` records the authz-grammar fix for the operator. Found by the Android find-by-phone journey (evidence: the empty state with the right phone typed).

- **The appointment list offered actions the server refuses.** `check-in` and `no-show` carry a per-record patient hop the list did not apply, so a colleague's booking showed *Check in* and answered "not found". The list now carries `can_manage` per row and the screens offer only what the server accepts. Found by the Android appointment journey (evidence: the "Not recorded / not found" banner over a row with both buttons).

Harness lessons: one identity per provisioning call (a run id alone collides across roles); never run the iOS and Android staff suites at once (each ends every open code blue in `setUp`); JUnit does not run tests alphabetically, so a test must not depend on the seeded sign-in code surviving another test; the shared `native_*` accounts lock after repeated wrong passwords, so refusals use a per-run identity.

## A green run that ran nothing

`./gradlew :app-staff:connectedDebugAndroidTest` exits **0** when its APK
installer fails on a freshly wiped emulator. The log carries one line —
`Failed to uninstall package …test` — then `BUILD SUCCESSFUL`, an empty
`test-result.pb`, and no app on the device. It was read as a pass twice on
2026-09-18 before anyone checked the count.

Two habits follow:

1. **Never take the build's exit code as the result.** `scripts/native_test_report.py`
   is the result, and it now exits 1 on zero tests.
2. **When the install misbehaves, go under Gradle.** Install both APKs with
   `adb install -r -t` and run
   `adb shell am instrument -w -e class <Class> com.medbrains.staff.test/androidx.test.runner.AndroidJUnitRunner`.
   It prints the real error, and it is how the 9 reception journeys were
   actually proven that day.
