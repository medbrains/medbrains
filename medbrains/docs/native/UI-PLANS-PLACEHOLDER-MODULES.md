# UI plans: the ten placeholder modules in the native staff app

Status: **PLAN, not agreed** (2026-10-12). One plan per module, per
`docs/ui-plan-before-build.md`. Each one has to be agreed before any of its code is written.

Scope: `apps/ios/MedBrainsStaff` (SwiftUI) and `apps/android/app-staff` (Compose). These
are the ten modules that `StaffModules.swift` / `StaffModules.kt` still register through
`module(…, phase:)` and so render `PlaceholderModuleHome`: Pharmacy, Lab, Blood Bank,
Billing, BME, Facilities, Housekeeping, Security, HR and Device sync.

Every endpoint, permission and role grant below was checked against the code on 2026-10-12:
route registrations in `crates/*/src/lib.rs`, `crates/medbrains-core/src/permissions.rs`,
`crates/medbrains-core/src/access/roles.rs` and `packages/api/src/client.ts`. Missing
endpoints are listed per module and collected at the end.

---

## 0. Conventions every module follows (copied from shipped modules, not invented)

The patterns to copy are **Deliveries** (`Features/Deliveries/*`, `staff/deliveries/*`),
which is the newest module and shows a list, a detail, a scan-gated action and polling, and
**Reception / Visitor desk** (`Features/Reception/VisitorDeskView.swift`), which shows
segmented sub-desks and a register-then-act flow.

| Concern | Rule (as already shipped) |
|---|---|
| Registry | Replace the `module(...)` placeholder with a real `AppModule(... ) { AnyView(XHomeView()) }`, in the same registry position. Order decides where a role lands. |
| Navigation | iOS: one `NavigationStack` per tab, `navigationDestination(for:)` on value types. Android: one `NavHost` per module, holding a `XSession` with `mutableStateMapOf` for rows already fetched (bounded by one list). |
| Sub-desks | If a module has 2–3 desks, use a segmented `Picker` (iOS) or a `SingleChoiceSegmentedButtonRow` (Android) under `CarbonPageHeader`, as Deliveries does. If it has more than 3, use a desk list of `CarbonRow`s that push. No nested `TabView`. |
| Lists | `LazyVStack` / `LazyColumn` of `CarbonRow` / `CarbonActionRow`, fed by a slim DTO. The server caps the list (`LIMIT`); the client never holds more than one page. |
| Remote state | `Remote<T>` + `RemoteContentView` / `RemoteContent`: **loading → unavailable (named, retry, "This is not an empty list") → empty (in words + next action) → populated**. A refresh that fails keeps the last good answer and shows `staleSince` ("Last updated 14:05, couldn't refresh"). |
| Polling | `.task(id:) { await remote.poll(every:) }` / `LaunchedEffect`. The poll is cancelled with the screen. A queue polls every 30 s and an alarm list every 15 s. Nothing polls while the screen is in the background. |
| Scanning | `BarcodeScannerView` (iOS) / `BarcodeScanner.kt`, one result per `resumeKey`, with a torch, and typed entry always offered. **The server compares; the client never decides validity.** |
| Writes | Confirmed, never optimistic. Disable the button and show progress; on success, refetch and read back. A refusal shows the server's words and keeps the values the user typed. |
| Offline | Reads render last-good with a stale banner. Writes are refused in words ("Not saved — no connection. Nothing was recorded.") **with no outbox**. Camp is the only module with an outbox. A safety-relevant write must never be queued silently. |
| Permission denied | The module tab is absent (the registry gate). A control whose permission the user lacks is **absent**, not disabled. A desk whose read permission is missing is absent and **its fetch is never issued** (authz rule 8). A server 403 mid-session reads "You no longer have access to this — ask your administrator", and the list is not cleared. |
| Targets / a11y | 44 pt / 48 dp, an `accessibilityIdentifier` / `testTag` on every row and control (`<module>-<thing>-<id>`), a `Label` on every icon-only toolbar item, Dynamic Type, never colour alone. Status chips are `CarbonTag` with the word in them. |
| Tests | Every module ships the isolated journeys required by the `NATIVE-TEST-CHARTER` rows (seed, states, gate, write, refusal, safety copy, evidence) **and** one **long-session navigation journey**: sign in once, walk a shift across desks and tabs with Back, and assert each screen still holds what it held. The journeys below are those long-session ones. |

**Value order** (why the modules are in this order): patient safety at the point of care
first, then work that genuinely happens away from a desk, then back-office work that already
has a good web screen.

1. Security · 2. Lab (phlebotomy) · 3. Pharmacy · 4. Housekeeping · 5. BME · 6. Facilities ·
7. Blood Bank · 8. HR · 9. Billing · 10. Device sync

---

## 1. Security (`Mobile-Security`): the gate guard's phone

**Who and when.** A guard posted at the main gate or at a ward entrance during visiting
hours (17:00–19:00) checks every visitor pass by camera. The same guard, on a floor round,
reports incidents such as a violent attendant, theft or an unattended bag, and responds to a
Code Pink tag alert (infant tag at an exit). A supervisor closes incidents at shift end.
Role: `security_guard`, which holds `front_office.passes.verify`, `front_office.passes.list`,
`front_office.visitors.list`, `security.incidents.list/create/update`,
`security.patient_safety.list/manage`, `security.access.*`, `security.cctv.*` and
`security.debriefs.create`.

