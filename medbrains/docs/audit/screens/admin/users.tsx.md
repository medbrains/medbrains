# `admin/users.tsx` walkthrough

_Source: [`apps/web/src/pages/admin/users.tsx`](../../../apps/web/src/pages/admin/users.tsx) (1553 lines). Guard: `P.ADMIN.USERS.LIST`. API methods: 8. useForm: 0. Tables: 0. Modals: 4._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.ADMIN.USERS.LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tables / lists

### DataTable columns (6)
- [ ] Column **Full Name** (`full_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Username** (`username`) renders without `undefined` / `[object Object]`
- [ ] Column **Email** (`email`) renders without `undefined` / `[object Object]`
- [ ] Column **Role** (`role`) renders without `undefined` / `[object Object]`
- [ ] Column **Specialization** (`specialization`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`

## Modals / Drawers

### Modal — _<modal @ line 406>_ @ [line 406](../../../apps/web/src/pages/admin/users.tsx#L406)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Modal — _Delete User_ @ [line 581](../../../apps/web/src/pages/admin/users.tsx#L581)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Modal — _Bulk Import Users_ @ [line 1282](../../../apps/web/src/pages/admin/users.tsx#L1282)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Drawer — _<drawer @ line 869>_ @ [line 869](../../../apps/web/src/pages/admin/users.tsx#L869)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (20)

- [ ] **<Checkbox @ line 150>** (`Checkbox`, [line 150](../../../apps/web/src/pages/admin/users.tsx#L150)) — accepts input, default value sensible, persists after refresh
- [ ] **<Checkbox @ line 179>** (`Checkbox`, [line 179](../../../apps/web/src/pages/admin/users.tsx#L179)) — accepts input, default value sensible, persists after refresh
- [ ] **Full Name** (`TextInput`, [line 414](../../../apps/web/src/pages/admin/users.tsx#L414)) — accepts input, default value sensible, persists after refresh
- [ ] **Username** (`TextInput`, [line 421](../../../apps/web/src/pages/admin/users.tsx#L421)) — accepts input, default value sensible, persists after refresh
- [ ] **Email** (`TextInput`, [line 429](../../../apps/web/src/pages/admin/users.tsx#L429)) — accepts input, default value sensible, persists after refresh
- [ ] **Password** (`TextInput`, [line 437](../../../apps/web/src/pages/admin/users.tsx#L437)) — accepts input, default value sensible, persists after refresh
- [ ] **Role** (`Select`, [line 446](../../../apps/web/src/pages/admin/users.tsx#L446)) — accepts input, default value sensible, persists after refresh
- [ ] **Active** (`Switch`, [line 462](../../../apps/web/src/pages/admin/users.tsx#L462)) — accepts input, default value sensible, persists after refresh
- [ ] **Specialization** (`TextInput`, [line 472](../../../apps/web/src/pages/admin/users.tsx#L472)) — accepts input, default value sensible, persists after refresh
- [ ] **Medical Registration Number** (`TextInput`, [line 478](../../../apps/web/src/pages/admin/users.tsx#L478)) — accepts input, default value sensible, persists after refresh
- [ ] **Qualification** (`TextInput`, [line 484](../../../apps/web/src/pages/admin/users.tsx#L484)) — accepts input, default value sensible, persists after refresh
- [ ] **Consultation Fee** (`NumberInput`, [line 490](../../../apps/web/src/pages/admin/users.tsx#L490)) — accepts input, default value sensible, persists after refresh
- [ ] **Departments** (`MultiSelect`, [line 499](../../../apps/web/src/pages/admin/users.tsx#L499)) — accepts input, default value sensible, persists after refresh
- [ ] **Select All** (`TextInput`, [line 917](../../../apps/web/src/pages/admin/users.tsx#L917)) — accepts input, default value sensible, persists after refresh
- [ ] **Select All** (`Checkbox`, [line 926](../../../apps/web/src/pages/admin/users.tsx#L926)) — accepts input, default value sensible, persists after refresh
- [ ] **<TextInput @ line 962>** (`TextInput`, [line 962](../../../apps/web/src/pages/admin/users.tsx#L962)) — accepts input, default value sensible, persists after refresh
- [ ] **Select All** (`Checkbox`, [line 971](../../../apps/web/src/pages/admin/users.tsx#L971)) — accepts input, default value sensible, persists after refresh
- [ ] **<TextInput @ line 1007>** (`TextInput`, [line 1007](../../../apps/web/src/pages/admin/users.tsx#L1007)) — accepts input, default value sensible, persists after refresh
- [ ] **<TextInput @ line 1116>** (`TextInput`, [line 1116](../../../apps/web/src/pages/admin/users.tsx#L1116)) — accepts input, default value sensible, persists after refresh
- [ ] **User Data (JSON)** (`Textarea`, [line 1292](../../../apps/web/src/pages/admin/users.tsx#L1292)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 10, `<ActionIcon>`: 3, `<Menu.Item>`: 0)

- [ ] **Cancel** ([line 519](../../../apps/web/src/pages/admin/users.tsx#L519)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 519](../../../apps/web/src/pages/admin/users.tsx#L519)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 522>** ([line 522](../../../apps/web/src/pages/admin/users.tsx#L522)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 522>** ([line 522](../../../apps/web/src/pages/admin/users.tsx#L522)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 591](../../../apps/web/src/pages/admin/users.tsx#L591)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 591](../../../apps/web/src/pages/admin/users.tsx#L591)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 594>** ([line 594](../../../apps/web/src/pages/admin/users.tsx#L594)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 594>** ([line 594](../../../apps/web/src/pages/admin/users.tsx#L594)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 1192](../../../apps/web/src/pages/admin/users.tsx#L1192)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 1192](../../../apps/web/src/pages/admin/users.tsx#L1192)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1195>** ([line 1195](../../../apps/web/src/pages/admin/users.tsx#L1195)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1195>** ([line 1195](../../../apps/web/src/pages/admin/users.tsx#L1195)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 1311](../../../apps/web/src/pages/admin/users.tsx#L1311)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 1311](../../../apps/web/src/pages/admin/users.tsx#L1311)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1314>** ([line 1314](../../../apps/web/src/pages/admin/users.tsx#L1314)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1314>** ([line 1314](../../../apps/web/src/pages/admin/users.tsx#L1314)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1485>** ([line 1485](../../../apps/web/src/pages/admin/users.tsx#L1485)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1485>** ([line 1485](../../../apps/web/src/pages/admin/users.tsx#L1485)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 1492>** ([line 1492](../../../apps/web/src/pages/admin/users.tsx#L1492)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 1492>** ([line 1492](../../../apps/web/src/pages/admin/users.tsx#L1492)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 1436>** ([line 1436](../../../apps/web/src/pages/admin/users.tsx#L1436)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 1448>** ([line 1448](../../../apps/web/src/pages/admin/users.tsx#L1448)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 1460>** ([line 1460](../../../apps/web/src/pages/admin/users.tsx#L1460)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (8)

- [ ] `api.bulkCreateUsers` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createSetupUser` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.deleteSetupUser` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listDepartments` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listRoles` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listSetupUsers` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateSetupUser` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateUserAccessMatrix` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._