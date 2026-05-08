# `admin/settings/DepartmentsSettings.tsx` walkthrough

_Source: [`apps/web/src/pages/admin/settings/DepartmentsSettings.tsx`](../../../apps/web/src/pages/admin/settings/DepartmentsSettings.tsx) (638 lines). Guard: `—`. API methods: 4. useForm: 0. Tables: 1. Modals: 2._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `(none)` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

### ⚠ Static analysis flags
- `no useRequirePermission guard`

## Tables / lists

### `<Table>` @ line 595
  - [ ] Header **Code** column shows correct value for at least one row
  - [ ] Header **Name** column shows correct value for at least one row
  - [ ] Header **Type** column shows correct value for at least one row
  - [ ] Header **Working Hours** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

## Modals / Drawers

### Modal — _<modal @ line 266>_ @ [line 266](../../../apps/web/src/pages/admin/settings/DepartmentsSettings.tsx#L266)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Modal — _Delete Department_ @ [line 431](../../../apps/web/src/pages/admin/settings/DepartmentsSettings.tsx#L431)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

## Form inputs (8)

- [ ] **Code** (`TextInput`, [line 274](../../../apps/web/src/pages/admin/settings/DepartmentsSettings.tsx#L274)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 282](../../../apps/web/src/pages/admin/settings/DepartmentsSettings.tsx#L282)) — accepts input, default value sensible, persists after refresh
- [ ] **Department Type** (`Select`, [line 289](../../../apps/web/src/pages/admin/settings/DepartmentsSettings.tsx#L289)) — accepts input, default value sensible, persists after refresh
- [ ] **Parent Department** (`Select`, [line 296](../../../apps/web/src/pages/admin/settings/DepartmentsSettings.tsx#L296)) — accepts input, default value sensible, persists after refresh
- [ ] **AM Start** (`TextInput`, [line 344](../../../apps/web/src/pages/admin/settings/DepartmentsSettings.tsx#L344)) — accepts input, default value sensible, persists after refresh
- [ ] **AM End** (`TextInput`, [line 355](../../../apps/web/src/pages/admin/settings/DepartmentsSettings.tsx#L355)) — accepts input, default value sensible, persists after refresh
- [ ] **PM Start** (`TextInput`, [line 366](../../../apps/web/src/pages/admin/settings/DepartmentsSettings.tsx#L366)) — accepts input, default value sensible, persists after refresh
- [ ] **PM End** (`TextInput`, [line 377](../../../apps/web/src/pages/admin/settings/DepartmentsSettings.tsx#L377)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 6, `<ActionIcon>`: 2, `<Menu.Item>`: 0)

- [ ] **<button @ line 329>** ([line 329](../../../apps/web/src/pages/admin/settings/DepartmentsSettings.tsx#L329)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 329>** ([line 329](../../../apps/web/src/pages/admin/settings/DepartmentsSettings.tsx#L329)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 394](../../../apps/web/src/pages/admin/settings/DepartmentsSettings.tsx#L394)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 394](../../../apps/web/src/pages/admin/settings/DepartmentsSettings.tsx#L394)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 397>** ([line 397](../../../apps/web/src/pages/admin/settings/DepartmentsSettings.tsx#L397)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 397>** ([line 397](../../../apps/web/src/pages/admin/settings/DepartmentsSettings.tsx#L397)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 441](../../../apps/web/src/pages/admin/settings/DepartmentsSettings.tsx#L441)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 441](../../../apps/web/src/pages/admin/settings/DepartmentsSettings.tsx#L441)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Delete** ([line 444](../../../apps/web/src/pages/admin/settings/DepartmentsSettings.tsx#L444)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Delete** ([line 444](../../../apps/web/src/pages/admin/settings/DepartmentsSettings.tsx#L444)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 586>** ([line 586](../../../apps/web/src/pages/admin/settings/DepartmentsSettings.tsx#L586)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 586>** ([line 586](../../../apps/web/src/pages/admin/settings/DepartmentsSettings.tsx#L586)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 559>** ([line 559](../../../apps/web/src/pages/admin/settings/DepartmentsSettings.tsx#L559)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 567>** ([line 567](../../../apps/web/src/pages/admin/settings/DepartmentsSettings.tsx#L567)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (4)

- [ ] `api.createDepartment` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.deleteDepartment` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listDepartments` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateDepartment` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._