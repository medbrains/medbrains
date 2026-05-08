# `admin/coverage.tsx` walkthrough

_Source: [`apps/web/src/pages/admin/coverage.tsx`](../../../apps/web/src/pages/admin/coverage.tsx) (267 lines). Guard: `"admin.coverage.list"`. API methods: 4. useForm: 0. Tables: 1. Modals: 1._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `"admin.coverage.list"` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tables / lists

### `<Table>` @ line 81
  - [ ] Header **Absent** column shows correct value for at least one row
  - [ ] Header **Covering** column shows correct value for at least one row
  - [ ] Header **From** column shows correct value for at least one row
  - [ ] Header **Until** column shows correct value for at least one row
  - [ ] Header **Reason** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

## Modals / Drawers

### Modal — _Assign locum coverage_ @ [line 204](../../../apps/web/src/pages/admin/coverage.tsx#L204)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

## Form inputs (6)

- [ ] **Active only** (`Switch`, [line 67](../../../apps/web/src/pages/admin/coverage.tsx#L67)) — accepts input, default value sensible, persists after refresh
- [ ] **Absent doctor** (`Select`, [line 206](../../../apps/web/src/pages/admin/coverage.tsx#L206)) — accepts input, default value sensible, persists after refresh
- [ ] **Covering doctor** (`Select`, [line 214](../../../apps/web/src/pages/admin/coverage.tsx#L214)) — accepts input, default value sensible, persists after refresh
- [ ] **Start** (`DateTimePicker`, [line 223](../../../apps/web/src/pages/admin/coverage.tsx#L223)) — accepts input, default value sensible, persists after refresh
- [ ] **End** (`DateTimePicker`, [line 229](../../../apps/web/src/pages/admin/coverage.tsx#L229)) — accepts input, default value sensible, persists after refresh
- [ ] **Reason** (`Textarea`, [line 236](../../../apps/web/src/pages/admin/coverage.tsx#L236)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 3, `<ActionIcon>`: 1, `<Menu.Item>`: 0)

- [ ] **<button @ line 73>** ([line 73](../../../apps/web/src/pages/admin/coverage.tsx#L73)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 73>** ([line 73](../../../apps/web/src/pages/admin/coverage.tsx#L73)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 245](../../../apps/web/src/pages/admin/coverage.tsx#L245)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 245](../../../apps/web/src/pages/admin/coverage.tsx#L245)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **create.mutate()}           >             Assign** ([line 246](../../../apps/web/src/pages/admin/coverage.tsx#L246)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **create.mutate()}           >             Assign** ([line 246](../../../apps/web/src/pages/admin/coverage.tsx#L246)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 122>** ([line 122](../../../apps/web/src/pages/admin/coverage.tsx#L122)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (4)

- [ ] `api.adminCreateCoverage` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.adminDeleteCoverage` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.adminListCoverage` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.adminListDoctors` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._