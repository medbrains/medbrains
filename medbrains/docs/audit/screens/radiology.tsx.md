# `radiology.tsx` walkthrough

_Source: [`apps/web/src/pages/radiology.tsx`](../../../apps/web/src/pages/radiology.tsx) (1045 lines). Guard: `P.RADIOLOGY.ORDERS_LIST`. API methods: 13. useForm: 0. Tables: 5. Modals: 3._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.RADIOLOGY.ORDERS_LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **}>
            Orders** (`orders`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Orders** (`orders`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Orders** (`orders`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Modalities** (`modalities`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Modalities** (`modalities`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Modalities** (`modalities`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Appointments** (`appointments`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Appointments** (`appointments`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Appointments** (`appointments`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            TAT Analytics** (`tat`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            TAT Analytics** (`tat`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            TAT Analytics** (`tat`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Details** (`details`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Details** (`details`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Details** (`details`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Report** (`report`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Report** (`report`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Report** (`report`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Dose Tracking** (`dose`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Dose Tracking** (`dose`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Dose Tracking** (`dose`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### `<Table>` @ line 633
  - [ ] Header **Modality** column shows correct value for at least one row
  - [ ] Header **Body Part** column shows correct value for at least one row
  - [ ] Header **Dose** column shows correct value for at least one row
  - [ ] Header **DLP** column shows correct value for at least one row
  - [ ] Header **CTDIvol** column shows correct value for at least one row
  - [ ] Header **Recorded** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 768
  - [ ] Header **Code** column shows correct value for at least one row
  - [ ] Header **Name** column shows correct value for at least one row
  - [ ] Header **Description** column shows correct value for at least one row
  - [ ] Header **Active** column shows correct value for at least one row
  - [ ] Header **}** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

## Modals / Drawers

### Modal — _Create Radiology Appointment_ @ [line 923](../../../apps/web/src/pages/radiology.tsx#L923)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Drawer — _New Radiology Order_ @ [line 351](../../../apps/web/src/pages/radiology.tsx#L351)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Order Detail_ @ [line 501](../../../apps/web/src/pages/radiology.tsx#L501)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (20)

- [ ] **<Select @ line 264>** (`Select`, [line 264](../../../apps/web/src/pages/radiology.tsx#L264)) — accepts input, default value sensible, persists after refresh
- [ ] **Modality** (`Select`, [line 365](../../../apps/web/src/pages/radiology.tsx#L365)) — accepts input, default value sensible, persists after refresh
- [ ] **Body Part** (`TextInput`, [line 373](../../../apps/web/src/pages/radiology.tsx#L373)) — accepts input, default value sensible, persists after refresh
- [ ] **Clinical Indication** (`Textarea`, [line 378](../../../apps/web/src/pages/radiology.tsx#L378)) — accepts input, default value sensible, persists after refresh
- [ ] **Priority** (`Select`, [line 383](../../../apps/web/src/pages/radiology.tsx#L383)) — accepts input, default value sensible, persists after refresh
- [ ] **Contrast Required** (`Switch`, [line 393](../../../apps/web/src/pages/radiology.tsx#L393)) — accepts input, default value sensible, persists after refresh
- [ ] **Pregnancy Verified** (`Checkbox`, [line 398](../../../apps/web/src/pages/radiology.tsx#L398)) — accepts input, default value sensible, persists after refresh
- [ ] **Allergy Flagged** (`Checkbox`, [line 403](../../../apps/web/src/pages/radiology.tsx#L403)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 408](../../../apps/web/src/pages/radiology.tsx#L408)) — accepts input, default value sensible, persists after refresh
- [ ] **Findings** (`Textarea`, [line 594](../../../apps/web/src/pages/radiology.tsx#L594)) — accepts input, default value sensible, persists after refresh
- [ ] **Impression** (`Textarea`, [line 601](../../../apps/web/src/pages/radiology.tsx#L601)) — accepts input, default value sensible, persists after refresh
- [ ] **Recommendations** (`Textarea`, [line 606](../../../apps/web/src/pages/radiology.tsx#L606)) — accepts input, default value sensible, persists after refresh
- [ ] **Critical Finding** (`Switch`, [line 611](../../../apps/web/src/pages/radiology.tsx#L611)) — accepts input, default value sensible, persists after refresh
- [ ] **Code** (`TextInput`, [line 733](../../../apps/web/src/pages/radiology.tsx#L733)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 740](../../../apps/web/src/pages/radiology.tsx#L740)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`TextInput`, [line 748](../../../apps/web/src/pages/radiology.tsx#L748)) — accepts input, default value sensible, persists after refresh
- [ ] **Modality** (`Select`, [line 935](../../../apps/web/src/pages/radiology.tsx#L935)) — accepts input, default value sensible, persists after refresh
- [ ] **Encounter ID** (`TextInput`, [line 943](../../../apps/web/src/pages/radiology.tsx#L943)) — accepts input, default value sensible, persists after refresh
- [ ] **Priority** (`Select`, [line 949](../../../apps/web/src/pages/radiology.tsx#L949)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 959](../../../apps/web/src/pages/radiology.tsx#L959)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 11, `<ActionIcon>`: 3, `<Menu.Item>`: 0)

- [ ] **<button @ line 234>** ([line 234](../../../apps/web/src/pages/radiology.tsx#L234)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 234>** ([line 234](../../../apps/web/src/pages/radiology.tsx#L234)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 243>** ([line 243](../../../apps/web/src/pages/radiology.tsx#L243)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 243>** ([line 243](../../../apps/web/src/pages/radiology.tsx#L243)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 282>** ([line 282](../../../apps/web/src/pages/radiology.tsx#L282)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 282>** ([line 282](../../../apps/web/src/pages/radiology.tsx#L282)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 413>** ([line 413](../../../apps/web/src/pages/radiology.tsx#L413)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 413>** ([line 413](../../../apps/web/src/pages/radiology.tsx#L413)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 583>** ([line 583](../../../apps/web/src/pages/radiology.tsx#L583)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 583>** ([line 583](../../../apps/web/src/pages/radiology.tsx#L583)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 616>** ([line 616](../../../apps/web/src/pages/radiology.tsx#L616)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 616>** ([line 616](../../../apps/web/src/pages/radiology.tsx#L616)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 715>** ([line 715](../../../apps/web/src/pages/radiology.tsx#L715)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 715>** ([line 715](../../../apps/web/src/pages/radiology.tsx#L715)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 754>** ([line 754](../../../apps/web/src/pages/radiology.tsx#L754)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 754>** ([line 754](../../../apps/web/src/pages/radiology.tsx#L754)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **setShowForm(false)}>               Cancel** ([line 761](../../../apps/web/src/pages/radiology.tsx#L761)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **setShowForm(false)}>               Cancel** ([line 761](../../../apps/web/src/pages/radiology.tsx#L761)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 909>** ([line 909](../../../apps/web/src/pages/radiology.tsx#L909)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 909>** ([line 909](../../../apps/web/src/pages/radiology.tsx#L909)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 964>** ([line 964](../../../apps/web/src/pages/radiology.tsx#L964)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 964>** ([line 964](../../../apps/web/src/pages/radiology.tsx#L964)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 213>** ([line 213](../../../apps/web/src/pages/radiology.tsx#L213)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 223>** ([line 223](../../../apps/web/src/pages/radiology.tsx#L223)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 804>** ([line 804](../../../apps/web/src/pages/radiology.tsx#L804)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (13)

- [ ] `api.cancelRadiologyOrder` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createRadiologyAppointment` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createRadiologyModality` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createRadiologyOrder` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createRadiologyReport` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.deleteRadiologyModality` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getRadiologyOrder` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getRadiologyTat` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listRadiologyAppointments` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listRadiologyModalities` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listRadiologyOrders` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateRadiologyOrderStatus` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.verifyRadiologyReport` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._