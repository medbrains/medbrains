# `admin/settings/DrugInteractionsSettings.tsx` walkthrough

_Source: [`apps/web/src/pages/admin/settings/DrugInteractionsSettings.tsx`](../../../apps/web/src/pages/admin/settings/DrugInteractionsSettings.tsx) (169 lines). Guard: `—`. API methods: 3. useForm: 0. Tables: 1. Modals: 1._

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

### `<Table>` @ line 99
  - [ ] Header **Drug A** column shows correct value for at least one row
  - [ ] Header **Drug B** column shows correct value for at least one row
  - [ ] Header **Severity** column shows correct value for at least one row
  - [ ] Header **Description** column shows correct value for at least one row
  - [ ] Header **Management** column shows correct value for at least one row
  - [ ] Header **}** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

## Modals / Drawers

### Modal — _Add Drug Interaction Rule_ @ [line 139](../../../apps/web/src/pages/admin/settings/DrugInteractionsSettings.tsx#L139)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

## Form inputs (6)

- [ ] **Drug A** (`TextInput`, [line 141](../../../apps/web/src/pages/admin/settings/DrugInteractionsSettings.tsx#L141)) — accepts input, default value sensible, persists after refresh
- [ ] **Drug B** (`TextInput`, [line 142](../../../apps/web/src/pages/admin/settings/DrugInteractionsSettings.tsx#L142)) — accepts input, default value sensible, persists after refresh
- [ ] **Severity** (`Select`, [line 143](../../../apps/web/src/pages/admin/settings/DrugInteractionsSettings.tsx#L143)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`Textarea`, [line 155](../../../apps/web/src/pages/admin/settings/DrugInteractionsSettings.tsx#L155)) — accepts input, default value sensible, persists after refresh
- [ ] **Mechanism** (`TextInput`, [line 156](../../../apps/web/src/pages/admin/settings/DrugInteractionsSettings.tsx#L156)) — accepts input, default value sensible, persists after refresh
- [ ] **Management** (`Textarea`, [line 157](../../../apps/web/src/pages/admin/settings/DrugInteractionsSettings.tsx#L157)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 3, `<ActionIcon>`: 1, `<Menu.Item>`: 0)

- [ ] **<button @ line 93>** ([line 93](../../../apps/web/src/pages/admin/settings/DrugInteractionsSettings.tsx#L93)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 93>** ([line 93](../../../apps/web/src/pages/admin/settings/DrugInteractionsSettings.tsx#L93)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 159](../../../apps/web/src/pages/admin/settings/DrugInteractionsSettings.tsx#L159)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 159](../../../apps/web/src/pages/admin/settings/DrugInteractionsSettings.tsx#L159)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Create** ([line 160](../../../apps/web/src/pages/admin/settings/DrugInteractionsSettings.tsx#L160)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Create** ([line 160](../../../apps/web/src/pages/admin/settings/DrugInteractionsSettings.tsx#L160)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 122>** ([line 122](../../../apps/web/src/pages/admin/settings/DrugInteractionsSettings.tsx#L122)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (3)

- [ ] `api.createDrugInteraction` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.deleteDrugInteraction` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listDrugInteractions` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._