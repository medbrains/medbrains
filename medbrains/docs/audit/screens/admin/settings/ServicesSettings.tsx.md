# `admin/settings/ServicesSettings.tsx` walkthrough

_Source: [`apps/web/src/pages/admin/settings/ServicesSettings.tsx`](../../../apps/web/src/pages/admin/settings/ServicesSettings.tsx) (488 lines). Guard: `—`. API methods: 5. useForm: 0. Tables: 1. Modals: 2._

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

### `<Table>` @ line 363
  - [ ] Header **Code** column shows correct value for at least one row
  - [ ] Header **Name** column shows correct value for at least one row
  - [ ] Header **Type** column shows correct value for at least one row
  - [ ] Header **Price** column shows correct value for at least one row
  - [ ] Header **Department** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

## Modals / Drawers

### Modal — _<modal @ line 193>_ @ [line 193](../../../apps/web/src/pages/admin/settings/ServicesSettings.tsx#L193)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Modal — _<modal @ line 457>_ @ [line 457](../../../apps/web/src/pages/admin/settings/ServicesSettings.tsx#L457)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

## Form inputs (6)

- [ ] **Code** (`TextInput`, [line 201](../../../apps/web/src/pages/admin/settings/ServicesSettings.tsx#L201)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 208](../../../apps/web/src/pages/admin/settings/ServicesSettings.tsx#L208)) — accepts input, default value sensible, persists after refresh
- [ ] **Service Type** (`Select`, [line 215](../../../apps/web/src/pages/admin/settings/ServicesSettings.tsx#L215)) — accepts input, default value sensible, persists after refresh
- [ ] **Base Price** (`NumberInput`, [line 225](../../../apps/web/src/pages/admin/settings/ServicesSettings.tsx#L225)) — accepts input, default value sensible, persists after refresh
- [ ] **Department** (`Select`, [line 236](../../../apps/web/src/pages/admin/settings/ServicesSettings.tsx#L236)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`Textarea`, [line 245](../../../apps/web/src/pages/admin/settings/ServicesSettings.tsx#L245)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 5, `<ActionIcon>`: 2, `<Menu.Item>`: 0)

- [ ] **Cancel** ([line 253](../../../apps/web/src/pages/admin/settings/ServicesSettings.tsx#L253)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 253](../../../apps/web/src/pages/admin/settings/ServicesSettings.tsx#L253)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 256>** ([line 256](../../../apps/web/src/pages/admin/settings/ServicesSettings.tsx#L256)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 256>** ([line 256](../../../apps/web/src/pages/admin/settings/ServicesSettings.tsx#L256)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 354>** ([line 354](../../../apps/web/src/pages/admin/settings/ServicesSettings.tsx#L354)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 354>** ([line 354](../../../apps/web/src/pages/admin/settings/ServicesSettings.tsx#L354)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **setDeleteTarget(null)}>               Cancel** ([line 472](../../../apps/web/src/pages/admin/settings/ServicesSettings.tsx#L472)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **setDeleteTarget(null)}>               Cancel** ([line 472](../../../apps/web/src/pages/admin/settings/ServicesSettings.tsx#L472)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Delete** ([line 475](../../../apps/web/src/pages/admin/settings/ServicesSettings.tsx#L475)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Delete** ([line 475](../../../apps/web/src/pages/admin/settings/ServicesSettings.tsx#L475)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 419>** ([line 419](../../../apps/web/src/pages/admin/settings/ServicesSettings.tsx#L419)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 427>** ([line 427](../../../apps/web/src/pages/admin/settings/ServicesSettings.tsx#L427)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (5)

- [ ] `api.createService` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.deleteService` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listDepartments` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listServices` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateService` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._