**Module gate.** Today the module is gated on `requiredPermissions: ["security.incidents.list"]`.
The plan changes this to `requiredAnyPermissions: ["front_office.passes.verify",
"security.incidents.list"]`. That way a gate-only guard still gets the scanner, and an
`audit_officer`, who holds only `incidents.list`, gets only the incident list.

| # | Screen | Placement / layout | Calls | Gate (screen / controls) |
|---|---|---|---|---|
| S1 | **Gate scan** (module home, first desk) | Full-height `BarcodeScannerView` with torch. On a read, a **result sheet** (`.sheet` with `.medium` detent / `ModalBottomSheet`) shows a large verdict band: **Let in** (success) or **Do not let in — Revoked / Expired / Not yet valid** (danger, word + icon). Below the band: visitor name, relationship, category, ID type + last 4 digits, photo (`AsyncImage`, downscaled), ward + bed, valid until. Actions: **Record entry** / **Record exit**, then **Scan next**, which bumps `resumeKey`. | `GET /api/front-office/passes/scan?code=` (`scanVisitorPass`), `POST /api/front-office/visitor-logs/{pass_id}/check-in` (`checkInVisitor`), `PUT …/{pass_id}/check-out` (`checkOutVisitor`) | Screen: `front_office.passes.verify`. Record entry/exit: `front_office.passes.manage` (**the guard lacks this — see gap G-SEC-1**). |
| S2 | **Inside now** | Segment 2. A list of passes checked in and not out, with overdue passes first (valid_until passed: `CarbonTag` "Overdue", warning). Tap a row to open the S1 result sheet for that pass. | `GET /api/front-office/visitor-logs` + `GET /api/front-office/passes` (joined client-side via a `Dictionary` keyed by pass id, as Deliveries does) | `front_office.visitors.list` + `front_office.passes.list` |
| S3 | **Incidents** | Segment 3. A list with severity tag, location and age, open first. Toolbar **Report** (`Label("Report", systemImage: "plus")` / FAB) pushes S4. Tap a row to push S5. | `GET /api/security-incidents` (`listSecurityIncidents`). This is the register the web uses. Do **not** use the duplicate `/api/security/incidents` V2, whose client is typed `unknown`. | `security.incidents.list` |
| S4 | **Report incident** | Pushed form. Category picker, severity segmented control, location (`CatalogueFieldView` location picker, not free text), description, people involved. A photo would be wanted, but there is no attachment field, so it is left out (G-SEC-3). Keyboard rules per `MOBILE-FORM-KEYBOARD-RULES.md`. | `POST /api/security-incidents` (`createSecurityIncident`) | `security.incidents.create` |
| S5 | **Incident detail** | Timeline of updates, and **Add update** (text). **Close** (supervisor) uses a confirmation dialog. | `GET /api/security-incidents/{id}`, `GET/POST …/{id}/updates`, `PATCH …/{id}` | read: `.list`; Add update / Close: `security.incidents.update` |
| S6 | **Code Pink alerts** | Shown as a red banner above every desk when any tag alert is open (poll every 15 s). Tapping it pushes the alert list. Each alert shows tag, patient bed and exit zone, with **Resolve** and a reason. | `GET /api/security/tag-alerts` (`listSecurityTagAlerts`), `PUT /api/security/tag-alerts/{id}/resolve` | `security.patient_safety.list` / `.manage` |

**States.**

- **Scan, unknown pass (404):** the verdict band reads "No such pass — do not let in", not an error.
- **Scan, server unreachable:** "Couldn't check this pass. Do not read this as valid — check the paper pass and the ward."
- **Camera denied:** typed entry, with the reason stated.
- **Inside now, empty:** "Nobody is checked in on a pass."
- **Incidents, empty:** "No open incidents."
- **Offline:**
  - The scan refuses to answer. There is **no cached verdict**, because a revoked pass must never read as valid from a cache.
  - Incidents show last-good with a stale banner.
  - Report is refused, and the typed text is kept.
- **403 on check-in:** "Recording entry needs the pass desk permission."

**Missing / gaps.**

- **G-SEC-1:** `security_guard` lacks `front_office.passes.manage`, so the guard can scan but cannot record entry or exit. Do **not** grant `.manage`, because that also lets the guard issue and revoke passes. Add a new `front_office.visitor_logs.record` ("Record a visitor's entry and exit"), guard check-in/out with any-of(`passes.manage`, `visitor_logs.record`), and grant it to the guard.
- **G-SEC-2:** No patrol rounds or checkpoint scanning, no lost and found, no key register. Out of scope for this plan; noted only.
- **G-SEC-3:** No attachment field on incidents (photo evidence).
- **G-SEC-4:** Two incident registers write `security_incidents`: `/api/security/incidents` (V2, client typed `unknown`) and `/api/security-incidents`. Pick `/api/security-incidents` and delete V2 in its own PR.

**Long-session journey.** `testAGuardWorksVisitingHours`, one sign-in as a provisioned
guard with seed: 1 active pass, 1 revoked pass, 1 open incident, 1 tag alert.

