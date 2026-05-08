# `admin/settings/SequencesSettings.tsx` walkthrough

_Source: [`apps/web/src/pages/admin/settings/SequencesSettings.tsx`](../../../apps/web/src/pages/admin/settings/SequencesSettings.tsx) (355 lines). Guard: `—`. API methods: 4. useForm: 0. Tables: 1. Modals: 1._

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

### `<Table>` @ line 245
  - [ ] Header **Type** column shows correct value for at least one row
  - [ ] Header **Prefix** column shows correct value for at least one row
  - [ ] Header **Pad Width** column shows correct value for at least one row
  - [ ] Header **Next Value** column shows correct value for at least one row
  - [ ] Header **Preview** column shows correct value for at least one row
  - [ ] Header **Actions** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

## Modals / Drawers

### Modal — _<modal @ line 302>_ @ [line 302](../../../apps/web/src/pages/admin/settings/SequencesSettings.tsx#L302)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

## Form inputs (3)

- [ ] **Sequence Type** (`TextInput`, [line 309](../../../apps/web/src/pages/admin/settings/SequencesSettings.tsx#L309)) — accepts input, default value sensible, persists after refresh
- [ ] **Prefix** (`TextInput`, [line 321](../../../apps/web/src/pages/admin/settings/SequencesSettings.tsx#L321)) — accepts input, default value sensible, persists after refresh
- [ ] **Pad Width** (`NumberInput`, [line 327](../../../apps/web/src/pages/admin/settings/SequencesSettings.tsx#L327)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 3, `<ActionIcon>`: 2, `<Menu.Item>`: 0)

- [ ] **<button @ line 235>** ([line 235](../../../apps/web/src/pages/admin/settings/SequencesSettings.tsx#L235)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 235>** ([line 235](../../../apps/web/src/pages/admin/settings/SequencesSettings.tsx#L235)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 343](../../../apps/web/src/pages/admin/settings/SequencesSettings.tsx#L343)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 343](../../../apps/web/src/pages/admin/settings/SequencesSettings.tsx#L343)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 346>** ([line 346](../../../apps/web/src/pages/admin/settings/SequencesSettings.tsx#L346)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 346>** ([line 346](../../../apps/web/src/pages/admin/settings/SequencesSettings.tsx#L346)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 274>** ([line 274](../../../apps/web/src/pages/admin/settings/SequencesSettings.tsx#L274)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 283>** ([line 283](../../../apps/web/src/pages/admin/settings/SequencesSettings.tsx#L283)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (4)

- [ ] `api.createSequence` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.deleteSequence` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listSequences` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateSequence` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._