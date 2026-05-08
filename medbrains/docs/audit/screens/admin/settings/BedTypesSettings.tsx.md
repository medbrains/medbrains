# `admin/settings/BedTypesSettings.tsx` walkthrough

_Source: [`apps/web/src/pages/admin/settings/BedTypesSettings.tsx`](../../../apps/web/src/pages/admin/settings/BedTypesSettings.tsx) (418 lines). Guard: `—`. API methods: 4. useForm: 0. Tables: 1. Modals: 2._

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

### `<Table>` @ line 250
  - [ ] Header **Code** column shows correct value for at least one row
  - [ ] Header **Name** column shows correct value for at least one row
  - [ ] Header **Daily Rate** column shows correct value for at least one row
  - [ ] Header **Description** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Header **Actions** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

## Modals / Drawers

### Modal — _<modal @ line 325>_ @ [line 325](../../../apps/web/src/pages/admin/settings/BedTypesSettings.tsx#L325)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Modal — _<modal @ line 382>_ @ [line 382](../../../apps/web/src/pages/admin/settings/BedTypesSettings.tsx#L382)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

## Form inputs (4)

- [ ] **Code** (`TextInput`, [line 332](../../../apps/web/src/pages/admin/settings/BedTypesSettings.tsx#L332)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 341](../../../apps/web/src/pages/admin/settings/BedTypesSettings.tsx#L341)) — accepts input, default value sensible, persists after refresh
- [ ] **Daily Rate** (`NumberInput`, [line 348](../../../apps/web/src/pages/admin/settings/BedTypesSettings.tsx#L348)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`Textarea`, [line 360](../../../apps/web/src/pages/admin/settings/BedTypesSettings.tsx#L360)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 5, `<ActionIcon>`: 2, `<Menu.Item>`: 0)

- [ ] **<button @ line 241>** ([line 241](../../../apps/web/src/pages/admin/settings/BedTypesSettings.tsx#L241)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 241>** ([line 241](../../../apps/web/src/pages/admin/settings/BedTypesSettings.tsx#L241)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 370](../../../apps/web/src/pages/admin/settings/BedTypesSettings.tsx#L370)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 370](../../../apps/web/src/pages/admin/settings/BedTypesSettings.tsx#L370)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 373>** ([line 373](../../../apps/web/src/pages/admin/settings/BedTypesSettings.tsx#L373)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 373>** ([line 373](../../../apps/web/src/pages/admin/settings/BedTypesSettings.tsx#L373)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **setDeleteConfirmId(null)}             >               Cancel** ([line 395](../../../apps/web/src/pages/admin/settings/BedTypesSettings.tsx#L395)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **setDeleteConfirmId(null)}             >               Cancel** ([line 395](../../../apps/web/src/pages/admin/settings/BedTypesSettings.tsx#L395)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 401>** ([line 401](../../../apps/web/src/pages/admin/settings/BedTypesSettings.tsx#L401)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 401>** ([line 401](../../../apps/web/src/pages/admin/settings/BedTypesSettings.tsx#L401)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 291>** ([line 291](../../../apps/web/src/pages/admin/settings/BedTypesSettings.tsx#L291)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 301>** ([line 301](../../../apps/web/src/pages/admin/settings/BedTypesSettings.tsx#L301)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (4)

- [ ] `api.createBedType` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.deleteBedType` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listBedTypes` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateBedType` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._