1. The guard lands on the Security tab, on **Gate scan**.
2. Type the active pass number. The band reads "Let in". Tap **Record entry**, then **Scan next**.
3. Type the revoked pass number. The band reads "Do not let in — Revoked" with its reason, and no Record button is shown.
4. Switch to **Inside now**. The active pass is listed. Push its row and pop back. The list is unchanged.
5. Switch to **Incidents** and push S4. Fill the form and go Back mid-form. The fields are discarded, the list is intact and no record exists on the server.
6. Report again and submit. The list shows the new row (read back through the API).
7. Push the new row, add an update, pop back.
8. Switch to the Reception tab (the guard holds `front_office.queue.list` via the Mobile-Security app code) and return to Security. The segment and scroll position are kept.
9. The Code Pink banner is present. Resolve the alert with a reason. The banner clears and the server shows it resolved.
10. Record exit for the pass from Inside now. The row leaves.
11. Sign out.

---

## 2. Lab: phlebotomy at the bedside and critical values (`Mobile-LabTech`, `Mobile-Phlebo`)

**Who and when.** A phlebotomist works the 05:30 ward round with a tray: they pick up the
morning draw list, find each patient, scan the wristband and the tube, and collect. The
on-call lab tech, at night away from the bench, acknowledges a critical value with
read-back. Home-collection phlebotomists work their trip list. Results entry and verify
stay on the analyser workstation (web). Roles: `lab_technician` holds `lab.orders.list`,
`lab.phlebotomy.list/manage`, `lab.samples.*` and `lab.results.create`; `nurse` holds
`lab.orders.list` and `lab.phlebotomy.list`.

**Module gate.** Change it from `lab.orders.list` to `requiredAnyPermissions:
["lab.phlebotomy.list", "lab.samples.list"]`. Doctors and nurses hold `lab.orders.list`, so
the current gate would show them a Lab tab for work that is not theirs.

| # | Screen | Placement / layout | Calls | Gate |
|---|---|---|---|---|
| L1 | **Draw list** (home) | Segments **To draw / Collected**. Rows are grouped by ward and bed (`Section`), with STAT tagged first. Each row shows patient name, UHID (mono), bed and tests. | `GET /api/lab/phlebotomy-queue` (`listPhlebotomyQueue`), `GET /api/lab/stat-orders` | `lab.phlebotomy.list` |
| L2 | **Collect** (pushed) | Patient band at the top (name, UHID, age/sex, allergies), then the tests and the tube type/colour **as a word, with colour secondary**. Step 1: **Scan wristband** (scanner sheet). Step 2: **Scan tube label**. Step 3: **Collected**. A reject path (haemolysed, insufficient) is under a `Menu`. | `PUT /api/lab/orders/{id}/collect` with `patient_identifier` + `sample_barcode` (`collectSample`); the **server checks the wristband against the order**. `PUT /api/lab/orders/{id}/reject`; `PUT /api/lab/phlebotomy-queue/{id}/status` | Collect / Reject: `lab.results.create` (see G-LAB-1) |
| L3 | **Find sample** | Toolbar scan. Read a tube barcode to open its order (status, where it is). | `GET /api/lab/orders?q=<barcode>` (fuzzy; G-LAB-2) | `lab.orders.list` |
| L4 | **Critical values** | Badge count on the segment. List of unacknowledged alerts: test, value, flag and age. Detail asks for **read-back** of the value (typed), then **Acknowledge**. | `GET /api/lab/critical-alerts`, `PUT /api/lab/critical-alerts/{id}/acknowledge` (`readback_value`) | list: `lab.orders.list`; Acknowledge: `lab.results.update` (lab tech holds it) |
| L5 | **Home collections** | Trip list for today, ordered by slot. Detail has an address/maps link, **Arrived / Collected / Not home**. | `GET /api/lab/home-collections`, `POST /api/lab/home-collections/{id}/status` | `lab.samples.list` / `.manage` |

**States.**

- **Wristband mismatch:** the server refuses. Show the full danger notification "This wristband is not this patient. Do not draw." and keep the tube scan.
- **Draw list, empty:** "Nothing to draw on your wards."
- **Unavailable:** "Couldn't load the draw list — this is not an empty round."
- **Critical values, unavailable:** "Couldn't load critical values. Do not read this as none pending. Call the lab."
- **Offline:** collect is refused, because collection time is clinical data and must not be back-dated silently.

**Missing / gaps.**

- **G-LAB-1:** Collection is gated on `lab.results.create`. A ward nurse drawing blood cannot record collection, and a phlebotomist must be granted result entry to collect. Add `lab.samples.collect` ("Record a sample drawn from a patient") and guard `/collect` with any-of(`results.create`, `samples.collect`).
- **G-LAB-2:** No exact sample-barcode lookup (`GET /api/lab/samples/by-barcode/{code}`). The fuzzy `q` can return several rows.
- **G-LAB-3** (defect, not mobile): `PUT /api/lab/report-delivery-config` is gated on `lab.orders.list`.

**Long-session journey.** `testAPhlebotomistWorksTheMorningRound`, as `lab_technician`.
Seed: 2 orders on 2 beds, 1 critical alert.

1. Land on Lab, on the Draw list. Both beds are listed.
2. Push bed 1. Scan the **bed 2** wristband: the refusal is in words, and nothing changes on the server.
3. Scan the correct wristband, scan the tube, tap **Collected**. Pop back: bed 1 has moved to Collected.
4. Switch to Critical values. Acknowledge with a wrong read-back: refused. Acknowledge with the correct one: the server shows it acknowledged.
5. Switch tabs away and back. The Draw list is still on To draw and still shows bed 2.
6. Find sample: scanning bed 1's tube shows Collected.
7. Collect bed 2. Back to the list: it is empty, with the empty-state words.

---

## 3. Pharmacy: ward stock, NDPS and the counter queue (`Mobile-Pharmacist`)

