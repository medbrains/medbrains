# `admin/settings/BillingTaxSettings.tsx` walkthrough

_Source: [`apps/web/src/pages/admin/settings/BillingTaxSettings.tsx`](../../../apps/web/src/pages/admin/settings/BillingTaxSettings.tsx) (756 lines). Guard: `—`. API methods: 8. useForm: 0. Tables: 2. Modals: 2._

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

### `<Table>` @ line 663
  - [ ] Header **Code** column shows correct value for at least one row
  - [ ] Header **Name** column shows correct value for at least one row
  - [ ] Header **Rate** column shows correct value for at least one row
  - [ ] Header **Applicability** column shows correct value for at least one row
  - [ ] Header **Description** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Header **Code** column shows correct value for at least one row
  - [ ] Header **Name** column shows correct value for at least one row
  - [ ] Header **Default** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 714
  - [ ] Header **Code** column shows correct value for at least one row
  - [ ] Header **Name** column shows correct value for at least one row
  - [ ] Header **Default** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

## Modals / Drawers

### Modal — _<modal @ line 207>_ @ [line 207](../../../apps/web/src/pages/admin/settings/BillingTaxSettings.tsx#L207)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Modal — _<modal @ line 375>_ @ [line 375](../../../apps/web/src/pages/admin/settings/BillingTaxSettings.tsx#L375)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

## Form inputs (8)

- [ ] **Code** (`TextInput`, [line 216](../../../apps/web/src/pages/admin/settings/BillingTaxSettings.tsx#L216)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 223](../../../apps/web/src/pages/admin/settings/BillingTaxSettings.tsx#L223)) — accepts input, default value sensible, persists after refresh
- [ ] **Rate (%)** (`NumberInput`, [line 233](../../../apps/web/src/pages/admin/settings/BillingTaxSettings.tsx#L233)) — accepts input, default value sensible, persists after refresh
- [ ] **Applicability** (`Select`, [line 244](../../../apps/web/src/pages/admin/settings/BillingTaxSettings.tsx#L244)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`Textarea`, [line 254](../../../apps/web/src/pages/admin/settings/BillingTaxSettings.tsx#L254)) — accepts input, default value sensible, persists after refresh
- [ ] **Code** (`TextInput`, [line 383](../../../apps/web/src/pages/admin/settings/BillingTaxSettings.tsx#L383)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 390](../../../apps/web/src/pages/admin/settings/BillingTaxSettings.tsx#L390)) — accepts input, default value sensible, persists after refresh
- [ ] **Default payment method** (`Switch`, [line 397](../../../apps/web/src/pages/admin/settings/BillingTaxSettings.tsx#L397)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 6, `<ActionIcon>`: 4, `<Menu.Item>`: 0)

- [ ] **Cancel** ([line 265](../../../apps/web/src/pages/admin/settings/BillingTaxSettings.tsx#L265)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 265](../../../apps/web/src/pages/admin/settings/BillingTaxSettings.tsx#L265)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 268>** ([line 268](../../../apps/web/src/pages/admin/settings/BillingTaxSettings.tsx#L268)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 268>** ([line 268](../../../apps/web/src/pages/admin/settings/BillingTaxSettings.tsx#L268)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 404](../../../apps/web/src/pages/admin/settings/BillingTaxSettings.tsx#L404)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 404](../../../apps/web/src/pages/admin/settings/BillingTaxSettings.tsx#L404)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 407>** ([line 407](../../../apps/web/src/pages/admin/settings/BillingTaxSettings.tsx#L407)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 407>** ([line 407](../../../apps/web/src/pages/admin/settings/BillingTaxSettings.tsx#L407)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 646>** ([line 646](../../../apps/web/src/pages/admin/settings/BillingTaxSettings.tsx#L646)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 646>** ([line 646](../../../apps/web/src/pages/admin/settings/BillingTaxSettings.tsx#L646)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 697>** ([line 697](../../../apps/web/src/pages/admin/settings/BillingTaxSettings.tsx#L697)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 697>** ([line 697](../../../apps/web/src/pages/admin/settings/BillingTaxSettings.tsx#L697)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 562>** ([line 562](../../../apps/web/src/pages/admin/settings/BillingTaxSettings.tsx#L562)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 570>** ([line 570](../../../apps/web/src/pages/admin/settings/BillingTaxSettings.tsx#L570)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 616>** ([line 616](../../../apps/web/src/pages/admin/settings/BillingTaxSettings.tsx#L616)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 624>** ([line 624](../../../apps/web/src/pages/admin/settings/BillingTaxSettings.tsx#L624)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (8)

- [ ] `api.createPaymentMethod` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createTaxCategory` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.deletePaymentMethod` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.deleteTaxCategory` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listPaymentMethods` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listTaxCategories` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updatePaymentMethod` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateTaxCategory` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._