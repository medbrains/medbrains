# `admin/settings/CriticalValueRulesSettings.tsx` walkthrough

_Source: [`apps/web/src/pages/admin/settings/CriticalValueRulesSettings.tsx`](../../../apps/web/src/pages/admin/settings/CriticalValueRulesSettings.tsx) (163 lines). Guard: `—`. API methods: 3. useForm: 0. Tables: 1. Modals: 1._

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

### `<Table>` @ line 95
  - [ ] Header **Test Code** column shows correct value for at least one row
  - [ ] Header **Test Name** column shows correct value for at least one row
  - [ ] Header **Low Critical** column shows correct value for at least one row
  - [ ] Header **High Critical** column shows correct value for at least one row
  - [ ] Header **Unit** column shows correct value for at least one row
  - [ ] Header **Gender** column shows correct value for at least one row
  - [ ] Header **Alert Message** column shows correct value for at least one row
  - [ ] Header **}** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

## Modals / Drawers

### Modal — _Add Critical Value Rule_ @ [line 137](../../../apps/web/src/pages/admin/settings/CriticalValueRulesSettings.tsx#L137)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

## Form inputs (7)

- [ ] **Test Code** (`TextInput`, [line 140](../../../apps/web/src/pages/admin/settings/CriticalValueRulesSettings.tsx#L140)) — accepts input, default value sensible, persists after refresh
- [ ] **Test Name** (`TextInput`, [line 141](../../../apps/web/src/pages/admin/settings/CriticalValueRulesSettings.tsx#L141)) — accepts input, default value sensible, persists after refresh
- [ ] **Low Critical** (`NumberInput`, [line 144](../../../apps/web/src/pages/admin/settings/CriticalValueRulesSettings.tsx#L144)) — accepts input, default value sensible, persists after refresh
- [ ] **High Critical** (`NumberInput`, [line 145](../../../apps/web/src/pages/admin/settings/CriticalValueRulesSettings.tsx#L145)) — accepts input, default value sensible, persists after refresh
- [ ] **Unit** (`TextInput`, [line 148](../../../apps/web/src/pages/admin/settings/CriticalValueRulesSettings.tsx#L148)) — accepts input, default value sensible, persists after refresh
- [ ] **Gender** (`Select`, [line 149](../../../apps/web/src/pages/admin/settings/CriticalValueRulesSettings.tsx#L149)) — accepts input, default value sensible, persists after refresh
- [ ] **Alert Message** (`Textarea`, [line 151](../../../apps/web/src/pages/admin/settings/CriticalValueRulesSettings.tsx#L151)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 3, `<ActionIcon>`: 1, `<Menu.Item>`: 0)

- [ ] **<button @ line 89>** ([line 89](../../../apps/web/src/pages/admin/settings/CriticalValueRulesSettings.tsx#L89)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 89>** ([line 89](../../../apps/web/src/pages/admin/settings/CriticalValueRulesSettings.tsx#L89)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 153](../../../apps/web/src/pages/admin/settings/CriticalValueRulesSettings.tsx#L153)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 153](../../../apps/web/src/pages/admin/settings/CriticalValueRulesSettings.tsx#L153)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Create** ([line 154](../../../apps/web/src/pages/admin/settings/CriticalValueRulesSettings.tsx#L154)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Create** ([line 154](../../../apps/web/src/pages/admin/settings/CriticalValueRulesSettings.tsx#L154)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 120>** ([line 120](../../../apps/web/src/pages/admin/settings/CriticalValueRulesSettings.tsx#L120)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (3)

- [ ] `api.createCriticalValueRule` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.deleteCriticalValueRule` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listCriticalValueRules` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._