# `nurse-activities.tsx` walkthrough

_Source: [`apps/web/src/pages/nurse-activities.tsx`](../../../apps/web/src/pages/nurse-activities.tsx) (452 lines). Guard: `P.NURSE.DASHBOARD_VIEW`. API methods: 9. useForm: 0. Tables: 0. Modals: 2._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.NURSE.DASHBOARD_VIEW` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **MAR** (`mar`) — clicking activates the panel + loads its data without console error
- [ ] Tab **MAR** (`mar`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **MAR** (`mar`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Intake/Output** (`io`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Intake/Output** (`io`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Intake/Output** (`io`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Code Blue** (`code-blue`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Code Blue** (`code-blue`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Code Blue** (`code-blue`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Handoff** (`handoff`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Handoff** (`handoff`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Handoff** (`handoff`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Shift Notes** (`shift-notes`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Shift Notes** (`shift-notes`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Shift Notes** (`shift-notes`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Other** (`other`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Other** (`other`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Other** (`other`) — leaving and returning preserves or intentionally resets state

## Modals / Drawers

### Modal — _<modal @ line 221>_ @ [line 221](../../../apps/web/src/pages/nurse-activities.tsx#L221)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Modal — _Add I/O entry_ @ [line 371](../../../apps/web/src/pages/nurse-activities.tsx#L371)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

## Form inputs (7)

- [ ] **Look-ahead (minutes)** (`NumberInput`, [line 156](../../../apps/web/src/pages/nurse-activities.tsx#L156)) — accepts input, default value sensible, persists after refresh
- [ ] **Reason** (`Textarea`, [line 230](../../../apps/web/src/pages/nurse-activities.tsx#L230)) — accepts input, default value sensible, persists after refresh
- [ ] **Encounter ID** (`TextInput`, [line 273](../../../apps/web/src/pages/nurse-activities.tsx#L273)) — accepts input, default value sensible, persists after refresh
- [ ] **Direction** (`Select`, [line 373](../../../apps/web/src/pages/nurse-activities.tsx#L373)) — accepts input, default value sensible, persists after refresh
- [ ] **Category** (`Select`, [line 382](../../../apps/web/src/pages/nurse-activities.tsx#L382)) — accepts input, default value sensible, persists after refresh
- [ ] **Volume (ml)** (`NumberInput`, [line 388](../../../apps/web/src/pages/nurse-activities.tsx#L388)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 389](../../../apps/web/src/pages/nurse-activities.tsx#L389)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 7, `<ActionIcon>`: 0, `<Menu.Item>`: 0)

- [ ] **<button @ line 190>** ([line 190](../../../apps/web/src/pages/nurse-activities.tsx#L190)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 190>** ([line 190](../../../apps/web/src/pages/nurse-activities.tsx#L190)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 198>** ([line 198](../../../apps/web/src/pages/nurse-activities.tsx#L198)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 198>** ([line 198](../../../apps/web/src/pages/nurse-activities.tsx#L198)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 206>** ([line 206](../../../apps/web/src/pages/nurse-activities.tsx#L206)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 206>** ([line 206](../../../apps/web/src/pages/nurse-activities.tsx#L206)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Confirm** ([line 238](../../../apps/web/src/pages/nurse-activities.tsx#L238)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Confirm** ([line 238](../../../apps/web/src/pages/nurse-activities.tsx#L238)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 280>** ([line 280](../../../apps/web/src/pages/nurse-activities.tsx#L280)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 280>** ([line 280](../../../apps/web/src/pages/nurse-activities.tsx#L280)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 391>** ([line 391](../../../apps/web/src/pages/nurse-activities.tsx#L391)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 391>** ([line 391](../../../apps/web/src/pages/nurse-activities.tsx#L391)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 430>** ([line 430](../../../apps/web/src/pages/nurse-activities.tsx#L430)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 430>** ([line 430](../../../apps/web/src/pages/nurse-activities.tsx#L430)) — failure path works: validation/server error is shown clearly and does not leave stale loading state

## API methods used (9)

- [ ] `api.administerMar` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createIoEntry` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.endCodeBlue` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getEncounterIoBalance` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.holdMar` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listCodeBlue` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listIoForEncounter` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listMarDueNow` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.refuseMar` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._