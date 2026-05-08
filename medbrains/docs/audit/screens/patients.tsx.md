# `patients.tsx` walkthrough

_Source: [`apps/web/src/pages/patients.tsx`](../../../apps/web/src/pages/patients.tsx) (409 lines). Guard: `P.PATIENTS.LIST`. API methods: 3. useForm: 0. Tables: 1. Modals: 2._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.PATIENTS.LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tables / lists

### DataTable columns (7)
- [ ] Column **UHID** (`uhid`) renders without `undefined` / `[object Object]`
- [ ] Column **Name** (`name`) renders without `undefined` / `[object Object]`
- [ ] Column **Phone** (`phone`) renders without `undefined` / `[object Object]`
- [ ] Column **Gender** (`gender`) renders without `undefined` / `[object Object]`
- [ ] Column **Blood Group** (`blood_group`) renders without `undefined` / `[object Object]`
- [ ] Column **Category** (`category`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`registration_type`) renders without `undefined` / `[object Object]`

### `<Table>` @ line 369
  - [ ] Header **UHID** column shows correct value for at least one row
  - [ ] Header **Name** column shows correct value for at least one row
  - [ ] Header **Phone** column shows correct value for at least one row
  - [ ] Header **Score** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

## Modals / Drawers

### Modal — _<modal @ line 365>_ @ [line 365](../../../apps/web/src/pages/patients.tsx#L365)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Drawer — _<drawer @ line 347>_ @ [line 347](../../../apps/web/src/pages/patients.tsx#L347)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (1)

- [ ] **<TextInput @ line 335>** (`TextInput`, [line 335](../../../apps/web/src/pages/patients.tsx#L335)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 4, `<ActionIcon>`: 2, `<Menu.Item>`: 0)

- [ ] **<button @ line 294>** ([line 294](../../../apps/web/src/pages/patients.tsx#L294)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 294>** ([line 294](../../../apps/web/src/pages/patients.tsx#L294)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 301>** ([line 301](../../../apps/web/src/pages/patients.tsx#L301)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 301>** ([line 301](../../../apps/web/src/pages/patients.tsx#L301)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Create Anyway** ([line 400](../../../apps/web/src/pages/patients.tsx#L400)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Create Anyway** ([line 400](../../../apps/web/src/pages/patients.tsx#L400)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Create Anyway** ([line 401](../../../apps/web/src/pages/patients.tsx#L401)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Create Anyway** ([line 401](../../../apps/web/src/pages/patients.tsx#L401)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 273>** ([line 273](../../../apps/web/src/pages/patients.tsx#L273)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 391>** ([line 391](../../../apps/web/src/pages/patients.tsx#L391)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (3)

- [ ] `api.createPatient` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listPatients` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.matchPatients` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._