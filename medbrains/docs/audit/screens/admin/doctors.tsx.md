# `admin/doctors.tsx` walkthrough

_Source: [`apps/web/src/pages/admin/doctors.tsx`](../../../apps/web/src/pages/admin/doctors.tsx) (348 lines). Guard: `"admin.doctors.list"`. API methods: 5. useForm: 0. Tables: 1. Modals: 2._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `"admin.doctors.list"` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tables / lists

### `<Table>` @ line 75
  - [ ] Header **Doctor** column shows correct value for at least one row
  - [ ] Header **Qualification** column shows correct value for at least one row
  - [ ] Header **MCI / Council** column shows correct value for at least one row
  - [ ] Header **Type** column shows correct value for at least one row
  - [ ] Header **Capabilities** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

## Modals / Drawers

### Modal — _Add doctor_ @ [line 178](../../../apps/web/src/pages/admin/doctors.tsx#L178)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Modal — _Signature credentials_ @ [line 270](../../../apps/web/src/pages/admin/doctors.tsx#L270)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

## Form inputs (6)

- [ ] **<TextInput @ line 60>** (`TextInput`, [line 60](../../../apps/web/src/pages/admin/doctors.tsx#L60)) — accepts input, default value sensible, persists after refresh
- [ ] **User ID** (`TextInput`, [line 180](../../../apps/web/src/pages/admin/doctors.tsx#L180)) — accepts input, default value sensible, persists after refresh
- [ ] **Display name** (`TextInput`, [line 187](../../../apps/web/src/pages/admin/doctors.tsx#L187)) — accepts input, default value sensible, persists after refresh
- [ ] **MCI number** (`TextInput`, [line 194](../../../apps/web/src/pages/admin/doctors.tsx#L194)) — accepts input, default value sensible, persists after refresh
- [ ] **Display image URL (visual signature stamped on PDFs)** (`TextInput`, [line 274](../../../apps/web/src/pages/admin/doctors.tsx#L274)) — accepts input, default value sensible, persists after refresh
- [ ] **Include revoked** (`Switch`, [line 297](../../../apps/web/src/pages/admin/doctors.tsx#L297)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 5, `<ActionIcon>`: 1, `<Menu.Item>`: 0)

- [ ] **<button @ line 67>** ([line 67](../../../apps/web/src/pages/admin/doctors.tsx#L67)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 67>** ([line 67](../../../apps/web/src/pages/admin/doctors.tsx#L67)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 200](../../../apps/web/src/pages/admin/doctors.tsx#L200)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 200](../../../apps/web/src/pages/admin/doctors.tsx#L200)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 201>** ([line 201](../../../apps/web/src/pages/admin/doctors.tsx#L201)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 201>** ([line 201](../../../apps/web/src/pages/admin/doctors.tsx#L201)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 282>** ([line 282](../../../apps/web/src/pages/admin/doctors.tsx#L282)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 282>** ([line 282](../../../apps/web/src/pages/admin/doctors.tsx#L282)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 323>** ([line 323](../../../apps/web/src/pages/admin/doctors.tsx#L323)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 323>** ([line 323](../../../apps/web/src/pages/admin/doctors.tsx#L323)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 122>** ([line 122](../../../apps/web/src/pages/admin/doctors.tsx#L122)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (5)

- [ ] `api.adminCreateDoctor` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.adminIssueSignatureCredential` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.adminListDoctors` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.adminListSignatureCredentials` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.adminRevokeSignatureCredential` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._