# `specialty/other.tsx` walkthrough

_Source: [`apps/web/src/pages/specialty/other.tsx`](../../../apps/web/src/pages/specialty/other.tsx) (172 lines). Guard: `P.SPECIALTY.OTHER.RECORDS_LIST`. API methods: 8. useForm: 0. Tables: 4. Modals: 4._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.SPECIALTY.OTHER.RECORDS_LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **Templates** (`templates`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Templates** (`templates`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Templates** (`templates`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Records** (`records`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Records** (`records`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Records** (`records`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Dialysis** (`dialysis`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Dialysis** (`dialysis`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Dialysis** (`dialysis`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **Chemotherapy** (`chemo`) — clicking activates the panel + loads its data without console error
- [ ] Tab **Chemotherapy** (`chemo`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **Chemotherapy** (`chemo`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### DataTable columns (24)
- [ ] Column **Specialty** (`specialty`) renders without `undefined` / `[object Object]`
- [ ] Column **Template** (`name`) renders without `undefined` / `[object Object]`
- [ ] Column **Code** (`code`) renders without `undefined` / `[object Object]`
- [ ] Column **Created** (`date`) renders without `undefined` / `[object Object]`
- [ ] Column **Specialty** (`specialty`) renders without `undefined` / `[object Object]`
- [ ] Column **Patient** (`patient_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Template** (`template`) renders without `undefined` / `[object Object]`
- [ ] Column **Date** (`date`) renders without `undefined` / `[object Object]`
- [ ] Column **Patient** (`patient_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Machine #** (`machine`) renders without `undefined` / `[object Object]`
- [ ] Column **Access** (`access`) renders without `undefined` / `[object Object]`
- [ ] Column **Pre (kg)** (`pre_weight`) renders without `undefined` / `[object Object]`
- [ ] Column **Post (kg)** (`post_weight`) renders without `undefined` / `[object Object]`
- [ ] Column **UF Goal/Achieved** (`uf`) renders without `undefined` / `[object Object]`
- [ ] Column **Kt/V** (`ktv`) renders without `undefined` / `[object Object]`
- [ ] Column **URR %** (`urr`) renders without `undefined` / `[object Object]`
- [ ] Column **Patient** (`patient_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Protocol** (`protocol`) renders without `undefined` / `[object Object]`
- [ ] Column **Cancer Type** (`cancer`) renders without `undefined` / `[object Object]`
- [ ] Column **Staging** (`staging`) renders without `undefined` / `[object Object]`
- [ ] Column **Cycle #** (`cycle`) renders without `undefined` / `[object Object]`
- [ ] Column **Toxicity** (`toxicity`) renders without `undefined` / `[object Object]`
- [ ] Column **RECIST** (`recist`) renders without `undefined` / `[object Object]`
- [ ] Column **Tumor Board** (`tumor_board`) renders without `undefined` / `[object Object]`

## Modals / Drawers

### Drawer — _New Specialty Template_ @ [line 130](../../../apps/web/src/pages/specialty/other.tsx#L130)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _New Specialty Record_ @ [line 139](../../../apps/web/src/pages/specialty/other.tsx#L139)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _New Dialysis Session_ @ [line 148](../../../apps/web/src/pages/specialty/other.tsx#L148)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _New Chemo Protocol_ @ [line 158](../../../apps/web/src/pages/specialty/other.tsx#L158)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (16)

- [ ] **Specialty** (`TextInput`, [line 132](../../../apps/web/src/pages/specialty/other.tsx#L132)) — accepts input, default value sensible, persists after refresh
- [ ] **Template Name** (`TextInput`, [line 133](../../../apps/web/src/pages/specialty/other.tsx#L133)) — accepts input, default value sensible, persists after refresh
- [ ] **Template Code** (`TextInput`, [line 134](../../../apps/web/src/pages/specialty/other.tsx#L134)) — accepts input, default value sensible, persists after refresh
- [ ] **Form Schema (JSON)** (`JsonInput`, [line 135](../../../apps/web/src/pages/specialty/other.tsx#L135)) — accepts input, default value sensible, persists after refresh
- [ ] **Specialty** (`TextInput`, [line 142](../../../apps/web/src/pages/specialty/other.tsx#L142)) — accepts input, default value sensible, persists after refresh
- [ ] **Template** (`Select`, [line 143](../../../apps/web/src/pages/specialty/other.tsx#L143)) — accepts input, default value sensible, persists after refresh
- [ ] **Form Data (JSON)** (`JsonInput`, [line 144](../../../apps/web/src/pages/specialty/other.tsx#L144)) — accepts input, default value sensible, persists after refresh
- [ ] **Machine #** (`TextInput`, [line 151](../../../apps/web/src/pages/specialty/other.tsx#L151)) — accepts input, default value sensible, persists after refresh
- [ ] **Access Type** (`TextInput`, [line 152](../../../apps/web/src/pages/specialty/other.tsx#L152)) — accepts input, default value sensible, persists after refresh
- [ ] **Pre Weight (kg)** (`NumberInput`, [line 153](../../../apps/web/src/pages/specialty/other.tsx#L153)) — accepts input, default value sensible, persists after refresh
- [ ] **UF Goal (ml)** (`NumberInput`, [line 154](../../../apps/web/src/pages/specialty/other.tsx#L154)) — accepts input, default value sensible, persists after refresh
- [ ] **Protocol Name** (`TextInput`, [line 161](../../../apps/web/src/pages/specialty/other.tsx#L161)) — accepts input, default value sensible, persists after refresh
- [ ] **Cancer Type** (`TextInput`, [line 162](../../../apps/web/src/pages/specialty/other.tsx#L162)) — accepts input, default value sensible, persists after refresh
- [ ] **Staging** (`TextInput`, [line 163](../../../apps/web/src/pages/specialty/other.tsx#L163)) — accepts input, default value sensible, persists after refresh
- [ ] **Cycle #** (`NumberInput`, [line 164](../../../apps/web/src/pages/specialty/other.tsx#L164)) — accepts input, default value sensible, persists after refresh
- [ ] **Tumor Board Reviewed** (`Switch`, [line 165](../../../apps/web/src/pages/specialty/other.tsx#L165)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 8, `<ActionIcon>`: 0, `<Menu.Item>`: 0)

- [ ] **<button @ line 107>** ([line 107](../../../apps/web/src/pages/specialty/other.tsx#L107)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 107>** ([line 107](../../../apps/web/src/pages/specialty/other.tsx#L107)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 108>** ([line 108](../../../apps/web/src/pages/specialty/other.tsx#L108)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 108>** ([line 108](../../../apps/web/src/pages/specialty/other.tsx#L108)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 122>** ([line 122](../../../apps/web/src/pages/specialty/other.tsx#L122)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 122>** ([line 122](../../../apps/web/src/pages/specialty/other.tsx#L122)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 126>** ([line 126](../../../apps/web/src/pages/specialty/other.tsx#L126)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 126>** ([line 126](../../../apps/web/src/pages/specialty/other.tsx#L126)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 136>** ([line 136](../../../apps/web/src/pages/specialty/other.tsx#L136)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 136>** ([line 136](../../../apps/web/src/pages/specialty/other.tsx#L136)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 145>** ([line 145](../../../apps/web/src/pages/specialty/other.tsx#L145)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 145>** ([line 145](../../../apps/web/src/pages/specialty/other.tsx#L145)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 155>** ([line 155](../../../apps/web/src/pages/specialty/other.tsx#L155)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 155>** ([line 155](../../../apps/web/src/pages/specialty/other.tsx#L155)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 166>** ([line 166](../../../apps/web/src/pages/specialty/other.tsx#L166)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 166>** ([line 166](../../../apps/web/src/pages/specialty/other.tsx#L166)) — failure path works: validation/server error is shown clearly and does not leave stale loading state

## API methods used (8)

- [ ] `api.createChemoProtocol` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createDialysisSession` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createSpecialtyRecord` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createSpecialtyTemplate` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listChemoProtocols` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listDialysisSessions` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listSpecialtyRecords` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listSpecialtyTemplates` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._