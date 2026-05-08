# `admin/settings/UsersRolesSettings.tsx` walkthrough

_Source: [`apps/web/src/pages/admin/settings/UsersRolesSettings.tsx`](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx) (1046 lines). Guard: `—`. API methods: 12. useForm: 0. Tables: 0. Modals: 4._

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

## Tabs

- [ ] Tab **}>
          Users** (`users`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
          Users** (`users`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
          Users** (`users`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
          Roles** (`roles`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
          Roles** (`roles`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
          Roles** (`roles`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### DataTable columns (12)
- [ ] Column **Full Name** (`full_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Username** (`username`) renders without `undefined` / `[object Object]`
- [ ] Column **Email** (`email`) renders without `undefined` / `[object Object]`
- [ ] Column **Role** (`role`) renders without `undefined` / `[object Object]`
- [ ] Column **Facilities** (`facilities`) renders without `undefined` / `[object Object]`
- [ ] Column **Specialization** (`specialization`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Code** (`code`) renders without `undefined` / `[object Object]`
- [ ] Column **Name** (`name`) renders without `undefined` / `[object Object]`
- [ ] Column **Description** (`description`) renders without `undefined` / `[object Object]`
- [ ] Column **System** (`system`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`

## Modals / Drawers

### Modal — _<modal @ line 303>_ @ [line 303](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx#L303)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Modal — _Delete User_ @ [line 495](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx#L495)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Modal — _<modal @ line 770>_ @ [line 770](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx#L770)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

### Modal — _Delete Role_ @ [line 851](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx#L851)
- [ ] Opens on trigger
- [ ] Required-field validation fires when fields blank
- [ ] Submit returns 2xx and shows success toast
- [ ] Closes after success
- [ ] List refetches and shows the new row
- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty
- [ ] Server-side validation errors surface inline at the field, not just a banner

## Form inputs (15)

- [ ] **Full Name** (`TextInput`, [line 311](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx#L311)) — accepts input, default value sensible, persists after refresh
- [ ] **Username** (`TextInput`, [line 318](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx#L318)) — accepts input, default value sensible, persists after refresh
- [ ] **Email** (`TextInput`, [line 326](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx#L326)) — accepts input, default value sensible, persists after refresh
- [ ] **Password** (`TextInput`, [line 334](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx#L334)) — accepts input, default value sensible, persists after refresh
- [ ] **Role** (`Select`, [line 343](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx#L343)) — accepts input, default value sensible, persists after refresh
- [ ] **Facilities** (`MultiSelect`, [line 358](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx#L358)) — accepts input, default value sensible, persists after refresh
- [ ] **Primary Facility** (`Select`, [line 373](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx#L373)) — accepts input, default value sensible, persists after refresh
- [ ] **Specialization** (`TextInput`, [line 386](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx#L386)) — accepts input, default value sensible, persists after refresh
- [ ] **Medical Registration Number** (`TextInput`, [line 392](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx#L392)) — accepts input, default value sensible, persists after refresh
- [ ] **Qualification** (`TextInput`, [line 398](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx#L398)) — accepts input, default value sensible, persists after refresh
- [ ] **Consultation Fee** (`NumberInput`, [line 404](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx#L404)) — accepts input, default value sensible, persists after refresh
- [ ] **Departments** (`MultiSelect`, [line 413](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx#L413)) — accepts input, default value sensible, persists after refresh
- [ ] **Code** (`TextInput`, [line 778](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx#L778)) — accepts input, default value sensible, persists after refresh
- [ ] **Name** (`TextInput`, [line 786](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx#L786)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`Textarea`, [line 793](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx#L793)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 10, `<ActionIcon>`: 4, `<Menu.Item>`: 0)

- [ ] **Cancel** ([line 433](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx#L433)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 433](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx#L433)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 436>** ([line 436](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx#L436)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 436>** ([line 436](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx#L436)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 505](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx#L505)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 505](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx#L505)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 508>** ([line 508](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx#L508)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 508>** ([line 508](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx#L508)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 646>** ([line 646](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx#L646)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 646>** ([line 646](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx#L646)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 801](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx#L801)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 801](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx#L801)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 804>** ([line 804](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx#L804)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 804>** ([line 804](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx#L804)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 861](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx#L861)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 861](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx#L861)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 864>** ([line 864](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx#L864)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 864>** ([line 864](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx#L864)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 984>** ([line 984](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx#L984)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 984>** ([line 984](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx#L984)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 622>** ([line 622](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx#L622)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 630>** ([line 630](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx#L630)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 960>** ([line 960](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx#L960)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 968>** ([line 968](../../../apps/web/src/pages/admin/settings/UsersRolesSettings.tsx#L968)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (12)

- [ ] `api.assignUserFacilities` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createRole` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createSetupUser` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.deleteRole` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.deleteSetupUser` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listDepartments` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listFacilities` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listRoles` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listSetupUsers` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listUserFacilities` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateRole` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateSetupUser` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._