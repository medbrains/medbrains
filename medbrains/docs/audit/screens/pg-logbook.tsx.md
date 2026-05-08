# `pg-logbook.tsx` walkthrough

_Source: [`apps/web/src/pages/pg-logbook.tsx`](../../../apps/web/src/pages/pg-logbook.tsx) (326 lines). Guard: `P.OPD.QUEUE_LIST`. API methods: 5. useForm: 0. Tables: 2. Modals: 1._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.OPD.QUEUE_LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tables / lists

### `<Table>` @ line 215
  - [ ] Header **Date** column shows correct value for at least one row
  - [ ] Header **Type** column shows correct value for at least one row
  - [ ] Header **Title** column shows correct value for at least one row
  - [ ] Header **Diagnosis Codes** column shows correct value for at least one row
  - [ ] Header **Verified** column shows correct value for at least one row
  - [ ] Header **Action** column shows correct value for at least one row
  - [ ] Header **Order Type** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Header **Created** column shows correct value for at least one row
  - [ ] Header **Action** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 293
  - [ ] Header **Order Type** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Header **Created** column shows correct value for at least one row
  - [ ] Header **Action** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

## Modals / Drawers

### Modal — _New Logbook Entry_ @ [line 177](../../../apps/web/src/pages/pg-logbook.tsx#L177)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

## Form inputs (5)

- [ ] **Entry Type** (`Select`, [line 179](../../../apps/web/src/pages/pg-logbook.tsx#L179)) — accepts input, default value sensible, persists after refresh
- [ ] **Title** (`TextInput`, [line 180](../../../apps/web/src/pages/pg-logbook.tsx#L180)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`Textarea`, [line 181](../../../apps/web/src/pages/pg-logbook.tsx#L181)) — accepts input, default value sensible, persists after refresh
- [ ] **Diagnosis Codes** (`TextInput`, [line 182](../../../apps/web/src/pages/pg-logbook.tsx#L182)) — accepts input, default value sensible, persists after refresh
- [ ] **Procedure Codes** (`TextInput`, [line 183](../../../apps/web/src/pages/pg-logbook.tsx#L183)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 5, `<ActionIcon>`: 1, `<Menu.Item>`: 0)

- [ ] **<button @ line 137>** ([line 137](../../../apps/web/src/pages/pg-logbook.tsx#L137)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 137>** ([line 137](../../../apps/web/src/pages/pg-logbook.tsx#L137)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 186](../../../apps/web/src/pages/pg-logbook.tsx#L186)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 186](../../../apps/web/src/pages/pg-logbook.tsx#L186)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Save Entry** ([line 187](../../../apps/web/src/pages/pg-logbook.tsx#L187)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Save Entry** ([line 187](../../../apps/web/src/pages/pg-logbook.tsx#L187)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **onDecision(e.id, "approved")}>                     Approve** ([line 311](../../../apps/web/src/pages/pg-logbook.tsx#L311)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **onDecision(e.id, "approved")}>                     Approve** ([line 311](../../../apps/web/src/pages/pg-logbook.tsx#L311)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **onDecision(e.id, "denied")}>                     Deny** ([line 314](../../../apps/web/src/pages/pg-logbook.tsx#L314)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **onDecision(e.id, "denied")}>                     Deny** ([line 314](../../../apps/web/src/pages/pg-logbook.tsx#L314)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 253>** ([line 253](../../../apps/web/src/pages/pg-logbook.tsx#L253)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (5)

- [ ] `api.createPgLogbookEntry` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listCoSignatures` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listPgLogbook` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateCoSignature` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.verifyPgLogbookEntry` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._