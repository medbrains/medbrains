# `specialty/cath-lab.tsx` walkthrough

_Source: [`apps/web/src/pages/specialty/cath-lab.tsx`](../../../apps/web/src/pages/specialty/cath-lab.tsx) (228 lines). Guard: `P.SPECIALTY.CATH_LAB.PROCEDURES_LIST`. API methods: 6. useForm: 0. Tables: 6. Modals: 2._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.SPECIALTY.CATH_LAB.PROCEDURES_LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **Procedures** (`procedures`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Procedures** (`procedures`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Procedures** (`procedures`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **STEMI Dashboard** (`stemi`) — clicking activates the panel + loads its data without console error
- [ ] Tab **STEMI Dashboard** (`stemi`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **STEMI Dashboard** (`stemi`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Consignment Stock** (`consignment`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Consignment Stock** (`consignment`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Consignment Stock** (`consignment`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Hemodynamics** (`hemodynamics`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Hemodynamics** (`hemodynamics`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Hemodynamics** (`hemodynamics`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Devices** (`devices`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Devices** (`devices`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Devices** (`devices`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Post-Monitoring** (`monitoring`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Post-Monitoring** (`monitoring`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Post-Monitoring** (`monitoring`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### DataTable columns (24)
- [ ] Column **Type** (`procedure_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Patient** (`patient_id`) renders without `undefined` / `[object Object]`
- [ ] Column **STEMI** (`is_stemi`) renders without `undefined` / `[object Object]`
- [ ] Column **D2B (min)** (`door_to_balloon`) renders without `undefined` / `[object Object]`
- [ ] Column **Fluoro (s)** (`fluoroscopy`) renders without `undefined` / `[object Object]`
- [ ] Column **Contrast (ml)** (`contrast`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Site** (`site`) renders without `undefined` / `[object Object]`
- [ ] Column **Systolic** (`systolic`) renders without `undefined` / `[object Object]`
- [ ] Column **Diastolic** (`diastolic`) renders without `undefined` / `[object Object]`
- [ ] Column **Mean** (`mean`) renders without `undefined` / `[object Object]`
- [ ] Column **SpO2 %** (`saturation`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`device_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Manufacturer** (`manufacturer`) renders without `undefined` / `[object Object]`
- [ ] Column **Lot #** (`lot_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Consignment** (`consignment`) renders without `undefined` / `[object Object]`
- [ ] Column **Billed** (`billed`) renders without `undefined` / `[object Object]`
- [ ] Column **Event** (`event`) renders without `undefined` / `[object Object]`
- [ ] Column **Time** (`event_time`) renders without `undefined` / `[object Object]`
- [ ] Column **Recorded By** (`recorded_by`) renders without `undefined` / `[object Object]`
- [ ] Column **Time** (`monitored_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Sheath** (`sheath`) renders without `undefined` / `[object Object]`
- [ ] Column **Access Site** (`access_site`) renders without `undefined` / `[object Object]`
- [ ] Column **Ambulation** (`ambulation`) renders without `undefined` / `[object Object]`

## Modals / Drawers

### Drawer — _<drawer @ line 194>_ @ [line 194](../../../apps/web/src/pages/specialty/cath-lab.tsx#L194)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _New Cath Procedure_ @ [line 214](../../../apps/web/src/pages/specialty/cath-lab.tsx#L214)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (4)

- [ ] **Procedure Type** (`Select`, [line 217](../../../apps/web/src/pages/specialty/cath-lab.tsx#L217)) — accepts input, default value sensible, persists after refresh
- [ ] **STEMI** (`Switch`, [line 219](../../../apps/web/src/pages/specialty/cath-lab.tsx#L219)) — accepts input, default value sensible, persists after refresh
- [ ] **Contrast Type** (`TextInput`, [line 220](../../../apps/web/src/pages/specialty/cath-lab.tsx#L220)) — accepts input, default value sensible, persists after refresh
- [ ] **Contrast Volume (ml)** (`NumberInput`, [line 221](../../../apps/web/src/pages/specialty/cath-lab.tsx#L221)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 2, `<ActionIcon>`: 1, `<Menu.Item>`: 0)

- [ ] **<button @ line 156>** ([line 156](../../../apps/web/src/pages/specialty/cath-lab.tsx#L156)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 156>** ([line 156](../../../apps/web/src/pages/specialty/cath-lab.tsx#L156)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 222>** ([line 222](../../../apps/web/src/pages/specialty/cath-lab.tsx#L222)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 222>** ([line 222](../../../apps/web/src/pages/specialty/cath-lab.tsx#L222)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 115>** ([line 115](../../../apps/web/src/pages/specialty/cath-lab.tsx#L115)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (6)

- [ ] `api.createCathProcedure` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listCathDevices` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listCathHemodynamics` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listCathProcedures` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listPostMonitoring` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listStemiTimeline` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._