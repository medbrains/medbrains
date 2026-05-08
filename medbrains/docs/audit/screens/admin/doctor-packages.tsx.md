# `admin/doctor-packages.tsx` walkthrough

_Source: [`apps/web/src/pages/admin/doctor-packages.tsx`](../../../apps/web/src/pages/admin/doctor-packages.tsx) (328 lines). Guard: `"admin.doctor_packages.list"`. API methods: 5. useForm: 0. Tables: 1. Modals: 2._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `"admin.doctor_packages.list"` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tables / lists

### `<Table>` @ line 84
  - [ ] Header **Code** column shows correct value for at least one row
  - [ ] Header **Name** column shows correct value for at least one row
  - [ ] Header **Price** column shows correct value for at least one row
  - [ ] Header **Validity** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

## Modals / Drawers

### Drawer — _New doctor package_ @ [line 170](../../../apps/web/src/pages/admin/doctor-packages.tsx#L170)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _<drawer @ line 239>_ @ [line 239](../../../apps/web/src/pages/admin/doctor-packages.tsx#L239)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (8)

- [ ] **Show inactive** (`Switch`, [line 70](../../../apps/web/src/pages/admin/doctor-packages.tsx#L70)) — accepts input, default value sensible, persists after refresh
- [ ] **Code** (`TextInput`, [line 172](../../../apps/web/src/pages/admin/doctor-packages.tsx#L172)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 173](../../../apps/web/src/pages/admin/doctor-packages.tsx#L173)) — accepts input, default value sensible, persists after refresh
- [ ] **Total price (₹)** (`NumberInput`, [line 174](../../../apps/web/src/pages/admin/doctor-packages.tsx#L174)) — accepts input, default value sensible, persists after refresh
- [ ] **Validity (days)** (`NumberInput`, [line 181](../../../apps/web/src/pages/admin/doctor-packages.tsx#L181)) — accepts input, default value sensible, persists after refresh
- [ ] **Type** (`Select`, [line 250](../../../apps/web/src/pages/admin/doctor-packages.tsx#L250)) — accepts input, default value sensible, persists after refresh
- [ ] **Included quantity** (`NumberInput`, [line 262](../../../apps/web/src/pages/admin/doctor-packages.tsx#L262)) — accepts input, default value sensible, persists after refresh
- [ ] **Notes** (`Textarea`, [line 269](../../../apps/web/src/pages/admin/doctor-packages.tsx#L269)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 4, `<ActionIcon>`: 2, `<Menu.Item>`: 0)

- [ ] **<button @ line 76>** ([line 76](../../../apps/web/src/pages/admin/doctor-packages.tsx#L76)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 76>** ([line 76](../../../apps/web/src/pages/admin/doctor-packages.tsx#L76)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 190](../../../apps/web/src/pages/admin/doctor-packages.tsx#L190)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 190](../../../apps/web/src/pages/admin/doctor-packages.tsx#L190)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 191>** ([line 191](../../../apps/web/src/pages/admin/doctor-packages.tsx#L191)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 191>** ([line 191](../../../apps/web/src/pages/admin/doctor-packages.tsx#L191)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 279>** ([line 279](../../../apps/web/src/pages/admin/doctor-packages.tsx#L279)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 279>** ([line 279](../../../apps/web/src/pages/admin/doctor-packages.tsx#L279)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 116>** ([line 116](../../../apps/web/src/pages/admin/doctor-packages.tsx#L116)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 307>** ([line 307](../../../apps/web/src/pages/admin/doctor-packages.tsx#L307)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (5)

- [ ] `api.adminAddInclusion` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.adminCreateDoctorPackage` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.adminGetDoctorPackage` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.adminListDoctorPackages` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.adminRemoveInclusion` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._