**Who and when.**

- The pharmacist covering IP and discharge works the Rx review queue between counters, from the phone.
- The store pharmacist walks the shelves at month end: a near-expiry sweep, and a scan of a pack to see its stock and batches.
- The night pharmacist checks the NDPS balance.

Dispensing at the counter stays on the web/desktop: a phone can't print, and dispense needs the full allergy/DDI workspace. Role: `pharmacist`.

**Module gate.** Keep `pharmacy.prescriptions.list`, but add `appCodes: ["Mobile-Pharmacist"]`
(already set) and change it to `requiredAnyPermissions: ["pharmacy.rx_queue.review",
"pharmacy.stock.manage"]`. Doctors and nurses hold `prescriptions.list`.

| # | Screen | Placement / layout | Calls | Gate |
|---|---|---|---|---|
| P1 | **Rx review** (home) | Queue: patient, prescriber, item count, flags (Schedule H1/X, LASA, allergy as words in `CarbonTag`). Detail shows the items, the interaction/allergy result, and **Approve / Query prescriber** with a reason. | `GET /api/pharmacy/rx-queue`, `GET …/{id}`, `PUT …/{id}/review`, `POST /api/pharmacy/interactions/check` | `pharmacy.rx_queue.list`; review: `pharmacy.rx_queue.review` |
| P2 | **Scan stock** | Scan a pack barcode to see the item (INN, schedule badge), stock per store and batches with expiry (FEFO order). | `GET /api/pharmacy/catalog?barcode=`, `GET /api/pharmacy/batches?catalog_item_id=` | `pharmacy.stock.manage` |
| P3 | **Near expiry** | Batches expiring within 30/60/90 days (segmented), sorted by date. **Write off expired** asks for confirmation and a count. | `GET /api/pharmacy/batches/near-expiry`, `GET …/expired`, `POST …/write-off-expired` | `pharmacy.stock.manage` |
| P4 | **NDPS balance** | Read-only: drug, balance and last entry. Register entries stay on the web, with dual lock and witness. | `GET /api/pharmacy/ndps-register/balance` | `pharmacy.ndps.list` |
| P5 | **Fulfilment pick** | Claimed orders to pick. Each line shows **scan the pack** against the line, then **Picked**. | `GET /api/pharmacy/fulfilment/queue` + claim / pick-list routes | `pharmacy.fulfilment.pick` |

**States.**

- **Rx queue, empty:** "No prescriptions waiting for review."
- **Scan of an unknown barcode:** "No item with this barcode in the formulary" (a 404 in words).
- **NDPS, unavailable:** "Couldn't load the NDPS balance. Do not read this as zero."

**Missing / gaps.**

- **G-PH-1:** No pack-barcode check against an order line (`POST /api/pharmacy/orders/{id}/items/{item_id}/verify-pack`). P5's scan step needs it, or it is cosmetic.
- **G-PH-2:** No lookup of an order by UHID/QR. The client must resolve via `GET /api/patients/find?q=` and then filter by `patient_id`. That works, but it is two round trips.
- **G-PH-3** (safety, web too): the NDPS `witnessed_by` is a bare UUID, never authenticated, never checked against the dispenser, and replaceable by `ndps_override_reason`. This is why NDPS writes are kept off the phone until a witness co-sign exists.

**Long-session journey.** `testAPharmacistReviewsThenSweepsExpiry`.

1. Rx review: approve one. It leaves the queue (server read-back).
2. Query the second one with a reason.
3. Switch to Scan stock: scan a seeded barcode and see its batches. Back.
4. Near expiry: switch 30 → 90 days, and the list grows. Write off, and the expired count goes to 0 on the server.
5. NDPS shows the seeded balance.
6. Deliveries tab and back: Rx review is still filtered as it was left.

---

## 4. Housekeeping: my tasks and bed turnaround (`Mobile-Housekeeping`)

**Who and when.** A housekeeper is paged when a patient is discharged: the bed must be
turned around (terminal clean) before admission can assign it. Scheduled area cleaning goes
on through the shift. The supervisor verifies cleans and takes BMW sharp-container
replacements. Roles: `housekeeping_staff` holds cleaning list/create, turnaround list/manage
and linen list/create; `facilities_manager` supervises.

| # | Screen | Placement / layout | Calls | Gate |
|---|---|---|---|---|
| H1 | **Turnarounds** (home) | Beds awaiting clean, oldest first, with the minutes since discharge (a timer word, not a colour). Detail: **Start**, then **Done**. | `GET /api/housekeeping/turnarounds`, `PUT …/{id}/complete` | `housekeeping.turnaround.list` / `.manage` |
| H2 | **Cleaning tasks** | Today's tasks by area. Status chip. **Start** → **Complete**. | `GET /api/housekeeping/tasks?date=&status=`, `PUT …/tasks/{id}/status` | list: `housekeeping.cleaning.list`; status: `.manage` (G-HK-1) |
| H3 | **Verify** (supervisor desk) | Completed tasks awaiting verification. **Verify** / **Redo** with a reason. | `PUT /api/housekeeping/tasks/{id}/verify` | `housekeeping.cleaning.manage` |
| H4 | **Linen** | Issue/return a movement (ward, item, count, stepper). | `POST /api/housekeeping/linen-movements` | `housekeeping.linen.create` |
| H5 | **Sharps** | Log a sharp-container replacement (location, fill level). | `GET /api/housekeeping/bmw/schedule`, `POST …/bmw/sharp-replacement` | `housekeeping.cleaning.list` / `.create` |

