# `admin/settings/FacilitiesSettings.tsx` walkthrough

_Source: [`apps/web/src/pages/admin/settings/FacilitiesSettings.tsx`](../../../apps/web/src/pages/admin/settings/FacilitiesSettings.tsx) (551 lines). Guard: `—`. API methods: 4. useForm: 0. Tables: 1. Modals: 1._

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

### `<Table>` @ line 515
  - [ ] Header **Code** column shows correct value for at least one row
  - [ ] Header **Name** column shows correct value for at least one row
  - [ ] Header **Type** column shows correct value for at least one row
  - [ ] Header **City** column shows correct value for at least one row
  - [ ] Header **Beds** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

## Modals / Drawers

### Modal — _<modal @ line 237>_ @ [line 237](../../../apps/web/src/pages/admin/settings/FacilitiesSettings.tsx#L237)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

## Form inputs (13)

- [ ] **Code** (`TextInput`, [line 246](../../../apps/web/src/pages/admin/settings/FacilitiesSettings.tsx#L246)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 253](../../../apps/web/src/pages/admin/settings/FacilitiesSettings.tsx#L253)) — accepts input, default value sensible, persists after refresh
- [ ] **Facility Type** (`Select`, [line 263](../../../apps/web/src/pages/admin/settings/FacilitiesSettings.tsx#L263)) — accepts input, default value sensible, persists after refresh
- [ ] **Parent Facility** (`Select`, [line 271](../../../apps/web/src/pages/admin/settings/FacilitiesSettings.tsx#L271)) — accepts input, default value sensible, persists after refresh
- [ ] **Address** (`TextInput`, [line 287](../../../apps/web/src/pages/admin/settings/FacilitiesSettings.tsx#L287)) — accepts input, default value sensible, persists after refresh
- [ ] **City** (`TextInput`, [line 295](../../../apps/web/src/pages/admin/settings/FacilitiesSettings.tsx#L295)) — accepts input, default value sensible, persists after refresh
- [ ] **Bed Count** (`NumberInput`, [line 301](../../../apps/web/src/pages/admin/settings/FacilitiesSettings.tsx#L301)) — accepts input, default value sensible, persists after refresh
- [ ] **Phone** (`TextInput`, [line 311](../../../apps/web/src/pages/admin/settings/FacilitiesSettings.tsx#L311)) — accepts input, default value sensible, persists after refresh
- [ ] **Email** (`TextInput`, [line 317](../../../apps/web/src/pages/admin/settings/FacilitiesSettings.tsx#L317)) — accepts input, default value sensible, persists after refresh
- [ ] **Billing** (`Switch`, [line 329](../../../apps/web/src/pages/admin/settings/FacilitiesSettings.tsx#L329)) — accepts input, default value sensible, persists after refresh
- [ ] **Pharmacy** (`Switch`, [line 336](../../../apps/web/src/pages/admin/settings/FacilitiesSettings.tsx#L336)) — accepts input, default value sensible, persists after refresh
- [ ] **Lab** (`Switch`, [line 343](../../../apps/web/src/pages/admin/settings/FacilitiesSettings.tsx#L343)) — accepts input, default value sensible, persists after refresh
- [ ] **HR** (`Switch`, [line 350](../../../apps/web/src/pages/admin/settings/FacilitiesSettings.tsx#L350)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 3, `<ActionIcon>`: 2, `<Menu.Item>`: 0)

- [ ] **Cancel** ([line 360](../../../apps/web/src/pages/admin/settings/FacilitiesSettings.tsx#L360)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 360](../../../apps/web/src/pages/admin/settings/FacilitiesSettings.tsx#L360)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 363>** ([line 363](../../../apps/web/src/pages/admin/settings/FacilitiesSettings.tsx#L363)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 363>** ([line 363](../../../apps/web/src/pages/admin/settings/FacilitiesSettings.tsx#L363)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 506>** ([line 506](../../../apps/web/src/pages/admin/settings/FacilitiesSettings.tsx#L506)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 506>** ([line 506](../../../apps/web/src/pages/admin/settings/FacilitiesSettings.tsx#L506)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 478>** ([line 478](../../../apps/web/src/pages/admin/settings/FacilitiesSettings.tsx#L478)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 486>** ([line 486](../../../apps/web/src/pages/admin/settings/FacilitiesSettings.tsx#L486)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (4)

- [ ] `api.createFacility` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.deleteFacility` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listFacilities` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateFacility` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._