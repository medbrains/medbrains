# `retrospective.tsx` walkthrough

_Source: [`apps/web/src/pages/retrospective.tsx`](../../../apps/web/src/pages/retrospective.tsx) (428 lines). Guard: `P.RETROSPECTIVE.LIST`. API methods: 5. useForm: 0. Tables: 2. Modals: 1._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.RETROSPECTIVE.LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **}>
              Approval Queue** (`queue`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
              Approval Queue** (`queue`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
              Approval Queue** (`queue`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            All Entries** (`all`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            All Entries** (`all`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            All Entries** (`all`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
              Settings** (`settings`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
              Settings** (`settings`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
              Settings** (`settings`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### DataTable columns (15)
- [ ] Column **Source** (`source_table`) renders without `undefined` / `[object Object]`
- [ ] Column **Clinical Event Date** (`clinical_event_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Entry Date** (`entry_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Entered By** (`entered_by_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Reason** (`reason`) renders without `undefined` / `[object Object]`
- [ ] Column **Actions** (`actions`) renders without `undefined` / `[object Object]`
- [ ] Column **Source** (`source_table`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Clinical Event Date** (`clinical_event_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Entry Date** (`entry_date`) renders without `undefined` / `[object Object]`
- [ ] Column **Entered By** (`entered_by_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Reason** (`reason`) renders without `undefined` / `[object Object]`
- [ ] Column **Reviewed By** (`reviewed_by_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Reviewed At** (`reviewed_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Review Notes** (`review_notes`) renders without `undefined` / `[object Object]`

## Modals / Drawers

### Modal — _<modal @ line 172>_ @ [line 172](../../../apps/web/src/pages/retrospective.tsx#L172)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

## Form inputs (5)

- [ ] **Review Notes (optional)** (`Textarea`, [line 181](../../../apps/web/src/pages/retrospective.tsx#L181)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 280>** (`Select`, [line 280](../../../apps/web/src/pages/retrospective.tsx#L280)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 292>** (`Select`, [line 292](../../../apps/web/src/pages/retrospective.tsx#L292)) — accepts input, default value sensible, persists after refresh
- [ ] **Maximum Backdate Window (hours)** (`NumberInput`, [line 351](../../../apps/web/src/pages/retrospective.tsx#L351)) — accepts input, default value sensible, persists after refresh
- [ ] **Require Approval** (`Switch`, [line 360](../../../apps/web/src/pages/retrospective.tsx#L360)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 5, `<ActionIcon>`: 0, `<Menu.Item>`: 0)

- [ ] **<button @ line 133>** ([line 133](../../../apps/web/src/pages/retrospective.tsx#L133)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 133>** ([line 133](../../../apps/web/src/pages/retrospective.tsx#L133)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 144>** ([line 144](../../../apps/web/src/pages/retrospective.tsx#L144)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 144>** ([line 144](../../../apps/web/src/pages/retrospective.tsx#L144)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **setReviewId(null)}>               Cancel** ([line 188](../../../apps/web/src/pages/retrospective.tsx#L188)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **setReviewId(null)}>               Cancel** ([line 188](../../../apps/web/src/pages/retrospective.tsx#L188)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 191>** ([line 191](../../../apps/web/src/pages/retrospective.tsx#L191)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 191>** ([line 191](../../../apps/web/src/pages/retrospective.tsx#L191)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 368>** ([line 368](../../../apps/web/src/pages/retrospective.tsx#L368)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 368>** ([line 368](../../../apps/web/src/pages/retrospective.tsx#L368)) — failure path works: validation/server error is shown clearly and does not leave stale loading state

## API methods used (5)

- [ ] `api.approveRetroEntry` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getRetroSettings` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listRetroEntries` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.rejectRetroEntry` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateRetroSettings` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._