**States.**

- **Turnarounds, empty:** "No beds waiting to be cleaned."
- **Offline:** completion is refused, because the bed would show clean when it is not.
- **Turnaround refused:** the server's words are shown.

**Missing / gaps.**

- **G-HK-1:** Starting or completing one's own task needs `housekeeping.cleaning.manage`, the same code that verifies, and `housekeeping_staff` does not hold it. **As shipped, a housekeeper cannot complete a task.** Add `housekeeping.tasks.perform` ("Start and complete my cleaning tasks"), restrict it to tasks assigned to the caller, and keep `.manage` for verify.
- **G-HK-2:** No assignee / "my tasks" filter on `GET /api/housekeeping/tasks`. Add `assigned_to=me`.
- **G-HK-3:** `PUT /turnarounds/{id}/complete` never moves the bed from dirty to available. Admission keeps seeing a dirty bed, unless the housekeeper also holds `ipd.beds.manage`, which they must not. Fix it server-side, in the same transaction.
- **G-HK-4:** No spill-kit or checklist entity, and no BMW bag-barcode collection. Noted only.

**Long-session journey.** `testAHousekeeperTurnsABedAroundAndCleansTheWard`.

1. Turnarounds lists the seeded bed. Start, then Done. The bed is available on the server (after the G-HK-3 fix).
2. Cleaning tasks: start and complete one.
3. Switch to Sharps and log a replacement.
4. Go back to Tasks: the completed task still shows Completed.
5. A second identity without `.verify` sees no Verify desk and issues no fetch.

---

## 5. BME: equipment by QR, breakdown, PM (`Mobile-BME`)

**Who and when.** A ward nurse finds a syringe pump faulty: they scan its asset tag and
report a breakdown, which takes 30 seconds and needs no form hunting. The biomedical
engineer walks the PM schedule with the phone, scans each device, records the PM and closes
the work order. Roles: `biomed_engineer` holds `bme.equipment.list` and more;
`facilities_manager` holds `bme.breakdowns.create`.

| # | Screen | Placement / layout | Calls | Gate |
|---|---|---|---|---|
| B1 | **Scan equipment** (home) | Scanner, then the equipment card: name, make/model, asset tag (mono), location, status, risk class, and last/next PM and calibration with due words. | `GET /api/bme/equipment?asset_tag=` (**missing, G-BME-1**), then `GET /api/bme/equipment/{id}` | `bme.equipment.list` |
| B2 | **Report breakdown** | From B1. Symptom, "device taken out of use" switch, and a note. | `POST /api/bme/breakdowns` | `bme.breakdowns.create` |
| B3 | **My work orders** | PM and breakdown work orders, by due date. Detail: findings, actions, **Complete**. | `GET /api/bme/work-orders`, `PUT …/{id}/status` | `bme.pm.list` / `bme.pm.manage` |
| B4 | **Breakdowns** | Open breakdowns. Status transitions. | `GET /api/bme/breakdowns`, `PUT …/{id}/status` | `bme.breakdowns.list` / `.manage` |
| B5 | **Device history** | From B1: breakdowns, PM and calibrations for this device. | **missing, G-BME-2** | `bme.equipment.list` |

**States.**

- **Unknown tag:** "No equipment with this tag. Check the label or register it on the web."
- **Calibration overdue:** a danger tag with the words "Calibration overdue — do not use for measurement".

**Missing / gaps.**

- **G-BME-1:** No lookup by asset tag or barcode. `bme_equipment.asset_tag` and `barcode_value` exist, but `list_equipment` filters only on department, status or risk (an else-if chain). Add `GET /api/bme/equipment/by-tag/{code}`.
- **G-BME-2:** No per-equipment history route. Add `equipment_id` filters to breakdowns, work-orders and calibrations, or add `GET /api/bme/equipment/{id}/history`.
- **G-BME-3:** `get_equipment` uses `fetch_one`, so a missing id answers 500, not 404.
- **G-BME-4:** Ward staff need `bme.breakdowns.create` to report. Decide whether nurses get it (recommended).

**Long-session journey.** `testAnEngineerWalksThePmRound`.

1. Scan a seeded tag and see the card.
2. Report a breakdown. Back: the card shows status "Out of use".
3. My work orders: complete the PM. Its next-due date moves on the server.
4. Breakdowns: the new one is listed. Resolve it.
5. Scan the same tag again: status is back to "In use".

---

## 6. Facilities: work orders, gas, fire rounds, water (`Mobile-BME`, `Mobile-Housekeeping`)

**Who and when.**

- The maintenance technician gets work orders such as a leaking tap or a dead light: they find each one, update it and close it with findings.
- The gas-plant operator logs manifold pressures twice a shift.
- The fire officer does a monthly extinguisher round.
- The plumber logs water tests.

Role: `facilities_manager`. There is no technician role yet (G-FAC-3).

