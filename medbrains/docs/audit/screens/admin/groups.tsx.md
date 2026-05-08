# `admin/groups.tsx` walkthrough

_Source: [`apps/web/src/pages/admin/groups.tsx`](../../../apps/web/src/pages/admin/groups.tsx) (399 lines). Guard: `"admin.users.list"`. API methods: 8. useForm: 0. Tables: 2. Modals: 2._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `"admin.users.list"` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tables / lists

### `<Table>` @ line 77
  - [ ] Header **Code** column shows correct value for at least one row
  - [ ] Header **Name** column shows correct value for at least one row
  - [ ] Header **Description** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Header **Actions** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 350
  - [ ] Header **User** column shows correct value for at least one row
  - [ ] Header **Role** column shows correct value for at least one row
  - [ ] Header **Expires** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

## Modals / Drawers

### Modal — _<modal @ line 213>_ @ [line 213](../../../apps/web/src/pages/admin/groups.tsx#L213)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Drawer — _<drawer @ line 308>_ @ [line 308](../../../apps/web/src/pages/admin/groups.tsx#L308)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (5)

- [ ] **Code** (`TextInput`, [line 220](../../../apps/web/src/pages/admin/groups.tsx#L220)) — accepts input, default value sensible, persists after refresh
- [ ] **Display name** (`TextInput`, [line 228](../../../apps/web/src/pages/admin/groups.tsx#L228)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`Textarea`, [line 234](../../../apps/web/src/pages/admin/groups.tsx#L234)) — accepts input, default value sensible, persists after refresh
- [ ] **User** (`Select`, [line 318](../../../apps/web/src/pages/admin/groups.tsx#L318)) — accepts input, default value sensible, persists after refresh
- [ ] **Expires at (optional)** (`DateTimePicker`, [line 329](../../../apps/web/src/pages/admin/groups.tsx#L329)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 5, `<ActionIcon>`: 3, `<Menu.Item>`: 0)

- [ ] **<button @ line 71>** ([line 71](../../../apps/web/src/pages/admin/groups.tsx#L71)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 71>** ([line 71](../../../apps/web/src/pages/admin/groups.tsx#L71)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 242](../../../apps/web/src/pages/admin/groups.tsx#L242)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 242](../../../apps/web/src/pages/admin/groups.tsx#L242)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 245>** ([line 245](../../../apps/web/src/pages/admin/groups.tsx#L245)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 245>** ([line 245](../../../apps/web/src/pages/admin/groups.tsx#L245)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 337>** ([line 337](../../../apps/web/src/pages/admin/groups.tsx#L337)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 337>** ([line 337](../../../apps/web/src/pages/admin/groups.tsx#L337)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 375>** ([line 375](../../../apps/web/src/pages/admin/groups.tsx#L375)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 375>** ([line 375](../../../apps/web/src/pages/admin/groups.tsx#L375)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 109>** ([line 109](../../../apps/web/src/pages/admin/groups.tsx#L109)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 117>** ([line 117](../../../apps/web/src/pages/admin/groups.tsx#L117)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 122>** ([line 122](../../../apps/web/src/pages/admin/groups.tsx#L122)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (8)

- [ ] `api.addAccessGroupMember` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createAccessGroup` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.deleteAccessGroup` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listAccessGroupMembers` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listAccessGroups` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listSetupUsers` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.removeAccessGroupMember` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateAccessGroup` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._