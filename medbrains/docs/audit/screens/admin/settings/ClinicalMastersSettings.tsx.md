# `admin/settings/ClinicalMastersSettings.tsx` walkthrough

_Source: [`apps/web/src/pages/admin/settings/ClinicalMastersSettings.tsx`](../../../apps/web/src/pages/admin/settings/ClinicalMastersSettings.tsx) (904 lines). Guard: `—`. API methods: 16. useForm: 0. Tables: 2. Modals: 4._

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

## Tabs

- [ ] Tab **}>
          Religions** (`religions`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
          Religions** (`religions`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
          Religions** (`religions`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
          Occupations** (`occupations`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
          Occupations** (`occupations`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
          Occupations** (`occupations`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
          Relations** (`relations`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
          Relations** (`relations`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
          Relations** (`relations`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
          Insurance Providers** (`insurance`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
          Insurance Providers** (`insurance`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
          Insurance Providers** (`insurance`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### `<Table>` @ line 299
  - [ ] Header **Code** column shows correct value for at least one row
  - [ ] Header **Name** column shows correct value for at least one row
  - [ ] Header **Order** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Header **Source** column shows correct value for at least one row
  - [ ] Header **}** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 712
  - [ ] Header **Code** column shows correct value for at least one row
  - [ ] Header **Name** column shows correct value for at least one row
  - [ ] Header **Type** column shows correct value for at least one row
  - [ ] Header **Phone** column shows correct value for at least one row
  - [ ] Header **Email** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Header **}** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

## Modals / Drawers

### Modal — _<modal @ line 156>_ @ [line 156](../../../apps/web/src/pages/admin/settings/ClinicalMastersSettings.tsx#L156)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Modal — _<modal @ line 399>_ @ [line 399](../../../apps/web/src/pages/admin/settings/ClinicalMastersSettings.tsx#L399)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Modal — _<modal @ line 574>_ @ [line 574](../../../apps/web/src/pages/admin/settings/ClinicalMastersSettings.tsx#L574)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Modal — _<modal @ line 813>_ @ [line 813](../../../apps/web/src/pages/admin/settings/ClinicalMastersSettings.tsx#L813)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

## Form inputs (9)

- [ ] **Code** (`TextInput`, [line 164](../../../apps/web/src/pages/admin/settings/ClinicalMastersSettings.tsx#L164)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 171](../../../apps/web/src/pages/admin/settings/ClinicalMastersSettings.tsx#L171)) — accepts input, default value sensible, persists after refresh
- [ ] **Sort Order** (`NumberInput`, [line 178](../../../apps/web/src/pages/admin/settings/ClinicalMastersSettings.tsx#L178)) — accepts input, default value sensible, persists after refresh
- [ ] **Code** (`TextInput`, [line 582](../../../apps/web/src/pages/admin/settings/ClinicalMastersSettings.tsx#L582)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 589](../../../apps/web/src/pages/admin/settings/ClinicalMastersSettings.tsx#L589)) — accepts input, default value sensible, persists after refresh
- [ ] **Provider Type** (`Select`, [line 596](../../../apps/web/src/pages/admin/settings/ClinicalMastersSettings.tsx#L596)) — accepts input, default value sensible, persists after refresh
- [ ] **Contact Phone** (`TextInput`, [line 604](../../../apps/web/src/pages/admin/settings/ClinicalMastersSettings.tsx#L604)) — accepts input, default value sensible, persists after refresh
- [ ] **Contact Email** (`TextInput`, [line 610](../../../apps/web/src/pages/admin/settings/ClinicalMastersSettings.tsx#L610)) — accepts input, default value sensible, persists after refresh
- [ ] **Website** (`TextInput`, [line 616](../../../apps/web/src/pages/admin/settings/ClinicalMastersSettings.tsx#L616)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 10, `<ActionIcon>`: 4, `<Menu.Item>`: 0)

- [ ] **Cancel** ([line 187](../../../apps/web/src/pages/admin/settings/ClinicalMastersSettings.tsx#L187)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 187](../../../apps/web/src/pages/admin/settings/ClinicalMastersSettings.tsx#L187)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 190>** ([line 190](../../../apps/web/src/pages/admin/settings/ClinicalMastersSettings.tsx#L190)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 190>** ([line 190](../../../apps/web/src/pages/admin/settings/ClinicalMastersSettings.tsx#L190)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 289>** ([line 289](../../../apps/web/src/pages/admin/settings/ClinicalMastersSettings.tsx#L289)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 289>** ([line 289](../../../apps/web/src/pages/admin/settings/ClinicalMastersSettings.tsx#L289)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **setDeleteTarget(null)}>               Cancel** ([line 414](../../../apps/web/src/pages/admin/settings/ClinicalMastersSettings.tsx#L414)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **setDeleteTarget(null)}>               Cancel** ([line 414](../../../apps/web/src/pages/admin/settings/ClinicalMastersSettings.tsx#L414)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 417>** ([line 417](../../../apps/web/src/pages/admin/settings/ClinicalMastersSettings.tsx#L417)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 417>** ([line 417](../../../apps/web/src/pages/admin/settings/ClinicalMastersSettings.tsx#L417)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 623](../../../apps/web/src/pages/admin/settings/ClinicalMastersSettings.tsx#L623)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 623](../../../apps/web/src/pages/admin/settings/ClinicalMastersSettings.tsx#L623)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 626>** ([line 626](../../../apps/web/src/pages/admin/settings/ClinicalMastersSettings.tsx#L626)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 626>** ([line 626](../../../apps/web/src/pages/admin/settings/ClinicalMastersSettings.tsx#L626)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 699>** ([line 699](../../../apps/web/src/pages/admin/settings/ClinicalMastersSettings.tsx#L699)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 699>** ([line 699](../../../apps/web/src/pages/admin/settings/ClinicalMastersSettings.tsx#L699)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **setDeleteTarget(null)}>               Cancel** ([line 828](../../../apps/web/src/pages/admin/settings/ClinicalMastersSettings.tsx#L828)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **setDeleteTarget(null)}>               Cancel** ([line 828](../../../apps/web/src/pages/admin/settings/ClinicalMastersSettings.tsx#L828)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 831>** ([line 831](../../../apps/web/src/pages/admin/settings/ClinicalMastersSettings.tsx#L831)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 831>** ([line 831](../../../apps/web/src/pages/admin/settings/ClinicalMastersSettings.tsx#L831)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 348>** ([line 348](../../../apps/web/src/pages/admin/settings/ClinicalMastersSettings.tsx#L348)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 358>** ([line 358](../../../apps/web/src/pages/admin/settings/ClinicalMastersSettings.tsx#L358)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 768>** ([line 768](../../../apps/web/src/pages/admin/settings/ClinicalMastersSettings.tsx#L768)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 781>** ([line 781](../../../apps/web/src/pages/admin/settings/ClinicalMastersSettings.tsx#L781)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (16)

- [ ] `api.adminCreateInsuranceProvider` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.adminCreateOccupation` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.adminCreateRelation` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.adminCreateReligion` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.adminDeleteInsuranceProvider` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.adminDeleteOccupation` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.adminDeleteRelation` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.adminDeleteReligion` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.adminListInsuranceProviders` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.adminListOccupations` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.adminListRelations` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.adminListReligions` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.adminUpdateInsuranceProvider` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.adminUpdateOccupation` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.adminUpdateRelation` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.adminUpdateReligion` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._