| # | Screen | Placement / layout | Calls | Gate |
|---|---|---|---|---|
| F1 | **Work orders** (home) | Open first, by priority. Toolbar **Raise**. Detail: **Assign to me / In progress / Close** with findings and actions. | `GET /api/facilities/work-orders`, `GET …/{id}`, `PUT …/{id}/status` | `facilities.work_orders.list` / `.manage` |
| F2 | **Raise work order** | Location picker, category, priority and description. | `POST /api/facilities/work-orders` | `facilities.work_orders.create` |
| F3 | **Gas reading** | Per source (O₂ / N₂O / vacuum / air), pressure and purity as number fields with the clinical range shown. Out-of-range values need a remark. | `POST /api/facilities/gas-readings`, `GET …` | `facilities.gas.manage` / `.list` |
| F4 | **Fire round** | List of extinguishers due. Each item: checked, pressure OK, seal and a remark. | `GET /api/facilities/fire-equipment`, `POST /api/facilities/fire-inspections` | `facilities.fire.list` / `.manage` |
| F5 | **Water test** | Source, parameters and result. | `POST /api/facilities/water-tests` | `facilities.water.manage` |

**Missing / gaps.**

- **G-FAC-1:** No `assigned_to=me` on the work-order list.
- **G-FAC-2:** No fire-equipment tag lookup, so the round needs a scan lookup: `GET /api/facilities/fire-equipment/by-tag/{code}`.
- **G-FAC-3:** Updating one's own work order needs `facilities.work_orders.manage`, which only the manager holds. Add a technician-level `facilities.work_orders.perform`.
- **G-FAC-4:** No photo/attachment on work orders.

**Long-session journey.** `testATechnicianClosesAWorkOrderThenLogsGas`.

1. Raise a work order, then assign it to me, set In progress and Close with findings (server read-back).
2. Log an out-of-range O₂ pressure without a remark: refused. With a remark: saved.
3. Fire round: inspect one extinguisher. It leaves the "due" list.
4. Back to Work orders: the closed filter shows the closed order.

---

## 7. Blood Bank: issue and the bedside link (`Mobile-LabTech`)

**Who and when.** The blood-bank tech issues a crossmatched unit to the ward porter. That
moment is the bag-to-patient-to-request check. The tech also watches inventory and expiry in
the fridge. Bedside transfusion (two-person check, 15-minute observations) is **already
native in the Nurse module** (`TransfusionMonitorScreen` ✅) and is not duplicated here.
Role: `blood_bank_tech`.

| # | Screen | Placement / layout | Calls | Gate |
|---|---|---|---|---|
| BB1 | **Crossmatch requests** (home) | Pending and ready, by urgency. Detail shows the result and the assigned unit. | `GET /api/blood-bank/crossmatch`, `PUT …/{id}` | `blood_bank.crossmatch.list` / `.create` |
| BB2 | **Issue unit** | Scan the bag, which must equal the crossmatched unit. Then **Issue to** (porter, ward) and confirm. | `PUT /api/blood-bank/components/{id}/status` (`issued`); bag lookup **missing (G-BB-1)** | `blood_bank.inventory.manage` |
| BB3 | **Inventory** | By group × component, with near-expiry first, as a grid of `CarbonTile` counts with the group as text. Detail list of units. | `GET /api/blood-bank/components?blood_group=&component_type=` | `blood_bank.inventory.list` |
| BB4 | **Reactions** | Transfusions with `reaction_suspected` from bedside observations. Record a formal reaction. | `GET /api/blood-bank/transfusions`, `PUT …/{id}/reaction` | `blood_bank.transfusion.list` / `.create` |

**Missing / gaps.**

- **G-BB-1:** No component lookup by bag or unit number, and the list has no `bag_number` filter. Add `GET /api/blood-bank/components/by-bag/{bag}`. Without it, the issue scan is cosmetic.
- **G-BB-2:** The issue (`components/{id}/status`) does not verify that the unit equals the crossmatched one. Move that check server-side.
- **G-BB-3:** A bedside nurse cannot file a formal reaction (`/reaction` needs `blood_bank.transfusion.create`). They can only flag it through observations. Decide whether nurses get a `blood_bank.reactions.report`.
- **G-BB-4:** The second verifier at bedside is a UUID, not a co-sign. Same class as G-PH-3.

**Long-session journey.** `testATechIssuesTheCrossmatchedUnit`.

1. Crossmatch: open the seeded request.
2. Issue: scan the **wrong** bag, refused. Scan the right bag, issued (server read-back).
3. Inventory: the count drops by one.
4. Reactions: a seeded suspected reaction is recorded formally.
5. Back to Crossmatch: the request shows Issued.

---

## 8. HR: my shift, my leave, my roster (every staff member)

**Who and when.** Every employee: start and end a shift, see their roster, apply for leave
and see its status. A manager approves leave on the phone. Self-service is the point, so the
module gate must not be `hr.attendance.list` (only `facilities_manager` and `hr_officer`
hold it). The gate becomes **ungated self-service** for anyone with an employee record, plus
an approvals desk behind `hr.leave.approve`. The current gate is the reason this module is
invisible to nearly everyone.

| # | Screen | Placement / layout | Calls | Gate |
|---|---|---|---|---|
| HR1 | **My shift** (home) | Big state card: Off duty, then **Start shift** → On duty since 07:02 → Pause / Resume / Extend / **End shift**. A fatigue warning carries an acknowledge step. | `GET /api/hr/my-shift`, `POST /api/hr/my-shift/start|pause|resume|extend|end|acknowledge-fatigue` | self (claims-scoped, no permission) |
| HR2 | **My leave** | My requests with status. **Apply**: type, dates (system date pickers), reason. Balances on top. | **missing (G-HR-2)** | self |
| HR3 | **My roster** | The next 14 days of my shifts. | **missing (G-HR-3)** | self |
| HR4 | **Approvals** (manager) | Pending leave for my team. **Approve / Reject** with a reason. | `GET /api/hr/leaves?status=pending`, `PUT /api/hr/leaves/{id}/action` | `hr.leave.approve` |
| HR5 | **My payslips** | List by month, opening a PDF (`QuickLook` / system viewer). | **missing (G-HR-4)** | self |

