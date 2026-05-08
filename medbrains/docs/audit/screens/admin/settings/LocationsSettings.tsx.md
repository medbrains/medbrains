# `admin/settings/LocationsSettings.tsx` walkthrough

_Source: [`apps/web/src/pages/admin/settings/LocationsSettings.tsx`](../../../apps/web/src/pages/admin/settings/LocationsSettings.tsx) (430 lines). Guard: `—`. API methods: 4. useForm: 0. Tables: 1. Modals: 2._

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

### `<Table>` @ line 394
  - [ ] Header **Code** column shows correct value for at least one row
  - [ ] Header **Name** column shows correct value for at least one row
  - [ ] Header **Level** column shows correct value for at least one row
  - [ ] Header **Parent** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Header **Actions** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

## Modals / Drawers

### Modal — _<modal @ line 174>_ @ [line 174](../../../apps/web/src/pages/admin/settings/LocationsSettings.tsx#L174)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Modal — _Delete Location_ @ [line 257](../../../apps/web/src/pages/admin/settings/LocationsSettings.tsx#L257)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

## Form inputs (4)

- [ ] **Code** (`TextInput`, [line 182](../../../apps/web/src/pages/admin/settings/LocationsSettings.tsx#L182)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 190](../../../apps/web/src/pages/admin/settings/LocationsSettings.tsx#L190)) — accepts input, default value sensible, persists after refresh
- [ ] **Level** (`Select`, [line 197](../../../apps/web/src/pages/admin/settings/LocationsSettings.tsx#L197)) — accepts input, default value sensible, persists after refresh
- [ ] **Parent Location** (`Select`, [line 204](../../../apps/web/src/pages/admin/settings/LocationsSettings.tsx#L204)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 5, `<ActionIcon>`: 2, `<Menu.Item>`: 0)

- [ ] **Cancel** ([line 220](../../../apps/web/src/pages/admin/settings/LocationsSettings.tsx#L220)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 220](../../../apps/web/src/pages/admin/settings/LocationsSettings.tsx#L220)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 223>** ([line 223](../../../apps/web/src/pages/admin/settings/LocationsSettings.tsx#L223)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 223>** ([line 223](../../../apps/web/src/pages/admin/settings/LocationsSettings.tsx#L223)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 267](../../../apps/web/src/pages/admin/settings/LocationsSettings.tsx#L267)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 267](../../../apps/web/src/pages/admin/settings/LocationsSettings.tsx#L267)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Delete** ([line 270](../../../apps/web/src/pages/admin/settings/LocationsSettings.tsx#L270)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Delete** ([line 270](../../../apps/web/src/pages/admin/settings/LocationsSettings.tsx#L270)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 384>** ([line 384](../../../apps/web/src/pages/admin/settings/LocationsSettings.tsx#L384)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 384>** ([line 384](../../../apps/web/src/pages/admin/settings/LocationsSettings.tsx#L384)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 367>** ([line 367](../../../apps/web/src/pages/admin/settings/LocationsSettings.tsx#L367)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 370>** ([line 370](../../../apps/web/src/pages/admin/settings/LocationsSettings.tsx#L370)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (4)

- [ ] `api.createLocation` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.deleteLocation` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listLocations` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateLocation` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._