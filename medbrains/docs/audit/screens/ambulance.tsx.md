# `ambulance.tsx` walkthrough

_Source: [`apps/web/src/pages/ambulance.tsx`](../../../apps/web/src/pages/ambulance.tsx) (582 lines). Guard: `P.AMBULANCE.FLEET_LIST`. API methods: 11. useForm: 0. Tables: 4. Modals: 4._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.AMBULANCE.FLEET_LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **}>Fleet** (`fleet`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Fleet** (`fleet`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Fleet** (`fleet`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Trips & Dispatch** (`trips`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Trips & Dispatch** (`trips`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Trips & Dispatch** (`trips`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Drivers** (`drivers`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Drivers** (`drivers`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Drivers** (`drivers`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Maintenance** (`maintenance`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Maintenance** (`maintenance`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Maintenance** (`maintenance`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Reports** (`reports`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Reports** (`reports`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Reports** (`reports`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### DataTable columns (27)
- [ ] Column **Code** (`ambulance_code`) renders without `undefined` / `[object Object]`
- [ ] Column **Vehicle #** (`vehicle_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`ambulance_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Make/Model** (`make`) renders without `undefined` / `[object Object]`
- [ ] Column **Certificates** (`certificates`) renders without `undefined` / `[object Object]`
- [ ] Column **Trip Code** (`trip_code`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`trip_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Priority** (`priority`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Patient** (`patient_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Pickup** (`pickup_address`) renders without `undefined` / `[object Object]`
- [ ] Column **Drop** (`drop_address`) renders without `undefined` / `[object Object]`
- [ ] Column **Response** (`response_time`) renders without `undefined` / `[object Object]`
- [ ] Column **Employee ID** (`employee_id`) renders without `undefined` / `[object Object]`
- [ ] Column **License #** (`license_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`license_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Expiry** (`license_expiry`) renders without `undefined` / `[object Object]`
- [ ] Column **Active** (`is_active`) renders without `undefined` / `[object Object]`
- [ ] Column **BLS** (`bls_certified`) renders without `undefined` / `[object Object]`
- [ ] Column **Shift** (`shift_pattern`) renders without `undefined` / `[object Object]`
- [ ] Column **Ambulance** (`ambulance_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`maintenance_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Scheduled** (`scheduled_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Cost** (`cost`) renders without `undefined` / `[object Object]`
- [ ] Column **Vendor** (`vendor_name`) renders without `undefined` / `[object Object]`

## Modals / Drawers

### Drawer — _<drawer @ line 209>_ @ [line 209](../../../apps/web/src/pages/ambulance.tsx#L209)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Book Ambulance Trip_ @ [line 340](../../../apps/web/src/pages/ambulance.tsx#L340)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Add Driver_ @ [line 404](../../../apps/web/src/pages/ambulance.tsx#L404)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Schedule Maintenance_ @ [line 488](../../../apps/web/src/pages/ambulance.tsx#L488)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (39)

- [ ] **<Select @ line 194>** (`Select`, [line 194](../../../apps/web/src/pages/ambulance.tsx#L194)) — accepts input, default value sensible, persists after refresh
- [ ] **Vehicle Number** (`TextInput`, [line 211](../../../apps/web/src/pages/ambulance.tsx#L211)) — accepts input, default value sensible, persists after refresh
- [ ] **Type** (`Select`, [line 212](../../../apps/web/src/pages/ambulance.tsx#L212)) — accepts input, default value sensible, persists after refresh
- [ ] **Make** (`TextInput`, [line 214](../../../apps/web/src/pages/ambulance.tsx#L214)) — accepts input, default value sensible, persists after refresh
- [ ] **Model** (`TextInput`, [line 215](../../../apps/web/src/pages/ambulance.tsx#L215)) — accepts input, default value sensible, persists after refresh
- [ ] **Year** (`NumberInput`, [line 217](../../../apps/web/src/pages/ambulance.tsx#L217)) — accepts input, default value sensible, persists after refresh
- [ ] **Chassis #** (`TextInput`, [line 218](../../../apps/web/src/pages/ambulance.tsx#L218)) — accepts input, default value sensible, persists after refresh
- [ ] **Engine #** (`TextInput`, [line 219](../../../apps/web/src/pages/ambulance.tsx#L219)) — accepts input, default value sensible, persists after refresh
- [ ] **Fuel Type** (`Select`, [line 220](../../../apps/web/src/pages/ambulance.tsx#L220)) — accepts input, default value sensible, persists after refresh
- [ ] **Ventilator** (`Switch`, [line 222](../../../apps/web/src/pages/ambulance.tsx#L222)) — accepts input, default value sensible, persists after refresh
- [ ] **Defibrillator** (`Switch`, [line 223](../../../apps/web/src/pages/ambulance.tsx#L223)) — accepts input, default value sensible, persists after refresh
- [ ] **Oxygen** (`Switch`, [line 224](../../../apps/web/src/pages/ambulance.tsx#L224)) — accepts input, default value sensible, persists after refresh
- [ ] **GPS Device ID** (`TextInput`, [line 226](../../../apps/web/src/pages/ambulance.tsx#L226)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 227](../../../apps/web/src/pages/ambulance.tsx#L227)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 330>** (`Select`, [line 330](../../../apps/web/src/pages/ambulance.tsx#L330)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 331>** (`Select`, [line 331](../../../apps/web/src/pages/ambulance.tsx#L331)) — accepts input, default value sensible, persists after refresh
- [ ] **Trip Type** (`Select`, [line 342](../../../apps/web/src/pages/ambulance.tsx#L342)) — accepts input, default value sensible, persists after refresh
- [ ] **Priority** (`Select`, [line 343](../../../apps/web/src/pages/ambulance.tsx#L343)) — accepts input, default value sensible, persists after refresh
- [ ] **Ambulance** (`Select`, [line 344](../../../apps/web/src/pages/ambulance.tsx#L344)) — accepts input, default value sensible, persists after refresh
- [ ] **Driver** (`Select`, [line 345](../../../apps/web/src/pages/ambulance.tsx#L345)) — accepts input, default value sensible, persists after refresh
- [ ] **Patient Name** (`TextInput`, [line 346](../../../apps/web/src/pages/ambulance.tsx#L346)) — accepts input, default value sensible, persists after refresh
- [ ] **Patient Phone** (`TextInput`, [line 347](../../../apps/web/src/pages/ambulance.tsx#L347)) — accepts input, default value sensible, persists after refresh
- [ ] **Pickup Address** (`Textarea`, [line 348](../../../apps/web/src/pages/ambulance.tsx#L348)) — accepts input, default value sensible, persists after refresh
- [ ] **Drop Address** (`Textarea`, [line 349](../../../apps/web/src/pages/ambulance.tsx#L349)) — accepts input, default value sensible, persists after refresh
- [ ] **Employee ID** (`TextInput`, [line 406](../../../apps/web/src/pages/ambulance.tsx#L406)) — accepts input, default value sensible, persists after refresh
- [ ] **License Number** (`TextInput`, [line 407](../../../apps/web/src/pages/ambulance.tsx#L407)) — accepts input, default value sensible, persists after refresh
- [ ] **License Type** (`Select`, [line 408](../../../apps/web/src/pages/ambulance.tsx#L408)) — accepts input, default value sensible, persists after refresh
- [ ] **License Expiry** (`DateInput`, [line 409](../../../apps/web/src/pages/ambulance.tsx#L409)) — accepts input, default value sensible, persists after refresh
- [ ] **BLS Certified** (`Switch`, [line 410](../../../apps/web/src/pages/ambulance.tsx#L410)) — accepts input, default value sensible, persists after refresh
- [ ] **Defensive Driving Trained** (`Switch`, [line 411](../../../apps/web/src/pages/ambulance.tsx#L411)) — accepts input, default value sensible, persists after refresh
- [ ] **Shift Pattern** (`Select`, [line 412](../../../apps/web/src/pages/ambulance.tsx#L412)) — accepts input, default value sensible, persists after refresh
- [ ] **Phone** (`TextInput`, [line 413](../../../apps/web/src/pages/ambulance.tsx#L413)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 480>** (`Select`, [line 480](../../../apps/web/src/pages/ambulance.tsx#L480)) — accepts input, default value sensible, persists after refresh
- [ ] **Ambulance** (`Select`, [line 490](../../../apps/web/src/pages/ambulance.tsx#L490)) — accepts input, default value sensible, persists after refresh
- [ ] **Type** (`Select`, [line 491](../../../apps/web/src/pages/ambulance.tsx#L491)) — accepts input, default value sensible, persists after refresh
- [ ] **Scheduled Date** (`DateInput`, [line 492](../../../apps/web/src/pages/ambulance.tsx#L492)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`Textarea`, [line 493](../../../apps/web/src/pages/ambulance.tsx#L493)) — accepts input, default value sensible, persists after refresh
- [ ] **Vendor** (`TextInput`, [line 494](../../../apps/web/src/pages/ambulance.tsx#L494)) — accepts input, default value sensible, persists after refresh
- [ ] **Estimated Cost** (`NumberInput`, [line 495](../../../apps/web/src/pages/ambulance.tsx#L495)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 8, `<ActionIcon>`: 4, `<Menu.Item>`: 0)

- [ ] **<button @ line 203>** ([line 203](../../../apps/web/src/pages/ambulance.tsx#L203)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 203>** ([line 203](../../../apps/web/src/pages/ambulance.tsx#L203)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 228>** ([line 228](../../../apps/web/src/pages/ambulance.tsx#L228)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 228>** ([line 228](../../../apps/web/src/pages/ambulance.tsx#L228)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 334>** ([line 334](../../../apps/web/src/pages/ambulance.tsx#L334)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 334>** ([line 334](../../../apps/web/src/pages/ambulance.tsx#L334)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 350>** ([line 350](../../../apps/web/src/pages/ambulance.tsx#L350)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 350>** ([line 350](../../../apps/web/src/pages/ambulance.tsx#L350)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 398>** ([line 398](../../../apps/web/src/pages/ambulance.tsx#L398)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 398>** ([line 398](../../../apps/web/src/pages/ambulance.tsx#L398)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 414>** ([line 414](../../../apps/web/src/pages/ambulance.tsx#L414)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 414>** ([line 414](../../../apps/web/src/pages/ambulance.tsx#L414)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 482>** ([line 482](../../../apps/web/src/pages/ambulance.tsx#L482)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 482>** ([line 482](../../../apps/web/src/pages/ambulance.tsx#L482)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 496>** ([line 496](../../../apps/web/src/pages/ambulance.tsx#L496)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 496>** ([line 496](../../../apps/web/src/pages/ambulance.tsx#L496)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 175>** ([line 175](../../../apps/web/src/pages/ambulance.tsx#L175)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 309>** ([line 309](../../../apps/web/src/pages/ambulance.tsx#L309)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 315>** ([line 315](../../../apps/web/src/pages/ambulance.tsx#L315)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 467>** ([line 467](../../../apps/web/src/pages/ambulance.tsx#L467)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (11)

- [ ] `api.createAmbulance` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createAmbulanceDriver` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createAmbulanceMaintenance` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createAmbulanceTrip` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listAmbulanceDrivers` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listAmbulanceMaintenance` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listAmbulanceTrips` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listAmbulances` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateAmbulance` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateAmbulanceMaintenance` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateAmbulanceTripStatus` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._