**States.**

- **Shift start offline:** refused. Attendance must not be back-dated from a phone clock.
- **Fatigue warning:** must be acknowledged; it cannot be dismissed.

**Missing / gaps.** HR has the largest gap of any module.

- **G-HR-1:** No geofence on master. `my-shift/start` carries no location or device proof. The work exists on the unmerged `feature/attendance-geofence`; land that first.
- **G-HR-2:** No "my leave".
  - `POST /api/hr/leaves` trusts `body.employee_id`, so any holder of `hr.leave.create` can file leave for anyone. Only `facilities_manager` holds it, so doctors and nurses cannot apply.
  - `GET /api/hr/leaves` returns everyone's leave.
  - `leave_action` does not stop a manager approving their own leave.
  - Add `GET/POST /api/hr/me/leaves` (claims-scoped) and `GET /api/hr/me/leave-balances`, and add a self-approval guard.
- **G-HR-3:** No `GET /api/hr/me/roster`.
- **G-HR-4:** No `GET /api/hr/me/payslips` (today it needs `hr.payroll.runs.list` plus a `run_id`).

**Long-session journey.** `testANurseStartsHerShiftAppliesForLeaveAndEnds`. The nurse lands
on Nurse, not HR, because HR is last in the registry.

1. Open the HR tab: Off duty. Start the shift; the server has a check-in.
2. Switch to the Nurse tab and back: still On duty, same start time.
3. My leave: apply. The request is Pending on the server.
4. Sign in as the manager (second session): approve.
5. Back as the nurse, refresh: Approved.
6. End the shift: the server has a check-out.

---

## 9. Billing: collect at the bedside or the desk (`Mobile-Admin`)

**Who and when.** The IPD billing clerk does the discharge round. They find the patient's
invoice, show the balance, and collect by UPI QR on the phone's screen or by card on a POS.
They also take an advance deposit at admission. Invoicing, concessions and refunds stay on
the web. Roles: `billing_clerk`, and `receptionist` (holds `billing.payments.create`).

**Module gate.** Keep `billing.invoices.list`, but require any-of
`["billing.payments.create", "billing.advances.create"]` as well. A receptionist must still
land on Reception, which is earlier in the registry.

| # | Screen | Placement / layout | Calls | Gate |
|---|---|---|---|---|
| BI1 | **Find invoice** (home) | Search by name/UHID/number, plus a scan of the patient QR. Rows: number, patient, total, balance due and status. | `GET /api/billing/invoices?search=` | `billing.invoices.list` |
| BI2 | **Invoice** | Header: balance due in large type. Line items collapsed. Payments made. Actions: **Collect**. | `GET /api/billing/invoices/{id}`, `GET …/{id}/payments` | `billing.invoices.view` |
| BI3 | **Collect** | Amount (defaults to the balance, editable down), mode as a segmented control (UPI QR / Card POS / Cash). For UPI QR, show the QR full-screen at max brightness and poll for status. On confirmation, record the payment, then the receipt. | `POST /api/payments/upi-qr`, `GET /api/payments/{id}/status`, `POST /api/billing/invoices/{id}/payments`, `POST …/{id}/receipts` | `billing.payments.create`; receipt: `billing.receipts.print` |
| BI4 | **Advance** | Patient, amount, mode → `POST /api/billing/advances`. | `POST /api/billing/advances` | `billing.advances.create` |

**States.**

- **UPI pending:** "Waiting for payment… do not hand over until it says Paid." Polling stops after a bounded 5 minutes with "Not confirmed — check the bank before retrying".
- **Offline:** collection is refused.
- **Cash** asks for confirmation of the amount.

**Missing / gaps.**

- **G-BIL-1:** `POST /api/payments/upi-collect` and `POST /api/payments/upi-deep-link` exist on the server with **no client method**. On a phone, the deep link is the natural path.
- **G-BIL-2:** Installment payment (`/installments/{id}/items/{item_id}/pay`) is gated on `billing.invoices.update`, not `payments.create`.
- **G-BIL-3** (defect, not mobile): `POST /api/billing/exchange-rates` is gated on `billing.reports.view`.

**Long-session journey.** `testAClerkCollectsADischargeBalance`.

1. Find the seeded invoice and open it.
2. Collect by cash with a partial amount. The balance drops on the server.
3. Back to the list: the row's balance is updated.
4. Take an advance for a second patient.
5. Reopen the first invoice: two payments are listed.

---

## 10. Device sync (`Mobile-Admin`)

**Who and when.** An IT or biomed admin pairs a ward tablet or TV, sees the paired devices
and revokes a lost phone at once. Phase 6 must define the module's own permission. Today it
borrows `devices.pairing.paired_list`, which `biomed_engineer` holds along with token.create,
paired.revoke and roster.read.

**Permission first.** Gate the module on any-of(`devices.pairing.paired.list`,
`devices.pairing.token.create`). Both exist, so no new code is needed for the gate itself.

