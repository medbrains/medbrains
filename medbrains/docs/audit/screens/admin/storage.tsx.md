# `admin/storage.tsx` walkthrough

_Source: [`apps/web/src/pages/admin/storage.tsx`](../../../apps/web/src/pages/admin/storage.tsx) (495 lines). Guard: `P.STORAGE.POLICIES.LIST`. API methods: 5. useForm: 0. Tables: 1. Modals: 1._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.STORAGE.POLICIES.LIST` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **}>
            Policies** (`policies`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Policies** (`policies`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Policies** (`policies`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Usage** (`usage`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Usage** (`usage`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Usage** (`usage`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Transitions** (`transitions`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Transitions** (`transitions`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Transitions** (`transitions`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>
            Archived** (`archived`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>
            Archived** (`archived`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>
            Archived** (`archived`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### DataTable columns (16)
- [ ] Column **Category** (`category`) renders without `undefined` / `[object Object]`
- [ ] Column **Hot → Cold** (`hot_to_cold`) renders without `undefined` / `[object Object]`
- [ ] Column **Cold → Archive** (`cold_to_archive`) renders without `undefined` / `[object Object]`
- [ ] Column **Archive → Delete** (`archive_to_delete`) renders without `undefined` / `[object Object]`
- [ ] Column **Retention** (`retention_years`) renders without `undefined` / `[object Object]`
- [ ] Column **Description** (`description`) renders without `undefined` / `[object Object]`
- [ ] Column **Category** (`category`) renders without `undefined` / `[object Object]`
- [ ] Column **Tier** (`tier`) renders without `undefined` / `[object Object]`
- [ ] Column **Records** (`record_count`) renders without `undefined` / `[object Object]`
- [ ] Column **Bytes** (`byte_total`) renders without `undefined` / `[object Object]`
- [ ] Column **When** (`triggered_at`) renders without `undefined` / `[object Object]`
- [ ] Column **Document** (`document`) renders without `undefined` / `[object Object]`
- [ ] Column **Transition** (`transition`) renders without `undefined` / `[object Object]`
- [ ] Column **Size** (`size`) renders without `undefined` / `[object Object]`
- [ ] Column **By** (`by`) renders without `undefined` / `[object Object]`
- [ ] Column **Hash** (`hash`) renders without `undefined` / `[object Object]`

## Modals / Drawers

### Drawer — _<drawer @ line 216>_ @ [line 216](../../../apps/web/src/pages/admin/storage.tsx#L216)
- [ ] Opens on trigger
- [ ] All inner tabs activate without error
- [ ] Submit returns 2xx and toast confirms
- [ ] Closes via Esc + Cancel + ✕

## Form inputs (5)

- [ ] **Hot → Cold (days)** (`NumberInput`, [line 267](../../../apps/web/src/pages/admin/storage.tsx#L267)) — accepts input, default value sensible, persists after refresh
- [ ] **Cold → Archive (days)** (`NumberInput`, [line 274](../../../apps/web/src/pages/admin/storage.tsx#L274)) — accepts input, default value sensible, persists after refresh
- [ ] **Archive → Delete (days)** (`NumberInput`, [line 281](../../../apps/web/src/pages/admin/storage.tsx#L281)) — accepts input, default value sensible, persists after refresh
- [ ] **Retention floor (years)** (`NumberInput`, [line 288](../../../apps/web/src/pages/admin/storage.tsx#L288)) — accepts input, default value sensible, persists after refresh
- [ ] **Description** (`TextInput`, [line 297](../../../apps/web/src/pages/admin/storage.tsx#L297)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 3, `<ActionIcon>`: 0, `<Menu.Item>`: 0)

- [ ] **<button @ line 75>** ([line 75](../../../apps/web/src/pages/admin/storage.tsx#L75)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 75>** ([line 75](../../../apps/web/src/pages/admin/storage.tsx#L75)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **<button @ line 202>** ([line 202](../../../apps/web/src/pages/admin/storage.tsx#L202)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **<button @ line 202>** ([line 202](../../../apps/web/src/pages/admin/storage.tsx#L202)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **update.mutate()}>           Save** ([line 304](../../../apps/web/src/pages/admin/storage.tsx#L304)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **update.mutate()}>           Save** ([line 304](../../../apps/web/src/pages/admin/storage.tsx#L304)) — failure path works: validation/server error is shown clearly and does not leave stale loading state

## API methods used (5)

- [ ] `api.getStorageUsage` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listStoragePolicies` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listStorageTransitions` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.triggerStorageSweep` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.updateStoragePolicy` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._