# `specialty/endoscopy.tsx` walkthrough

_Source: [`apps/web/src/pages/specialty/endoscopy.tsx`](../../../apps/web/src/pages/specialty/endoscopy.tsx) (173 lines). Guard: `P.SPECIALTY.ENDOSCOPY.PROCEDURES_LIST`. API methods: 5. useForm: 0. Tables: 3. Modals: 2._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.SPECIALTY.ENDOSCOPY.PROCEDURES_LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **Procedures** (`procedures`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Procedures** (`procedures`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Procedures** (`procedures`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Scope Management** (`scopes`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Scope Management** (`scopes`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Scope Management** (`scopes`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Reprocessing** (`reprocessing`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Reprocessing** (`reprocessing`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Reprocessing** (`reprocessing`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### DataTable columns (19)
- [ ] Column **Type** (`procedure_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Patient** (`patient_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Sedation** (`sedation`) renders without `undefined` / `[object Object]`
- [ ] Column **Biopsy** (`biopsy`) renders without `undefined` / `[object Object]`
- [ ] Column **Aldrete (Post)** (`aldrete`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`date`) renders without `undefined` / `[object Object]`
- [ ] Column **Serial #** (`serial_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Model** (`model`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`scope_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Uses** (`total_uses`) renders without `undefined` / `[object Object]`
- [ ] Column **Last HLD** (`last_hld`) renders without `undefined` / `[object Object]`
- [ ] Column **Last Culture** (`culture`) renders without `undefined` / `[object Object]`
- [ ] Column **Scope** (`scope_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Leak Test** (`leak_test`) renders without `undefined` / `[object Object]`
- [ ] Column **Chemical** (`chemical`) renders without `undefined` / `[object Object]`
- [ ] Column **Soak (min)** (`soak`) renders without `undefined` / `[object Object]`
- [ ] Column **HLD Result** (`result`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`date`) renders without `undefined` / `[object Object]`

## Modals / Drawers

### Drawer — _New Endoscopy Procedure_ @ [line 150](../../../apps/web/src/pages/specialty/endoscopy.tsx#L150)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Register New Scope_ @ [line 162](../../../apps/web/src/pages/specialty/endoscopy.tsx#L162)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (9)

- [ ] **Patient ID** (`TextInput`, [line 152](../../../apps/web/src/pages/specialty/endoscopy.tsx#L152)) — accepts input, default value sensible, persists after refresh
- [ ] **Procedure Type** (`TextInput`, [line 153](../../../apps/web/src/pages/specialty/endoscopy.tsx#L153)) — accepts input, default value sensible, persists after refresh
- [ ] **Scope** (`Select`, [line 154](../../../apps/web/src/pages/specialty/endoscopy.tsx#L154)) — accepts input, default value sensible, persists after refresh
- [ ] **Sedation Type** (`TextInput`, [line 155](../../../apps/web/src/pages/specialty/endoscopy.tsx#L155)) — accepts input, default value sensible, persists after refresh
- [ ] **Aldrete Score (Pre)** (`NumberInput`, [line 156](../../../apps/web/src/pages/specialty/endoscopy.tsx#L156)) — accepts input, default value sensible, persists after refresh
- [ ] **Aldrete Score (Post)** (`NumberInput`, [line 157](../../../apps/web/src/pages/specialty/endoscopy.tsx#L157)) — accepts input, default value sensible, persists after refresh
- [ ] **Serial Number** (`TextInput`, [line 164](../../../apps/web/src/pages/specialty/endoscopy.tsx#L164)) — accepts input, default value sensible, persists after refresh
- [ ] **Model** (`TextInput`, [line 165](../../../apps/web/src/pages/specialty/endoscopy.tsx#L165)) — accepts input, default value sensible, persists after refresh
- [ ] **Scope Type** (`TextInput`, [line 166](../../../apps/web/src/pages/specialty/endoscopy.tsx#L166)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 4, `<ActionIcon>`: 0, `<Menu.Item>`: 0)

- [ ] **<button @ line 124>** ([line 124](../../../apps/web/src/pages/specialty/endoscopy.tsx#L124)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 124>** ([line 124](../../../apps/web/src/pages/specialty/endoscopy.tsx#L124)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 125>** ([line 125](../../../apps/web/src/pages/specialty/endoscopy.tsx#L125)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 125>** ([line 125](../../../apps/web/src/pages/specialty/endoscopy.tsx#L125)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 158>** ([line 158](../../../apps/web/src/pages/specialty/endoscopy.tsx#L158)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 158>** ([line 158](../../../apps/web/src/pages/specialty/endoscopy.tsx#L158)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 167>** ([line 167](../../../apps/web/src/pages/specialty/endoscopy.tsx#L167)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 167>** ([line 167](../../../apps/web/src/pages/specialty/endoscopy.tsx#L167)) — failure path works: validation/server error is shown clearly and does not leave stale loading state

## API methods used (5)

- [ ] `api.createEndoscopyProcedure` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createEndoscopyScope` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listEndoscopyProcedures` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listEndoscopyReprocessing` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listEndoscopyScopes` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._