| # | Screen | Placement / layout | Calls | Gate |
|---|---|---|---|---|
| D1 | **Paired devices** (home) | List: label, app variant, ward/station, last seen (stale is shown as a word) and revoked. | `GET /api/admin/paired-devices` | `devices.pairing.paired.list` |
| D2 | **Device detail** | Fingerprint (mono, truncated), issued-to and node key. **Revoke device** is a destructive confirmation that states the 16 h lag. | `DELETE /api/admin/paired-devices/{id}`, `GET/DELETE /api/device-pairing/paired/{id}/node-key` | `devices.pairing.paired.revoke` (node key: see G-DEV-1) |
| D3 | **Approve pairing** | Pending device-code requests. A TV shows a code; the admin matches it and approves. | `GET /api/admin/device-pairing/requests`, `POST /api/admin/device-pairing/approve` | `devices.pairing.token.create` |
| D4 | **Pair a device** | Mint a one-time token, shown as a QR for the other device to scan. | `POST /api/admin/device-pairing-tokens` | `devices.pairing.token.create` |
| D5 | **This phone's sync** | Local node identity (Rust `generateNodeIdentity`) and the peer roster. | `GET /api/device-pairing/peer-roster` | `devices.pairing.roster.read` |

**Missing / gaps.**

- **G-DEV-1:** Revoking a node key (`DELETE …/node-key`) requires `token.create`, not `paired.revoke`. This is a gate mismatch.
- **G-DEV-2:** `get_peer_roster` decides its fallback with `.is_err()` on an authz result. This is the `check-authz-collapse` pattern and should be fixed.
- **G-DEV-3:** No self-service "my devices / revoke this device" for the person a device was issued to.
- **G-DEV-4:** The 16 h revocation lag still applies (user decision pending). D2 must say so.

**Long-session journey.** `testAnAdminApprovesATvThenRevokesALostPhone`.

1. Approve pairing: the seeded request is approved.
2. Paired devices: the new device is listed. Open the seeded phone and revoke it. Back: it shows Revoked.
3. Pair a device: the QR is shown. Back.
4. The list is unchanged, and scroll position is kept.

---

## Every missing or mis-gated endpoint found

**Missing endpoints**, with the screen each one blocks:

| ID | Endpoint to add | Blocks |
|---|---|---|
| G-LAB-2 | `GET /api/lab/samples/by-barcode/{code}` (exact) | L3 |
| G-PH-1 | `POST /api/pharmacy/orders/{id}/items/{item_id}/verify-pack` | P5 |
| G-PH-2 | order lookup by UHID/QR (else 2 round trips) | P1 |
| G-HK-2 | `assigned_to=me` filter on `GET /api/housekeeping/tasks` | H2 |
| G-BME-1 | `GET /api/bme/equipment/by-tag/{code}` | B1 (the module home) |
| G-BME-2 | `GET /api/bme/equipment/{id}/history` (or `equipment_id` filters) | B5 |
| G-FAC-1 | `assigned_to=me` on `GET /api/facilities/work-orders` | F1 |
| G-FAC-2 | `GET /api/facilities/fire-equipment/by-tag/{code}` | F4 |
| G-BB-1 | `GET /api/blood-bank/components/by-bag/{bag}` | BB2 |
| G-HR-2 | `GET/POST /api/hr/me/leaves`, `GET /api/hr/me/leave-balances` | HR2 |
| G-HR-3 | `GET /api/hr/me/roster` | HR3 |
| G-HR-4 | `GET /api/hr/me/payslips` | HR5 |
| G-HR-1 | geofence proof on `my-shift/start` (branch `feature/attendance-geofence`) | HR1 |
| G-BIL-1 | client methods for existing `POST /api/payments/upi-collect`, `/upi-deep-link` | BI3 |
| G-DEV-3 | `GET /api/me/devices`, `DELETE /api/me/devices/{id}` | — (follow-up) |
| G-SEC-2/3 | patrols/checkpoints, lost & found, key register; incident attachments | follow-up |

**Permission gaps.** Each needs a new code, defined in Rust first, per ENGINEERING.md:

| ID | New permission | Why |
|---|---|---|
| G-SEC-1 | `front_office.visitor_logs.record` | Guards can scan but not record entry/exit, and `.manage` would also let them issue/revoke |
| G-LAB-1 | `lab.samples.collect` | Collection is gated on `lab.results.create` |
| G-HK-1 | `housekeeping.tasks.perform` | `housekeeping_staff` **cannot complete a task today** |
| G-FAC-3 | `facilities.work_orders.perform` | Only the manager can update a work order |
| G-BB-3 | `blood_bank.reactions.report` (decision) | Nurses can't file a formal reaction |

**Server behaviour defects found on the way:**

- G-HK-3: turnaround complete doesn't free the bed.
- G-BME-3: missing equipment answers 500.
- G-BB-2: issue doesn't verify against the crossmatch.
- G-PH-3 / G-BB-4: witness and second verifier are unauthenticated UUIDs.
- G-HR-2: leave trusts `employee_id` and has no self-approval guard.
- G-DEV-1: node-key revoke is gated on `token.create`.
- G-DEV-2: `.is_err()` on an authz result.
- G-SEC-4: duplicate incident register.
- G-LAB-3: lab config write is gated on `.list`.
- G-BIL-2 / G-BIL-3: billing gates are wrong.

**Module-gate changes** (registry), so each tab reaches the role that does the work: Security
any-of(passes.verify, incidents.list); Lab any-of(phlebotomy.list, samples.list); Pharmacy
any-of(rx_queue.review, stock.manage); HR self-service (ungated for employees) plus an
approvals desk; Billing adds any-of(payments.create, advances.create); Device sync
any-of(paired.list, token.create).
