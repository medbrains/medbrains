# `admin/roles.tsx` walkthrough

_Source: [`apps/web/src/pages/admin/roles.tsx`](../../../apps/web/src/pages/admin/roles.tsx) (990 lines). Guard: `P.ADMIN.ROLES.LIST`. API methods: 7. useForm: 0. Tables: 1. Modals: 3._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.ADMIN.ROLES.LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tables / lists

### `<Table>` @ line 876
  - [ ] Header **Code** column shows correct value for at least one row
  - [ ] Header **Name** column shows correct value for at least one row
  - [ ] Header **Description** column shows correct value for at least one row
  - [ ] Header **Permissions** column shows correct value for at least one row
  - [ ] Header **Status** column shows correct value for at least one row
  - [ ] Header **Actions** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

## Modals / Drawers

### Modal — _Edit Role_ @ [line 669](../../../apps/web/src/pages/admin/roles.tsx#L669)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Modal — _Create Role_ @ [line 761](../../../apps/web/src/pages/admin/roles.tsx#L761)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Drawer — _<drawer @ line 374>_ @ [line 374](../../../apps/web/src/pages/admin/roles.tsx#L374)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (13)

- [ ] **<Checkbox @ line 103>** (`Checkbox`, [line 103](../../../apps/web/src/pages/admin/roles.tsx#L103)) — accepts input, default value sensible, persists after refresh
- [ ] **<Checkbox @ line 132>** (`Checkbox`, [line 132](../../../apps/web/src/pages/admin/roles.tsx#L132)) — accepts input, default value sensible, persists after refresh
- [ ] **Select All** (`TextInput`, [line 388](../../../apps/web/src/pages/admin/roles.tsx#L388)) — accepts input, default value sensible, persists after refresh
- [ ] **Select All** (`Checkbox`, [line 397](../../../apps/web/src/pages/admin/roles.tsx#L397)) — accepts input, default value sensible, persists after refresh
- [ ] **<TextInput @ line 443>** (`TextInput`, [line 443](../../../apps/web/src/pages/admin/roles.tsx#L443)) — accepts input, default value sensible, persists after refresh
- [ ] **<TextInput @ line 540>** (`TextInput`, [line 540](../../../apps/web/src/pages/admin/roles.tsx#L540)) — accepts input, default value sensible, persists after refresh
- [ ] **Code** (`TextInput`, [line 671](../../../apps/web/src/pages/admin/roles.tsx#L671)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 672](../../../apps/web/src/pages/admin/roles.tsx#L672)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`TextInput`, [line 679](../../../apps/web/src/pages/admin/roles.tsx#L679)) — accepts input, default value sensible, persists after refresh
- [ ] **Role Code** (`TextInput`, [line 763](../../../apps/web/src/pages/admin/roles.tsx#L763)) — accepts input, default value sensible, persists after refresh
- [ ] **Role Name** (`TextInput`, [line 770](../../../apps/web/src/pages/admin/roles.tsx#L770)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`TextInput`, [line 777](../../../apps/web/src/pages/admin/roles.tsx#L777)) — accepts input, default value sensible, persists after refresh
- [ ] **Permission Template** (`Select`, [line 783](../../../apps/web/src/pages/admin/roles.tsx#L783)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 7, `<ActionIcon>`: 1, `<Menu.Item>`: 3)

- [ ] **Cancel** ([line 614](../../../apps/web/src/pages/admin/roles.tsx#L614)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 614](../../../apps/web/src/pages/admin/roles.tsx#L614)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 617>** ([line 617](../../../apps/web/src/pages/admin/roles.tsx#L617)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 617>** ([line 617](../../../apps/web/src/pages/admin/roles.tsx#L617)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 693](../../../apps/web/src/pages/admin/roles.tsx#L693)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 693](../../../apps/web/src/pages/admin/roles.tsx#L693)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 696>** ([line 696](../../../apps/web/src/pages/admin/roles.tsx#L696)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 696>** ([line 696](../../../apps/web/src/pages/admin/roles.tsx#L696)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 799](../../../apps/web/src/pages/admin/roles.tsx#L799)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 799](../../../apps/web/src/pages/admin/roles.tsx#L799)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 802>** ([line 802](../../../apps/web/src/pages/admin/roles.tsx#L802)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 802>** ([line 802](../../../apps/web/src/pages/admin/roles.tsx#L802)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 867>** ([line 867](../../../apps/web/src/pages/admin/roles.tsx#L867)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 867>** ([line 867](../../../apps/web/src/pages/admin/roles.tsx#L867)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **More actions** ([line 936](../../../apps/web/src/pages/admin/roles.tsx#L936)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Menu action **<menu item @ line 941>** ([line 941](../../../apps/web/src/pages/admin/roles.tsx#L941)) — visible only when allowed, click triggers expected modal/API/nav, and result is visible
- [ ] Menu action **<menu item @ line 948>** ([line 948](../../../apps/web/src/pages/admin/roles.tsx#L948)) — visible only when allowed, click triggers expected modal/API/nav, and result is visible
- [ ] Menu action **<menu item @ line 956>** ([line 956](../../../apps/web/src/pages/admin/roles.tsx#L956)) — visible only when allowed, click triggers expected modal/API/nav, and result is visible

## API methods used (7)

- [ ] `api.createRole` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.deleteRole` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listRoles` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateRole` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateRoleFieldAccess` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateRolePermissions` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateRoleWidgetAccess` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._