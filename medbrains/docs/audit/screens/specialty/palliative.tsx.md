# `specialty/palliative.tsx` walkthrough

_Source: [`apps/web/src/pages/specialty/palliative.tsx`](../../../apps/web/src/pages/specialty/palliative.tsx) (162 lines). Guard: `P.SPECIALTY.PALLIATIVE.DNR_LIST`. API methods: 8. useForm: 0. Tables: 4. Modals: 3._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.SPECIALTY.PALLIATIVE.DNR_LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **DNR Orders** (`dnr`) — clicking activates the panel + loads its data without console error
- [ ] Tab **DNR Orders** (`dnr`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **DNR Orders** (`dnr`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Pain Assessment** (`pain`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Pain Assessment** (`pain`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Pain Assessment** (`pain`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Mortuary** (`mortuary`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Mortuary** (`mortuary`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Mortuary** (`mortuary`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Nuclear Medicine** (`nucmed`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Nuclear Medicine** (`nucmed`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Nuclear Medicine** (`nucmed`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### DataTable columns (22)
- [ ] Column **Patient** (`patient_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Review Due** (`review_due`) renders without `undefined` / `[object Object]`
- [ ] Column **Scope** (`scope`) renders without `undefined` / `[object Object]`
- [ ] Column **Authorized By** (`authorized`) renders without `undefined` / `[object Object]`
- [ ] Column **Patient** (`patient_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Pain Score** (`pain_score`) renders without `undefined` / `[object Object]`
- [ ] Column **WHO Ladder** (`who_ladder`) renders without `undefined` / `[object Object]`
- [ ] Column **Morphine Eq (mg)** (`opioid`) renders without `undefined` / `[object Object]`
- [ ] Column **Breakthroughs** (`breakthrough`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`date`) renders without `undefined` / `[object Object]`
- [ ] Column **Receipt #** (`receipt`) renders without `undefined` / `[object Object]`
- [ ] Column **Deceased** (`name`) renders without `undefined` / `[object Object]`
- [ ] Column **MLC** (`mlc`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Storage Slot** (`storage`) renders without `undefined` / `[object Object]`
- [ ] Column **Organ Donation** (`organ`) renders without `undefined` / `[object Object]`
- [ ] Column **Isotope** (`isotope`) renders without `undefined` / `[object Object]`
- [ ] Column **Activity (mCi)** (`activity`) renders without `undefined` / `[object Object]`
- [ ] Column **Half-life (h)** (`half_life`) renders without `undefined` / `[object Object]`
- [ ] Column **AERB License** (`aerb`) renders without `undefined` / `[object Object]`
- [ ] Column **Active** (`active`) renders without `undefined` / `[object Object]`

## Modals / Drawers

### Drawer — _New DNR Order_ @ [line 131](../../../apps/web/src/pages/specialty/palliative.tsx#L131)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Pain Assessment_ @ [line 139](../../../apps/web/src/pages/specialty/palliative.tsx#L139)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _New Mortuary Record_ @ [line 149](../../../apps/web/src/pages/specialty/palliative.tsx#L149)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (13)

- [ ] **Patient ID** (`TextInput`, [line 133](../../../apps/web/src/pages/specialty/palliative.tsx#L133)) — accepts input, default value sensible, persists after refresh
- [ ] **Admission ID** (`TextInput`, [line 134](../../../apps/web/src/pages/specialty/palliative.tsx#L134)) — accepts input, default value sensible, persists after refresh
- [ ] **Scope** (`TextInput`, [line 135](../../../apps/web/src/pages/specialty/palliative.tsx#L135)) — accepts input, default value sensible, persists after refresh
- [ ] **Patient ID** (`TextInput`, [line 141](../../../apps/web/src/pages/specialty/palliative.tsx#L141)) — accepts input, default value sensible, persists after refresh
- [ ] **Pain Score (0-10)** (`NumberInput`, [line 142](../../../apps/web/src/pages/specialty/palliative.tsx#L142)) — accepts input, default value sensible, persists after refresh
- [ ] **WHO Ladder Step (1-3)** (`NumberInput`, [line 143](../../../apps/web/src/pages/specialty/palliative.tsx#L143)) — accepts input, default value sensible, persists after refresh
- [ ] **Opioid Dose (Morphine Eq mg)** (`NumberInput`, [line 144](../../../apps/web/src/pages/specialty/palliative.tsx#L144)) — accepts input, default value sensible, persists after refresh
- [ ] **Breakthrough Doses** (`NumberInput`, [line 145](../../../apps/web/src/pages/specialty/palliative.tsx#L145)) — accepts input, default value sensible, persists after refresh
- [ ] **Body Receipt Number** (`TextInput`, [line 151](../../../apps/web/src/pages/specialty/palliative.tsx#L151)) — accepts input, default value sensible, persists after refresh
- [ ] **Deceased Name** (`TextInput`, [line 152](../../../apps/web/src/pages/specialty/palliative.tsx#L152)) — accepts input, default value sensible, persists after refresh
- [ ] **MLC Case** (`Switch`, [line 153](../../../apps/web/src/pages/specialty/palliative.tsx#L153)) — accepts input, default value sensible, persists after refresh
- [ ] **MLC Case ID** (`TextInput`, [line 154](../../../apps/web/src/pages/specialty/palliative.tsx#L154)) — accepts input, default value sensible, persists after refresh
- [ ] **Cold Storage Slot** (`TextInput`, [line 155](../../../apps/web/src/pages/specialty/palliative.tsx#L155)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 6, `<ActionIcon>`: 1, `<Menu.Item>`: 0)

- [ ] **<button @ line 108>** ([line 108](../../../apps/web/src/pages/specialty/palliative.tsx#L108)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 108>** ([line 108](../../../apps/web/src/pages/specialty/palliative.tsx#L108)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 109>** ([line 109](../../../apps/web/src/pages/specialty/palliative.tsx#L109)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 109>** ([line 109](../../../apps/web/src/pages/specialty/palliative.tsx#L109)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 110>** ([line 110](../../../apps/web/src/pages/specialty/palliative.tsx#L110)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 110>** ([line 110](../../../apps/web/src/pages/specialty/palliative.tsx#L110)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 136>** ([line 136](../../../apps/web/src/pages/specialty/palliative.tsx#L136)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 136>** ([line 136](../../../apps/web/src/pages/specialty/palliative.tsx#L136)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 146>** ([line 146](../../../apps/web/src/pages/specialty/palliative.tsx#L146)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 146>** ([line 146](../../../apps/web/src/pages/specialty/palliative.tsx#L146)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 156>** ([line 156](../../../apps/web/src/pages/specialty/palliative.tsx#L156)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 156>** ([line 156](../../../apps/web/src/pages/specialty/palliative.tsx#L156)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 70>** ([line 70](../../../apps/web/src/pages/specialty/palliative.tsx#L70)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (8)

- [ ] `api.createDnrOrder` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createMortuaryRecord` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createPainAssessment` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listDnrOrders` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listMortuaryRecords` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listNuclearSources` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listPainAssessments` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.revokeDnrOrder` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._