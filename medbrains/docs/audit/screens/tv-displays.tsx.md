# `tv-displays.tsx` walkthrough

_Source: [`apps/web/src/pages/tv-displays.tsx`](../../../apps/web/src/pages/tv-displays.tsx) (826 lines). Guard: `P.ADMIN.TV_DISPLAYS.LIST`. API methods: 12. useForm: 0. Tables: 2. Modals: 2._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.ADMIN.TV_DISPLAYS.LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **}>Displays** (`displays`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Displays** (`displays`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Displays** (`displays`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Queue Tokens** (`tokens`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Queue Tokens** (`tokens`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Queue Tokens** (`tokens`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Announcements** (`announcements`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Announcements** (`announcements`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Announcements** (`announcements`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### DataTable columns (13)
- [ ] Column **Location** (`location_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Type** (`display_type`) renders without `undefined` / `[object Object]`
- [ ] Column **Department** (`department_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Languages** (`language`) renders without `undefined` / `[object Object]`
- [ ] Column **Options** (`show_patient_name`) renders without `undefined` / `[object Object]`
- [ ] Column **Actions** (`id`) renders without `undefined` / `[object Object]`
- [ ] Column **Token** (`token_number`) renders without `undefined` / `[object Object]`
- [ ] Column **Status** (`status`) renders without `undefined` / `[object Object]`
- [ ] Column **Priority** (`priority`) renders without `undefined` / `[object Object]`
- [ ] Column **Department** (`department_id`) renders without `undefined` / `[object Object]`
- [ ] Column **Called At** (`called_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Created** (`created_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Actions** (`id`) renders without `undefined` / `[object Object]`

## Modals / Drawers

### Drawer — _<drawer @ line 339>_ @ [line 339](../../../apps/web/src/pages/tv-displays.tsx#L339)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

### Drawer — _Generate Queue Token_ @ [line 664](../../../apps/web/src/pages/tv-displays.tsx#L664)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (18)

- [ ] **Location Name** (`TextInput`, [line 348](../../../apps/web/src/pages/tv-displays.tsx#L348)) — accepts input, default value sensible, persists after refresh
- [ ] **Display Type** (`Select`, [line 355](../../../apps/web/src/pages/tv-displays.tsx#L355)) — accepts input, default value sensible, persists after refresh
- [ ] **Department** (`Select`, [line 362](../../../apps/web/src/pages/tv-displays.tsx#L362)) — accepts input, default value sensible, persists after refresh
- [ ] **Doctors Per Screen** (`NumberInput`, [line 370](../../../apps/web/src/pages/tv-displays.tsx#L370)) — accepts input, default value sensible, persists after refresh
- [ ] **Languages** (`MultiSelect`, [line 377](../../../apps/web/src/pages/tv-displays.tsx#L377)) — accepts input, default value sensible, persists after refresh
- [ ] **Scroll Speed (seconds)** (`NumberInput`, [line 383](../../../apps/web/src/pages/tv-displays.tsx#L383)) — accepts input, default value sensible, persists after refresh
- [ ] **Show Patient Name** (`Switch`, [line 390](../../../apps/web/src/pages/tv-displays.tsx#L390)) — accepts input, default value sensible, persists after refresh
- [ ] **Show Wait Time** (`Switch`, [line 395](../../../apps/web/src/pages/tv-displays.tsx#L395)) — accepts input, default value sensible, persists after refresh
- [ ] **Enable Announcements** (`Switch`, [line 400](../../../apps/web/src/pages/tv-displays.tsx#L400)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 622>** (`Select`, [line 622](../../../apps/web/src/pages/tv-displays.tsx#L622)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 630>** (`Select`, [line 630](../../../apps/web/src/pages/tv-displays.tsx#L630)) — accepts input, default value sensible, persists after refresh
- [ ] **Department** (`Select`, [line 673](../../../apps/web/src/pages/tv-displays.tsx#L673)) — accepts input, default value sensible, persists after refresh
- [ ] **Patient ID (optional)** (`TextInput`, [line 679](../../../apps/web/src/pages/tv-displays.tsx#L679)) — accepts input, default value sensible, persists after refresh
- [ ] **Doctor ID (optional)** (`TextInput`, [line 680](../../../apps/web/src/pages/tv-displays.tsx#L680)) — accepts input, default value sensible, persists after refresh
- [ ] **Priority** (`Select`, [line 681](../../../apps/web/src/pages/tv-displays.tsx#L681)) — accepts input, default value sensible, persists after refresh
- [ ] **Message** (`Textarea`, [line 753](../../../apps/web/src/pages/tv-displays.tsx#L753)) — accepts input, default value sensible, persists after refresh
- [ ] **Priority** (`Select`, [line 762](../../../apps/web/src/pages/tv-displays.tsx#L762)) — accepts input, default value sensible, persists after refresh
- [ ] **Target Displays** (`MultiSelect`, [line 770](../../../apps/web/src/pages/tv-displays.tsx#L770)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 8, `<ActionIcon>`: 5, `<Menu.Item>`: 0)

- [ ] **<button @ line 320>** ([line 320](../../../apps/web/src/pages/tv-displays.tsx#L320)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 320>** ([line 320](../../../apps/web/src/pages/tv-displays.tsx#L320)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 406](../../../apps/web/src/pages/tv-displays.tsx#L406)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 406](../../../apps/web/src/pages/tv-displays.tsx#L406)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 407>** ([line 407](../../../apps/web/src/pages/tv-displays.tsx#L407)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 407>** ([line 407](../../../apps/web/src/pages/tv-displays.tsx#L407)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 638>** ([line 638](../../../apps/web/src/pages/tv-displays.tsx#L638)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 638>** ([line 638](../../../apps/web/src/pages/tv-displays.tsx#L638)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 650>** ([line 650](../../../apps/web/src/pages/tv-displays.tsx#L650)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 650>** ([line 650](../../../apps/web/src/pages/tv-displays.tsx#L650)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Cancel** ([line 695](../../../apps/web/src/pages/tv-displays.tsx#L695)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Cancel** ([line 695](../../../apps/web/src/pages/tv-displays.tsx#L695)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **Generate** ([line 696](../../../apps/web/src/pages/tv-displays.tsx#L696)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **Generate** ([line 696](../../../apps/web/src/pages/tv-displays.tsx#L696)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 781>** ([line 781](../../../apps/web/src/pages/tv-displays.tsx#L781)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 781>** ([line 781](../../../apps/web/src/pages/tv-displays.tsx#L781)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] Action icon **<action icon @ line 263>** ([line 263](../../../apps/web/src/pages/tv-displays.tsx#L263)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 277>** ([line 277](../../../apps/web/src/pages/tv-displays.tsx#L277)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 538>** ([line 538](../../../apps/web/src/pages/tv-displays.tsx#L538)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 552>** ([line 552](../../../apps/web/src/pages/tv-displays.tsx#L552)) — expected row action works, confirmation appears for destructive action, result is visible after refetch
- [ ] Action icon **<action icon @ line 563>** ([line 563](../../../apps/web/src/pages/tv-displays.tsx#L563)) — expected row action works, confirmation appears for destructive action, result is visible after refetch

## API methods used (12)

- [ ] `api.broadcastAnnouncement` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.callQueueToken` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.completeQueueToken` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createQueueToken` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.createTvDisplay` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.deleteTvDisplay` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.getQueueState` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listDepartments` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listQueueTokens` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listTvDisplays` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.noShowQueueToken` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateTvDisplay` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._